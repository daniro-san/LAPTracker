# feat/817-map-zoom

## Built
Part 2 of issue #817: zoom levels, other alliances' clusters, Find, layer chips, filters and the member's detail sheet on the officers' map (Insights → KvK).
- `app/(private)/_ui/kvk-map-view.ts` holds the logic and has no React:
  - The scene data the server hands over.
  - Two zoom levels. Fit frames the own members, the castle point and every cluster. City starts at part 1's frame.
  - `+` goes from fit to city, then halves the span down to 20 squares. `−` doubles the span up to the city start, then goes back to fit. A drag pans the city level.
  - Culling (`visibleOf`): only houses inside the visible box, plus a ring's width, are drawn.
  - Find (`findOf`): matches part of a name in any case, at most 8 results.
  - Filters by band, shield and ring. Within a group the values combine with OR; an empty group means all.
  - The reducer is `sceneStep`.
  - Part 1's `labelsOf`/`keepOutOf` moved here unchanged.
- `app/(private)/_ui/KvkMapScene.tsx` is the client scene:
  - Fit level: own members are small dots. The near/mid/far counts are stacked in one block beside the far ring, which is drawn dashed round the castle. Without a castle point there is one "n members" label instead. Other alliances are muted discs labelled "TAG · n" at their centre. No member names and no tap targets at this level.
  - City level: part 1's houses with names, shield rings and the "Kills bands" layer, which draws part 1's old band dot at the house's corner (plum and larger for more, grey for fewer, hollow for none, faint for unknown). Clusters show here too when they are in the box.
  - A tap on a house or name opens the sheet and still moves the readout. A drag over 6 px is not a tap.
  - Drag rules (coordinator's review): the map surface is `touch-action: pan-y` at both levels, so a vertical one-finger swipe scrolls the page. A one-finger drag pans only when it starts mostly sideways, and then only sideways. A mouse or pen drag pans any way; two fingers pan any way by their mean move. A pointer the browser takes for scrolling is cancelled (`axisOf`, `alongAxis` in `kvk-map-view.ts`).
- `app/(private)/_ui/KvkMapControls.tsx` holds:
  - Fit, +, − and Find, each 44 px. Find opens a field; each match is a 44 px chip.
  - Layer chips (Shields, Kills bands, Names, `aria-pressed`) and Filters inside a `<details>`. The ring group shows only when the rings exist.
  - The bottom sheet (brand `Sheet`). It shows place, might, KvK kills gained, shield with its "as of", distance to the castle point, last seen in game, and "Open the member card" (`/w/[slug]/members?m=<uid>`). Its content is `ph-no-capture`.
- `app/(private)/_ui/kvk-map-scene-data.ts` puts every fact into words on the server (`sceneOf`, `sceneWordsOf`), so the client only formats the axes line.
- `InsightsKvkMap.tsx` (server card) renders the scene inside the existing Readout. Kept: the readout, ‹ ›, legend, "Who (n)" lists, castle form and `ph-no-capture` figure. New: a third "as of" line for the other alliances. The axes line moved into the scene and follows the view.
- `lib/private/kvk-map.ts`: each dot now carries `uid`, `shieldAt`, `gain`, `ring`, `might` and `lastSeen`. The map carries `clusters` and `clustersAt`. `kvkMapView` also reads the newest daily update (`endOfDayReads(…, 1)`, the same source #821 uses for last seen) and `mapClusters`.
- `lib/repo/map-clusters.ts`, a new reader: per other alliance, its tag (or name), `member_count` and the mean x/y of members the roster lists with numeric x and y. It reads the newest usable day on or before that KvK's server day, in one statement, and averages in SQL.
- `docs/decisions/D163…md`: a 2026-11-28 amendment for the clusters (see Decisions).
- Dictionary: 30 keys in EN, PT-BR and FR. `insights.map.tap` was reworded.
- Tests:
  - `KvkMapScene.test.ts` has one test per behaviour: fit-level ring counts and clusters with no names, zoom and culling, Find, sheet facts, layer chips.
  - `InsightsKvkMap.test.ts` now checks that the card opens at the fit level.
  - The `kvk-map.test.ts` DB test also checks might, last seen and the cluster centre (an unlisted uid and a member with no place are left out, and no other alliance's name is returned).

## Decisions
- The other alliances' centres are a new use of their x/y. `.claude/rules/private.md` asks for a decision for a new use, so I added a D163 amendment citing the owner's #817 spec. It allows tag, count and a database-side mean only, on the desk only. **The owner should confirm this amendment.**
- Clusters come from the daily rosters, as the spec says. The KvK End row of each tracked alliance also has places at the same moment as the own members; that would be more consistent in time (see Next).
- "n" in "TAG · n" is the roster's `member_count`, matching the reference "TAG 94". The centre uses only the placed members.
- A member's ring is the distance band that counts them, so the fit-level counts equal the table. A member with unknown kills has no ring and is hidden while a ring filter is on.
- The fit level is the default view. City level opens with + or Find.
- Find selects a member by opening their sheet and framing them at 40 squares (or the city start if that is smaller). It also moves the readout to that member, through `useReadoutGo`, a small hook `app/_ui/charts/Readout.tsx` now exports. It gives a part inside the readout the same step the ‹ › buttons use.
- The selected house's seal ring follows the sheet. The readout's `aria-current` marking stays as before.
- Pinch zoom was not built; the spec made it optional.

## Deviations
- The fit level shows the own members as small dots as well as the ring counts: the owner's reference says "draw dots when zoomed out".

## Verified
- `pnpm vitest related --run` on the changed files: 109 files, 639 tests passed.
- `pnpm check`: exit 0, 400 files, 2197 tests passed. Drift and i18n are clean.
- After the drag and readout fix: `pnpm vitest related --run` on the changed files passed. The first `pnpm check` caught the roster-field guard (`roster-fields.test.ts`) flagging the axis literal `"x"`, so the axis was renamed to `"sideways"`. The rerun passed: exit 0, 2198 tests. One new test covers the drag rules, including `touch-pan-y` on the plot at both levels. Find's readout step has no unit test: the suite has no DOM. Not checked on a real phone.
- 360 px screenshots, light and dark. They use 12 invented members, a castle point and 3 invented clusters, rendered with `renderToStaticMarkup`, the app's compiled Tailwind CSS and system Chrome through playwright-core. No horizontal scroll (scrollWidth 360). They were not committed. They show the fit level, the city level with kill bands on, and the sheet open.
- The first render showed the ring counts overlapping when the clusters were far apart, so they became one stacked block. A sheet label wrapped mid-word, so the label column became `shrink-0`.

## Open issues
- With `pan-y`, the browser may take a two-finger vertical move for scrolling, so two-finger panning is best-effort.
- After a pan, houses re-mount and lose the readout's `aria-current` bold name until the next ‹ › step.
- At fit level the castle drawing covers the own dots when the alliance is small relative to the frame.
- Chip frames (`drawn-frame-soft` masks) did not load in the static screenshots. In the app they load as usual.

## Next
- The owner confirms the D163 amendment for other alliances' centres.
- Possibly take cluster places from the KvK End rows instead of the daily update, for the same moment as the own members.
- Pinch zoom, if officers ask for it.
- A designer-persona review at 360/640/1280 of the new controls row and chips.

What was missing from the task prompt? Whether "TAG · n" counts all members or only placed ones, and whether drawing other alliances' centres needs its own decision under the private-fields rule.

PR: (added by the orchestrator)
