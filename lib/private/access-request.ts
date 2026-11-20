// "Request a Desk" (D130, issue 453): an alliance's leadership asks for a Desk without an account. The form
// sends the alliance (one we track), the in-game name and the rank claimed (R5 or R4). The name is matched
// against the alliance's newest roster for the owner, who decides on /admin; the match never blocks. Kept:
// the name, the rank claimed, and the roster's rank and date when found (D71: no other roster field). The
// requester's way back to the answer is a random status secret, in a cookie and a link they can keep.
import { z } from "zod";

import { IP_LIMIT, IP_WINDOW_MS, secretEquals } from "../auth";
import type { Db } from "../db";
import {
  findRequest,
  insertRequest,
  purgeOldInvites,
  sha256,
  takenWorkspaceKeys,
  type RequestRow,
} from "../repo/alliance-invites";
import { isKnownAlliance, knownAlliances } from "../repo/alliances";
import { currentCount, DAY_KEY_PREFIX, recordFailure } from "../repo/auth-attempts";
import { anyRoster } from "../repo/workspace-any-roster";
import { latestRoster } from "../repo/workspace-rosters";
import type { ClaimedRole, RosterMatch } from "../schema-invites";
import { nameKey } from "../screenshot/name-key";
import { allianceOf, closedWhy, inviteCookie, inviteFrom } from "./invite";
import { privateLog } from "./log";
import { cookieAttributes } from "./session";

export const REQUEST_COOKIE = "__Host-lap_request";
/** The status cookie outlives the answer's 30 days (KEEP_MS) a little. */
const REQUEST_COOKIE_MS = 45 * 24 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** Per address and per day; and for the whole site per day, so a flood cannot bury real requests. */
export const PER_IP_DAY = 3;
export const SITE_DAY = 30;
export const SITE_KEY = `${DAY_KEY_PREFIX}request:site`;
const CREDENTIAL = /^(\d{1,9})\.([A-Za-z0-9_-]{43})$/;

export const requestInput = z
  .object({
    // D133: any alliance we know (the ranks board, or a daily roster), checked in submitRequest.
    union_id: z.number().int().positive(),
    name: z.string().trim().min(1).max(40),
    role: z.enum(["r5", "r4"]),
  })
  .strict();

const LEADER = 105;

/** The rank the roster gives: its label ("R4 · Recruiter"), else R1–R5 from the code; null when unknown. */
export function rankText(code: number | null, label: string | null): string | null {
  if (label) return label;
  if (code !== null && code >= 101 && code <= LEADER) return `R${code - 100}`;
  return null;
}

/**
 * The name against the newest roster of any kind: found (with rank and date) or not. Never blocks the
 * request. The rank is the newest daily read's (D72) when it lists the member, else a Start or End's.
 */
async function rosterCheck(db: Db, unionId: number, name: string) {
  const [roster, daily] = await Promise.all([anyRoster(db, unionId), latestRoster(db, unionId)]);
  const key = nameKey(name);
  const hit = roster?.members.find((m) => key !== "" && nameKey(m.name) === key);
  if (!roster || !hit) {
    return { rosterMatch: "not_found" as RosterMatch, rosterRank: null, rosterSeenAt: null };
  }
  const ranked = daily.find((m) => m.uid === hit.uid && m.rankCode !== null) ?? hit;
  return {
    rosterMatch: "found" as RosterMatch,
    rosterRank: rankText(ranked.rankCode, ranked.rankLabel),
    rosterSeenAt: roster.at,
  };
}

export type Submitted =
  | {
      ok: true;
      credential: string;
      cookie: string;
      match: RosterMatch;
      /** For the owner's Discord line: no private roster field. */
      line: {
        tag: string;
        name: string;
        player: string;
        claimed: ClaimedRole;
        rank: string | null;
      };
      seenAt: Date | null;
    }
  | { ok: false; code: "rate_limited" | "has_desk" | "unknown_alliance" };

