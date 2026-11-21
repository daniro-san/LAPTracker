## D141 — The tick checks the clock before the database: a tick, the watcher and the squads backup ask nothing when nothing can be due, and the status bar polls only while a tick's batch can run (2026-11-20, issue 521; amends D45, D132, D135)

Why: production went down on 2026-11-20 at about 22:40 UTC. Neon refused every query with "Your account or project has exceeded the quota" (SQLSTATE 53000). On Neon's free plan the compute has a monthly budget of active time. Compute starts on the first query and suspends after about 5 minutes with no query. So each call that makes even one query costs about 5 minutes of compute, even when it finds nothing to do. Before this change, every scheduler call made queries.

**What woke the database, per normal day (before).**

| Caller                                           | Calls a day         | Why it queried                                                                                                                                   |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/tick` (cron-job.org, :00/:15/:30/:45) | 96                  | the heartbeat row (D45, insert, cap and update), `duePhases`, `dueSample`; then, in `after`, the squads batch (`getDailyRead`, targets and rows) |
| `POST /api/tick/watch` (cron-job.org)            | 96                  | `latestTickAt`                                                                                                                                   |
| `tick.yml` (GitHub, :07/:22/:37/:52)             | about 3 (D117)      | the same tick, then `POST /api/squads-read` (`getDailyRead`)                                                                                     |
| The squads queue (D132)                          | in every tick above | all day, also after every queue was done                                                                                                         |
| The ranks board and the tracked set (D133)       | 1–2 (daily read)    | only in the daily read's window: already clock-gated                                                                                             |
| The Raid Shield check (D137)                     | Fri and Sat only    | already clock-gated (`shieldWindowOpen`)                                                                                                         |
| Purges and cleanups (D119, D125, D132)           | 1 a day, 1 a week   | only after the day's first read and in the Friday check: already clock-gated                                                                     |
| The status bar's frame read (D135)               | per desk page view  | the page's own read wakes the database in the same request, so it adds no wake                                                                   |
| The status bar's poll (D135)                     | every 30 s          | only while a read runs and the tab is visible; during the night's squads read that keeps the database awake between ticks                        |

**The rule.**

- **The clock first.** `POST /api/tick` checks `tickMayBeDue` (`lib/tick-gate.ts`) after `authorize`, which needs no query for the right `CRON_SECRET`. Without anything due it answers 204 before any query: no heartbeat row and no squads batch (INVARIANT `tick.clock-first`). It opens the database when one of these holds:
  - the clock alone (`tickClockDue`) says so:
    - the scheduled event's row, in the first hour of its day-ahead window;
    - the event from its Before until its After's window closes, with its samples;
    - the Friday check, which includes the weekly cleanup of notice pictures;
    - a REHEARSAL_AT slot until its rehearsal's After window closes (slot + 45 + 45 + 45 min);
    - the daily read's window, which includes the daily purges;
    - the heartbeat slot;
  - the Raid Shield check's windows (`shieldWindowOpen`, D137);
  - the squads queue can have work (`squadsMayRun`);
  - a rehearsal pressed on /admin is still pending.
- **Inside the gate nothing changes.** When it opens, the tick runs exactly as before: the heartbeat, `runTick`, the squads batch in `after`. Quotas, the D117 reserve, the event pause, the claims and every once-per-member, once-per-slot and once-per-phase invariant are unchanged.
- **The squads queue** (`squadsMayRun`): from the quota day's daily read (`DAILY_ROSTER_AT`) until a batch would cross the 00:00 UTC reset, and only until the day is settled. Settled means one of two things. Either every squads target's `squad_reads` row is done, stopped or skipped, and a target with no row has no roster that could still come (the day's read is over and its window has closed). Or the day's read never came and its window has closed. Before the read and after the reset there is no query. `POST /api/squads-read` checks the same rule, so `tick.yml` asks nothing either. A settled day now answers 204 there instead of 200 with `more: false`. `tick.yml` stops on both.
- **What only the database knows is kept, once it holds.** Two facts are kept in Next's data cache, shared by every instance: "no rehearsal is pending" and "this day's squads queue is settled" (`lib/wake-cache.ts`, `ctx.wakeCache`). While a fact does not hold, every tick checks the database again, and the work it waits for needs the database anyway. The writes that can change a fact forget both, after their write, so a tick in between cannot keep the old answer: `POST /api/rehearsal` (also when it answers 409 "pending", so a second press clears a stale "no rehearsal pending"), `POST /api/daily-read/retry`, a tracker key saved or removed, `POST /api/admin/workspaces` (a new workspace can add a squads target), an alliance's feature switch and /admin's switches. A stale kept fact therefore hides work for at most one tick. A kept fact is checked again after 24 h at the latest, in case a forget was missed. A new quota day uses a new key.
- **The heartbeat and the watcher (amends D45).** An idle tick writes no `tick_log` row any more. Every tick in the first 15 minutes of 00, 06, 12 and 18 UTC opens the database (`heartbeatSlot`). The watcher reads the tick log only half an hour later, at :30–:45 of those hours (`watchSlot`), and answers 204 with no query at any other time. Its rule is the same: no tick for more than 60 minutes means one admin alert. A stopped scheduler is now noticed within about 6 h 45 min, not 75 minutes. /admin's "last tick" shows the last tick that opened the database.
- **The status bar's poll (amends D135).** While a line is running, the bar's 30 s poll asks only in the 5 minutes after each tick of either scheduler: cron-job.org's :00/:15/:30/:45 and `tick.yml`'s :07/:22/:37/:52 (`batchMayRun`; review of PR 524 chose this over "every 30 s for at most 15 minutes" as the simpler rule). Reads change only then, because each tick's batch ends within its own work (100 s) plus its `after` (180 s). The database is awake for that batch anyway. Becoming visible still asks at once. The frame keeps its own connection, because the page's own read wakes the database in the same request. Moving the bar's read onto the page's connection would mean changing every desk page, and it would save no wake.

**Estimate: database-awake minutes a day.** Each separate wake counts 5 minutes plus its work. Ticks are 15 minutes apart, so each wakes the database on its own.

| Day                        | Before                                                                                                                                             | After                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mon–Thu                    | 96 ticks ≈ 480 min, plus up to 480 min for 96 watcher calls that do not fall within 5 min of a tick, plus about 15 min from `tick.yml`: **8–16 h** | 4 heartbeats + 4 watcher reads ≈ 40 min; the daily read and squads queue, about 7 ticks from 23:30 ST ≈ 45 min; the tick that finds the queue settled ≈ 5 min: **≈ 1.5 h** |
| Friday                     | the same, 8–16 h                                                                                                                                   | + the event's row (4 ticks ≈ 20 min), the rehearsal and Friday check (18:00–20:45 ST, 11 ticks ≈ 60 min): **≈ 3 h**                                                        |
| Saturday                   | the same, 8–16 h                                                                                                                                   | + the event with samples (10:00–14:45 ST, 19 ticks ≈ 125 min), which covers the shield's morning read: **≈ 3.5 h**                                                         |
| A week, per day on average | **8–16 h**                                                                                                                                         | **≈ 2 h**                                                                                                                                                                  |

Page views, admin presses, deploys (`pnpm db:migrate` in the build) and a status bar left open are not in either column. Before this change, a desk tab left visible during the night's squads read polled every 30 s and kept the database awake between ticks, up to about 9 more minutes per 15. Now its polls fall inside the tick's own wake. Measure on Neon's dashboard (compute hours per day) for a week after the release, to check these numbers.

**Not done here.**

- No change to Neon or Vercel settings, the scheduler jobs or `tick.yml`. The owner may drop `tick.yml`'s schedule and the watcher's 15-minute cadence on cron-job.org; the gate makes them cheap but not free (a function call each).
- The heartbeat's 6 h and the watcher's 6 h 45 min detection are a trade-off of this change. A shorter period costs about 10 minutes of compute a day per extra heartbeat and watch pair.

**Accepted.**

- Changing `SNAPSHOT_BEFORE`/`SNAPSHOT_AFTER` after the event's row was made leaves that row on the old times. The clock rule follows the env, so the tick then opens at the new times. This already needs a redeploy; do it a day before the event or after it.
- A tick that checks "no rehearsal pending" at the very moment of a press can keep the old answer. The window is one query long. /admin then shows the rehearsal not starting, and a second press, or the next forget, fixes it.

**Tests.**

- `lib/tick-gate.test.ts`:
  - every window of `tickClockDue`, including a REHEARSAL_AT rehearsal's end;
  - no query before the quota day's read or near the reset;
  - a running queue opens, then "settled" is kept and no query follows;
  - a day whose read never came stays settled;
  - no query once no rehearsal is pending, and a press opens it again after forget;
  - the Raid Shield check's Friday 23:30 ST and Saturday morning windows open the gate from the clock alone.
- `app/api/tick/route.test.ts`: an idle tick with the facts kept asks the database nothing and starts no batch. The heartbeat is written in its slot. A day whose read never came starts no batch.
- `app/api/rehearsal/route.test.ts` and `app/api/admin/workspaces/route.test.ts`: a press, a second press refused as pending, and a new workspace each forget the kept facts.
- `app/api/tick/watch/route.test.ts`: the alert and the quiet case fall in the watcher's slot; outside it, no query.
- `app/(private)/_ui/read-status-wake.test.ts`: the poll asks only in the 5 minutes after each cron-job.org or `tick.yml` tick.

**Amendment (2026-11-21, issue 521, perf batch 2): a heartbeat every 3 hours, and the watcher runs inside `uptime.yml`.**

- **Heartbeat.** `heartbeatSlot` is the first 15 minutes of 00, 03, 06, 09, 12, 15, 18 and 21 UTC (`HEARTBEAT_EVERY_H = 3`). The tick in that slot still writes the `tick_log` row that /admin's "last tick" shows.
- **Watcher.** `watchSlot` is gone: `POST /api/tick/watch` reads the tick log on every call. It has one caller, `uptime.yml`, at :10 of the same eight hours, after its page probes. The probes and the watcher share that run's database wake. The run does wake the database: it has usually suspended by about :05, 5 minutes after the heartbeat's last query.
- **The rule.** The watcher alerts when the newest tick started before `heartbeatBoundary(now)`, or no tick was ever recorded. `heartbeatBoundary(now)` is the latest 3-hour UTC boundary at least 10 minutes before `now`. The alert is still claimed once per hour. The rule compares the newest tick with the slot, not with the run's start. So:
  - a run that GitHub starts up to about 3 h late still judges the slot it was meant for, and finds that slot's tick. No false alert.
  - a run that GitHub skips makes no call and no alert. The next run judges its own slot.
  - a run at 00:05 judges the 21:00 slot of the day before. A run at 00:10 judges 00:00. Epoch time divides into 3-hour blocks at 00:00 UTC, so the day boundary needs no special case.
  - a manual run (`workflow_dispatch`) at any time judges the newest slot that is at least 10 minutes old.
- **Detection.** A scheduler that stops right after a heartbeat is noticed at the next slot's run, :10 three hours later, plus GitHub's start delay. That is about 3 h 10 min plus the delay, not 6 h 45 min. A GitHub-wide outage of scheduled runs means no watcher. GitHub emails the owner when a run fails, also when the watch POST answers non-2xx.
- **Cost.** Fixed wakes a day go from 12 (4 heartbeats, 4 uptime runs, 4 watcher reads at :30) to 16 (8 heartbeats, 8 uptime runs that also watch). That is about 20 more minutes of compute a day, for detection in about 3 h instead of 6 h 45 min. A `tick.yml` tick at :07 in a slot, when GitHub runs it on time, is one more wake, and the uptime run at :10 then shares it. Function calls: cron-job.org's watcher job (96 a day) goes away once the owner disables it. `uptime.yml` runs 8 times a day instead of 4.
- **Owner step.** Disable the watcher job on cron-job.org as soon as the release is live. Until then it calls the route every 15 minutes, and each call now reads the tick log: about 4 extra wakes an hour. It applies the same slot rule, so it alerts only when a slot really had no tick.
- **`uptime.yml`'s timeout** goes from 5 to 8 minutes. The worst case is two probe rounds of 3 × 30 s with the 60 s pause between them, then the watcher's 30 s, plus the runner's start.
- **Tests.** `lib/tick-gate.test.ts`: the heartbeat opens at 03:05 and stays shut at 04:05. `app/api/tick/watch/route.test.ts`: an alert when the 12:00 heartbeat never came, and none on a re-run; no alert when a tick came in the slot, for a run on time, 50 minutes late or 3 h late; the 00:00 UTC slot across the day boundary.

**Amendment (2026-11-21, issue 521, perf Batch 1): /admin's watch asks only when a run can start, no /admin link prefetches, and an index on `daily_rosters.member_uids`.**

- **Why.** In 12 h of production CDN records, 98.4 % of function calls (about 1,128 an hour) came from one idle /admin tab. Its 20 s `router.refresh()` also prefetched every link in view again. Measured locally on an idle /admin tab (production build, invented data): 2.9 refreshes, 15.9 prefetches and about 226 database transactions a minute, all day. The estimate table above left /admin out; with such a tab open, the database never suspended.
- **The rule.** Idle, /admin's run watch (`app/_ui/admin/useRunWatch.ts`) refreshes every 20 s only while both hold:
  - `batchMayRun(now)`: the 5 minutes after a tick of either scheduler. The rule moved to `lib/tick-batch.ts`, which the status bar and /admin both import.
  - `now >= pollFrom`. `pollFrom` (`lib/tick-gate.ts`) is the first tick from the current one on, up to 24 h ahead, at which `tickClockDue` holds. While a pressed rehearsal is pending it is `now`, because a later tick runs it and the clock alone does not foresee that. The shell computes it on every render, so every refresh brings a new one.

  `batchMayRun` alone was not enough. Its gaps (2 and 3 minutes) are shorter than Neon's 5-minute suspend, so the database stayed awake. With `pollFrom`, the tab asks nothing between ticks that have work.

- **Unchanged.** The 4 s poll while a run is going, the "finished" line, and the owner's own press (it refreshes at once). Becoming visible refreshes at once.
- **Prefetch.** Every link /admin renders has `prefetch={false}`: the nav, the overview's "Open" link to the last run, and the run rows and filters on /admin/runs. So do the header's `/` and `/players` links on /admin only (`SiteHeader`'s `prefetch` prop, on by default, so public pages keep Next's default prefetch).
- **Measured after** (same setup, 15 minutes each):
  - nothing due by the clock: 0 refreshes, 0 prefetches and 0 transactions beyond the 2 a minute of background noise, inside tick windows too;
  - the daily read's window open: 3 refreshes and about 204 transactions a minute inside the 5-minute windows, 0 outside them, and 0 prefetches.

  On a quiet weekday, the idle tab's database time falls from 24 h to the windows the tick has work in anyway: the heartbeats, the daily read and the event.

- **Bounds this accepts.**
  - A press made on another device shows on an idle tab only at the next refresh: the next tick window with work, a visibility change, or a reload. Inside a window that is at most 20 s. Between windows it is about 3 minutes when the press itself falls in a window, otherwise until the next one.
  - A run shorter than the gap between two refreshes may never be seen as running. The run log shows it, but the "finished" line does not.
  - A late `tick.yml` start can show up to about 3 minutes late, at the next window.
- **The index.** Migration 0060 adds `daily_rosters_member_uids_idx`, a GIN index on `member_uids`. `rosterSightings` now uses `@>` (`arrayContains`) instead of `= any`, which no index serves. `playerProgress` (`@>`) and member history and `sightingsElsewhere` (`&&`) already used operators the index serves. EXPLAIN ANALYZE on 24,000 invented rows:
  - `@>`: 66 ms, then 1.3 ms with a bitmap index scan;
  - `&&` with 100 uids: 805 ms, then 5 ms;
  - the old `= any`: 17.9 ms in a parallel sequential scan, even with the index there.
- **Tests.** `lib/tick-batch.test.ts` replaces the `batchMayRun` test in `read-status-wake.test.ts`. `app/_ui/admin/useRunWatch.test.ts` covers four cases: no refresh outside a window; no refresh in a window before `pollFrom`; every 20 s in a window from `pollFrom` on; every 4 s while a run is going. `lib/tick-gate.test.ts` adds `pollFrom`. `lib/queries/roster-stays.test.ts` shows `rosterSightings` returns the rows `= any` returned.

**Amendment (2026-11-21, issue 521, perf Batch 3): one database connection per request.**

- **Why.** Each `withPageDb` opened its own Pool and closed it when its read returned. One /admin render opened 6 Pools and 27 Postgres sessions; a desk page opened 2 Pools and up to 17 sessions. Every new session is a WebSocket, TLS and auth handshake from iad1 to Neon.
- **The rule.** `withPageDb` (`lib/page.ts`) keeps one Pool per request with React `cache`. Every read of the render shares it: the page, the layouts, `generateMetadata`, the desk frame's status bar (`frameReadStatus`, D135) and the public `UpstreamBanner`. Its close is registered with `after()` before the Pool is created, so it runs once, when the response is done: after streamed Suspense parts, and also when a render throws, calls `notFound()` or `redirect()`. A scope with no Next request cannot register the close, and then nothing is opened.
- **Reads that can outlive the request** keep a connection of their own, `withOwnDb`, closed when the read returns: both event-cache loaders in `app/_ui/event-page.ts` (`turnout-so-far`, and `progress`/`progress-done`). `unstable_cache` re-reads an expired entry in the background after the response, and another request can be the one waiting on the shared `inFlight` load (D79). Nothing a page runs from `after` reads the database.
- **This replaces** the note above that the frame keeps its own connection. No desk page changed: the frame's read reaches the page's Pool through the same `withPageDb`. The bar still renders nothing when its read fails, and the banner too.
- **Sequential reads.** A statement log of each view showed the chains are almost all data-dependent (session, then the workspace's reads; an event, then its snapshots). Two independent ones now run together: `latestQuota`'s two reads on /admin, and desk Home's `thanksNudge` with the page's other reads. The player page keeps `playerHistory` first, because a 404 then reads nothing more.
- **The request's Pool is small** (`REQUEST_POOL` in `lib/page.ts`): at most 3 connections, and an idle one closes after 200 ms. With the driver's defaults (10 connections, 10 s idle), the QA pass found that one Pool held every connection it had opened until `after`: 20 requests at once held 89 Postgres connections, against 44–56 with separate Pools, and bursts of 39 requests got 11–13 "too many clients" refusals against 0–9 (local `max_connections` = 100).
- **Every Pool listens for `error`** (`lib/db.ts`). An idle connection that fails is emitted on its Pool; with no listener Node threw it as an uncaught exception, which on Fluid Compute ends every request the instance serves. It is logged as the code `db.pool.idle_error` only. Before this change the same bursts showed up to 1 uncaught exception each.
- **Measured** (local production build, local Postgres 18 through the bridge, invented data with 24,240 `daily_rosters` rows; median of 5 views before and 7 after; ms is local and only a rough guide):

  | View                                   | Pools | Postgres sessions | Transactions | ms       |
  | -------------------------------------- | ----- | ----------------- | ------------ | -------- |
  | `/`                                    | 3 → 1 | 6 → 3             | 17 → 14      | 70 → 56  |
  | `/alliances`                           | 3 → 1 | 4 → 3             | 9 → 8        | 29 → 48  |
  | `/players/[uid]` (200, GIN index used) | 2 → 1 | 4 → 3             | 15 → 14      | 44 → 45  |
  | `/w/[slug]` (desk Home)                | 2 → 1 | 17 → 3            | 63 → 49      | 62 → 64  |
  | `/w/[slug]/members`                    | 2 → 1 | 13 → 3            | 48 → 38      | 68 → 62  |
  | `/admin`                               | 6 → 1 | 27 → 3            | 74 → 50      | 232 → 84 |

  Each new session costs one transaction in `pg_stat_database`, so the transaction cut equals the session cut. The statements themselves did not change. Under load (same mix of 39 pages at once, 4 bursts): 0 refusals and 0 uncaught exceptions, against 0–9 refusals and up to 1 uncaught exception before. 20 pages at once: 35–47 Postgres connections at peak, against 47–56.

- **Bounds this accepts.**
  - A request's reads share 3 connections. A page that starts more reads at once queues them; /admin, the widest, takes 84 ms locally against 63 ms with 10 connections and 232 ms before. No page code runs a transaction, so nothing can wait on itself.
  - When a client disconnects mid-stream, `after` runs at once and ends the Pool while reads may still be going. Those reads fail ("Cannot use a pool after calling end"); nobody is there to see the page.
- **Tests.** `lib/page.test.ts`: two reads of one scope share one `openDb` and close it once, after the scope; a read that throws still leaves one close; a scope that cannot register the close opens nothing. `frameReadStatus`'s failed-connection test now asserts the connection was tried.

**Amendment (2026-11-21, issue 521, perf Batch 4).** The public pages' reads are shared until the next write, and a page whose database does not answer says "Data temporarily unavailable": D143.

**Amendment (2026-11-21, issue 538).** The event-cache loader `turnout-so-far` named in Batch 3 is gone; the event page's reads are one D143 shared entry, read through `withOwnDb`, which now opens at most 3 connections.
