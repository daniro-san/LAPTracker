# 08zr — Collector and route robustness (#120)

## Built
Six items, in the order of the owner's decision comment. Each has one test that failed before the fix.

- **N3, a tick that lost its phase.** `lib/tick.ts`: when `executeSnapshot` refuses with `snapshot_running` or `snapshot_complete`, `runTick` returns `{ kind: "idle" }`, so the tick answers 204. A manual `POST /api/snapshot` still answers 409. Test (`app/api/tick/route.test.ts`): two ticks at once inside the BEFORE window answer `[200, 204]` and leave one snapshot. Before the fix they answered `[200, 409]`.
- **N7, two Rehearse presses at once.** `lib/rehearsal.ts`: `createRehearsal` runs `refusal()` and `insertRehearsal` inside one `db.transaction` that first runs `select pg_advisory_xact_lock(1)`. Retention (`pruneRehearsals`) stays outside it. Test (`app/api/rehearsal/route.test.ts`): two presses at once answer `[201, 409]` and leave one rehearsal. Before the fix they answered `[201, 500]`: both passed the guards, and the second insert hit the unique `event_at_utc` because the test clock gives both the same millisecond. In production the milliseconds differ, so both inserts would succeed.
- **Item 5, the run lock is 150 s.** `RUN_STALE_AFTER_MS = 150_000` now lives in `lib/compute.ts`. `lib/compute.ts` is pure and imports nothing, so `lib/queries` may import it. It replaces:
  - the collector's own constant (`lib/collector.ts`, invariant renamed `run.stale-after-150s`);
  - the copy in `lib/queries/upstream-status.ts` (D27 rule 1);
  - `LIVE_MS` in `lib/queries/admin.ts`.
  The rehearsal's real-running guard now imports it from `lib/compute.ts`. Nothing auto-closes a stuck row. Test (`lib/freshness.test.ts`): a run that crashed is refused at 149 s and taken over at 151 s. Before the fix it was still refused at 151 s.
- **N5, logger shutdown.** `lib/logger.ts`: `shutdown()` races `Promise.allSettled` against a `LOG_SHUTDOWN_MS = 3_000` timer. Every line still in flight after that is added to `failedWrites`. Test (`lib/logger.test.ts`): with a sink that never resolves and fake timers, `shutdown()` settles at 3 s and `failedWrites` is 2. Before the fix it never settled.
- **Worker throw.** `lib/collector.ts`:
  - The worker that throws aborts `run.controller`, with `run.abort` as the reason.
  - `collectAll` waits for every worker (`allSettled`) and then rethrows the first error.
  - `collectOne` checks `run.controller.signal.aborted` instead of `run.deadlineHit`. The deadline aborts the same controller, so the deadline path is unchanged.

  Test (`lib/collector.test.ts`): FIRST's insert throws while SECOND's read is still in flight. After the run has rejected, SECOND's read is released. SECOND has no row. Before the fix SECOND's row landed.
- **Item 6, after the deadline.**
  - `lib/sources/v1.ts`: the retry `sleep` takes the run's signal and rejects with `signal.reason` when it aborts. Test (`lib/sources/v1.test.ts`): a 503 with `Retry-After: 30` and an abort 1 s later. The fetch rejects with `AbortError` at once, and no retry is sent. Before the fix it waited the 30 s.
  - `lib/run.ts`: `notifyWithinCap` races `notifyFinished` against what is left of `NOTIFY_CAP_MS = 115_000`, measured from the claim's `startedAt`. Past that, the notify is abandoned: its later rejection is swallowed, and one `notify.cut` line goes to `console.error` with the snapshot id. The route answers. This took 20 lines including the doc comment, inside the decision's limit of about 20. Test (`app/api/tick/route.test.ts`): a run whose clock reaches 116 s at the quota read, and a fetch that never answers. The tick answers 200. Before the fix it hung until the 10 s test timeout.
- `docs/DECISIONS.md` **D43**: amends D26 (a lost phase answers 204). It supersedes the 10 min lock in D18, D21 and D27 rule 1. It records the advisory lock, the bounded shutdown, the worker abort, the abortable sleep and the 115 s cap. It accepts the unbounded finalise and notify DB calls.

## Decisions
- **The shared constant lives in `lib/compute.ts`.** That module is pure and imports nothing, and `lib/queries` already imports it, so the dependency rule holds. The name stays `RUN_STALE_AFTER_MS` to keep the diff small. The collector no longer re-exports it, and `lib/rehearsal.ts` imports it from `lib/compute.ts`.
- **Advisory lock key `1`.** It is the app's only advisory lock, and a comment says so.
- **Worker abort reason.** `run.controller.abort((run.abort ??= describe(e)))` folds two statements into one, because `lib/collector.ts` sits at the 300-line `max-lines` limit, which counts code lines only. In-flight `/v1` calls then reject with that string instead of an `AbortError`. The collector ignores the reason: it checks `signal.aborted`.
- **The notify cap moved into its own function.** Inline, it pushed `executeSnapshot` over the eslint `complexity` limit (13 > 12).
- **`notify.cut` goes to `console.error`, not `run_logs`.** The run logger has already shut down by then, and the other notify failures (`notify.failed`, `notify.detail_failed`) also use `console.error`.

