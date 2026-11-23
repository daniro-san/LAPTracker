# feat/713-post-catalog: a catalog of optional posts, and post 1 "This week in the alliance"

Part of #713 (part C). Size M: a migration, a new decision, a new route, a new Discord post and a second tick → `lib/private` import. Decision: D159. Migration: `0075_post_catalog`.

## Built

- `lib/post-catalog.ts` (pure): `POST_CATALOG`, one entry per post: owner feature, server weekday, audience, allowed channels, editable parts (weekday, picture). Also `POST_TITLE_LIMIT` (80), `postPeriod`, `postsMayBeDue` and `POST_FEATURES`.
- `lib/schema-discord.ts`:
  - `CATALOG_POSTS` (`week`).
  - `workspace_posts`: per workspace and post, the switch (`on`, default false), channel, weekday, title, picture, language and who saved it.
  - `post_runs`: the claim per workspace, post and period, with status `posting`, `posted`, `failed` or `unanswered`, plus `sent` and `attempts`.
  - `POST_KEYS` gains `week`, so D156's line applies to the post.
  - Migration `drizzle/0075_post_catalog.sql` (generated).
- `lib/repo/workspace-posts.ts`:
  - `postsOf`;
  - `savePost`, which writes nothing when the values are the same and returns the row before the save;
  - `postsDue`;
  - `claimPostRun` (INVARIANT `posts.once-per-period`: one statement, retakes only a `failed` claim with `sent = 0`, up to 3 attempts);
  - `finishPostRun`.
- Owner layer: feature `post_week` in D134's Discord group. It is free, so allowed by default (OGs too), with an /admin label. It is left out of the Features card and of `allianceFeatureInput`.
- `lib/private/catalog-posts.ts`, `sendDuePosts`, does the work in this order:
  1. the clock (Monday, server day);
  2. the posts due;
  3. per workspace: the owner's layer, the channel through `noticeChannels` (with the site fallback), the week's calendar via `calendarRows` and `layOut`, the claim;
  4. `discordMessages` with D156's line as `lead`, sent through `postMessages` (forum `thread_name`, `allowed_mentions: {parse: []}`);
  5. the outcome. The log carries counts only, and errors are reported as `w.posts.send_failed`.
- `weekText`: the entries marked for members, the Alliance Duel theme first, then the days ("Monday, November 23" / "18:00 ST · Cheese Trap I · Lv.7"). Entry names come from the calendar's own `titleOf` and `stOf`, in the post's language. No seats, notes, links or roster fields. An officer's title and entry names go through `breakLinks`.
- `lib/post-callout.ts`: `breakLinks` split out of `discordCallout`, with no change in output.
- `lib/posts-tick.ts`: `schedulePostsTick`. The clock comes first, then it runs in `after()` on its own connection. It is called by `app/api/tick/route.ts` after `runTick`, so only on a tick that already opened the database. An ESLint zone lets it import only `lib/private/catalog-posts.ts`.
- `lib/private/post-settings.ts`:
  - `postsView`: the allowed posts, the channel names from the webhook views, the day in the officer's words, and the window `00:00`–`sendBy` (the end of the first heartbeat slot after 00:00 ST, 01:15 with ST at UTC−2);
  - `savePostFor`: the owner's layer, the catalog's channels, the title cleaned and at most 80 graphemes, 30 saves per 15 minutes; it returns `turn_on`, `turn_off`, `save` or none.
- Route `POST /api/w/[slug]/posts`: officers only, same origin; 403 `not_allowed`, 400 `bad_channel` / `too_long`, 429. It sends `ws_action` `posts` with `post`. Fixture added in `member-session.test.ts`.
- Card `app/(private)/_ui/PostCatalog.tsx` in Alliance settings, after Discord:
  - per post: name, what it holds, the "Post it" switch, "Next post" right under it, Channel, Day, Title with count, Language;
  - one Save;
  - an index row "Posts · n of m on";
  - copy in `lib/private/dictionary.posts.ts` (EN, PT-BR, FR), plus `switches.name.post_week` and the `posts.csv` README line.
