# feat: the public player page on the alliance page's head and growth card (issue 824, part of 818)

## Built

- `app/(pages)/players/[uid]/page.tsx` now uses the alliance page's `DossierHead` and `GrowthCard`:
  - The head shows the photo (`PlayerAvatar`, served only through /img/avatar), the name, Compare and Exact numbers. Its facts are server, alliance, might, kills, rank (`R4`, with the leader or officer title under it), quest points and level. Under the facts is an "As of {time}" line for the newest reading.
  - The alliance fact and the breadcrumb link to `/alliances/[unionId]` when the alliance comes from a daily read. When a newer reading has the player in an alliance with no daily read, they link to that event's alliance page, as before.
  - The growth card shows might and kills over 7d, 30d or 90d (`?range=`, default 30d). There is one point per daily read's day.
  - A "History" heading is drawn like the alliance page's current tab. Under it are the legend, the name and alliance timelines, Daily progress, Day by day (issue 773/786) and Across events, all unchanged.
  - The link preview from PR 841 (`cardPreview`, `playerCard`) is kept.
- `lib/queries/alliance-page.ts`: new `playerInAlliance(db, uid)`. It reads the player's newest usable daily roster that still has its raw_json. It returns the alliance's union id, tag, name and badge, the roster's day and time, `sid` as the server, and the player's own `rank_code`, `rank_label` and `active`. Only those three member keys are taken from raw_json, in SQL. The query lives in this file because it is the only read model that may name `active` (D76 amendment 2026-11-28; blocked-keys and D71 fence tests).
- `lib/queries/player-progress.ts`: `ProgressReading` has a new `day` field: the daily read's server day, or null for an event reading.
- `app/_ui/public-reads.ts`: `sharedPlayer` now also holds `playerInAlliance`, in the same D143 entry. The link card route reads only `history` from it.
- `app/_ui/PlayerDossier.tsx`: `playerAlliance`, `playerFacts`, `playerGrowth` and `HistoryHeading`.
- No new copy. Every label already existed and is translated (`ledger.*`, `alliancePage.*`).
- Tests:
  - `app/_ui/PlayerDossier.test.ts`: the head's facts and the alliance link; rank and quest points left out when a newer reading is in another alliance; growth points per day and the 7/90-day ranges.
  - `lib/queries/alliance-page.test.ts`: `playerInAlliance` returns rank, quest points and server, and no blocked key or coins/tech.
  - `e2e/public.spec.ts`: the old "figures at the last event's End" test is rewritten for the new head, which shows the newest daily read's might and kills, `Rank R5`, and the alliance link to `/alliances/900101`. A new test checks that the Growth card and range link sit above the History heading, and that Day by day is still under it.
  - `e2e/fixtures/test.ts`: `allowedAt` lets `active` through on `/players/<uid>` only.

## Decisions

- Might and kills in the head are the newest reading's (normally the daily read), not the last event's End. Otherwise the head would be older than the growth chart's last point.
- "Rank in the alliance" is the R rank (`R1`–`R5`), as on the alliance page's member list, not the rank by might. The rank by might stays in Across events.
- Rank and quest points show only when the alliance shown is the daily read's alliance. They are left out when a newer event reading has the player elsewhere.
- Level stays as a fact. It was on the page before; the task did not list it.
- History is a heading drawn as a tab, not a one-item tab nav. There is no second tab yet (the Alliance tab from #818 is not in this issue), and a nav with one link adds nothing.
- The fact's React key is `quest`, not `active`, so the D71 fence test stays unwidened.
- The label is "Quest points", the glossary term, as on the alliance page.

## Deviations

- Daily progress (the all-time chart with event bands) is kept under History along with the timelines. The task listed "timelines, across-events, day by day, name history"; I read Daily progress as one of the timelines.

## Verified

- `pnpm vitest related --run` on the changed files: 33 files, 194 tests passed.
- `pnpm check`: green, 407 files passed and 2 skipped (2230 tests). Prettier, eslint, tsc, drift and i18n (17 languages up to date) all passed.
  - The first run failed on two tests. The D71 fence flagged the fact key `"active"`, which was renamed to `quest`. `lib/squads-read.test.ts` timed out under load; it passed alone and on the second full run, and this change does not touch it.
- `pnpm exec playwright test e2e/public.spec.ts e2e/isolation.spec.ts --project=phone`: 33 passed. This ran on a production build against a separate local e2e database (`lap_e2e_824`, own ports). It includes the public private-field sweep over both seeded players.
- Screenshots of `/players/9001010` (seeded, invented names) at 360, 640 and 1280 px, light and dark, plus 360 light at `?range=7d`. They were taken with a temporary Playwright spec, deleted afterwards and never committed. They are outside the repo, in the session scratchpad (`824/`). Head, growth card, History and day by day render with no sideways scroll.
- Rebased onto dev after PR 841 (link cards) and PR 843 (alliance page preview hotfix).

## Open issues

- The Server fact is missing in the e2e seed because its raw_json has no `sid`. It shows with real data that has one.
- The server shown is the alliance roster's `sid`. A player's own server is not in the data.
- The growth range links drop a `?before=` day-by-day cursor, and the day-by-day links drop `?range=`.
- At 360 px the alliance fact's name wraps onto two lines in its half-width cell.
- The design persona review has not been done; the screenshots are its input.

## Next

- Timelines' alliance links (History) still go to `/events/[id]/alliances/[unionId]`. Decide whether they should open `/alliances/[unionId]`.
- Issue 818's Alliance tab (the player's alliance members) is not built here.

What was missing from the task prompt? Whether "rank in the alliance" means the R rank or the rank by might. I chose the R rank.

PR: (added by the orchestrator)
