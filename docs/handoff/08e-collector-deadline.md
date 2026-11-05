# 08e — Collector deadline

## Built
- `lib/collector.ts`: `RUN_DEADLINE_MS = 100_000`. At the deadline no new `/v1` read starts, in-flight reads are aborted, and the snapshot closes `partial` with `error = "deadline"`, the real `calls_used`, `quota_remaining_after` when known and `duration_ms`. Alliances with no row appear in `failed` as `not fetched: deadline`. One `run.deadline` log line.
- `lib/sources/v1.ts` and `lib/sources/types.ts`: `fetchAlliance` and `fetchQuota` take an optional `signal`, combined with `TIMEOUT_MS` by `AbortSignal.any`. Nothing else in the adapter changed.
- Tests: two in `lib/collector.test.ts` (all reads hang; run finishing in time), one in `lib/sources/v1.test.ts` (the caller's signal aborts the sent request).
- `lib/collector-rows.ts` (new): `dataRow`, `errorRow` and the failed-list builder moved out of `lib/collector.ts` unchanged, because the file passed the 300-line lint limit. `collector.ts` still exports `FRESH_MAX_AGE_MS`. The internal-fallback block of `collectOne` became `fallbackRow` for the complexity limit; behaviour is the same.
- `docs/DECISIONS.md` D25.

## Decisions
- The deadline is a timer raced against the run's work, plus an abort signal. The race alone bounds the run even if an adapter ignores the signal; the signal frees the sockets.
- A deadline with zero rows is `partial`, not `failed` (the task asked for `partial`). A call cut by the deadline writes no row and gets no internal fallback, because the snapshot is already closed.
- The attempt hook refuses a retry that wakes after the deadline, so it is not counted.
- The workers also compare the clock with the deadline before taking the next alliance. This covers a late timer. `deps.now` is used for it, so the tests drive both with fake timers.

## Deviations
- Task said "`lib/run.ts` only if the finalise path needs it": it did not.
- The `/v1` adapter gained a `signal` parameter, which the task did not name. Capping a call's time to the deadline needs it; `TIMEOUT_MS`, retries and `lib/sources/internal.ts` are untouched.

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 104 tests).
- Mutation check on the deadline: `>=` to `<` in the worker comparison fails 10 collector tests; stretching the timer ×100 fails the hang test; removing `hitDeadline` from the timer fails the hang test. Removing the worker-side comparison alone survives: the timer covers it, so that comparison is only a guard for a late timer and has no test of its own.
- Upstream API calls: 0. Production, Vercel and Neon not touched.

## Open issues
- A heartbeat log for tick calls (so a killed function leaves a trace) is a separate follow-up.
- Releasing a stuck `running` row (the run lock blocks a retry for 10 minutes) is a separate follow-up.
- The 120 s route limit still kills a run if work after the deadline (finalise, Discord) hangs; those calls have no timeout of their own.
- The retry sleep (up to 30 s) of a cut call keeps running after the run closes; it sends nothing.

## Next
Session: 9 — Dry run against production
Model / effort: keep (opus, high) — no measured reason to change.
Owner must do first: merge this PR into `dev`; confirm the upstream answers again before spending quota.
Plan changes needed: none.

<adjustments>
- Step 4 ("is maxDuration right"): the collector now stops at 100 s, so `maxDuration = 120` is the ceiling for the finalise work, not for the reads. Record the run's `duration_ms` against that 100 s deadline.
- If a rehearsal run shows `error = "deadline"`, the upstream was slow, not the code: report it as an upstream finding.
</adjustments>
