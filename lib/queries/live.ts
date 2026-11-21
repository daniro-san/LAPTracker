// The read model of an event's progress while it runs and after (issue 307, D69): whether it is live, its
// latest and next reading, each alliance's change since Start and the server's kills per interval. One
// select of alliance totals per reading (Start and samples: ≈ 20 alliances × ≤ 26 readings); the members'
// arrays are never read, so a page view moves kilobytes, not the ≈ 1.6 MB an `eventSamples` call would.
// It is its own reader, not `eventSamples(db, id, { rosters: false })`, because that returns neither the
// Start's finished time (the strip and the first interval start there), nor a Start still running, nor an
// End that exists but is running or failed (the page is not live then): it drops running snapshots and
// takes the Start's and End's times from the schedule. See the INVARIANT in lib/queries/visibility.ts.
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

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
  type Reading,
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

/** One alliance row of a reading (or one bare row of an End), as the event cache keeps it (issue 327):
 * times are epoch milliseconds, so a row survives JSON. */
export type ProgressRow = {
  snapshotId: number;
  phase: "before" | "after" | "sample";
  status: string;
  slotAt: number | null;
  startedAt: number;
  finishedAt: number | null;
  afterAt: number;
  unionId: number | null;
  isFresh: boolean | null;
  totalPower: number | null;
  totalKills: number | null;
  /** `Reading.gained` and `Reading.step` (D69 amendment, 2026-11-21); absent on an End's row and on a row
   * with no members. */
  gained?: number;
  step?: number;
};

/** The readings of Start and samples by snapshot: their time and every alliance read. */
function readSlices(rows: readonly ProgressRow[]) {
  const slices = new Map<number, { at: Date; alliances: Map<number, Reading> }>();
  for (const r of rows) {
    if (r.phase === "after" || r.status === "running" || r.unionId === null) continue;
    const at = new Date(
      r.phase === "before" ? (r.finishedAt ?? r.startedAt) : (r.slotAt as number),
    );
    const slice = slices.get(r.snapshotId) ?? { at, alliances: new Map() };
    slice.alliances.set(r.unionId, {
      isFresh: r.isFresh === true,
      totalPower: r.totalPower,
      totalKills: r.totalKills,
      ...(r.gained !== undefined && { gained: r.gained }),
      ...(r.step !== undefined && { step: r.step }),
    });
    slices.set(r.snapshotId, slice);
  }
  return slices;
}

/** The Start (undefined when it has no usable alliance) and the samples in time order: the readings every
 * per-slot figure is taken from (`serverPulse`, `standings`, and the cross-event views of D86). */
export function readingsOf(rows: readonly ProgressRow[]): {
  start: Slice | undefined;
  samples: Slice[];
} {
  const slices = readSlices(rows);
  const phaseOf = new Map(rows.map((r) => [r.snapshotId, r.phase]));
  const start = [...slices].find(([id]) => phaseOf.get(id) === "before")?.[1];
  const samples = [...slices]
    .filter(([id]) => phaseOf.get(id) === "sample")
    .map(([, slice]) => slice)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return { start, samples };
}

/**
 * Per Start and sample row, its members' kills (D69 amendment, 2026-11-21), in SQL so only two numbers per
 * row leave the database: `gained`, each member's kills minus their kills at their first reading of the event
 * in the alliance; `step`, over the members also in the alliance's row of the reading just before. A null
 * kills counts as 0 (D15, as #271's `killsTurnout`). Keyed `snapshotId:unionId`.
 */
async function memberGains(db: Db, eventId: number): Promise<Map<string, [number, number]>> {
  const result = await db.execute<{
    id: number;
    union_id: string;
    gained: number;
    step: number;
  }>(sql`
    with reads as (
      select id, phase, row_number() over (order by phase <> 'before', slot_at) as k
      from snapshots
      where event_id = ${eventId} and phase in ('before', 'sample') and status <> 'running'
    ),
    m as (
      select r.id, r.k, a.union_id, ms.uid, coalesce(ms.kills, 0) as kills
      from reads r
      join alliance_snapshots a on a.snapshot_id = r.id and a.error is null
      join member_snapshots ms on ms.alliance_snapshot_id = a.id
      where r.phase = 'before'
      union all
      select r.id, r.k, a.union_id, u.uid, coalesce(u.kills, 0)
      from reads r
      join alliance_snapshots a on a.snapshot_id = r.id and a.error is null
      cross join lateral unnest(a.member_uids, a.member_kills) as u(uid, kills)
      where r.phase = 'sample'
    ),
    seq as (
      select id, k, union_id, kills, lag(k) over w as pk, lag(kills) over w as pkills,
        first_value(kills) over w as first
      from m
      window w as (partition by union_id, uid order by k)
    )
    select id, union_id,
      coalesce(sum(kills - first), 0)::float8 as gained,
      coalesce(sum(kills - pkills) filter (where pk = k - 1), 0)::float8 as step
    from seq group by id, union_id`);
  return new Map(
    result.rows.map((r) => [`${r.id}:${Number(r.union_id)}`, [Number(r.gained), Number(r.step)]]),
  );
}

/** The public event's Start and sample rows (alliance totals and `memberGains`) and its End's bare row; none
 * when it is not public. Nothing here depends on `now`, so the event cache can share it between requests. */
export async function progressRows(db: Db, eventId: number): Promise<ProgressRow[]> {
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
  const gains = rows.length > 0 ? await memberGains(db, eventId) : new Map();
  return rows.map((r) => {
    const g = gains.get(`${r.snapshotId}:${r.unionId}`);
    return {
      ...r,
      slotAt: r.slotAt?.getTime() ?? null,
      startedAt: r.startedAt.getTime(),
      finishedAt: r.finishedAt?.getTime() ?? null,
      afterAt: r.afterAt.getTime(),
      ...(g && { gained: g[0], step: g[1] }),
    };
  });
}

/**
 * The public event's progress from its rows (`progressRows`), as of `now`; null when it is not public, has
 * no usable Start, or has no sample and is not live (a live event with no sample yet still has progress:
 * the strip). `everyMin` is `SAMPLE_EVERY_MIN` (0 = off: nothing is live).
 */
export function eventProgressOf(
  rows: readonly ProgressRow[],
  { now, everyMin }: { now: Date; everyMin: number },
): EventProgress | null {
  const first = rows[0];
  if (!first) return null;
  const { start, samples } = readingsOf(rows);
  const latest = samples.at(-1);
  if (!start) return null;
  const startDone = rows.some((r) => r.phase === "before" && r.status !== "running");
  const ended = rows.some((r) => r.phase === "after");
  const afterAt = new Date(first.afterAt);
  const next =
    startDone && !ended ? nextReading(now, everyMin, afterAt, latest?.at ?? start.at) : null;
  // Nothing to show before the first reading unless the event is live (the strip says when it comes).
  if (!latest && !next) return null;
  return progressOf(start, samples, next, { now, everyMin, afterAt });
}

/** `eventProgressOf` over a fresh read of the rows. */
export async function eventProgress(
  db: Db,
  eventId: number,
  options: { now: Date; everyMin: number },
): Promise<EventProgress | null> {
  return eventProgressOf(await progressRows(db, eventId), options);
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
