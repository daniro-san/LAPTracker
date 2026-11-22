// The KvK matchup's read model (D152, issue 306): our Start and End rows (member sums in SQL, so no member row
// leaves the database) and the opponent's rows, as alliance-level figures only. No member name, uid or
// per-member figure of either side is returned (INVARIANT kvk.aggregates-only).
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import {
  heavyCount,
  matchupOf,
  memberChange,
  usableStart,
  type Matchup,
  type SideAlliance,
} from "../kvk";
import { opponentFor, opponentReads, type OpponentRead } from "../repo/kvk";
import { snapshots } from "../schema";
import { phaseSnapshot } from "./visibility";

export interface EventMatchup {
  server: number;
  /** The tags saved, and how many of them gave a usable Start reading. */
  tags: number;
  read: number;
  /** Whether the End has run (its row is finished). */
  ended: boolean;
  matchup: Matchup;
}

type OurRow = {
  union_id: string;
  tag: string | null;
  name: string | null;
  total_power: string;
  total_kills: string;
  source_updated_at: Date;
  members: string;
  heavy: string;
};

/** Our usable Start rows (no error, fresh, read before the war) with their members and heavy hitters. */
async function ourStarts(db: Db, beforeId: number, warAt: Date) {
  const result = await db.execute<OurRow>(sql`
    select a.union_id, a.tag, a.name, a.total_power, a.total_kills, a.source_updated_at,
      count(m.id) as members,
      count(m.id) filter (where m.power >= 60000000) as heavy
    from alliance_snapshots a
    left join member_snapshots m on m.alliance_snapshot_id = a.id
    where a.snapshot_id = ${beforeId} and a.error is null and a.is_fresh
      and a.source_updated_at < ${warAt.toISOString()}
    group by a.id`);
  return result.rows;
}

/** Our alliances' Start to End over the members in both readings, for those with a usable End. */
async function ourChanges(db: Db, beforeId: number, afterId: number) {
  const result = await db.execute<{
    union_id: string;
    might: string;
    kills: string;
    n: string;
  }>(sql`
    select b.union_id,
      coalesce(sum(em.power - bm.power) filter (where em.power is not null and bm.power is not null), 0) as might,
      coalesce(sum(greatest(em.kills - bm.kills, 0)) filter (where em.kills is not null and bm.kills is not null), 0) as kills,
      count(*) as n
    from alliance_snapshots b
    join alliance_snapshots e on e.snapshot_id = ${afterId} and e.union_id = b.union_id
      and e.error is null and e.is_fresh
    join member_snapshots bm on bm.alliance_snapshot_id = b.id
    join member_snapshots em on em.alliance_snapshot_id = e.id and em.uid = bm.uid
    where b.snapshot_id = ${beforeId}
    group by b.union_id`);
  return new Map(
    result.rows.map((r) => [
      Number(r.union_id),
      { might: Number(r.might), kills: Number(r.kills), members: Number(r.n) },
    ]),
  );
}

/** The opponent's usable Start rows as alliances, each with its usable End's change. */
function theirSide(reads: readonly OpponentRead[], warAt: Date): SideAlliance[] {
  const ends = new Map(
    reads
      .filter((r) => r.phase === "after" && r.error === null && r.isFresh)
      .map((r) => [r.tag, r]),
  );
  const arrays = (r: OpponentRead) => ({
    uids: r.memberUids ?? [],
    might: r.memberPower ?? [],
    kills: r.memberKills ?? [],
  });
  return reads
    .filter((r) => usableStart(r, warAt))
    .map((r) => {
      const end = ends.get(r.tag);
      return {
        unionId: r.unionId as number,
        tag: r.tag,
        name: r.name,
        might: r.totalPower ?? 0,
        kills: r.totalKills ?? 0,
        members: r.memberCount ?? 0,
        heavy: heavyCount(r.memberPower ?? []),
        readAt: r.readAt,
        change: end ? memberChange(arrays(r), arrays(end)) : null,
      };
    });
}

/**
 * The matchup of a scheduled event with an opponent; null without one, or while either side has no usable
 * Start reading. `ended`: the End's row has finished, so Start to End is shown (its alliances with no usable
 * End show no change).
 */
export async function eventMatchup(db: Db, eventId: number): Promise<EventMatchup | null> {
  const o = await opponentFor(db, eventId);
  if (!o) return null;
  const phases = await db
    .select({ id: snapshots.id, phase: snapshots.phase, status: snapshots.status })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.eventId, eventId),
        phaseSnapshot,
        inArray(snapshots.phase, ["before", "after"]),
      ),
    );
  const before = phases.find((p) => p.phase === "before");
  const after = phases.find((p) => p.phase === "after" && p.status !== "running");
  if (!before) return null;
  const [reads, starts, changes] = await Promise.all([
    opponentReads(db, [o.id]),
    ourStarts(db, before.id, o.eventAtUtc),
    after ? ourChanges(db, before.id, after.id) : Promise.resolve(new Map<number, never>()),
  ]);
  const ours: SideAlliance[] = starts.map((r) => ({
    unionId: Number(r.union_id),
    tag: r.tag,
    name: r.name,
    might: Number(r.total_power),
    kills: Number(r.total_kills),
    members: Number(r.members),
    heavy: Number(r.heavy),
    readAt: new Date(r.source_updated_at),
    change: changes.get(Number(r.union_id)) ?? null,
  }));
  const theirs = theirSide(reads, o.eventAtUtc);
  const matchup = matchupOf(ours, theirs, after !== undefined);
  if (!matchup) return null;
  return { server: o.server, tags: o.tags.length, read: theirs.length, ended: !!after, matchup };
}
