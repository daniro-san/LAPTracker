// A new alliance's invite link (D130, issue 453): who may use it, and what the page shows. The link
// (`/api/w/invite/<id>.<secret>`) is traded at once for an HttpOnly cookie, so the secret never sits in the
// page's address, analytics or a Referer. An approved request's status secret opens the same invite (`r.`).
// Every secret is compared with timingSafeEqual on its sha256. Signing in through Discord binds the invite to
// that account (lib/private/invite-sign-in.ts); each step after it needs the claim cookie that sign-in set.
import { ALLIANCES } from "../../config/alliances";
import { IP_LIMIT, IP_WINDOW_MS, secretEquals } from "../auth";
import type { Db } from "../db";
import type { Env } from "../env";
import {
  findInvite,
  findRequest,
  sha256,
  takenWorkspaceKeys,
  type InviteRow,
} from "../repo/alliance-invites";
import { currentCount, recordFailure } from "../repo/auth-attempts";
import { installUrl } from "./discord-setup";
import { ROLES_PERMISSIONS } from "./invite-discord";
import { privateLog } from "./log";
import { cookieAttributes } from "./session";

export const INVITE_COOKIE = "__Host-lap_invite";
export const CLAIM_COOKIE = "__Host-lap_invite_who";
/** The invite and claim cookies last a day; the link itself works for 7 (INVITE_MS). */
export const INVITE_COOKIE_MS = 24 * 60 * 60_000;
/** `i.<id>.<secret>` from the owner's link, `r.<id>.<secret>` from an approved request's status. */
const CREDENTIAL = /^([ir])\.(\d{1,9})\.([A-Za-z0-9_-]{43})$/;

export interface CookieJar {
  get(name: string): { value: string } | undefined;
}

export const inviteCookie = (credential: string) =>
  `${INVITE_COOKIE}=${credential}; ${cookieAttributes(INVITE_COOKIE_MS)}`;

/** The invite a credential opens, or null: unknown, wrong secret, or a request not approved. */
export async function inviteFrom(db: Db, value: string | undefined): Promise<InviteRow | null> {
  const m = CREDENTIAL.exec(value ?? "");
  if (!m) return null;
  const [, kind, id, raw = ""] = m;
  if (kind === "i") {
    const row = await findInvite(db, Number(id));
    return row && secretEquals(sha256(raw), row.tokenHash) ? row : null;
  }
  const request = await findRequest(db, Number(id));
  if (!request?.inviteId || request.decision !== "approved") return null;
  if (!secretEquals(sha256(raw), request.statusHash)) return null;
  return findInvite(db, request.inviteId);
}

/**
 * GET /api/w/invite/<id>.<secret>: the cookie to set, or a refusal. A wrong link counts under the IP like a
 * bad sign-in state (D73: 5 per 15 minutes), so the secret cannot be guessed.
 */
export async function openInviteLink(
  db: Db,
  token: string,
  ip: string,
  now: Date,
): Promise<{ ok: true; cookie: string } | { ok: false; code: "rate_limited" | "bad_link" }> {
  const ipKey = `w:ip:${ip}`;
  if ((await currentCount(db, ipKey, IP_WINDOW_MS, now)) >= IP_LIMIT) {
    return { ok: false, code: "rate_limited" };
  }
  const credential = `i.${token}`;
  if (!(await inviteFrom(db, credential))) {
    const count = await recordFailure(db, ipKey, IP_WINDOW_MS, now);
    privateLog("w.invite.bad_link", { count });
    return { ok: false, code: "bad_link" };
  }
  return { ok: true, cookie: inviteCookie(credential) };
}

export type Closed = "used" | "cancelled" | "expired";

/** Why the link no longer works, or null while it does. */
export function closedWhy(row: InviteRow, now: Date): Closed | null {
  if (row.usedAt) return "used";
  if (row.cancelledAt) return "cancelled";
  return row.expiresAt.getTime() <= now.getTime() ? "expired" : null;
}

/** This browser signed in through the link: its claim cookie matches the stored one. */
export function claimed(row: InviteRow, jar: CookieJar): boolean {
  const claim = jar.get(CLAIM_COOKIE)?.value;
  return Boolean(row.claimHash && claim && secretEquals(sha256(claim), row.claimHash));
}

/** The alliance's tag and name, from our tracked alliances (never OGs' unless it is OGs). */
export function allianceOf(unionId: number): { tag: string; name: string } {
  const a = ALLIANCES.find((x) => x.unionId === unionId);
  return a ? { tag: a.tag, name: a.name } : { tag: String(unionId), name: "" };
}

export type InviteView =
  | { state: "none" }
  | { state: "closed"; why: Closed; slug: string | null }
  | {
      state: "open";
      alliance: { tag: string; name: string };
      expiresAt: Date;
      /** Null until this browser signs in through the link. */
      signedIn: {
        name: string;
        guilds: { id: string; name: string; taken: boolean }[];
        guildId: string | null;
      } | null;
      installUrl: string | null;
      rolesInstallUrl: string | null;
      /** The bot token is set, so roles can be read. */
      ready: boolean;
    };

type ViewEnv = Pick<
  Env,
  "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN"
>;

/** What /w/invite shows. Servers already used by a workspace are marked taken (D126). */
export async function inviteView(
  db: Db,
  jar: CookieJar,
  env: ViewEnv,
  now: Date,
): Promise<InviteView> {
  const row = await inviteFrom(db, jar.get(INVITE_COOKIE)?.value);
  if (!row) return { state: "none" };
  const why = closedWhy(row, now);
  const mine = claimed(row, jar);
  if (why) return { state: "closed", why, slug: why === "used" && mine ? row.createdSlug : null };
  const taken = new Set((await takenWorkspaceKeys(db)).map((w) => w.guild));
  const guildId = row.guildId;
  return {
    state: "open",
    alliance: allianceOf(row.unionId),
    expiresAt: row.expiresAt,
    signedIn:
      mine && row.claimedName !== null
        ? {
            name: row.claimedName,
            guilds: (row.guilds ?? []).map((g) => ({ ...g, taken: taken.has(g.id) })),
            guildId,
          }
        : null,
    installUrl: guildId ? installUrl(env, guildId) : null,
    rolesInstallUrl: guildId ? installUrl(env, guildId, ROLES_PERMISSIONS) : null,
    ready: Boolean(env.DISCORD_BOT_TOKEN),
  };
}
