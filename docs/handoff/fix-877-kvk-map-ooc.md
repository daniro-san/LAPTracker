# fix-877-kvk-map-ooc

## Built
- The officers' KvK map (`kvkMapView` in lib/private/kvk-map.ts) shows the newest KvK only. It passes `isKvkDay` on the event's server day to `eventEndPlaces`, the same filter #806 added to `kvkOf` and the recap.
- `eventEndPlaces` and `newestStartEnd` (lib/repo/workspace-rosters.ts) take an optional `keep(at)` filter. Without it they behave as before, so `scheduledEventKills` is unchanged.
- One test in lib/private/kvk-map.test.ts: with an Origin of Chaos newer than the KvK the map shows the KvK; with only an Origin of Chaos in range there is no map.

## Decisions
- The filter is applied to the event rows in `newestStartEnd`, after the query, so an Origin of Chaos with fresh Start and End rows is skipped and the next older KvK is used.

## Deviations
None.

## Verified
- `pnpm vitest related --run` on the changed files: 111 files, 679 tests passed.
- `pnpm check`: prettier, eslint, tsc, drift and i18n checks pass. In the full vitest run two unrelated tests (lib/squads-read.test.ts, cross-workspace.test.ts) hit the 10 s timeout under load and pass when run alone.

## Open issues
None.

## Next
- `scheduledEventKills` (same file) still takes the newest event of any kind; check whether its callers need the KvK filter too.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
