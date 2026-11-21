// /admin's Alliances table (issue 485, D144), re-exported as `copy.admin.workspaces.alliances`. English only (D48).
export const alliancesAdminCopy = {
  title: "Alliances",
  help: "What each workspace uses and spends, from our own tables. Counts and times only. Today is the UTC day: the tracker quota and the daily limits reset at 00:00 UTC. Page errors are those of the last 24 hours on the workspace's own pages and requests, from this release on, at most one a second, so they are a lower bound; errors of the nightly reads are on App errors. The ones that need a look come first: a key that cannot be used, errors, a daily limit used up. Tap one to open its workspace below.",
  caption: "Each workspace's use and spend",
  none: "No workspace yet.",
  attention: "Needs a look",
  /** The "Needs a look" chip's first reason. */
  reason: {
    key: "Key: {state}",
    errors: "Page errors: {n}",
    failed: "Failed Discord posts: {n}",
    cap: "Daily limit used up",
    quota: "No tracker quota left today",
  },
  head: {
    alliance: "Alliance",
    calls: "Tracker calls",
    key: "Key",
    limits: "Daily limits",
    posts: "Discord posts",
    errors: "Page errors",
    seen: "Last on the desk",
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
    /** No WORKSPACE_KEYS_SECRET: no saved key is used (D124). */
    off: "keys are off on this site",
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
  postsFailed: "{n} failed",
  seenNever: "none on record",
  /** Under the alliance in the table (from 640): officers last on the desk. */
  seenLine: "On the desk: {seen}",
  changed: "{n} changed by you",
  changedNone: "defaults",
  allianceOff: "{n} turned off by the alliance",
  /** Each daily allowance's name beside its use (D126). */
  allowance: { ai: "Writing help", translate: "Translations" },
  /** The Activity section (D145, issue 484): PostHog's totals per workspace. */
  activity: {
    title: "Activity",
    help: "The last 7 days from PostHog, totals only, never who. Each is a minimum (PostHog misses some visits); under 5 is not shown. Setup: when each step first happened, and the day after the invite. Refreshed every 15 minutes.",
    totals: {
      officers_active: "Officers active",
      board_visitors: "Board visitors",
      notices_written: "Notices written",
      roll_call_marks: "Roll call marks",
      thanks_shared: "Thanks shared",
      screenshots_read: "Screenshots read",
    },
    atLeast: "at least {n}",
    under: "under 5",
    setup: "Setup",
    steps: {
      key_saved: "Key saved",
      bot_installed: "Bot installed",
      first_roll_call: "First roll call",
      first_notice: "First notice",
    },
    /** Days after the invite made the workspace; the date when that is not known. */
    day: "day {n}",
    notYet: "not yet",
  },
};
