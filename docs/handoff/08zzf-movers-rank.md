# 08zzf — Movers: rank movement (issue #70 follow-up)

## Built
- `compute.topRankMovers(rows, n, direction)` in `lib/compute.ts`: the alliances that climbed (`gain`) or fell (`loss`) the most places by ledger rank by might, Before → After (`compute.rankDelta`, D23). Order: places moved, then the better current rank. A row with a missing, stale or failed side, an unknown rank, or no move is left out. Three tests: climbers with a tie, fallers without the held row, excluded sides.
- `allianceMovers` (`lib/queries/movers.ts`) takes the event's ledger ranks (`eventRanks`, already loaded by `getEventPage`) and returns `rankUp` / `rankDown` (top 3 each) beside the three lists; each alliance row carries `ledger: { before, after }`.
- Movers card: a fourth tab, `Rank ▲▼`, listing `Rank ▲` and `Rank ▼` (side by side from 640 px). Every alliance row in every tab now starts with its ledger rank after the event and its move, `#4 ▼3`, with `#—` / `—` when unknown, using the comparison table's `Rank` component. Member rows keep their place in the list (`#2`). The tab row sizes itself to the tabs it shows.
- DESIGN.md `movers` updated; /brand sample rows carry a rank move.

## Decisions
- The tab label reuses `ledger.rank` ("Rank"), already translated in all 17 languages, so no new copy and no translate-copy run were needed; `i18n-check` is green.
- Members get no Rank list: an in-alliance rank by might per side is not stored or computed anywhere today, so it would be new work, not a reuse. The alliance page shows no Rank tab.
- The Rank rows show the alliance's might change on the right, like the other tabs.
- Icons instead of words on the tabs (owner's suggestion in the chat) were not done: DESIGN.md's language-light rules use the game's word as the label and rule out a skull for Kills. In en all four tabs fit one line at 360 px; in ru and de a long word wraps to a second line inside its 44 px tab.

## Deviations
- None.

## Verified
- `pnpm check` green (prettier, eslint, tsc, vitest incl. `lib/queries/blocked-keys.test.ts`, drift, i18n-check).
- Local `next dev` against the Neon preview branch, read-only. The preview's newest event (id 3) has no rank moves (both Rank lists read `—`); event 1 has three climbers, so the screenshots use `/events/1`.
- Screenshots `docs/screenshots/08zzf-movers-rank-*.png`: the Rank tab (`tab3`) and the Might ▼ tab (`tab1`) at 360 and 1280 px, light and dark; ru Rank tab and de default tab at 360 px; the alliance page at 360 px (no Rank tab).

## Open issues
- Members' in-alliance rank movement, if the owner wants it, needs an in-alliance rank per snapshot (a `rankBy` over each roster) and a Rank tab on the alliance page.

## Next
Session: none planned by this change; it goes into release v1.1.0 (PR #159, `dev → main`).
Model / effort: keep — the remaining work is review and merge.
Owner must do first: merge this PR into `dev` before the v1.1.0 cutoff (~21:00 server).
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/165
