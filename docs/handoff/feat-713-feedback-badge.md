# feat-713-feedback-badge — a floating "Feedback" badge on desktop

Part of #713 (the feedback form, D157). Owner's request, 2026-11-22: make "Send feedback" more visible, on desktop only.

## Built

- `app/(private)/_ui/FeedbackButton.tsx`: a "Feedback" badge, fixed at the bottom left (`bottom-4 left-4`), hidden below 1280 (`max-xl:hidden`). It opens the same sheet as the end-of-page button (one `entry` state, `badge` or `end`), and it is not rendered while the sheet is open. It uses `buttonClass("secondary")`: the soft drawn frame, 44 px, the plum focus ring.
- The end-of-page "Send feedback" button stays at every width.
- `lib/brand/components/layout/NavSidebar.tsx`: bottom padding `pb-6` to `pb-20`, so the sidebar's last item never sits under the badge on a short window.
- `lib/private/dictionary.feedback.ts`: key `feedback.badge` (EN "Feedback", PT-BR "Feedback", FR "Retour").
- Analytics: `feedback_sent` gains a closed `entry` (`badge` | `end`) in `lib/analytics/events.ts`, sent by the sheet; `docs/analytics/tracking-plan.md` has the row, the insight note and a dated Changed line.
- `e2e/feedback.spec.ts`: two tests (wide: the badge is visible, 44 px or more, opens the sheet, gives way to it and comes back on close, and the end button stays; phone: no badge, only the end button).

## Decisions

- Breakpoint 1280 (`xl`): the width where AppShell shows the full sidebar (AppShell, D122). Below it the bottom tabs own the corner (phone) and the rail shows (768 to 1279).
- Corner: bottom left. On the desk it sits in the sidebar's column, which has no page content. On the board and Me (no sidebar, 960 px page centred) it sits in the empty margin, at least 184 px wide at 1280. Bottom right would cover the margin column's sticky foot and the tables' last column on the wide pages.
- Label "Feedback", the end button keeps "Send feedback": different accessible names, so `getByRole("button", { name: "Send feedback" })` in other tests still finds one button.
- The end-of-page button stays at desktop width: the panel did not find two entries to one sheet confusing (below).
- `entry` is added because the owner's question is whether the badge makes feedback more visible; without it the two entries cannot be told apart in PostHog.
- Persona check: I read the screenshots in the roles of two officers, a member and a designer, in this session; I did not start separate persona agents. Officer 1 (desk, 1280): finds it without scrolling, beside the navigation, and nothing is covered. Officer 2 (Members, 1920): the badge stays at the sidebar's foot on a wide screen, away from the work area. Member (board and Me, 1280 and 1920): sees it in the left margin, not on the content. Designer: the secondary-button look matches the other controls, no shadow or pill (DESIGN.md), the ring is the drawn-control ring. No change came from the check.

## Deviations

- None from the task. The sidebar padding change touches a brand layout component; it is the way to keep the sidebar clear of the badge.

## Verified

- `pnpm vitest related --run` on the changed files: 206 files, 1121 tests passed.
- `pnpm check`: see the PR body.
- e2e on my own cluster (port 54395) and ports 3577, 3578, 3579, 54477: `e2e/feedback.spec.ts` 3 passed, 3 skipped by project (the first run of the phone test failed on `hidden` against the button's own `inline-flex`; fixed with `max-xl:hidden`). The wide test fails without the badge, since the button does not exist.
- Screenshots from the production build with the e2e seed at 360, 768, 1280 and 1920: desk Home, Members, board, Me. At 360 and 768 there is no badge and nothing moved.

## Open issues

- A dark-mode screenshot was not taken; the badge uses the same paper and ink tokens as the secondary button.
- At exactly 1280 on the board, the left margin (184 px) is the least room; the badge needs about 100 px.

## Next

- After eight weeks, read `feedback_sent` by `entry`. If the badge brings most sends, consider dropping the end-of-page button at 1280 and up.

What was missing from the task prompt? Nothing blocking; the corner was left to the layout, and which of the two entries to keep was stated as a persona call.

PR: (added by the orchestrator)
