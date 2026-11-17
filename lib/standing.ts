// Standing against the server (D90, issue 274): each tracked alliance's rank by might over the last days,
// its might growth and the tracked alliances' total growth beside it. Pure: daily alliance totals in,
// figures out. Only days on which every listed alliance has a usable daily roster enter a rank series
// (a day with fewer would rank a smaller server), as the balance trend does (D85).

/** One usable daily roster's totals; the alliance's name and badge come from its newest row. */
export interface StandingInput {
  day: string;
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  might: number;
}

/** The period looks back this many days from the newest complete day. */
export const STANDING_DAYS = 7;

export interface StandingRow {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** Might on the newest complete day. */
  might: number;
  /** Rank by might on the newest complete day, 1 is the greatest. */
  rank: number;
  /** Rank on each day of the period, oldest first. */
  ranks: number[];
  /** Places gained since the period's first day: positive is up, negative is down. */
  move: number;
  /** Might growth over the period in percent; null when the alliance's might was 0 on the first day. */
  growth: number | null;
}

export interface Standing {
  /** The period's days, oldest first; at least two. */
  days: string[];
  /** Rank 1 first. */
  rows: StandingRow[];
  /** The listed alliances' total might on the newest day. */
  serverMight: number;
  /** The listed alliances' total growth over the period in percent; null when the total was 0 at the start. */
  serverGrowth: number | null;
}

/** Ranks 1..n by might, greatest first; equal might is ordered by union id, so the ranks are always a permutation. */
export function rankByMight(rows: { unionId: number; might: number }[]): Map<number, number> {
  const ordered = [...rows].sort((a, b) => b.might - a.might || a.unionId - b.unionId);
  return new Map(ordered.map((r, i) => [r.unionId, i + 1]));
}

/** A growth in percent: (last − first) / first × 100; null when `first` is 0. */
export const growthPercent = (first: number, last: number): number | null =>
  first > 0 ? ((last - first) / first) * 100 : null;

const DAY_MS = 86_400_000;
const dayTime = (day: string) => Date.parse(`${day}T00:00:00Z`);

/**
 * The standing over the last `STANDING_DAYS` days up to the newest complete day. The listed alliances are
 * those in `rows`; null when fewer than two complete days fall in the period (nothing to compare).
 */
export function standing(rows: StandingInput[]): Standing | null {
  const byDay = new Map<string, Map<number, StandingInput>>();
  const newest = new Map<number, StandingInput>();
  for (const r of rows) {
    byDay.set(r.day, (byDay.get(r.day) ?? new Map()).set(r.unionId, r));
    const seen = newest.get(r.unionId);
    if (!seen || r.day > seen.day) newest.set(r.unionId, r);
  }
  const listed = newest.size;
  const complete = [...byDay.entries()]
    .filter(([, day]) => day.size === listed)
    .map(([day]) => day)
    .sort();
  const last = complete.at(-1);
  if (last === undefined) return null;
  const days = complete.filter((d) => dayTime(d) >= dayTime(last) - STANDING_DAYS * DAY_MS);
  const [first] = days;
  if (first === undefined || days.length < 2) return null;
  const rankings = days.map((d) => rankByMight([...(byDay.get(d)?.values() ?? [])]));
  const [rankFirst, rankLast] = [rankings[0], rankings.at(-1)];
  const [mightFirst, mightLast] = [byDay.get(first), byDay.get(last)];
  if (!rankFirst || !rankLast || !mightFirst || !mightLast) return null;
  const out = [...mightLast.values()].map((r): StandingRow => {
    const start = mightFirst.get(r.unionId)?.might ?? 0;
    const meta = newest.get(r.unionId) ?? r;
    return {
      unionId: r.unionId,
      tag: meta.tag,
      name: meta.name,
      badgeId: meta.badgeId,
      might: r.might,
      rank: rankLast.get(r.unionId) ?? 0,
      ranks: rankings.map((m) => m.get(r.unionId) ?? 0),
      move: (rankFirst.get(r.unionId) ?? 0) - (rankLast.get(r.unionId) ?? 0),
      growth: growthPercent(start, r.might),
    };
  });
  const total = (m: Map<number, StandingInput>) =>
    [...m.values()].reduce((sum, r) => sum + r.might, 0);
  const serverMight = total(mightLast);
  return {
    days,
    rows: out.sort((a, b) => a.rank - b.rank),
    serverMight,
    serverGrowth: growthPercent(total(mightFirst), serverMight),
  };
}
