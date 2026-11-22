// The Insights page's KvK cost and recovery (issue 489, section 3), pure: for each recent scheduled event,
// the alliance's might at its Start and End reads and now, and the share of the loss back on each
// end-of-day read after it; for the newest, each member's loss and how far they are back, and "Took a heavy
// hit — maybe offer help". Only members in both event reads and in the newest read are counted, so a member
// who joined after the event or left since never moves the numbers. A null might is left out (D15, D75).
// Help, never blame: the list is in name order with no number beside a name, leaves out members on a break
// (D75), and tests the whole percents the page shows, so a name never sits beside "now 80%".
import type { EventMight, RosterRead } from "../repo/workspace-rosters";
import { addDays, dayIn } from "./calendar-time";

/** Events shown: about a month of Saturdays inside the page's 36 reads. */
export const KVK_EVENTS = 4;
/** Recovery reads shown per event, at most: the week until the next one. */
export const RECOVERY_READS = 7;
/** "A heavy hit": lost more than this share of their might in the event. */
export const HEAVY_LOSS = 0.25;
/** …and still below this share of their might before it. */
export const HELP_BELOW = 0.8;
/** Events shown start this many days from the first read's day: an End read the day before may sit on it. */
export const KVK_SHOWN_FROM = -1;
/**
 * The page reads events from this many days from the first read's day: one KvK week before the events shown,
 * only so that `readsFrom` can say a KvK before the reads is not shown.
 */
export const KVK_READ_FROM = KVK_SHOWN_FROM - 7;

export interface KvkMember {
  uid: number;
  name: string;
  /** Share of their Start might lost by the End (negative: grew). */
  lost: number;
  /** Their might now as a share of their Start might. */
  back: number;
}

export interface KvkEvent {
  at: Date;
  /** When the End read started: a follow-up record from then on was written after the KvK (#585 S5). */
  afterAt: Date;
  /** The event's server day. */
  day: string;
  /**
   * The read "now" is taken from: the newest for the newest event; for an older one, its last recovery
   * read before the next event, so a later KvK's loss never shows as this one's.
   */
  nowDay: string;
  /** Members counted: in the Start, End and "now" reads, with a might in each. */
  members: number;
  /** Members of the "now" read not counted: joined since, missing from one event read, or no might. */
  others: number;
  /** In both event reads but not in the "now" read: left since. */
  left: number;
  before: number;
  after: number;
  now: number;
  /** Each read from the day after, for a week until the next event: the share of the loss back (null: nothing lost). */
  days: { day: string; share: number | null }[];
  /** The newest event only: every counted member in name order, and who might want help. */
  people: KvkMember[];
  help: { uid: number; name: string }[];
}

const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0);

/** The share of the loss from `before` to `after` that `then` has back; null when nothing was lost. */
const recovered = (before: number, after: number, then: number) =>
  before > after ? (then - after) / (before - after) : null;

