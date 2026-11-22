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
  /** The workspace's slug under /w/[slug] (D144); null or absent elsewhere. */
  workspaceSlug?: string | null;
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

/** How long a row is kept (D115's 2026-11-21 amendment): its detail holds the error's own text. */
export const APP_ERROR_DAYS = 30;

/**
 * INVARIANT app-errors.purged-30-days: deletes the rows recorded more than 30 days before `now`, through
 * app_errors_at_idx (at most MAX_APP_ERRORS rows exist). Returns how many went. Run once a day by the tick.
 */
export async function purgeOldAppErrors(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime() - APP_ERROR_DAYS * 86_400_000);
  const gone = await db
    .delete(appErrors)
    .where(lt(appErrors.at, before))
    .returning({ id: appErrors.id });
  return gone.length;
}

/** app_alerts ids: one row per kind of alert (D45). Id 1 was the app-error alert, retired in favour of PostHog's (D115). */
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