export async function submitRequest(
  db: Db,
  input: z.infer<typeof requestInput>,
  ip: string,
  now: Date,
): Promise<Submitted> {
  if (!(await isKnownAlliance(db, input.union_id))) return { ok: false, code: "unknown_alliance" };
  const taken = await takenWorkspaceKeys(db);
  if (taken.some((w) => w.unionId === input.union_id)) return { ok: false, code: "has_desk" };
  // The address first: one that is over its own limit never uses up the site's 30.
  const mine = await recordFailure(db, `${DAY_KEY_PREFIX}request:ip:${ip}`, DAY_MS, now);
  if (mine > PER_IP_DAY) return { ok: false, code: "rate_limited" };
  const all = await recordFailure(db, SITE_KEY, DAY_MS, now);
  if (all > SITE_DAY) return { ok: false, code: "rate_limited" };
  await purgeOldInvites(db, now);
  const roster = await rosterCheck(db, input.union_id, input.name);
  const credential = await insertRequest(
    db,
    { unionId: input.union_id, playerName: input.name, claimedRole: input.role, ...roster },
    now,
  );
  privateLog("w.request.sent", { found: roster.rosterMatch === "found" ? 1 : 0 });
  const { tag, name } = await allianceOf(db, input.union_id);
  return {
    ok: true,
    credential,
    cookie: requestCookie(credential),
    match: roster.rosterMatch,
    line: { tag, name, player: input.name, claimed: input.role, rank: roster.rosterRank },
    seenAt: roster.rosterSeenAt,
  };
}

const requestCookie = (credential: string) =>
  `${REQUEST_COOKIE}=${credential}; ${cookieAttributes(REQUEST_COOKIE_MS)}`;

/** The request a status secret opens, or null. */
async function requestFrom(db: Db, value: string | undefined): Promise<RequestRow | null> {
  const m = CREDENTIAL.exec(value ?? "");
  if (!m) return null;
  const row = await findRequest(db, Number(m[1]));
  return row && secretEquals(sha256(m[2] ?? ""), row.statusHash) ? row : null;
}

/** GET /api/w/request/<id>.<secret>: the status cookie, counted like a wrong invite link when wrong. */
export async function openRequestLink(db: Db, token: string, ip: string, now: Date) {
  const ipKey = `w:ip:${ip}`;
  if ((await currentCount(db, ipKey, IP_WINDOW_MS, now)) >= IP_LIMIT) return "rate_limited";
  if (!(await requestFrom(db, token))) {
    await recordFailure(db, ipKey, IP_WINDOW_MS, now);
    return "bad_link";
  }
  return requestCookie(token);
}

export type RequestView = {
  alliance: { tag: string; name: string };
  player: string;
  state: "waiting" | "approved" | "declined";
  reason: string | null;
  /** The status link, to open the answer on another device. */
  credential: string;
} | null;

/** The form's alliances (D133): every alliance we know, `[TAG] Name`, by tag. */
export async function requestChoices(db: Db): Promise<{ unionId: number; label: string }[]> {
  return (await knownAlliances(db)).map((a) => ({
    unionId: a.unionId,
    label: [a.tag && `[${a.tag}]`, a.name].filter(Boolean).join(" ") || String(a.unionId),
  }));
}

/** /w/request: the browser's own request and its answer, nothing of any other. */
export async function requestView(db: Db, value: string | undefined): Promise<RequestView> {
  const row = await requestFrom(db, value);
  if (!row || !value) return null;
  return {
    alliance: await allianceOf(db, row.unionId),
    player: row.playerName,
    state: row.decision === null ? "waiting" : row.decision,
    reason: row.declineReason,
    credential: value,
  };
}

/** "Continue" after approval: the invite cookie from the status secret, or null when the invite is closed. */
export async function continueRequest(db: Db, value: string | undefined, now: Date) {
  const credential = `r.${value ?? ""}`;
  const invite = await inviteFrom(db, credential);
  return invite && !closedWhy(invite, now) ? inviteCookie(credential) : null;
}
