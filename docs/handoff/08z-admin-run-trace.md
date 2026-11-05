# 08z — Admin run trace

Issue #94: run duration and a per-call trace on `/admin/runs` and `/admin/runs/[id]`.

## Built
- `lib/queries/admin.ts`:
  - `runTrace(logs, tags, startedAt)` derives the trace from the run's `run_logs`. One `TraceCall` per `v1.fetch` line, in log order (the order the calls finished), with these fields:
    - `endpoint`
    - `alliance`: the tag from the existing tags map, else the union id; null for the quota call
    - `seconds`, from `data.duration_ms`
    - `httpStatus`, `cached`
    - `retries`: the count of `v1.retry` lines with the same `union_id`; null for the quota call
    - `slowest`
  - It also returns a total: number of calls, summed seconds, summed retries.
  - `getRun` returns `trace`, and `run.deadline` (`snapshots.error === "deadline"`). `listRuns` rows carry `deadline` too.
- `app/_ui/admin/RunTrace.tsx`: the trace as cards below 640 px and a `<table>` at ≥ 640 px (row headers, `scope`, rows `h-11`). It has a total row and a note that calls overlap. When the run hit the deadline, a seal note says the cut calls have no line.
- `/admin/runs/[id]`: the run line gives start · finish · duration · API calls. A deadline run shows a seal `Chip` "Stopped at the 100 s deadline". The trace sits above the existing timeline, which is unchanged and now headed "Log".
- `/admin/runs`: each row shows start · finish · duration on one line, then calls · quota left, then the deadline chip. A deadline run no longer prints its raw `deadline` error line.
- `/admin` (item 3): one text line under the quota, "Last 8 runs, newest first: 100.4 s · 52.0 s · …". It covers up to 10 runs with a duration. No chart. `listRuns(db, 10)` replaces `listRuns(db, 1)`, and the latest run is still `recent[0]`.
- `app/_ui/admin/words.ts`: `seconds(ms)` (one decimal), used by the three pages.
- Copy: `copy.admin.runs.deadline`, `.recent`, `.trace.*` (`lib/copy-admin.ts`); `copy.brand.components.runTrace` (`lib/copy-brand.ts`).
- Docs: in `docs/DESIGN.md`, the `timeline` bullet is updated and a new `run-trace` component is added. `/brand` Components has a "Run trace" specimen: a made-up quota call, one fast cached read and one slow retried read, full width.

## Decisions
- **Only the latest attempt is traced.** A forced re-run (`force=1`) reuses the snapshot id (`startSnapshot` updates the row), so older attempts' `run_logs` stay attached to it. The trace keeps lines with `at >= startedAt`. The timeline still shows every line.
- **No "slow" threshold** (assumption from the task). The slowest call is flagged with the word "slowest" in an ink chip. With equal seconds, the first one is flagged. Nothing is flagged when there is only one call.
- **HTTP column.** A successful call logs `200`, so a number other than 200 shows in seal. `—` means the call got no HTTP answer (timeout or abort: `httpStatusOf` returns null).
- **The total is summed call time**, not wall time. Calls run four at a time, so the note says the total is longer than the run.
- **Calls the deadline cut** write no `v1.fetch` line (D25). The table says so in a note and does not invent rows for them.
- The trace is a new component (`run-trace`), not a `StatTable` variant. `StatTable` cells are a value plus a delta, but trace cells are seconds, a status code, yes/no and a count. It follows the same rule: cards below 640 px, a table above.
- No migration, no new data collection, no test file committed: the task did not ask for tests.

## Deviations
- None from the task. Item 3 (optional) was built as the text row the task allowed.

## Verified
- Typecheck, prettier and eslint are clean.
- `vitest run`: 142 passed, 10 skipped on the full run. Under load average 53 (other lanes running), 2 to 5 PGlite files timed out on `beforeAll` (30 s / 10 s). Every one passed when run again on its own: `app/api/manual-event`, `app/api/rehearsal`, `app/api/snapshot`, `lib/queries/leadership.test.ts`, `lib/queries/players.test.ts`.
- `runTrace`, with a temporary test that was run and then deleted. The test used realistic lines: an earlier attempt's fetch an hour before `startedAt`, a quota call, two retries on one alliance, a 504, a timeout with `http_status` null, and a tag that is null in the map. Result:
  - the earlier line is dropped
  - retries are 2 on the right alliance and `—` (null) on the quota call
  - the null tag falls back to the union id
  - the slowest call is flagged
  - total = 4 calls, 38.6 s, 2 retries
- Browser setup:
  - A throwaway Postgres 18 in the scratchpad on port 5531, reached through a local WebSocket bridge.
  - Migrations applied as plain SQL. Seeded with `scripts/seed.ts`.
  - Realistic `run_logs` inserted for run 5 (22 alliances, 2 retries, one 504 at 46.2 s) and run 6 (made a deadline run: `partial`, `error = 'deadline'`, 100.4 s, 6 calls logged).
  - `next dev` under `env -i`: no real API key, upstream set to `127.0.0.1:9`, no webhooks, a made-up PIN in a scratchpad file. The owner's `.env.local` was not used.
- Captures with Playwright and system Chrome: `/admin`, `/admin/runs`, `/admin/runs/5`, `/admin/runs/6` and `/brand`, each at 360 and 1280 px, light and dark (20 captures).
  - Horizontal overflow is 0 everywhere.
  - axe reports 0 violations everywhere.
  - Seen: cards at 360 px, the table at 1280 px in dark mode, the deadline chip and note, the "slowest" chip, the seal 504s, the runs list rows, and the `/admin` durations line.
- Not seen: the trace on real production data. Production `run_logs` were not read.

## Open issues
- `v1.retry` lines carry only `union_id` and `retry_n`, not the status code that caused the retry. "Retries by status code" (Session 9 step 2) is therefore not readable from the trace, and not from `run_logs` either. A retry for the quota call has `union_id` null, so it is counted in no row.
- `docs/DESIGN.md` still has two identical `member-filter` bullets (pre-existing; not touched).

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change adds no upstream call and no timing logic.
Owner must do first: merge this PR into `dev` (no migration). PR 08za (#54) is stacked on this branch.
Plan changes needed: none.

<adjustments>
- Session 9 step 2: per alliance seconds, cached, HTTP status and retries for the rehearsal's runs are now on `/admin/runs/<id>` (the "Upstream calls" table). Read them there instead of writing SQL. Also read the run's duration from the run line, and the last 10 durations from `/admin`.
- Session 9 step 2, "retries by status code": `v1.retry` lines do not store the status that caused the retry, so this needs the final `v1.fetch` status per alliance plus the retry count, or a Vercel runtime log. Do not expect it in `run_logs`.
- The trace's total seconds is the sum of call times. Calls run four at a time, so compare the run line's duration, not the total, against `maxDuration`.
</adjustments>