## Deviations
- **PR title.** I used `fix: collector and route robustness (#120)`, the title the decision comment gives. The brief that started this session said `fix(collector): robustness follow-ups`; the decision comment overrides the brief.
- **Three existing tests moved with the new 150 s boundary.** I did not weaken them; their premises were set by the old 10-min figure:
  - `lib/freshness.test.ts`: 9 min refused / 10 min + 1 ms taken over became 149 s / 151 s.
  - `lib/queries/running.test.ts`: the abandoned run went from 30 min to 3 min old, so the test now checks the new figure in `/admin`'s live list.
  - `lib/queries/upstream-status.test.ts`: the "just started" run went from 5 min to 1 min old. A 5 min old run is now past the lock.

## Verified
- `pnpm check` on Node 26.5.0 passed: prettier, eslint, `tsc --noEmit`, vitest (39 files passed, 1 skipped; 190 tests passed, 1 skipped), `check-drift` and `i18n-check`.
- Mutation pass. A script undid each fix in turn, ran its test, then restored the file. Every mutation made its test fail:
  - the N3 idle mapping;
  - the 150 s constant set back to 600 s (the freshness test and the running-list test both fail);
  - the shutdown race, and the `failedWrites` count;
  - the worker abort;
  - the sleep's `signal` argument;
  - the cap (with 60 s added).

  For N7, the mutation is the code before the fix, shown failing above.
- No upstream call and no webhook call: every test uses PGlite and the fakes in `lib/app-context.test-helpers.ts` and `lib/collector.test-helpers.ts`.

## Open issues
- **N7 on PGlite.** PGlite runs one transaction at a time, so the test proves the transaction flow, not `pg_advisory_xact_lock` itself. The lock is proven only on Neon. If the test still passes with the lock line removed, that is expected on PGlite.
- **What the worker-throw test covers.** It covers the abort, which stops a read that was still in flight. It does not separately cover `allSettled` waiting for an insert that had already started when the other worker threw.
- **The notify cap leaves work behind.** A cut notify keeps running in the background. Once `withContext` closes the database, its next query rejects and the rejection is swallowed. A public message posted just before the cut may then lack its stored message id (D31), so the next phase posts a new message instead of editing. Before this change, Vercel would kill the function at 120 s in the same case.
- **Docs that still say 10 min.** I did not edit these; they are the owner's (rules) or plan text:
  - `.claude/rules/api-routes.md:15` ("started < 10 min ago");
  - `docs/IMPLEMENTATION_PLAN.md:340` and `:465`;
  - `docs/SESSION_PLAYBOOK.md:341`.

  D43 records that they are superseded.
- `finishSnapshot` and `finaliseCrashed` still have no timeout. This is accepted in D43.

## Next
Session: 08zs — data correctness (#123), lane A, next on this branch line
Model / effort: keep. This session was the same size as #123 (6 items against 3 fixes plus D lines) and needed no raise.
Owner must do first: nothing. If this PR is still open, #123 is cut from `session/08zr-collector-robustness` because both touch `lib/collector.ts`, `lib/sources/v1.ts` and `lib/queries/admin.ts`, and its PR body names this PR as a dependency.
Plan changes needed: §3.4/Phase 4 "Run lock … less than 10 min ago" (`docs/IMPLEMENTATION_PLAN.md:340`, `:465`) and `.claude/rules/api-routes.md:15` should read 150 s (D43). The owner edits these.

<adjustments>
- `lib/collector.ts` is at the eslint `max-lines` limit (300 code lines; comments and blank lines do not count). The `http_status` added to `v1.retry` in `attemptHook` must not add a code line, or one must be saved elsewhere.
- `executeSnapshot` in `lib/run.ts` is at the eslint `complexity` limit (12).
- In `lib/sources/v1.ts`, the retry `sleep` now takes the signal: `await sleep(retryDelayMs(attempt, …), signal)`. The status of the previous response is `status` from the previous loop iteration, so passing it to `onAttempt` needs a variable kept across iterations.
- `RUN_STALE_AFTER_MS` (150 s) is now in `lib/compute.ts`, and `lib/queries/admin.ts` imports it. `LIVE_MS` no longer exists.
</adjustments>

<adjustments for="08zt (#121)">
- `runTick` now returns `{ kind: "idle" }` when it lost the phase to another caller (`snapshot_running`/`snapshot_complete`). The `tick_log.outcome` for that tick is `idle`, not `run`.
- `app/api/tick/route.test.ts` has two new tests: a concurrent tick pair answering `[200, 204]`, and a run capped at 115 s with a fetch that never answers. Both replace `ctx.fetch` or `ctx.v1` on a `testContext`; the heartbeat tests can follow the same pattern.
- `executeSnapshot` answers by 115 s from the run's start (`NOTIFY_CAP_MS`), so a `tick_log` row's `finished_at` is set before the 120 s kill in every case except a hang in `finishSnapshot`.
</adjustments>
