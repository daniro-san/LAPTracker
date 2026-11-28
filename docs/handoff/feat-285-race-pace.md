# feat/285-race-pace

## Built
- "Race to #1" on `/alliances` (issue 285), page 1 only, after "Alliances recruiting" and before "Read every day". It shows only while the PostHog flag `race-pace` is on (D91). The key is added to `FLAGS` in `lib/flags.ts`. The flag does not exist in PostHog yet, so the section is off.
- `lib/queries/race.ts` `racePace(db)`: one SQL statement over `daily_rosters` (usable rows only: `dailyFit`, `total_power` not null). It takes the newest usable day and the top `RACE_TOP` (10) alliances of that day's tracked set (D133) by might. It finds the four Saturdays up to that day (`RACE_WEEKS` + 1 = 4) and reads at most 4 rows per alliance. SQL returns each alliance's Saturday count, the median weekly change (`percentile_cont(0.5)`), the lowest and highest weekly change, and the membership move between the first and last Saturday. The move is members who joined plus members who left, compared as uid sets in SQL; only the counts come back. TypeScript then sorts each alliance into one of three cases: fewer than 4 Saturday reads is "few"; a move above `RACE_MOVED_MAX` (10 %) of the first Saturday's members is "moved"; otherwise it has a pace. Projected might = might today + `RACE_AHEAD` (4) × median. Both places (today and projected) are `rankBy` among the alliances that have a pace.
- `app/_ui/RacePace.tsx`: a slope chart. The left column lists today's places (`#1 [TAG]`), the right column lists the places in 4 weeks, and an inline SVG between them draws one line per alliance (D68: shapes only, `vector-effect="non-scaling-stroke"`, round-capped end dots, `currentColor` with token classes). Both sides use one 44 px row per place, so the scale is the same on both sides and a line's slope is the places moved (D158 honest scale). Tapping a row on either side, or using the ‹ › steps, opens the existing `Readout` (D158 rule 7 (a)), which reads e.g. "[NSE] North · #1 → #2 in 4 weeks at this pace · +1.00M a week (slowest week +1.00M, fastest week +1.00M)". The chosen alliance's labels and line turn plum. Under the chart: "Places among the n alliances with a pace…". Alliances left out are listed as "[TAG] Name: membership changed a lot" or "[TAG] Name: not enough weeks yet". When no alliance has a pace: "Not enough weeks yet. A pace needs 3 weekly changes, Saturday to Saturday."
- Shared cache (D143): `sharedRace()` in `app/_ui/public-reads.ts`, entry `race`, no key (the result depends only on stored rows). Writes to `daily_rosters` already invalidate `reads`.
- Copy: `lib/copy-race.ts` (`copy.race`, 11 keys), translated into the 17 other public languages with translate-copy and stamped.
- Tests: `lib/queries/race.test.ts` (PGlite): median and range; the 10 % membership exclusion (40 % is left out, exactly 10 % is kept); the "not enough weeks" case (a missing Saturday); the projected-rank order; null before any read.

## Decisions
- Data source: the daily reads (`daily_rosters`, /v1), not the ranks board (`alliance_board`). D5 says no number in a change depends on the undocumented endpoint, and a pace is a change. The task's "stored ranks history" is read as the daily reads' might history, the same data the standing (D90) ranks.
- "Membership moved more than 10 %" means members who joined plus members who left between the first and the last Saturday, divided by the first Saturday's member count, with the uid sets compared. A pure member-count comparison would miss a swap of members at the same size.
- Places are counted among the alliances with a pace, not on the whole board, and the line under the chart says so. Projecting the excluded alliances (for example at a flat might) would invent a figure.
- Saturdays are calendar Saturdays of the server day (`read_day`), the 4 up to the newest read. An alliance that lacks a usable read on any of them is "few". A Saturday read that fails for everyone therefore hides the chart for 3 weeks (see Open issues).
- The window for "today" is the newest usable daily read, even when it is not a Saturday; the projection starts from that day's might.
- Copy: "at this pace" in every projected line; "will" is not used. The English `race.line` was first "weeks from {low} to {high}". Five translators read that as a range of weeks, so it became "(slowest week {low}, fastest week {high})" and only that key was translated again in all 17 languages.

## Deviations
- None from the task. The issue says "range"; it is shown as the slowest and fastest weekly change in the readout, not as a projected-rank range.

## Verified
- `pnpm vitest related --run` on the changed files: 206 files, 1235 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest 432 files / 2385 tests, schema drift, i18n: 17 languages up to date).
- Rendered the section once with `renderToStaticMarkup` in a throwaway test that was not committed (flag on, two alliances that swap places, one "moved"). Checked: the labels on both sides, the lines' y ends (0.5→1.5 and 1.5→0.5), the readout line, the "among" line and the note.
- Not done: a look in a browser at 360/640/1280 px and in dark mode. There is no local database with real reads in this worktree, and the flag is off.

## Open issues
- A Saturday daily read that fails for every alliance leaves no pace for 3 weeks. A fallback to the nearest read would be a follow-up if this happens.
- The SVG uses `h-full` inside a CSS grid row; I checked the HTML, not the drawing in a browser.
- The PostHog flag `race-pace` must be created and turned on by the owner.

## Next
- Owner: create the boolean flag `race-pace` in PostHog project 741657 (all users, 100 %) and turn it on when ready.
- Follow-up: a designer-persona UX review at 360/640/1280, light and dark, with real data, before the flag goes on.
- Follow-up to consider: name a tie in the projected places (two alliances on the same projected might share a place).

What was missing from the task prompt? What "membership moved" counts (member count or members in and out) and what the places are counted among. Both are assumptions above.

PR: (added by the orchestrator)
