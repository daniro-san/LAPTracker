# chore/ci-lint-cache — issue 592, CI audit R5 and R6

## Built

1. R5, lint and type-check caches.
   - `pnpm check` and `pnpm check:fast` run `prettier --check --cache --cache-strategy content` and `eslint --cache --cache-strategy content --cache-location node_modules/.cache/eslint/`. Prettier's cache goes to its default, `node_modules/.cache/prettier/`.
   - `tsconfig.json` already had `incremental: true`. It now sets `tsBuildInfoFile: node_modules/.cache/tsc/tsconfig.tsbuildinfo`, so nothing is written at the repo root. `node_modules/` and `*.tsbuildinfo` were already in `.gitignore`.
   - `.github/workflows/ci.yml` is unchanged: no cache steps (see Decisions).
2. R6, a faster Stop hook.
   - `package.json` `check:fast` runs the same gates as `check`, but with `vitest run --changed origin/dev`.
   - `vitest.config.ts` `forceRerunTriggers`: `**/package.json`, `**/vitest.config.*`, `**/vitest.global-setup.ts`, `**/pnpm-lock.yaml`, `**/drizzle/**`, `**/fixtures/**`.
   - `scripts/hooks/stop-check.sh` calls `pnpm check:fast`, and its messages say so.
3. Docs: CONTRIBUTING (Scripts table row for `check:fast`, the Stop hook line), and a dated amendment to D29, the decision that records `ci.yml`'s triggers.

## Decisions

- No CI cache (orchestrator, 2026-11-22). A first version added `actions/cache/restore` and `actions/cache/save` to `ci.yml`, with the save step on `workflow_dispatch` only. `ci` has no non-PR run on `dev`, and a cache must never be saved from a PR, so the save step would almost never run. Extra `ci` runs to save it cost about as many minutes as they save, so the steps were removed and `ci.yml` matches `dev`. The caches are local only.
- The prettier cache is included, as the report's R5 command line has it. Its cache is content-hashed, lives in the same `node_modules/.cache`, and took prettier from about 19–45 s to about 3 s locally.
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

## Open issues

- Note: CI keeps running `pnpm check` cold. A CI cache would need a save run that costs about what it saves, because `ci` has no non-PR run on `dev` and caches must never be saved from PRs. Revisit if the repo goes private or `ci` gains a trigger on `dev` (D29, amendment 2026-11-22, R5).
- CLAUDE.md § Verification still says to run `pnpm check` before reporting done, as the task requires. The Stop hook is now the lighter gate, so an agent that relies only on the hook no longer runs the full suite locally; CI still does.

## Next

- R11 (vitest sharding) stays conditional on the measured vitest time.

What was missing from the task prompt? That nothing dispatches `ci` on `dev` any more, so a CI cache saved on `workflow_dispatch` alone would rarely be saved; and that vitest matches `forceRerunTriggers` against absolute paths.

PR: https://github.com/daniro-san/LAPTracker/pull/677
