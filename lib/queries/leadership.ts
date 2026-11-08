// Alliance leadership: who holds R5 and who holds a titled R4 in a stored roster. Reads only the two
// rank columns of member_snapshots (filled by the collector from /v1 `rank_code` / `rank_label`),
// for the R5 and R4 rows alone; never raw_json or any other roster field.
import { and, inArray } from "drizzle-orm";

import type { Db } from "../db";
import { memberSnapshots } from "../schema";

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
