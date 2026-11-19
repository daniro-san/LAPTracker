// Which app features each workspace has (D126): the owner turns them on or off per workspace on /admin, and
// caps the two that spend the owner's own limits. Pure and shared: /admin draws its switches from it,
// lib/private's `featureOn` and `useAllowance` resolve a workspace's settings with it, and the squads read
// (lib/workspace-keys.ts) skips a workspace whose squads read is off. Turning a feature off hides it and
// refuses its routes; nothing is deleted, so turning it on again shows everything as it was.
import { OWN_ALLIANCE_ID } from "../config/alliances";

/** The switches, in /admin's groups. */
export const FEATURE_GROUPS = {
  tabs: ["roll_call", "garrison", "thefts", "follow_up", "caravans", "notices", "board"],
  ai: ["notice_translate", "notice_improve", "notice_fit", "thanks_draft", "ocr"],
  discord: ["discord_send", "discord_translate_me", "discord_translate_everyone"],
  data: ["squads", "notice_pictures", "export"],
} as const;
export type FeatureGroup = keyof typeof FEATURE_GROUPS;
export type Feature = (typeof FEATURE_GROUPS)[FeatureGroup][number];
export const FEATURES: readonly Feature[] = Object.values(FEATURE_GROUPS).flat();

/** The daily allowances: Groq requests (D81) and Discord translations (D101), each capped per workspace. */
export const ALLOWANCES = ["ai", "translate"] as const;
export type Allowance = (typeof ALLOWANCES)[number];

/**
 * The paid features and the allowance each spends. A new workspace starts with them off; a global pause of
 * an allowance turns its features off in every workspace. The screenshot reader (`ocr`) runs on our own
 * server (D74), so it spends no allowance and is not paid.
 */
export const SPENDS: Partial<Record<Feature, Allowance>> = {
  notice_translate: "ai",
  notice_improve: "ai",
  notice_fit: "ai",
  thanks_draft: "ai",
  discord_translate_me: "translate",
  discord_translate_everyone: "translate",
};

/** What a workspace stores: the features turned off, and each allowance's daily cap (null: no cap). */
export interface FeatureSettings {
  off: readonly Feature[];
  caps: Record<Allowance, number | null>;
}

const NO_CAPS: FeatureSettings["caps"] = { ai: null, translate: null };

/**
 * A workspace's settings before the owner changes any: the own alliance (OGs) has everything on and no cap,
 * as before D126; any other starts with the free features on and the paid ones off.
 */
export function defaultSettings(unionId: number): FeatureSettings {
  if (unionId === OWN_ALLIANCE_ID) return { off: [], caps: NO_CAPS };
  return { off: FEATURES.filter((f) => SPENDS[f]), caps: NO_CAPS };
}

/** A workspace's features as served: which are on (its settings, less any globally paused allowance). */
export interface WorkspaceFeatures {
  on: ReadonlySet<Feature>;
  caps: FeatureSettings["caps"];
}

export function resolveFeatures(
  settings: FeatureSettings,
  paused: readonly Allowance[],
): WorkspaceFeatures {
  const on = FEATURES.filter((f) => {
    const spends = SPENDS[f];
    return !settings.off.includes(f) && !(spends && paused.includes(spends));
  });
  return { on: new Set(on), caps: settings.caps };
}

/** Notice pictures are shown, warned about and cleaned up only while both notices and pictures are on. */
export const picturesShown = (on: ReadonlySet<Feature>) =>
  on.has("notices") && on.has("notice_pictures");

/**
 * A workspace's settings from its stored switches (null: no row yet). A feature with no stored key (one
 * added to the catalog after the owner's last change) keeps the workspace's default, so a new paid feature
 * starts off for every workspace but the own alliance; a stored key no longer in the catalog is ignored.
 */
export function storedSettings(
  unionId: number,
  switches: Readonly<Record<string, boolean>> | null,
  caps: FeatureSettings["caps"],
): FeatureSettings {
  const defaults = defaultSettings(unionId);
  if (switches === null) return defaults;
  const isOff = (f: Feature) => (f in switches ? switches[f] === false : defaults.off.includes(f));
  return { off: FEATURES.filter(isOff), caps };
}

/** Every catalog switch of `settings`, on or off: what "Copy settings from" stores. */
export const switchMap = (settings: FeatureSettings): Record<string, boolean> =>
  Object.fromEntries(FEATURES.map((f) => [f, !settings.off.includes(f)]));

/** The UTC day a count belongs to: every allowance starts again at 00:00 UTC. */
export const usageDay = (now: Date): string => now.toISOString().slice(0, 10);
