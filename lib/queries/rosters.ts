// Members who joined / left per alliance between an event's two snapshots (main table, plan Phase 5).
// Selects uid pairs only; the diff is compute.rosterDiff, matched by uid.
import { and, desc, eq, gt, inArray } from "drizzle-orm";

import { rosterDiff } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, dailyRosters, memberSnapshots } from "../schema";

export type RosterChange = { joined: number; left: number };

export async function rosterChanges(
  db: Db,
  snapshotIds: { before: number; after: number },
): Promise<Map<number, RosterChange>> {
  const rows = await db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      uid: memberSnapshots.uid,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .where(inArray(allianceSnapshots.snapshotId, [snapshotIds.before, snapshotIds.after]));
  const side = (snapshotId: number) => {
    const byAlliance = new Map<number, { uid: number; name: string }[]>();
    for (const r of rows.filter((x) => x.snapshotId === snapshotId)) {
      const list = byAlliance.get(r.unionId) ?? [];
      list.push({ uid: r.uid, name: "" });
      byAlliance.set(r.unionId, list);
    }
    return byAlliance;
  };
  const before = side(snapshotIds.before);
  const after = side(snapshotIds.after);
  const changes = new Map<number, RosterChange>();
  for (const [unionId, now] of after) {
    const was = before.get(unionId);
    if (!was) continue;
    const diff = rosterDiff(was, now);
    changes.set(unionId, { joined: diff.joined.length, left: diff.left.length });
  }
  return changes;
}

/**
 * Each alliance's member count from its newest daily read that counted members (D60), for the tracker-call
 * estimates (D134). An alliance with none is absent.
 */
export async function latestMemberCounts(
  db: Db,
  unionIds: readonly number[],
): Promise<Map<number, number>> {
  if (unionIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([dailyRosters.unionId], {
      unionId: dailyRosters.unionId,
      members: dailyRosters.memberCount,
    })
    .from(dailyRosters)
    .where(and(inArray(dailyRosters.unionId, [...unionIds]), gt(dailyRosters.memberCount, 0)))
    .orderBy(dailyRosters.unionId, desc(dailyRosters.readDay));
  return new Map(rows.map((r) => [r.unionId, r.members ?? 0]));
}
