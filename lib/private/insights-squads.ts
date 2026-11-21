// The Insights page's squads coverage (issue 489, section 5), pure: for the members of the newest daily read,
// how many squads the tracker has seen for each, how fresh each member's newest sighting is, and the might
// of each member's strongest squad in four equal groups. Counts only: no names, no heroes, no lineup (owner,
// 2026-11-20). 3 squads is normal and nothing is compared against 4 (#461), so "3 or more" is one row.
import type { SquadSighting } from "../repo/squads";
import { median, type Median } from "./insights-rules";

/** The "squads seen" rows: 1, 2, and 3 or more. */
export const SQUAD_COUNTS = [1, 2, 3] as const;
/** Freshness bands of a member's newest sighting, in hours: under 24, 24 to 72, older. */
export const FRESH_HOURS = [24, 72] as const;

export interface SquadsCoverage {
  members: number;
  /** Members with 1, 2, and 3 or more squads seen; `none`: no squad seen yet. */
  counts: number[];
  none: number;
  /** Members by their newest sighting: under 24 h, 1–3 days, older; `noTime`: the tracker sent no time. */
  fresh: number[];
  noTime: number;
  /** Each member's strongest squad's might, in four equal groups, the highest first. */
  bands: { low: number; high: number; n: number; median: number }[];
}

/**
 * Four equal groups by strongest squad's might, the highest first, as section 2 groups might (D139): its
 * range, its size and its middle value. One squad far above the rest stretches no scale. Fewer than 4
 * members make no groups.
 */
function bandsOf(values: readonly number[]): SquadsCoverage["bands"] {
  if (values.length < 4) return [];
  const s = [...values].sort((a, b) => a - b);
  const groups = [0, 1, 2, 3].map((i) =>
    s.slice(Math.floor((i * s.length) / 4), Math.floor(((i + 1) * s.length) / 4)),
  );
  return groups.reverse().map((g) => ({
    low: g[0] as number,
    high: g.at(-1) as number,
    n: g.length,
    median: (median(g) as Median).value,
  }));
}

/** Coverage of `uids` (the newest read's members) from each pair's newest sighting, as of `now`. */
export function squadsCoverageOf(
  uids: readonly number[],
  sightings: readonly SquadSighting[],
  now: Date,
): SquadsCoverage {
  const ours = new Set(uids);
  const byUid = new Map<number, SquadSighting[]>();
  for (const s of sightings)
    if (ours.has(s.uid)) byUid.set(s.uid, [...(byUid.get(s.uid) ?? []), s]);
  const counts = SQUAD_COUNTS.map(() => 0);
  const fresh = [0, 0, 0];
  let noTime = 0;
  const strongest: number[] = [];
  for (const list of byUid.values()) {
    const i = Math.min(list.length, SQUAD_COUNTS.length) - 1;
    counts[i] = (counts[i] ?? 0) + 1;
    strongest.push(Math.max(...list.map((s) => s.power)));
    const seen = list.flatMap((s) => (s.seenAt ? [s.seenAt.getTime()] : []));
    if (seen.length === 0) {
      noTime += 1;
      continue;
    }
    const hours = (now.getTime() - Math.max(...seen)) / 3_600_000;
    const band = FRESH_HOURS.findIndex((h) => hours < h);
    const at = band < 0 ? FRESH_HOURS.length : band;
    fresh[at] = (fresh[at] ?? 0) + 1;
  }
  return {
    members: ours.size,
    counts,
    none: ours.size - byUid.size,
    fresh,
    noTime,
    bands: bandsOf(strongest),
  };
}
