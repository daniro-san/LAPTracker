// Alliance leadership: who holds R5 and who holds a titled R4 in a stored roster. Reads only the two
// rank columns of member_snapshots (filled by the collector from /v1 `rank_code` / `rank_label`),
// for the R5 and R4 rows alone (and the R5's public name for `leaderNames`); never raw_json or any other
// roster field.
import { and, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { phaseSnapshot, publicEvent } from "./visibility";

/** The R5 leader, or an R4 officer with the title the game gives (`R4 · Diplomat` → `Diplomat`). */
export type Role = { kind: "leader" } | { kind: "officer"; title: string };

const LEADER = 105;
const OFFICER = 104;
const TITLE_PREFIX = /^R4\s*·\s*/;
// The tracker's names for two R4 slots, shown by the game's names (owner, D56). Any other title, the
// stored rank_label and raw_json stay as the tracker sends them.
const GAME_TITLE = new Map([
  ["militarist", "God of War"],
  ["overseer", "Goddess"],
]);

/** The role a rank means; null for R1–R3 and for an R4 without a title. */
export function roleOf(rankCode: number, rankLabel: string | null): Role | null {
  if (rankCode === LEADER) return { kind: "leader" };
  if (rankCode !== OFFICER) return null;
  const title = (rankLabel ?? "").replace(TITLE_PREFIX, "").trim();
  if (title === "" || title === "R4") return null;
  return { kind: "officer", title: GAME_TITLE.get(title.toLowerCase()) ?? title };
}

/** Roles by alliance snapshot id, then by member uid. A roster without rank data has no entry. */
export async function rolesOf(
  db: Db,
  allianceSnapshotIds: number[],
): Promise<Map<number, Map<number, Role>>> {
  const out = new Map<number, Map<number, Role>>();
  if (allianceSnapshotIds.length === 0) return out;
  const rows = await db
    .select({
      allianceSnapshotId: memberSnapshots.allianceSnapshotId,
      uid: memberSnapshots.uid,
      rankCode: memberSnapshots.rankCode,
      rankLabel: memberSnapshots.rankLabel,
    })
    .from(memberSnapshots)
    .where(
      and(
        inArray(memberSnapshots.allianceSnapshotId, allianceSnapshotIds),
        inArray(memberSnapshots.rankCode, [LEADER, OFFICER]),
      ),
    );
  for (const r of rows) {
    const role = r.rankCode === null ? null : roleOf(r.rankCode, r.rankLabel);
    if (!role) continue;
    const byUid = out.get(r.allianceSnapshotId) ?? new Map<number, Role>();
    byUid.set(r.uid, role);
    out.set(r.allianceSnapshotId, byUid);
  }
  return out;
}

/**
 * Each alliance's leader by union id: the R5 of its newest public Before or After read that lists one,
 * among the last `RECENT_EVENTS` public events, with when that read started (the thefts log's "whom to
 * contact", issue 321). An alliance with no such read has no entry: an older leader may have stepped down.
 */
export async function leaderNames(
  db: Db,
  unionIds: number[],
): Promise<Map<number, { name: string; at: Date }>> {
  if (unionIds.length === 0) return new Map();
  const recent = db
    .select({ id: events.id })
    .from(events)
    .where(publicEvent)
    .orderBy(desc(events.eventAtUtc))
    .limit(RECENT_EVENTS);
  const rows = await db
    .selectDistinctOn([allianceSnapshots.unionId], {
      unionId: allianceSnapshots.unionId,
      name: memberSnapshots.name,
      at: snapshots.startedAt,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        inArray(allianceSnapshots.unionId, unionIds),
        eq(memberSnapshots.rankCode, LEADER),
        inArray(events.id, recent),
        publicEvent,
        phaseSnapshot,
      ),
    )
    .orderBy(allianceSnapshots.unionId, desc(snapshots.startedAt));
  return new Map(rows.map((r) => [r.unionId, { name: r.name, at: r.at }]));
}

/** How many of the newest public events `leaderNames` looks back over. */
const RECENT_EVENTS = 4;
