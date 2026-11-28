# fix-625-daily-read-targets: /admin/runs names a looked-up target the daily read never reached, and the automatic retry reads it (issue 625)

Branch `fix/625-daily-read-targets` from `origin/dev` (5b6fe6c9; rebased after #769 took 0079 and #784 took 0080). Size M: one migration (two nullable columns), no new decision, no route, no private field. D72 is respected and not amended.

## Built

- **Migration `drizzle/0081_closed_king_cobra.sql`** (drizzle's generated tag), two nullable columns, no backfill:
  - `daily_reads.target_ids bigint[]`. Each claim of the day writes the targets of the attempt it starts: `claimDailyRead` (first read), `reclaimDailyRead` (/admin Retry) and `claimAutoRetry` (the tick's retry). It holds the latest attempt's targets, the list that attempt's outcome (`readDay`) is judged on. Null for days read before this change.
  - `daily_rosters.stored_at timestamptz`. `storeDailyRoster` takes the write time and sets it on insert and on the upsert; the read passes `deps.now()`, the lookup (`lib/lookup.ts`) its own `deps.now()`. Null for rows written before this change.
- **One shared rule, `lookedUpThatDay(db)`** (`lib/repo/alliance-lookups.ts`): an `exists` on the `alliance_lookups` primary key, correlated with the `daily_rosters` row (same alliance, same day). `problemsOf` and the retry both use it. `lib/queries` importing `lib/repo` follows `docs/ARCHITECTURE.md` (`problemsOf` already imports `lib/repo/alliances`). `dailyRosterStates` is unchanged from dev, so `readDay` is untouched.
- **`problemsOf` (`lib/queries/daily-runs.ts`)**: a row of a looked-up alliance counts when the alliance is in `target_ids`. Days with `target_ids` null keep the old rule (in the day's `tracked_sets`, or a `run_logs` line for it), so the last 60 reads on /admin/runs keep their problems.
- **`autoRetryDailyRead` (`lib/daily-read.ts`)**: `lookupRostersBefore(db, day, before.startedAt)` (`lib/repo/daily-reads.ts`) lists the error-free rosters of looked-up alliances stored before the start of the read the retry completes. The read never replaced those rosters, so the retry treats them as missing and reads them. A roster stored at or after the read's start, stale or not, still counts as read, so it is never read again automatically (D72: "A roster that was read but is stale is not read again automatically").
- **Tests**:
  - `lib/daily-read.test.ts`, describe "a looked-up alliance that became a target (issue 625)". The alliance was looked up 3 hours before the read at T0. Its roster is stored as `lib/lookup.ts` stores it, with the same members the read returns, so the identity check passes.
    - "is named on /admin/runs when the read stopped before reaching it": the quota rule stops the read; `listDailyReads` lists the alliance, not failed.
    - "is read again by the tick's automatic retry, its lookup roster not counted as read": same stopped read; 15 minutes later the retry calls both targets.
    - "is not read again when the read itself stored its roster, stale from upstream (D72)": the read stores that alliance's stale copy and fails the other target; the retry calls only the other one.
  - `lib/queries/daily-runs.test.ts`: "names no looked-up alliance outside the targets the read stored". `target_ids` is set, and a looked-up stale roster of an alliance outside it gives no problem row.
  - `lib/repo/daily-reads.test.ts` (new): "/admin's Retry stores its own targets" and "the tick's automatic retry stores its own targets".

## Decisions

- **The retry uses the roster's own write time, not `target_ids` or `source_updated_at`.** `lib/lookup.ts` refuses a lookup for an alliance that is already a daily target ("daily"), so a looked-up roster is stored before the alliance becomes a target. When the read stops before that alliance, the alliance is in `target_ids` and its row is still the lookup's. The stored list cannot tell "the read stored it" from "the read never reached it"; `stored_at` before the read's start can. `source_updated_at` cannot: a roster the read stores can be just as old upstream.
- **The under-20-minutes boundary no longer applies.** The rule is now "stored before the read's start", not freshness. A lookup 5 minutes before a read that then stops before that alliance is retried. That costs one call and replaces a lookup's cached copy with a read.
- **Latest attempt's targets, not the union of the day's attempts.** /admin/runs then matches the outcome of the attempt it shows.
- **Old rule kept only for null days.** When `target_ids` is set, the tracked-set and `run_logs` probes are not needed.

## Deviations

- The issue proposes using the stored targets in `autoRetryDailyRead`. It uses the lookup claim and `stored_at` instead, for the reason above.

## Verified

- `pnpm vitest related --run` on the changed files: 383 files passed, 2 skipped; 2075 tests passed, 4 skipped.
- `pnpm check` passed: prettier, eslint, tsc, vitest (383 files passed, 2 skipped; 2075 tests passed, 4 skipped), drizzle drift ("nothing to migrate"), i18n (17 languages up to date). One earlier run had four 10 s timeouts in unrelated files (`lib/squads-read.test.ts`, `lib/queries/carried.test.ts`, `app/(pages)/admin/gate.test.ts`, `app/(private)/api/w/[slug]/cross-workspace.test.ts`); they passed alone and in the next full run.
- Each fix's test fails when the fix is broken on purpose (one break at a time, then restored):

  | Break | Test that fails |
  | --- | --- |
  | `problemsOf` without the `target_ids` branch (`false`, first round) | is named on /admin/runs when the read stopped before reaching it |
  | `problemsOf` targets branch always true (`true`) | names no looked-up alliance outside the targets the read stored (and the older "never a lookup's roster" test) |
  | The retry counts every error-free roster as read (no `lookupRostersBefore`) | is read again by the tick's automatic retry |
  | `lookupRostersBefore` without `stored_at < before` | is not read again when the read itself stored its roster, stale from upstream (D72) |
  | `reclaimDailyRead` and `claimAutoRetry` do not set `target_ids` | both tests in `lib/repo/daily-reads.test.ts` |

- No upstream call, no production access, no `.env*` read.
- Analytics plan: no change. /admin read model and the tick's retry only.

## Open issues

- **An /admin Retry after the first read.** The first read stores a looked-up alliance's roster; then /admin Retry moves `started_at` and stops before that alliance; then the tick's automatic retry runs. The roster was stored before the Retry's start, so the automatic retry reads it once more. The cause: `before.startedAt` is the latest attempt's start, and the first attempt's start is not stored. It needs a looked-up alliance, a short Retry and the automatic retry on the same day. The cost is one call.
- `autoRetryDailyRead` now runs two small queries (the day's `daily_reads` row, then `lookupRostersBefore`) before it knows whether anything is missing, on each tick in the read window after the first read. The database is already awake for `dayTargets` (D141 is not affected).

## What was missing from the task prompt?

That a lookup is refused for an alliance that is already a daily target, and that `daily_rosters` had no write time. The stored target list closes the /admin/runs half of the issue; the retry half needed the roster's write time.

## Next

- Apply migration `0081_closed_king_cobra` with the release (two nullable columns, no backfill).
- Close issue 625 with this PR.

PR: (added by the orchestrator)
