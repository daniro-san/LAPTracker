// The officers' Insights page (issue 489), pure: the week's pulse (daily quests, the coin cap, donations) each
// day and against the 4 weeks before, effort in each quarter of might with the "Quiet contributors" thanks,
// and the membership flow (joined and left per week, where people came from and went, how long members have
// been with us, newcomers' growth). Only end-of-day reads (D72) are counted: a day with no read is left
// out, never 0 (D75). A null on a read that lists a member is "none that day" (D127). Nobody is ranked.
import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { COINS_MAX } from "./member-days";
import { DAY_MS, gameWeek, isoDay } from "./member-week";

/** This game week and the 4 before it. */
export const PULSE_WEEKS = 5;
/** The reads effort is averaged over: the last 7 end-of-day reads, as the member card's "Last 7 days". */
export const EFFORT_READS = 7;
/** Fewer reads than this make no groups and no thanks list: one day says too little about anyone. */
export const EFFORT_MIN_READS = 3;
/** A newcomer: first seen in our rosters less than this many days before the newest read. */
export const NEWCOMER_DAYS = 30;
/** Tenure bands, by days since first seen; members seen in our first roster are "since our first read". */
export const TENURE_DAYS = [14, 30, 90] as const;

/** `n` of `of` members; `of` is never 0. */
export interface Share {
  n: number;
  of: number;
}
/** The median of `of` numbers. */
export interface Median {
  value: number;
  of: number;
}

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);

export function median(values: readonly number[]): Median | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const value =
    s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
  return { value, of: s.length };
}

const share = (n: number, of: number): Share | null => (of > 0 ? { n, of } : null);

/**
 * The pulse of some reads, pooled: every member-day counts once, out of the members each read lists. A null
 * on a read that lists a member is none that day (D127): no quest points, not at the cap, no donation.
 */
export interface Pulse {
  /** Members with daily quest points above 0. */
  quests: Share | null;
  /** Members at the 1,000 coin cap. */
  coins: Share | null;
  /** Members who donated. */
  donated: Share | null;
  /** The median of the donations of those who donated. */
  tech: Median | null;
}

export function pulseOf(reads: readonly RosterRead[]): Pulse {
  const all = reads.flatMap((r) => r.members);
  const gifts = all.flatMap((m) => (m.dailyTech === null ? [] : [m.dailyTech]));
  return {
    quests: share(all.filter((m) => (m.active ?? 0) > 0).length, all.length),
    coins: share(all.filter((m) => (m.dailyHonor ?? 0) >= COINS_MAX).length, all.length),
    donated: share(gifts.length, all.length),
    tech: median(gifts),
  };
}

export interface WeekPulse extends Pulse {
  /** The week's Monday (server day). */
  monday: string;
  /** End-of-day reads in that week. */
  reads: number;
}

export interface PulseView {
  /** This game week's seven days: the day's pulse, null for no read, "later" for days still to come. */
  days: { day: string; pulse: Pulse | null | "later" }[];
  /** The 4 weeks before and this one, the oldest first. */
  weeks: WeekPulse[];
}

/** The week of the newest read, day by day, and each of the PULSE_WEEKS weeks pooled. */
export function pulseView(reads: readonly RosterRead[]): PulseView | null {
  const newest = reads.at(-1);
  if (!newest) return null;
  const week = gameWeek(newest.day);
  const byDay = new Map(reads.map((r) => [r.day, r]));
  const days = week.map((day) => {
    const read = byDay.get(day);
    return { day, pulse: day > newest.day ? ("later" as const) : read ? pulseOf([read]) : null };
  });
  const weeks = Array.from({ length: PULSE_WEEKS }, (_, i) => {
    const monday = isoDay(dayMs(week[0] as string) - (PULSE_WEEKS - 1 - i) * 7 * DAY_MS);
    const inWeek = reads.filter((r) => gameWeek(r.day)[0] === monday);
    return { monday, reads: inWeek.length, ...pulseOf(inWeek) };
  });
  return { days, weeks };
}

/**
 * One member's averages over the reads among the last EFFORT_READS that list them. A null on such a read is
 * none that day and counts as 0 (D127), so one big day does not stand for a week; a day with no read is left
 * out (D75).
 */
