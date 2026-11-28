// workspace_features, feature_defaults, workspace_usage and allowance_pauses (D126, D134): each workspace's
// overrides (the owner's switches and caps, and its officers' own switches), the defaults for new alliances,
// what each workspace used of each allowance per UTC day, and the owner's global pauses. Counts only:
// nothing here says who asked or what was asked. Every change is one statement, so quick taps never undo
// each other.
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { workspaces } from "../schema";
import {
  allowancePauses,
  featureDefaults,
  workspaceFeatures,
  workspaceUsage,
} from "../schema-features";
import { noticePictures } from "../schema-notices";
import {
  ALLOWANCES,
  NO_DEFAULTS,
  ownerDefaults,
  storedSettings,
  type Allowance,
  type Feature,
  type FeatureSettings,
  type OwnerSettings,
  type Plan,
  type PlanState,
  type StoredDefaults,
  type StoredOverrides,
} from "../workspace-features";

/**
 * A workspace's settings as served (its overrides over the defaults), with the owner's defaults for it and
 * its stored overrides, so /admin can say "Default (on)" or "Changed: off" (D134).
 */
export interface WorkspaceSettings {
  workspaceId: number;
  slug: string;
  unionId: number;
  settings: FeatureSettings;
  defaults: OwnerSettings;
  stored: StoredOverrides;
  /** D162: its plan, set by the owner on /admin. */
  plan: PlanState;
}

const COLUMNS = {
  workspaceId: workspaces.id,
  slug: workspaces.slug,
  unionId: workspaces.unionId,
  plan: workspaces.plan,
  grandfathered: workspaces.planGrandfathered,
  switches: workspaceFeatures.switches,
  caps: workspaceFeatures.caps,
  alliance: workspaceFeatures.allianceSwitches,
  defaultSwitches: featureDefaults.switches,
  defaultCaps: featureDefaults.caps,
};

type Row = {
  workspaceId: number;
  slug: string;
  unionId: number;
  plan: Plan;
  grandfathered: boolean;
  switches: Record<string, boolean> | null;
  caps: StoredDefaults["caps"] | null;
  alliance: Record<string, boolean> | null;
  defaultSwitches: Record<string, boolean> | null;
  defaultCaps: StoredDefaults["caps"] | null;
};

const settingsOf = (row: Row): WorkspaceSettings => {
  const defaults = { switches: row.defaultSwitches ?? {}, caps: row.defaultCaps ?? {} };
  const stored = {
    switches: row.switches ?? {},
    caps: row.caps ?? {},
    alliance: row.alliance ?? {},
  };
  const plan = { plan: row.plan, grandfathered: row.grandfathered };
  return {
    workspaceId: row.workspaceId,
    slug: row.slug,
    unionId: row.unionId,
    settings: storedSettings(row.unionId, stored, defaults, plan),
    defaults: ownerDefaults(row.unionId, defaults),
    stored,
    plan,
  };
};

// The defaults row (one at most) joins every workspace, so a read stays one query.
const withSettings = (db: Db) =>
  db
    .select(COLUMNS)
    .from(workspaces)
    .leftJoin(workspaceFeatures, eq(workspaceFeatures.workspaceId, workspaces.id))
    .leftJoin(featureDefaults, sql`true`);

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

/** /admin's "Defaults for new alliances" as stored: only the values the owner set. */
export async function storedDefaults(db: Db): Promise<StoredDefaults> {
  const [row] = await db
    .select({ switches: featureDefaults.switches, caps: featureDefaults.caps })
    .from(featureDefaults);
  return row ?? NO_DEFAULTS;
}

/** The allowances the owner paused for every workspace. */
export async function pausedAllowances(db: Db): Promise<Allowance[]> {
  const rows = await db.select({ allowance: allowancePauses.allowance }).from(allowancePauses);
  return ALLOWANCES.filter((a) => rows.some((r) => r.allowance === a));
}

type MapColumn = "switches" | "caps" | "alliance_switches";

/**
 * Changes one key of one map of the workspace's row, in one statement (D126): `{set}` merges the value in,
 * "reset" takes the key out, so it follows the defaults again. The row is made for a workspace that exists.
 * False: no such workspace.
 */
