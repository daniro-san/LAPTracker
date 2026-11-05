# 06b — Player pages and search

## Built
- `lib/queries/players.ts`: `playerHistory(db, uid)` (one query over `member_snapshots` → `alliance_snapshots` → `snapshots` → `events`; one row per event, name timeline, alliance timeline, deltas through `compute.seriesDeltas`) and `searchPlayers(db, q)` (ILIKE on every stored name, newest sighting first, capped at 50). Both are exported from `lib/queries/index.ts`.
- `lib/queries/players.test.ts`: two tests. One asserts `findBlockedKeys` finds nothing in `playerHistory` and `searchPlayers` output while the stored `raw_json` carries every blocked key. One asserts the search is case-insensitive and treats `%` as a literal.
- `app/(pages)/players/[uid]/page.tsx`: header (current name, current alliance tag as a link, name timeline when the name changed, alliance timeline with links), "Show exact numbers" switch, then the across-events table.
- `app/(pages)/players/page.tsx`: `/players?q=`, `<input type="search">`, every match listed with name, "earlier name: X" when only an old name matched, alliance tag and name, last-seen date. A note appears at 50 results.
- `app/_ui/PlayerAcrossEvents.tsx`: the Phase 5e player table on `StatTable`. Last 12 events, "Show all N events" for the rest. Name and alliance changes appear as "was X, now Y". `B` marks a row taken from the before snapshot.
- `app/_ui/StatTable.tsx`: one optional metric field, `vs`, for a second delta under the first.
- `app/_ui/SiteHeader.tsx`: a "Players" link (min height 44 px).
- `scripts/seed-data.ts`: the player who changes alliance (first member of alliance 5) now moves to alliance 6 during event 1 and stays there. His stats now drift with the snapshot like every other member.
- Site name "OG's LAP Tracker" in the root and admin titles and the header (owner request during the session).
- `docs/screenshots/06b-{player,search}-{360,390,1280}.png`.

## Decisions
- Reference value per event is the after row, else the before row, as in Phase 5e. The "since previous event" delta compares reference values only. The in-event delta (before → after) needs both rows fresh.
- The Might and Kills cells show the in-event delta as the main delta and "Since previous event" under it, so one `vs` field was added to `StatMetric`; the adjustments said `StatTable` needed no change, but two deltas per cell did not fit `note`.
- The Level cell has the same two deltas without percentages.
- The "Fresh" column is the existing `FreshDots` / `FreshnessDetail` pair, fed by the two alliance rows the player appeared in. A row missing a side shows no problem for that side.
- The current alliance link and each timeline entry go to `/events/{last event seen}/alliances/{unionId}`, since the alliance page needs an event id.
- Search wildcards `%`, `_` and `\` in the query are literals. The query is trimmed and cut at 64 characters.
- Which earlier name matched is found in JavaScript with a lowercase `includes` after the SQL ILIKE picks the uids.
- Test events (rehearsals) are excluded, as everywhere else.

## Deviations
- The seed already had a mover, in the last after snapshot only. He now moves during event 1, so his history has three events: alliance YAHO on Oct 17, alliance FSPN from Oct 24, with the change marked on the Oct 24 row.
- Screenshots are dark mode only (the system default of the capture browser). Session 6 took light and dark.
- The task named the second adjustment "extend `rosterAt`"; the move logic moved into a small `applyMove` helper because `rosterAt` hit the lint complexity limit of 12.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest — 17 files passed, 1 skipped; 73 tests passed, 1 skipped.
- `pnpm db:seed -- --reset` on the Neon preview branch (it held only seed events and one rehearsal): "seeded 22 alliances × 3 events, 1 rehearsal".
- `pnpm build`, then `next start` against that branch: `/players/339985801541` 200, `/players?q=soul` 200, `/players/1` 404, `/` 200.
- `scrollWidth` equals the viewport width at 360 and 390; at 1280 it is 1265 (the scrollbar). Screenshots were taken with Chrome DevTools device emulation; headless `--window-size` cannot go below about 500 px.
- Not verified: the 50-result cap against more than 50 matches in a browser (the query has `limit(50)`; no test asserts it); the screenshots in light mode; a player who is absent from the after roster (the `B` row) rendered in the browser, since the seed has no such player.

## Open issues
- `.env.local` in the main checkout has a `CRON_SECRET` shorter than 32 characters, and its schedule variables are empty or unparsable, so `next start` needed throwaway values on the command line (session 06 hit the same).
- The across-events section of the player page has no "Fresh" legend beyond the existing "About this data" detail.
- The Neon preview branch now holds the new seed (mover in event 1).

## Next
Session: 7 — Branding
Model / effort: keep (opus · medium). Step 1 is a mock with a stop, and this session needed no escalation.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none to IMPLEMENTATION_PLAN.md or SESSION_PLAYBOOK.md.

<adjustments>
- The site name is now "OG's LAP Tracker" in `app/layout.tsx`, `app/(pages)/admin/layout.tsx`, `app/(pages)/players/page.tsx` and the header text in `app/_ui/SiteHeader.tsx`. The logo and wordmark should use this name; `docs/DESIGN.md` may still say "LAPTracker" (not checked).
- Re-take list for Step 2 includes the player and search pages: `/players/339985801541` (alliance change on the Oct 24 row) and `/players?q=so` after `pnpm db:seed -- --reset`.
- `StatMetric` has an optional `vs` field; token work should style the "Since previous event" line inside `StatTable`, not in `PlayerAcrossEvents`.
- The header now holds the brand link, a "Players" link and the event selector; at 360 px they fit with about 40 px spare, so a longer wordmark or a logo image needs a check at that width.
- Search results and player cards reuse the `StatTable` card classes (border, padding); the plain result list in `app/(pages)/players/page.tsx` copies them by hand.
</adjustments>
https://github.com/daniro-san/LAPTracker/pull/23
