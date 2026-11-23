// Which app features each workspace has (D126): the owner turns them on or off per workspace on /admin, and
// caps the two that spend the owner's own limits. Pure and shared: /admin draws its switches from it,
// lib/private's `featureOn` and `useAllowance` resolve a workspace's settings with it, and the squads read
// (lib/workspace-keys.ts) skips a workspace whose squads read is off. Turning a feature off hides it and
// refuses its routes; nothing is deleted, so turning it on again shows everything as it was. D134: two
// layers, the owner allows and the alliance turns on, over /admin's "Defaults for new alliances".
import { OWN_ALLIANCE_ID } from "../config/alliances";

/** The switches, in /admin's groups. */
export const FEATURE_GROUPS = {
  tabs: [
    "roll_call",
    "garrison",
    "thefts",
    "follow_up",
    "insights",
    "caravans",
    "notices",
    "board",
  ],
  ai: ["notice_translate", "notice_improve", "notice_fit", "thanks_draft", "ocr"],
  // D156: the alliance's own line on our posts (#713). D159: each catalog post's owner layer (`post_*`);
  // the alliance's layer is the post's own switch in Alliance settings → Posts, not the Features card.
  discord: [
    "discord_send",
    "discord_translate_me",
    "discord_translate_everyone",
    "post_callouts",
    "post_week",
    "post_shield_up",
    "post_welcome",
    "post_summary",
    "post_kvk",
  ],
  data: ["squads", "shield_check", "notice_pictures", "export"],
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

/**
 * The features that spend tracker calls on the alliance's own key (D124, D134): each one's calls per member,
 * measured, and whether it runs every quota day or once a week. Squads: 106–107 calls for 101 members in the
 * read of 2026-11-18 (one per member plus about 5 % retries, D132). Raid Shield check (issue 474, D137): two
 * reads of every member, Friday 23:30 ST and Saturday morning, both in Saturday's UTC quota day; with the
 * squads read on, Friday's read is that day's squads read, so only the morning read is extra.
 */
export const TRACKER_CALLS: Partial<Record<Feature, { perMember: number; weekly: boolean }>> = {
  squads: { perMember: 1.06, weekly: false },
  shield_check: { perMember: 2, weekly: true },
};

/** The members an estimate assumes when no roster was read yet: an alliance's capacity. */
export const ESTIMATE_MEMBERS = 100;

/**
 * About how many tracker calls the features `on` spend: `daily` on every quota day, `peak` on the day a
 * weekly one runs as well (Saturday UTC).
 */
export function trackerEstimate(
  on: ReadonlySet<Feature>,
  members: number,
): { daily: number; peak: number } {
  let daily = 0;
  let weekly = 0;
  for (const [f, calls] of Object.entries(TRACKER_CALLS) as [
    Feature,
    { perMember: number; weekly: boolean },
  ][]) {
    if (!on.has(f)) continue;
    // D137: Friday's shield read is the squads read of that quota day when both are on.
    const per = f === "shield_check" && on.has("squads") ? calls.perMember / 2 : calls.perMember;
    const n = Math.ceil(members * per);
    if (calls.weekly) weekly += n;
    else daily += n;
  }
  return { daily, peak: daily + weekly };
}

/**
 * What a workspace has: the features the owner did not allow (`off`), each allowance's daily cap (null: no
 * cap), and the allowed features its officers turned off in Alliance settings (`allianceOff`, D134).
 */
export interface FeatureSettings {
  off: readonly Feature[];
  caps: Record<Allowance, number | null>;
  allianceOff: readonly Feature[];
}

/** The owner's values for a workspace: what is allowed, and the caps. */
export type OwnerSettings = Omit<FeatureSettings, "allianceOff">;

/** What /admin's "Defaults for new alliances" stores (D134): only the values the owner set, by key. */
export interface StoredDefaults {
  switches: Readonly<Record<string, boolean>>;
  caps: Readonly<Partial<Record<Allowance, number | null>>>;
}

/** What a workspace stores: only the owner's overrides of the defaults, and its officers' own switches. */
export interface StoredOverrides extends StoredDefaults {
  alliance: Readonly<Record<string, boolean>>;
}

export const NO_DEFAULTS: StoredDefaults = { switches: {}, caps: {} };

const NO_CAPS: FeatureSettings["caps"] = { ai: null, translate: null };

/**
 * The defaults before the owner sets any on /admin (owner, 2026-11-20): the free features allowed; every
 * feature that spends the owner's Groq limit, a Discord translation or tracker calls not allowed; each
 * daily cap a small number (20 Groq texts, 20 Discord languages).
 */
export const CODE_DEFAULTS: OwnerSettings = {
  off: FEATURES.filter((f) => SPENDS[f] || TRACKER_CALLS[f]),
  caps: { ai: 20, translate: 20 },
};

/** A stored value for `key`, or the fallback when the map has none. */
const pick = <V>(map: Readonly<Record<string, V>>, key: string, fallback: V): V =>
  key in map ? (map[key] as V) : fallback;

/**
 * A workspace's owner values before the owner changes any of its own: the own alliance (OGs) has everything
 * allowed and no cap, as before D126, whatever the defaults say; any other alliance has "Defaults for new
 * alliances", which start as CODE_DEFAULTS.
 */
export function ownerDefaults(unionId: number, defaults: StoredDefaults): OwnerSettings {
  if (unionId === OWN_ALLIANCE_ID) return { off: [], caps: NO_CAPS };
  return newAllianceDefaults(defaults);
}

/** "Defaults for new alliances" as served: the owner's stored values over CODE_DEFAULTS. */
export function newAllianceDefaults(defaults: StoredDefaults): OwnerSettings {
  return {
    off: FEATURES.filter((f) => !pick(defaults.switches, f, !CODE_DEFAULTS.off.includes(f))),
    caps: {
      ai: pick(defaults.caps, "ai", CODE_DEFAULTS.caps.ai),
      translate: pick(defaults.caps, "translate", CODE_DEFAULTS.caps.translate),
    },
  };
}

/**
 * The alliance's own switch before its officers touch it: on, except a feature that spends tracker calls
 * on its key, which waits for the officers to turn it on (OGs: on, as before).
 */
export const allianceDefaultOn = (unionId: number, f: Feature): boolean =>
  unionId === OWN_ALLIANCE_ID || !TRACKER_CALLS[f];

/** A workspace's settings with no row yet. */
export function defaultSettings(unionId: number, defaults: StoredDefaults): FeatureSettings {
  return storedSettings(unionId, null, defaults);
}

/** A workspace's features as served: which are on (its settings, less any globally paused allowance). */
export interface WorkspaceFeatures {
  on: ReadonlySet<Feature>;
  caps: FeatureSettings["caps"];
}

/** On: allowed by the owner, turned on by the alliance (D134), and its allowance not paused for everyone. */
export function resolveFeatures(
  settings: FeatureSettings,
  paused: readonly Allowance[],
): WorkspaceFeatures {
  const on = FEATURES.filter((f) => {
    const spends = SPENDS[f];
    return (
      !settings.off.includes(f) &&
      !settings.allianceOff.includes(f) &&
      !(spends && paused.includes(spends))
    );
  });
  return { on: new Set(on), caps: settings.caps };
}

/** Notice pictures are shown, warned about and cleaned up only while both notices and pictures are on. */
export const picturesShown = (on: ReadonlySet<Feature>) =>
  on.has("notices") && on.has("notice_pictures");

/**
 * A workspace's settings from its stored overrides (null: no row yet). A key the owner did not set follows
 * the defaults, so changing a default moves every workspace still on it, and a feature added to the catalog
 * later starts with its default; a stored key no longer in the catalog is ignored.
 */
export function storedSettings(
  unionId: number,
  stored: StoredOverrides | null,
  defaults: StoredDefaults,
): FeatureSettings {
  const d = ownerDefaults(unionId, defaults);
  const s = stored ?? { switches: {}, caps: {}, alliance: {} };
  return {
    off: FEATURES.filter((f) => !pick(s.switches, f, !d.off.includes(f))),
    caps: {
      ai: pick(s.caps, "ai", d.caps.ai),
      translate: pick(s.caps, "translate", d.caps.translate),
    },
    allianceOff: FEATURES.filter((f) => !pick(s.alliance, f, allianceDefaultOn(unionId, f))),
  };
}

/**
 * D134: an owner value equal to the workspace's own default is no override. It is stored as no value, so
 * the workspace follows that default when the default changes.
 */
export const isDefaultSwitch = (defaults: OwnerSettings, f: Feature, on: boolean) =>
  on === !defaults.off.includes(f);
export const isDefaultCap = (defaults: OwnerSettings, a: Allowance, cap: number | null) =>
  cap === defaults.caps[a];

/**
 * "Copy settings from": the owner overrides that give the target the source's owner values as served, so
 * only what differs from the target's own defaults is stored. The alliance's own switches are not copied.
 */
export function copiedOverrides(source: OwnerSettings, target: OwnerSettings): StoredDefaults {
  const switches = Object.fromEntries(
    FEATURES.filter((f) => !isDefaultSwitch(target, f, !source.off.includes(f))).map((f) => [
      f,
      !source.off.includes(f),
    ]),
  );
  const caps = Object.fromEntries(
    ALLOWANCES.filter((a) => !isDefaultCap(target, a, source.caps[a])).map((a) => [
      a,
      source.caps[a],
    ]),
  );
  return { switches, caps };
}

/** The UTC day a count belongs to: every allowance starts again at 00:00 UTC. */
export const usageDay = (now: Date): string => now.toISOString().slice(0, 10);