async function changeKey(
  db: Db,
  workspaceId: number,
  column: MapColumn,
  key: string,
  value: { set: boolean | number | null } | "reset",
  now: Date,
): Promise<boolean> {
  const col = sql.raw(column);
  const entry =
    value === "reset"
      ? sql`'{}'::jsonb`
      : sql`jsonb_build_object(${key}::text, ${JSON.stringify(value.set)}::jsonb)`;
  const update =
    value === "reset"
      ? sql`${col} = ${workspaceFeatures}.${col} - ${key}::text`
      : sql`${col} = ${workspaceFeatures}.${col} || excluded.${col}`;
  // `switches` has no default: a new row made by another map starts it empty.
  const switches = column === "switches" ? sql`` : sql`, switches`;
  const empty = column === "switches" ? sql`` : sql`, '{}'::jsonb`;
  const result = await db.execute<{ workspace_id: number }>(sql`
    insert into ${workspaceFeatures} (workspace_id, ${col}${switches}, updated_at)
    select id, ${entry}${empty}, ${now.toISOString()}::timestamptz
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

const picturesSwitch = (f: Feature) => f === "notices" || f === "notice_pictures";

/**
 * The owner allows a feature or not (`on`), or `null`: back to the default (D134). That key alone changes;
 * the others keep what they were, or their defaults.
 */
export async function setSwitch(
  db: Db,
  workspaceId: number,
  feature: Feature,
  on: boolean | null,
  now: Date,
): Promise<boolean> {
  const value = on === null ? "reset" : { set: on };
  const done = await changeKey(db, workspaceId, "switches", feature, value, now);
  if (done && picturesSwitch(feature)) await restartPictureWarnings(db, workspaceId);
  return done;
}

/** One daily cap (a number, or null for no cap), or "reset": back to the default (D134). */
export async function setCap(
  db: Db,
  workspaceId: number,
  allowance: Allowance,
  cap: number | null | "reset",
  now: Date,
): Promise<boolean> {
  const value = cap === "reset" ? "reset" : { set: cap };
  return changeKey(db, workspaceId, "caps", allowance, value, now);
}

/** The alliance's officers turn an allowed feature on or off in Alliance settings (D134). */
export async function setAllianceSwitch(
  db: Db,
  workspaceId: number,
  feature: Feature,
  on: boolean,
  now: Date,
): Promise<boolean> {
  const done = await changeKey(db, workspaceId, "alliance_switches", feature, { set: on }, now);
  if (done && picturesSwitch(feature)) await restartPictureWarnings(db, workspaceId);
  return done;
}

/**
 * D162: the owner sets a workspace's plan and whether it is grandfathered, in one statement. Nothing else
 * changes: every switch stays stored, so a feature the plan leaves out comes back as it was. False: no such
 * workspace.
 */
export async function setPlan(db: Db, workspaceId: number, state: PlanState): Promise<boolean> {
  const rows = await db
    .update(workspaces)
    .set({ plan: state.plan, planGrandfathered: state.grandfathered })
    .where(eq(workspaces.id, workspaceId))
    .returning({ id: workspaces.id });
  return rows.length > 0;
}

/**
 * "Copy settings from": the owner's switches and caps replaced by `overrides` (what differs from the
 * target's own defaults, workspace-features.ts `copiedOverrides`). The alliance's own switches stay.
 */
export async function copySettings(
  db: Db,
  workspaceId: number,
  overrides: StoredDefaults,
  now: Date,
): Promise<boolean> {
  const switches = sql`${JSON.stringify(overrides.switches)}::jsonb`;
  const caps = sql`${JSON.stringify(overrides.caps)}::jsonb`;
  const result = await db.execute<{ workspace_id: number }>(sql`
    insert into ${workspaceFeatures} (workspace_id, switches, caps, updated_at)
    select id, ${switches}, ${caps}, ${now.toISOString()}::timestamptz
    from ${workspaces} where id = ${workspaceId}
    on conflict (workspace_id) do update
      set switches = excluded.switches, caps = excluded.caps, updated_at = excluded.updated_at
    returning workspace_id`);
  const done = result.rows.length > 0;
  if (done) await restartPictureWarnings(db, workspaceId);
  return done;
}

/**
 * One default for new alliances (D134): a switch (allowed or not) or a cap (a number, or null for no cap).
 * Every workspace with no value of its own for that key follows it at once; the others keep theirs.
 */
export async function setDefault(
  db: Db,
  column: "switches" | "caps",
  key: string,
  value: boolean | number | null,
  now: Date,
): Promise<void> {
  const col = sql.raw(column);
  const entry = sql`jsonb_build_object(${key}::text, ${JSON.stringify(value)}::jsonb)`;
  await db.execute(sql`
    insert into ${featureDefaults} (id, ${col}, updated_at)
    values (1, ${entry}, ${now.toISOString()}::timestamptz)
    on conflict (id) do update
      set ${col} = ${featureDefaults}.${col} || excluded.${col}, updated_at = excluded.updated_at`);
  if (column === "switches" && picturesSwitch(key as Feature)) {
    await restartFollowersWarnings(db, key);
  }
}

/**
 * D119's warnings start again in every workspace that follows the default for `key` (notices or notice
 * pictures), as when the owner switches one workspace (D126): every one but the own alliance, which ignores
 * the defaults, and those with a value of their own.
 */
async function restartFollowersWarnings(db: Db, key: string): Promise<void> {
  const followers = db
    .select({ id: workspaces.id })
    .from(workspaces)
    .leftJoin(workspaceFeatures, eq(workspaceFeatures.workspaceId, workspaces.id))
    .where(
      and(
        ne(workspaces.unionId, OWN_ALLIANCE_ID),
        sql`not coalesce(jsonb_exists(${workspaceFeatures.switches}, ${key}::text), false)`,
      ),
    );
  await db
    .update(noticePictures)
    .set({ warnedAt: null })
    .where(inArray(noticePictures.workspaceId, followers));
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
