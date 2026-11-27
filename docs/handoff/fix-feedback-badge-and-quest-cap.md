# fix/feedback-badge-and-quest-cap

## Built
- Feedback entry, one per width (owner report 2026-11-27): `app/(private)/_ui/FeedbackButton.tsx` showed the floating "Feedback" badge from `xl` (1280 px) and the end-of-page "Send feedback" button at every width, so at desktop width both showed. The end-of-page button now has `xl:hidden`, and its wrapper drops its top margin, rule and padding from `xl` (`xl:mt-0 xl:border-t-0 xl:pt-0`), so no empty rule is left at the end of the page. Below 1280 only the end-of-page button shows; from 1280 only the badge. CSS only, no JS. The wrapper stays mounted at every width because the badge and the sheet's `<dialog>` are inside it.
- That one component is the only place both render: the desk (through `Frame.tsx`, every desk page including Home), the members' board (`board/page.tsx`) and Me (`board/me/page.tsx`) all use `Feedback` -> `FeedbackButton`. One change covers all three.
- `e2e/feedback.spec.ts`: the wide-project badge test asserted "the end-of-page button stays" (`toHaveCount(1)`); it now asserts the button is hidden (`toHaveCount(0)`) and the title says so. The phone test already asserted only the end-of-page button.
- Daily quest cap: `QUEST_DAY_CAP` in `lib/private/member-week.ts` is 250 (was a provisional 240); its comment says the owner confirmed it in the game on 2026-11-26/27. Comments in `member-days.ts` and `insights-effort-words.ts` no longer call it provisional.
- `lib/private/member-days.test.ts`: the shares now expect `x / 250`, the scale line "out of 250", and the above-cap case uses a 260-point day (a 250-point day is now exactly the cap, so it no longer tested clamping).
- Dated amendments appended to D127, D136, D142 and D158 (none of the earlier text rewritten, per docs/decisions/README.md); `docs/GLOSSARY.md`'s "daily quest points" row says "Cap 250 a day, confirmed by the owner".

## Decisions
- The cap is used in three places: the member card's "Last 7 days" quest bars and day readout ("180 of 250"), the scale line under the card (`card.days.scale`, filled with the constant), and Insights' effort groups (quest median bars). A member's own page uses the same `daysCard`/cap. All read the constant; nothing else hard-codes 240 for quest points (the remaining 240s in tests are fixture values for days, not the cap).

## Deviations
- None.

## Verified
- `pnpm vitest related --run` on FeedbackButton.tsx: 2 files, 8 tests passed. On the four quest-cap files: 74 files, 444 tests passed.
- `pnpm check`: passed.
- Not run: the e2e badge tests (`e2e/feedback.spec.ts`, wide and phone projects). They need a local Postgres server; this machine has only libpq (`initdb` finds no `postgres` binary), and installing it through the system package manager is not allowed. Run `pnpm test:e2e e2e/feedback.spec.ts` where `pnpm db:local:start` works.

## Open issues
- The scale line still says "quest points out of 250, the daily limit the reads show" (`card.days.scale`, EN/PT/FR in `lib/private/dictionary.card.ts`). "The reads show" was right for a value read from the data; it is now the game's limit. Left as is (copy change not asked for).

## Next
- Follow-up: reword `card.days.scale` to "the game's daily limit" in the three workspace languages.
- Run the e2e feedback spec in CI or on a machine with Postgres before merge.

What was missing from the task prompt? That `e2e/feedback.spec.ts` pinned the end-of-page button at 1280 px; the badge has no Vitest render test, so the e2e spec was the test to adjust.

PR: (added by the orchestrator)
