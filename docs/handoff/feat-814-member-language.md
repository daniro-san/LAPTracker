# feat: the desk member card shows the member's game language (#814)

## Built

- `lib/repo/player-reads.ts`: `gameLanguageReads` returns each member's newest language and the time of that read (same `DISTINCT ON` query as before, one more column). `gameLanguages` now calls it and keeps the codes, so its callers are unchanged.
- `lib/private/member-card.ts`: `memberCard` reads the member's newest own-alliance language within 60 days (`NOTICE_LANGUAGE_DAYS`) and sets `card.gameLanguage` (`line`, `language`, `other`, `date`), or null with no read.
- `app/(private)/_ui/MemberCards.tsx`: one line under the card header, "Game language: <name> (read <date>)". The name comes from `LANGUAGE_NAME`; an unmapped code shows "Other" (`notices.langs.other`).
- `lib/private/dictionary.card.ts`: `card.gameLanguage` in EN, PT-BR and FR.
- `docs/decisions/D132-...md`: dated amendment.
- Tests in `lib/private/card-follow-up.test.ts`: line with name and date; no read gives no line, an unmapped code is Other; another alliance's read is never used.

## Decisions

- The structured fields go to the browser and the name is filled there, because `LANGUAGE_NAME` lives in `app/(private)/_ui` and lib may not import from app.
- 60-day window, the same as the notice counts, since a game language rarely changes. Follow-up's 14 days are only for the ready message.

## Deviations

- The card makes one extra parallel query (one member, bounded window) instead of extending Follow-up's. Follow-up's language query is inside `cardFollowUp` and is skipped while that tab is off, so sharing it would have meant changing its signature.

## Verified

- `pnpm vitest related --run` on the changed files: 130 files, 748 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).

## Open issues

- None.

## Next

- Optionally pass the card's language read into `cardFollowUp` to drop the extra query.

What was missing from the task prompt? Nothing; the date format ("Thu, Nov 19") and the 60-day window were my choices.

PR: (added by the orchestrator)
