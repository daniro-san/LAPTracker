# feat/817-map-scene

## Built
Part 1 of issue #817: the drawn scene on the officers' map (Insights → KvK).
- `lib/brand/components/MapGlyphs.tsx`: four drawings made with the `hand-drawn-svg` method. They are a house (a member's city), the castle, the shield ring and the dashed "no reading" ring. Each is a 16-unit filled cut placed as a `<g>` inside the map's SVG. Colour comes from a token class (`text-ink`, `text-plum`, `text-seal`). The shield's light disc is `currentColor` at 0.14 fill opacity. The generators are `icon_house`, `icon_castle`, `bubble` and `no_reading` in `docs/brand/drawing/examples/ornaments.py`, registered in `build.py` as `map-house`, `map-castle`, `map-bubble` and `map-no-reading`. All four together are 3.4 KB.
- `app/(private)/_ui/InsightsKvkMap.tsx`:
  - Each member is a house at their X/Y, with a 5.6-unit house and an 11.2-unit ring (1.4× the first cut, after the coordinator's review). Their name is in HTML (D68): the name only, with a paper-coloured halo (`text-shadow` in `--color-paper`, which follows the theme), so a name over a neighbour's house or ring stays legible.
  - Names are placed by `labelsOf`, starting with the members nearest the castle. Each name tries 8 spots in turn: under, above, right and left of its house, then its four corners. It takes the first spot inside the plot that covers neither the castle (plus 1 unit around it), nor another name, nor another house's ring. When no spot is free, it takes the one that covers the fewest names, then the fewest rings, and never the castle if any spot avoids it. Label sizes are estimated for 12 px text in a 293 px plot (one line of 5.2 units, 2.6 a letter, at most 30 wide).
  - A member whose shield was seen gets the light ring. A member with no reading gets the dashed ring; the words "no reading" are in the readout line and the legend, not on the map's label (coordinator, 2026-11-28). A reading that saw no shield gets no ring.
  - The castle drawing replaces the old seal-coloured plus. It is 17.5 units (2.5× the first cut), in full ink (`text-ink`), and drawn after the houses and rings so they never cover it.
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
- The plot's inner margin went from 5 to 12 units, so a name beside an edge house is not clipped. Labels are at most 30 % of the plot wide and truncate past that.
- Second coordinator review: the "no reading" line left the map's labels, and the names gained a paper-coloured halo. Each label is one line, so the margin went back to 12.
- First coordinator review (after the first commit): castle 2.5× larger, in ink, drawn above the rings, with names kept clear of it; houses and rings 1.4× larger. Label placement grew from "always under" to the 8-spot search above, because at 1.4× the sample's tight cluster overlapped once names moved off the castle.
- French uses "non lu" for "no reading": `dictionary.test.ts` bans "pas de relevé" (the daily-update term rule).

## Deviations
- None from the spec. The drawings were not shown to the owner before wiring in (skill step 7). The task asked for them to be built directly. The sheet is in the scratchpad (see Verified).

## Verified
- `pnpm vitest related --run` on the changed files: 136 files. The first run caught the French term rule (`dictionary.test.ts`) and a test regex, and both were fixed. In the second run, `cross-workspace.test.ts` failed once under load; it passed alone (4 of 4), and it passed in the full suite below.
- `pnpm check`: passed (398 files, 2165 tests; drift and i18n clean). Before that it caught a lint function-length error and an import order, both fixed.
- After the coordinator's review: `pnpm vitest related --run` on InsightsKvkMap.tsx passed (2 files, 3 tests), and `pnpm check` passed again (398 files, 2165 tests). Same results after the second review round.
- Screenshots: a 360 px render of a sample of 12 invented members (castle point set, 6 shield seen, 2 not seen, 4 no reading), light and dark. The card was rendered with `renderToStaticMarkup` plus the app's compiled Tailwind CSS, in system Chrome via Playwright. No horizontal scroll (scrollWidth 360). After the review, re-rendered at the same paths: the castle is large, in ink, above the rings and clear of every name, in both themes. The rings are correct and both "as of" lines show. Screenshots are kept outside the repo.

## Open issues
- In the final render, all 12 names in the sample read in full in both themes and none covers the castle. Linden's name touches Fern's ring and stays legible on its halo. Linden's house sits under the castle, which is drawn on top as asked. A denser alliance will still crowd at 293 px; part 2's zoom levels are meant to solve that.
- The "Who (n)" lists never showed shields and still don't; "keep it in the Who lists" was read as "don't remove anything there".
- The castle sits on top of any house under it. The house is still reachable with the ‹ › steps, and through its name, which carries `data-at`.
- Every member of an alliance with no shield check (no readings) shows the dashed ring and "no reading".
- A newer reading with `shielding` null hides an older reading of the same raid that had a value. `shieldReadings` takes the newest row per member. The same behaviour exists today in Raid prep.

## Next
- Part 2 of #817: Fit/+/−/Find, clusters of other tracked alliances, the detail sheet, layer chips (shields, kill bands, names), and drawing only the glyphs in the visible box.
- The owner could review the drawn house, castle and rings on a real-data local render before part 2 builds on them.

What was missing from the task prompt? Whether a reading that saw no shield should draw anything, and which window "newest reading" means relative to the KvK shown.

PR: (added by the orchestrator)
