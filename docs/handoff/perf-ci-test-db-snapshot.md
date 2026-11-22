# perf: migrate the test database once, load a copy per file (issue 592)

## Built

- `lib/db.test-helpers.ts`:
  - `testDbSnapshot()` returns the path of a tarball of a migrated, seeded database and builds it on first use. It creates one PGlite, runs the `drizzle/` migrations, seeds the board labels, and calls `dumpDataDir("none")`. The file is `<os tmpdir>/laptracker-test-db/<hash>.tar`. The hash covers the `.sql` migrations (name and content), `drizzle/meta/_journal.json`, the ranks fixture, the helper file itself, and the PGlite and drizzle-orm pins in `package.json`. The file is written under `<path>.<uuid>.tmp` and then renamed into place.
  - `openTestDb()` keeps its signature. It reads the tarball and returns a new in-memory `PGlite({ loadDataDir })`. Each file still gets its own private instance.
  - `truncateAll` and `noQueryDb` are unchanged.
- `vitest.global-setup.ts` (new, 7 lines) calls `testDbSnapshot()` once before the workers start. `vitest.config.ts` lists it under `globalSetup`.
- D19: a dated amendment describing how tests now get a database.
- No test file changed. No new dependency.

## Decisions

- **Dump and load, uncompressed.** These were measured on one PGlite 0.5.15 in vitest, on this Mac at load ~20:
  - a fresh open costs initdb 589 ms plus migrate 159 ms (68 migrations), then the seed;
  - loading the dump costs 88–103 ms uncompressed (44 MB) and 155–198 ms gzipped (5 MB);
  - `clone()` costs 138–187 ms, and it needs a live source instance in every worker.

  Uncompressed is the fastest. 44 MB in the temp dir is fine on CI and on a laptop.
- **What the key hashes.** Only what the migrator reads: the `.sql` files and the journal. The `drizzle/meta/*_snapshot.json` files are drizzle-kit metadata (7 MB) and are left out. Hashing takes 1.2 ms per open. The helper's own source is in the key, so an edit to the seed rebuilds the dump. No paths are hashed, so worktrees with the same migrations share one file.
- **The global setup only avoids duplicate work.** `openTestDb` builds the dump itself when the file is missing, so a run without the global setup still works. Without it, the first wave of workers would each build the dump.
- **Not changed: `lib/quota-report.test.ts`.** It opened a database in `beforeEach`, so it paid for two full opens per file. The dump fixes that with no edit to the file: run on its own, it went from 1.84–1.94 s to 0.86–0.95 s, and it left the slowest 10. Changing it to `beforeAll` plus `truncateAll` would now save about 0.1 s. Its 14 s in the full suite came from load.
- **Not changed: `scripts/seed.test.ts`.** Its time is the real seed. One `seed({ withStates: true })` inserts about 10,700 `member_snapshots` rows and 720 `alliance_snapshots` rows and takes 5.2 s. The two test bodies take 4.6 s and 2.5 s when the file runs alone. It has no real timers and opens the database once. A faster version would need a smaller seed, so it would no longer check the real one.
- **`hookTimeout` and `testTimeout` are unchanged.** Their comments come from four parallel `pnpm test` runs at load 66. This change was not measured that way, so there are no new numbers to set them by.
- **Persona verdicts.**
  - Engineering: approve. It is one function and one 7-line setup file, test files did not change, and the comment says where the file lives and what rebuilds it. An agent that adds a migration does nothing extra. One note, not fixed (see Open issues): the `hookTimeout` comment still says "PGlite open+migrate in beforeAll".
  - Adversarial: no blocker after one fix. Its findings:
    - The temp name was `<path>.<pid>.tmp`. Two threads in one process (vitest pool `threads`) would share a pid and could write the same temp file. Fixed: the name now uses a random UUID.
    - State shared across files: none. The tarball is only read. Each `openTestDb` gets its own in-memory instance. The file's mtime and size stayed the same through the 10 full runs that used it.
    - A stale dump hiding a migration bug: any change to a `.sql` file or the journal changes the key. Tested by appending a broken statement to `0067_member_squads_latest.sql`: the run rebuilt the dump and failed with the SQL error. CI starts with an empty temp dir, so every CI run migrates from `drizzle/` once. The three migration tests still apply migrations to fresh instances.
    - Parallel workers and concurrent runs in other worktrees: the file is renamed into place, so nobody reads half a file. Tested with two cold `vitest run`s sharing one empty `TMPDIR`: both passed, and one complete `.tar` was left with no `.tmp` files.
    - A missing temp dir: `mkdirSync(..., { recursive: true })` creates it. Tested with `TMPDIR` set to a path that did not exist.
    - Accepted risks, listed under Open issues: old dumps are never deleted, and a dump corrupted by something outside the tests would fail every DB test until it is deleted.

