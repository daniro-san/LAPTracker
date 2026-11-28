# chore/878-slow-tests

## Built
- `lib/squads-read.test.ts`: the test "reads every member once..." is now two tests. The 30-member part keeps its name minus the cap clause. A new test, "stops the day at the cap of 120 calls, however many members wait", seeds the `squad_reads` row at `callsUsed: 100` (130-member roster) and runs two batches: 20 calls, then status `stopped`, reason `cap`, `callsUsed` 120.
- `app/(private)/api/w/[slug]/cross-workspace.test-helpers.ts`: `loadRoutes()` imports every route module once.
- `app/(private)/api/w/[slug]/cross-workspace.test.ts`: `beforeAll` calls `loadRoutes()`.

## Decisions
- Profiling, squads: PACE_MS was already 0 in the test (`paceMs: 0`), so fake timers would change nothing. The cost is about 70 ms per call of PGlite queries (two `distinct on member_squads` reads, queue and claim updates), and the cap half made 120 calls. Seeding the day's row at 100 calls keeps the cap check (120, the production constant) with 20 calls.
- Profiling, cross-workspace: the 80 refused requests take about 1.7 s together. The rest of the time was the first import of ~15 route modules that the seed does not touch, which ran inside the first test body (10 s limit) and grew to 25+ s under load. A hook has the 140 s limit, so the import moved to `beforeAll`.
- Parallel requests were not used: PGlite is single-threaded and the loop is 1.7 s.
- No per-test timeout was raised. No production code changed.

## Deviations
- The cap test no longer makes 120 calls in 6 batches from an empty day. It checks the cap from a day that already used 100 calls (the stored `callsUsed` is what `stopReason` reads).

## Verified
Timings of the target tests, old file vs new file, same run, load average about 30:
- squads "reads every member once...": 2.3 s and 1.8 s before; 1.6 s and 1.3 s after, plus 0.3 s and 0.2 s for the cap test.
- cross-workspace "is refused every time": 2.9 s and 2.6 s before; 1.3 s and 1.2 s after.
- Earlier runs at load average 50+: squads 11.5 s before, 3.5 s (30-member test 9.9 s, cap test 3.5 s) after; cross-workspace 34 s before.
- `pnpm vitest related --run` on the three changed files: 26 passed.
- `pnpm check` twice: both passed (424 files, 2328 tests), no timeouts.

## Open issues
- At very high machine load the 30-member squads test can still approach 10 s (about 100 ms per call under load); the batch size 25 needs 30 members, so it cannot shrink.
- Timings are noisy: the machine ran at load average 30 to 60 from other agents.

## Next
- None required. If the squads test times out again under load, give it a per-test timeout with a comment.

What was missing from the task prompt? Nothing; the two test names and the timings in the issue were enough.

PR: (added by the orchestrator)