- "Your line on our posts" lists "This week in the alliance" while the owner allows it, and Home's activity words for it are added.
- D125: `workspace_posts` is downloaded as `posts.csv` and deleted; `post_runs` is deleted and never downloaded. Both are seeded in `lib/workspace-seed-parts.test-helpers.ts`.
- Analytics: `DESK_FEATURES` gains `posts`, and `ws_action` gains `post` (closed list `DESK_POSTS`). Tracking plan row and Changed line added.
- Docs:
  - D159 and its index line;
  - dated amendments to D125, D129, D134, D141 and D156;
  - the exception lists in REVIEW.md, `.claude/rules/private.md` and docs/ARCHITECTURE.md.
- Tests:
  - `lib/private/catalog-posts.test.ts` (5);
  - `app/api/tick/posts.test.ts` (1);
  - `app/(private)/_ui/PostCatalog.test.ts` (3);
  - `e2e/desk-posts.spec.ts` (1, phone);
  - updated to the new behaviour: `settings-index.test.ts`, `data-export/route.test.ts`.
- Review round (PR 761):
  - #6: `sendWeek` builds the title, the D156 line and the messages first and claims right before the send, so a build that throws leaves no claim.
  - #5: a week with no entry for members is settled (`post_runs.status` `skipped`, migration 0075 regenerated; still unreleased), so later Monday ticks stop at `postsDue`. A post the owner does not allow (1 read) or a channel with no webhook (2 reads) stays unsettled, so allowing it or pasting the webhook later that day still sends.
  - #7: `sendDuePosts(db, deps, deadline)`. `schedulePostsTick` gives the posts 120 s from the answer (`POSTS_BUDGET_MS`), and a workspace starts only while 45 s are left (`POST_START_MS`).
  - #9: the title help names our title in the post's language (`PostView.defaultTitles`).
  - #10: `postPeriod`'s unused `weekday` parameter removed.
  - #2, #3: docs/ARCHITECTURE.md's enforcement row says two exceptions, and a Features row for the catalog posts was added. D71 has a dated amendment for the second exception, and D159 lists D71 among the decisions it amends.
  - Tests:
    - #4: in `lib/private/catalog-posts.test.ts`, an empty week posts nothing and is settled, and the D156 line sits above the title;
    - #6: a build that throws leaves the week to the next tick;
    - #7: a deadline in reach starts no send;
    - #8: a partly delivered send (`failed`, `sent = 1`) is never taken again;
    - #1: new `app/(private)/api/w/[slug]/posts/route.test.ts` covers 403, 400 `bad_channel` (a catalog entry narrowed to the leaders' channel in the test, since post 1 offers both), 400 `too_long`, 401, 429, and the events with `post`, none for the same values, never the title. `features/route.test.ts` checks that `post_week` is not listed and is refused.

## Decisions

