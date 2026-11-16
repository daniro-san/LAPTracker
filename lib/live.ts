// Pure arithmetic for the live event section (issue 307): each alliance's change since Start, the server's
// kills per reading interval, the busiest two intervals, and when the page should look again. Readings are
// alliance totals only (no rosters). The game moves an alliance's numbers in steps of about 10-13 minutes
// (measured 2026-11-16), so an interval at the default 15-minute cadence holds 0, 1 or 2 game updates: the
// section reads cumulative changes, and the busiest span is two intervals (`2 × SAMPLE_EVERY_MIN` minutes).
import { delta, type Measured } from "./compute";
import { slotOf } from "./schedule";

const MINUTE = 60_000;
/** How long after a slot its sample is expected on the page: the tick runs just after the slot and a read of 20 alliances takes ~1 min. */
export const SAMPLE_WAIT_MS = MINUTE;
/** How long after an event's End is due the page looks once more for it. */
export const END_WAIT_MS = 2 * MINUTE;
/** The busiest span is named only once this many intervals were compared: before that it is noise. */
export const BUSIEST_MIN_INTERVALS = 4;
/** A slot's sample that is still missing this long after the slot is called overdue. */
export const OVERDUE_MS = 3 * MINUTE;

/** One reading: its time and every alliance that was read (a failed alliance is absent). */
export interface Slice {
  at: Date;
  alliances: ReadonlyMap<number, Measured>;
}

export interface Standing {
  unionId: number;
  /** The time of the reading `latest` is from: the alliance's latest usable sample, which is older than the
   * newest reading when the alliance was stale or not read in it; null when there is no sample yet. */
  at: Date | null;
  start: Measured;
  latest: Measured;
  /** Latest usable sample minus Start; null when no sample of the alliance is usable, or the Start is stale. */
  change: { power: number; kills: number } | null;
}

/**
 * Every alliance of the Start with its change since Start at its latest usable sample in `samples` (issue
 * 307: "at its latest usable sample"): the newest sample in which the alliance was read and fresh. With
 * none, `latest` is the newest sample's stale figures, or the Start's when it was not read at all.
 * INVARIANT freshness.no-stale-delta: a stale or missing side gives no change. Most kills gained first,
 * no change last, then by id.
 */
export function standings(start: Slice, samples: readonly Slice[]): Standing[] {
  const newest = samples.at(-1);
  return [...start.alliances]
    .map(([unionId, from]): Standing => {
      const usable = samples.findLast((s) => s.alliances.get(unionId)?.isFresh);
      const slice = usable ?? newest;
      const to = slice?.alliances.get(unionId);
      return {
        unionId,
        at: slice?.at ?? null,
        start: from,
        latest: to ?? from,
        change: to ? delta(from, to) : null,
      };
    })
    .sort(
      (a, b) =>
        (b.change?.kills ?? Number.NEGATIVE_INFINITY) -
          (a.change?.kills ?? Number.NEGATIVE_INFINITY) || a.unionId - b.unionId,
    );
}

/** `moved`: some alliance's numbers changed; `still`: alliances were compared and none changed (the game
 * sent no update); `missing`: no alliance could be compared (no reading, or stale). */
export type PulseState = "moved" | "still" | "missing";

export interface PulseSlot {
  from: Date;
  to: Date;
  /** Kills gained by the alliances compared in this interval; null when `missing`. */
  kills: number | null;
  /** How many alliances were compared. */
  alliances: number;
  state: PulseState;
}

const missing = (from: number, to: number): PulseSlot => ({
  from: new Date(from),
  to: new Date(to),
  kills: null,
  alliances: 0,
  state: "missing",
});

/**
 * Kills gained per reading interval across the alliances, between consecutive readings of each alliance
 * (`readings`: the Start, then the samples in time order). An alliance that is stale in either reading is
 * left out of that interval. A gap of two or more cadences (a reading is missing) gives `missing` intervals.
 */
