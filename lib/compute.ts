// Pure functions only: sums, deltas, freshness predicate, roster diff. No IO, no Date.now() (passed in).

/**
 * The run lock (D43): a snapshot still `running` this long after it started was killed, and may be
 * taken over. maxDuration is 120 s on both routes that run the collector, plus margin. The collector,
 * the rehearsal guard, the upstream banner (D27 rule 1) and /admin's live list all read this one.
 */
export const RUN_STALE_AFTER_MS = 150_000;

/** A run left `running` past RUN_STALE_AFTER_MS was killed: it never finishes, so it is not "updating now". */
export const runAbandoned = (run: { status: string; startedAt: Date }, now: Date): boolean =>
  run.status === "running" && now.getTime() - run.startedAt.getTime() >= RUN_STALE_AFTER_MS;

/** Measured from the start of the run; the route's maxDuration is 120 s (docs/decisions/D25). */
export const RUN_DEADLINE_MS = 100_000;

/** Roster kills. A member with `kills: null` counts as 0 (docs/decisions/D15). */
export function sumKills(members: readonly { kills: number | null }[]): number {
  return members.reduce((total, m) => total + (m.kills ?? 0), 0);
}

/** Roster power, nulls as 0 (docs/decisions/D15). The /v1 `power` field equals this in every fixture. */
export function sumPower(members: readonly { power: number | null }[]): number {
  return members.reduce((total, m) => total + (m.power ?? 0), 0);
}

/** The tracked set from a ranks board (D133): the `n` ids with the most might, a tie to the lower id. */
export function topByPower(power: ReadonlyMap<number, number>, n: number): number[] {
  return [...power.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, n)
    .map(([id]) => id);
}

/** INVARIANT freshness.20-min (§3.7): fresh when `now − updatedAt ≤ maxAgeMs`; unknown is stale. */
export function isFresh(now: Date, updatedAt: Date | null, maxAgeMs: number): boolean {
  return updatedAt !== null && now.getTime() - updatedAt.getTime() <= maxAgeMs;
}

/**
 * One player's roster row in one snapshot (issue 234). A stale read of an old alliance can still list
 * a player the fresh roster of a new alliance holds too: the row of a usable alliance read (fresh, not
 * failed) wins, else the newest. `newestFirst` holds that player's rows of one snapshot, newest first.
 */
export function pickRosterRow<T>(
  newestFirst: readonly T[],
  usable: (row: T) => boolean,
): T | undefined {
  return newestFirst.find(usable) ?? newestFirst[0];
}

/**
 * pickRosterRow for each player (uid) and snapshot (event and phase) in `rows`, in first-seen order.
 * Rows of one player and snapshot must come newest first.
 */
export function pickRosterRows<T extends { uid: number; eventId: number; phase: string }>(
  rows: readonly T[],
  usable: (row: T) => boolean,
): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.uid}:${row.eventId}:${row.phase}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((own) => pickRosterRow(own, usable) as T);
}

export interface Measured {
  isFresh: boolean;
  totalPower: number | null;
  totalKills: number | null;
}

/**
 * after − before for one alliance, roster vs roster.
 * INVARIANT freshness.no-stale-delta: null when either side is stale or has no data.
 */
export function delta(before: Measured, after: Measured): { power: number; kills: number } | null {
  if (!before.isFresh || !after.isFresh) return null;
  if (before.totalPower === null || after.totalPower === null) return null;
  if (before.totalKills === null || after.totalKills === null) return null;
  return {
    power: after.totalPower - before.totalPower,
    kills: after.totalKills - before.totalKills,
  };
}

interface Member {
  uid: number;
  name: string;
}

/** Members matched by uid, never by name (§3.8). */
export function rosterDiff<M extends Member>(before: readonly M[], after: readonly M[]) {
  const was = new Map(before.map((m) => [m.uid, m]));
  const now = new Set(after.map((m) => m.uid));
  const stayed = after.flatMap((a) => {
    const b = was.get(a.uid);
    return b ? [{ before: b, after: a }] : [];
  });
  return {
    joined: after.filter((m) => !was.has(m.uid)),
    left: before.filter((m) => !now.has(m.uid)),
    stayed,
    renamed: stayed.filter((s) => s.before.name !== s.after.name),
  };
}

