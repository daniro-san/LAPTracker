# fix-671-fallback-locale

## Built
- `pickLanguage` in `app/_ui/locale.ts` returns the served language as the Intl locale when the viewer has no tag in that language. Before, it fell back to the first Accept-Language tag Intl supports, so an English page for `fa`, `ar-EG` or `he` got that browser's digits, compact words and calendar.
- Removed `pickLocale`, which only that fallback used.
- Tests in `app/_ui/locale.test.ts`: `fa`, `ar-EG` and `he` give "1.20M" and a Gregorian date; `pt-BR` keeps "4,29B".

## Decisions
- The same rule applies to any unserved language (for example `hu-HU` alone now formats as `en`), because the issue asks that an English fallback format in English. The old test expectation `hu-HU` was changed to `en`.
- Served languages keep the viewer's own regional tag (en-GB, pt-PT, es-AR), unchanged.
- No client component reads `navigator.language`; all public formatting takes the locale from `requestLocale`.

## Deviations
None.

## Verified
- `pnpm vitest related --run` on the changed files: 26 passed.
- Both new/changed tests fail on the pre-fix `locale.ts` ("۱٫۲۰M").
- `pnpm check`: passed.

## Open issues
None.

## Next
- None.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
