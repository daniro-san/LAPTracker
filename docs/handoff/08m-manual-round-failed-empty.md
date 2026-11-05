# 08m — Manual round, snapshots but no rows

## Built
- `lib/copy.ts`: `empty.manualNoRows` ("The run produced nothing. The admin runs it again by hand.").
- `app/_ui/event-rows.ts`: `emptyLine(manual, snapshots)` picks the table's empty line: a real event keeps `empty.kettle`; a manual round (D28) with no snapshot keeps `empty.manualNotRun`; a manual round with at least one snapshot and no rows gets `empty.manualNoRows`.
- `app/_ui/EventView.tsx`: passes `emptyLine(detail.manual, detail.snapshots.length)` to `StatTable`'s `empty` prop. `EmptyState` is reused as before.
- `app/_ui/event-rows.test.ts`: one test for the three cases.

## Decisions
- The helper lives in `event-rows.ts` so the choice is testable without rendering the async page.
- The line is shown when the table has no rows and snapshots exist. It does not distinguish a failed run from a run that found no alliances; both read "The run produced nothing".

## Deviations
- Branched from `origin/session/manual-round-empty-state` (PR #84, handoff 08l), not `origin/dev`, because #84 is not merged yet. This PR's diff includes #84's commits until it merges; merge #84 first.

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 122 tests). No upstream calls.
- Not verified: the page in a browser at 360 px, or against a real manual round on Neon.

## Open issues
- None new. The 08l open issue about tab titles and the Open Graph image using the weekday for a manual round remains.

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal.
Owner must do first: merge PR #84, then this PR, into `dev`.
Plan changes needed: none.

<adjustments>
- None.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/85