export interface Effort {
  uid: number;
  name: string;
  might: number;
  quests: number | null;
  coins: number | null;
  tech: number | null;
}

const EFFORT_FIELDS = { quests: "active", coins: "dailyHonor", tech: "dailyTech" } as const;
export type EffortMetric = keyof typeof EFFORT_FIELDS;
export const EFFORT_METRICS = Object.keys(EFFORT_FIELDS) as EffortMetric[];

const mean = (v: number[]) => (v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length);

/** Each member of the newest read with a might, minus `leftOut`, with their averages. */
export function effortsOf(reads: readonly RosterRead[], leftOut: ReadonlySet<number>): Effort[] {
  const recent = reads.slice(-EFFORT_READS);
  const newest = recent.at(-1);
  if (!newest) return [];
  const rows = (uid: number) =>
    recent.flatMap((r) => r.members.filter((m) => m.uid === uid)) as RosterMember[];
  return newest.members.flatMap((m) => {
    if (m.power === null || leftOut.has(m.uid)) return [];
    const seen = rows(m.uid);
    const avg = (k: EffortMetric) => mean(seen.map((s) => s[EFFORT_FIELDS[k]] ?? 0));
    return [
      {
        uid: m.uid,
        name: m.name,
        might: m.power,
        quests: avg("quests"),
        coins: avg("coins"),
        tech: avg("tech"),
      },
    ];
  });
}

/** A quarter of the members by might, with the median of each average in it. */
export interface Band {
  low: number;
  high: number;
  members: number;
  medians: Record<EffortMetric, Median | null>;
}

const medianOf = (list: readonly Effort[], k: EffortMetric) =>
  median(list.flatMap((e) => (e[k] === null ? [] : [e[k]])));

/** Four bands of might, the highest first; fewer than 4 members make no bands. */
export function bandsOf(efforts: readonly Effort[]): Band[] {
  if (efforts.length < 4) return [];
  const s = [...efforts].sort((a, b) => a.might - b.might);
  const bands = [0, 1, 2, 3].map((i) =>
    s.slice(Math.floor((i * s.length) / 4), Math.floor(((i + 1) * s.length) / 4)),
  );
  return bands.reverse().map((list) => ({
    low: (list[0] as Effort).might,
    high: (list.at(-1) as Effort).might,
    members: list.length,
    medians: {
      quests: medianOf(list, "quests"),
      coins: medianOf(list, "coins"),
      tech: medianOf(list, "tech"),
    },
  }));
}

/**
 * "Quiet contributors": below the median might, and above the median in both daily quest points and
 * donations. A thanks list, in name order, never a ranking (D75, D114).
 */
