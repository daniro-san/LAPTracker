// Pure functions only: sums, deltas, freshness predicate, roster diff. No IO, no Date.now() (passed in).

/** Roster kills. A member with `kills: null` counts as 0 (DECISIONS D15). */
export function sumKills(members: readonly { kills: number | null }[]): number {
  return members.reduce((total, m) => total + (m.kills ?? 0), 0);
}

/** Roster power, nulls as 0 (DECISIONS D15). The /v1 `power` field equals this in every fixture. */
export function sumPower(members: readonly { power: number | null }[]): number {
  return members.reduce((total, m) => total + (m.power ?? 0), 0);
}

/** INVARIANT freshness.20-min (§3.7): fresh when `now − updatedAt ≤ maxAgeMs`; unknown is stale. */
export function isFresh(now: Date, updatedAt: Date | null, maxAgeMs: number): boolean {
  return updatedAt !== null && now.getTime() - updatedAt.getTime() <= maxAgeMs;
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
}

export interface NameHistoryEntry {
  tag: string;
  name: string;
  firstSeen: Date;
  lastSeen: Date;
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

/** One event's reference value (Phase 5e): alliance rows use `lv` = level; players carry `unionId`. */
export interface SeriesRow {
  isFresh: boolean;
  power: number | null;
  kills: number | null;
  lv: number | null;
  name: string | null;
  tag: string | null;
  unionId: number | null;
}

export interface SeriesStep {
  power: number | null;
  kills: number | null;
  lv: number | null;
  changed: { name: boolean; tag: boolean; alliance: boolean; lv: boolean };
}

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

/**
 * Deltas vs the previous event for rows ordered oldest first; the first step has none.
 * INVARIANT freshness.no-stale-delta: a stale row yields no delta on either side.
 */
export function seriesDeltas(rows: readonly SeriesRow[]): SeriesStep[] {
  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1] : undefined;
    const both = prev !== undefined && prev.isFresh && row.isFresh;
    return {
      power: both ? diff(prev.power, row.power) : null,
      kills: both ? diff(prev.kills, row.kills) : null,
      lv: both ? diff(prev.lv, row.lv) : null,
      changed: {
        name: prev !== undefined && prev.name !== row.name,
        tag: prev !== undefined && prev.tag !== row.tag,
        alliance: prev !== undefined && prev.unionId !== row.unionId,
        lv: prev !== undefined && prev.lv !== row.lv,
      },
    };
  });
}
