// app_errors table (plan §6): errors outside a run. The insert keeps the table at MAX_APP_ERRORS rows.
import { desc, lt, max } from "drizzle-orm";

import type { Db } from "../db";
import { appErrors } from "../schema";

export const MAX_APP_ERRORS = 500;

export interface AppErrorRow {
  at: Date;
  route: string;
  digest: string | null;
  message: string;
}

export async function insertAppError(db: Db, row: AppErrorRow): Promise<void> {
  await db.insert(appErrors).values(row);
  // INVARIANT app-errors.capped-500: everything older than the newest 500 rows goes.
  const [oldestKept] = await db
    .select({ id: appErrors.id })
    .from(appErrors)
    .orderBy(desc(appErrors.id))
    .offset(MAX_APP_ERRORS - 1)
    .limit(1);
  if (oldestKept) await db.delete(appErrors).where(lt(appErrors.id, oldestKept.id));
}

export async function lastAppErrorAt(db: Db): Promise<Date | null> {
  const [row] = await db.select({ at: max(appErrors.at) }).from(appErrors);
  return row?.at ?? null;
}
