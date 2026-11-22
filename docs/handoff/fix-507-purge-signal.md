# fix: a failed daily clean-up shows on /admin (#507)

Size: S. No migration, no new decision, no private-field flow change, no quota use. It writes a few more `run_logs` lines and shows one more /admin row.

## Built

- `lib/tick.ts` `purgeWorkspaces`: each of the three daily jobs after the day's first read (the D125 workspace purge, the D132 90-day `player_reads` raw clear, the D115 30-day `app_errors` purge) now also writes its outcome into the run log of that day's daily read (`run_logs`, `read_day` = the read's day). On success it writes `workspaces.purged`, `players.raw_cleared` and `app_errors.purged` with their counts. On failure it writes `workspaces.purge_failed`, `players.raw_clear_failed` and `app_errors.purge_failed`, each with the error's class name only. One workspace that fails inside a purge that otherwise ran also writes `workspaces.purge_failed`. The console lines and the PostHog handled exception (`reportError`) are unchanged. The run logger mirrors error lines to the console, so `tickJobFailed` no longer calls `console.error` itself when it is given the logger. The weekly notice-picture prune still uses it without a logger, as before.
- `lib/queries/admin-page.ts` `failedCleanups(db, now)`: for each job, the newest of its two lines in the last 7 days of read logs (`read_day >= now − 7 days`, on `run_logs_read_day_idx`). A job counts as failed when that newest line is its failure line. `loadAdminPage` returns this list as its last element.
- `app/_ui/admin/needs-you.ts`: a new "Daily clean-up" row, placed after "App errors". Its state is one phrase per failed job, joined with " · ":
  - "The 90-day clean-up failed on Sun, Nov 8"
  - "The 30-day error clean-up failed on Sun, Nov 8"
  - "A workspace deletion failed on Sun, Nov 8"

  The day is the failure line's time as `clock.weekday` formats it on the page. The row links to `/admin/runs/daily/<day>` for the newest failure. That page's run log lists the failed line with its error class. Copy is in `lib/copy-admin-needs.ts` (English only, D48).
- The row clears once a later night's run of the same job writes its success line.

## Decisions

- Where the outcome is stored: in `run_logs`, under the day's daily read. `tickJobFailed` wrote nothing durable: `reportError` writes no `app_errors` row by design (D115, 2026-11-21 amendment, "Handled errors"). `app_errors` also keeps no successes, so it could not clear the row. Run log lines under a `read_day` already exist for the squads batches (`squads.batch`, D132). The daily run page already lists them, so the owner can see the failed line there. No migration was needed.
- The same code path covers all three jobs. Each one runs in `purgeWorkspaces` and fails through `tickJobFailed`, so all three were done together. The notice-picture prune (D119) also uses `tickJobFailed`, but it runs weekly in the Friday quota check, where there is no daily read to log under. It is left as it was.
- One row for all three jobs, not one row per job. Every other "Needs you" row is one row per kind, and a database outage usually fails all three jobs on the same night. The row links to the newest failure's run log.
- The 7-day window keeps the read bounded on a table that grows forever (D149). Assumption: a failure stays visible for up to a week of nights on which the jobs did not run at all. That happens only when the tick never claimed the day's first read, and other rows (Scheduler, Daily read) cover those nights.

## Deviations

- None from the task. The workspace purge's per-workspace failures (`failed` inside a purge that ran) also count as a failed job. The task did not say whether they should. The owner should see them, and they already used the same `workspaces.purge_failed` code.

## Verified

- `app/api/tick/daily-jobs.test.ts` (PGlite, real `POST /api/tick`, the real `clearOldPlayerRaw` wrapped so that it rejects once):
  - "shows 'The 90-day clean-up failed' in Needs you, linked to that night's run log": the row is `["Daily clean-up", "The 90-day clean-up failed on Sun, Nov 8", "/admin/runs/daily/2026-11-08"]`.
  - "clears the row once a later night's clean-up succeeds": the row is still there before the next night's read, and gone after it.
- Breaks I made on purpose, each reverted afterwards:
  - `tickJobFailed` called without the logger for the raw clear, so no failure line is written: both tests fail.
  - `failedCleanups` reading only failure lines, so a success never clears the row: the "clears" test fails.
  - `needsYou` dropping the row (`cleanups.length > 99`): both tests fail.
- `pnpm check`: exit 0. 322 test files passed and 2 skipped. 1701 tests passed and 4 skipped. Prettier, eslint, tsc, the drift check and i18n all pass.
- Analytics plan: no change. No event was added, changed or removed. The PostHog `$exception` from `reportError` is the same as before.
- #507's list checked against dev:
  - The Settings item is done (D135 amendment: `squadsReader` in `settings/page.tsx`).
  - The newcomer test was fixed so that it fails when the code is broken (#630).
  - The purge test was added (#630, `daily-jobs.test.ts`).
  - The partial `read_at` index was added (#631, `player_reads_raw_read_at_idx`).
  - The roster is no longer re-queued after every answer (#631).
  - The /admin signal is this change. Nothing on #507 is left open.

## Open issues

- A night on which the database is down fails the jobs and also fails to write their failure lines. The row then shows nothing for that night, but the tick and the daily read fail too, and other rows show those.
- Not done (not asked): no decision amendment. D132's "The 90-day clean-up" bullet and D115's "Retention" bullet do not mention that the outcomes are now also run log lines. If the owner wants them recorded, add one dated line to each.
- /admin's e2e (`e2e/`) does not cover the new row. Seeding a failed purge would need a `run_logs` row in the seed.

## Next

- Follow-up: a test for `failedCleanups` itself (a failure older than 7 days; one job failed then succeeded beside another that still failed).
- Follow-up: tests for the workspace purge failing (whole run, or one workspace) and the app_errors purge failing, so their codes cannot drift.
- Follow-up: an /admin e2e assertion for the row once the seed carries a `run_logs` failure line.
- A new daily job that adds its own pair of codes to `CLEANUP_CODES` and to `copy.admin.needs.cleanupFailed` gets the "Needs you" row with no other change.

What was missing from the task prompt? Which log codes the jobs should write; I named them `<job>.<done>` / `<job>.<failed>` after the existing run log codes.

PR: https://github.com/daniro-san/LAPTracker/pull/642
