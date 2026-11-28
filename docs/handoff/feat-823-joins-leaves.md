# feat: Joins & leaves tab on the public alliance page (issue 823, part of 818)

## Built

- Read model `lib/queries/alliance-moves.ts` (`allianceMoves(db, unionId, today)`):
  - It covers the 30 server days up to `today` (`MOVES_DAYS`).
  - Each usable daily roster of the alliance (`dailyFit`) is diffed against the previous one by uid, with `compute.rosterDiff` (the same diff member history uses).
  - The other side comes from `flow.placeMembers` (D89):
    - for a join, the alliance whose usable daily roster listed the uid on the previous compared day;
    - for a leave, the alliance whose roster lists the uid on the day of the change.
  - When no daily roster lists the uid, `other` is null.
  - It returns `week` and `month` counts (joined, left), `compared` (false with fewer than two rosters), and `moves`. Moves are sorted newest day first; within a day, joins come before leaves, each sorted by name.
  - Fields read: day, union id, tag, read time and uids of each roster, plus this alliance's `member_names`. No raw_json is read.
  - It is one query: the alliance's rosters, plus every roster in the window whose `member_uids` overlaps the alliance's members of the window.
  - The outer query and the subquery that collects the alliance's uids share one condition, `dailyFit` plus the window. The subquery reads `daily_rosters` unaliased, so the qualified columns name its own rows and the two cannot drift apart.
  - It returns null when the alliance has no usable roster in the window. The shared cache never keeps null (`lib/public-cache.ts`), so a crawl of unknown ids leaves no entries. The page shows `NO_MOVES` (zero counts, nothing to compare) in that case.
- `app/_ui/AllianceMoves.tsx`:
  - The tab body has two rows of tiles, one for the last 7 days and one for the last 30 days. Each row shows joined (`+4`), left (`−6`) and net.
  - Under the tiles, a line says how the moves are found.
  - Filters All / Joined / Left are links (`?show=joined|left`, `scroll={false}`), at least 44 px tall.
  - The list is grouped by server day. Each line has the player's name, linked to `/players/[uid]`, then `Joined · from [TAG]` or `Left · to [TAG]`. With no tracked alliance on the other side, it reads `Joined · was not in a tracked alliance` or `Left · not in a tracked alliance`.
- `AllianceTabs` (`app/_ui/AllianceDossier.tsx`) now has three tabs: Members (n), Joins & leaves (net of the last 7 days, signed: `+2`, `−2`, `0`) and History. The current tab is marked with `aria-current`.
- `app/(pages)/alliances/[unionId]/page.tsx`:
  - `?tab=moves` shows the tab.
  - The range links keep the tab and the filter.
  - The read goes through the shared cache: `sharedRead("alliance-moves", [unionId, serverDay, lookup])`. The key holds the server day, so a new day starts a new entry. A write to `reads` drops the entry, as for the page's other reads (D143).
- Copy: 15 keys in `lib/copy-alliance-page.ts`. They are translated into all 17 public languages with the translate-copy skill, then stamped. Glossary rows were added by the translators (es, pt-BR, fr, de, it, nl, ru, tr, zh-CN, ja, id).
- Tests:
  - `lib/queries/alliance-moves.test.ts` has 5 tests: the counts for 7 and 30 days; the from and to tags; no blocked key or value (the seeded raw_json has x, y, online and joined_at); null with no roster in the window (an unknown id, and an alliance whose newest roster is older than the window); and nothing to compare with one roster.
- Rules: D89 has a dated amendment (owner, 2026-11-28, issues 818 and 823). It allows per-person moves, the name with the from/to tag, on the public alliance page. `FLOW_MIN` and "never a member name" still bind `/alliances/flow`. Online, last seen, join date and X/Y are still never shown.
  - `app/_ui/AllianceMoves.test.ts` has 3 tests: the from/to wording; the wording for an untracked other side, which never says "no alliance"; and the three filters.
- e2e:
  - `/alliances/<a>?tab=moves` is added to the public sweep in `e2e/isolation.spec.ts`.
  - `leaksIn` (`e2e/fixtures/test.ts`) now passes the query string to `allowedAt`. `/alliances/<id>?tab=moves` gets no daily-field allowance; only the Members tab keeps one. The scan's self-test asserts that `active` on `?tab=moves` is reported.

## Decisions

- **"Tracked alliance" means any alliance with a usable daily roster on the compared day.** This includes an alliance read through "Get today's details" (D133), not only the tracked set of 20. The page only knows where someone went when it has that alliance's roster for the day.
- **The tab badge is the net change of the last 7 days**, as in the owner's reference (`Joins & leaves (−2)`). The joined and left counts appear only inside the tab.
- **The tab is a query parameter (`?tab=moves`), not a route**, so it keeps the head, the statement and the growth card, as in the reference.
- **The 7 days and 30 days count back from today's server day, not from the newest roster.** The cache is keyed by the server day.
- **No time of day on each line.** The change happened somewhere between two daily reads. The read time would suggest a precision we do not have.
- **The other alliance's tag is plain text, not a link.** The task did not ask for a link.

## Deviations

- The reference showed "Left, no alliance now". As the task says, the line reads "not in a tracked alliance" instead.

## Verified

- `pnpm vitest related --run` on the changed files: 190 files, 1126 tests. The first run had 1 failure: the test expected the wrong order for names that sort by `localeCompare` ("P10" before "P3"). I fixed the expectation. The two new files then passed (7 tests).
- `pnpm typecheck`: clean.
- `pnpm -s i18n:todo` after stamping: `{}`.
- Query plan on production Neon (`EXPLAIN ANALYZE` of the SELECT, for the alliance with the most might on the newest day): 70 ms on a cold cache.
  - `daily_rosters` has 320 rows, so Postgres seq-scans it for the outer query (135 rows kept).
  - The inner aggregate of the alliance's own uids uses `daily_rosters_union_idx` (16 rosters, 1,574 uids).
  - As the table grows, the planner can use `daily_rosters_day_union_unique` (leading `read_day`) and the GIN index `daily_rosters_member_uids_idx`.
- After the rebase onto `dev` with #843:
  - `pnpm vitest related --run`: 191 files, 1131 tests passed.
  - `pnpm check`: green. 408 test files passed and 2 were skipped (2233 tests). Lint, types, drift and i18n (17 languages up to date) passed. Before the commit, the pre-commit hook had failed once on prettier and on `max-lines-per-function` in the page. The fix moved the link builder into `pageHref` and `tabOf` at module level.
- After the review fixes on PR 845 (no cache entry for unknown ids, the D89 amendment, the shared subquery condition, the e2e query string):
  - `pnpm vitest related --run`: 31 files, 179 tests passed.
  - `pnpm check`: green. 408 test files passed and 2 were skipped (2234 tests).
- Not run: the e2e suite and a rendered check at 360/640/1280 px. No local Postgres was running.

## Open issues

- A uid listed in two alliances on the same day goes to the roster read later (`placeMembers`), so a move between the two reads can name the wrong side for that day.
- When a daily read is missed, the change shows on the next day that has a roster. The 30-day window starts at the first roster inside it, so a change between the last roster before the window and the first one inside it is not counted.
- The design persona review of the tab has not been done.

## Next

- Design persona review of the tab at 360, 640 and 1280 px, light and dark, with real data.
- Issue 824 (player page) can reuse `moveText` if its History tab shows alliance changes.

What was missing from the task prompt? Whether "tracked alliance" means the day's tracked set of 20 or any alliance with a daily roster that day, and whether the tab badge shows the net of 7 or of 30 days.

PR: (added by the orchestrator)
