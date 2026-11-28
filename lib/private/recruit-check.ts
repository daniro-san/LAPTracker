// The desk's recruit check (issue 833): an officer enters a player's name or uid and sees public facts from
// what is already stored, the daily rosters and public events (lib/queries) and this alliance's own player
// reads (D132): alliance moves, renames, might and kills over 30 days, and the events the player was seen in.
// A player not stored yet can be read once from the tracker on the alliance's own key (D124, never
// LAP_API_KEY), at most RECRUIT_READS_A_DAY a UTC quota day, counted in the database; the answer is kept as
// every /v1/players answer is (storePlayerRead, D132), under the workspace's alliance. No score, no ranking,
// no judging words; a value not known is left out (D75). Officers only, behind `recruit_check` (D126);
// nothing is posted, and the log carries counts only.
import type { Db } from "../db";
import { playerProgress } from "../queries/player-progress";
import { searchPlayers } from "../queries/player-search";
import { allianceLabels } from "../repo/alliances";
import { playerTrail, storePlayerRead, trailNames, type TrailPoint } from "../repo/player-reads";
import { countRecruitRead, recruitReadsOn } from "../repo/recruit-reads";
import { keyFacts, markKey } from "../repo/workspace-keys";
import { NotFoundError, type V1Source } from "../sources/types";
import { RECRUIT_READS_A_DAY, usageDay } from "../workspace-features";
import { keyStatusOf, ownKeyOf, squadsKey } from "../workspace-keys";
import type { WorkspaceAccess } from "./access";
import { featureOn } from "./features";
import { privateLog } from "./log";

/** Might and kills are compared over this many days. */
export const RECRUIT_DAYS = 30;
/** At most this many players for a name. */
export const RECRUIT_MATCHES = 10;

/** A uid as typed: digits only. */
export const UID_TEXT = /^\d{1,15}$/;

export interface RecruitAlliance {
  unionId: number;
  tag: string | null;
}

export interface RecruitFacts {
  uid: number;
  /** The newest name seen; null when no stored row names the player. */
  name: string | null;
  alliance: RecruitAlliance | null;
  /** The newest stored sighting. */
  asOf: Date;
  /** Each change of alliance between two sightings, newest first. */
  moves: { at: Date; from: RecruitAlliance; to: RecruitAlliance }[];
  /** Each change of name between two sightings, newest first. */
  renames: { at: Date; from: string; to: string }[];
  /** The first and newest sighting of the last RECRUIT_DAYS with a value; null when none has one. */
  might: { from: Change; to: Change } | null;
  kills: { from: Change; to: Change } | null;
  /** Public events the player was seen in, newest first. */
  events: { id: number; name: string; at: Date; tag: string | null }[];
}

interface Change {
  at: Date;
  value: number;
}

type Point = TrailPoint & { event: { id: number; name: string; at: Date } | null };

const byTime = (a: { at: Date }, b: { at: Date }) => a.at.getTime() - b.at.getTime();

/** The first and the newest point with a value since `since`, or null. */
function span(points: readonly Point[], pick: (p: Point) => number | null, since: Date) {
  const valued = points.flatMap((p) => {
    const value = pick(p);
    return value !== null && p.at >= since ? [{ at: p.at, value }] : [];
  });
  const from = valued[0];
  const to = valued.at(-1);
  return from && to ? { from, to } : null;
}

/** Changes of `key` between consecutive points that both know it, newest first. */
function changes<T>(
  points: readonly Point[],
  key: (p: Point) => T | null,
  same: (a: T, b: T) => boolean,
) {
  const out: { at: Date; from: T; to: T }[] = [];
  let last: T | null = null;
  for (const p of points) {
    const v = key(p);
    if (v === null) continue;
    if (last !== null && !same(last, v)) out.push({ at: p.at, from: last, to: v });
    last = v;
  }
  return out.reverse();
}

/**
 * What the stores hold about `uid`, or null when nothing does: the public daily rosters and events, and the
 * workspace's own player reads. No upstream call.
 */