export interface NameSighting {
  tag: string;
  name: string;
  at: Date;
  /** Its order inside one event, where Before comes before After although both carry the event's time; `at` when absent. */
  seenAt?: Date;
}

export interface NameHistoryEntry {
  tag: string;
  name: string;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * The sightings without the source's misreads. A misread is a (tag, name) seen in one snapshot only, while
 * another name of the same alliance was seen both earlier and at the same time or later: a glitch, not a
 * rename. For example, YAHO was read once as "PKM / POKEMON" on 2026-11-07 and as YAHO before and after.
 * A rename seen once, in the newest snapshot, stays.
 */
export function withoutMisreads(rows: readonly NameSighting[]): NameSighting[] {
  const key = (r: NameSighting) => JSON.stringify([r.tag, r.name]);
  const time = (r: NameSighting) => (r.seenAt ?? r.at).getTime();
  const count = new Map<string, number>();
  for (const r of rows) count.set(key(r), (count.get(key(r)) ?? 0) + 1);
  const misread = (r: NameSighting) => {
    if (count.get(key(r)) !== 1) return false;
    const t = time(r);
    return rows.some(
      (o) =>
        key(o) !== key(r) && time(o) < t && rows.some((p) => key(p) === key(o) && time(p) >= t),
    );
  };
  return rows.filter((r) => !misread(r));
}

/** Distinct (tag, name) pairs in order of first appearance, each with first and last sighting (§3.8). */
export function nameHistory(rows: readonly NameSighting[]): NameHistoryEntry[] {
  const sorted = [...rows].sort((a, b) => a.at.getTime() - b.at.getTime());
  const byPair = new Map<string, NameHistoryEntry>();
  for (const r of sorted) {
    const key = JSON.stringify([r.tag, r.name]);
    const entry = byPair.get(key);
    if (entry) entry.lastSeen = r.at;
    else byPair.set(key, { tag: r.tag, name: r.name, firstSeen: r.at, lastSeen: r.at });
  }
  return [...byPair.values()];
}

/** One event's reference value (Phase 5e): `lv` is the player's level (alliance rows pass null, #181);
 * `members` the alliance's member count (player rows pass null); players carry `unionId`. */
export interface SeriesRow {
  isFresh: boolean;
  power: number | null;
  kills: number | null;
  lv: number | null;
  members: number | null;
  name: string | null;
  tag: string | null;
  unionId: number | null;
}

export interface SeriesStep {
  power: number | null;
  kills: number | null;
  lv: number | null;
  members: number | null;
  changed: { name: boolean; tag: boolean; alliance: boolean; lv: boolean };
}

/**
 * Whether two rows may be compared: both exist, are fresh and did not fail.
 * INVARIANT freshness.no-stale-delta: every delta, rank move and roster diff between two rows asks this.
 */
export const comparable = (
  a: { isFresh: boolean; failed?: boolean } | null | undefined,
  b: { isFresh: boolean; failed?: boolean } | null | undefined,
): boolean =>
  a != null && b != null && a.isFresh && b.isFresh && a.failed !== true && b.failed !== true;

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

/**
 * Deltas vs the previous event for rows ordered oldest first; the first step has none.
 * INVARIANT freshness.no-stale-delta: a stale row yields no delta on either side.
 */
export function seriesDeltas(rows: readonly SeriesRow[]): SeriesStep[] {
  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1] : undefined;
    const both = prev !== undefined && comparable(prev, row);
    return {
      power: both ? diff(prev.power, row.power) : null,
      kills: both ? diff(prev.kills, row.kills) : null,
      lv: both ? diff(prev.lv, row.lv) : null,
      members: both ? diff(prev.members, row.members) : null,
      changed: {
        name: prev !== undefined && prev.name !== row.name,
        tag: prev !== undefined && prev.tag !== row.tag,
        alliance: prev !== undefined && prev.unionId !== row.unionId,
        lv: prev !== undefined && prev.lv !== row.lv,
      },
    };
  });
}

