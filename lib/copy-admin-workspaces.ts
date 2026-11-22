// /admin's Workspaces card (D71, D73), re-exported as `copy.admin.workspaces`. English only (D48).
import { alliancesAdminCopy } from "./copy-admin-alliances";

export const workspacesAdminCopy = {
  title: "Workspaces",
  help: "An alliance's private Officers' Desk at /w/<address>. Its leadership signs in with Discord: a leadership role in the alliance's server, or a place on the allowlist.",
  none: "No workspace yet.",
  /** The Alliances table above the workspaces (D144). */
  alliances: alliancesAdminCopy,
  alliance: "Alliance",
  /** A workspace's own alliance that no board or daily roster names yet (F13): its id. */
  allianceUnread: "{id} · not read yet",
  guild: "Discord server id",
  roles: "Leadership role ids",
  rolesHelp: "One or more, separated by commas or spaces.",
  memberRoles: "Member role ids",
  memberRolesHelp:
    "Who sees the members' board: people in the server with one of these roles. Separated by commas or spaces. Empty: the board is off.",
  boardOff: "Members' board is off until you set a member role.",
  slug: "Address (slug)",
  slugHelp: "Lowercase letters, digits and dashes, e.g. ogs.",
  sessions: "{n} signed in",
  allowlist: "Allowlist",
  allowlistNone: "empty",
  until: "until {date}",
  save: "Save workspace",
  edit: "Add or edit a workspace",
  editHelp:
    "Pick a workspace to load its settings, or New workspace to add one. Saving for an alliance that already has a workspace edits it.",
  /** The form's workspace picker: it loads the workspace's current settings into the fields. */
  editing: "Editing /w/{slug}",
  adding: "New workspace",
  pick: "Workspace to edit",
  /** Saving would empty the member roles of a workspace that has some. */
  closeBoard: {
    title: "Close the members' board?",
    ask: "This closes the members' board. Save anyway?",
    yes: "Save anyway",
  },
  allow: "Add to the allowlist",
  allowHelp: "Lets one Discord account in without the role, until the end of the date (UTC).",
  allowWorkspace: "Workspace",
  allowUser: "Discord user id",
  allowUntil: "Until",
  allowSave: "Add",
  /** One button, then a sheet: everyone, officers, members or one person (D105, amended 2026-11-17). */
  signOutUsers: {
    button: "Sign out users",
    sheet: {
      close: "Close",
      cancel: "Cancel",
      ask: "Discard your choice?",
      keep: "Keep",
      discard: "Discard",
    },
    title: "Sign out users in /w/{slug}",
    who: "Who",
    everyone: "Everyone ({n})",
    officers: "Officers only ({n})",
    members: "Members only ({n})",
    one: "One person",
    nobody: "Nobody is signed in to /w/{slug}.",
    search: "Search by name",
    noMatch: "No name matches.",
    officer: "officer",
    member: "member",
    noName: "(no name)",
    seen: "last seen {ago}",
    next: "Next",
    back: "Back",
    yes: "Sign out",
    confirmAll: "Sign out all {n} people in /w/{slug}?",
    confirmOfficers: "Sign out {n} officers of /w/{slug}?",
    confirmMembers: "Sign out {n} members of /w/{slug}?",
    confirmOne: "Sign out {name} ({tier})?",
    oneOfficer: "Sign out 1 officer of /w/{slug}?",
    oneMember: "Sign out 1 member of /w/{slug}?",
    onePerson: "Sign out the 1 person in /w/{slug}?",
    sessionsOnly:
      "This ends their sessions only. Nobody is blocked: whoever still belongs signs in with Discord again.",
    pinStays:
      "Your /admin PIN is not a workspace session and stays unlocked. If you are also signed in to /w/{slug} with Discord, that session ends too.",
  },
  /** The workspace's own tracker key (D124): its officers set it; /admin sees only this. */
  key: {
    unset: "Tracker key: not set",
    set: "Tracker key: set · {status} ({when})",
    status: {
      unset: "not set",
      ok: "working",
      invalid: "refused by the tracker, reads paused",
      out_of_quota: "out of quota until 00:00 UTC",
      reenter: "needs to be entered again",
    },
    rotation:
      "Changing WORKSPACE_KEYS_SECRET makes every saved tracker key need to be entered again.",
  },
  /**
   * The workspace's own Discord set-up (D129): its officers add the bot, check it and save the webhooks in
   * Alliance settings; /admin sees only whether each is done, never a webhook.
   */
  discord: {
    line: "Discord: {bot} · commands: {commands} · leaders' webhook: {leaders} · members' webhook: {members} · Raid Shield webhook: {shield}",
    botSeen: "bot in server",
    botUnseen: "bot not checked",
    noCommands: "not registered",
    noneOn: "none on",
    set: "set",
    site: "env",
    unset: "not set",
    /** D147: without its own channel the Raid Shield summary is not posted anywhere. */
    shieldUnset: "not set (no summary posted)",
  },
  /** "Delete this workspace" (D125): the same 14 days as an officer's, and its officers can cancel. */
  deletion: {
    line: "Deletion asked by {who} on {asked} · deleted after {date}",
    owner: "you",
    officer: "an officer",
    ask: "Delete in 14 days",
    askConfirm:
      "Delete /w/{slug} after 14 days? Its officers see a banner with the date and can cancel. Public data (the Event Ledger and the alliance's pages) stays.",
    cancel: "Cancel the deletion",
    cancelConfirm: "Cancel the deletion of /w/{slug}?",
    asked: "Deletion asked: after {date}.",
    cancelled: "Deletion cancelled.",
    deleted: "Deleted workspaces",
    deletedHelp:
      "What is left of a deleted workspace: its address, its alliance and whether you or an officer asked. No names, no member data.",
    tombstone: "/w/{slug} · {alliance} · asked by {who} on {asked} · deleted on {purged}",
  },
  saved: "Saved.",
  ended: "Sessions ended: {n}.",
  errors: {
    bad_request: "Check the fields: an id is 17 to 20 digits.",
    slug_taken: "Another workspace has this address.",
    guild_taken: "Another workspace already uses this Discord server.",
    expiry_past: "The date has to be in the future.",
    workspace_not_found: "That workspace no longer exists.",
    no_workspace: "That workspace no longer exists.",
    no_session: "That person has no open session in this workspace now.",
    unauthorized: "Wrong PIN.",
    rate_limited: "Too many attempts. Wait a few minutes.",
    pin_locked: "PIN sign-in is locked for an hour.",
    failed: "Could not save. Try again.",
  },
  /** The Discord section: the app's three message commands, registered in each workspace's server (D96, D101). */
  command: {
    title: "Discord",
    help: "Adds 'Send to LAPTracker', 'Translate for me' and 'Translate for everyone' to the Apps menu of each workspace's Discord server, only those turned on for that workspace. Officers can also do it from Alliance settings. Run it again after the commands change.",
    register: "Register the Discord command",
    noCredentials: "The Discord app credentials are not set.",
    noGuild: "No workspace has a Discord server yet.",
    line: "{name} ({guild}): {outcome}",
    registered: "registered",
    failed: "failed: HTTP {status}",
    /** A short reason from Discord's status code only, never its answer's body. */
    reasons: {
      0: "failed: no answer from Discord",
      403: "failed: HTTP 403, the app is not added to this server",
      429: "failed: HTTP 429, Discord asks to wait. Try again later",
    },
    errors: {
      no_credentials: "The Discord app credentials are not set.",
      discord_token: "Discord refused the app's credentials: HTTP {status}.",
      unauthorized: "Wrong PIN.",
      rate_limited: "Too many attempts. Wait a few minutes.",
      pin_locked: "PIN sign-in is locked for an hour.",
      failed: "Could not reach the server. Try again.",
    },
  },
  /** The squads read's daily queue and a press that runs its next batches now (D117, amendment 2026-11-19b; D132). */
  squads: {
    title: "Squads read",
    help: "Every 15-minute tick reads a small batch of each workspace's squads queue. A press reads the next batches now instead of waiting for the tick, for up to 4 minutes. Same rules either way: each workspace's own key, at most 120 calls a day, the quota reserve, one read per member a day, at most 3 tries each. Not during an event's Before/After window.",
    day: "This quota day's queue: {day}. The ticks use the same one.",
    runAll: "Run the squads read now for all workspaces",
    run: "Run the squads read now",
    next: "Run the next batch",
    sending: "Starting…",
    none: "Not read yet in this quota day.",
    empty: "No workspace has the squads read on.",
    batchRunning: "A batch is running now.",
    progress:
      "Squads today: {read} of {members} read · {retrying} waiting to retry · {failed} not read · quota left {quota}",
    nextTry: "Next try at {at} server time.",
    waitingLater: "{waiting} waiting to try again · next try at {at} ST",
    quotaUnknown: "unknown",
    lastBatch: "Last batch {ago}.",
    status: {
      running: "More to read.",
      done: "Done.",
      stopped: "Stopped: {reason}.",
      skipped: "Skipped: {reason}.",
    },
    /** D132: a stop reason in words; any other reason shows as its code. */
    reasons: {
      key: "the tracker refused the key",
      limit: "the limit is reached until 00:00 UTC",
      cap: "the day's 120 calls are used",
    },
    started: "Started for {list}. Reload in a few minutes to see how far it got.",
    errors: {
      event_window: "Not now: an event's Before/After window is open.",
      quota_reset: "Too close to the quota reset at 00:00 UTC. Try again after it.",
      daily_read_pending: "This quota day's roster read has not finished yet.",
      no_target: "No workspace has the squads read on with a tracker key it can use.",
      bad_request: "Something in the request was wrong.",
      unauthorized: "Wrong PIN.",
      rate_limited: "Too many attempts. Wait a few minutes.",
      pin_locked: "PIN sign-in is locked for an hour.",
      failed: "Could not reach the server. Try again.",
    },
  },
};
