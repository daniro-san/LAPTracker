# perf batch 2: a heartbeat every 3 h, and the watcher runs inside uptime.yml (issue 521)

## Built

- `lib/tick-gate.ts`:
  - `HEARTBEAT_EVERY_H = 3`. `heartbeatSlot` is the first 15 minutes of 00, 03, … 21 UTC.
  - `watchSlot` is removed.
  - New `heartbeatBoundary(now)`: the latest 3-hour UTC boundary at least 10 minutes before `now`.
- `lib/tick.ts` `watchTicks`: alerts when the newest tick started before `heartbeatBoundary(now)`, or no tick was ever recorded. The once-per-hour claim (`TICK_SILENCE_MS`, now only the claim's repeat gap) and the message are unchanged.
- `app/api/tick/watch/route.ts`: no slot gate; every authorized call runs `watchTicks`.
- `.github/workflows/uptime.yml`:
  - the cron is `10 0,3,6,9,12,15,18,21 * * *`;
  - a new step "Watch the ticks" runs after the probes (`if: ${{ !cancelled() }}`, so it also runs when a probe failed). It POSTs `/api/tick/watch` with `Authorization: Bearer $CRON_SECRET` from `${{ secrets.CRON_SECRET }}`, the same as `tick.yml`. A non-2xx answer fails the run, so GitHub emails the owner;
  - `timeout-minutes` goes from 5 to 8;
  - the header comment is fixed: the run at :10 does wake the database, which has usually suspended by about :05. The probes and the watcher share that one wake.
- Tests:
  - `lib/tick-gate.test.ts`: the heartbeat is open at 03:05 and shut at 04:05.
  - `app/api/tick/watch/route.test.ts`, rewritten as 3 tests:
    - an alert when the 12:00 heartbeat never came, and none on a re-run;
    - no alert when a tick came in the slot, for a run on time, 50 minutes late or 3 h late;
    - the 00:00 UTC slot across the day boundary.
  - Two existing tests that used 15:xx UTC as an idle time now use 16:xx, because 15:00 is a heartbeat hour.
- Dated amendments (2026-11-21) to D141 and D45.

## Decisions

- **Boundary with a 10-minute grace.** The spec says to compare with "the current 3-hour boundary". A plain floor would judge the new slot from 00:00:00 onward, so a run starting a few seconds after a boundary, before that slot's tick, could raise a false alert. That run can be a manual dispatch, or one GitHub started almost 3 h late. With the grace, the watcher judges a slot only from :10, when uptime.yml runs. By then cron-job.org's :00 tick has written its row. A run GitHub starts late judges the slot it was meant for, until the next slot is 10 minutes old.
- **The watcher runs even when a probe fails**, so a stopped scheduler is still reported on a day the pages are also failing.
- **One try for the watcher POST**, not two like the probes. The claim makes a manual re-run safe, and a failure already fails the run.
- Panel: `timeout-minutes` raised to 8 (adversarial persona). The worst case was about 270 s against a 300 s limit, and a timed-out job would skip the watcher.

## Deviations

- `heartbeatBoundary` subtracts 10 minutes before flooring (see Decisions). Without it, "the current boundary" could cause a false alert at the boundary itself.

## Verified

- `pnpm check` passes: prettier, eslint, tsc, vitest (267 files passed, 2 skipped; 1404 tests passed, 4 skipped), drift, i18n (17 languages).
- Targeted: `pnpm vitest run lib/tick-gate.test.ts app/api/tick`: 3 files, 25 tests passed.
- Panel (technical, adversarial, SRE, the owner and an R5, product strategy): every persona approved, some with changes. Applied: the release order is now explicit (disable the cron-job.org watcher job as soon as the release is live), and `timeout-minutes` goes to 8.
- QA pass, no bug found:
  - a minute-by-minute sweep over two days, including 00:00 UTC: the slot is open exactly at minutes 0–14 of every third hour. A tick at S+0, S+7 or S+14 raises no false alert for runs that start late. A missed slot alerts.
  - local production build with a local Postgres: ticks write `tick_log` rows in the slot. Watch answers 401 for a wrong secret and 204 for the right one. One alert per missed slot. One query per watch call. /admin's "last tick" still reads `tick_log`.
  - the workflow's two `run:` scripts under bash, against the local server: the probes pass. The watch step passes on 204 and fails on 401 or with the server down. The secret never appears in the output.
- No upstream, Discord, Neon, Vercel or cron-job.org call. `/api/quota` was not called.
- No screenshots: nothing visible changed.

## Open issues

- **Owner step:** disable the watcher job on cron-job.org as soon as the release is live. Until then it calls the route every 15 minutes, and each call now reads the tick log: about 4 extra database wakes an hour. It raises no false alert, because it uses the same slot rule.
- **Wakes a day, fixed part.** Before this batch: 12 (4 heartbeats, 4 uptime runs at :10, 4 watcher reads at :30). After: 16 (8 heartbeats, 8 uptime runs that also watch). That is about 20 more compute minutes a day. In exchange, a stopped scheduler is noticed in about 3 h 10 min plus GitHub's delay, not 6 h 45 min. A `tick.yml` run at :07 inside a slot is one more wake when GitHub runs it on time, and the :10 run then shares it. Saturday's event span (12:00–16:45 UTC) already covers the 12:00 and 15:00 heartbeats.
- A slot whose cron-job.org :00 tick is lost, and whose `tick.yml` :07 tick is dropped or runs after :15, has no heartbeat row, so the run alerts. The scheduler did miss that slot. This was also true with the 6-hourly heartbeat. If this turns out noisy, a follow-up could widen the slot to 30 minutes and move uptime.yml to :25. That costs one more wake per slot, for the :15 tick.
- QA side note (D141, not changed here): an idle tick on some dates still makes one `daily_reads` query (`squadsMayRun` before its fact is kept).
- A GitHub-wide outage of scheduled runs stops the watcher. A cron-job.org outage is now caught by it.

## Next

- Model/effort: keep.
- Owner first: release, then disable the cron-job.org watcher job. Watch Neon's compute hours per day for a week.
- Plan change: none.

<adjustments>
- `POST /api/tick/watch` now has one caller, `uptime.yml`, and reads the database on every call. Do not add another scheduled caller.
- Batch 4 keeps `/w/request` as uptime.yml's database probe. The watcher step needs no change there.
</adjustments>

PR: (added by the orchestrator)