/**
 * Ledger rank (Phase 5e): position by value, highest first, as competition ranking (1, 2, 2, 4).
 * Entries without a value get no rank.
 */
export function rankBy<K>(entries: readonly (readonly [K, number | null])[]): Map<K, number> {
  const valued = entries.filter((e): e is readonly [K, number] => e[1] !== null);
  return new Map(
    valued.map(([key, value]) => [key, 1 + valued.filter(([, v]) => v > value).length]),
  );
}

/**
 * Places moved from `prev` to `curr`: positive means up (#3 → #1 is +2). Null when either rank is
 * unknown, so the UI shows `—`, never a rise from nothing.
 */
export function rankDelta(
  prev: number | null | undefined,
  curr: number | null | undefined,
): number | null {
  return prev == null || curr == null ? null : prev - curr;
}

/**
 * How much more one event's change was than another's: `second − first` (the event compare page's
 * difference line, D57), and `ratio`, the second change as a multiple of the first, when both went the
 * same way and it is between 0.1× and 10× (issue 473: a percent of a change, "−314.2%", read as nonsense). Null when either change is
 * unknown (INVARIANT freshness.no-stale-delta: a stale or failed side has none).
 */
export function changeDifference(
  first: number | null | undefined,
  second: number | null | undefined,
): { delta: number; ratio: number | null } | null {
  if (first == null || second == null) return null;
  const sameWay = (first > 0 && second > 0) || (first < 0 && second < 0);
  const ratio = second / first;
  // Outside 0.1–10× a multiple says nothing a reader can use ("750,000×" from a first change of +2).
  return { delta: second - first, ratio: sameWay && ratio >= 0.1 && ratio <= 10 ? ratio : null };
}

/** How many of an alliance's biggest kills gains the concentration figure adds up (#271). */
export const TURNOUT_TOP = 5;

/** The top-5 share is ranked only for alliances with this many gainers; with fewer it is near 100 % by arithmetic. */
export const TURNOUT_MIN_GAINERS = 10;

export interface KillsTurnout {
  /** Members in both rosters, matched by uid. */
  n: number;
  /** Of those, the members whose kills rose. */
  gainers: number;
  /** The kills those members gained, together. */
  gained: number;
  /** The kills the `TURNOUT_TOP` biggest gains made up. */
  top: number;
}

/**
 * Who gained kills in one alliance between two rosters (#271). Only members in both count; a member in
 * one roster is a join or a leave. A kills of null counts as 0 (D15). A fall in kills is not a gain.
 * The caller decides that both rosters are usable (INVARIANT freshness.no-stale-delta).
 */
export function killsTurnout(
  before: readonly { uid: number; kills: number | null }[],
  after: readonly { uid: number; kills: number | null }[],
): KillsTurnout {
  const was = new Map(before.map((m) => [m.uid, m.kills ?? 0]));
  const stayed = after.flatMap((m) => {
    const b = was.get(m.uid);
    return b === undefined ? [] : [(m.kills ?? 0) - b];
  });
  const gains = stayed.filter((g) => g > 0).sort((x, y) => y - x);
  const sum = (xs: readonly number[]) => xs.reduce((t, g) => t + g, 0);
  return {
    n: stayed.length,
    gainers: gains.length,
    gained: sum(gains),
    top: sum(gains.slice(0, TURNOUT_TOP)),
  };
}

/** Events an alliance needs before its ratio is shown: one event's ratio is noise (D83). */
export const CARRIED_MIN_EVENTS = 3;

export interface CarriedInput {
  key: number;
  /** Alliance might at Start. */
  might: number | null;
  /** The kills gained by its members in both the Start and End rosters (D69 amendment, 2026-11-21): a member
   * who joined brings no lifetime kills into the share. */
  gained: number | null;
}

export interface CarriedShare {
  key: number;
  /** The alliance's part of the might of all the alliances counted, 0 to 1. */
  mightShare: number;
  /** The alliance's part of the kills gained by all the alliances counted, 0 to 1. */
  killShare: number;
  /** Kill share over might share; null when the might share is 0. */
  ratio: number | null;
}

