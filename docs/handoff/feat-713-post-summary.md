# feat/713-post-summary: catalog post 4, "Weekly members summary"

Part of #713 (part F). Size S–M: a catalog entry, a migration that widens two checks, a feature key, a repo read of uids, copy in three languages. Decision: D159 amendment 2026-11-23 (issue 713 part F), plus one-line amendments to D71 and D141. Migration: `0078_post_summary`.

## Built

- `lib/post-catalog.ts`: entry `summary`, feature `post_summary`, weekday 0 (Monday), from 00:00 ST, audience and only channel `leaders`.
- `lib/schema-discord.ts`: `CATALOG_POSTS` gains `summary`. The `post_key` checks of `workspace_posts` and `workspace_post_touches` allow it. Migration `drizzle/0078_post_summary.sql` was generated with `pnpm db:generate`. It was not applied to Neon.
- `lib/repo/daily-reads.ts`: `freshUidsBetween(db, unionId, from, to)` returns `{day, uids}` of the alliance's usable rosters (fresh, no error, not empty), oldest first. It selects `member_uids` and `read_day` only.
- `lib/private/catalog-posts.ts`: `summaryText(rosters, monday, language)` and the `summary` body. It reads 14 days of uids (the week and the 7 days before it).
  - Joined and left are counted between each usable roster and the one before it, as Insights' membership flow counts them.
  - The base is the last usable roster before the week (at most 7 days before); the end is the week's last usable roster. Both member counts carry their date.
  - A last line says from how many of the week's 7 days it counted.
  - With no base or no roster in the week: `null`, so the week is settled as `skipped`.
- Owner layer: `post_summary` in D134's Discord group, allowed by default. /admin label "Post: Weekly members summary (off until the alliance turns it on)", and `switches.name.post_summary` in EN, PT-BR and FR.
- Copy in `lib/private/dictionary.posts.ts` (EN, PT-BR, FR): `posts.summary.name`, `.what`, `.defaultTitle`, `.week`, `.joined`, `.left`, `.members`, `.reads`, `.day`; `callouts.post.summary`, `callouts.where.summary`, `activity.callout.summary`.
- `lib/private/post-callouts.ts`: the summary's default title in "Your line on our posts".
- Analytics: `DESK_POSTS` gains `summary`. Tracking plan row and dated Changed line.
- Comments and checklists that list the catalog posts: `lib/posts-tick.ts`, `app/api/tick/route.ts`, `eslint.config.mjs`, `.claude/rules/private.md`, `REVIEW.md`.
- `e2e/desk-posts.spec.ts`: the index reads "Posts 1 of 4 on".
- Tests: new `lib/private/catalog-posts-summary.test.ts` (5).

## Decisions

- **Schedule: Monday from 00:00 ST, the same as post 1.** The week (Monday to Sunday) ends with Sunday's daily read at 23:30 ST (D72), and its automatic retry ends before midnight. So on Monday at 00:00 ST the week is complete. The first tick that opens the database on Monday sends it: the squads queue's tick after Sunday's read, or at the latest the 01:00 ST heartbeat. The card reads "Every Monday, between 00:00 and 01:15 ST, in #channel." This adds no wake (D141), and Insights' "Joined and left, week by week" uses the same Monday-to-Sunday weeks, so the numbers match what officers see there.
- **Counts: joined, left, members at two dated daily updates, and coverage.** The task asked for joined, left and now vs a week ago. I did not add other counts. The other weekly counts in lib/private (Insights' pulse, effort, quiet) use daily_tech, daily_honor and active, which the task excludes.
- **Dated member counts instead of "now" and "a week ago".** If Sunday's read failed, the end is an earlier day of the week. The line then says that day, never a wrong "now".
- **Pairwise counting.** Someone who joined and left inside the week counts in both, as Insights' membership flow counts them. A change across a day with no usable roster shows on the next one.
- **Nothing to compare: settled as `skipped`.** No usable roster in the week, or none in the 7 days before it (for example an alliance's first week). Neither changes later on Monday, so the week is not looked at again.
- **No running check on the daily read.** A roster row is written whole per alliance, and on Monday Sunday's read is over. Post 3 needs the check because it runs during the read's window.
- **Uids only.** The read selects `member_uids` and the day, never `member_names` or `raw_json`. No name can reach the text.
- **Title:** "Members last week" ("Membros na semana passada", "Les membres la semaine dernière").

## Deviations

- None from the task's list. No D-number: an amendment to D159 (plus one line each in D71 and D141) was enough.
- No tick-level case in `app/api/tick/posts.test.ts`, as for post 3: the sender tests cover the Monday ticks directly.

## Verified

- `pnpm vitest related --run <changed files>`: 238 files, 1,320 tests passed.
- `pnpm check`: passed. 380 test files passed and 2 skipped; 2,039 tests passed and 4 skipped; no migration drift; i18n up to date.
- Mutation proofs, each reverted:
  - reading 21 days instead of 14 (a base older than 7 days): the nothing-to-compare test fails;
  - counting only base against end instead of each pair: 2 tests fail. The first version of the test data did not catch this; the week now has a member who joins Monday and leaves Wednesday.
- E2E not run. It needs a local Postgres instance and a built server. The only e2e change is the index count string.
- No persona check was run on the wording.

## Open issues

- Migration 0078 must be applied with the release. It only widens two checks.
- Run the e2e suite once on this branch before merge (`e2e/desk-posts.spec.ts` on phone).
- The card's lead ("They ping no one, and only the welcome names anyone") is still true and was not changed.

## Next

- Post 5, KvK recap (issue 713 part E).
- Follow-up: a persona check of the summary's Discord text in PT-BR and FR (line labels such as "Membres le dim. 29 nov. : 4").
- Follow-up, if officers ask: a link from the summary to Insights' membership flow for the names.

What was missing from the task prompt? Whether "now vs a week ago" must be exactly the two Sundays, and what to post when a Sunday read failed. I used the dated last usable roster on each side (at most 7 days before the week) and settled the week when either is missing.

PR: (added by the orchestrator)
