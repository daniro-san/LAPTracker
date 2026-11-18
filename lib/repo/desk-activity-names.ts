// Home's recent activity (D108): the names of the members its lines are about, read once per page.
import { and, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "../db";
import { dailyRosters, pendingMembers } from "../schema";
import { usable } from "./workspace-rosters";

/**
 * The names of these members: from the alliance's newest usable roster, and for a new member added by
 * hand (a negative uid, D106) from that record. A uid found in neither has no name.
 */
export async function memberNames(
  db: Db,
  workspaceId: number,
  unionId: number,
  uids: number[],
): Promise<Map<number, string>> {
  const pendingIds = uids.filter((u) => u < 0).map((u) => -u);
  const [[roster], pending] = await Promise.all([
    db
      .select({ uids: dailyRosters.memberUids, names: dailyRosters.memberNames })
      .from(dailyRosters)
      .where(usable(unionId))
      .orderBy(desc(dailyRosters.readDay))
      .limit(1),
    pendingIds.length === 0
      ? []
      : db
          .select({ id: pendingMembers.id, name: pendingMembers.name })
          .from(pendingMembers)
          .where(
            and(
              eq(pendingMembers.workspaceId, workspaceId),
              inArray(pendingMembers.id, pendingIds),
            ),
          ),
  ]);
  const wanted = new Set(uids);
  const names = new Map<number, string>();
  roster?.uids.forEach((uid, i) => {
    if (wanted.has(uid) && roster.names[i]) names.set(uid, roster.names[i]);
  });
  for (const p of pending) names.set(-p.id, p.name);
  return names;
}
