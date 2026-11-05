# 08l — Manual round empty state

## Built
- `app/_ui/Status.tsx`: `StatusChips` takes `manual`. For a manual round (D28) the "Next update at …" chip is replaced by "Run by hand by the admin". Saturday event pages are unchanged.
- `app/_ui/EventView.tsx`: passes `manual` to `StatusChips`; a manual round with no snapshot passes `copy.empty.manualNotRun` as the table's empty line.
- `lib/copy.ts`: `status.byHand` ("Run by hand by the admin") and `empty.manualNotRun` ("This round has not been run yet. The admin starts it by hand.").
- `app/_ui/Status.test.ts`: one test (a real event keeps "Next update at …", a manual round shows the by-hand chip and no "Next update").

## Decisions
- The chip shows for a manual round in every state, including after only Before ran. With one phase run, the page shows the rows, "Last updated at …" and the by-hand chip; the "After" side reads "No data". The old chip named Saturday's time in that state too, which was equally wrong.
- The not-run line shows only when the round has no snapshot. A manual round whose snapshots exist but produced no rows keeps the default empty line.
- `nextUpdateAt` is unchanged; the manual case is decided in the chip, so the function keeps one job.

## Deviations
- None from the task.

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 121 tests). No upstream calls.
- Not verified: the page in a browser at 360 px, or against a real manual round on Neon.

## Open issues
- A manual round whose only run failed with no rows still shows "Nothing recorded yet. The kettle is on." (automatic-update wording). It was not in the task.
- Browser tab titles and the Open Graph image still use the weekday for a manual round (from 08i).

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none.

<adjustments>
- None.
</adjustments>

