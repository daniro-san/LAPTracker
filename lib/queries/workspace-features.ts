// /admin's feature switches (D126): each workspace's settings (its defaults until the owner changes one),
// today's use of each allowance, and the global pauses. Owner only (PIN); counts only.
import type { Db } from "../db";
import { allSettings, pausedAllowances, usageOn } from "../repo/workspace-features";
import { usageDay, type Allowance, type FeatureSettings } from "../workspace-features";

export interface AdminFeatures {
  settings: Map<number, FeatureSettings>;
  /** Today's (UTC) use of each allowance, by workspace id; a workspace that used none is absent. */
  usage: Map<number, Record<Allowance, number>>;
  paused: Allowance[];
}

export async function adminFeatures(db: Db, now: Date): Promise<AdminFeatures> {
  const [all, usage, paused] = await Promise.all([
    allSettings(db),
    usageOn(db, usageDay(now)),
    pausedAllowances(db),
  ]);
  return { settings: new Map(all.map((w) => [w.workspaceId, w.settings])), usage, paused };
}
