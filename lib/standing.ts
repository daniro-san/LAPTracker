// Standing against the server (D90, issue 274): each tracked alliance's rank by might over the last days,
// its might growth and the tracked alliances' total growth beside it. Pure: daily alliance totals in,
// figures out. The period is the 7 days up to the newest day with any usable read; the listed alliances
// are those read in it, and only days on which every one of them has a usable daily roster enter a rank
// series (a day with fewer would rank a smaller server), as the balance trend does (D85, D90 amendment).

/** One usable daily roster's totals; the alliance's name and badge come from its newest row. */
export interface StandingInput {
  day: string;
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  might: number;
}

/** The period looks back this many days from the newest day with a usable read. */
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
  /** The period's complete days, oldest first; at least two. */
  days: string[];
  /** Alliances read in the last 90 days but not in the period, by union id: left out of the ranks. */
  notRanked: { unionId: number; tag: string | null; name: string | null }[];
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

/** The reads of the 7 days up to the newest day with a usable read, by day; the alliances read in it, and
 * each alliance's newest read (its name and badge) over every row. */
function window(rows: StandingInput[]) {
  const newestDay = rows.reduce((max, r) => (r.day > max ? r.day : max), "");
  const since = dayTime(newestDay) - STANDING_DAYS * DAY_MS;
  const byDay = new Map<string, Map<number, StandingInput>>();
  const newest = new Map<number, StandingInput>();
  const listedIds = new Set<number>();
  for (const r of rows) {
    const seen = newest.get(r.unionId);
    if (!seen || r.day > seen.day) newest.set(r.unionId, r);
    if (dayTime(r.day) < since) continue;
    byDay.set(r.day, (byDay.get(r.day) ?? new Map()).set(r.unionId, r));
    listedIds.add(r.unionId);
  }
  return { byDay, newest, listedIds };
}

/**
 * The standing over the 7 days up to the newest day with any usable read. The listed alliances are those
 * with a read in that window; the period is its complete days. Null when fewer than two days are complete.
 */
export function standing(rows: StandingInput[]): Standing | null {
  const { byDay, newest, listedIds } = window(rows);
  const days = [...byDay.entries()]
    .filter(([, day]) => day.size === listedIds.size)
    .map(([day]) => day)
    .sort();
  const [first] = days;
  const last = days.at(-1);
  if (first === undefined || last === undefined || days.length < 2) return null;
  const notRanked = [...newest.values()]
    .filter((r) => !listedIds.has(r.unionId))
    .sort((a, b) => a.unionId - b.unionId)
    .map(({ unionId, tag, name }) => ({ unionId, tag, name }));
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
    notRanked,
    rows: out.sort((a, b) => a.rank - b.rank),
    serverMight,
    serverGrowth: growthPercent(total(mightFirst), serverMight),
  };
}