## Deviations

- The brief's measurement plan says "the sum of per-file times, from the JSON reporter". The JSON reporter times a file from its first test's start to its last test's end (`vitest/dist/chunks/cli-api.*.js`, `testResults[].startTime/endTime`). That leaves out `beforeAll`, which is where most files call `openTestDb`, and it leaves out imports. So it cannot show this change. Its numbers are reported below anyway. The per-file sums I compare come from a small scratchpad reporter that is not committed. It adds up vitest's `TestModule.diagnostic()` fields: run including hooks, collect, setup, prepare and environment.
- The brief says 67 migrations; `drizzle/` has 68 (`__drizzle_migrations` holds 68 rows).

## Verified

All runs were on a 10-core Mac shared with other agents. Load ranged from 4 to 34, so the interleaved pairs are the fair comparison.

- **Sequential, 3 runs each** (`pnpm vitest run`, dot and JSON reporters):

  | | Run 1 | Run 2 | Run 3 |
  | --- | --- | --- | --- |
  | Before: wall | 85.1 s (load 4) | 98.2 s (load 14) | 223.1 s (load 24) |
  | Before: JSON per-file sum | 160.0 s | 189.2 s | 506.7 s |
  | After: wall | 100.2 s (load 22) | 44.7 s (load 34) | 45.2 s (load 31) |
  | After: JSON per-file sum | 560.3 s | 231.8 s | 237.5 s |

- **Interleaved old/new pairs at load 20–26.** "Old" is the original helper plus a no-op `testDbSnapshot` export, so the global setup loads. First set, 3 pairs (dot and JSON reporters), wall: old 74.0 / 71.5 / 81.5 s, new 41.1 / 50.3 / 50.3 s. Second set, 3 pairs with full per-file times:

  | | Old | New |
  | --- | --- | --- |
  | Wall | 76.1 / 74.4 / 70.7 s | 66.0 / 45.9 / 46.5 s |
  | Sum of per-file time, all phases | 647.2 / 632.6 / 599.2 s | 554.3 / 374.4 / 382.7 s |
  | Of that, run including hooks | 526.5 / 511.8 / 485.7 s | 379.9 / 255.5 / 259.6 s |
  | Of that, collect (imports) | 119.5 / 119.6 / 112.3 s | 173.2 / 117.7 / 121.9 s |

  The first new run hit a load spike. Median wall over all six pairs: 74.2 s to 48.4 s (−35 %). Median per-file sum over the three pairs of the second set: 632.6 s to 382.7 s (−40 %). Hook time halved. Import time did not change.
- **Slowest 10 files**, full per-file time, pair 2 of the second set:

  | Old | | New | |
  | --- | --- | --- | --- |
  | member-session | 8.1 s | samples | 7.5 s |
  | tick route | 8.1 s | member-session | 7.2 s |
  | samples | 7.9 s | tick route | 6.8 s |
  | scripts/seed | 7.4 s | scripts/seed | 6.0 s |
  | manual-event route | 6.1 s | shield-read | 5.0 s |
  | cross-workspace | 6.0 s | cross-workspace | 4.9 s |
  | turned-off | 5.9 s | admin/squads-read route | 4.9 s |
  | record-delete | 5.9 s | manual-event route | 4.9 s |
  | admin/squads-read route | 5.9 s | thefts | 4.5 s |
  | shield-read | 5.8 s | cross-workspace-reads | 4.3 s |

  In pair 3, `lib/quota-report.test.ts` was in the old top 10 at 6.0 s. It is in no new top 10.
