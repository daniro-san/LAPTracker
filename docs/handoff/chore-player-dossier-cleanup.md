# chore/player-dossier-cleanup

## Built
- `lib/queries/alliance-page.ts` imports `dailyFit` from `history-readings` instead of its own `fit` copy; unused `gt` and `isNull` imports removed.
- `ledger.progress` ("Daily progress") removed from `lib/copy.ts`, all `lib/i18n/<lang>.ts`, all `*.stamps.json` and the glossary rows in `lib/i18n/glossary/*.md`.
- `docs/DESIGN.md`: `player-progress` entry now describes the player page's growth card; the `drawn-card` list says "the growth card" instead of "daily progress".

## Decisions
- The `player-progress` entry keeps its name, since `app/_ui/PlayerProgress.tsx` still holds the event bands, summary text and event note.
- The old "fewer than two readings" sentence is replaced by "With no daily series there is no card", which matches the page (`growth.length > 0`).

## Deviations
None.

## Verified
- `pnpm vitest related --run lib/queries/alliance-page.ts lib/copy.ts`: 198 files, 1176 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n: 17 languages up to date).

## Open issues
- Pre-existing, from the PR #847 review: `lib/queries/alliance-page.ts` near line 1170, `desc(sourceUpdatedAt)` sorts NULLs first in Postgres. Not changed here.

## Next
- Decide whether to fix the NULL ordering above.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
