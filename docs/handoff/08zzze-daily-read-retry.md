# 08zzze — Daily read retry, runs filter, full admin line

Owner requests, 2026-11-12. That day's 06:00 daily roster read closed `failed`: every `/v1/alliances/:id` call hit the 30 s `TIMEOUT_MS`, and the 100 s deadline stopped the run. The owner asked for three things, all in this PR:
1. An `/admin` button that runs a failed day again.
2. Daily reads on `/admin/runs`, with a filter: All / Events / Daily reads.
3. The two follow-ups found while building 1: list every alliance the read did not get in the admin line, and allow a retry of a day left `running` by a killed function.

## Built
- **Retry.**
  - `lib/repo/daily-reads.ts`: `reclaimDailyRead(db, day, startedAt, staleBefore)` is one conditional `UPDATE` back to `running`. It matches `status = 'failed'`, or `status = 'running' AND started_at < staleBefore`, so exactly one caller wins. Then it deletes that day's `daily_rosters` rows. A failed read has only error rows, and a killed read may have stored part of its rows. `daily_rosters_day_union_unique` would refuse the new rows otherwise.
  - `lib/repo/daily-reads.ts`: `getDailyRead(db, day)` returns status, start, finish, calls and error, for `/admin`. `finishDailyRead` now adds `callsUsed` to the stored value; a first read starts at 0.
  - `lib/daily-read.ts`: `runDailyRead` is now the claim plus `readDay` (the old body). `retryDailyRead` computes `staleBefore = now − RUN_STALE_AFTER_MS` (150 s, INVARIANT `run.stale-after-150s`), then runs `reclaimDailyRead` plus the same `readDay`.
  - `lib/schedule.ts`: `serverDay(now, cfg)` returns the server date as `daily_reads.day`.
  - `app/api/daily-read/retry/route.ts`: `POST`, PIN only through `authorize` (same rate limiter), no query, `maxDuration = 120`. It answers 200 with `{ day, status, calls_used, error, failed, stale }`, or 409 `daily_read_not_retryable`.
  - `/admin` "Run something now": `app/_ui/admin/DailyRetry.tsx` is a "Daily roster read" block with a **Retry** button and the cost tag "≈ 21 calls". It shows when `dailyView` (`app/_ui/admin/words.ts`) returns a line:
    - "Today's read failed at {time}: {error}. API calls used today: {n}." when the read failed;
    - "Today's read started at {time} and never finished." when it has been `running` for 150 s or more.
  - The button uses the confirm sheet and PIN flow (`DAILY_RETRY` in `actions.ts`). It is off while a snapshot runs. `app/_ui/admin/outcome.tsx` puts the answer in words: "✓ Daily roster read done. API calls used: 21. Stale: 0. Failed: 0."