function eventOf(
  e: EventMight,
  next: EventMight | undefined,
  reads: readonly RosterRead[],
  zone: string,
  newest: { event: boolean; away: ReadonlySet<number> },
): KvkEvent | null {
  const day = dayIn(zone, e.at.getTime());
  // From the server day after the event (its own read only repeats the End read), for at most a week:
  // a next KvK whose End failed is not in `events`, so the week also ends the window.
  const later = reads
    .filter(
      (r) =>
        r.day > day && r.day < addDays(day, 7) && r.at > e.afterAt && (!next || r.at < next.at),
    )
    .slice(0, RECOVERY_READS);
  const last = (newest.event ? reads.at(-1) : (later.at(-1) ?? reads.at(-1))) as RosterRead;
  const nowOf = new Map(last.members.flatMap((m) => (m.power === null ? [] : [[m.uid, m]])));
  const both = [...e.before].flatMap(([uid, b]) => {
    const a = e.after.get(uid);
    return b && a !== null && a !== undefined ? [{ uid, before: b, after: a }] : [];
  });
  const counted = both.flatMap((m) => {
    const now = nowOf.get(m.uid);
    return now ? [{ ...m, name: now.name, now: now.power as number }] : [];
  });
  if (counted.length === 0) return null;
  const inCount = new Set(counted.map((m) => m.uid));
  const days = later.map((r) => {
    const power = new Map(r.members.map((m) => [m.uid, m.power]));
    const here = counted.filter((m) => typeof power.get(m.uid) === "number");
    const then = sum(here.map((m) => power.get(m.uid) as number));
    return {
      day: r.day,
      share: recovered(sum(here.map((m) => m.before)), sum(here.map((m) => m.after)), then),
    };
  });
  const people = newest.event
    ? counted
        .map((m) => ({
          uid: m.uid,
          name: m.name,
          lost: (m.before - m.after) / m.before,
          back: m.now / m.before,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  return {
    at: e.at,
    afterAt: e.afterAt,
    day,
    nowDay: last.day,
    members: counted.length,
    others: last.members.filter((m) => !inCount.has(m.uid)).length,
    left: both.filter((m) => !last.members.some((n) => n.uid === m.uid)).length,
    before: sum(counted.map((m) => m.before)),
    after: sum(counted.map((m) => m.after)),
    now: sum(counted.map((m) => m.now)),
    days,
    people,
    help: people
      .filter(
        (p) =>
          !newest.away.has(p.uid) &&
          Math.round(p.lost * 100) > HEAVY_LOSS * 100 &&
          Math.round(p.back * 100) < HELP_BELOW * 100,
      )
      .map((p) => ({ uid: p.uid, name: p.name })),
  };
}

/** The KvK card's data: the events it shows, and why it may show none yet. */
export interface KvkView {
  /** The newest KVK_EVENTS events inside the page's reads, the newest first. */
  events: KvkEvent[];
  /**
   * An event whose Start and End are read but no end-of-day read has come after its End yet (KvK day,
   * from the End to the 23:30 ST read): its day, and whether that is `now`'s server day.
   */
  waiting: { day: string; today: boolean } | null;
  /** The first read's day, when a KvK before the page's reads has both reads: it is not shown. */
  readsFrom: string | null;
}

/**
 * The KvK card's data against the page's end-of-day reads; nothing with no read. `events` may start before
 * the reads (KVK_READ_FROM): one before KVK_SHOWN_FROM only sets `readsFrom`. `away`: members on a break,
 * left out of the help list.
 */
export function kvkOf(
  events: readonly EventMight[],
  reads: readonly RosterRead[],
  zone: string,
  away: ReadonlySet<number>,
  now: Date,
): KvkView {
  const first = reads[0];
  const newest = reads.at(-1);
  if (!first || !newest) return { events: [], waiting: null, readsFrom: null };
  const from = addDays(first.day, KVK_SHOWN_FROM);
  const inside = events
    .filter((e) => dayIn(zone, e.at.getTime()) >= from)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  // An event whose End is newer than the newest read waits for the next read (KvK day, End to 23:30):
  // until then "now" would be the day before the event, so the card says it is waiting.
  const pending = inside.find((e) => e.afterAt >= newest.at);
  const sorted = inside.filter((e) => e.afterAt < newest.at).slice(0, KVK_EVENTS);
  const day = pending && dayIn(zone, pending.at.getTime());
  return {
    events: sorted.flatMap((e, i) => {
      const one = eventOf(e, sorted[i - 1], reads, zone, { event: i === 0, away });
      return one ? [one] : [];
    }),
    waiting: day ? { day, today: day === dayIn(zone, now.getTime()) } : null,
    readsFrom: inside.length < events.length ? first.day : null,
  };
}

/** Follow-up's "After KvK, offer help" (#585 S5) holds a KvK's help list for this many server days from its day. */
export const KVK_HELP_DAYS = 7;

/** The KvK Follow-up offers help after: its day, when its End read began, and who might want help. */
export interface AfterKvk {
  day: string;
  afterAt: Date;
  help: ReadonlySet<number>;
}

/**
 * The newest KvK shown (`kvkOf`), while server day `today` is less than KVK_HELP_DAYS after its day: from its
 * night read to the Friday after, as the recovery week (RECOVERY_READS). On the next KvK day it is gone until
 * that KvK's own read, and a skipped KvK never leaves an old list (#585 S5). Null with nobody to help.
 */
export function afterKvk(kvk: KvkView, today: string): AfterKvk | null {
  const e = kvk.events[0];
  if (!e || e.help.length === 0 || today >= addDays(e.day, KVK_HELP_DAYS)) return null;
  return { day: e.day, afterAt: e.afterAt, help: new Set(e.help.map((p) => p.uid)) };
}