- **Not flaky.** The new helper passed 10 full-suite runs: 3 sequential, 6 interleaved and `pnpm check`. Every run had 1,534 passed and 4 skipped (2 files skipped), the same counts as before.
- **`pnpm check` passed** in 118 s at load ~22: prettier, eslint, tsc, vitest 50.0 s, check-drift, i18n.
- The edge cases in the adversarial verdict were tested: broken migration, missing `TMPDIR`, and two concurrent cold runs.
- **CI estimate, not measured.** Vitest took 366 s of the 443 s `check` job. CI is CPU-bound on 4 vCPUs, so vitest's wall time should track the per-file sum (×0.6). That puts vitest at about 220–240 s and the `check` job at about 300–320 s, roughly 2 minutes less. The saving could be larger on CI, where an open took longer under load. The orchestrator measures the real number after pushing.
- No upstream, Discord, Neon or Vercel call, and no `/api/quota`.

## Open issues

- **Old dumps are never deleted.** Every distinct key leaves a 44 MB file in `<tmpdir>/laptracker-test-db/`, and so does every edit to `lib/db.test-helpers.ts` or to a migration. macOS clears `/var/folders/.../T` on its own schedule, and CI starts empty. A clean-up step would have to avoid deleting a file that another worktree is reading.
- **A dump corrupted outside the tests stays in use.** If something other than the tests damages the file (disk error, manual edit), every DB test fails until `<tmpdir>/laptracker-test-db` is deleted. The tests never write it after the rename.
- **Stale `hookTimeout` comment.** It still says "PGlite open+migrate in beforeAll", and its 140 s comes from the old per-file migrate. Lowering it needs the same measurement the comment used: four parallel `pnpm test` runs.
- **Imports are now the largest phase:** about 120 s of per-file time and 30 % of the wall. That is each file importing the Next route modules, the schema and the PGlite WASM. Not looked at here.
- **`scripts/seed.test.ts`, under the "tests check real behaviour" rule.** It checks `pnpm db:seed --with-states`, a dev-only flag that adds two review states. It protects a local tool, not product behaviour, so it is a candidate to review under that rule. It is not deleted. The brief says the rule is in CONTRIBUTING § Working rules, but that section on `origin/dev` (fbc54558) has no such line yet. `lib/quota-report.test.ts` protects real behaviour (D70: the Friday check's might line carries counts and no member name).

## What was missing from the task prompt?

Nothing blocking. The prompt did not say the JSON reporter leaves out `beforeAll` and import time, which hid this change; the numbers above come from a small reporter kept outside the repo.

Measured on CI (this PR's run): the `check` job took 257 s (was 443 s), vitest 184 s (was 366 s).

## Next

- Model/effort: keep. Most of the time went into measuring. The machine's load (4–34, from other work) made sequential runs useless for comparison until the runs were interleaved.
- Owner first: nothing. The orchestrator pushes, measures the CI `check` job against 443 s, and opens the PR.
- Plan change: none.

<adjustments>
- Tests get a database from a cached dump: about 90 ms per `openTestDb`, against about 750 ms plus the seed before. A file that opens in `beforeEach` no longer costs much. Don't convert files for speed.
- Adding a migration needs no extra step: the next run rebuilds the dump (about 3 s, once).
- The JSON reporter's per-file time leaves out hooks and imports. To measure test-time work, use `TestModule.diagnostic()` (run, collect, setup, prepare and environment), or compare wall time in interleaved runs on a loaded machine.
- Local wall time for the next cut: about 46–50 s for the full suite at load ~22, of which imports are about 30 %.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/603
