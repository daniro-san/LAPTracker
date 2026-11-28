# docs/783-community-tools

## Built
- Section "Other community tools" (dated 2026-11-28) on the desk How-to page, after the home-screen steps and before the open button.
- Copy keys `howto.tools` and `howto.tools.body` in EN, PT-BR and FR (lib/private/dictionary*.ts).
- Five links, alphabetical, names only: last-asylum-unofficial.com, lastasylum.gg, lastasylumbuilder.com, lastasylumplague.com, wiki-last-asylum.com. Each is `https://<domain>/`, `target="_blank"`, `rel="noopener noreferrer"`, min-h-11 (44 px).
- The list is a constant in the page file. No public page changed.

## Decisions
- No new test: dictionary.test.ts already checks every language has the same keys.
- Other desk languages fall back to English through the existing dictionary pattern.

## Deviations
None.

## Verified
- `pnpm vitest related --run` on the three dictionaries: 105 files, 602 tests passed.
- `pnpm check`: completed, i18n reports 17 languages up to date.
- The sites were not fetched.

## Open issues
None.

## Next
- Re-check the list whenever the guide is updated.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
