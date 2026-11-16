// The read model of an event's progress while it runs and after (issue 307, D69): whether it is live, its
// latest and next reading, each alliance's change since Start and the server's kills per interval. One
// select of alliance totals per reading (Start and samples: ≈ 20 alliances × ≤ 26 readings); the members'
// arrays are never read, so a page view moves kilobytes, not the ≈ 1.6 MB an `eventSamples` call would.
import { and, asc, eq, isNull, ne } from "drizzle-orm";

import type { Measured } from "../compute";
import type { Db } from "../db";
import {
  busiestSpan,
  nextReading,
  serverPulse,
  standings,
  type Busiest,
  type PulseSlot,
  type Standing,
} from "../live";
import { allianceSnapshots, events, snapshots } from "../schema";
import { publicEvent } from "./visibility";

export interface EventProgress {
  /** The Start is done and the End has not run, inside the window the page still waits for it. */
  live: boolean;
  /** Samples taken so far. */
  readings: number;
  /** The latest sample's time. */
  latestAt: Date;
  /** Live only: the next reading and when the page should look again. */
  next: { at: Date; refreshAt: Date } | null;
  standings: Standing[];
  pulse: PulseSlot[];
  busiest: Busiest | null;
  /** The interval between samples, in minutes. */
  everyMin: number;
}

type Row = {
  snapshotId: number;
  phase: "before" | "after" | "sample";
  status: string;
  slotAt: Date | null;
  beforeAt: Date;
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
    const at = r.phase === "before" ? r.beforeAt : (r.slotAt as Date);
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
 * The public event's progress; null when it is not public, has no usable Start or no usable sample.
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
      beforeAt: events.beforeAt,
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
  if (!start || !latest) return null;
  const startDone = rows.some((r) => r.phase === "before" && r.status !== "running");
  const ended = rows.some((r) => r.phase === "after");
  const next = startDone && !ended ? nextReading(now, everyMin, first.afterAt) : null;
  const pulse = serverPulse([start, ...samples], everyMin * 60_000);
  return {
    live: next !== null,
    readings: samples.length,
    latestAt: latest.at,
    next,
    standings: standings(start, samples),
    pulse,
    busiest: busiestSpan(pulse),
    everyMin,
  };
}
