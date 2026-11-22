# fix/592-words

Part of #592 (engineering review H3).

## Built
- `lib/words.ts`: `fill(template, vars)` and `plural(n, { one, other }, locale)`. It imports nothing from the project; an ESLint zone enforces that, like `lib/compute`.
- Old helpers deleted, callers moved, no re-export shims:
  - `fill` in `lib/copy.ts`: an unknown placeholder stayed as written. About 250 importers now import it from `lib/words`.
  - `fill` in `lib/copy-push.ts`: a missing value became `""`. Used by `lib/push-tick.ts` and `lib/push-uses.ts`.
  - `fill` in `lib/shield-post.ts` (the Raid prep Discord post): a missing value became `""`.
  - `say` in `app/(private)/_ui/facts-form.ts`: an unknown placeholder stayed as written (`?? all`).
  - `fillIn` in `app/(private)/_ui/draft-known.ts`: `fill` with an `undefined` word made `""`. Callers now write `fill(w[key] ?? "", …)`.
  - Inline `.replace("{x}", …)` in `ThisIsMe`, `FirstUse`, `ReadStatusBar`, `lib/private/translate-limits.ts`, `lib/private/discord-translate-run.ts` and `lib/private/fact-text.ts`: only the first occurrence was replaced, and a missing placeholder stayed as written.
- Plural helpers deleted: `counted` in `FollowUpWeek.tsx`, `facts-form.ts`, `import-words.ts`, `insights-format.ts` and inside `share-lines.ts`; `plural` in `SendScreenshots.tsx` and `members-sheet.ts`. Also gone: the inline `Intl.PluralRules` in `BoardStrip`, `EditorSaveBar`, `HomeMembers`, `MeSelfReport`, `calendar-data.ts` (2), `roll-call/team/page.tsx`, `shots/[id]/page.tsx`, `follow-up-rules.ts` and `trend-words.ts`. Every call is now `plural(n, { one: t["key.one"], other: t["key.other"] }, language)`, so the `as WorkspaceKey` casts are gone and the type checker checks each key.
- ESLint `no-restricted-syntax` bans `Intl.PluralRules` everywhere except `lib/words.ts`. The message names `plural` from `lib/words.ts`. The colour entry, which applies to `app/` and `lib/brand/components/`, lists the same selector: an entry that sets `no-restricted-syntax` replaces an earlier entry's options for the files both match.
- `counted` in `lib/private/desk-action.ts` is renamed `withActionEvent`, and its callers (35 route files) and its test are updated. Event names and properties are unchanged (`ws_action`, `feature`, `action`, `place`).
- `lib/words.test.ts`: 4 tests (values filled; throws outside production; `{x}` kept in production; en/fr/pt-BR plurals).
- Docs: D23 amendment; CONTRIBUTING check-table row; ARCHITECTURE (pure modules, dependency rule, enforcement table); the tracking plan names `withActionEvent`.
- To stay within `max-lines-per-function` and `complexity`, I extracted four named steps from functions that grew longer: `draftLabel` and `draftCounts` (`SendScreenshots.tsx`), `leftOutOf` (`insights-effort-words.ts`), `kvkBased` (`insights-more-words.ts`). `entryHead` (`SecretOpsReview.tsx`) holds the two `?? ""` that `fillIn` used to hide.

## Decisions
- The rule for a placeholder with no value is the recommended one. `fill` throws when `NODE_ENV` is not `production` (vitest, `next dev`). In production the `{x}` stays as written, on pages, in push and in Discord. A value of `undefined` counts as missing. `0` and `""` count as values.
- `plural` takes the two forms, not a dictionary and a key, so it stays dependency-free and works with every dictionary type (`WorkspaceDictionary`, client `Words`, `ShieldPostWords`).
- I moved the inline `.replace("{x}")` calls to `fill` too, because they are the same placeholder rule.

## Deviations
- Three `n === 1` plural choices remain. They do not use `Intl.PluralRules`, so the lint does not catch them. Moving them to `plural` needs a language parameter that their callers do not have:
  - `lib/private/member-days.ts` `plural` (`averageLine`): `n` is always at least 1, and en, fr and pt-BR agree for integers of 1 or more, so the output is correct today.
  - `lib/shield-post.ts` (`awayOne` / `away`): `n` is always at least 1; correct today.
  - `app/(private)/_ui/SecretOpsReview.tsx` (`shots.theftsSaved.one` / `.other`): with 0 saved, French and Portuguese get the plural form, where the language rule gives the singular. Issue 705.
- Review of the PR found more hand-written one/other choices the diff leaves: `lib/private/member-squads.ts`, the roll-call page, `RaidPrepHead.tsx`, `RaidPrepMarks.tsx`, `RollCallRest.tsx` and `SignOutUsersSheet.tsx`. Most only see 1 or more; issue 705 covers checking and moving them to `plural`.

## Verified
- Copy output: no change found. The full suite passes with the new throwing `fill`, so no tested caller leaves a placeholder without a value. I checked each push and Raid prep Discord template against its call: every placeholder gets a value, so the old `""` never reached a user. `fill(w.kinds[kind], { team: variant ?? "" })` still gives `""` for a null team, as before. The only behaviour change is on a path no test or template reaches: a placeholder with no value in push or Discord now shows as `{x}` instead of `""`.
- Lint proof, using probe files that I then deleted: a colour literal and `new Intl.PluralRules` in `app/_ui/` each failed with their own message. `new Intl.PluralRules` and `Intl.PluralRules.supportedLocalesOf` in `lib/` failed with the plural message. `lib/words.ts` itself passed. An import of `./copy` added to `lib/words.ts` failed the new zone.
- Each new test fails when its rule is broken, one break each, then reverted: no throw outside production; `""` in production; `plural` as `n === 1`; `vars[key] || undefined` (drops `0` and `""`).
- `pnpm vitest related --run` on the helper files: 191 files, 1096 tests pass.
- `pnpm check`: passes (prettier, eslint, tsc, vitest 1873 passed and 4 skipped, up from 1869 with the 4 new tests; drift; i18n).

## Open issues
- The three `n === 1` sites above.

## Next
- Follow-up: pass the language to `averageLine`, `shieldMessage` and `SecretOpsReview`'s `Saved`, and use `plural` there. That fixes French and Portuguese "0 saved" in Secret Ops. Size S.

What was missing from the task prompt? Nothing blocking. It did not say whether the inline `.replace("{x}")` calls count as `fill` copies; I counted them.

PR: (added by the orchestrator)
