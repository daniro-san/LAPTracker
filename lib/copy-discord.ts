// The Discord messages' text (lib/notify.ts), re-exported as `copy.discord` from lib/copy.ts. Public
// messages use the public pages' words (copy.status); admin messages use /admin's (copy.admin).
// Times are filled in already formatted, with the word "server" after them; no UTC.
export const discordCopy = {
  public: {
    /** `✓ Last updated at Sat, Nov 7, 14:01 server` is copy.status.lastUpdated after the icon. */
    alliances: "{good}/{total} alliances",
    stale: "○ {n} stale: {list}",
    /** First line of a manual round's public message (D28). */
    manual: "Manual round: {name}. Taken by hand.",
    /** The Before's line in the edited message, so the After shows the whole event. */
    beforeDone: "Before snapshot done at {time}",
    might: "**Might ▲**",
    kills: "**Kills ▲**",
  },
  admin: {
    /** Rehearsal (is_test) messages start with this, as rehearsal runs are marked on /admin. */
    test: "[rehearsal]",
    /** Manual rounds start with this, the same way. */
    manual: "[manual]",
    /** A manual round names itself in its run line and has no schedule, so no "due" line. */
    /** First line of the event's one message (D31). */
    eventHeader: "**{name}**",
    manualRun: "{icon} {name} · {phase}: {state} · {at}",
    run: "{icon} {phase}: {state} · {at}",
    due: "due {at} · started {lag}",
    lag: "+{n} min",
    usage: "{calls} calls · {left} requests left · {seconds} s",
    unknown: "unknown",
    error: "error: {error}",
    failed: "✗ failed {alliance}: {error}",
    stale: "○ stale {list}",
    logFailures: "run_logs write failures: {n}",
    runLink: "[Run {id} ↗](<{url}>)",
    verdict: "{icon} · {at}",
    runsLink: "[Runs ↗](<{url}>)",
    skipped: "skipped · {at}: {reason}",
    quotaCheck: "✓ Weekly API quota check · {at}",
    quotaLeft: "{icon} {n} requests left",
    quotaUnavailable: "⚠ requests left: unknown (the quota call failed)",
    quotaLow: " (⚠ under {n})",
    database: "{icon} Database {mb} MB",
    databaseHigh: " (⚠ over {n} MB)",
    pinLocked:
      "🔒 PIN entry is locked for an hour: {n} wrong PINs. The scheduled tick and workflow_dispatch still work.",
    appError: "✗ App error on {route}: {message}{digest} · /admin/errors",
    digest: " · digest {digest}",
  },
};