- **Full admin line.** `readDay` builds `failed` with the collector's `failedList`: error rows, then each alliance the read never reached as `not fetched: <reason>` (deadline, 429, call cap, quota rule). Stored rows are unchanged. On 2026-11-12 the line would have listed 12 × `v1 TimeoutError` and 8 × `not fetched: deadline`.
- **Runs list.**
  - `lib/queries/daily-runs.ts`: `listDailyReads(db, 60)` returns each read with `durationMs` (finish − start), `deadline`, and `problems`. `problems` are the failed or stale alliances: only `union_id`, tag and the flag are read from `daily_rosters`.
  - `lib/queries/admin.ts`: `DEADLINE_ERROR` is now exported.
  - `app/_ui/admin/RunRows.tsx`: `SnapshotRunRow` (the old row, moved out of the page), `DailyRunRow` (same layout, not a link, titled "Daily roster read" with the read's date, "{n} left before this read") and `RunsFilter` (links like the member history filters, 44 px).
  - `app/(pages)/admin/runs/page.tsx`: reads `?show=events|daily` and loads only what the filter needs. It merges by start time, newest first, 60 entries.
  - The page title and nav label are now "Runs" instead of "Snapshot runs". The help line says daily reads keep no log.
- Copy: `copy.admin.run.daily.*`, `refusals.daily_read_not_retryable`, `copy.admin.runs.{noneShown, show, filters, daily, quotaBefore}` (`lib/copy-admin.ts`, English only, D48).
- Docs: D60 has three new bullets (retry, every alliance in the admin line, `/admin/runs`). The README runbook has a "Daily roster read failed" item and the `/admin/runs` row now mentions daily reads. `docs/DESIGN.md` notes the filter links.
- Tests changed only for new signatures: `AdminActions.test.ts` passes `daily: null`; `gate.test.ts` passes `searchParams` to `RunsPage`. No assertion changed.

## Decisions
- **Only today, only `failed` or killed.** A `partial` day keeps data rows, so a retry would have to merge with them, and that was not asked for. A past day is never retried, because a read made today would be stored under the earlier date.
- **A stuck day is taken back only from `/admin`.** The tick keeps one claim per day. Who retries stays a person's decision, as for a failed day.
- **150 s for "killed"** is `RUN_STALE_AFTER_MS`, the snapshots' rule. The tick route also has `maxDuration` 120.
- **No Discord line for a retry.** The owner pressed the button and sees the outcome on the page. The tick's read still sends its admin line.
- **`calls_used` is the day's total** across attempts.
- **Unreached alliances get no row**, as in the collector. They appear only in the summary (Discord line and retry answer). On `/admin/runs` a deadline read shows its stored failed alliances and the deadline chip.
- **Filter default is All**, and **rehearsals and manual rounds are under Events** (owner confirmed both, 2026-11-12). The page loads 60 of each kind and keeps the newest 60, so All is not short of either kind.
- **Daily row date** is `clock.weekday(startedAt)`: a read always starts on its own server day.
- `AdminActions` was at the 80-line function limit. The Retry block went into its own file, like `ManualSection`, and `locked` was inlined to stay under the limit.

## Deviations
- No committed test. The tasks did not ask for one (CLAUDE.md "Commit tests only where the task asks for them"). I had said in chat that I would commit tests; I followed CLAUDE.md instead. Behavior was checked with temporary tests, deleted before the commit (see Verified).

## Verified
- Temporary PGlite tests (`vitest run`, 6 tests in two runs, all passed, then deleted):
  - Failed day (every call a `TimeoutError`), then a retry with a working source: the retry returns `complete`, the day's rows are data rows only, the row reads `complete` with calls summed (4 + 4 = 8), and a second retry returns null.
  - Refused: no row for the day, and a `partial` day. Two retries at once on a failed day: exactly one runs.
  - `running` day: a retry at 149 s returns null; at 151 s it runs and closes `complete`. `dailyView`: no card at 149 s, the "never finished" line at 150 s, no card for `complete`.
  - Read stopped by a 429: `failed` lists every unreached alliance as `not fetched: quota exhausted (429)`. The rendered admin line lists all 6 of 6.
  - `listDailyReads` after a partial read: `status partial`, `callsUsed 3`, `durationMs 0`, one problem (`failed: true`) for the timed-out alliance. `DailyRunRow` and `RunsFilter` render with `aria-current` on the chosen filter.
  - Route: no PIN returns 401. A day that cannot be retried returns 409. After a failed read it returns 200 with `status complete`, `calls_used 21`.
- Local `next dev` against the Neon preview branch, admin session opened with the PIN from `.env.local`:
  - `/admin/runs` (All) and `?show=events` each list the 8 snapshot runs, with the filter marked current.
  - `?show=daily` shows "No runs of this kind yet." The preview branch has no `daily_reads` rows.
  - `/admin` returns 200 with no Retry block and the nav label "Runs".
- `pnpm check`: prettier, eslint, typecheck, 254 tests passed (1 skipped), drift check "No schema changes", i18n "17 languages up to date".
- Not run: a 360 px screenshot. The new parts use existing classes (`tint-button`, `drawn-frame-soft`, `min-h-11`, the runs list layout).
- No upstream call was made.

## Open issues
- A `partial` day cannot be retried (see Decisions).
- Server-side, the retry does not refuse while a snapshot runs. The page turns the button off then, and the quota rule (`dailyReadQuota`) keeps the event reserve either way.
- On `/admin/runs`, a daily read the deadline closed shows only the alliances with a stored row. The unreached ones are named only in the Discord line, because they have no row.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. All checks passed on the first full run; the only rework was the ESLint length limits and one text edit that cut a JSX block at the wrong brace.
Owner must do first: merge this PR into `dev`. The next time a daily read fails, open `/admin` and press **Retry** once to see it work on production (≈ 21 calls). Then check that `/admin/runs?show=daily` lists the day.
Plan changes needed: none.

<adjustments>
- `retryDailyRead` and `POST /api/daily-read/retry` exist. A later retry for `partial` days should reuse `readDay` and decide how to merge with the existing data rows (the unique key is `(read_day, union_id)`).
- `daily_reads.calls_used` is now the day's total across attempts, because `finishDailyRead` adds to the stored value.
- `/admin/runs` takes `?show=events|daily`. A new kind of run joins through `RunRows.tsx` and one more filter key in `RUN_FILTERS`.
- `AdminActions` is at 80 counted lines (the function limit). New `/admin` actions should go in their own component file, like `DailyRetry.tsx` and `ManualSection.tsx`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/239
