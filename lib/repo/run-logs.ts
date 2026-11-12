// run_logs table. Written only by lib/logger.ts, one INSERT per line.
import type { Db } from "../db";
import { runLogs } from "../schema";

/** A line belongs to a snapshot run or to a daily roster read (D60), never both. */
export interface RunLogLine {
  snapshotId: number | null;
  readDay?: string | null;
  at: Date;
  level: "info" | "warn" | "error";
  code: string;
  unionId: number | null;
  data: unknown;
}

export async function insertRunLog(db: Db, line: RunLogLine): Promise<void> {
  await db.insert(runLogs).values(line);
}
