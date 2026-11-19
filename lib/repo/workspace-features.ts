// workspace_features, workspace_usage and allowance_pauses (D126): each workspace's switches and daily caps,
// what it used of each allowance per UTC day, and the owner's global pauses. Counts only: nothing here says
// who asked or what was asked. Every change the owner makes is one statement, so quick taps on /admin
// never undo each other.
import { and, asc, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import { allowancePauses, workspaceFeatures, workspaceUsage } from "../schema-features";
import { noticePictures } from "../schema-notices";
import {
  ALLOWANCES,
  storedSettings,
  switchMap,
  type Allowance,
  type Feature,
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
  switches: workspaceFeatures.switches,
  aiPerDay: workspaceFeatures.aiPerDay,
  translatePerDay: workspaceFeatures.translatePerDay,
};

type Row = {
  workspaceId: number;
  unionId: number;
  switches: Record<string, boolean> | null;
  aiPerDay: number | null;
  translatePerDay: number | null;
};

const settingsOf = (row: Row): WorkspaceSettings => ({
  workspaceId: row.workspaceId,
  unionId: row.unionId,
  settings: storedSettings(row.unionId, row.switches, {
    ai: row.aiPerDay,
    translate: row.translatePerDay,
  }),
});

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

/** Every workspace's settings, for /admin, the squads read and the picture cleanup. */
export async function allSettings(db: Db): Promise<WorkspaceSettings[]> {
  const rows = await withSettings(db).orderBy(asc(workspaces.id));
  return rows.map(settingsOf);
}

/** The allowances the owner paused for every workspace. */
export async function pausedAllowances(db: Db): Promise<Allowance[]> {
  const rows = await db.select({ allowance: allowancePauses.allowance }).from(allowancePauses);
  return ALLOWANCES.filter((a) => rows.some((r) => r.allowance === a));
}

/**
 * Upserts the workspace's row in one statement: `insert` holds the new row (only for a workspace that
 * exists), `update` what changes on a row already there. False: no such workspace.
 */
async function upsert(
  db: Db,
  workspaceId: number,
  insert: { switches: unknown; ai?: unknown; translate?: unknown },
  update: unknown,
  now: Date,
): Promise<boolean> {
  const result = await db.execute<{ workspace_id: number }>(sql`
    insert into ${workspaceFeatures} (workspace_id, switches, ai_per_day, translate_per_day, updated_at)
    select id, ${insert.switches}, ${insert.ai ?? sql`null`}, ${insert.translate ?? sql`null`},
      ${now.toISOString()}::timestamptz
    from ${workspaces} where id = ${workspaceId}
    on conflict (workspace_id) do update set ${update}, updated_at = excluded.updated_at
    returning workspace_id`);
  return result.rows.length > 0;
}

/** D119's warnings start again from nothing when notices or their pictures are switched (D126). */
async function restartPictureWarnings(db: Db, workspaceId: number): Promise<void> {
  await db
    .update(noticePictures)
    .set({ warnedAt: null })
    .where(eq(noticePictures.workspaceId, workspaceId));
}

/** One switch on or off: that key alone changes; the others keep what they were, or their defaults. */
export async function setSwitch(
  db: Db,
  workspaceId: number,
  feature: Feature,
  on: boolean,
  now: Date,
): Promise<boolean> {
  const value = sql`jsonb_build_object(${feature}::text, ${on}::boolean)`;
  const done = await upsert(
    db,
    workspaceId,
    { switches: value },
    sql`switches = ${workspaceFeatures}.switches || excluded.switches`,
    now,
  );
  if (done && (feature === "notices" || feature === "notice_pictures")) {
    await restartPictureWarnings(db, workspaceId);
  }
  return done;
}

/** One daily cap (null: no cap); the switches are left as they are. */
export async function setCap(
  db: Db,
  workspaceId: number,
  allowance: Allowance,
  cap: number | null,
  now: Date,
): Promise<boolean> {
  const column = sql.raw(allowance === "ai" ? "ai_per_day" : "translate_per_day");
  const value = sql`${cap}::int`;
  return upsert(
    db,
    workspaceId,
    { switches: sql`'{}'::jsonb`, [allowance]: value },
    sql`${column} = excluded.${column}`,
    now,
  );
}

/** "Copy settings from": every catalog switch and both caps of `settings`, as served. */
export async function copySettings(
  db: Db,
  workspaceId: number,
  settings: FeatureSettings,
  now: Date,
): Promise<boolean> {
  const values = {
    switches: sql`${JSON.stringify(switchMap(settings))}::jsonb`,
    ai: sql`${settings.caps.ai}::int`,
    translate: sql`${settings.caps.translate}::int`,
  };
  const done = await upsert(
    db,
    workspaceId,
    values,
    sql`switches = excluded.switches, ai_per_day = excluded.ai_per_day,
      translate_per_day = excluded.translate_per_day`,
    now,
  );
  if (done) await restartPictureWarnings(db, workspaceId);
  return done;
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
