// Raid prep → This week's raid opponent (issue 861, D165): officers set one alliance of any server (its
// server number and tag) for the raid of the Raid prep page; one tracker read by tag on the alliance's own
// key (D124) checks it exists. Changed or cleared with Undo, which needs no call. Officers also move the
// Start and End reads in 15-minute ticks. The result card shows both sides' Start→End and the past raids
// against each opponent. Desk only, own alliance, behind Raid prep's switch (`shield_check`, D126); never
// public. Logs carry counts only.
import { z } from "zod";

import { addDays, hhmm, isDay, weekdayIndex } from "../calendar-time";
import type { Db } from "../db";
import { opponentTag } from "../kvk";
import {
  RAID_LATEST,
  RAID_RANGE,
  raidReadsAt,
  raidSide,
  raidTimeChoices,
  raidTimesOf,
  raidTimesRefusal,
  type RaidSide,
  type RaidTimes,
} from "../raid-opponent";
import { recordFailure } from "../repo/auth-attempts";
import {
  clearOpponent,
  currentOpponent,
  pastOpponents,
  readsOf,
  restoreOpponent,
  saveRaidTimes,
  setOpponent,
} from "../repo/raid-opponents";
import { shieldSettingsOf } from "../repo/shield-checks";
import { keyFacts, markKey } from "../repo/workspace-keys";
import { serverInstant, type ScheduleConfig } from "../schedule";
import { snapToTick, TICK_MIN, timesOf, type ShieldTimes } from "../shield-check";
import { NotFoundError, UpstreamError, type V1Source } from "../sources/types";
import type { SquadsConfig } from "../squads";
import { isSiteKey, keyStatusOf, ownKeyOf, squadsKey } from "../workspace-keys";
import type { WorkspaceAccess } from "./access";
import { WORKSPACE_LANGUAGES } from "./dictionary";
import { featureOn } from "./features";
import { privateLog } from "./log";
import { siteReserveKept } from "./recruit-check";

/** At most this many opponent checks (one tracker call each) per 15 minutes per workspace. */
const CHECKS = 10;
/** At most this many other saves per 15 minutes per workspace. */
const SAVES = 30;
const WINDOW_MS = 15 * 60_000;
/** Past raids shown under the card. */
const HISTORY = 12;
const TICK_MS = TICK_MIN * 60_000;

const saturday = z.string().refine((d) => isDay(d) && weekdayIndex(d) === 5);
const minute = z.number().int().min(0).max(1439).transform(snapToTick);

export const raidOpponentInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("set"),
      saturday,
      server: z.number().int().min(1).max(9999),
      tag: opponentTag,
    })
    .strict(),
  z.object({ action: z.literal("clear"), saturday }).strict(),
  z.object({ action: z.literal("undo"), saturday, id: z.number().int().positive() }).strict(),
  z
    .object({
      action: z.literal("times"),
      startMinute: minute,
      endMinute: minute,
      // The officer's language: a first save's Raid Shield summary language (the card's default).
      language: z.enum(WORKSPACE_LANGUAGES),
    })
    .strict(),
]);
export type RaidOpponentInput = z.infer<typeof raidOpponentInput>;

export interface RaidOpponentDeps {
  v1: Pick<V1Source, "fetchAllianceByTag">;
  secret: string | undefined;
  now: Date;
  env: SquadsConfig;
}

export type RaidOpponentCode =
  | "turned_off"
  | "rate_limited"
  | "raid_over"
  | "no_key"
  | "quota_low"
  | "not_found"
  | "not_unique"
  | "wrong_server"
  | "own_alliance"
  | "unavailable"
  | "gone"
  | "out_of_range"
  | "event_window"
  | "reads_overlap";

export type RaidOpponentResult =
  { ok: true; undo: number | null } | { ok: false; code: RaidOpponentCode };

/** One read of the card: when it runs, and whether its tick is still to come. */
export interface RaidReadState {
  at: number;
  due: boolean;
}

export interface RaidRaid {
  saturday: string;
  us: RaidSide;
  them: RaidSide;
}

export interface RaidOpponentView {
  saturday: string;
  opponent: { id: number; server: number; tag: string; name: string | null } | null;
  times: RaidTimes;
  choices: { start: number[]; end: number[] };
  reads: { start: RaidReadState; end: RaidReadState };
  /** Both sides' Start→End of this raid; null with no opponent. */
  result: { us: RaidSide; them: RaidSide } | null;
  /** The past raids, by opponent (newest raid first), each with both sides. */
  history: { server: number; tag: string; name: string | null; raids: RaidRaid[] }[];
}

