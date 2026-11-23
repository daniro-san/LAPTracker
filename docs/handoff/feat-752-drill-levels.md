# feat/752-drill-levels — the remaining drill levels (issue 752)

## Built

Pattern (b) of D158 rule 7 goes one level further. Each new level shows in its chart's place, under `DrillPath` with a 44 px Back step to the level above. The level is in the address query.

- **Membership flow, a day** (`?flow=<monday>&flowDay=<day>`):
  - On the week level, a day with a join or a leave is a 44 px row link ("Sat, Nov 21 ›").
  - It opens that day's "Where newcomers came from" and "Where leavers went" bars. They are counts only (D75), drawn against the members.
  - The sum line comes first: "Sat, Nov 21: 1 joined, 1 left. The places below add up to this."
  - The places come from the window's own sightings: `cameFrom` and `wentTo` over that day's moves (`InsightsView.flow.day`, `lib/private/insights.ts`).
  - Back goes to the week's days, this week too.
- **Week's pulse, a day** (`?pulseDay=<day>`, plus `pulse=<monday>` from an earlier week):
  - "Open a day to see who did it:" sits over a row of 44 px day links. On the card they list this week's days; on a week's level, that week's days.
  - The day shows "n of N members" for daily quest points, the coin cap and a donation. Each row opens the names of those who did it: in place, in name order, nobody else, no Members link.
  - Then the day's middle donation, and how many have unknown quest points.
  - `reachedOn` (`lib/private/insights-rules.ts`) gives each read's sets. `pulseOf` now counts with it, so a day's names are its column's count.
- **KvK recovery, a day** (`?kvk=<KvK day>&kvkDay=<day>`):
  - "A day's numbers:" day links sit under the recovery columns.
  - A day shows three bars: the Start, the End and that day's might of the counted members its read lists. Then "n of the N members this KvK counts", how many that read leaves out, and the share back its column shows.
  - `KvkDay` (`lib/private/insights-kvk.ts`) carries those sums from the same loop that makes the column.
  - The KvK alone (`?kvk=`) shows its recovery days unfolded. That is the level Back returns to.
- **Fix: flow weeks with nothing to compare.** A week none of whose days can show a change (no daily update, or only the first one) shows "—" with "nothing to compare", no bar and no link. It never shows 0.
- **Fix: start dates.** The flow card's based line now says where its weeks start: "Based on 14 daily updates in these weeks, since November 9." The day level's line says the same: "These weeks start from the daily update of …". Both use `flow.since`, the daily update the first change is compared with.
  - With fewer daily updates than the page reads (36), that is the alliance's first one, the date the tenure line gives (the seed: Nov 9 in both).
  - With more, the tenure line keeps the alliance's first daily update ("Already here at our first daily update, Oct 10") and the based line names the weeks' start ("in these weeks, since October 18"). Each line says which start it gives.
