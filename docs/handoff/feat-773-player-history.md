# feat/773-player-history — the player's own day by day (issue 773)

## Built

- `/players/[uid]` has a new section, "Day by day", under "Daily progress" and above "Across events" (`app/_ui/PlayerDays.tsx`). It has one line per reading of the player: a daily update, or a public event's Start or End. Lines are newest first, 14 a page.
  - Each line shows when the reading was taken, whether it was a daily update or an event's Start or End, and the alliance tag.
  - It shows Might and Kills, each with its change and percent since the reading before (`Delta`: colour, arrow and signed number).
  - "Moved to [TAG] from [TAG]" when the alliance is not the same as at the reading before.
  - "Renamed · was {name}" when the name is not the same as at the reading before.
  - "No reading since {date}. The player was in no alliance we read, or that day's read failed." when more than 36 h passed since the reading before.
  - "First reading: nothing to compare yet." on the oldest line.
- Paging: `?before=<ISO time>#days` with "Older ↓" and "↑ Newest", like the alliance history. A malformed cursor reads as the newest page.
- `lib/queries/player-progress.ts`:
  - `ProgressReading.name`: the player's name in that roster (`member_names[i]` for a daily roster, `member_snapshots.name` for an event roster).
  - `progressSteps(readings)`: a pure function that returns each reading compared with the one before, newest first.
- Copy: `history.playerTitle`, `playerLead`, `gap` and `moved`, in English and the 17 other public languages (translate-copy skill, then stamped). The section also reuses `history.daily`, `history.renamed`, `history.first`, `history.older`, `history.newest` and `ledger.was`.
- D60 amendment (2026-11-27, issue 773).
- The player page's title block moved into a local `PlayerHead` function. It renders the same as before. The move was needed because the page function passed the 80-line lint limit.

## Decisions

The persona panel ran on the e2e seed's invented data, 360 and 1280, light and dark. The usage evidence is from PostHog, read only, last 30 days: the player page had 37 views by 5 people, the alliance history 53 by 7, `/players` search 9 by 3. Usage is low, so the panel kept the change small and reused what exists.

- **A list of changes, not another chart (all personas).** The might and kills lines already exist in "Daily progress" (D68/D158). The new part is the list. A regular player wants their own daily gains. An officer and a recruiter want alliance moves and renames with dates.
- **One history, not two (designer, product).** The list uses the same readings as the charts above it: `playerProgress`, the daily rosters plus public event rosters. The section sits right under the charts.
  - "Names" and "Alliances" (the identity spans at the top, from event snapshots) stay. They are a summary with links to alliance pages.
  - The `chart-details` table (flag off) stays too. See Next.
- **How far back: everything, paged 14 at a time (recruiter, perf).** A recruiter needs older moves. Paging slices the kept readings, so an older page makes no database read. Each page's first line still compares with the reading before it, even when that reading is on the next page.
- **Gaps (data honesty).**
  - Nothing is drawn or filled in for missing days.
  - The line after a gap says "No reading since {date}" and gives both causes, because we cannot tell which one happened: the player was in no alliance we read, or the read failed.
  - Its change is the whole span since that date.
  - 36 h is the limit because the daily read's time moves by a few hours from day to day (D72). One missed day is more than 24 h but less than 36 h.
  - A null might or kills shows "—", never 0 (D15).
- **Public fields only (privacy).** Name, alliance tag, might and kills. No D71-blocked field: `findBlockedKeys` passes on `progressSteps`' output, and `raw_json` is never read.
- **Cost (perf/cost reviewer).** No new query, index, table or migration.
  - The name is one more array element in the existing daily query. That query uses `member_uids @> {uid}`, and `daily_rosters_member_uids_idx` (GIN) already exists.
  - The page stays one shared read per uid (D143). Its cache key is unchanged, so there are no new cache entries per cursor.
  - Measured on PGlite with 7,300 daily rosters (20 alliances × 365 days × 100 members, invented values): the daily query took 241 ms with the name and 249 ms without it.
  - With seqscan off, the GIN bitmap scan took 6 ms. With default settings the planner picks a sequential scan at this size.
  - The `playerProgress` JSON for a year is 45 KB.
- **Layout (designer).** The same list at every width. Might and Kills sit side by side from 360 px, and their width is capped at `max-w-md`, so they do not drift apart at 1280. Nothing is hover-only, and the pager links are at least 44 px tall. Numbers are compact (`Num`), with the exact-numbers switch as on the rest of the page.

## Deviations

- The issue asks for "might and kills over time". The charts already show that, so this change adds the per-reading list next to them and no new chart.
- The issue did not ask for a decision record. The change is recorded as a D60 amendment, not a new D-number.

## Verified

- `pnpm vitest related --run` on the changed files: 173 files, 1,010 tests passed. That run was before the translations.
- `pnpm check` passed: 381 test files and 2,054 tests passed (2 files and 4 tests skipped), no drift, and all 17 languages up to date.
  - An earlier run, made while 17 translator agents were running, had two time-outs in files this change does not touch: `lib/squads-read.test.ts` and `app/(private)/api/w/[slug]/cross-workspace.test.ts`. Both hit the 10 s limit.
  - Both passed when run with a 60 s limit, and both passed in the final full run.
- New tests in `lib/queries/player-progress.test.ts`:
  - The name is read from both daily and event rosters, and `progressSteps` returns no blocked key.
  - Lines are newest first, with might and kills changes.
  - A null value on either side gives no change.
  - A rename and an alliance move are named.
  - A gap is marked, and a next-day reading that is a few hours late is not.
- Screenshots on a local production build with the e2e seed (invented data), system Chrome, 360 and 1280, light and dark, newest page and older page. They are in the session scratchpad, not committed. They show a daily and event mix, a first reading, and the Older/Newest paging.
- Not seen on screen: the rename, move and gap lines. The e2e seed has no player who renames, moves or misses a day. Tests cover those lines.

## Open issues

- The existing `playerProgress` takes about 160–400 ms on the 7,300-roster PGlite set. Almost all of that time is the per-roster rank subquery (`unnest(member_power)` for each row) and `summaryOf`'s two roster reads, both from before this change. The shared read (D143) means it runs once per write, not once per view. Follow-up if Neon timings show it.
- On PGlite at this size the planner picks a sequential scan over the GIN index (5 % selectivity, TOASTed arrays). Check `EXPLAIN` on Neon with real row counts.

## Next

- Follow-up: once this list is out, decide whether the `chart-details` readings table under "Daily progress" (flag off, D91) is still needed. It shows the same readings with ranks.
- Follow-up: add a player with a rename, an alliance move and a missed day to the e2e seed, so the UX review can see those lines.
- Follow-up: the rank subquery cost in `playerProgress` (see Open issues).

What was missing from the task prompt? Whether the per-reading list should also replace the flag-gated readings table, and whether a decision record or a D60 amendment was expected.

PR: (added by the orchestrator)
