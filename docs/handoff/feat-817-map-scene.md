# feat/817-map-scene

## Built
Part 1 of issue #817: the drawn scene on the officers' map (Insights → KvK).
- `lib/brand/components/MapGlyphs.tsx`: four drawings made with the `hand-drawn-svg` method. They are a house (a member's city), the castle, the shield ring and the dashed "no reading" ring. Each is a 16-unit filled cut placed as a `<g>` inside the map's SVG. Colour comes from a token class (`text-ink`, `text-plum`, `text-seal`). The shield's light disc is `currentColor` at 0.14 fill opacity. The generators are `icon_house`, `icon_castle`, `bubble` and `no_reading` in `docs/brand/drawing/examples/ornaments.py`, registered in `build.py` as `map-house`, `map-castle`, `map-bubble` and `map-no-reading`. All four together are 3.4 KB.
- `app/(private)/_ui/InsightsKvkMap.tsx`:
  - Each member is a house at their X/Y. Their name sits under it in HTML (D68), on a light paper backing.
  - A member whose shield was seen gets the light ring. A member with no reading gets the dashed ring and the words "no reading" under the name. A reading that saw no shield gets no ring.
  - The castle drawing replaces the old seal-coloured plus.
  - A house and its name both carry `data-at`, so tapping either picks that member in the readout. The readout line now ends with the shield word ("shield seen", "no shield seen" or "no reading").
  - There are two new "as of" lines. Places are as of the End reading's start. Shields are as of the newest map scan among the readings, or a line saying there was no reading before that KvK.
  - The legend has swatched rows for the three shield states and the castle. The kill-band counts stay as plain rows.
  - The near/mid/far table, the "Who (n)" lists, the ‹ › steps and the castle form are unchanged. The plot stays inside the figure's `ph-no-capture` and is `aria-hidden`.
- `lib/private/kvk-map.ts`:
  - `kvkMapOf` takes the members' shield readings and gives each dot a `shield` (`on`, `not_seen` or `unknown`, via `suggestionOf`). The map gets a `shieldAt`.
  - `kvkMapView` takes `zone`. It reads shields with the existing `shieldReadings` (own `union_id` only), over that KvK's raid: from Friday's night window (23:00 ST) to KvK start (Saturday 12:00 ST).
- `lib/repo/workspace-rosters.ts`: `EndPlace` now carries `uid`, so readings can be joined to places. The uid stays in lib and never reaches the page.
- `lib/private/dictionary.insights-map.ts`: 10 new keys in EN, PT-BR and FR. `insights.map.tap` now says "house" instead of "dot".
- Tests:
  - `kvk-map.test.ts` has a pure test for the three shield states and `shieldAt`. Its DB test also checks that only the own alliance's readings inside the raid window count.
  - `InsightsKvkMap.test.ts` checks one glyph per member in name order, each name under its house, one light ring, two "no reading" labels, no "unshielded" anywhere, and both "as of" lines.

## Decisions
- "A member with a shield reading gets a ring" is read as "a reading that saw a shield". A reading that saw no shield draws no ring and says "no shield seen" in the readout and the legend (the `suggestionOf` hint, D75).
- Shields come from the raid before the KvK shown (night and morning windows), not the newest reading overall. The map shows that KvK's End places, and no shield is kept after KvK starts (lib/shield-check.ts header). This keeps the query time-bounded (D149).
- "Shields as of" is the newest `map_updated_at` among members with a reading. If `map_updated_at` is missing, `read_at` is used instead.
- The kill-band shapes are gone from the plot, because a house is now the member's mark. The band is still in the readout line and the legend counts. Part 2's "kill bands" layer chip brings it back onto the map.
- The plot's inner margin went from 5 to 12 units, so names under edge houses are not clipped. Labels are at most 24 % of the plot wide and truncate past that.
- French uses "non lu" for "no reading": `dictionary.test.ts` bans "pas de relevé" (the daily-update term rule).

## Deviations
- None from the spec. The drawings were not shown to the owner before wiring in (skill step 7). The task asked for them to be built directly. The sheet is in the scratchpad (see Verified).

## Verified
- `pnpm vitest related --run` on the changed files: 136 files. The first run caught the French term rule (`dictionary.test.ts`) and a test regex, and both were fixed. In the second run, `cross-workspace.test.ts` failed once under load; it passed alone (4 of 4), and it passed in the full suite below.
- `pnpm check`: passed (398 files, 2165 tests; drift and i18n clean). Before that it caught a lint function-length error and an import order, both fixed.
- Screenshots: a 360 px render of a sample of 12 invented members (castle point set, 6 shield seen, 2 not seen, 4 no reading), light and dark. The card was rendered with `renderToStaticMarkup` plus the app's compiled Tailwind CSS, in system Chrome via Playwright. No horizontal scroll (scrollWidth 360). Names read in both themes, the rings are correct and both "as of" lines show. Screenshots are kept outside the repo.

## Open issues
- In a dense cluster, labels overlap each other and neighbouring houses. In the sample, Cedar's label covers part of Linden's house, and the castle sits under Cedar's label. Part 2's zoom levels are meant to solve this.
- Every member of an alliance with no shield check (no readings) shows the dashed ring and "no reading".
- A newer reading with `shielding` null hides an older reading of the same raid that had a value. `shieldReadings` takes the newest row per member. The same behaviour exists today in Raid prep.

## Next
- Part 2 of #817: Fit/+/−/Find, clusters of other tracked alliances, the detail sheet, layer chips (shields, kill bands, names), and drawing only the glyphs in the visible box.
- The owner could review the drawn house, castle and rings on a real-data local render before part 2 builds on them.

What was missing from the task prompt? Whether a reading that saw no shield should draw anything, and which window "newest reading" means relative to the KvK shown.

PR: (added by the orchestrator)
