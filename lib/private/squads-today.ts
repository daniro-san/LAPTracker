// Today's squads read for the desk's Alliance settings (D132, issue 472): how far this workspace's queue
// got in the current quota day, counts only, and why it stopped when it did. The workspace comes from the
// session (`access.unionId`).
import type { Db } from "../db";
import type { Env } from "../env";
import { queueCounts } from "../repo/squad-queue";
import { getSquadRead } from "../repo/squads";
import { quotaDayRead } from "../schedule";
import { stopKind } from "../squads";
import type { WorkspaceAccess } from "./access";

export interface SquadsToday {
  /** False before the day's first batch: no queue yet. */
  started: boolean;
  read: number;
  members: number;
  retrying: number;
  /** When the next waiting member's turn comes, when it is later than `now`; null once the day stopped. */
  nextAt: Date | null;
  /** Why nobody more is read today: the key was refused, the limit is reached, or the day's cap. */
  stopped: ReturnType<typeof stopKind>;
}

export async function squadsToday(
  db: Db,
  access: Pick<WorkspaceAccess, "unionId">,
  env: Pick<Env, "SERVER_TZ" | "DAILY_ROSTER_AT">,
  now: Date,
): Promise<SquadsToday> {
  const day = quotaDayRead(now, env);
  const [[q], row] = await Promise.all([
    queueCounts(db, day, now, access.unionId),
    getSquadRead(db, day, access.unionId),
  ]);
  const over = row?.status === "stopped" || row?.status === "skipped";
  const stopped = over ? stopKind(row.reason) : null;
  if (!q) return { started: false, read: 0, members: 0, retrying: 0, nextAt: null, stopped };
  return {
    started: true,
    read: q.done,
    members: q.members,
    retrying: q.retrying,
    nextAt: over ? null : q.nextAt,
    stopped,
  };
}
