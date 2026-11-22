# fix-admin-runs-lookups: /admin/runs no longer lists a lookup's roster as a stale alliance of the daily read (issue 509)

Branch `fix/admin-runs-lookups` from `origin/dev` (3ed4302d). **Size S**: a bug fix that restores intended behaviour, with no migration, no new decision, no new route and no change to private roster fields.

## Built

- **`problemsOf` (`lib/queries/daily-runs.ts`) counts only the read's own rows.** "Get today's details" stores its roster as that day's `daily_rosters` row (D133, `lib/lookup.ts`). Before this fix, `problemsOf` flagged that row as a stale alliance of the daily read when it was a cached copy or was read before the read's start minus 20 minutes. Now a row is left out when:
  - the day has an `alliance_lookups` claim for that alliance (any status: a roster can be stored and the claim still end `failed`), **and**
  - the alliance is not in the day's `tracked_sets` row, **and**
  - the daily read wrote no `run_logs` line for that alliance under that day (`read_day`, `union_id`).

  `tracked_sets(day)` is the tracked part of the read's targets. The read writes it (`dayTargets`, `lib/tracked.ts`) before it reads. So a looked-up alliance that joined the day's set counts as the read's even when the read stopped before reaching it (429, deadline, call cap, quota rule) and wrote no line. A workspace's alliance outside the set has no stored per-day signal, so for it the read's `run_logs` line decides. A row with no lookup claim counts as before, so days read before run_logs had `read_day` (#251, 2026-11-12) keep their problems.
  This applies to the list (`listDailyReads`), the shell's latest read and the per-day page (`getDailyRun`), which all use `problemsOf`.
- **Tests** (one focused test each):
  - `lib/queries/daily-runs.test.ts` (new), one server day per case, each read at 23:30 ST:
    - "names the read's own stale alliances, never a lookup's roster of an alliance it did not read" (Fri 2026-11-20). Rows: a stale row the read read; a lookup's cached copy; a looked-up workspace alliance outside the set that the read read (its line). Expects the first and the third.
    - "still names a looked-up alliance in the day's tracked set that the read stopped before reaching" (Thu 2026-11-19): the lookup's roster, the alliance in the set, no line.
    - "still names a looked-up alliance whose read failed" (Wed 2026-11-18): a failed lookup claim, then the read's error row; listed with `failed: true`.
  - `lib/sources/v1-options.test.ts`: "asks for the tracker's cached copy, with no fresh=1, when a call passes fresh: false (D133)".
  - `lib/daily-read.test.ts`, new describe "a workspace's alliance on its own key (D124, D133)":
    - "reads it on its own key, which our quota check does not count": quota at exactly `dailyReadQuota(1, 20)` = 62, so the read starts only if the keyed alliance is left out of our count; each call's `apiKey` is recorded.
    - "marks the key out of quota on its 429 and fails only that alliance; the read goes on".
  - `lib/private/access-request.test.ts`: "refuses an alliance neither the board nor a daily roster knows, and stores nothing (D133)".
  - `lib/collector.test.ts`: "reads the board's top 20 by might in a BEFORE when no tracked set exists yet (D133)". The board lists IDS first, but BOARD_EXTRA has the most might and IDS' last three the least, so the top 20 are not the board's first 20 entries.

## Decisions

