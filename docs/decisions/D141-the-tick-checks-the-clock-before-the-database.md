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
- **What only the database knows is kept, once it holds.** Two facts are kept in Next's data cache, shared by every instance: "no rehearsal is pending" and "this day's squads queue is settled" (`lib/wake-cache.ts`, `ctx.wakeCache`). While a fact does not hold, every tick checks the database again, and the work it waits for needs the database anyway. The writes that can change a fact forget both: `POST /api/rehearsal`, `POST /api/daily-read/retry`, a tracker key saved or removed, an alliance's feature switch and /admin's switches. A kept fact is checked again after 24 h at the latest, in case a forget was missed. A new quota day uses a new key.
- **The heartbeat and the watcher (amends D45).** An idle tick writes no `tick_log` row any more. Every tick in the first 15 minutes of 00, 06, 12 and 18 UTC opens the database (`heartbeatSlot`). The watcher reads the tick log only half an hour later, at :30–:45 of those hours (`watchSlot`), and answers 204 with no query at any other time. Its rule is the same: no tick for more than 60 minutes means one admin alert. A stopped scheduler is now noticed within about 6 h 45 min, not 75 minutes. /admin's "last tick" shows the last tick that opened the database.
- **The status bar's poll (amends D135).** While a line is running, the bar's 30 s poll asks only in the first 5 minutes of each 15-minute tick slot (`batchMayRun`). Reads change only then, because each tick's batch ends within its own work (100 s) plus its `after` (180 s). The database is awake for that batch anyway. Becoming visible still asks at once. The frame keeps its own connection, because the page's own read wakes the database in the same request. Moving the bar's read onto the page's connection would mean changing every desk page, and it would save no wake.

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
- `app/api/tick/watch/route.test.ts`: the alert and the quiet case fall in the watcher's slot; outside it, no query.
- `app/(private)/_ui/read-status-wake.test.ts`: the poll asks only in the first 5 minutes of each tick slot.