/** The raid of `saturday`'s card, or null while Raid prep's switch is off. */
export async function raidOpponentView(
  db: Db,
  access: WorkspaceAccess,
  day: string,
  cfg: ScheduleConfig,
  now: Date,
): Promise<RaidOpponentView | null> {
  if (!featureOn(access, "shield_check")) return null;
  const [opponent, settings, past] = await Promise.all([
    currentOpponent(db, access.workspaceId, day),
    shieldSettingsOf(db, access.workspaceId),
    pastOpponents(db, access.workspaceId, day, HISTORY),
  ]);
  const reads = await readsOf(db, access.workspaceId, [day, ...past.map((p) => p.saturday)]);
  const of = (saturday: string) => reads.filter((r) => r.saturday === saturday);
  const raidOf = (saturday: string, them: number): RaidRaid => ({
    saturday,
    us: raidSide(of(saturday), "us", access.unionId),
    them: raidSide(of(saturday), "them", them),
  });
  const history = new Map<number, RaidOpponentView["history"][number]>();
  for (const p of past) {
    const group = history.get(p.unionId) ?? {
      server: p.server,
      tag: p.tag,
      name: p.name,
      raids: [],
    };
    group.raids.push(raidOf(p.saturday, p.unionId));
    history.set(p.unionId, group);
  }
  const times = raidTimesOf(settings);
  const at = raidReadsAt(day, cfg, times);
  // A read with no tick clear of the events this week is not made: shown at its time, then missing.
  const chosen = {
    start: serverInstant(day, hhmm(times.start), cfg),
    end: serverInstant(addDays(day, 1), hhmm(times.end), cfg),
  };
  const state = (phase: "start" | "end") => {
    const instant = at[phase] ?? chosen[phase];
    return { at: instant.getTime(), due: now.getTime() < instant.getTime() + TICK_MS };
  };
  const result = opponent && raidOf(day, opponent.unionId);
  return {
    saturday: day,
    opponent: opponent && {
      id: opponent.id,
      server: opponent.server,
      tag: opponent.tag,
      name: opponent.name,
    },
    times,
    choices: raidTimeChoices(cfg, now),
    reads: { start: state("start"), end: state("end") },
    result: result && { us: result.us, them: result.them },
    history: [...history.values()],
  };
}

/**
 * The key the check reads on (D124, `squadsKey`'s rule): the own alliance's LAP_API_KEY while it has no saved
 * key, else the workspace's own saved key; never LAP_API_KEY for another workspace (INVARIANT
 * keys.own-quota-only). On LAP_API_KEY (or a saved key that is LAP_API_KEY, issue 855), only above the site
 * key's reserve.
 */
async function checkKey(
  db: Db,
  deps: RaidOpponentDeps,
  access: WorkspaceAccess,
): Promise<
  { apiKey: string | null; mark: { workspaceId: number; nonce: string } | null } | RaidOpponentCode
> {
  const stored = await keyFacts(db, access.workspaceId);
  const rule = squadsKey({ ...stored, unionId: access.unionId }, deps.secret, deps.now);
  if (rule === null) return "no_key";
  const key = rule === "own" ? await ownKeyOf(db, deps.secret, access.workspaceId, deps.now) : null;
  if (rule === "own" && !key) return "no_key";
  const site = !key || isSiteKey(key.apiKey);
  if (site && !(await siteReserveKept(db, deps, access.unionId))) return "quota_low";
  return { apiKey: key?.apiKey ?? null, mark: key && !site ? key : null };
}

/** The one read by tag that checks the opponent, sent once with no retry; the alliance or a refusal. */
async function checkOpponent(
  db: Db,
  deps: RaidOpponentDeps,
  access: WorkspaceAccess,
  input: { server: number; tag: string },
) {
  const key = await checkKey(db, deps, access);
  if (typeof key === "string") return key;
  try {
    const a = await deps.v1.fetchAllianceByTag(input.server, input.tag, undefined, undefined, {
      ...(key.apiKey !== null && { apiKey: key.apiKey }),
      maxRetries: 0,
    });
    if (key.mark && a.quota) {
      const { workspaceId, nonce } = key.mark;
      await markKey(db, workspaceId, nonce, { quotaRemaining: a.quota.remaining }, deps.now);
    }
    return answerRefusal(a, input.server, access.unionId) ?? a;
  } catch (e) {
    if (key.mark) await markFailure(db, key.mark, e, deps.now);
    if (e instanceof NotFoundError) return "not_found";
    if (e instanceof UpstreamError && e.status === 409) return "not_unique";
    return "unavailable";
  }
}

