# fix/866-sample-timeout

Issue #866: a hung upstream call must not cost the whole sample.

## Built
- `lib/collector-sample.ts`: `SAMPLE_CALL_TIMEOUT_MS` is 6_000 (was 12_000). `callOptions(run, call)` gives a sample's alliance read `{ timeoutMs: 6_000, maxRetries: 0 }` and its quota call `{ timeoutMs: 6_000 }`, which keeps the adapter's 502/503/504 retries (review on PR 870). A Before and After still get `{}` (the adapter's 30 s and 3 retries).
- `lib/collector.ts`: removed `Run.noRetry` and the `failedSampleUnionIds` query in `runSample`. With no sample alliance read retrying, the per-alliance no-retry set has no effect.
- Removed `failedSampleUnionIds`: the SQL in `lib/repo/alliance-snapshots.ts`, the `Repo` method in `lib/repo/index.ts`, the memory repo's copy, its test in `lib/samples-hardening.test.ts` and the assertion in `lib/collector-sample.test.ts`.
- `lib/collector-opponent.ts`: the KvK opponent's calls (Before and After only, D152) had used `SAMPLE_CALL_TIMEOUT_MS` as their 12 s cap. They now use their own `OPPONENT_CALL_TIMEOUT_MS = 12_000`, so the phases are unchanged.
- `docs/decisions/D69-event-samples.md`: dated amendment 2026-11-28.
- `lib/collector-sample.test.ts`: three tests that use the real /v1 adapter over a mocked fetch and fake timers (`AbortSignal.timeout` stubbed onto the fake timers): (a) 20 alliances, the first 4 hang: 16 read, 4 failed with `v1 TimeoutError`, status `partial`, no deadline error, duration under 25 s, every call's timeout 6 s; (b) a sample's 503 is not retried (1 attempt, error row `v1 http 503`); (c) a Before's 503 is retried and every call's timeout is 30 s; (d) a sample's quota call that answers 503 and then 200 is retried, and all 20 alliances are read. The first existing test now expects `maxRetries: 0`. The old test "reads an alliance that failed in an earlier sample of the event once" is removed: test (b) replaces it.

## Decisions
- The concurrency pool needed no code change. A worker's slot is held only while its call runs. The call's `AbortSignal.timeout` covers the headers and the body, and with `maxRetries: 0` there is no backoff sleep. So 4 hung calls hold the 4 slots for at most 6 s, and test (a) finishes in about 11 s of fake time.
- INVARIANT `sample.failed-reads-once` is kept as a name and rule: every sample read is now one attempt, which covers alliances that failed earlier.

## Deviations
- None from the task. The opponent's separate constant was not in the task. It keeps "Phases keep their current timeout" true, because the opponent reads run inside a Before and After.

## Verified
- `pnpm vitest related --run lib/collector-sample.ts lib/collector.ts lib/collector-opponent.ts lib/collector-sample.test.ts`: 27 files, 183 tests passed.
- After the review fixes, `pnpm vitest related --run` on the changed lib files: 138 files, 882 tests passed.
- `pnpm check`: exit 0 (prettier, eslint, tsc, vitest 420 files passed / 2 skipped, drift, i18n).
- A second full `pnpm vitest run` had one failure in `lib/squads-read.test.ts` ("reads every member once in small batches…"). This branch does not touch that test. It passed 3 of 3 runs on its own and passed in the `pnpm check` run, so it looks like a timing flake under load.

## Open issues
- The adapter never retries a call that timed out (a `RequestError`). Only 502/503/504 are retried. The issue's "12 s plus a retry" therefore most likely came from 5xx answers after a long wait. I could not confirm this from the code alone; snapshot 49's run_logs would show it.

## Next
- Follow-up: check `lib/squads-read.test.ts` for a timing flake under a full parallel run.

What was missing from the task prompt? That `SAMPLE_CALL_TIMEOUT_MS` is also the KvK opponent's 12 s cap in the phases (lib/collector-opponent.ts).

PR: (added by the orchestrator)
