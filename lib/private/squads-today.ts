// Today's squads read for the desk's Alliance settings and read status bar (D132, issue 472; D135, issue
// 478): how far this workspace's queue got in the current quota day, counts only, and why it stopped when it
// did. The workspace comes from the session (`access.unionId`).
import type { Db } from "../db";
import type { Env } from "../env";
import { queueCounts } from "../repo/squad-queue";
import { getSquadRead } from "../repo/squads";
import { keyFacts, type KeyFacts } from "../repo/workspace-keys";
import { quotaDayRead } from "../schedule";
import type { squadReads } from "../schema-squads";
import { stopKind } from "../squads";
import { squadsKey } from "../workspace-keys";
import type { WorkspaceAccess } from "./access";
import { featureOn } from "./features";

export interface SquadsToday {
  /** False before the day's first batch: no queue yet. */
  started: boolean;
  read: number;
  members: number;
  retrying: number;
  /** Members not read today: 3 attempts without an answer, or a failure not tried again. */
  failed: number;
  /** Waiting members whose turn has come. */
  dueNow: number;
  /** When the next waiting member's turn comes, when it is later than `now`; null once the day stopped. */
  nextAt: Date | null;
  /** Why nobody more is read today: the key was refused, the limit is reached, or the day's cap. */
  stopped: ReturnType<typeof stopKind>;
  /** The day's row: its state, when it started and ended, and its reason code; null before the first batch. */
  day: Pick<
    typeof squadReads.$inferSelect,
    "status" | "startedAt" | "finishedAt" | "reason"
  > | null;
}

type Reader = Pick<WorkspaceAccess, "unionId" | "features">;

/**
 * Whose key reads this workspace's squads today, from its key's stored facts, or null when they are not
 * read: the feature is off (D126, D134) or no key reads them now (`squadsKey`, the squads read's own rule).
 */
export function squadsReaderOf(
  access: Reader,
  facts: KeyFacts,
  secret: string | undefined,
  now: Date,
): "site" | "own" | null {
  if (!featureOn(access, "squads")) return null;
  return squadsKey({ ...facts, unionId: access.unionId }, secret, now);
}

/** The same, reading the key's facts. */
export async function squadsReader(
  db: Db,
  access: Reader & Pick<WorkspaceAccess, "workspaceId">,
  env: Pick<Env, "WORKSPACE_KEYS_SECRET">,
  now: Date,
): Promise<"site" | "own" | null> {
  const facts = await keyFacts(db, access.workspaceId);
  return squadsReaderOf(access, facts, env.WORKSPACE_KEYS_SECRET, now);
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
  const dayRow = row
    ? {
        status: row.status,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        reason: row.reason,
      }
    : null;
  const base = { stopped, day: dayRow };
  if (!q) {
    const none = { read: 0, members: 0, retrying: 0, failed: 0, dueNow: 0, nextAt: null };
    return { ...base, ...none, started: false };
  }
  return {
    ...base,
    started: true,
    read: q.done,
    members: q.members,
    retrying: q.retrying,
    failed: q.failed,
    dueNow: q.dueNow,
    nextAt: over ? null : q.nextAt,
  };
}
