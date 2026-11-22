# fix — no member change against a stale previous event (issue 592, finding H5)

## Built

- `lib/compute.ts`:
  - `SeriesRow` and `SeriesStep` have a new field, `members`. `seriesDeltas` gives a member change only when both events' rows are fresh, as it already does for might and kills.
  - New `comparable(a, b)`: true when both rows exist, are fresh and did not fail. `seriesDeltas` uses it (INVARIANT freshness.no-stale-delta).
- `lib/queries/alliances.ts`: `allianceHistory` passes `memberCount` into `seriesDeltas`. The joined/left gate uses `comparable`.
- `lib/queries/players.ts`: player rows pass `members: null`.
- `app/_ui/AcrossEvents.tsx`: the Members change is `r.step.members`, and its percent base is `memberCount − step.members`. The UI no longer computes this difference itself. `canMove` uses `comparable`.
- `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`: the local `usable` is gone. `canDelta` is now `comparable(detail.before, detail.after)`, with the same meaning as before.
- Tests:
  - `app/_ui/AcrossEvents.test.ts`: the previous event is stale with 90 members and the current one fresh with 97. The test asserts that the newest event's Members cell shows the dash, not a number.
  - `lib/compute.test.ts`: `members` is added to the existing property test. One new test checks the member change with a stale row on either side, and one checks `comparable` (a failed row on either side gives false).
  - `lib/queries/alliances.test.ts`: `allianceHistory` on PGlite over four events (fresh 3, fresh 5, stale 4, fresh 6 members) gives `step.members` `[null, 2, null, null]`. The `seed` helper moved to module level and takes a `unionId`.

## Decisions

- The bug was real. Might and kills already needed both rows fresh (`seriesDeltas`), and so did joined/left (`allianceHistory`). The member change checked only the current row (`r.isFresh`), so a stale previous roster still produced a number.
- `comparable` takes an optional `failed`, so one predicate covers `HistoryRow` (it has no `failed`) and `AllianceRow` (it does).

## Deviations

- None.

## Verified

- Before the fix, the new render test failed: the page showed `+7`. After the fix it passes.
- After review (PR 674), each test was checked against a broken line, and each failed:
  - without `members: row.memberCount` in `allianceHistory`, the `alliances.test.ts` case fails;
  - without `b.failed !== true` in `comparable`, the `comparable` test fails;
  - with the UI computing `memberCount − 90` with no base (so no percent text), the render test fails.
- `pnpm vitest related --run` on the changed files passes.
- `pnpm check` passes: Prettier, ESLint, tsc, Vitest, drift and i18n. The first two runs failed: tsc lost the narrowing of `prev`, and the colour-literal guard read `#592` in a test name as a hex colour. Both are fixed.
- No e2e assertion covers the Members change under "Across events". `e2e/isolation.spec.ts` visits `/events/2/alliances/<id>` but checks only that the alliance name is there. No e2e was changed.
- Analytics: none. No event carries the member count or its change.
- No call to the upstream API.

## Open issues

- The same freshness predicate is still written by hand in other places. They could all use `comparable` or one shared per-row predicate. Not done here, to keep this change small:
  - `lib/notify.ts:161` (`usable`) and `lib/queries/carried.ts:43` (`usable`);
  - `lib/queries/movers.ts:56` and `:139`, `lib/queries/turnout.ts:74`, `lib/queries/alliances.ts:150` and `lib/queries/players.ts:171`;
  - `app/_ui/event-rows.ts:46` (`usable`) and `app/_ui/EventView.tsx:98`;
  - `lib/queries/compare.ts:69` (`usable`). That file already exports an unrelated `comparable(event)`, so the names need sorting out first.

## Next

- Follow-up: replace the remaining hand-written freshness checks listed under Open issues with `comparable` (or a per-row companion of it).

What was missing from the task prompt? Nothing blocking. It did not say whether `usable` on the event alliance page (which also checks `failed`) should share the predicate. I folded `failed` into `comparable`.

PR: https://github.com/daniro-san/LAPTracker/pull/674
