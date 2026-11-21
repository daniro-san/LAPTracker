# perf-521 — fewer database wake-ups (issue 521)

## Built

- `lib/tick-gate.ts`: the clock-first gate.
  - `tickClockDue`: the tick's own windows. These are the event's row in the first hour of its day-ahead window; Before to After's window, with samples; the Friday check; a REHEARSAL_AT slot until its rehearsal's After window closes; the daily read; and the 6-hourly heartbeat slot.
  - `squadsMayRun`: from the quota day's daily read until the 00:00 UTC reset, and only until the day is settled.
  - `tickMayBeDue`: the clock rules, the shield windows, the squads rule, or a pressed rehearsal still pending.
  - `heartbeatSlot` and `watchSlot`.
- `lib/wake-cache.ts` (`ctx.wakeCache`): Next's data cache. It keeps a fact only once it holds: "no rehearsal pending" and "squads settled for day D". While a fact does not hold, it is not kept, so every tick checks the database again. The test double is `memoryWakeCache`.
- Routes:
  - `POST /api/tick` answers 204 before any query when nothing can be due. No heartbeat row and no squads batch are written then.
  - `POST /api/tick/watch` reads the tick log only at :30–:45 of 00/06/12/18 UTC.
  - `POST /api/squads-read` asks nothing when the queue cannot have work.
- Forget hooks, each after its write: `/api/rehearsal` (also on 409 "pending"), `/api/admin/workspaces`, `/api/daily-read/retry`, `/api/w/[slug]/features`, `/api/w/[slug]/tracker-key`, `/api/admin/workspaces/features`.
- Status bar (D135): the 30 s poll asks only in the 5 minutes after each cron-job.org or `tick.yml` tick (`batchMayRun`). Becoming visible still asks at once.
- D141 and README. Dated amendments in D45, D132 and D135.
- Tests: `lib/tick-gate.test.ts` (6 tests), plus additions in the tick, watch and read-status-wake tests. Shared helper: `noQueryDb` in `lib/db.test-helpers.ts`.

## Decisions

- D141: D138 (PR 520) and D139 (PR 522) are merged, and D140 is taken by the Follow-up PR (#460).
- Heartbeat every 6 h instead of every tick. A stopped scheduler is noticed within about 6 h 45 min instead of 75 min. This is the price of "no query on an idle tick".
- When the gate opens, the tick runs exactly as before. No quota, reserve, claim or once-per-member/slot/phase rule changed.
- The frame's own status-bar connection stays. It shares the request with the page's own read, so it adds no wake. Folding it into the page would touch every desk page for no saving.

## Deviations

- The task said "the squads queue after the daily read until done". "Done" can only be known from the database. So the gate uses a kept fact in Next's data cache, not a clock rule alone. Forget hooks keep the fact correct when a key, a switch or a Retry changes the targets.
- On a settled day, `/api/squads-read` answers 204 instead of 200 with `more:false`. `tick.yml` stops on both.

## Verified

- `pnpm check` passes: prettier, eslint, tsc, vitest (265 files, 1395 tests passed, 4 skipped, after the review fixes), drift, i18n.
- E2E on a local production build (`next build`, `next start` :3940), local Postgres 18 with 60 migrations and the bridge. The env made "now" (Fri 22:16 ST) idle, with no upstream reachable. Transactions were counted from `pg_stat_database`, with the psql baseline subtracted:
  - tick 1: 204, 3 queries (it loads the facts);
  - ticks 2 and 3: 204, **0 queries**;
  - watch outside its slot: 204, 0 queries;
  - `/api/squads-read`: 204, 0 queries;
  - `/api/rehearsal` press: 201;
  - the next tick opened the database (10 transactions, one `tick_log` row);
  - another tick with the rehearsal still pending opened it again (10), so a false fact is not kept.
- No upstream, Discord, Groq, Neon or Vercel call. `/api/quota` was not called.
- No screenshots: nothing visible changed.
- Rebased onto `origin/dev` at `f589228e` (D138, D139). The only conflict was `docs/decisions/README.md`; I kept both sides. D138 runs inside the collector and the daily read, which are both gated windows. D139 is page reads only, and its `insights` switch goes through the feature routes that already forget the kept facts. The D137 shield windows open the gate from the clock (a new test).

## Open issues

- Estimate (D141): from about **8–16 h** of database-awake time a day to about **2 h** (about 1.5 h on weekdays, 3 h on Friday, 3.5 h on Saturday). The owner should check this on Neon's compute graph for a week after the release.
- `vercel.json` runs `pnpm db:migrate` on every dev and main deploy. That wakes the database (and dev's branch, if it is in the same Neon project) on each deploy. Not changed: this is a Vercel or Neon setting.
- `tick.yml`'s schedule and the watcher's 15-minute cron-job.org cadence could be dropped or slowed. They now cost a function call but no query.
- /admin's "last tick" now shows the last tick that opened the database, which can be up to 6 h old on a quiet day.
- A tick that checks for a rehearsal at the same instant as a press can keep "no rehearsal pending". The window is one query long; a second press fixes it.

## Next

- Model/effort: keep.
- Owner first: merge, then compare Neon's compute hours per day before and after (a week).
- Plan change: none.

<adjustments>
- Ticks no longer write a heartbeat when idle. Any new scheduled job must add its window to `tickClockDue` (or to a kept fact in `lib/tick-gate.ts`), or it will never run.
- A write that changes squads targets or creates a rehearsal outside the tick must call `ctx.wakeCache.forget()`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/524
