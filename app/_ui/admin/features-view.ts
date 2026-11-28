// /admin's feature switches of one workspace, as its card shows them (D126, D134): its settings (its defaults
// until the owner changes one), which owner values differ from the defaults, what the alliance turned off,
// the tracker calls its choices spend now, and its plan (D160) with the features it leaves out. English
// only (D48).
import { OWN_ALLIANCE_ID } from "@/config/alliances";
import { copy } from "@/lib/copy";
import type { AdminFeatures } from "@/lib/queries/workspace-features";
import type { AdminWorkspace } from "@/lib/queries/workspaces";
import { fill } from "@/lib/words";
import {
  ALLOWANCES,
  defaultSettings,
  ESTIMATE_MEMBERS,
  FEATURES,
  NEW_PLAN,
  resolveFeatures,
  trackerEstimate,
  type FeatureSettings,
  type PlanState,
} from "@/lib/workspace-features";

import type { FeaturesView } from "./WorkspaceFeatures";

/** A workspace always has settings: its stored overrides over the defaults, or the defaults alone. */
export const settingsFor = (all: AdminFeatures, w: AdminWorkspace): FeatureSettings =>
  all.settings.get(w.id)?.settings ?? defaultSettings(w.unionId, all.defaults, NEW_PLAN);

/** "Plan: Free · grandfathered (keeps what it had)" (D160); OGs has everything whatever its plan. */
function planLine(unionId: number, state: PlanState): string {
  const t = copy.admin.features.plan;
  if (unionId === OWN_ALLIANCE_ID) return t.own;
  const line = fill(t.line, { plan: t.names[state.plan] });
  return state.grandfathered ? `${line} · ${t.grandfathered}` : line;
}

export function featuresView(all: AdminFeatures, w: AdminWorkspace): FeaturesView {
  const settings = settingsFor(all, w);
  const row = all.settings.get(w.id);
  const used = all.usage.get(w.id) ?? { ai: 0, translate: 0 };
  const members = all.members.get(w.unionId) ?? ESTIMATE_MEMBERS;
  const on = resolveFeatures(settings, all.paused).on;
  const { daily, peak } = trackerEstimate(on, members);
  const f = copy.admin.features;
  const n = (x: number) => x.toLocaleString("en");
  const plan = row?.plan ?? NEW_PLAN;
  return {
    off: settings.off,
    changed: FEATURES.filter((k) => row && k in row.stored.switches),
    allianceOff: settings.allianceOff,
    locked: settings.locked,
    plan,
    planLine: planLine(w.unionId, plan),
    on: on.size,
    caps: settings.caps,
    defaultOff: row?.defaults.off ?? settings.off,
    defaultCaps: row?.defaults.caps ?? settings.caps,
    changedCaps: ALLOWANCES.filter((a) => row && a in row.stored.caps),
    used,
    estimate: fill(peak > daily ? f.estimatePeak : f.estimate, {
      daily: n(daily),
      peak: n(peak),
      members: n(members),
    }),
  };
}
