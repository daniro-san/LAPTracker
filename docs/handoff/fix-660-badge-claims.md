# fix-660-badge-claims

## Built
- `toReviewCount` (lib/private/import-view.ts) now adds the pending "This is me" claims (D142) to drafts and notice reviews, so the Home tab badge reads the same on every desk page that calls it (Members, Follow-up, Calendar, Notices, Roll call, Thefts, Settings, Import, Start here).
- `countLinksToReview` (lib/repo/player-links.ts): a count of the rows `linksToReview` lists, so the claims are counted without loading the roster.
- One test in app/(private)/_ui/ToReview.test.ts: with one pending claim on PGlite, Home's list holds 1 claim and `toReviewCount` returns 1.

## Decisions
- Home still sums once in `WorkspacePage` from the lists it has already loaded (`items + reviews + desk.links`, #659); it renders them, so a count query would be extra work there. The rule is the same three terms in both places.
- Claims are counted whether or not the notices feature is on; Home does the same.

## Deviations
- None.

## Verified
- Test fails without the fix (`expected +0 to be 1`) and passes with it.
- `pnpm vitest related --run` on the changed files: 37 files, 201 tests passed.
- `pnpm check`: passed (one earlier failure: a "#660" in a test name matched the colour-literal guard; removed).
- E2E: no spec asserts the Home tab badge number (e2e/desk.spec.ts only checks the "waiting in To review" jump link is absent), so none changed.
- DB cost (D149): each non-Home desk page runs one more indexed count query (drafts, reviews, claims: 2 to 3), in the same `Promise.all`, so no added round-trip latency. Home's query count is unchanged.

## Open issues
- None. Rebased onto dev after #659 merged (no conflicts).

## Next
- Optional: have Home call `toReviewCount` too if one function for both is wanted; it would cost Home extra queries for lists it already holds.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
