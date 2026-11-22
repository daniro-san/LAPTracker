// The Discord messages' text (lib/notify.ts), re-exported as `copy.discord` from lib/copy.ts. Public
// messages use the public pages' words (copy.status); admin messages use /admin's (copy.admin).
// Times are filled in already formatted, with the words "server time" after them; no UTC.
export const discordCopy = {
  public: {
    /** `✓ Last updated at Sat, Nov 7, 14:01 server time` is copy.status.lastUpdated after the icon. */
    alliances: "{good}/{total} alliances",
    stale: "○ {n} stale: {list}",
    /** First line of a manual round's public message (D28). */
    manual: "Manual round: {name}.",
    /** The Before's time in the edited message, so the After shows the whole event; the page's word
     * for it (copy.status.start, issue 180). */
    start: "Start {time}",
    might: "**Might ▲**",
    kills: "**Kills ▲**",
    /** The leading alliance by members with kills gained (#271): the picture's first figure, in the text too. */
    turnout: "Most members with kills gained: {alliance} {share}",
    /** The message is plain text (D58): the status chip in bold, then the lines, then this link. */
    title: "**{title}**",
    eventLink: "[Event page ↗](<{url}>)",
  },
  /** The event picture under the public message (D58). */
  image: {
    /** The file's description: what a screen reader says for the picture. */
    alt: "The event's ledger by Might, its top gains and the members with kills gained",
    /** The capture window in the page's words (copy.status.start / end, issue 180). */
    start: "Start {time}",
    end: "End {time}",
    endDue: "End due {time}",
    ledger: "Ledger · Might",
    mightUp: "Might ▲",
    killsUp: "Kills ▲",
    turnout: "Members with kills gained",
    /** One line under the bars: the alliance whose top 5 made the largest share of its kills gained. */
    topShare: "Highest top 5's share of kills",
    stale: "○ stale",
    /** The KvK block (D152): `vs server 326 · 14 v 12 alliances`, then each side's sums. */
    kvk: "vs server {server} · {a} v {b} alliances",
    kvkMight: "Might",
    kvkKills: "Kills",
    kvkSides: "{us} us · {them} them",
    footer: "{site} · Server {server} · times are server time",
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
    /** A sample that fell short posts once per event (D69): later ones show on /admin/runs only. */
    sampleOnce: "Later samples of this event that fall short are not posted: [Runs ↗](<{url}>)",
    verdict: "{icon} · {at}",
    runsLink: "[Runs ↗](<{url}>)",
    skipped: "skipped · {at}: {reason}",
    quotaCheck: "✓ Weekly API quota check · {at}",
    quotaLeft: "{icon} {n} requests left",
    quotaUnavailable: "⚠ requests left: unknown (the quota call failed)",
    quotaLow: " (⚠ under {n})",
    /** The weekly check's line for the site's own alliance (D70): counts only, never names; the lists are in
     * the alliance workspace's Members tab. */
    mightLine: "Might unchanged ≥ {days} daily reads: {unchanged} · Lost might ≥ {pct} %: {lost}",
    database: "{icon} Database {mb} MB",
    databaseHigh: " (⚠ over {n} MB)",
    pinLocked:
      "Locked: {n} wrong PINs, so PIN entry is off for an hour. The scheduled tick and workflow_dispatch still work.",
    tickSilence:
      "⚠ No tick for {min} min (last {at}). Check the cron-job.org job and CRON_SECRET · /admin",
    tickNone: "⚠ No tick recorded yet. Check the cron-job.org job and CRON_SECRET · /admin",
    /** The daily roster read (D60) posts only when it falls short. */
    dailyRead: "{icon} Daily roster read {day}: {state} · {calls} calls · {at}",
    /** Alliances that share one reason, on one line: "✗ v1 TimeoutError (12): [NSE], [URSA], …". */
    dailyFailed: "✗ {error} ({n}): {list}",
    /** Under each failure line: what it means and what to do (D61, copy.admin.guide). */
    dailyWhy: "↳ {meaning} {action}",
    /** A day that fell short can be retried on /admin (D67); a partial one also links the reads list. */
    dailyRetry: "[Retry on /admin ↗](<{url}>)",
    dailyRuns: "[Daily reads ↗](<{url}>)",
    /** D133: the day's top 20 by board might changed. One line in, one line out, only those that apply. */
    trackedChange: "↕ Tracked alliances {day} (top {n} by board might) · [/admin ↗](<{url}>)",
    trackedIn: "＋ In: {list}",
    trackedOut: "－ Out: {list}",
    /** The board could not be read: the newest set is kept for the day. */
    trackedKept: "⚠ Ranks board unreadable {day}: yesterday's tracked alliances are kept.",
  },
};
