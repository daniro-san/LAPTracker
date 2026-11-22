# docs-592-architecture-map

## Built

- Rewrote docs/ARCHITECTURE.md from 361 to about 110 lines: a map of folders and what each owns, the dependency rule (CLAUDE.md's wording kept), a table of how each rule is enforced, a per-feature table (route, read or private module, repo module, decisions) and a short `Deps` section.
- Headings `Dependency rule` and `Deps` kept. No other doc links to an ARCHITECTURE.md anchor (a search for `ARCHITECTURE.md#` finds none).
- The 100-line copy of the source types in `Deps` is replaced by a pointer to `lib/sources/types.ts` and `lib/repo/index.ts`, plus the real `Deps` interface.

## Decisions

- The per-feature table lists the main modules by prefix or glob, not every file, so it does not go stale when a file is split.
- Every backticked path was checked (bare module names such as `lib/run` and relative route fragments were resolved against the prefixes the table header gives). Every D-number cited has a file in docs/decisions.

## Deviations

- The enforcement table marks six rules "review only" in five rows, not three: the three asked for, plus three softer ones (items 4 and 5 below share a row).
- Review of the PR (orchestrator): the first dependency bullet keeps the closed list of cross-module edges from the old file, word for word, so "review only" points at a closed list.

## Verified

- Path check and decision-number check over the new file; prettier; `pnpm check` exit 0.

## Open issues

Rules that no lint rule or test enforces, with a proposal for each:

1. `lib/compact` imports nothing from the project. Its zone is missing: eslint.config.mjs lists `lib/compute.ts` and `lib/budget.ts` only. Add `./lib/compact.ts` to that zone's `target`.
2. `lib/logger` imports only `lib/repo` and `lib/redact`. Add a zone with `target: "./lib/logger.ts"`, `from: "."`, `except: ["./node_modules", "./lib/repo", "./lib/redact.ts"]`.
3. `lib/collector` reaches sources, repo, logger and notify only through `Deps`. Today it imports types from `./sources/types` and `./repo`. Add a rule for `lib/collector*.ts` that allows only `import type` from `lib/sources` and `lib/repo` (`@typescript-eslint/no-restricted-imports` with `allowTypeImports`).
4. (extra) `app` imports only the `lib` modules the first bullet lists. A zone from `app` with an `except` list of the feature modules would work but the list needs upkeep.
5. (extra) A route handler holds no logic. Review only (`.claude/rules/api-routes.md`); M6 of the review (roll-call, admin features) is the known violation.
6. (extra) `lib/redact` and `lib/queries/blocked-keys` import nothing from the project: same zone shape as item 1.

## Next

- Add the lint zones for items 1 to 3 (S).
- Update the feature table when the review's M4 (one spelling of followup/follow-up, rollcall/roll-call) renames files.

What was missing from the task prompt? Nothing; the "3 unlinted rules" count was approximate.

PR: (added by the orchestrator)
