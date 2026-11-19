// workspace_features, workspace_usage and allowance_pauses (D126): each workspace's switches and daily caps,
// what it used of each allowance per UTC day, and the owner's global pauses. Counts only: nothing here says
// who asked or what was asked.
import { and, asc, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import { allowancePauses, workspaceFeatures, workspaceUsage } from "../schema-features";
import {
  ALLOWANCES,
  defaultSettings,
  knownFeatures,
  type Allowance,
  type FeatureSettings,
} from "../workspace-features";

/** A workspace's stored settings, or its defaults when the owner never changed any. */
export interface WorkspaceSettings {
  workspaceId: number;
  unionId: number;
  settings: FeatureSettings;
}

const COLUMNS = {
  workspaceId: workspaces.id,
  unionId: workspaces.unionId,
  off: workspaceFeatures.off,
  aiPerDay: workspaceFeatures.aiPerDay,
  translatePerDay: workspaceFeatures.translatePerDay,
};

type Row = {
  workspaceId: number;
  unionId: number;
  off: string[] | null;
  aiPerDay: number | null;
  translatePerDay: number | null;
};

function settingsOf(row: Row): WorkspaceSettings {
  const settings =
    row.off === null
      ? defaultSettings(row.unionId)
      : {
          off: knownFeatures(row.off),
          caps: { ai: row.aiPerDay, translate: row.translatePerDay },
        };
  return { workspaceId: row.workspaceId, unionId: row.unionId, settings };
}

const withSettings = (db: Db) =>
  db
    .select(COLUMNS)
    .from(workspaces)
    .leftJoin(workspaceFeatures, eq(workspaceFeatures.workspaceId, workspaces.id));

export async function settingsBySlug(db: Db, slug: string): Promise<WorkspaceSettings | null> {
  const [row] = await withSettings(db).where(eq(workspaces.slug, slug));
  return row ? settingsOf(row) : null;
}

export async function settingsById(db: Db, workspaceId: number): Promise<WorkspaceSettings | null> {
  const [row] = await withSettings(db).where(eq(workspaces.id, workspaceId));
  return row ? settingsOf(row) : null;
}

/** Every workspace's settings, for /admin and the squads read. */
export async function allSettings(db: Db): Promise<WorkspaceSettings[]> {
  const rows = await withSettings(db).orderBy(asc(workspaces.id));
  return rows.map(settingsOf);
}

/** The allowances the owner paused for every workspace. */
export async function pausedAllowances(db: Db): Promise<Allowance[]> {
  const rows = await db.select({ allowance: allowancePauses.allowance }).from(allowancePauses);
  return ALLOWANCES.filter((a) => rows.some((r) => r.allowance === a));
}

export async function saveSettings(
  db: Db,
  workspaceId: number,
  settings: FeatureSettings,
  now: Date,
): Promise<void> {
  const values = {
    off: [...settings.off],
    aiPerDay: settings.caps.ai,
    translatePerDay: settings.caps.translate,
    updatedAt: now,
  };
  await db
    .insert(workspaceFeatures)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({ target: workspaceFeatures.workspaceId, set: values });
}

/** Applies `change` to the workspace's settings (its defaults when it has none yet); false: no such workspace. */
export async function changeSettings(
  db: Db,
  workspaceId: number,
  change: (settings: FeatureSettings) => FeatureSettings,
  now: Date,
): Promise<boolean> {
  const found = await settingsById(db, workspaceId);
  if (!found) return false;
  await saveSettings(db, workspaceId, change(found.settings), now);
  return true;
}

export async function setPaused(
  db: Db,
  allowance: Allowance,
  paused: boolean,
  now: Date,
): Promise<void> {
  if (!paused) {
    await db.delete(allowancePauses).where(eq(allowancePauses.allowance, allowance));
    return;
  }
  await db.insert(allowancePauses).values({ allowance, pausedAt: now }).onConflictDoNothing();
}

/**
 * Counts `units` of an allowance for the workspace's UTC `day`, in one statement: the row is made or
 * incremented only while the day's total stays within `cap` (null: no cap). Postgres locks the row for the
 * update and checks the cap against its latest count, so concurrent requests at the boundary never pass it.
 * Returns the day's new total, or null when the cap would be passed (nothing is counted then).
 */
export async function spend(
  db: Db,
  workspaceId: number,
  allowance: Allowance,
  day: string,
  units: number,
  cap: number | null,
): Promise<number | null> {
  const within = (total: unknown) => sql`(${cap}::int is null or ${total} <= ${cap}::int)`;
  const result = await db.execute<{ used: number }>(sql`
    insert into ${workspaceUsage} (workspace_id, allowance, day, used)
    select ${workspaceId}, ${allowance}, ${day}::date, ${units}::int
    where ${within(sql`${units}::int`)}
    on conflict (workspace_id, allowance, day) do update
      set used = ${workspaceUsage}.used + excluded.used
      where ${within(sql`${workspaceUsage}.used + excluded.used`)}
    returning used`);
  const [row] = result.rows;
  return row ? Number(row.used) : null;
}

/**
 * Gives back `units` counted on `day` whose request failed (D126, owner 2026-11-19): one statement, never
 * below 0, so concurrent give-backs and counts stay exact.
 */
export async function giveBack(
  db: Db,
  workspaceId: number,
  allowance: Allowance,
  day: string,
  units: number,
): Promise<void> {
  await db
    .update(workspaceUsage)
    .set({ used: sql`greatest(${workspaceUsage.used} - ${units}, 0)` })
    .where(
      and(
        eq(workspaceUsage.workspaceId, workspaceId),
        eq(workspaceUsage.allowance, allowance),
        eq(workspaceUsage.day, day),
      ),
    );
}

/** Each workspace's use of each allowance on `day`, for /admin. */
export async function usageOn(
  db: Db,
  day: string,
): Promise<Map<number, Record<Allowance, number>>> {
  const rows = await db
    .select({
      workspaceId: workspaceUsage.workspaceId,
      allowance: workspaceUsage.allowance,
      used: workspaceUsage.used,
    })
    .from(workspaceUsage)
    .where(eq(workspaceUsage.day, day));
  const byWorkspace = new Map<number, Record<Allowance, number>>();
  for (const r of rows) {
    const counts = byWorkspace.get(r.workspaceId) ?? { ai: 0, translate: 0 };
    counts[r.allowance] = r.used;
    byWorkspace.set(r.workspaceId, counts);
  }
  return byWorkspace;
}
