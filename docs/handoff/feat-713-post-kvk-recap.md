# feat/713-post-kvk-recap: catalog post 5, "KvK recap"

Part of #713 (part E), the last of the five catalog posts. Size S–M: a catalog entry with a new kind of day and time, a migration that widens two checks, a feature key, one repo read, copy in three languages. Decision: D159 amendment 2026-11-23 (issue 713 part E), plus one-line amendments to D71 and D141. Migration: `0079_post_kvk`.

## Built

- `lib/post-catalog.ts`: entry `kvk`, feature `post_kvk`, audience and only channel `members`. A catalog entry's `weekday` may now be `event` (the scheduled event's `EVENT_WEEKDAY`, through `weekdayOf`) and its `from` may be `after` (`SNAPSHOT_AFTER`, through `fromOf`). `KVK_TOP = 3`. `postPeriod` and `postsMayBeDue` take `PostClock` (adds `EVENT_WEEKDAY` and `SNAPSHOT_AFTER`).
- `lib/schema-discord.ts`: `CATALOG_POSTS` gains `kvk`; the `post_key` checks of `workspace_posts` and `workspace_post_touches` allow it. Migration `drizzle/0079_post_kvk.sql` was generated with `pnpm db:generate`. It was not applied to Neon.
- `lib/repo/workspace-rosters.ts`: `recapKills(db, unionId, from, to)`. It finds the public scheduled event in the KvK's server day and its End's status, then reads uid, name and kills of the alliance's usable Start and End `member_snapshots` rows. It returns undefined while the End has no row or is running, and null when there is nothing usable.
- `lib/private/catalog-posts.ts`: `kvkText(before, after, language)` and the `kvk` body. `BODIES` now also receives the env (for the server day's bounds). `PostsDeps.env` adds `EVENT_WEEKDAY` and `SNAPSHOT_AFTER`.
- `lib/private/post-settings.ts`: the card's weekday comes from `weekdayOf`.
- `app/(private)/_ui/PostCatalog.tsx`: a post on the event's weekday uses `posts.whenKvk` ("After each KvK (Saturday), between 14:00 and 14:15 ST, in #general.").
- Owner layer: `post_kvk` in D134's Discord group, allowed by default. /admin label "Post: KvK recap (off until the alliance turns it on)", and `switches.name.post_kvk` in EN, PT-BR and FR.
- Copy in `lib/private/dictionary.posts.ts` (EN, PT-BR, FR): `posts.kvk.*`, `posts.whenKvk`, `callouts.post.kvk`, `callouts.where.kvk`, `activity.callout.kvk`. The card's lead now names two posts that name anyone (the welcome; the recap's top 3).
- `lib/private/post-callouts.ts`: the recap's default title in "Your line on our posts".
- Analytics: `DESK_POSTS` gains `kvk`. Tracking plan row and a dated Changed line.
- Comments and checklists that list the catalog posts: `lib/posts-tick.ts`, `app/api/tick/route.ts`, `eslint.config.mjs`, `.claude/rules/private.md`, `REVIEW.md`.
- `e2e/desk-posts.spec.ts`: the index reads "Posts 1 of 5 on".
- Tests: new `lib/private/catalog-posts-kvk.test.ts` (9) and one case in `app/(private)/_ui/PostCatalog.test.ts`.

## Decisions