- The owner's layer reuses D134's feature switches (`post_week`), so /admin and "Defaults for new alliances" carry it without new UI. The alliance's layer is `workspace_posts.on`, not `alliance_switches`. That keeps every post off for every alliance, OGs included, as the owner asked.
- The tick sends from `lib/private/catalog-posts.ts` through a second fenced import, like D148. This reuses the calendar's words in three languages, the notice channels with their site fallback, and the notices' split-and-send loop with the forum title, instead of copying them into `lib/`.
- Only entries marked "Members can see this" are posted, the members' board's rule (D105). Posting every entry to the members' channel would leak leadership-only plans.
- Officers pick the post's language (EN, PT-BR, FR), as D137's summary does: the tick has no officer whose language it could use.
- No empty post: a week with no entry for members posts nothing and is settled as `skipped` (review #5), so an entry added later that Monday does not post that week.
- Retry: only a send Discord refused with nothing posted, up to 3 times. A send Discord never answered is `unanswered` and is never retried (persona check, adversarial).
- When it goes: Monday, at the first tick that opens the database. That is the squads queue's tick after Sunday's read, or at the latest the 01:00 ST heartbeat. The gate (`tickMayBeDue`) is not widened.

## Deviations

- The task's example preview "Every Monday, 00:10 ST" became "Every Monday, between 00:00 and 01:15 ST, in #channel.": no tick runs at a fixed 00:10, and the honest bound is the heartbeat.
- Language of the post is an editable part the task did not list (see Decisions).
- `weekday` and `picture` are stored columns, but post 1 lets officers change neither (the catalog says so), and the route does not take them yet.
- The e2e cannot drive the tick: the e2e server runs on the real clock, and a tick only opens the database when something is due. The tick step is proven by `app/api/tick/posts.test.ts`, which calls `POST /api/tick` on a Monday with the webhook stubbed. The e2e covers turning it on, the next-post line and the reload.

## Verified

- `pnpm vitest related --run <changed files>`: 234 files, 1,290 tests passed before the persona round; after it, 122 files, 682 tests passed.
- `pnpm check` on the final tree: passed (377 test files passed, 2 skipped; 2,010 tests passed, 4 skipped; no migration drift; i18n up to date).
- Mutation proofs, each reverted:
  - without the claim, the once test fails;
  - without the owner's layer, the switch test fails;
  - with notes added to a line, the sentinel test fails;
  - without the route's `schedulePostsTick`, the tick test fails;
  - with `post_runs` dropped from `WORKSPACE_TABLES`, the purge scan fails naming `post_runs`.
- E2E on my own Postgres 18 instance (`127.0.0.1:54391/lap_e2e_713`, password auth) and ports (app 3577, bridge 54477, https 3578, stub 3579):
  - before the persona round: full suite 103 passed, 11 skipped, no `e2e-outbound.log`;
  - after it, on a fresh build: `e2e/desk-posts.spec.ts` passed on phone.
  - Both servers and the instance were stopped afterwards.
- Review round (PR 761), on the rebased branch:
  - `pnpm vitest related --run <changed files>`: 55 files, 313 tests passed;
  - `pnpm check`: passed (378 test files passed, 2 skipped; 2,020 tests passed, 4 skipped; no migration drift; i18n up to date);
  - e2e on a fresh build, same instance and ports: `desk-posts.spec.ts` and `desk-callout.spec.ts` passed on phone (wide skipped by design), no `e2e-outbound.log`; servers and instance stopped;
  - mutation proofs, each reverted: claiming before the build fails only the throwing-build test; sending an event for an unchanged save fails the route's analytics test.
- Persona check at 360 × 780 (three officers, a product strategist, an adversarial reviewer), recorded in D159 § Persona check. Adopted:
  - "Next post" moved right under the switch, with the no-webhook state in yarn;
  - "No player names";
  - "Next post" in body size and full contrast;
  - no retry after an unanswered send.

## Open issues

- The new-alliance guide (outside the repo) needs a screenshot of Alliance settings → Posts after this release (CONTRIBUTING, "The new-alliance guide").
- PostHog: no insight uses `ws_action` `posts` yet; nothing to change there.

## Next

- Post 2, Shield-up reminder: Friday, 3 h before the night check, members' channel, no names or counts (issue 713 part G).
- Post 3, Welcome new members: daily when today's and yesterday's reads both succeeded; names who joined, never who left, a count above 15 (part D).
- Post 4, Weekly members summary: Monday, leaders' channel; member count, joined and left as counts, might change, days with no read named, never 0; no coin or quest totals (part F).
- Post 5, KvK recap: Saturday after End, members' channel; totals and top 3 kill gains, thanks first, no bottom list (part E).
- Each of 2–5 adds a `CATALOG_POSTS` key, a `POST_CATALOG` entry, its `post_*` feature, `DESK_POSTS` and the check constraints (a migration), and its sender in `lib/private/catalog-posts.ts`. A post whose day can change also widens `postsMayBeDue` and lets the route take `weekday`.
- From the persona check:
  - a `channel_ready` property on `posts` / `save`;
  - a post (or an edit) for entries added mid-week;
  - a message preview on the card;
  - the officer's own time beside ST;
  - a "last posted" line on the card;
  - Home's activity line for a post's settings.

What was missing from the task prompt? Which language the post is written in (the tick has no officer), and whether entries not marked for members may reach the members' channel.

PR: (added by the orchestrator)
