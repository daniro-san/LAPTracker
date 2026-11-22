# fix-592-home-badge

## Built
- `homeBadge(drafts, reviews, links)` in lib/private/import-view.ts, the one sum of the Home tab's number.
- `toReviewCount` (every other desk page) and `app/(private)/w/[slug]/page.tsx` (Home) both call it.

## Decisions
- The two definitions did not differ: both sum open drafts, notice reviews for the viewer and pending "This is me" claims. Notice reviews are left out while notices are off (D126) on both sides (`featureOn(access, "notices")` in `toReviewCount` and in Home's read of `reviewsForMe`).
- Home keeps summing the lists it already holds, so it adds no queries. Only the sum is shared, not the reads.
- The function sits in import-view.ts, which owns `toReviewCount` and the drafts/reviews/links imports.

## Deviations
- None.

## Verified
- `pnpm vitest related --run` on the changed files: 45 passed.
- `pnpm check`: passed.
- The existing Home test in app/(private)/_ui/ToReview.test.ts (draft plus claim) now also asserts `toReviewCount` is 2, next to the 2 Home renders in the tab, the jump and the heading. If either side drifts, it fails.

## Open issues
- The D126 gate is still written twice (`featureOn` in `toReviewCount` and in Home's page read). Only the sum is shared.

## Next
- Optional: share the gated reads too, if the duplicated `featureOn` check starts to drift.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
