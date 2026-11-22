# chore/ci-lint-cache — issue 592, CI audit R5 and R6

## Built

1. R5, lint and type-check caches.
   - `pnpm check` and `pnpm check:fast` run `prettier --check --cache --cache-strategy content` and `eslint --cache --cache-strategy content --cache-location node_modules/.cache/eslint/`. Prettier's cache goes to its default, `node_modules/.cache/prettier/`.
   - `tsconfig.json` already had `incremental: true`. It now sets `tsBuildInfoFile: node_modules/.cache/tsc/tsconfig.tsbuildinfo`, so nothing is written at the repo root. `node_modules/` and `*.tsbuildinfo` were already in `.gitignore`.
   - `.github/workflows/ci.yml` is unchanged: no cache steps (see Decisions).
2. R6, a faster Stop hook.
   - `package.json` `check:fast` runs the same gates as `check`, but runs tests through `scripts/test-changed.sh`:
     - `vitest run --changed origin/dev --passWithNoTests`;
     - then `vitest run` on every tracked `*.test.ts` that calls `readFileSync` or `readdirSync`, found by `git grep` at run time (19 files today). The guard tests scan source trees without importing them, so vitest's import graph never links a scanned file to its guard (review MUST 1). The grep is the single list, so a new guard is picked up with no edit;
     - without `origin/dev`, the full `vitest run`.
   - `vitest.config.ts` `forceRerunTriggers`: `**/package.json`, `**/vitest.config.*`, and, anchored at the repo root, `vitest.global-setup.ts`, `pnpm-lock.yaml`, `drizzle/**`, `fixtures/**`, `docs/analytics/tracking-plan.md`, `lib/i18n/glossary/*.md`, `lib/screenshot/tessdata/**`. The `atRoot` helper escapes glob characters in the checkout path. `e2e/fixtures` and the skill fixtures no longer match.
   - `scripts/hooks/stop-check.sh` calls `pnpm check:fast`, and its messages say so. The `lefthook.yml` header comment now says the Stop hook runs `pnpm check:fast`.
3. Docs: CONTRIBUTING (Scripts table row for `check:fast`, the Stop hook line), and a dated amendment to D29, the decision that records `ci.yml`'s triggers.

## Decisions

- No CI cache (orchestrator, 2026-11-22). A first version added `actions/cache/restore` and `actions/cache/save` to `ci.yml`, with the save step on `workflow_dispatch` only. `ci` has no non-PR run on `dev`, and a cache must never be saved from a PR, so the save step would almost never run. Extra `ci` runs to save it cost about as many minutes as they save, so the steps were removed and `ci.yml` matches `dev`. The caches are local only.
- The prettier cache is included, as the report's R5 command line has it. Its cache is content-hashed, lives in the same `node_modules/.cache`, and took prettier from about 19–45 s to about 3 s locally.
- The ESLint cache is safe for this config. There is no type-aware linting (no `parserOptions.project`). The rules are per file, except `import-x/no-restricted-paths` and `import-x/order`, which depend only on the file's own import strings. The config's `readdirSync(lib)` list is part of the config hash, so a new `lib/notify*` or `lib/discord-*` file invalidates the cache. tsc still type-checks every file against its hashed build info.

## Deviations

- `forceRerunTriggers` differs from the task's list:
  - Vitest matches the triggers against absolute paths (`picomatch` on `resolve(root, file)`), so `pnpm-lock.yaml`, `drizzle/**` and `fixtures/**` as written would never match. They are anchored at the repo root.
  - `**/vitest.config.*/**` did not match `vitest.config.ts` (checked with picomatch 4.0.7), so I used vitest's own default forms, `**/package.json` and `**/vitest.config.*`.
  - Added `vitest.global-setup.ts`, a shared input that no test imports.
- The guard step selects tests by grep, not by a hand-kept list. It also runs tests that read only fixtures or migrations (for example `lib/private/thefts.test.ts`), which costs a few seconds and needs no upkeep.

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
- After the review (load average 27–34, so slower than the numbers above):
  - A change in a scanned file runs its guard. I committed the work, then appended the upstream host literal to `app/(pages)/players/page.tsx`, a file no test imports. Plain `vitest run --changed HEAD` printed "No affected test files found" and exited 0. `scripts/test-changed.sh` with `HEAD` for `origin/dev` failed in `lib/sources/no-upstream-literals.test.ts`. The change was reverted.
  - Without the ref (the script with `origin/no-such-branch`) it printed "test-changed: no origin/no-such-branch, running every test" and ran all 336 files.
  - The triggers were checked with picomatch on this checkout's absolute paths. All nine inputs match; `e2e/fixtures/seed.ts`, `.claude/skills/tlc-spec-lean/scripts/fixtures/plan.md` and `lib/compact.ts` do not.
  - Small change (a comment in `lib/compact.ts`), same load: `check:fast` (with `HEAD`) took 91 s and ran 132 related files plus 19 disk-reading files. The full `pnpm check` took 147 s.
  - `pnpm check:fast` on this branch passed: 336 files (every trigger fired), then the 19 disk-reading files. `pnpm check` passed: 334 files passed, 2 skipped.

## Open issues

- Note: CI keeps running `pnpm check` cold. A CI cache would need a save run that costs about what it saves, because `ci` has no non-PR run on `dev` and caches must never be saved from PRs. Revisit if the repo goes private or `ci` gains a trigger on `dev` (D29, amendment 2026-11-22, R5).
- Plan sections that need a change (not edited here, per CLAUDE.md): `docs/IMPLEMENTATION_PLAN.md` §11.4 (line 567, "`Stop` → `pnpm check`") and `docs/SESSION_PLAYBOOK.md` line 254 ("Stop → pnpm check") still say the Stop hook runs `pnpm check`. Both should say `pnpm check:fast`, with CI running the full `pnpm check`.
- CLAUDE.md § Verification still says to run `pnpm check` before reporting done, as the task requires. The Stop hook is now the lighter gate, so an agent that relies only on the hook no longer runs the full suite locally; CI still does.

## Next

- R11 (vitest sharding) stays conditional on the measured vitest time.
- Review follow-ups, not done here:
  - `check` and `check:fast` repeat the same gate chain in `package.json`. One script could take the test step as an argument.
  - Decision placement: the local-cache note sits in D29, a release decision. A CI or tooling decision may fit better.
  - The tracking-plan, glossary and tessdata triggers run the full suite for inputs that the disk-reading tests already cover through the guard step.

What was missing from the task prompt? That nothing dispatches `ci` on `dev` any more, so a CI cache saved on `workflow_dispatch` alone would rarely be saved; and that vitest matches `forceRerunTriggers` against absolute paths.

PR: https://github.com/daniro-san/LAPTracker/pull/677
