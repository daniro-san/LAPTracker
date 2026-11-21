// Who carried the kingdom (#280, D83): per alliance, its share of the kills gained from Start to End next to
// its share of the might at Start, and, once the alliance has `CARRIED_MIN_EVENTS` events, the range of the
// ratio of the two. The might is the alliance total; the kills are those its members in both rosters gained
// (D69 amendment, 2026-11-21), summed in SQL: no member row or roster field leaves the database.
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { carriedShares, ratioSpread, type CarriedInput, type CarriedShare } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";
import type { getEventDetail } from "./events";
import type { TurnoutLists } from "./turnout";
import { chainEvent, phaseColumn, phaseSnapshot } from "./visibility";

/** Earlier events read for the ratio's range. */
const HISTORY_EVENTS = 12;

export interface CarriedRow {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  /** 0 to 1, of the might at Start of the alliances counted. */
  mightShare: number;
  /** 0 to 1, of the kills gained by the alliances counted. */
  killShare: number;
  /** The lowest and highest ratio (kill share over might share) over the alliance's events, this one included; null until it has `CARRIED_MIN_EVENTS` events. */
  spread: { n: number; low: number; high: number } | null;
  /** The alliance's members with kills gained and the members in both reads (#271); null without them. */
  turnout: { gainers: number; n: number } | null;
}

export interface Carried {
  /** Biggest gap first (kill share minus might share), then the lower id. */
  rows: CarriedRow[];
  /** Totals of the alliances counted. */
  totals: { alliances: number; killsGained: number; might: number };
}

type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
type Side = Detail["snapshots"][number]["alliances"][number];
type Totals = Pick<Side, "unionId" | "totalPower" | "isFresh" | "failed">;

const usable = (a: Totals) => a.isFresh && !a.failed;

/**
 * Per event and alliance (`eventId:unionId`), the kills its members in both the Start and the End roster
 * gained, a fall counting as none and a null kills as 0, as #271's `gained` (`killsTurnout`).
 */
async function stayedGains(db: Db, eventIds: readonly number[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  const result = await db.execute<{ event_id: number; union_id: string; gained: number }>(sql`
    select e.event_id, ea.union_id,
      sum(greatest(coalesce(em.kills, 0) - coalesce(bm.kills, 0), 0))::float8 as gained
    from snapshots e
    join snapshots b on b.event_id = e.event_id and b.phase = 'before'
    join alliance_snapshots ea on ea.snapshot_id = e.id and ea.error is null
    join alliance_snapshots ba on ba.snapshot_id = b.id and ba.union_id = ea.union_id and ba.error is null
    join member_snapshots em on em.alliance_snapshot_id = ea.id
    join member_snapshots bm on bm.alliance_snapshot_id = ba.id and bm.uid = em.uid
    where e.phase = 'after' and e.event_id in (${sql.join(
      eventIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    group by e.event_id, ea.union_id`);
  return new Map(result.rows.map((r) => [`${r.event_id}:${Number(r.union_id)}`, Number(r.gained)]));
}

/** One event's inputs: an alliance with a usable Start and a usable End, and its members' `gained`. */
function inputsOf(
  before: Totals[],
  after: Totals[],
  gained: (unionId: number) => number | undefined,
) {
  const ends = new Set(after.filter(usable).map((a) => a.unionId));
  return before
    .filter((b) => usable(b) && ends.has(b.unionId))
    .map((b): CarriedInput => ({
      key: b.unionId,
      might: b.totalPower,
      gained: gained(b.unionId) ?? null,
    }));
}

/** The ratio of each alliance in each of the earlier events: unionId to its ratios. */
async function earlierRatios(db: Db, before: Date): Promise<Map<number, number[]>> {
  const earlier = await db
    .select({ id: events.id })
    .from(events)
    .where(and(chainEvent, lt(events.eventAtUtc, before)))
    .orderBy(desc(events.eventAtUtc))
    .limit(HISTORY_EVENTS);
  if (earlier.length === 0) return new Map();
  const ids = earlier.map((e) => e.id);
  const gains = await stayedGains(db, ids);
  const rows = await db
    .select({
      eventId: snapshots.eventId,
      phase: phaseColumn,
      unionId: allianceSnapshots.unionId,
      totalPower: allianceSnapshots.totalPower,
      isFresh: allianceSnapshots.isFresh,
      error: allianceSnapshots.error,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .where(
      and(
        phaseSnapshot,
        inArray(snapshots.eventId, ids),
        isNull(allianceSnapshots.error),
        eq(allianceSnapshots.isFresh, true),
      ),
    );
  const ratios = new Map<number, number[]>();
  for (const { id } of earlier) {
    const side = (phase: "before" | "after") =>
      rows
        .filter((r) => r.eventId === id && r.phase === phase)
        .map((r) => ({ ...r, failed: false }));
    const inputs = inputsOf(side("before"), side("after"), (u) => gains.get(`${id}:${u}`));
    for (const s of carriedShares(inputs)) {
      if (s.ratio !== null) ratios.set(s.key, [...(ratios.get(s.key) ?? []), s.ratio]);
    }
  }
  return ratios;
}

/**
 * The section's figures for an event; null until it has both a Start and an End, and when no alliance with
 * a usable Start and End gained kills. An alliance whose Start or End row is stale or failed has no figure
 * (INVARIANT freshness.no-stale-delta) and is not in the totals. `turnout` is the event's #271 lists, or
 * their read still on its way: the earlier events are read meanwhile, since they do not depend on it.
 */
export async function whoCarried(
  db: Db,
  detail: Detail,
  turnout: TurnoutLists | null | PromiseLike<TurnoutLists | null>,
): Promise<Carried | null> {
  const before = detail.snapshots.find((s) => s.phase === "before");
  const after = detail.snapshots.find((s) => s.phase === "after");
  if (!before || !after) return null;
  const gains = await stayedGains(db, [detail.id]);
  const inputs = inputsOf(before.alliances, after.alliances, (u) => gains.get(`${detail.id}:${u}`));
  const shares = carriedShares(inputs);
  if (shares.length === 0) return null;
  const [earlier, lists] = await Promise.all([earlierRatios(db, detail.eventAtUtc), turnout]);
  const names = new Map(after.alliances.map((a) => [a.unionId, a]));
  const turnoutOf = new Map(lists?.withKills.map((t) => [t.unionId, t]));
  const rows = shares.map((s: CarriedShare): CarriedRow => {
    const a = names.get(s.key) as Side;
    const own = [...(earlier.get(s.key) ?? []), ...(s.ratio === null ? [] : [s.ratio])];
    const spread = ratioSpread(own);
    const t = turnoutOf.get(s.key);
    return {
      unionId: s.key,
      tag: a.tag,
      name: a.name,
      badgeId: a.badgeId,
      mightShare: s.mightShare,
      killShare: s.killShare,
      spread,
      turnout: t ? { gainers: t.gainers, n: t.n } : null,
    };
  });
  rows.sort(
    (p, q) => q.killShare - q.mightShare - (p.killShare - p.mightShare) || p.unionId - q.unionId,
  );
  const counted = new Set(shares.map((s) => s.key));
  const sum = (pick: (i: CarriedInput) => number) =>
    inputs.filter((i) => counted.has(i.key)).reduce((t, i) => t + pick(i), 0);
  return {
    rows,
    totals: {
      alliances: shares.length,
      killsGained: sum((i) => Math.max(0, i.gained ?? 0)),
      might: sum((i) => i.might ?? 0),
    },
  };
}
