# feat/713-post-welcome: catalog post 3, "Welcome new members"

Part of #713 (part D). Size S–M: a catalog entry, a migration that widens two checks, a feature key, a repo read, copy in three languages. Decision: D159 amendment 2026-11-23 (issue 713 part D), plus a one-line D71 amendment. Migration: `0077_post_welcome`.

## Built

- `lib/post-catalog.ts`:
  - `CatalogEntry.weekday` may be `null` (every day), and `from` may be `"read"` (the day's `DAILY_ROSTER_AT`). `fromOf(post, cfg)` resolves it.
  - `postPeriod` and `postsMayBeDue` take `DAILY_ROSTER_AT` too.
  - Entry `welcome`: feature `post_welcome`, every day from the daily read, audience and only channel `members`.
  - `WELCOME_NAMES_MAX` = 15.
- `lib/schema-discord.ts`: `CATALOG_POSTS` gains `welcome`. The `post_key` checks of `workspace_posts` and `workspace_post_touches` allow it. Migration `drizzle/0077_post_welcome.sql` was generated with `drizzle-kit generate`. It was not applied to Neon.
- `lib/repo/daily-reads.ts`: `freshRosterOfDay(db, day, unionId)` returns uids and names of a roster that has no error and is fresh, else null.
- `lib/repo/workspace-posts.ts`: `postsDue` also returns `unionId`.
- `lib/private/catalog-posts.ts`:
  - `welcomeText(names, language)`: names joined with `Intl.ListFormat`, each through `breakLinks`; a one-name form; a count above 15; null for none.
  - `joinersOf`: undefined until the day's `daily_reads` row is there and not `running` and both days' rosters are fresh; then the names in today's roster whose uid is not in yesterday's.
  - `BODIES` now take the `Due` row. A body may return `undefined` ("cannot tell yet"), which sends nothing and does not settle the period. `null` still settles it as `skipped`.
  - `PostsDeps.env` gains `DAILY_ROSTER_AT`.
- `lib/private/post-settings.ts`: `PostView.day` is `null` for a daily post. `from` comes from `fromOf`.
- `PostCatalog.tsx`: a daily post's next-post line uses `posts.whenDaily` ("Every day, between 23:30 and 00:00 ST, in #channel."); a post due from the read ends its window at 00:00 ST (review of PR 766).
- Owner layer: `post_welcome` in D134's Discord group, allowed by default. /admin label "Post: Welcome new members (off until the alliance turns it on)", and `switches.name.post_welcome` in EN, PT-BR and FR.
- Copy in `lib/private/dictionary.posts.ts` (EN, PT-BR, FR):
  - `posts.welcome.name`, `.what`, `.defaultTitle`, `.one`, `.names`, `.count`, `.day`;
  - `posts.whenDaily`;
  - `callouts.post.welcome`, `callouts.where.welcome`, `activity.callout.welcome`;
  - `posts.lead` now reads "They ping no one, and only the welcome names anyone: the members who just joined."
- `lib/private/post-callouts.ts`: the welcome's default title in "Your line on our posts".
- Analytics: `DESK_POSTS` gains `welcome`. Tracking plan row and dated Changed line (2026-11-23).
- Docs:
  - D159 amendment (post 3);
  - D71 amendment: the welcome names new members by public name;
  - `.claude/rules/private.md` and `REVIEW.md` lines for `lib/posts-tick.ts` now say the welcome names new members by public name.
- Tests:
  - new `lib/private/catalog-posts-welcome.test.ts` (5);
  - review of PR 766: `breakLinks` on a name (`evil.example`), the PT-BR one-name form, `postsView` with no weekday (23:30–00:00), and the card's daily line in `PostCatalog.test.ts`;
  - `app/api/tick/route.test.ts`: the 23:30 ST read tick now schedules two `after` tasks (squads, then posts);
  - `e2e/desk-posts.spec.ts`: the index reads "Posts 1 of 3 on".

## Decisions

- **Period and time.** The period is the daily read's server day. The post is due from `DAILY_ROSTER_AT` (23:30 ST) until 00:00 ST. The read runs in the body of the 23:30 ST tick, and `schedulePostsTick` runs after it, so the post sees the finished read. If the read fails at 23:30 and its automatic retry succeeds at 23:45, the 23:45 tick sends. No extra wake (D141): those ticks open the database by the clock.
- **"Read successfully".** The day's `daily_reads` row must be there and not `running`, and both rosters must have no error and `is_fresh`. A stale roster is refused because an older roster compared with yesterday's would show leavers as joiners.
- **Not settled when a read is missing.** A failed, stale or running read sends nothing and claims nothing, so a retry later in the window can still send that day's welcome. A day with no joiners is settled as `skipped`.
- **Names are escaped like post 1's entry names.** Each name goes through `breakLinks`, then `discordMessages` escapes markdown and breaks `@everyone`, `@here` and `<@`. `allowed_mentions` is `{parse: []}`.
- **A one-name form.** PT-BR needs "você" for one person and "vocês" for several, so the copy has `.one` and `.names`. EN and FR use the same text in both.
- **Card words.** "daily update" replaces "end-of-day read" in the card copy, because the glossary's UI word is "daily update".

## Deviations

- The task's test list does not include a tick-level test. I did not add a welcome case to `app/api/tick/posts.test.ts`. The existing tick test changed only its `after` count (see Built). The sender tests cover the 23:30 and 23:45 ST ticks directly.
- The card's bound for the welcome first read 23:30–23:45 ST (`sendBy`'s first slot). Review of PR 766: it now reads 23:30–00:00 ST, because the read's retry can send until midnight.

