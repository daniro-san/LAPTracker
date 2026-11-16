// The read model of an event's progress while it runs and after (issue 307, D69): whether it is live, its
// latest and next reading, each alliance's change since Start and the server's kills per interval. One
// select of alliance totals per reading (Start and samples: ≈ 20 alliances × ≤ 26 readings); the members'
// arrays are never read, so a page view moves kilobytes, not the ≈ 1.6 MB an `eventSamples` call would.
// It is its own reader, not `eventSamples(db, id, { rosters: false })`, because that returns neither the
// Start's finished time (the strip and the first interval start there), nor a Start still running, nor an
// End that exists but is running or failed (the page is not live then): it drops running snapshots and
// takes the Start's and End's times from the schedule. See the INVARIANT in lib/queries/visibility.ts.
import { and, asc, eq, isNull, ne } from "drizzle-orm";

import type { Measured } from "../compute";
import type { Db } from "../db";
import {
  BUSIEST_MIN_INTERVALS,
  busiestSpan,
  nextReading,
  overdueSlot,
  serverPulse,
  standings,
  type Busiest,
  type PulseSlot,
  type Slice,
  type Standing,
} from "../live";
import { allianceSnapshots, events, snapshots } from "../schema";
import { publicEvent } from "./visibility";

export interface EventProgress {
  /** The Start is done and the End has not run, inside the window the page still waits for it. */
  live: boolean;
  /** Samples taken so far. */
  readings: number;
  /** The server time this was read at: the live refresh waits from it (`LiveRefresh`). */
  asOf: Date;
  /** The Start's time. */
  startAt: Date;
  /** The latest sample's time; null before the first reading. */
  latestAt: Date | null;
  /** Live only: the next reading and when the page should look again. */
  next: { at: Date; refreshAt: Date } | null;
  /** Live only: the slot whose sample is more than 3 minutes late. */
  overdue: Date | null;
  standings: Standing[];
  /** Kills gained since Start at the latest reading, over the alliances with a change. */
  killsTotal: number;
  pulse: PulseSlot[];
  /** Null before 4 intervals are compared. */
  busiest: Busiest | null;
  /** The interval between samples, in minutes. */
  everyMin: number;
}

type Row = {
  snapshotId: number;
  phase: "before" | "after" | "sample";
  status: string;
  slotAt: Date | null;
  startedAt: Date;
  finishedAt: Date | null;
  unionId: number | null;
  isFresh: boolean | null;
  totalPower: number | null;
  totalKills: number | null;
};

/** The readings of Start and samples by snapshot: their time and every alliance read. */
function readSlices(rows: Row[]) {
  const slices = new Map<number, { at: Date; alliances: Map<number, Measured> }>();
  for (const r of rows) {
    if (r.phase === "after" || r.status === "running" || r.unionId === null) continue;
    const at = r.phase === "before" ? (r.finishedAt ?? r.startedAt) : (r.slotAt as Date);
    const slice = slices.get(r.snapshotId) ?? { at, alliances: new Map() };
    slice.alliances.set(r.unionId, {
      isFresh: r.isFresh === true,
      totalPower: r.totalPower,
      totalKills: r.totalKills,
    });
    slices.set(r.snapshotId, slice);
  }
  return slices;
}

/**
 * The public event's progress; null when it is not public, has no usable Start, or has no sample and is
 * not live (a live event with no sample yet still has progress: the strip).
 * `everyMin` is `SAMPLE_EVERY_MIN` (0 = off: nothing is live).
 */
export async function eventProgress(
  db: Db,
  eventId: number,
  { now, everyMin }: { now: Date; everyMin: number },
): Promise<EventProgress | null> {
  const rows = await db
    .select({
      snapshotId: snapshots.id,
      phase: snapshots.phase,
      status: snapshots.status,
      slotAt: snapshots.slotAt,
      startedAt: snapshots.startedAt,
      finishedAt: snapshots.finishedAt,
      afterAt: events.afterAt,
      unionId: allianceSnapshots.unionId,
      isFresh: allianceSnapshots.isFresh,
      totalPower: allianceSnapshots.totalPower,
      totalKills: allianceSnapshots.totalKills,
    })
    .from(events)
    .innerJoin(snapshots, eq(snapshots.eventId, events.id))
    // The End's alliance rows are not read: only its existence matters. A failed alliance row is left out.
    .leftJoin(
      allianceSnapshots,
      and(
        eq(allianceSnapshots.snapshotId, snapshots.id),
        isNull(allianceSnapshots.error),
        ne(snapshots.phase, "after"),
      ),
    )
    .where(and(eq(events.id, eventId), publicEvent))
    .orderBy(asc(snapshots.slotAt), asc(allianceSnapshots.unionId));
  const first = rows[0];
  if (!first) return null;
  const slices = readSlices(rows);
  const phaseOf = new Map(rows.map((r) => [r.snapshotId, r.phase]));
  const start = [...slices].find(([id]) => phaseOf.get(id) === "before")?.[1];
  const samples = [...slices]
    .filter(([id]) => phaseOf.get(id) === "sample")
    .map(([, slice]) => slice)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const latest = samples.at(-1);
  if (!start) return null;
  const startDone = rows.some((r) => r.phase === "before" && r.status !== "running");
  const ended = rows.some((r) => r.phase === "after");
  const next =
    startDone && !ended ? nextReading(now, everyMin, first.afterAt, latest?.at ?? start.at) : null;
  // Nothing to show before the first reading unless the event is live (the strip says when it comes).
  if (!latest && !next) return null;
  return progressOf(start, samples, next, { now, everyMin, afterAt: first.afterAt });
}

/** The figures of the readings so far; the pulse and the standings are empty before the first one. */
function progressOf(
  start: Slice,
  samples: Slice[],
  next: EventProgress["next"],
  { now, everyMin, afterAt }: { now: Date; everyMin: number; afterAt: Date },
): EventProgress {
  const latest = samples.at(-1);
  const pulse = serverPulse([start, ...samples], everyMin * 60_000);
  const rank = latest ? standings(start, samples) : [];
  const killsTotal = rank.reduce((sum, s) => sum + (s.change?.kills ?? 0), 0);
  const compared = pulse.filter((s) => s.kills !== null).length;
  return {
    live: next !== null,
    readings: samples.length,
    asOf: now,
    startAt: start.at,
    latestAt: latest?.at ?? null,
    next,
    overdue: next ? overdueSlot(now, everyMin, latest?.at ?? start.at, afterAt) : null,
    standings: rank,
    killsTotal,
    pulse,
    busiest: compared >= BUSIEST_MIN_INTERVALS ? busiestSpan(pulse, killsTotal) : null,
    everyMin,
  };
}
