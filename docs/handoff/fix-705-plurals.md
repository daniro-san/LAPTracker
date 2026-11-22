# fix-705-plurals

## Built
Every hand-written one/other choice of a workspace copy key now goes through `plural()` from `lib/words.ts`, with the language the caller has.
- `SecretOpsReview.tsx` ("Saved n thefts"): 0 now takes the singular in fr and pt-BR. This is the reported bug. `language` is a new prop on `DraftReview`, passed by the shots page.
- `SaveRow.tsx`: `language` prop, passed by `AllianceFeatures` and `RaidPrepSettings` (new prop, from the settings page).
- `RaidPrepHead.tsx` (Show chip, "Mark the n", copy names, copied names), `RaidPrepMarks.tsx` (check notice; `TrackerCheck` takes `page`), `RollCallRest.tsx` (`RestBar` takes `language`; away and not-seen counts), roll-call page (archived hint).
- `lib/private/member-squads.ts`, `member-days.ts` (`DaysFormats.language`, `averageLine` takes `language`), `desk-activity-words.ts`, `shield-status.ts` and `read-status.ts` (`language` threaded from the route and Frame), `theft-warning.ts`, `lib/shield-post.ts` (`shieldMessage` takes `language`).
- `SignOutUsersSheet.tsx`: `plural(..., "en")`, because /admin is English only (D48).
- Test: `SecretOpsReview.test.ts` (0 in fr is singular, 0 in en is plural).

## Decisions
- Sites that cannot show 0 today (the one-form of the copy is unchanged for 1): SaveRow (only shown when changes > 0), Show chips, accept, copy names (rendered only when n > 0), check notice (returns null at 0), RollCallRest away and not-seen counts (guarded by > 0), roll-call archived hint (null at 0), squads empty (null at 0) and summary (null with no squads), member-days averages (null with no listed day), desk-activity thefts (count >= 1), shield-status away (guarded by 0), shield-post away (guarded by truthiness), theft-warning (an attacker group has at least 1 theft), SignOutUsersSheet (English: 0 stays plural). No extra tests added for these.
- Left alone: `AllianceStatement.tsx` (`n === 1 ? seatOne`). It is a public page with 17 languages and `seatOne` writes a literal "1", so `plural()` would print "1 seat" for 21 in Russian. `insights-zones-words.ts` `known === 1` is a different sentence, not a count's plural form. Number checks such as page === 1 are not plural choices.
- `SavedThefts` is exported for the test, and its `link` prop is renamed `thefts` so `SecretOpsReview` can spread its props into it (keeps the function under the 80-line lint limit).

## Deviations
None from the task. The roll-call "one" copies still hold a literal "1" in some keys; that is safe only because they are shown for n >= 1.

## Verified
- `pnpm vitest related --run <changed>`: 63 files, 366 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).
- The new test reaches the fixed branch: before the change, 0 chose the `.other` key ("0 vols enregistrés.").

## Open issues
- Other `.one` copies that hold a literal "1" (`save.pendingOne`, `roll.prep.*.one`, `card.days.allNone.one`) would print "1" for 0 in fr or pt-BR if a site ever showed 0. Not reachable today.
- `AllianceStatement` `seatOne` (see Decisions) is a latent wrong form for languages whose "one" covers more than 1.

## Next
- Consider `{n}` in the `.one` keys listed above so a future 0 reads right.
- Decide whether `AllianceStatement` should move to `plural()` with a `{n}` in `seatOne`.

What was missing from the task prompt? Nothing; the list of sites was enough.

PR: (added by the orchestrator)
