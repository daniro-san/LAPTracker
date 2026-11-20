## D135 — The desk's read status bar: one line per tracker read with something to say, under the page head on every desk page, for officers only (2026-11-20, owner, issue 478; amends D132)

Why: officers could not tell why a card was not updated yet: the squads read (D132) runs in small batches through the night, and the roster read or the tracker key can fail with nothing on the desk saying so (owner, 2026-11-19, issue 478). The owner closed the open question on 2026-11-20: the bar is for officers only, with nothing on the members' board.

**Where.** Under the page head of every desk page (`SignedInFrame`, the D122 AppShell's `<main>`), after the deletion notice. It is hidden when no read has anything to say.

- The frame reads it itself (`ReadStatusLine` in `app/(private)/_ui/Frame.tsx`) in its own Suspense boundary, on the `access` that the page's `requireWorkspace` gave. The page never waits for it. This is the frame's only database connection: the page's own read stays as it was. If that connection or a query fails, the bar renders nothing and logs the code `w.read_status.failed` only (`frameReadStatus`): the bar never takes the desk page down (review of PR 515).
- The read model is `readStatus` in `lib/private/read-status.ts`. `GET /api/w/[slug]/read-status` serves the same lines for polling, to an officer's session of that workspace only (`401 signed_out` otherwise, D99). The answer is `private, no-store`, nothing is logged, and no tracker call is made.

**What it says.** Lines are in the officer's language (EN, PT-BR, FR). They hold counts and server times only: no uid, name or value (D71). A workspace sees only its own reads, because the alliance comes from the session (issue 471).

| Line                        | When                                                                                                                                                                       | Example (EN)                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Key                         | D124 `invalid` or `reenter`                                                                                                                                                | "Tracker key refused · paste a new key in Alliance settings", with "Open Alliance settings"        |
| Roster                      | today's roster row is an error, or the day's read is not running, its window (`DAILY_ROSTER_AT` + `SNAPSHOT_WINDOW_MIN`) has closed, and there is no row for this alliance | "Today's roster is late · the cards keep the last numbers · squads wait for it"                    |
| Squads, running             | `squad_reads` `running`                                                                                                                                                    | "Squads: 43 of 101 read so far · started 23:37 ST"                                                 |
| Squads, waiting for retries | running, nobody due now, a next try later                                                                                                                                  | "Squads: 60 of 64 read · 4 to try again at 02:15 ST"                                               |
| Squads, paused              | running, and on the site's key in the event window, or `reason: quota` (the reserve)                                                                                       | "Squads paused at 40 of 95 · tracker calls are kept for other reads"                               |
| Squads, done                | `done`, for 30 minutes after `finished_at`                                                                                                                                 | "Squads: 84 of 87 read · the tracker missed 3 · updated at 23:41 ST"                               |
| Squads, stopped             | `stopped` (`stopKind`: key, limit, cap)                                                                                                                                    | "Squads paused at 61 of 99 · today's tracker limit is reached · it resets at 00:00 UTC (22:00 ST)" |
| Squads, skipped             | `skipped`                                                                                                                                                                  | "Squads not read today: tracker limit unknown"                                                     |

- **D132's read model, reused.** The squads line reads `squadsToday` (`lib/private/squads-today.ts`) and `stopKind` (`lib/squads.ts`), the same as Alliance settings' "Squads today". The stop reasons reuse its `squads.stop.*` words.
- **Shown only when the squads read is on and a key reads it.** `squadsReader` checks the feature (D126, D134) and then `squadsKey` (`lib/workspace-keys.ts`, INVARIANT `squads.key-rule`). `squadTargets` follows the same rule in every branch, so the desk and the read cannot disagree (issue 507's first item). A key spent today reads again only after the 00:00 UTC reset, for both; Home's key card says so meanwhile (review of PR 515). `readStatus` reads `workspace_keys` once for the key line, this rule and the daily read's rule.
- **The key line comes first**, then the others, newest first. Stopped and skipped lines stay until the quota day ends. A day's queue belongs to its quota day (D132), so the next day starts with no line. An alliance the daily read leaves out on purpose (`dailyKeyRule` "skip": a refused, unreadable or spent key, D133) gets no roster line: the key's state explains it (review of PR 515).
- **D75.** A member the tracker did not answer for is "the tracker missed 3". It is never counted against the member, and no line names anyone.

**How it looks** (DESIGN.md "Workspace components": read status bar).

- One `<details>` in a labelled `section`. Closed, it shows the first line below 640 px, and the first two from 640 px, each cut with an ellipsis, plus "+n more". The summary is 44 px tall, and a tap opens every line in full.
- Each line starts with what and how far ("Squads: 43 of 101 read"), so even the cut line at 360 px says it.
- A dot gives the tone: plum while running (it pulses, and is still under `prefers-reduced-motion`), sage when done or paused, yarn when a line needs a look. The words always say the state.
- From 640 px, a key line also puts "Open Alliance settings" beside the closed bar.
- **Home and Alliance settings show the key's state themselves** (Home's key card, D124). There the bar leaves out the key line (`keyCard`, `SignedInFrame keyShown`). This came from the persona panel: the same fact said twice, in two clocks.

**Refresh.** While a line is running (`running: true`), the bar asks the route every 30 s, only while the tab is visible. Becoming visible again asks at once. When an answer says the read ended, the bar calls `router.refresh()` once, so the cards show the new numbers, and then stops asking. A done line goes at its `until` (30 minutes after the end), on a timer, with no request; once no line is left to go, no timer runs (`nextWake`). A `401` ends the polling.

**Not done here.**

- The Raid Shield check (#474) gets a line when it exists: add a kind to `readStatus` behind `featureOn(access, "shield_check")`.
- No start button (the owner's scope).
- No members' board version (owner, 2026-11-20).

**Tests.**

- `lib/private/read-status.test.ts`, one per state: running (the counts move, nothing with the feature off, and the site's key with the keys off still reads); done (30 minutes, then nothing); waiting for retries; paused for the reserve and in the event window; stopped at the limit (the reset time), at the cap and for another reason; skipped; a key to paste again; a refused key with no roster line, and a key spent today with no line at all; a late roster (not inside its window), a failed roster, and nothing to say; a failed connection renders nothing and logs a code only.
- `app/(private)/_ui/read-status-wake.test.ts`: no timer once nothing is left to go.
- `lib/squads-key-rule.test.ts`: `squadsKey` and `squadTargets` agree on a key spent today, before and after the reset.
- Issue 471's isolation suite (`cross-workspace-reads.test.ts`): each workspace's bar carries its own counts and no uid or name.
- The member-session sweep covers the new route.

**Amendment (2026-11-20, owner, issue 474, D137): the Raid Shield check's line.** While `shield_check` is on, the bar has a `shield` line for the check's quota day until KvK starts: "Checking Raid Shields · 40 of 101 · started 23:31 ST" while a read runs (progress, the bar polls), then "Raid Shield check 23:42 ST · 87 of 101 seen with a shield" (quiet). Counts and server times only. See D137.
