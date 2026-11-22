// /admin's feature switches of one workspace, as its card shows them (D126, D134): its settings (its defaults
// until the owner changes one), which owner values differ from the defaults, what the alliance turned off,
// and the tracker calls its choices spend now. English only (D48).
import { copy } from "@/lib/copy";
import type { AdminFeatures } from "@/lib/queries/workspace-features";
import type { AdminWorkspace } from "@/lib/queries/workspaces";
import { fill } from "@/lib/words";
import {
  ALLOWANCES,
  defaultSettings,
  ESTIMATE_MEMBERS,
  FEATURES,
  resolveFeatures,
  trackerEstimate,
  type FeatureSettings,
} from "@/lib/workspace-features";

import type { FeaturesView } from "./WorkspaceFeatures";

/** A workspace always has settings: its stored overrides over the defaults, or the defaults alone. */
export const settingsFor = (all: AdminFeatures, w: AdminWorkspace): FeatureSettings =>
  all.settings.get(w.id)?.settings ?? defaultSettings(w.unionId, all.defaults);

export function featuresView(all: AdminFeatures, w: AdminWorkspace): FeaturesView {
  const settings = settingsFor(all, w);
  const row = all.settings.get(w.id);
  const used = all.usage.get(w.id) ?? { ai: 0, translate: 0 };
  const members = all.members.get(w.unionId) ?? ESTIMATE_MEMBERS;
  const on = resolveFeatures(settings, all.paused).on;
  const { daily, peak } = trackerEstimate(on, members);
  const f = copy.admin.features;
  const n = (x: number) => x.toLocaleString("en");
  return {
    off: settings.off,
    changed: FEATURES.filter((k) => row && k in row.stored.switches),
    allianceOff: settings.allianceOff,
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
