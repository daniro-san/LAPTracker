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
