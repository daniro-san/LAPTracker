// Pure arithmetic for the views that put events side by side on their 15-minute samples (issue 284, D86):
// each event's slots on the server clock with their share of the event's kills, its busiest rolling
// 30 minutes, which slots two events both cover, and why an event without samples is off. The slots come
// from `serverPulse` (lib/live.ts), so a slot's state means the same here as on the event page.
import {
  BUSIEST_MIN_INTERVALS,
  busiestSpan,
  type AlliancePart,
  type PulseSlot,
  type PulseState,
} from "./live";

/** An event created a day ahead, or running, has no After row yet: it is waiting for its readings for this long. */
export const WAITING_MS = 24 * 60 * 60_000;

export interface ClockSlot {
  /** The slot's start, on the sample grid (12:00 for the interval 12:01–12:15). */
  at: Date;
  /** The slot's start in minutes on the server clock, counted from the server midnight of the first slot, so
   * an event that runs past midnight keeps counting (1440 and up). Two events line up on this number. */
  minute: number;
  /** Kills the alliances gained in the slot (a loss counts 0); null unless `moved`. */
  kills: number | null;
  /** The slot's kills over all the kills the event gained in its slots, 0..1; null unless `moved`. */
  share: number | null;
  /** `moved`, `still` (no update from the game) or `missing` (no reading), as on the event page. */
  state: PulseState;
  /** Alliances compared in the slot. */
  alliances: number;
  /**
   * Each compared alliance's kills in the slot, from `serverPulse`: they add up to `kills`, except when
   * their sum is a loss, which `kills` counts as 0.
   */
  parts: AlliancePart[];
  /**
   * The two readings the slot compares (the Start, off the grid, for the first): what a split names, not
   * the grid times `at` lines the strips up on.
   */
  read: { from: Date; to: Date };
}

export interface ClockBusiest {
  /** Index of the first of its two slots. */
  index: number;
  /** The span on the grid: the first slot's start to the second slot's end. */
  from: Date;
  to: Date;
  kills: number;
  share: number;
}

export interface EventClock {
  /** Consecutive slots, the last one the last reading's. Empty when no interval could be read. */
  slots: ClockSlot[];
  /** Kills gained over the slots: the denominator of every share. */
  kills: number;
  /** Null before 4 slots are compared, as on the event page. */
  busiest: ClockBusiest | null;
}

/**
 * An event's slots from its `serverPulse` intervals (the Start, then each sample). The intervals are
 * consecutive, each one cadence long, so the last ends on the last sample's slot and each earlier one is
 * one cadence before the next: the first interval, from the off-grid Start, is the slot that holds it.
 * INVARIANT: the shares of the `moved` slots sum to 1 when the event gained kills (0 when it did not).
 */
export function eventClock(
  pulse: readonly PulseSlot[],
  everyMin: number,
  minuteOf: (at: Date) => number,
): EventClock {
  const last = pulse.at(-1);
  if (!last || everyMin <= 0) return { slots: [], kills: 0, busiest: null };
  const every = everyMin * 60_000;
  const firstAt = last.to.getTime() - pulse.length * every;
  // A loss of kills (a member left) is no gain; it must not shrink the total the shares divide by.
  const gained = pulse.map((s) => (s.state === "moved" ? Math.max(0, s.kills ?? 0) : null));
  const kills = gained.reduce<number>((sum, k) => sum + (k ?? 0), 0);
  const startMinute = minuteOf(new Date(firstAt));
  const slots = pulse.map((s, i): ClockSlot => ({
    at: new Date(firstAt + i * every),
    minute: startMinute + i * everyMin,
    kills: gained[i] ?? null,
    share: gained[i] === null ? null : kills > 0 ? (gained[i] as number) / kills : 0,
    state: s.state,
    alliances: s.alliances,
    parts: s.parts,
    read: { from: s.from, to: s.to },
  }));
  const compared = pulse.filter((s) => s.kills !== null).length;
  const found =
    compared >= BUSIEST_MIN_INTERVALS
      ? busiestSpan(
          // A `still` slot gained 0 (it can sit beside a busy one); only a `missing` slot has no figure.
          pulse.map((s, i) => ({ ...s, kills: s.kills === null ? null : (gained[i] ?? 0) })),
          kills,
        )
      : null;
  const [first, second] = [slots[found?.index ?? -1], slots[(found?.index ?? -1) + 1]];
  const busiest =
    found && first && second
      ? {
          index: found.index,
          from: first.at,
          to: new Date(second.at.getTime() + every),
          kills: found.kills,
          share: found.share,
        }
      : null;
  return { slots, kills, busiest };
}

/** The columns of a chart that lines events up on the server clock: every minute any of them covers, in
 * order, each with a slot start to label it by. */
export function clockColumns(clocks: readonly EventClock[]): { minute: number; at: Date }[] {
  const at = new Map<number, Date>();
  for (const c of clocks) for (const s of c.slots) if (!at.has(s.minute)) at.set(s.minute, s.at);
  return [...at]
    .map(([minute, when]) => ({ minute, at: when }))
    .sort((a, b) => a.minute - b.minute);
}

/** The server-clock minutes both events have a slot for, in order (what a window picker can offer). */
export function bothCover(a: EventClock, b: EventClock): number[] {
  const inB = new Set(b.slots.map((s) => s.minute));
  return a.slots.map((s) => s.minute).filter((m) => inB.has(m));
}

/**
 * Why an unsampled event is off, from what is known of it: its readings are still to come (`waiting`),
 * they began with a later event (`since`: that event's time), none was sampled yet (`next`), or the event
 * came after sampling began and has none (`missed`).
 */
export type OffReason =
  { kind: "waiting" } | { kind: "since"; at: Date } | { kind: "next" } | { kind: "missed" };

export function offReason(
  event: { eventAtUtc: Date; ended: boolean },
  firstSampledAt: Date | null,
  now: Date,
): OffReason {
  if (!event.ended && now.getTime() < event.eventAtUtc.getTime() + WAITING_MS)
    return { kind: "waiting" };
  if (firstSampledAt === null) return { kind: "next" };
  return event.eventAtUtc < firstSampledAt
    ? { kind: "since", at: firstSampledAt }
    : { kind: "missed" };
}
