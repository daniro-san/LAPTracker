// Alliance settings → Features (D134, issue 476): the officers turn on or off, themselves, each feature the
// site's owner allows for their alliance. A feature the owner did not allow is not listed at all. Each one
// that spends tracker calls on the alliance's own key says about how many, from the newest roster's member
// count. D162: a feature the alliance's plan leaves out is not switchable either; it is listed with a calm
// "Premium" note instead, and the Plans page says what each plan covers. Every function takes a
// WorkspaceAccess, so the workspace comes from the session, never a request.
import { z } from "zod";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { POST_FEATURES } from "../post-catalog";
import { latestMemberCounts } from "../queries/rosters";
import { recordFailure } from "../repo/auth-attempts";
import { setAllianceSwitch, settingsById } from "../repo/workspace-features";
import { changesCommands, syncCommands, type CommandDeps } from "../workspace-commands";
import {
  allowed,
  ESTIMATE_MEMBERS,
  FEATURE_GROUPS,
  FEATURES,
  NEW_PLAN,
  TRACKER_CALLS,
  trackerEstimate,
  type Feature,
  type FeatureGroup,
  type PlanState,
} from "../workspace-features";
import type { WorkspaceAccess } from "./access";

/** At most this many switches an alliance changes in the window: far above a person tapping. */
export const SWITCHES = 60;
export const SWITCH_WINDOW_MS = 15 * 60_000;

/**
 * The features the alliance switches here: all but the catalog posts', whose alliance layer is the post's own
 * switch in Alliance settings → Posts (D159), off until officers turn it on.
 */
const SWITCHED_HERE = FEATURES.filter((f) => !POST_FEATURES.has(f));

export const allianceFeatureInput = z
  .object({ feature: z.enum(SWITCHED_HERE as [Feature, ...Feature[]]), on: z.boolean() })
  .strict();

/** One allowed feature as the officers see it, and the tracker calls it spends when on (null: none). */
export interface AllianceFeature {
  feature: Feature;
  on: boolean;
  calls: { n: number; weekly: boolean } | null;
}

export interface AllianceFeaturesView {
  /** `premium`: the group's features the alliance's plan leaves out (D162), shown with a "Premium" note. */
  groups: { group: FeatureGroup; features: AllianceFeature[]; premium: Feature[] }[];
  /** The tracker calls the features on now spend: every quota day, and on Saturdays (UTC). */
  estimate: { daily: number; peak: number };
  /** The members the estimate counts: the newest roster's, or an alliance's capacity before any read. */
  members: number;
}

/** The features the owner allows for the alliance, by group, each on or off as its officers set it. */
export async function allianceFeaturesView(
  db: Db,
  access: WorkspaceAccess,
): Promise<AllianceFeaturesView> {
  const [found, counts] = await Promise.all([
    settingsById(db, access.workspaceId),
    latestMemberCounts(db, [access.unionId]),
  ]);
  const members = counts.get(access.unionId) ?? ESTIMATE_MEMBERS;
  const switched = SWITCHED_HERE.filter((f) => found && allowed(found.settings, f));
  const locked = SWITCHED_HERE.filter((f) => found?.settings.locked.includes(f));
  const groups = (Object.keys(FEATURE_GROUPS) as FeatureGroup[])
    .map((group) => ({
      group,
      premium: FEATURE_GROUPS[group].filter((f) => locked.includes(f)),
      features: FEATURE_GROUPS[group]
        .filter((f) => switched.includes(f))
        .map((feature) => {
          const calls = TRACKER_CALLS[feature];
          return {
            feature,
            on: !found?.settings.allianceOff.includes(feature),
            calls: calls
              ? {
                  n: Math.ceil(members * calls.perMember) + (calls.perDay ?? 0),
                  weekly: calls.weekly,
                }
              : null,
          };
        }),
    }))
    .filter((g) => g.features.length + g.premium.length > 0);
  // The estimate counts what is on now (D126's served features: a paused allowance spends no tracker call).
  return { groups, estimate: trackerEstimate(access.features.on, members), members };
}

/**
 * The officers' switch. rate_limited: past SWITCHES in the window. not_allowed: the owner did not allow the
 * feature, or the plan leaves it out (D162; a stale page). Through: the alliance's switch as stored after the save. A Discord command's switch registers the alliance's commands again when its server
 * had them (D129), so a command turned off leaves the Apps menu.
 */
export async function setAllianceFeature(
  db: Db,
  access: WorkspaceAccess,
  input: z.infer<typeof allianceFeatureInput>,
  deps: CommandDeps,
): Promise<{ ok: true; on: boolean } | { ok: false; code: "rate_limited" | "not_allowed" }> {
  const tries = await recordFailure(
    db,
    `features:ws:${access.workspaceId}`,
    SWITCH_WINDOW_MS,
    deps.now,
  );
  if (tries > SWITCHES) return { ok: false, code: "rate_limited" };
  const found = await settingsById(db, access.workspaceId);
  if (!found || !allowed(found.settings, input.feature)) {
    return { ok: false, code: "not_allowed" };
  }
  await setAllianceSwitch(db, access.workspaceId, input.feature, input.on, deps.now);
  if (changesCommands({ action: "switch", feature: input.feature })) {
    await syncCommands(db, deps, { only: [access.workspaceId], registered: true });
  }
  // The switch as stored now, read back: what the page shows after the save.
  const saved = await settingsById(db, access.workspaceId);
  return { ok: true, on: !saved?.settings.allianceOff.includes(input.feature) };
}

/** D162: the alliance's plan, for its Plans page. `own`: the own alliance (OGs), which has everything. */
export async function alliancePlanView(
  db: Db,
  access: WorkspaceAccess,
): Promise<PlanState & { own: boolean }> {
  const found = await settingsById(db, access.workspaceId);
  return { ...(found?.plan ?? NEW_PLAN), own: access.unionId === OWN_ALLIANCE_ID };
}
