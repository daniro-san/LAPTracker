// Pure arithmetic for the live event section (issue 307): each alliance's change since Start, the server's
// kills per reading interval, the busiest 30 minutes, and when the page should look again. Readings are
// alliance totals only (no rosters). The game moves an alliance's numbers in steps of about 10-13 minutes
// (measured 2026-11-16), so a 15-minute interval holds 0, 1 or 2 game updates: the section reads
// cumulative changes, and the busiest span is two intervals.
import { delta, type Measured } from "./compute";
import { slotOf } from "./schedule";

const MINUTE = 60_000;
/** How long after a slot its sample is expected on the page: the tick runs just after the slot and a read of 20 alliances takes ~1 min. */
export const SAMPLE_WAIT_MS = MINUTE;
/** How long after an event's End is due the page looks once more for it. */
export const END_WAIT_MS = 2 * MINUTE;

/** One reading: its time and every alliance that was read (a failed alliance is absent). */
export interface Slice {
  at: Date;
  alliances: ReadonlyMap<number, Measured>;
}

export interface Standing {
  unionId: number;
  /** The latest reading's time; null when there is none yet. */
  at: Date | null;
  start: Measured;
  latest: Measured;
  /** Latest minus Start; null when either is stale, or the alliance was not read in the latest reading. */
  change: { power: number; kills: number } | null;
}

/**
 * Every alliance of the Start with its change since Start at the latest reading in `samples`.
 * INVARIANT freshness.no-stale-delta: a stale or missing side gives no change. Most kills gained first,
 * no change last, then by id.
 */
export function standings(start: Slice, samples: readonly Slice[]): Standing[] {
  const latestSlice = samples.at(-1);
  return [...start.alliances]
    .map(([unionId, from]): Standing => {
      const to = latestSlice?.alliances.get(unionId);
      return {
        unionId,
        at: latestSlice?.at ?? null,
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
 * left out of that interval. A span longer than `everyMs` (a reading is missing) gives `missing` intervals.
 */
export function serverPulse(readings: readonly Slice[], everyMs: number): PulseSlot[] {
  const slots: PulseSlot[] = [];
  if (everyMs <= 0) return slots; // sampling is off: no interval to read
  for (let i = 1; i < readings.length; i++) {
    const [prev, cur] = [readings[i - 1] as Slice, readings[i] as Slice];
    const [from, to] = [prev.at.getTime(), cur.at.getTime()];
    if (to - from > everyMs) {
      for (let t = from + everyMs; t <= to; t += everyMs) slots.push(missing(t - everyMs, t));
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
  /** This span's kills over all the kills gained in the compared intervals, 0..1. */
  share: number;
  /** Index of its first interval in the pulse. */
  index: number;
}

/**
 * The two consecutive intervals with the most kills (a rolling 30 minutes at the 15-minute cadence, which
 * holds the same number of game updates whatever the phase). Needs both intervals compared and a gain;
 * null otherwise. The first such span wins a tie.
 */
export function busiestSpan(slots: readonly PulseSlot[]): Busiest | null {
  const total = slots.reduce((sum, s) => sum + (s.kills ?? 0), 0);
  let best: Busiest | null = null;
  for (let i = 0; i + 1 < slots.length; i++) {
    const [a, b] = [slots[i] as PulseSlot, slots[i + 1] as PulseSlot];
    if (a.kills === null || b.kills === null) continue;
    const kills = a.kills + b.kills;
    if (kills > 0 && total > 0 && (!best || kills > best.kills))
      best = { from: a.from, to: b.to, kills, share: kills / total, index: i };
  }
  return best;
}

/**
 * The next reading the page waits for and when to look again, or null once the event's End has had its
 * time (`END_WAIT_MS` after `afterAt`) or there are no samples (`everyMin` 0). A slot's sample is expected
 * `SAMPLE_WAIT_MS` after the slot, so the slot holding `now` still counts for its first minute. A slot
 * that holds no sample (the End's own slot or later) is replaced by the End.
 */
export function nextReading(
  now: Date,
  everyMin: number,
  afterAt: Date,
): { at: Date; refreshAt: Date } | null {
  if (everyMin <= 0 || now.getTime() >= afterAt.getTime() + END_WAIT_MS) return null;
  const slot = slotOf(now, everyMin).getTime();
  const at = slot + SAMPLE_WAIT_MS > now.getTime() ? slot : slot + everyMin * MINUTE;
  if (at >= slotOf(afterAt, everyMin).getTime())
    return { at: afterAt, refreshAt: new Date(afterAt.getTime() + END_WAIT_MS) };
  return { at: new Date(at), refreshAt: new Date(at + SAMPLE_WAIT_MS) };
}
