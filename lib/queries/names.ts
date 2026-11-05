// Name history derived from snapshots, never stored (plan §3.8): one query per page.
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { nameHistory, type NameHistoryEntry, type NameSighting } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";

/** Distinct (tag, name) pairs per alliance, oldest first. Test events are not part of the history. */
export async function allianceNames(
  db: Db,
  unionIds: number[],
): Promise<Map<number, NameHistoryEntry[]>> {
  if (unionIds.length === 0) return new Map();
  const rows = await db
    .select({
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      name: allianceSnapshots.name,
      at: events.eventAtUtc,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        inArray(allianceSnapshots.unionId, unionIds),
        eq(events.isTest, false),
        isNotNull(allianceSnapshots.tag),
        isNotNull(allianceSnapshots.name),
      ),
    );
  const byAlliance = new Map<number, NameSighting[]>();
  for (const { unionId, tag, name, at } of rows) {
    const list = byAlliance.get(unionId) ?? [];
    list.push({ tag: tag ?? "", name: name ?? "", at });
    byAlliance.set(unionId, list);
  }
  return new Map([...byAlliance].map(([id, sightings]) => [id, nameHistory(sightings)]));
}