export function quietOf(efforts: readonly Effort[]): Effort[] {
  const [might, quests, tech] = [
    median(efforts.map((e) => e.might)),
    medianOf(efforts, "quests"),
    medianOf(efforts, "tech"),
  ];
  if (!might || !quests || !tech) return [];
  return efforts
    .filter(
      (e) =>
        e.might < might.value &&
        e.quests !== null &&
        e.quests > quests.value &&
        e.tech !== null &&
        e.tech > tech.value,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A member who appears in a read and not in the read before (joined), or the other way (left). */
export interface Move {
  uid: number;
  name: string;
  /** The read that first shows the change. */
  day: string;
  /** The read before it: the last day with us for a leaver. */
  before: string;
  /** Might in the read that lists them (the new read for a joiner, the old one for a leaver). */
  might: number | null;
}

/** Joins and leaves between consecutive reads from `from` on (a read before `from` is the first base). */
export function movesOf(reads: readonly RosterRead[], from: string) {
  const joined: Move[] = [];
  const left: Move[] = [];
  reads.forEach((read, i) => {
    const prev = reads[i - 1];
    if (!prev || read.day < from) return;
    const [was, is] = [
      new Set(prev.members.map((m) => m.uid)),
      new Set(read.members.map((m) => m.uid)),
    ];
    const move = (m: RosterMember) => ({
      uid: m.uid,
      name: m.name,
      day: read.day,
      before: prev.day,
      might: m.power,
    });
    joined.push(...read.members.filter((m) => !was.has(m.uid)).map(move));
    left.push(...prev.members.filter((m) => !is.has(m.uid)).map(move));
  });
  return { joined, left };
}

/** One sighting of a player in another alliance's usable daily roster, or a history row's alliance. */
export interface Elsewhere {
  uid: number;
  day: string;
  unionId: number;
  /** The tag a /v1/players history row gave it that day (D132). */
  tag?: string | null;
}

/** An alliance and how many people came from or went to it; `unionId` 0: not known. */
export interface Place {
  unionId: number;
  tag: string | null;
  n: number;
}

function tally(found: (Elsewhere | undefined)[]): Place[] {
  const out = new Map<number, Place>();
  for (const s of found) {
    const id = s?.unionId ?? 0;
    const p = out.get(id) ?? { unionId: id, tag: null, n: 0 };
    out.set(id, { ...p, n: p.n + 1, tag: p.tag ?? s?.tag ?? null });
  }
  // The most first; "not known" last.
  return [...out.values()].sort(
    (a, b) => Number(a.unionId === 0) - Number(b.unionId === 0) || b.n - a.n,
  );
}

const elsewhere = (seen: readonly Elsewhere[], ours: number) =>
  seen.filter((s) => s.unionId > 0 && s.unionId !== ours);

/** Where joiners came from: each one's latest sighting elsewhere on or before the day they appear with us. */
export function cameFrom(
  joined: readonly Move[],
  seen: readonly Elsewhere[],
  ours: number,
): Place[] {
  const other = elsewhere(seen, ours);
  return tally(
    joined.map(
      (j) =>
        other
          .filter((s) => s.uid === j.uid && s.day <= j.day)
          .sort((a, b) => b.day.localeCompare(a.day))[0],
    ),
  );
}

/** Where leavers went: each one's first sighting elsewhere from their last day with us on. */
export function wentTo(left: readonly Move[], seen: readonly Elsewhere[], ours: number): Place[] {
  const other = elsewhere(seen, ours);
  return tally(
    left.map(
      (l) =>
        other
          .filter((s) => s.uid === l.uid && s.day >= l.before)
          .sort((a, b) => a.day.localeCompare(b.day))[0],
    ),
  );
}

/** How many current members were first seen in each band: under 14, 30, 90 days, more, since our first read. */
export function tenureOf(
  uids: readonly number[],
  firstSeen: ReadonlyMap<number, string>,
  oldest: string,
  newest: string,
) {
  // `span`: the days our records cover, so the page leaves out the bands longer than that.
  const counts = {
    under: TENURE_DAYS.map(() => 0),
    over: 0,
    sinceStart: 0,
    span: daysBetween(oldest, newest),
  };
  for (const uid of uids) {
    const first = firstSeen.get(uid) ?? newest;
    if (first <= oldest) {
      counts.sinceStart += 1;
      continue;
    }
    const days = daysBetween(first, newest);
    const band = TENURE_DAYS.findIndex((d) => days < d);
    if (band < 0) counts.over += 1;
    else counts.under[band] = (counts.under[band] ?? 0) + 1;
  }
  return counts;
}

/**
 * Newcomers (first seen less than NEWCOMER_DAYS ago, after our first read): might in the first read that
 * lists them against the newest. A newcomer with no might on either read is left out of the growth.
 */
export function newcomersOf(
  reads: readonly RosterRead[],
  firstSeen: ReadonlyMap<number, string>,
  oldest: string,
) {
  const newest = reads.at(-1);
  if (!newest) return null;
  const fresh = newest.members.filter((m) => {
    const first = firstSeen.get(m.uid);
    return first !== undefined && first > oldest && daysBetween(first, newest.day) < NEWCOMER_DAYS;
  });
  const growth = fresh.flatMap((m) => {
    const then = reads
      .find((r) => r.day >= (firstSeen.get(m.uid) as string))
      ?.members.find((x) => x.uid === m.uid)?.power;
    return then && m.power !== null ? [(m.power - then) / then] : [];
  });
  return {
    n: fresh.length,
    counted: growth.length,
    grew: growth.filter((g) => g > 0).length,
    median: median(growth),
  };
}