/**
 * Each alliance's share of the kills gained (D83) next to its share of the might at Start (#280). Only
 * alliances with both figures count, so the shares are of the same set; the caller decides that the
 * rosters are usable (INVARIANT freshness.no-stale-delta). A fall is not a gain. Empty when the set has no
 * might or no kills gained.
 */
export function carriedShares(rows: readonly CarriedInput[]): CarriedShare[] {
  const counted = rows.flatMap((r) =>
    r.might === null || r.gained === null
      ? []
      : [{ key: r.key, might: r.might, gained: Math.max(0, r.gained) }],
  );
  const might = counted.reduce((t, r) => t + r.might, 0);
  const gained = counted.reduce((t, r) => t + r.gained, 0);
  if (might === 0 || gained === 0) return [];
  return counted.map((r) => {
    const mightShare = r.might / might;
    const killShare = r.gained / gained;
    return {
      key: r.key,
      mightShare,
      killShare,
      ratio: mightShare === 0 ? null : killShare / mightShare,
    };
  });
}

/** The lowest and highest of an alliance's ratios over its events; null under `CARRIED_MIN_EVENTS`. */
export function ratioSpread(
  ratios: readonly number[],
): { n: number; low: number; high: number } | null {
  return ratios.length < CARRIED_MIN_EVENTS
    ? null
    : { n: ratios.length, low: Math.min(...ratios), high: Math.max(...ratios) };
}

export type MoverMetric = "power" | "kills";
export type MoverDirection = "gain" | "loss";

/** One alliance or member across an event's two snapshots; a side is null when it was not read. */
export interface MoverInput {
  before: Measured | null;
  after: Measured | null;
}

export interface Mover<R> {
  row: R;
  /** Competition rank among every row that moved this way (1, 2, 2, 4). */
  rank: number;
  /** after − before: positive for a gain, negative for a loss. */
  delta: number;
  /** The before value, for the percent; null or 0 means no percent. */
  base: number | null;
}

/**
 * The `n` biggest gains or losses of one metric in an event (#70). A row with a missing, stale or
 * failed side has no delta (INVARIANT freshness.no-stale-delta) and is not ranked; neither is a change
 * of zero or of the other sign. Equal changes keep the input order and share a rank.
 */
export function topMovers<R extends MoverInput>(
  rows: readonly R[],
  metric: MoverMetric,
  n: number,
  direction: MoverDirection,
): Mover<R>[] {
  const sign = direction === "gain" ? 1 : -1;
  const moved = rows
    .flatMap((row) => {
      if (!row.before || !row.after) return [];
      const d = delta(row.before, row.after)?.[metric];
      if (d === undefined || d * sign <= 0) return [];
      const base = metric === "power" ? row.before.totalPower : row.before.totalKills;
      return [{ row, delta: d, base }];
    })
    .sort((x, y) => (y.delta - x.delta) * sign);
  return moved.slice(0, n).map((m) => ({
    ...m,
    rank: 1 + moved.filter((o) => (o.delta - m.delta) * sign > 0).length,
  }));
}

/** An alliance's ledger rank by might in the event's two snapshots (D23). */
export interface RankMoverInput extends MoverInput {
  ledger: { before: number | null; after: number | null };
}

/**
 * The `n` alliances that climbed (`gain`) or fell (`loss`) the most places by ledger rank (#70). Order:
 * places moved, then the better current rank. A row with a missing, stale or failed side is not
 * ranked, nor is one that held its place.
 */
export function topRankMovers<R extends RankMoverInput>(
  rows: readonly R[],
  n: number,
  direction: MoverDirection,
): { row: R; move: number }[] {
  const sign = direction === "gain" ? 1 : -1;
  return rows
    .flatMap((row) => {
      if (!row.before?.isFresh || !row.after?.isFresh) return [];
      const move = rankDelta(row.ledger.before, row.ledger.after);
      return move !== null && move * sign > 0 ? [{ row, move }] : [];
    })
    .sort(
      (x, y) =>
        (y.move - x.move) * sign ||
        (x.row.ledger.after ?? Infinity) - (y.row.ledger.after ?? Infinity),
    )
    .slice(0, n);
}
