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
  /** D61: AppErrorDetail (lib/app-errors.ts), already redacted. */
  detail?: unknown;
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

/** app_alerts ids: one row per kind of alert (D45). */
export const APP_ERROR_ALERT = 1;
export const TICK_SILENCE_ALERT = 2;

/**
 * Claims alert `id`: true for exactly one caller, and only when that alert last went out at least
 * gapMs before now (or never). One statement, so two instances cannot both win.
 */
export async function claimAlert(db: Db, id: number, now: Date, gapMs: number): Promise<boolean> {
  const rows = await db
    .insert(appAlerts)
    .values({ id, alertedAt: now })
    .onConflictDoUpdate({
      target: appAlerts.id,
      set: { alertedAt: now },
      setWhere: lte(appAlerts.alertedAt, new Date(now.getTime() - gapMs)),
    })
    .returning({ id: appAlerts.id });
  return rows.length > 0;
}

export function claimAppErrorAlert(db: Db, now: Date, gapMs: number): Promise<boolean> {
  // INVARIANT app-errors.alert-hourly
  return claimAlert(db, APP_ERROR_ALERT, now, gapMs);
}
