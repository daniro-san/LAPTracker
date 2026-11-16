# 08zzzz public events trim

Closes #272

## Built
- `app/api/events/[id]/route.ts`: the response drops, per snapshot, `callsUsed`, `quotaRemainingAfter`, `durationMs`, `boardPulledAt`, `error`; on the event, `isTest`; per alliance row, `powerBoard`, `killsBoard`, `source`, `cached`. Success sends `Cache-Control: public, s-maxage=300`.
- `app/api/events/route.ts`: drops `isTest` from each event. Success sends the same header.
- Tests: `app/api/events/[id]/route.test.ts` (dropped fields absent, 200 has the header, 404 has none; existing `findBlockedKeys` test kept), new `app/api/events/route.test.ts`.

## Decisions
- The trim is in the routes. `getEventDetail` and `listEvents` are unchanged, so Discord, pages and admin keep their fields.
- `boardPulledAt` lives on the snapshot, not on the row (the issue text said row). It is dropped at the snapshot.
- Kept: `sourceUpdatedAt`, `isFresh`, `failed` on rows, and `status`, `startedAt`, `finishedAt` on snapshots. The issue did not list them.
- Consumers of the two routes' JSON: none in app/, lib/, scripts/, .github/ or components. The only reader is `app/api/manual-event/route.test.ts`, which reads `events[0].name`. Public pages read lib/queries directly. No dropped field is used by a page or the smoke check.
- A visibility switch or rename reaches the CDN copy within 5 minutes (`s-maxage=300`). The route comments say so.

## Deviations
None.

## Verified
- `pnpm check` green: 59 test files passed, 1 skipped; 270 tests passed, 1 skipped; typecheck, lint, drizzle check and i18n check pass.

## Open issues
- `boardPulledAt`, `source` and the board numbers remain in `getEventDetail` for other callers; only the public routes drop them.
- Production cache headers were not re-checked after deploy; check `x-vercel-cache` MISS then HIT on `/api/events/129`.

## Next
none queued

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://github.com/daniro-san/LAPTracker/pull/277