- **Data: the event page's War turnout (#271), no new metric.** The recap reads the alliance's Start and End `member_snapshots` of the scheduled event (the KvK's own reads, D69) and runs `killsTurnout` from `lib/compute.ts`, the function behind the public "War turnout". Totals: kills gained by the members in both rosters, members with kills gained, and how many members were in both. A kill gain is `killsGain`: a fall counts as none and a null as 0 (D15, D83). The matchup's "Start to End" (D152) and Kill share also use this rule, so a joiner's lifetime kills never count.
- **Top 3: the first three of `killsTurnout`'s gainers**, biggest gain first, a tie to the lower uid, with the End roster's public name and the gain in compact form. The event page already shows members' kills gains by name.
- **Not used:** might (a KvK costs might, and Insights shows that for help, D139, not for a celebration); the alliance's total kills change (it counts joiners); the opponent and its win/loss result (admin-only, D152); samples.
- **No bottom list, no blame.** No one who gained nothing, lost kills, joined or left is named. The only figure about the rest is the War turnout's "4 of 5", as the public page shows it. A closing line thanks defenders and support players, who gain no kills (the wording of D83's help text).
- **When: the KvK's day (`EVENT_WEEKDAY`) from `SNAPSHOT_AFTER`.** The End's own ticks open the database by the clock (`tickClockDue`'s scheduled span), and the End runs in the tick's body before `schedulePostsTick`, so the recap usually goes in the End's own tick. No wake is added (D141). The period is the KvK's server day, so one recap per KvK at most (`post_runs`).
- **How the app knows the KvK ended:** the event's `after` snapshot row has a status other than `running`. The tick runs each phase once (`duePhases`: the earliest window without a row), so a finished End does not change later. While it has no row or is running, nothing is sent or settled, and a later tick that day looks again.
- **Channel: members**, the only one offered. It is a thank-you to everyone, like posts 2 and 3.
- **Missing data:** no public scheduled event that day, the alliance's Start or End row missing, stale or failed, or nobody with kills gained. Each posts nothing and settles the KvK as `skipped`, like post 4.
- **Card line: "After each KvK (Saturday), between 14:00 and 14:15 ST".** "Every Saturday" (the shared `posts.when`) would promise a post in a week with no KvK, and PT-BR's "Toda {day}" does not agree with "sábado". So the recap has its own `posts.whenKvk`. The window's end is `sendBy`'s first database-opening slot after `SNAPSHOT_AFTER`, the same rule as posts 1, 2 and 4.
- **Words:** "Kills" as on the public pages (EN "Kills gained", PT-BR "kills ganhos", FR "Kills gagnés"), not "abates" or "éliminations". FR uses no-break spaces before `:`, `;` and `!`.
- **Where the read lives:** `lib/repo/workspace-rosters.ts`, beside `scheduledEventKills`. That function was not reused: it does not say whether the End is still running and does not return names.

## Deviations

- None from the task's list. No D-number: an amendment to D159, plus one line each in D71 and D141, was enough.
- `PostCatalog.tsx` changed (not in post 4's file list), for `posts.whenKvk`, with one card test.
- No tick-level case in `app/api/tick/posts.test.ts`, as for posts 3 and 4: the sender tests drive the KvK day's ticks directly.

## Verified

- `pnpm vitest run lib/private/catalog-posts-kvk.test.ts "app/(private)/_ui/PostCatalog.test.ts"`: 12 tests passed.
- `pnpm vitest related --run <changed files>`: 239 files, 1,336 tests passed.
- `pnpm check`: passed. 381 test files passed and 2 skipped; 2,046 tests passed and 4 skipped; no migration drift; i18n up to date.
- Mutation proofs, each reverted: `KVK_TOP = 4` (2 tests fail, the sentinel scan among them); treating a `running` End as finished (1 fails); dropping the fresh check on the alliance's rows (1 fails). After the PR 769 review, three skip cases were added (no event that day, no Start row, no member with kills gained). Each fails when its branch is broken: no event returning undefined, a missing row returning undefined, and dropping the no-gainers check.
- E2E not run. It needs a local Postgres instance and a built server. The only e2e change is the index count string.
- No persona check was run on the wording.

## Open issues

- Migration 0079 must be applied with the release. It only widens two checks.
- Run the e2e suite once on this branch before merge (`e2e/desk-posts.spec.ts`).
- An End that an admin re-runs by hand after it finished does not post again: the KvK was already settled or posted.

## Next

- Follow-up: a persona check of the recap's Discord text in EN, PT-BR and FR (thanks-first tone, the "4 of 5" line, the support line).
- Follow-up, if officers ask: a link from the recap to the event page's alliance view.
- Issue 713: all five catalog posts are built; the issue can close once this PR merges.

What was missing from the task prompt? Whether "the alliance's totals" includes might (it does not: a KvK lowers might, which does not fit a celebration) and whether the "n of m" turnout figure counts as naming anyone negatively (it names no one; I kept it as the public War turnout shows it).

PR: (added by the orchestrator)
