# fix-625-daily-read-targets: /admin/runs names a looked-up target the daily read never reached, and the automatic retry reads it (issue 625)

Branch `fix/625-daily-read-targets` from `origin/dev` (bd0044d2; rebased after #769 took 0079). Size M: one migration (one nullable column), no new decision, no route, no private field.

## Built

- **`daily_reads.target_ids bigint[]`** (`lib/schema.ts`, `drizzle/0080_stale_grim_reaper.sql`). Each claim of the day writes the targets of the attempt it starts: `claimDailyRead` (first read), `reclaimDailyRead` (/admin Retry) and `claimAutoRetry` (the tick's retry). The column holds the latest attempt's targets, the same list that attempt's outcome (`readDay`) is judged on. Null for days read before this change.
- **`problemsOf` (`lib/queries/daily-runs.ts`)**: a row of an alliance with a lookup claim that day counts when the alliance is in `target_ids`. Days with `target_ids` null keep the old rule (in the day's `tracked_sets`, or a `run_logs` line for it), so the last 60 reads on /admin/runs keep their problems.
- **`autoRetryDailyRead` (`lib/daily-read.ts`)**: an error-free roster no longer always counts as read. When the day has a lookup claim for that alliance and the roster is stale against the start of the read the retry completes (the 20-minute rule the outcome uses), the roster is the lookup's, and the retry reads that alliance again. `dailyRosterStates` (`lib/repo/daily-reads.ts`) returns `lookedUp` for this, as an `exists` on the `alliance_lookups` primary key in the same query.
- **Tests** (`lib/daily-read.test.ts`, describe "a looked-up alliance that became a target (issue 625)"). Setup: the alliance was looked up 3 hours before the read; the read at T0 has it as a target and stops at the quota rule before it reads any roster.
  - "is named on /admin/runs when the read stopped before reaching it": `listDailyReads` lists it, not failed.
  - "is read again by the tick's automatic retry, its lookup roster not counted as read": 15 minutes later the retry calls both targets.

## Decisions

- **The retry uses the lookup claim plus the read's own freshness rule, not `target_ids`.** `lib/lookup.ts` refuses a lookup for an alliance that is already a daily target ("daily"). So a looked-up alliance's roster was stored before the alliance became a target. When the read itself stops before that alliance (the failure case in the issue), the alliance is in the stored targets and its row is still the lookup's. The stored list cannot tell "the read read it" from "the read never reached it". Staleness at the read's start can: a lookup roster from before the read is older than the read's start minus 20 minutes, unless the lookup ran within 20 minutes before the read. In that case the outcome counts the roster as fresh and no retry is needed.
- **Latest attempt's targets, not the union of the day's attempts.** /admin/runs then matches the outcome of the attempt it shows.
- **Old rule kept only for null days.** When `target_ids` is set, the tracked-set and `run_logs` probes are not needed: both are covered by the stored list.

## Deviations

- The issue proposes using the stored targets in `autoRetryDailyRead`. It uses the lookup claim and staleness instead, for the reason above. The stored list alone does not close the retry case.

## Verified

- `pnpm vitest related --run lib/daily-read.ts lib/repo/daily-reads.ts lib/queries/daily-runs.ts lib/schema.ts`: 381 files passed, 2 skipped; 2051 tests passed, 4 skipped, after the rebase.
- `pnpm check` passed: prettier, eslint, tsc, vitest (381 files passed, 2 skipped; 2051 tests passed, 4 skipped, after the rebase), drizzle drift, i18n (17 languages up to date).
- Each new test fails when its fix is broken on purpose (one break at a time, then restored):

  | Break | Test that fails |
  | --- | --- |
  | `problemsOf` without the `target_ids` branch (`false`) | is named on /admin/runs when the read stopped before reaching it |
  | `autoRetryDailyRead` ignores `lookedUp` (`false &&`) | is read again by the tick's automatic retry |
- No upstream call, no production access, no `.env*` read.
- Analytics plan: no change. /admin read model and the tick's retry only.

## Open issues

- A looked-up alliance whose roster the read itself re-read, and which upstream served stale, is read once more by the automatic retry: one extra call, once per day. Before this change no stale roster was retried.
- `autoRetryDailyRead` now reads the day's `daily_reads` row before it knows whether anything is missing: one more primary-key query on each tick in the read window after the first read, on a database that is already awake for `dayTargets` (D141 is not affected).

## What was missing from the task prompt?

That a lookup is refused for an alliance that is already a daily target. This is why the stored target list closes the /admin/runs half of the issue but not the retry half.

## Next

- Apply migration `0080_stale_grim_reaper` with the release (one nullable column, no backfill).
- Close issue 625 with this PR.

PR: (added by the orchestrator)
