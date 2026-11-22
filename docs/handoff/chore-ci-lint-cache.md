# chore/ci-lint-cache — issue 592, CI audit R5 and R6

## Built

1. R5, lint and type-check caches.
   - `pnpm check` and `pnpm check:fast` run `prettier --check --cache --cache-strategy content` and `eslint --cache --cache-strategy content --cache-location node_modules/.cache/eslint/`. Prettier's cache goes to its default, `node_modules/.cache/prettier/`.
   - `tsconfig.json` already had `incremental: true`. It now sets `tsBuildInfoFile: node_modules/.cache/tsc/tsconfig.tsbuildinfo`, so nothing is written at the repo root. `node_modules/` and `*.tsbuildinfo` were already in `.gitignore`.
   - `.github/workflows/ci.yml`: after `pnpm install`, `actions/cache/restore` restores `node_modules/.cache` (key and `restore-keys` `lint-<os>-<hash of pnpm-lock.yaml>-`). After `pnpm check`, `actions/cache/save` saves it with key `lint-<os>-<lockfile hash>-<run id>`, only when `github.event_name == 'workflow_dispatch'`. Docs-only PRs skip both steps. Both actions are pinned to the SHA `e2e.yml` already uses (`55cc8345863c7cc4c66a329aec7e433d2d1c52a9`, v6.1.0).
2. R6, a faster Stop hook.
   - `package.json` `check:fast` runs the same gates as `check`, but with `vitest run --changed origin/dev`.
   - `vitest.config.ts` `forceRerunTriggers`: `**/package.json`, `**/vitest.config.*`, `**/vitest.global-setup.ts`, `**/pnpm-lock.yaml`, `**/drizzle/**`, `**/fixtures/**`.
   - `scripts/hooks/stop-check.sh` calls `pnpm check:fast`, and its messages say so.
3. Docs: CONTRIBUTING (Scripts table row for `check:fast`, the Stop hook line, the CI line), and a dated amendment to D29, the decision that records `ci.yml`'s triggers.

## Decisions

- `ci.yml` has only `pull_request` and `workflow_dispatch`, so the cache is saved on `workflow_dispatch` only. A dispatch on any branch other than `dev` saves a cache that only that branch can restore, so it cannot reach other PRs.
- The prettier cache is included, as the report's R5 command line has it. Its cache is content-hashed, lives in the same `node_modules/.cache`, and took prettier from about 19–45 s to about 3 s locally.
- `restore-keys` stays on the lockfile hash, as the task says. A broader prefix would also restore caches made with other eslint plugin versions. ESLint's cache tracks its own version and the config, but not every plugin's rule code.
- The ESLint cache is safe for this config. There is no type-aware linting (no `parserOptions.project`). The rules are per file, except `import-x/no-restricted-paths` and `import-x/order`, which depend only on the file's own import strings. The config's `readdirSync(lib)` list is part of the config hash, so a new `lib/notify*` or `lib/discord-*` file invalidates the cache. tsc still type-checks every file against its hashed build info.

## Deviations

- `forceRerunTriggers` differs from the task's list:
  - Vitest matches the triggers against absolute paths (`picomatch` on `resolve(root, file)`), so `pnpm-lock.yaml`, `drizzle/**` and `fixtures/**` would never match. They are prefixed with `**/`.
  - `**/vitest.config.*/**` did not match `vitest.config.ts` (checked with picomatch 4.0.7), so I used vitest's own default forms, `**/package.json` and `**/vitest.config.*`.
  - Added `**/vitest.global-setup.ts`, a shared input that no test imports.

## Verified

Local machine: 10 cores, load average 16–24 from other sessions throughout, so the times are noisy.

- Cold vs warm, as `pnpm check` runs each gate (cold means no `node_modules/.cache`; three cold runs):

  | gate                        | before (no cache) | cold, new flags | warm    |
  | --------------------------- | ----------------- | --------------- | ------- |
  | prettier                    | 35.5 s            | 18.7–44.8 s     | 3.0 s   |
  | eslint                      | 22.6 s            | 26.2–43.3 s     | 0.9 s   |
  | tsc                         | 25.9 s            | 14.1–57.6 s     | 1.6 s   |

  (One cold eslint run read 6.1 s; I could not reproduce it, so it is left out of the range.)
- A warm cache still fails on a new error. With warm caches I added `const unusedForCacheTest = 1;` to `lib/compact.ts`. `eslint --cache …` exited 1 (`@typescript-eslint/no-unused-vars`), and `pnpm check` failed at eslint on the next run as well. A type error (`export const x: number = "x"`) made the warm `tsc --noEmit` exit 2 (TS2322).
- Stop hook, same small change (a comment appended to `lib/compact.ts`):
  - Before: the old hook (`pnpm check`, full suite) took 155 s.
  - After: `check:fast` with only that file changed took 66 s, measured as the same chain with `vitest run --changed HEAD` after committing this branch. It ran 131 of 335 test files (744 tests), because `lib/compact.ts` is widely imported. A leaf file runs fewer.
  - The real hook on this branch took 80 s. It ran all 335 files, because the branch itself changes `package.json` and `vitest.config.ts`, which are triggers. That shows the force-rerun works.
- `pnpm vitest related --run vitest.config.ts package.json tsconfig.json` passed. `pnpm check:fast` passed (335 files, 1752 tests). `pnpm check` passed (warm, 78.8 s, 335 files, 1752 tests, drift and i18n clean).
- Not verified here: the workflow itself. GitHub Actions cannot run locally.

How to verify in CI:

1. After merge, dispatch `ci` on `dev` (`gh workflow run ci.yml --ref dev`). Its log should show `Cache not found` on restore, then `Cache saved with key: lint-Linux-<hash>-<run id>`.
2. The next PR's `check` run, on the same lockfile, should show `Cache restored from key: lint-Linux-<hash>-<run id>`. Its `pnpm check` step should be shorter than in a PR run before this change, with prettier, eslint and tsc each taking a few seconds. That PR run must show no save step.

## Open issues

- Nothing dispatches `ci` on `dev` on a schedule. Prepare release starts only `e2e` (the `ci.yml` header comment and D29's 2026-11-22 amendment). So the cache warms only when someone dispatches `ci` on `dev` by hand, and every lockfile change (Dependabot merges) makes PRs cold again until the next dispatch. Without dispatches, R5 saves nothing in CI. Options, for the owner or the orchestrator: dispatch `ci` on `dev` after each release-prepare, which costs one `check` run, about 6 min, per release; or add `push: branches: [dev]` with the save step only, which costs a run per merge. Neither is done here, because both add Actions minutes.
- CLAUDE.md § Verification still says to run `pnpm check` before reporting done, as the task requires. The Stop hook is now the lighter gate, so an agent that relies only on the hook no longer runs the full suite locally; CI still does.

## Next

- Decide how `ci` gets a non-PR run on `dev` (Open issues, first item), then re-measure the `check` step's time on PRs over a week.
- R11 (vitest sharding) stays conditional on the measured vitest time.

What was missing from the task prompt? That nothing dispatches `ci` on `dev` any more, so a save step on `workflow_dispatch` alone rarely fires; and that vitest matches `forceRerunTriggers` against absolute paths.

PR: (added by the orchestrator)