## Verified

- `pnpm vitest related --run <changed files>`: 237 files, 1,311 passed and 1 failed. The failure was `app/api/tick/route.test.ts`, which expected one `after` task at 23:30 ST. I updated it (see Built), and `app/api/tick` then passed 29 of 29.
- `pnpm check`: passed. 379 test files passed and 2 skipped; 2,031 tests passed and 4 skipped; no migration drift; i18n up to date.
- Mutation proofs, each reverted (`lib/private/catalog-posts-welcome.test.ts` and `catalog-posts.test.ts`):
  - without the `is_fresh` check, the failed/stale test fails;
  - without the `running` check, the same test fails;
  - with a missing yesterday treated as empty, the same test fails;
  - with a leaver added to the joiners, 4 tests fail;
  - with `>=` instead of `>` for the limit, the count test fails;
  - without the claim's check, the once tests of all three posts fail.
- E2E not run. It needs a local Postgres instance and a built server. The only e2e change is the index count string.
- Review round (PR 766):
  - findings 1–4 fixed: the tests above, the card's 00:00 ST bound, and the D141 amendment, the `lib/posts-tick.ts` header and the `eslint.config.mjs` zone comment now cover all catalog posts;
  - suggestion 4 (one `getDailyRead` per tick instead of per workspace) skipped: it is not a one-line move, because each workspace's body is built in its own call;
  - mutation proofs, each reverted: without `breakLinks` on names, without the one-name form, with the card's end from `sendBy`, and with the weekly line for a daily post, a test fails each time.
- Persona check on the wording (text only, no screenshot): two officers (EN as a second language; PT-BR, in her 50s) and a D75 reviewer, recorded in the D159 amendment. Adopted: "daily update" in the card copy.

## Open issues

- Migration 0077 must be applied with the release. It only widens two checks.
- The 23:30 ST tick now always schedules the posts' `after` task, every day, even when no workspace has the welcome on. The task costs one `postsDue` query on a database the read already woke.
- Run the e2e suite once on this branch before merge (`e2e/desk-posts.spec.ts` on phone).
- The new-alliance guide (outside the repo) may want the Posts card's new row in its screenshot after release.

## Next

- Posts 4 and 5 (issue 713 parts F and E). Post 4 can use `freshRosterOfDay` for its joined and left counts.
- Follow-up from the persona check: a member who joins on a day whose read failed is never welcomed later. Add a catch-up only if officers ask.
- Follow-up (review suggestion 4): read the day's `daily_reads` row once per tick, not once per workspace with the welcome on.
- Follow-up: a welcome case in `app/api/tick/posts.test.ts` (`POST /api/tick` at 23:30 ST with seeded rosters).

What was missing from the task prompt? Whether a stale roster (`is_fresh` false) counts as a successful read, and whether a day with a failed read should be settled or left open for the read's retry.

PR: (added by the orchestrator)
