// Today's squads read for the desk's Alliance settings (D132, issue 472): how far this workspace's queue
// got in the current quota day, counts only. The workspace comes from the session (`access.unionId`).
import type { Db } from "../db";
import type { Env } from "../env";
import { queueCounts } from "../repo/squad-queue";
import { quotaDayRead } from "../schedule";
import type { WorkspaceAccess } from "./access";

export interface SquadsToday {
  /** False before the day's first batch: no queue yet. */
  started: boolean;
  read: number;
  members: number;
  retrying: number;
  /** When the next waiting member's turn comes, when it is later than `now`. */
  nextAt: Date | null;
}

export async function squadsToday(
  db: Db,
  access: Pick<WorkspaceAccess, "unionId">,
  env: Pick<Env, "SERVER_TZ" | "DAILY_ROSTER_AT">,
  now: Date,
): Promise<SquadsToday> {
  const [q] = await queueCounts(db, quotaDayRead(now, env), now, access.unionId);
  if (!q) return { started: false, read: 0, members: 0, retrying: 0, nextAt: null };
  return {
    started: true,
    read: q.done,
    members: q.members,
    retrying: q.retrying,
    nextAt: q.nextAt,
  };
}
