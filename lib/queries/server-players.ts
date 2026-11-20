// The server's known players (issue 321): every member of each tracked alliance's newest usable daily
// roster (D60), as uid, name and alliance tag. Public data: the member-history arrays only, never raw_json.
import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db";
import { allianceLabels, trackedAllianceIds } from "../repo/alliances";
import { dailyRosters } from "../schema";
import { dailyFit } from "./history-readings";

export interface ServerPlayer {
  uid: number;
  name: string;
  unionId: number;
  /** As the newest roster gives it, else the alliance's newest label (D133). */
  tag: string;
}

/** One alliance's newest usable daily roster, as players; empty before its first one. */
async function newestRoster(
  db: Db,
  unionId: number,
  listed: string | null,
): Promise<ServerPlayer[]> {
  const [row] = await db
    .select({
      tag: dailyRosters.tag,
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
    })
    .from(dailyRosters)
    .where(and(eq(dailyRosters.unionId, unionId), dailyFit))
    .orderBy(desc(dailyRosters.readDay))
    .limit(1);
  if (!row) return [];
  const tag = row.tag ?? listed ?? String(unionId);
  return row.uids.map((uid, i) => ({ uid, name: row.names[i] ?? "", unionId, tag }));
}

export async function serverPlayers(db: Db): Promise<ServerPlayer[]> {
  // The tracked set of today (D133): an alliance that left it is no longer searched.
  const ids = await trackedAllianceIds(db);
  const labels = await allianceLabels(db, ids);
  const rosters = await Promise.all(
    ids.map((id) => newestRoster(db, id, labels.get(id)?.tag ?? null)),
  );
  return rosters.flat();
}
