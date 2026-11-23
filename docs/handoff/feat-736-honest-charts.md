# feat/736-honest-charts — honest chart scales (issue 736, part 1)

## Built

- **D158** (`docs/decisions/D158-charts-honest-scales-and-tap-to-read.md`): amends D68, D83, D90, D136 and D153 with the panel's rules: one bar and one zero rule, shares against their whole, reference lines, one reading cadence per line, sr-only text instead of `aria-label` on non-interactive elements, the four tap patterns (to build in part 2), and the Satori limits binding the line chart only. Index line in `docs/decisions/README.md`; a dated pointer at the end of each amended decision; DESIGN.md: new `chart-bar` entry, `line-chart` and `server-pulse` entries updated.
- **`Bar`** (`app/_ui/charts/Bar.tsx`): null draws nothing (no empty track); zero or less a 1 px hairline; above zero at least 2 px; clamped at the full track; optional 2 px `reference` tick; the drawing is `aria-hidden` (its words are the row's own text or an sr-only span beside it). `axis` is `"column"` or `"row"`, `reverse` grows a row from its end. Every column and horizontal bar now uses it: `LivePulse`, `PulseStrip`, `WhoFought`, `MergeSimulator` (a split total stacks three bars in one grid cell: the whole in seal, then the part that fits in the track colour and in ink over it; the cap is the reference tick), Insights `Bars`, the week's pulse days, KvK recovery days, time zones, and the member card's Last 7 days. No 6 % stub remains.
- **KvK recovery**: no longer capped at 100 %; drawn against `max(100 %, highest day)` with a 100 % tick (`lib/private/insights-more-words.ts`, `BarRow.reference`). A day that lost more draws a hairline.
- **Line chart** (`app/_ui/charts/LineChart.tsx`): the line joins the readings that are not `mark` (the daily reads). Event Start and End readings are hollow dots off the line, inside the event band, which is now `bg-ink/10` with dashed `ink/50` edges. The value range still covers every reading. The player page's key under the might chart shows the band with a hollow dot and reads "Event (Start to End), its readings as hollow dots: …".
- **Standing**: the per-row sparkline is gone and `app/_ui/charts/Sparkline.tsx` is deleted. A row whose rank moved says "was #6 on 14 Nov" (`standing.was`); a held rank says nothing more. `#4 ▲2` stays.
- **Kill share vs might share**: one bar per alliance, the gap in points centred on 0 (`GapBar` in `WhoCarried.tsx`), axis `±` the largest gap among all rows (`gapAxis`), so "Show all" does not move bars. The key spells "percentage points" once (`ledger.carriedGapKey`); the square/round legend keys are removed.
- **Membership flow**: week joined/left and came-from/went-to bars are drawn against the members in the newest daily update (`rosterSize`), not the busiest row.
- **Time zones**: each group's bar is out of all members; "Not recorded yet" gets a bar on the same scale (`missingShare`). The legend now reads "Bar: share of all {members} members." (EN, PT-BR, FR).
- **Member card Last 7 days**: quest points and donations are drawn against the alliance's best member-day in the same 7 days (`LastDays.best`); coins keep 1,000. A line under the rows says what the bars are against, with the two figures (`card.days.scale`, EN, PT-BR, FR).
- **KvK matchup below 640 px**: one table per part (Start; Start to End), a row per measure and a column per server, with each side's read time, coverage or counted line under its name. The cards stay from 640 px.
- **Accessibility**: `aria-label` on `<li>` moved to an sr-only span in the week's pulse days, KvK recovery days and Last 7 days.
- Translations: the three new or changed public strings in 17 languages (translate-copy skill), stamped.

## Decisions

- D158 is one decision for the whole of issue 736's amendment, including the tap patterns that part 2 builds, so part 2 needs no new decision for them.
- Bar's axis is `"column"` / `"row"`, not `"x"` / `"y"`: `lib/private/roster-fields.test.ts` (D71) reads the string literals `"x"` and `"y"` as private roster fields.
- 0 kills in a "moved" pulse interval draws a plum hairline; "no reading" stays an ink hairline and "no update" the dashed stub. `lib/live.ts` is unchanged: Bar's zero rule covers it.
- Daily quest points and donations reference: the alliance's best member-day in the same 7 days, as the owner confirmed on 2026-11-22. The possible 230 quest-point cap is not used (see Open issues).
- A member's own page (Me, D142) keeps the member's own best day as the scale. An alliance best there would let a member work out another member's private value from their own bar's height. Me shows no scale line.
- The matchup table is a second DOM copy shown below 640 px (`sm:hidden`), the cards are `hidden sm:grid`. The e2e test checks the table on the phone project and the cards on the wide one.
- War turnout's muted rows (fewer than 10 gainers) now draw no track at all (null draws nothing), where they had an empty grey track.

## Deviations

- Not done from the report's step 3 and 4 lists, because the task's list did not include them: the week's pulse sentence when every day is 100 %, leaving out leading weeks with no change, muting a week under 3 reads, and A and B written inside the balance bar's segments. D158's "Not done here" names them.
- The task named 25 px Details links. Every Details control in the chart cards already has `min-h-11`; the persona run measured tap targets under 44 px (see Verified).

## Verified

- Unit tests (one per stated behaviour): `app/_ui/charts/Bar.test.ts` (null draws nothing, zero and negative a hairline, a tiny gain at least 2 px, clamp above 1, reference tick, words in sr-only text); `LineChart.test.ts` (an End dip is a hollow dot and not a point of the line; dots above 30 daily readings); `WhoCarried.test.ts` (the gap bar's axis comes from every row, so the shown row is a third of its half against a hidden row's wider gap); `insights-zones.test.ts` (Manila 3 of 5 members, "Not recorded yet" 2 of 5); `insights-sets.test.ts` (one joiner is 1/9 of the members); `member-days.test.ts` (a steady 300-point member is half of the alliance's 600 best member-day, donations a quarter of 8,000, coins still against 1,000). Each one fails if its rule is broken: for example, building the gap axis from the shown rows makes the bar 100 % and the test fails.
- `pnpm vitest related --run` on the changed files, then `pnpm check`: green (368 files, 1,962 tests; i18n up to date in 17 languages).
- e2e, once, on my own cluster (127.0.0.1:54460, database `lap_e2e`) and ports (app 3591, bridge 54461, stub 3593): 80 passed, 2 failed. Both failures were the Last 7 days lookup by the `<li>`'s old `aria-label` (phone and wide). I fixed the test (`e2e/desk.spec.ts`: the list item by its sr-only text, plus the new scale line) and reran only that test on the same build: 2 passed. The KvK matchup test passed on both projects with the new table and cards branches.
- Persona check on the local production build with the e2e seed (invented data), every public chart flag on, playwright with the system Chrome, at 360 and 1280 px, light and dark: event page (War turnout, Kill share vs might share, KvK matchup), alliance page (Standing), player page (Daily progress), Insights (flow, KvK recovery, time zones), the member card (Last 7 days), Me and merge. No page scrolls sideways (`scrollWidth` 360 at 360). The only targets under 44 px on these pages are older name links (alliance and member names 25 px, the player's history date links 25 px with a card-wide overlay); every Details control measures 44 px, so no change was needed for the "25 px Details links". Panel:
  - Data-visualisation specialist: the line no longer falls to the floor at an event End; the gap bar reads from 0 and holds its length when "Show all" opens; KvK recovery's 112–120 % days now differ, with the 100 % tick under their tops; a one-person week in the flow is a short bar. Validated as is.
  - Officer reading English as a second language: the matchup table puts "553M | 166M" on one line; "Bar: kill share minus might share, in percentage points. Right of 0: the kill share is higher." and the Last 7 days line were read correctly. Validated.
  - Designer: dark and light both keep the hollow dots and the dashed band readable; the matchup heads wrap to three lines at 360 but stay aligned. Nothing to change in this PR.
- The shots stay on the orchestrator's machine, in the session scratchpad's `shots/` folder (files `event-*`, `alliance-*`, `player-*`, `insights-*`, `card-*`, `me-*`, `merge-*`); none are committed.
- PR 738 review fixes (one commit on top of the rebased branch):
  1. The merge simulator's split bars used `absolute inset-0` on a `Bar` whose root is `relative`, so they could collapse to 0 px. They now stack in one grid cell; a track-coloured underlay under the part that fits keeps the 60 % ink from showing seal through when nobody is left out. Checked at 360 px, light and dark, on a fresh production build with the e2e seed: every merge track's boxes measure 8 px high, and the "Together" rows read like the others.
  2. DESIGN.md's `chart-bar` entry now says the reference tick is 2 px, as `Bar.tsx` draws it.
  3. `insights-kvk.test.ts`: recovery days of 10 %, 120 % and −10 % draw against a 120 % scale, with the 100 % tick at five sixths on every day.
  4. `lastDays` no longer reads every member; `allianceBest(reads, days)` does, once per member card. Follow-up's per-member `lastDays` calls no longer do N×N work.
  5. `app/_ui/Standing.test.ts`: "was #n on Nov 14" shows for the three rows whose rank moved and not for the one that held.
  6. `Bar`'s `label` option had no caller and is removed; D158 rule 1, DESIGN.md and the Bar tests say the drawing is `aria-hidden` with its words beside it.
  - `pnpm vitest related --run` on the changed files (44 files, 231 tests) and `pnpm check` (369 files, 1,964 tests): green.

## Open issues

- **Owner: daily quest point cap.** The owner thinks the game caps daily quest points at 230 but is not sure. D127 records "No fixed cap: a full day is about 750, seen up to 1,035", which contradicts 230. Until the owner confirms, quest points are drawn against the alliance's best member-day. If a cap is confirmed, set it like `COINS_MAX` in `lib/private/member-days.ts` and change `card.days.scale`.
- Donations have no game cap (owner, 2026-11-22); they stay on the alliance's best member-day.
- The seed has no alliance whose rank moved in the Standing period, so "was #6 on Nov 9" was not seen on screen; it has no unit test either (the task's test list did not ask for one).
- War turnout's muted rows now show no track; the persona check saw no problem, but it changes how the list's rows line up.
- Analytics: no change. No event is added, changed or removed; the Kill share row keeps its `DrilldownLink` (`surface: kill_share`).

## Next

- Part 2 of issue 736: the tap patterns (D158 rule 7): readouts on the pulse, fight clock, compare and line charts; row panels on War turnout and Kill vs might; who lists with Members `?set=`; arrival lines; chart-to-chart levels.
- Follow-ups from the report not in this part: the week's pulse sentence when every day is 100 %; leaving out leading weeks with no change in membership flow; A and B inside the balance bar's segments; the `chart-details` flag decision once readouts exist.

What was missing from the task prompt? Whether the report's step 3 and 4 items that the task's list did not name (week's pulse sentence, leading empty weeks, balance A/B labels) were in scope; I left them out.

PR: (added by the orchestrator)