export async function recruitFacts(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  now: Date,
): Promise<RecruitFacts | null> {
  const [progress, trail] = await Promise.all([
    playerProgress(db, uid),
    playerTrail(db, access.unionId, uid),
  ]);
  const points: Point[] = [
    ...progress.readings.map((r) => ({
      at: r.at,
      unionId: r.unionId,
      tag: r.tag,
      name: r.name || null,
      power: r.power,
      kills: r.kills,
      event: r.event && { id: r.event.id, name: r.event.name, at: r.event.eventAtUtc },
    })),
    // A union id of 0 or none says nothing about the alliance.
    ...trail.map((t) => ({ ...t, unionId: t.unionId || null, event: null })),
  ].sort(byTime);
  const newest = points.at(-1);
  if (!newest) return null;
  // A tag missing from a row comes from the alliance's newest label.
  const ids = [...new Set(points.flatMap((p) => (p.unionId === null ? [] : [p.unionId])))];
  const labels = await allianceLabels(db, ids);
  const tagOf = (p: Point) =>
    p.tag ?? (p.unionId === null ? null : (labels.get(p.unionId)?.tag ?? null));
  const allianceOf = (p: Point): RecruitAlliance | null =>
    p.unionId === null ? null : { unionId: p.unionId, tag: tagOf(p) };
  const since = new Date(now.getTime() - RECRUIT_DAYS * 86_400_000);
  const events = new Map<number, RecruitFacts["events"][number]>();
  for (const p of points) if (p.event) events.set(p.event.id, { ...p.event, tag: tagOf(p) });
  const named = points.findLast((p) => p.name !== null);
  const placed = points.findLast((p) => p.unionId !== null);
  return {
    uid,
    name: named?.name ?? null,
    alliance: placed ? allianceOf(placed) : null,
    asOf: newest.at,
    moves: changes(points, allianceOf, (a, b) => a.unionId === b.unionId),
    renames: changes(
      points,
      (p) => p.name,
      (a, b) => a === b,
    ),
    might: span(points, (p) => p.power, since),
    kills: span(points, (p) => p.kills, since),
    events: [...events.values()].sort((a, b) => b.at.getTime() - a.at.getTime()),
  };
}

/** The players a name finds: public events' names, then this alliance's own reads; at most RECRUIT_MATCHES. */
export async function recruitMatches(
  db: Db,
  access: WorkspaceAccess,
  q: string,
  now: Date,
): Promise<{ uid: number; name: string; tag: string | null }[]> {
  const text = q.trim();
  if (text === "") return [];
  const [found, own] = await Promise.all([
    searchPlayers(db, text),
    trailNames(db, access.unionId, text, RECRUIT_MATCHES, now),
  ]);
  const out = new Map(found.map((m) => [m.uid, { uid: m.uid, name: m.name, tag: m.tag }]));
  for (const m of own) if (!out.has(m.uid)) out.set(m.uid, { ...m, tag: null });
  return [...out.values()].slice(0, RECRUIT_MATCHES);
}

/**
 * Whether a new read can be asked now, and how many are left today: only with the alliance's own saved key
 * that reads now (squadsKey's "own"; the own alliance's site key does not count, D124).
 */
export async function recruitBudget(
  db: Db,
  access: WorkspaceAccess,
  secret: string | undefined,
  now: Date,
): Promise<{ key: boolean; left: number }> {
  const [facts, used] = await Promise.all([
    keyFacts(db, access.workspaceId),
    recruitReadsOn(db, access.workspaceId, usageDay(now)),
  ]);
  const key = squadsKey({ ...facts, unionId: access.unionId }, secret, now) === "own";
  return { key, left: Math.max(RECRUIT_READS_A_DAY - used, 0) };
}

export type RecruitReadResult =
  | { ok: true; called: boolean }
  | {
      ok: false;
      code: "turned_off" | "no_key" | "cap_reached" | "not_found" | "unavailable";
    };

export interface RecruitDeps {
  v1: Pick<V1Source, "fetchPlayer">;
  secret: string | undefined;
  now: Date;
}

/**
 * One new tracker read of a player the stores do not hold yet. A stored player costs no call. The read is
 * counted before it is sent (the 21st of a UTC day is refused, nothing sent), goes out once on the
 * workspace's own key with no retry, and its answer is kept like the squads read's (D132). A 401 or 429
 * marks the key as the squads read does.
 */
export async function readRecruit(
  db: Db,
  deps: RecruitDeps,
  access: WorkspaceAccess,
  uid: number,
): Promise<RecruitReadResult> {
  if (!featureOn(access, "recruit_check")) return { ok: false, code: "turned_off" };
  const { now } = deps;
  if (await recruitFacts(db, access, uid, now)) return { ok: true, called: false };
  const key = await ownKeyOf(db, deps.secret, access.workspaceId, now);
  if (!key) return { ok: false, code: "no_key" };
  const used = await countRecruitRead(db, access.workspaceId, usageDay(now), RECRUIT_READS_A_DAY);
  if (used === null) {
    privateLog("recruit.cap_reached", { workspace: access.workspaceId, cap: RECRUIT_READS_A_DAY });
    return { ok: false, code: "cap_reached" };
  }
  try {
    // INVARIANT keys.own-quota-only: the workspace's own key, never LAP_API_KEY.
    const player = await deps.v1.fetchPlayer(uid, undefined, undefined, {
      apiKey: key.apiKey,
      maxRetries: 0,
    });
    await storePlayerRead(db, access.unionId, player, now);
  } catch (e) {
    const status = keyStatusOf(e);
    if (status) {
      const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
      await markKey(db, key.workspaceId, key.nonce, patch, now);
    }
    privateLog("recruit.read_failed", { workspace: access.workspaceId, used });
    return { ok: false, code: e instanceof NotFoundError ? "not_found" : "unavailable" };
  }
  privateLog("recruit.read", { workspace: access.workspaceId, used });
  return { ok: true, called: true };
}