- **Signal: the lookup claim, the day's tracked set, and the read's own run_logs lines.** Checked:
  - `daily_rosters` has no source column and no read time; `is_fresh` differs only by the freshness rule.
  - `alliance_lookups` alone is wrong when a looked-up alliance joins the day's tracked set at 23:30 ST: the read overwrites the lookup's row, and that row is then the read's.
  - `run_logs` alone hides the problems of the reads of 2026-11-10 and 2026-11-11, which have no lines (`read_day` came in #251), and depends on a best-effort insert.
  - The day's full targets are not stored. `tracked_sets` holds the tracked part, written before the read, so it is used. A workspace's alliance outside the set is a target only when its key rule (`dailyKeyRule`) did not skip it at read time. Neither that nor the workspace list is kept per day, and using today's workspaces would be wrong for past days and for a skipped key.

  No migration and no change to what lookups store.

## Deviations

- Issue 509 says "show lookups separately". This fix only takes them out of the read's problems. /admin already lists today's lookups with their outcome (D133); no second list was added.

## Verified

- **`pnpm check` passed**: prettier, eslint, tsc, vitest (after the review fixes, on dev at 371f22e0: 312 files passed, 2 skipped; 1652 tests passed, 4 skipped), drizzle drift, i18n (17 languages up to date).
- **Each new test fails when the code is broken on purpose** (one break at a time, then restored):

  | Break | Test that fails |
  | --- | --- |
  | `problemsOf` without the lookup condition (`true`) | daily-runs: the lookup's alliance (67120002) shows up |
  | No tracked-set branch (`notExists(lookedUp) or exists(readByRun)`, the first version of this fix) | daily-runs: the tracked alliance the read never reached |
  | No run_logs branch (`notExists(lookedUp) or exists(tracked)`) | daily-runs: the workspace alliance the read read (67120003) is missing |
  | Lookup claim alone (`notExists(lookedUp)`) | daily-runs: all three |
  | `fetchAlliance` always sends `?fresh=1` | v1-options: `fresh: false` |
  | `submitRequest` without the `isKnownAlliance` refusal | access-request: unknown alliance |
  | `allianceIds` with no board fallback (`ids = []`) | collector: board's top 20 with no tracked set |
  | Fallback takes the board's first 20 entries, not the top 20 by might | collector: board's top 20 with no tracked set |
  | `readOne` never passes the workspace key | daily-read: reads it on its own key |
  | `checkQuota` counts keyed alliances (`ids.length`) | daily-read: both key tests (the read stops at the quota rule) |
  | `failOne` never marks the key (`if (false)`) | daily-read: 429 marks the key (the read aborts instead) |

- No upstream call, no production access, no `.env*` read.
- **Analytics plan: no change.** No event, property or funnel step is added, changed or removed; this changes an /admin read model only.

## Open issues

- **A workspace's alliance outside the tracked set still depends on `run_logs`.**
  - Case: an alliance is looked up on day D. Later that day it becomes a daily target only as a workspace's alliance: a workspace is made for it, or its saved key becomes usable. Then the read stops before fetching it (429, deadline, call cap), or its line is lost.
  - Its lookup row then has no line, so /admin/runs leaves it out. The read's own outcome (`readDay`) still counts it as that alliance's roster, stale.
  - `autoRetryDailyRead` treats any row with `error === null` as read, so no retry reads it again that day.
  - A line is lost when `createRunLogger` swallows a failed insert (`lib/logger.ts:64`), or when the run passes `MAX_RUN_LOG_LINES` (400, `lib/logger.ts:72`).
  - A tracked alliance does not have this gap (the tracked-set branch). Closing it needs the read's targets stored per day, which is a migration (M).
- Issue 509, still open: the extra label query on every private request, and the duplicated `isSameOriginJson`. Closed elsewhere: the per-address lookup counting was dropped, and the home page's count query was done in #537.

## What was missing from the task prompt?

Two facts, both from the review: a looked-up alliance can become a daily target later the same day (the tracked set is made at the read, and a workspace can be made after a lookup), and `run_logs` lines are best effort.

## Next

- Follow-up (the orchestrator files it), M because it needs a migration: store the daily read's targets per day, or keep `autoRetryDailyRead` from taking a lookup's roster as the alliance's read. Then a workspace alliance looked up the same day is retried and counted.
- Issue 509: the extra label query on every private request; remove the duplicated `isSameOriginJson`.

https://github.com/daniro-san/LAPTracker/pull/623