export function serverPulse(readings: readonly Slice[], everyMs: number): PulseSlot[] {
  const slots: PulseSlot[] = [];
  if (everyMs <= 0) return slots; // sampling is off: no interval to read
  for (let i = 1; i < readings.length; i++) {
    const [prev, cur] = [readings[i - 1] as Slice, readings[i] as Slice];
    const [from, to] = [prev.at.getTime(), cur.at.getTime()];
    // A reading is missing when the gap holds two or more cadences. The Start is off the grid (12:01), so
    // the gap is rounded to whole cadences: the first slot starts at `from` and the last ends at `to`.
    const gaps = Math.round((to - from) / everyMs);
    if (gaps > 1) {
      const edge = (k: number) => (k === gaps ? to : from + k * everyMs);
      for (let k = 0; k < gaps; k++) slots.push(missing(edge(k), edge(k + 1)));
      continue;
    }
    let [kills, alliances, changed] = [0, 0, false];
    for (const [unionId, was] of prev.alliances) {
      const d = delta(was, cur.alliances.get(unionId) ?? { ...was, isFresh: false });
      if (!d) continue;
      kills += d.kills;
      alliances += 1;
      changed ||= d.kills !== 0 || d.power !== 0;
    }
    slots.push(
      alliances === 0
        ? missing(from, to)
        : {
            from: prev.at,
            to: cur.at,
            kills,
            alliances,
            state: changed ? "moved" : "still",
          },
    );
  }
  return slots;
}

export interface Busiest {
  from: Date;
  to: Date;
  kills: number;
  /** This span's kills over all the kills gained since Start, 0..1. */
  share: number;
  /** Index of its first interval in the pulse. */
  index: number;
}

/**
 * The two consecutive intervals with the most kills: a rolling `2 × SAMPLE_EVERY_MIN` minutes (30 at the
 * default 15-minute cadence), which holds about the same number of game updates whatever the phase. Needs
 * both intervals compared and a gain; null otherwise. The first such span wins a tie. `total` is all the kills gained since Start (the
 * standings' sum), not the sum of the compared intervals: a missed reading must not inflate the share.
 */
export function busiestSpan(slots: readonly PulseSlot[], total: number): Busiest | null {
  let best: Busiest | null = null;
  for (let i = 0; i + 1 < slots.length; i++) {
    const [a, b] = [slots[i] as PulseSlot, slots[i + 1] as PulseSlot];
    if (a.kills === null || b.kills === null) continue;
    const kills = a.kills + b.kills;
    if (kills > 0 && total > 0 && (!best || kills > best.kills))
      best = { from: a.from, to: b.to, kills, share: Math.min(1, kills / total), index: i };
  }
  return best;
}

/**
 * The next reading the page waits for and when to look again, or null once the event's End has had its
 * time (`END_WAIT_MS` after `afterAt`) or there are no samples (`everyMin` 0). A slot's sample is expected
 * `SAMPLE_WAIT_MS` after the slot, so the slot holding `now` still counts for its first minute. When that
 * slot has no sample by then (`sinceAt`, the latest sample's or the Start's time, is before it) the page
 * keeps waiting for it until `OVERDUE_MS`, so a tick that lands late does not leave the viewer a whole
 * slot behind, and the refresh then names the reading as due. A slot that holds no sample (the End's own
 * slot or later) is replaced by the End.
 */
export function nextReading(
  now: Date,
  everyMin: number,
  afterAt: Date,
  sinceAt: Date,
): { at: Date; refreshAt: Date } | null {
  if (everyMin <= 0 || now.getTime() >= afterAt.getTime() + END_WAIT_MS) return null;
  const slot = slotOf(now, everyMin).getTime();
  // A slot whose sample is already stored needs no wait: look at the next one.
  const sampled = slot <= sinceAt.getTime();
  const late = !sampled && now.getTime() < slot + OVERDUE_MS;
  const [at, wait]: [number, number] =
    !sampled && slot + SAMPLE_WAIT_MS > now.getTime()
      ? [slot, SAMPLE_WAIT_MS]
      : late
        ? [slot, OVERDUE_MS]
        : [slot + everyMin * MINUTE, SAMPLE_WAIT_MS];
  if (at >= slotOf(afterAt, everyMin).getTime())
    return { at: afterAt, refreshAt: new Date(afterAt.getTime() + END_WAIT_MS) };
  return { at: new Date(at), refreshAt: new Date(at + wait) };
}

/**
 * The slot whose sample is overdue: the current slot when it is after `sinceAt` (the latest sample, or the
 * Start), before the End's own slot, and began more than `OVERDUE_MS` ago; otherwise null.
 */
export function overdueSlot(
  now: Date,
  everyMin: number,
  sinceAt: Date,
  afterAt: Date,
): Date | null {
  if (everyMin <= 0) return null;
  const slot = slotOf(now, everyMin);
  const due =
    slot.getTime() > sinceAt.getTime() &&
    slot.getTime() < slotOf(afterAt, everyMin).getTime() &&
    now.getTime() - slot.getTime() > OVERDUE_MS;
  return due ? slot : null;
}
