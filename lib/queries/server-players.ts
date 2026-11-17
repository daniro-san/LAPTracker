// The server's known players (issue 321): every member of each tracked alliance's newest usable daily
// roster (D60), as uid, name and alliance tag. Public data: the member-history arrays only, never raw_json.
import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { ALLIANCES } from "../../config/alliances";
import type { Db } from "../db";
import { dailyRosters } from "../schema";

export interface ServerPlayer {
  uid: number;
  name: string;
  unionId: number;
  /** As the newest roster gives it, else the tracked list's tag. */
  tag: string;
}

export async function serverPlayers(db: Db): Promise<ServerPlayer[]> {
  const rows = await db
    .selectDistinctOn([dailyRosters.unionId], {
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      uids: dailyRosters.memberUids,
      names: dailyRosters.memberNames,
    })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.isFresh, true),
        isNull(dailyRosters.error),
        gt(dailyRosters.memberCount, 0),
      ),
    )
    .orderBy(dailyRosters.unionId, desc(dailyRosters.readDay));
  return rows.flatMap((r) => {
    const tag = r.tag ?? ALLIANCES.find((a) => a.unionId === r.unionId)?.tag ?? "";
    return r.uids.map((uid, i) => ({ uid, name: r.names[i] ?? "", unionId: r.unionId, tag }));
  });
}