/** Why the tracker's answer is not the opponent: another server's alliance, or our own. */
function answerRefusal(
  a: { sid?: number | null; unionId: number },
  server: number,
  ownUnionId: number,
): RaidOpponentCode | null {
  if (a.sid != null && a.sid !== server) return "wrong_server";
  return a.unionId === ownUnionId ? "own_alliance" : null;
}

/** A 401 or 429 on a workspace key marks it, as the squads read does. */
async function markFailure(
  db: Db,
  key: { workspaceId: number; nonce: string },
  e: unknown,
  now: Date,
) {
  const status = keyStatusOf(e);
  if (!status) return;
  const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
  await markKey(db, key.workspaceId, key.nonce, patch, now);
}

/** The reads' times: in range, and clear of the Raid Shield reads and the events (D137, D160). */
async function saveTimes(
  db: Db,
  deps: RaidOpponentDeps,
  access: WorkspaceAccess,
  input: { startMinute: number; endMinute: number; language: string; shield: ShieldTimes },
): Promise<RaidOpponentResult> {
  const raid = { start: input.startMinute, end: input.endMinute };
  if (!RAID_RANGE.includes(raid.start) || !RAID_RANGE.includes(raid.end))
    return { ok: false, code: "out_of_range" };
  const refused = raidTimesRefusal(raid, input.shield, deps.env, deps.now);
  if (refused) return { ok: false, code: refused };
  await saveRaidTimes(db, {
    workspaceId: access.workspaceId,
    raidStartMinute: raid.start,
    raidEndMinute: raid.end,
    language: input.language,
    updatedBy: access.user.id,
    updatedAt: deps.now,
  });
  return { ok: true, undo: null };
}

/** Whether the raid of `saturday` is over: its End read's tick (this week's, D160) has passed. */
function raidOver(saturday: string, end: number, deps: RaidOpponentDeps) {
  const latest = serverInstant(addDays(saturday, 1), hhmm(RAID_LATEST), deps.env);
  const at = raidReadsAt(saturday, deps.env, { start: 0, end }).end ?? latest;
  return deps.now.getTime() >= at.getTime() + TICK_MS;
}

/** Set, clear, Undo, or the reads' times. Officers only (the route); the workspace from the session. */
export async function saveRaidOpponent(
  db: Db,
  deps: RaidOpponentDeps,
  access: WorkspaceAccess,
  input: RaidOpponentInput,
): Promise<RaidOpponentResult> {
  if (!featureOn(access, "shield_check")) return { ok: false, code: "turned_off" };
  const { now } = deps;
  const ws = access.workspaceId;
  const limit = input.action === "set" ? CHECKS : SAVES;
  const tries = await recordFailure(db, `raid-${input.action}:ws:${ws}`, WINDOW_MS, now);
  if (tries > limit) return { ok: false, code: "rate_limited" };
  const settings = await shieldSettingsOf(db, ws);
  if (input.action === "times")
    return saveTimes(db, deps, access, { ...input, shield: timesOf(settings) });
  // A raid whose End read's tick is over takes no opponent: nothing would read it.
  if (raidOver(input.saturday, raidTimesOf(settings).end, deps))
    return { ok: false, code: "raid_over" };
  if (input.action === "clear") {
    const undo = await clearOpponent(db, ws, input.saturday, now);
    privateLog("raid_opponent.cleared", { workspace: ws });
    return { ok: true, undo };
  }
  if (input.action === "undo") {
    const back = await restoreOpponent(db, { workspaceId: ws, ...input }, now);
    return back ? { ok: true, undo: null } : { ok: false, code: "gone" };
  }
  const found = await checkOpponent(db, deps, access, input);
  if (typeof found === "string") {
    privateLog("raid_opponent.refused", { workspace: ws });
    return { ok: false, code: found };
  }
  const undo = await setOpponent(db, {
    workspaceId: ws,
    saturday: input.saturday,
    server: input.server,
    unionId: found.unionId,
    tag: found.tag,
    name: found.name,
    setBy: access.user.id,
    setAt: now,
  });
  privateLog("raid_opponent.set", { workspace: ws });
  return { ok: true, undo };
}
