// /admin's Alliances table (issue 485, D144), re-exported as `copy.admin.workspaces.alliances`. English only (D48).
export const alliancesAdminCopy = {
  title: "Alliances",
  help: "What each workspace uses and spends, from our own tables. Counts and times only. Today is the UTC day: the tracker quota and the daily limits reset at 00:00 UTC. The ones that need a look come first: a key that cannot be used, errors, a daily limit used up. Tap one to open its workspace below.",
  caption: "Each workspace's use and spend",
  none: "No workspace yet.",
  attention: "Needs a look",
  head: {
    alliance: "Alliance",
    calls: "Tracker calls",
    key: "Key",
    limits: "Daily limits",
    posts: "Discord posts",
    errors: "Errors 24 h",
    seen: "Officers seen",
    changed: "Features",
  },
  /** The workspace's own reads (squads, Raid Shield check) on the quota day and the 7 quota days to it. */
  calls: {
    own: "{today} of 1,000 today",
    site: "{today} today on the site's key",
    none: "{today} today",
    week: "{n} in 7 days",
    planned: "planned about {n} a day",
  },
  key: {
    ok: "ok",
    paused: "paused",
    reenter: "re-enter",
    none: "none",
    own: "its own key",
    site: "the site's key",
    noKey: "no key",
    /** Why a key is paused (D124). */
    invalid: "the tracker refused it",
    out_of_quota: "no quota left today",
    /** The squads read is on but there is no usable key, so it is skipped. */
    wanted: "squads read skipped",
  },
  /** Today's use of a daily allowance against its cap (D126). */
  used: "{used} of {cap}",
  usedNoCap: "{used} · no cap",
  usedUp: "used up",
  posts: "{n} today",
  errors: "{n}",
  seenNever: "none on record",
  changed: "{n} changed",
  changedNone: "defaults",
  allianceOff: "{n} off by the alliance",
  /** The card's labels below 640. */
  card: {
    posts: "Discord posts",
    errors: "Errors in 24 h",
    seen: "Officers last on the desk",
  },
  /** Each daily allowance's name beside its use (D126). */
  allowance: { ai: "Writing help", translate: "Translations" },
};
