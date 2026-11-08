# 08zzn — Drop the alliance level from Across events

## Built
- The alliance page's "Across events" (`app/_ui/AcrossEvents.tsx`) shows Might, Kills and Members. The Level column and its metric are gone.
- `lib/queries/alliances.ts`: `AllianceRow.level`, the `level` column in `allianceColumns` and `HistoryRow.level` are removed, so no alliance query reads `alliance_snapshots.level` any more. `allianceHistory` passes `lv: null` to `seriesDeltas`, so an alliance's `step.lv` is always null.
- `lib/compute.ts`: only the `SeriesRow` comment changed (`lv` is the player's level; alliance rows pass null).
- `app/_ui/AcrossEvents.test.ts`: one test. It renders the section with one row and checks that the column heads are exactly Event, Might, Kills, Members, with no "Level" anywhere.

## Decisions
- `AllianceRow.level` was removed too. Its only use was feeding `HistoryRow.level` and `step.lv`. Checked readers: the event alliance page, `getAllianceDetail`, `/api/events/[id]` (`getEventDetail` has its own columns) and the Discord queries. None of them read it.
- `SeriesRow.lv` / `SeriesStep.lv` stay in compute. The player page reads `step.lv` (`app/_ui/PlayerAcrossEvents.tsx:216`).
- These are unchanged: the DB column `alliance_snapshots.level`, `lib/repo`, the collector (`lib/collector-rows.ts`) and the copy key `ledger.level`. Member rows, Leadership and the player pages still use that copy key.
- docs/DESIGN.md is unchanged. It never lists the alliance Across events columns. The `stat-table` line's "Might, Kills, Members (or Level)" is the generic card, and it is still true for member rows.
- The test renders with `prerender` from `react-dom/static`, because `DetailTable` is an async server component and `renderToStaticMarkup` cannot wait for it. `./locale` is mocked to return `en`.

## Deviations
- None.

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc, vitest (212 passed, 1 skipped), drift, i18n-check.
- The new test fails when the Level column is put back (`+ "Level"` in the diff of heads), and passes without it.
- Ran local `next dev` against the Neon preview branch, read-only, using the main checkout's `.env.local` (copied in, then deleted). There were no writes, no upstream calls and no `/api/quota`. Chrome was driven over CDP with an exact viewport, emulated `prefers-color-scheme`, cookies cleared and Next's dev overlay removed. `scrollWidth` equals the viewport in every capture.
- Screenshots:
  - `docs/screenshots/08zzn-across-events-{360,1280}-{light,dark}.png`: `/events/3/alliances/67111155`, Across events section, 3 events, columns Might / Kills / Members.
  - `docs/screenshots/08zzn-player-across-events-360-light.png`: a player's Across events, which still shows Level.

## Open issues
- `SeriesStep.changed.lv` is computed in `lib/compute.ts`, but no file in `app/` or `lib/` reads it. This was already true before this change. It could be removed in a later cleanup.
- `lib/brand/tokens.test.ts` treats any `#` followed by 3–6 hex characters in `app/` as a colour literal. An issue number like `#181` in a test name or comment fails the check. That is why the new test name carries no issue number.

## Next
Session: none planned by this change; it goes into the next release from `dev`.
Model / effort: keep — a one-column removal.
Owner must do first: merge this PR into `dev`. It touches no file that 08zzm (#180, event pages' status line) edits.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/188
