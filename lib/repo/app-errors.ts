// app_errors table (plan §6): errors outside a run. The insert keeps the table at MAX_APP_ERRORS rows.
import { desc, lt, lte } from "drizzle-orm";

import type { Db } from "../db";
import { appAlerts, appErrors } from "../schema";

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

/**
 * Claims the app-error alert: true for exactly one caller, and only when the last alert is at
 * least gapMs before now (or there has been none). One statement, so two instances cannot both win.
 */
export async function claimAppErrorAlert(db: Db, now: Date, gapMs: number): Promise<boolean> {
  // INVARIANT app-errors.alert-hourly
  const rows = await db
    .insert(appAlerts)
    .values({ id: 1, alertedAt: now })
    .onConflictDoUpdate({
      target: appAlerts.id,
      set: { alertedAt: now },
      setWhere: lte(appAlerts.alertedAt, new Date(now.getTime() - gapMs)),
    })
    .returning({ id: appAlerts.id });
  return rows.length > 0;
}
