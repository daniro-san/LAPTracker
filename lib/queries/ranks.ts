// Ledger ranks (plan Phase 5e): an alliance's position among the tracked alliances by might and by kills,
// per snapshot and per event. The server rank is the game's own (`server_rank`, from /v1). Ranking is
// compute.rankBy; movement is compute.rankDelta in the page.
import { eq } from "drizzle-orm";

import { rankBy } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";

export interface Ranks {
  might: number | null;
  kills: number | null;
}

type Phase = "before" | "after";

interface Ranked {
  key: number;
  power: number | null;
  kills: number | null;
}

/** Might and kills ranks of one group of rows (one snapshot, or one event's reference rows). */
function rankGroup(rows: Ranked[]): Map<number, Ranks> {
  const might = rankBy(rows.map((r) => [r.key, r.power] as const));
  const kills = rankBy(rows.map((r) => [r.key, r.kills] as const));
  return new Map(
    rows.map((r) => [r.key, { might: might.get(r.key) ?? null, kills: kills.get(r.key) ?? null }]),
  );
}

const rankColumns = {
  phase: snapshots.phase,
  unionId: allianceSnapshots.unionId,
  power: allianceSnapshots.totalPower,
  kills: allianceSnapshots.totalKills,
};

/** Each alliance's ledger ranks in the event's before and after snapshots. */
export async function eventRanks(
  db: Db,
  eventId: number,
): Promise<Map<number, Partial<Record<Phase, Ranks>>>> {
  const rows = await db
    .select(rankColumns)
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .where(eq(snapshots.eventId, eventId));
  const out = new Map<number, Partial<Record<Phase, Ranks>>>();
  for (const phase of ["before", "after"] as const) {
    const ranked = rankGroup(
      rows.filter((r) => r.phase === phase).map((r) => ({ ...r, key: r.unionId })),
    );
    for (const [unionId, ranks] of ranked)
      out.set(unionId, { ...out.get(unionId), [phase]: ranks });
  }
  return out;
}

/**
 * Ledger ranks per real event, over every alliance's reference row (the after row, or the before row
 * when after is missing or failed — the same rule as allianceHistory). Keyed event id → union id.
 */
export async function historyRanks(db: Db): Promise<Map<number, Map<number, Ranks>>> {
  const rows = await db
    .select({ ...rankColumns, eventId: snapshots.eventId, error: allianceSnapshots.error })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(eq(events.isTest, false));
  const references = new Map<number, Map<number, (typeof rows)[number]>>();
  for (const r of rows) {
    if (r.error !== null || r.power === null) continue;
    const byUnion = references.get(r.eventId) ?? new Map<number, (typeof rows)[number]>();
    if (!byUnion.has(r.unionId) || r.phase === "after") byUnion.set(r.unionId, r);
    references.set(r.eventId, byUnion);
  }
  return new Map(
    [...references].map(([eventId, byUnion]) => [
      eventId,
      rankGroup([...byUnion.values()].map((r) => ({ ...r, key: r.unionId }))),
    ]),
  );
}
