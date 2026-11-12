# 08zzzl — A page per daily read, with its calls and log

Owner request, 2026-11-12. On `/admin/runs` a snapshot run opens its page, but a daily read did not: it had no page because it wrote no `run_logs` lines (D60: `run_logs` needed a snapshot). Asked in chat, the owner chose "like the events, with the log" (calls table and log, needing a migration) over a page built only from the existing rows.

## Built
- **Migration `drizzle/0014_amused_malice.sql`.** `run_logs.snapshot_id` becomes nullable. `run_logs.read_day date` references `daily_reads.day`, with index `run_logs_read_day_idx`. A check `run_logs_one_owner_check` requires exactly one of the two. Existing rows all have a snapshot id, so they pass.
- **Logger.**
  - `lib/repo/run-logs.ts`: `RunLogLine.snapshotId` is `number | null`, and an optional `readDay` is added.
  - `lib/logger.ts`: `RunLoggerOptions.snapshotId` is optional, and `readDay` is added. A line is written when either is set.
- **`lib/daily-read.ts`.** `readDay` creates a run logger for its day, masking `deps.secrets` (the tick and the Retry route pass `secretsOf(env)`). It writes the collector's codes, so the existing `runTrace` reads a daily read's calls unchanged:
  - `daily.start` and `daily.finish`;
  - one `v1.fetch` per call (quota and alliances), with status, seconds, cache, quota, and on failure the error and its detail (D61);
  - `v1.retry` (from the attempt hook);
  - `stale`, `quota` (the reserve rule), `run.deadline`, `abort`.
  - A call the deadline cut writes no line (D25). The quota call is guarded the same way.
  - The alliance read was split into `readOne` and `checkQuota` for the length limits; the behaviour is unchanged.
- **`lib/queries/daily-runs.ts`.** `getDailyRun(db, day)` returns the list's entry (with failures), every log line, tags (config first, then the day's rows) and `runTrace(logs, tags, startedAt)`, which is the latest attempt after a Retry. `problemsOf` and `withProblems` are shared with `listDailyReads`.
- **UI.**
  - `app/_ui/admin/RunLog.tsx`: the run page's log, moved out of `app/(pages)/admin/runs/[id]/page.tsx` and shared.
  - `app/(pages)/admin/runs/daily/[day]/page.tsx`: the session check first (issue 218), a 404 for a malformed day or one with no read. Then the summary (state, started, finished, duration, API calls, requests left before, the deadline chip), "Alliances that did not update" (`DailyFailures`), `RunTrace` and `RunLog`.
  - `app/_ui/admin/RunRows.tsx`: a daily row is now a link to its page, compact like a snapshot row. `DailyFailures` moved to the page.
  - `app/_ui/admin/words.ts`: `readDayDate(day)` gives noon UTC of the read's day, so the page title and the row show the read's date, not its start time.
- **Copy:** `runs.dailyRun`, `runs.quotaBeforeLabel`. The `runs.help` line now says any run can be opened.
- **Tests:** `gate.test.ts` adds the new page to the locked-page list (shell, no database).
- **Docs:** D60 ("A page per daily read"; the outcome line), D61 (where daily failures show), the README `/admin/runs` row and a new `/admin/runs/daily/[day]` row, and the DESIGN `timeline` entry.

## Decisions
- **One `run_logs` table for both run kinds**, with a check constraint, rather than a second table. The logger, the cap, the redaction and `runTrace` stay one code path.
- **Same codes as the collector.** `runTrace` and `RunLog` need no daily-specific branch.
- **After a Retry, the calls table shows the latest attempt and the log shows every attempt,** as for a forced snapshot re-run.
- **Reads from before the release have no lines.** Their page shows the summary and the failures; the calls table says no upstream call was logged.

## Deviations
- No test committed for the new logging (CLAUDE.md: not asked; `lib/daily-read.ts` is outside the collector rule's paths). It was checked as below.

## Verified
- A temporary PGlite test (deleted) ran a read with a fake `/v1`: one success, one 504 after a retry, one timeout.
  - Its lines were `daily.start`, the quota `v1.fetch` (200), a `v1.retry` (504), the three alliance `v1.fetch` lines (the failures with error and detail) and `daily.finish`.
  - `getDailyRun` built a 4-call trace with 1 retry and 2 failed problems.
  - Its first assertions were wrong about the quota status and a test-helper tag; the data was right.
- Local Postgres (D47):
  - Migration 0014 applied with `psql`.
  - A temporary tsx script ran a daily read for 2026-11-11 against it, with a fake `/v1` (no network): 6 alliances, URSA 504 after a retry, OGs timeout. Before it deleted that day's rows, `db-local.mjs check` and a host print confirmed the process `DATABASE_URL` (127.0.0.1) wins over `.env.local`.
  - Result: `partial`, 8 calls; lines `daily.start` 1, `v1.fetch` 7, `v1.retry` 1, `daily.finish` 1. The FK and the check constraint held on real Postgres.
- Chrome at 360 px on `next dev` against it:
  - `/admin/runs?show=daily` has a link per daily row. Clicking it opened `/admin/runs/daily/2026-11-11`, titled "Daily roster read · Wed, Nov 11".
  - The page showed the summary, both failures with guide and details, 7 upstream calls (URSA 504 with 1 retry, the slowest marked) and the log with explained failure lines.
  - No horizontal overflow. `/admin/runs/daily/not-a-day` returned 404.
  - The first title used the start time ("Thu, Nov 12" for a read of the 11th, because the sample ran today); fixed with `readDayDate`.
- `pnpm check`: prettier, eslint, typecheck, 258 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.

## Open issues
- `readDayDate` uses noon UTC, which is the wrong date only for viewers whose own clock is UTC+12 or more.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. Lint limits and two wrong assertions in a temporary test were the only rework.
Owner must do first: merge this PR into `dev` and release (minor: migration 0014). The next daily read (06:00 server time) is the first with a calls table and a log.
Plan changes needed: none.

<adjustments>
- `run_logs` rows belong to a snapshot or a daily read (`read_day`), never both. A query on `run_logs` by snapshot must keep filtering on `snapshot_id`.
- A new run kind can log through `createRunLogger` with its own owner column and reuse `runTrace` and `RunLog` if it writes the collector's codes.
</adjustments>
