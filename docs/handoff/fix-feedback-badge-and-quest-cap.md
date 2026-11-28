# fix/feedback-badge-and-quest-cap

## Built
- Feedback entry, one per width (owner report 2026-11-27): `app/(private)/_ui/FeedbackButton.tsx` showed the floating "Feedback" badge from `xl` (1280 px) and the end-of-page "Send feedback" button at every width, so at desktop width both showed. From `xl` the end-of-page button is `invisible` (not drawn, not focusable, not in the accessibility tree) and its wrapper's rule is `border-transparent`, so no empty rule shows. The wrapper keeps its margin and padding and the button keeps its box, so the page is exactly as long as before this branch. Below 1280 only the end-of-page button shows; from 1280 only the badge. CSS only, no JS. The wrapper stays mounted at every width because the badge and the sheet's `<dialog>` are inside it.
- That one component is the only place both render: the desk (through `Frame.tsx`, every desk page including Home), the members' board (`board/page.tsx`) and Me (`board/me/page.tsx`) all use `Feedback` -> `FeedbackButton`. One change covers all three.
- `e2e/feedback.spec.ts`: the wide-project badge test asserted "the end-of-page button stays" (`toHaveCount(1)`); it now asserts the button is hidden (`toHaveCount(0)`) and the title says so. The phone test already asserted only the end-of-page button.
- Daily quest cap: `QUEST_DAY_CAP` in `lib/private/member-week.ts` is 250 (was a provisional 240); its comment says the owner confirmed it in the game on 2026-11-26/27. Comments in `member-days.ts` and `insights-effort-words.ts` no longer call it provisional.
- `lib/private/member-days.test.ts`: the shares now expect `x / 250`, the scale line "out of 250", and the above-cap case uses a 260-point day (a 250-point day is now exactly the cap, so it no longer tested clamping).
- The card's scale line (`card.days.scale` in `lib/private/dictionary.card.ts`) said 250 was "the daily limit the reads show"; it now says "the game's daily limit" (PT-BR "o limite diário do jogo", FR "la limite quotidienne du jeu"), since the value comes from the game, not the stored reads (coordinator, 2026-11-27). D136's amendment quotes the new line.
- Dated amendments appended to D127, D136, D142 and D158 (none of the earlier text rewritten, per docs/decisions/README.md); `docs/GLOSSARY.md`'s "daily quest points" row says "Cap 250 a day, confirmed by the owner".

## Decisions
- Invisible, not `hidden`, from `xl`. The first version used `xl:hidden` and dropped the wrapper's spacing, which made every desk page about 100 px shorter at 1280. CI (run 46083009337, PR #774) then failed two `[wide]` tests in `e2e/desk-insights.spec.ts` (the week test near line 381 and the day test at line 410) on `stays(page, y)`: off by 15 px after Back. The failure screenshot shows the page scrolled to its very end (the Time zones card at the bottom edge). The drill-down's day card is taller than the week card, so on Back the page gets shorter and the browser clamps `scrollY` to the new maximum. The roughly 100 px footer had absorbed that difference. Keeping the footer's box restores the page length dev has, so the product behaves at 1280 as it did before, minus the visible button. The tests were right: Back should keep the place.
- The cap is used in three places: the member card's "Last 7 days" quest bars and day readout ("180 of 250"), the scale line under the card (`card.days.scale`, filled with the constant), and Insights' effort groups (quest median bars). A member's own page uses the same `daysCard`/cap. All read the constant; nothing else hard-codes 240 for quest points (the remaining 240s in tests are fixture values for days, not the cap).

## Deviations
- None.

## Verified
- `pnpm vitest related --run` on FeedbackButton.tsx: 2 files, 8 tests passed. On the four quest-cap files: 74 files, 444 tests passed.
- `pnpm check`: passed.
- The scroll fix is reasoned from the CI screenshot and error context, not run: the e2e suite needs Postgres (below). The `[wide]` desk-insights tests and `e2e/feedback.spec.ts` must pass in CI on the new head.
- Not run: the e2e badge tests (`e2e/feedback.spec.ts`, wide and phone projects). They need a local Postgres server; this machine has only libpq (`initdb` finds no `postgres` binary), and installing it through the system package manager is not allowed. Run `pnpm test:e2e e2e/feedback.spec.ts` where `pnpm db:local:start` works.

## Open issues
- None.

## Next
- Run the e2e suite in CI on the new head before merge (`[wide]` desk-insights and feedback specs).
- Possible follow-up: Back in Insights' drill-down keeps its place only while the page has enough room below; a page that ends right after the chart could still clamp. Not changed here.

What was missing from the task prompt? That `e2e/feedback.spec.ts` pinned the end-of-page button at 1280 px; the badge has no Vitest render test, so the e2e spec was the test to adjust.

PR: (added by the orchestrator)
