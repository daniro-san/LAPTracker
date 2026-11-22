# feat/585-claim-check: a "This is me" claim an officer can check (#585 batch 3, slice S6)

Part of #585 (finding F15). Size S. Slice S6 of `.specs/features/585-one-worklist/plan.md` (criterion 23).

## Built

- Home's "To review": in each pending "This is me" claim, the player ("Wren Invented · R3") is a link to their member card, `/w/[slug]/members?m=<uid>`, 44 px tall (`app/(private)/_ui/MemberLinks.tsx`).
- The claim says the day it was asked, in server time: "Asked on Thu, Nov 19 to see their own page." It comes from `workspace_users.player_linked_at`, which `linkReviews` now returns as `at` (`lib/private/me-link.ts`). Home passes `f.date` to `ToReview` as `day` (`app/(private)/w/[slug]/page.tsx`, `app/(private)/_ui/ToReview.tsx`).
- The refuse button reads "Not them" (PT-BR "Não é essa pessoa", FR "Pas cette personne") on Home and on the member card's pending line. The dictionary key `me.review.reject` is renamed to `me.review.notThem`. The action (`unlink`), the route and its server checks are unchanged.
- Test: `app/(private)/_ui/ToReview.test.ts`, three tests that render Home's `ToReview` and the card's `CardLink` from a real pending claim on PGlite.
- Plan criterion 23 now gives the final copy. The tracking plan's `member_link` row says "Not them, was Reject".

## Decisions

- The date merges into the lead's first sentence. The lead used to start "Asked to see their own page." and now starts at "Approve only when…". This avoids two lines in a row that both start with "Asked". The officer persona raised this.
- The format is the date only (`cardFormats.date`: "Thu, Nov 19", in server time). A weekday-and-time format would be wrong for a claim more than a week old.
- The sentence "{discord} says they are {player}" is split on `{player}`, so the link sits inside the sentence in all three languages. Each half is filled with `{discord}`, so a word order with the player first would still work.

## Deviations

- None from S6. The analytics row's wording changed only to match the new label.

## Verified

- `pnpm vitest related --run` on the changed files: 63 files, 318 tests passed.
- Mutation check: with the asked line hidden and the link pointed at `/members`, two of the three new tests fail. Restored, all three pass.
- The asked instant is 01:00Z on Fri 20 Nov, which is Thu 23:00 ST, so the date test fails if the code formats in UTC. The adversarial reviewer asked for this.
- `pnpm check`: passed (prettier, eslint, tsc, vitest 1712 passed / 4 skipped, drift, i18n).
- Persona check on invented data, at 360 px, before and after:
  - Alliance officer: adopt with changes. Adopted: merge the two "Asked" lines. Not adopted: the others are listed under Open issues.
  - Adversarial reviewer: approve. No privacy leak, the sentence split works in EN/PT-BR/FR, and a null date hides the line. Adopted: the test instant that separates UTC from server time.
- E2E: no spec in `e2e/` covers an officer answering a claim on Home. `e2e/board.spec.ts` starts from an already-approved link, and no spec asserts "Reject". No e2e was changed.

## Open issues

- Officer persona suggestions not built, because they are outside S6:
  - a line under the buttons saying "They can ask again";
  - "ask them in game chat" in the hint;
  - the player link on its own line;
  - "(server time)" after the date.
- The `at` Date still reaches the client component through `{...l}`, unused there. Harmless.
- Comments in `app/(private)/api/w/[slug]/member-links/route.ts` and `lib/private/me-link.ts:151` still say "Reject". The route was left untouched on purpose.
- If `player_linked_at` is null, the claim shows no date and no "to see their own page" sentence. `setLink` always sets the column, so this should not happen.

## Next

- Follow-ups: decide whether to build the officer persona's "They can ask again" line and the game-chat hint (copy only).
- S2 to S5 stay as `docs/handoff/feat-585-one-worklist.md` lists them.

What was missing from the task prompt? The task said "workspace copy is English only", but the desk dictionary holds EN, PT-BR and FR (plan criterion 9). All three were updated.

PR: (added by the orchestrator)
