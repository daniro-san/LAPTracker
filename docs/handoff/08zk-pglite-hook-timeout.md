# 08zk — Global hookTimeout and testTimeout for PGlite suites (#124)

## Built
- `vitest.config.ts`: `hookTimeout: 140_000` and `testTimeout: 10_000`, each with a comment citing its measurement.
- `app/api/{events/[id],manual-event,rehearsal,snapshot,tick}/route.test.ts`, `app/img/avatar/[uid]/route.test.ts`: `beforeAll` no longer passes its own `30_000`; the global value applies.
- `lib/db.test-helpers.ts`: unchanged.

## Decisions
- `hookTimeout` 140 s: about 2x the slowest PGlite open+migrate measured (69.8 s), rounded up.
- `testTimeout` 10 s: about 2x the slowest test body measured (4.8 s), rounded up.
- Assumptions stated by the brief:
  - A timeout only. Each file still opens its own PGlite (D19); no shared instance per worker.
  - `lib/app-errors.test.ts` opens PGlite with a top-level `await`, which runs while the file is collected, outside any hook, so `hookTimeout` does not cover it. Left unchanged.
- No test set its own per-test timeout, so there was none to remove for `testTimeout`.

## Deviations
- The brief said `testTimeout` is not changed. The first done-when run (below) failed only on the 5 s default `testTimeout`, so #124's goal could not be met without it. I asked the session that started this one; it answered to set one global `testTimeout`, sized the same way.

## Verified
All runs on this 10-core Mac, Node 26.5.0, with other Claude sessions running their own work (the 1-min load average stayed at about 50–63 from them alone).
- Hook measurement: four `pnpm test` runs started in parallel, with a temporary, uncommitted line in `openTestDb` that logged each open+migrate time and a temporary 300 s `hookTimeout`. 44 opens: min 18.7 s, median 63.4 s, max 69.8 s (`lib/queries/leadership.test.ts`). Load rose from 8 to 66. No hook timeouts; 1–3 tests per run failed on `Test timed out in 5000ms`.
- First done-when run (`hookTimeout` 140 s, `testTimeout` default 5 s): `pnpm check` started 20 s after three `pnpm test` loops (each restarts `pnpm test` until `pnpm check` ends). Load sampled every 10 s: n=31, min 20.4, median 56.8, max 86.6.
  - Hook timeouts: 0 in `pnpm check` and in all 12 parallel runs.
  - `pnpm check` exit 1 after 344 s: 7 files failed on `Test timed out in 5000ms` (13 tests); the parallel runs had 1–16 each, mostly in `manual-event`, `snapshot`, `rehearsal` and `tick`.
  - Knock-on failure: in one parallel run, `snapshot/route.test.ts` "finalises the snapshot as failed and settles its logs when the collector throws" got `snapshot_id: null` instead of `1`. The test before it timed out, its body kept running, and the next test's `truncateAll` emptied the tables under it.
- Test-body measurement (temporary 300 s `testTimeout`, JSON reporter, per-test `duration`):
  - Round 1, four parallel `pnpm test`: load about 28 (one sample), 656 bodies, max 4.8 s (`snapshot` "answers 409 without upstream calls while another run holds the lock").
  - Round 2, four parallel `pnpm test`: load 39–67 (median 49), 656 bodies, max 4.0 s (`tick`).
  - Round 3, `pnpm check` with three `pnpm test` loops: load 40–65 (median 56), 1,968 bodies, max 4.7 s (`img/avatar`); `pnpm check` exit 0.
  - Total 3,280 bodies, none over 5 s. The bodies that timed out in the first done-when run were cut off at 5 s, so their full length is not known.
- Final done-when run (committed config): `pnpm check` with three `pnpm test` loops running throughout. Load n=18, min 36.2, median 52.3, max 69.1. `pnpm check` exit 0 in 166 s (prettier, eslint, tsc, drift clean; Vitest 84 s, 38 files passed, 1 skipped). All 12 parallel runs exit 0 (49–85 s each). No hook or test timeouts.
- `git grep -n '}, [0-9_]\{4,\});' -- '*.test.ts'`: empty.

## Open issues
- The Stop hook (`scripts/hooks/stop-check.sh`) runs `pnpm check` in the main checkout, which picks up this fix only once it is fast-forwarded to `dev`. Owner step, after the merge, while the main checkout is on `dev` and clean: `git -C /Users/danilordasilva/workspace/random/LAPTracker pull --ff-only`. During this session the hook failed seven times in the main checkout on exactly these timeouts (10 s default on `players`/`upstream-status`, 30 s on the route tests, 5 s on test bodies).
- 10 s covers the slowest measured body with 2x headroom up to load average 69. The first done-when run reached 87 and pushed bodies past 5 s; whether 10 s holds at that load was not measured.
- Vitest prints that `isolate: false` would save about 1.5–4 s per run. Not changed: it would share module state across files.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches only the test config; no app code, cron path or quota.
Owner must do first: merge this PR into `dev`, then fast-forward the main checkout (`git -C /Users/danilordasilva/workspace/random/LAPTracker pull --ff-only`, on `dev` and clean) so the Stop hook stops failing on PGlite timeouts.
Plan changes needed: none.

<adjustments>
- `pnpm check` took 121–166 s here with three other test runs going (load 36–69). A Stop hook failure on `Hook timed out` or `Test timed out` before this PR is in the main checkout is the known #124 noise, not a regression.
- No test file sets its own hook or test timeout; a new PGlite test file needs none.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/137
