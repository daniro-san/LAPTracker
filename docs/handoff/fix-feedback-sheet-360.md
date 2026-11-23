# fix/feedback-sheet-360

## Built
- `lib/brand/components/Sheet.tsx`: a sheet with a sticky bar (`primary`) sets `scroll-padding-bottom: 6rem` (`scroll-pb-24`) on its scroller, in the dialog and in the pane. A control the browser scrolls into view (Tab, focus) now stops above the bar instead of under it.
- `e2e/feedback.spec.ts` (phone): after the sheet opens and the fields are filled, focusing "Add a picture" leaves its box above the bar's box, and `elementFromPoint` at its centre returns that button.

## Decisions
- Fixed in the shared Sheet once: the cause is not specific to the feedback sheet. Any sheet whose content is taller than the screen and has a bar had the same flaw for the last focusable control.
- The content's own bottom padding was already right (the bar is in the flow, after the body), so at the end of the scroll nothing is covered. The flaw was the browser's scroll-into-view, which did not know about the sticky bar.
- The sheet's look is unchanged; at 360 x 780 the feedback sheet's content is still taller than the screen, so the picture button is below the fold until you scroll or Tab to it.

## Deviations
- None.

## Verified
- The new e2e assertion failed before the change and passes after it (phone project, own DB and ports).
- `pnpm vitest related --run` on the two changed files: 19 files, 65 tests passed.
- `pnpm check`: passed.

## Open issues
- At 360 px the picture button is still half hidden at scroll top (the content is taller than the screen). Making the sheet fit without scrolling would change its look (shorter message box); not done.

## Next
- Optional: decide whether the feedback sheet's message box should be shorter at 360 px so the picture button shows without scrolling.

What was missing from the task prompt? Whether "half behind the bar" meant at scroll top (inherent to a scrolling sheet) or after scrolling/Tab; I took it as the scroll-into-view case.

PR: (added by the orchestrator)