- **Shared parts:** `Card`, `Sub`, `Bars`, `RowBody` and `LevelNav` moved from `InsightsSections.tsx` to `app/(private)/_ui/InsightsBars.tsx`, so the day levels can use them without an import cycle. `DayPicks` (`InsightsDays.tsx`) is the row of day links.
- **Analytics** (dated Changed line and updated row in `docs/analytics/tracking-plan.md`): `ws_drilldown_opened` on `insights` gains `kind` `flow_day`, `pulse_day`, `kvk_day` (counted on the tap) and `pulse_reached` (a pulse day's who list opened). Each is a bucket only, once per kind per page view.
- **Copy:** desk only, in `lib/private/dictionary.drill.ts` and `insights.flow.noCompare`, in EN, PT-BR and FR. No public copy changed, so translate-copy was not needed (`pnpm check`: i18n up to date).
- **D158**: dated amendment.

## Decisions

- **Day links under the 7-column grids, not tappable columns.** At 360 px a column is about 40 px wide, under the 44 px rule. A row of 44 px links under the grid keeps every target 44 px. The flow's days are full-width rows, so the row itself is the link.
- **A pulse day lists only who did it** (issue 736: "listing who reached it", thanks first). It has no Members link ("in place only").
- **KvK has two levels**, the KvK with its days unfolded and the day. Back from a day then lands on visible days, not on a closed "Show the details" fold.
- **A day with nothing behind it opens nothing:**
  - a flow day without a join or a leave;
  - a pulse day without a read, or outside the pulse's weeks;
  - a recovery day whose read lists none of the counted members.
  - Each gives the chart itself.
- **Persona panel** (dataviz specialist, ESL officer, adversarial reviewer on D75; screenshots of the local production build at 360 and 1280 px). All three said ship after changes. Adopted:
  - the flow day's count first, then its places;
  - under a week or day path, the flow card shows only that level (its whole-period came-from, went-to, tenure and newcomers return with Back);
  - "Counted: n of the N members this KvK counts" always;
  - no link to a recovery day whose read lists none of the counted members (its numbers would show 0);
  - "Its column shows the same" dropped;
  - "Who did it on a day:" changed to "Open a day to see who did it:";
  - the unknown-quest-points line no longer states a reason that can be wrong (`questDay` also gives no data on a drop).
- **Not adopted:**
  - A 7-column grid of day links. (328 − 32) / 7 is about 42 px, under 44.
  - Every other point is in Open issues.

- **Review of PR 755, fixed:**
  - D139 has a dated amendment: a pulse day names who did each measure (officers only, names only, no ranking, no Members link), citing the owner's approval of 2026-11-22. D158's amendment cites it too.
  - The KvK e2e opens a recovery day of the older KvK (two Saturdays back), which is always in the past, so the test asserts the level on every day of the week. It no longer returns early on a Sunday.
  - The pulse-day test's "outside the pulse's weeks" case uses a day that has a read (Oct 12), so it fails without `pulseDayOf`'s window guard (checked by removing the guard).
  - Start dates reworded, with a test of more than 36 daily updates (above).
  - One `pulsePicks` (`insights-words.ts`) for the card and the week level; the stale comment above `FlowDayRow` moved to `FlowDays`; the flow day's filter drops its always-true clause.
  - The flaky `?set=` e2e compares the decoded `set` parameter, since Members writes its address back with `%3A` once hydrated.

## Deviations

- **The flow card's week level also hides its whole-period parts now** (built in PR 751). The dataviz reviewer asked for it at both levels, for the same reason as the day level.
- **`insightsView`'s fifth parameter is now an object** (`{ pulseWeek, pulseDay, flowDay }`), and `InsightsLevels` has six fields. The three test calls and the `InsightsSets.test.ts` fixture changed with them.
- **`lib/private/dictionary.test.ts`** names the based line's caller by its new argument (`flow.since`).

## Verified

- `pnpm vitest related --run <changed>` after each step. Then `pnpm check`, which is green: 374 files and 1,999 tests pass, i18n is fresh in 17 languages, and there is no schema drift.
- New PGlite tests in `lib/private/insights-levels.test.ts`:
  - **Pulse day:**
    - each measure's names count is the day's column (`n`/`of` equal);
    - the names are exactly who did it, and the sets have no onward link;
    - the unknown-quest-points line;
    - a day without a read, or before the pulse's weeks, opens nothing;
    - another alliance's workspace, at the same address, names only its own members.
  - **Flow day:**
    - the day's places equal its joined and left;
    - one sighting falls before the join and one after the leave;
    - another day's places are its own;
    - Back goes to this week's days;
    - the first read, or a day without a read, opens nothing.
  - **KvK day:**
    - each day's sums and share;
    - the column's percent is the day's sum line;
    - "1 of the 2" with one left out;
    - a read listing none of them is "—", has no link and opens nothing;
    - another KvK's day opens nothing.
- In `lib/private/insights.test.ts`: the "—" weeks with "nothing to compare", no bar and no link; the same date in the based line and the tenure line with a short history; with 40 daily updates, "in these weeks, since October 18" and "our first daily update, Oct 10".
- E2E on my own Postgres (port 54417) and ports (app 3767, bridge 54767, stub 3769), phone 360 and wide 1280. In `desk-insights.spec.ts`, one test per level, on seed values:
  - **Flow day:** the event day's row, the path, "Not known 1" under both headings, the sum line, no names, no tenure, Back to the week at the same scroll position.
  - **Pulse day:** on Moss Hollow, whose idle members sent nothing on the newest read, each row's "n of 8" and exactly its names; Back.
  - **KvK day:** the column's share, then the Start, End and that day's might of the 10 counted members computed from the seed, the sum line, Back to the KvK's days, then "All KvKs".
  - Each test checks the 44 px link and the address.
- **Final runs:**
  - `desk-insights`, `desk-kvk`, `desk-drilldown` and `isolation`: 51 passed, 1 failed. The failure was the earlier test "a group's names end with Open these n in Members ›" (wide). `toHaveURL` saw `%3A` for `:` in `?set=`; this PR does not touch that path.
  - `desk-insights.spec.ts` with `--repeat-each 3`: 54 of 54 passed.
- After the review fixes (PR 755): `pnpm vitest related` (467 tests) and `pnpm check` are green: 374 files and 2,000 tests pass. `desk-insights.spec.ts`, phone and wide, on my own Postgres and ports: 18 of 18 passed, twice (once after a fresh build).
- My Postgres and servers are stopped.

## Open issues

- **Pre-existing, from the panel, not changed here:**
  - `DrillPath` shows a Back link and the trail on one line on wide screens, so the week appears twice. On phones the last step can wrap alone ("› Sat, Nov 21").
  - The flow's "This week" row opens a level named "Week of Nov 16".
  - The flow's week rows say "−1" while the place bars say "1".
  - "nothing to compare" (flow) and "no daily update" (pulse) word the same empty weeks two ways. Three empty weeks take three rows.
  - The KvK column's 100 % tick has no label.
  - The words "Start read" and "End read", "Share of the loss back" and "middle value" are hard for an ESL reader.
- **The pulse-day inference limit** is recorded in D158: an officer can tell who is not named, and with one donor the middle donation is that member's.

## Next

- Follow-up issue for the panel's pre-existing points above: `DrillPath` on wide and phone, flow week naming, signs, empty-week wording, the 100 % tick label and the ESL wording.
- At release: patch notes, and new guide screenshots of Insights (pulse, flow and KvK cards).

What was missing from the task prompt? Whether the flow card's week level (PR 751) should also drop its whole-period parts once the day level does. I did it, on the dataviz reviewer's advice.

PR: (added by the orchestrator)
