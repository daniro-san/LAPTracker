// /admin's feature switches (D126, D134): each workspace's settings (its overrides over the defaults), the
// defaults for new alliances, today's use of each allowance, the global pauses, and each alliance's member
// count for the tracker-call estimate. Owner only (PIN); counts only.
import type { Db } from "../db";
import {
  allSettings,
  pausedAllowances,
  storedDefaults,
  usageOn,
  type WorkspaceSettings,
} from "../repo/workspace-features";
import { usageDay, type Allowance, type StoredDefaults } from "../workspace-features";
import { latestMemberCounts } from "./rosters";

export type { WorkspaceSettings };

export interface AdminFeatures {
  settings: Map<number, WorkspaceSettings>;
  defaults: StoredDefaults;
  /** Today's (UTC) use of each allowance, by workspace id; a workspace that used none is absent. */
  usage: Map<number, Record<Allowance, number>>;
  paused: Allowance[];
  /** Members by alliance (union id), from the newest daily read; an alliance never read is absent. */
  members: Map<number, number>;
}

export async function adminFeatures(db: Db, now: Date): Promise<AdminFeatures> {
  const [all, defaults, usage, paused] = await Promise.all([
    allSettings(db),
    storedDefaults(db),
    usageOn(db, usageDay(now)),
    pausedAllowances(db),
  ]);
  const members = await latestMemberCounts(
    db,
    all.map((w) => w.unionId),
  );
  return {
    settings: new Map(all.map((w) => [w.workspaceId, w])),
    defaults,
    usage,
    paused,
    members,
  };
}
