# feat/713-post-shield-reminder: catalog post 2, the "Shield-up reminder"

Part of #713 (part G). Size S–M: a catalog entry, a migration that widens two checks, a feature key, copy in three languages. Decision: D159 amendment 2026-11-23 (issue 713 part G). Migration: `0076_post_shield_up`.

## Built

- `lib/post-catalog.ts`:
  - `CatalogEntry.from`: the earliest server time on the post's day. Post 1 is `00:00`.
  - Entry `shield_up`: feature `post_shield_up`, weekday 4 (Friday), `from` = `NIGHT_MINUTE` − 3 h = 20:30 ST, audience and only channel `members`.
  - `postPeriod` is due only from `from`, so `postsMayBeDue` follows.
- `lib/schema-discord.ts`: `CATALOG_POSTS` gains `shield_up`. The `post_key` checks of `workspace_posts` and `workspace_post_touches` allow it. Migration `drizzle/0076_post_shield_up.sql` was generated with `drizzle-kit generate`. It was not applied to Neon.
- Owner layer: `post_shield_up` in D134's Discord group, allowed by default like `post_week`. Added the /admin label "Post: Shield-up reminder (off until the alliance turns it on)" and `switches.name.post_shield_up` (EN, PT-BR, FR).
- `lib/private/catalog-posts.ts`:
  - `sendDuePosts` loops over `CATALOG_POSTS`, each with its own period.
  - `sendWeek` became `sendPost`, with a per-post text builder (`BODIES`). The shield-up text is fixed words in the post's language and reads nothing.
  - `postTitle(post, title, t)` uses each post's default title.
  - Log codes are `posts.<post>.*`.
- `lib/private/post-settings.ts`:
  - `sendBy(cfg, day, from)` returns the end of the first :00/:15/:30/:45 tick slot at or after `from` where `tickClockDue` opens the database. That gives 20:45 for post 2 and 01:15 for post 1, as before.
  - `postsView` takes the full `ScheduleConfig` (the page already passed `env`) and uses `entry.from`.
- `lib/private/post-callouts.ts`: any catalog post the owner allows gets a "Your line on our posts" row, not only `week`.
- Copy in `lib/private/dictionary.posts.ts` (EN, PT-BR, FR):
  - `posts.shield_up.name`, `.what`, `.defaultTitle`, `.body`, `.day`;
  - `callouts.post.shield_up`, `callouts.where.shield_up`, `activity.callout.shield_up`;
  - `posts.day.fixed` is now per post: `posts.week.day` (same text) and `posts.shield_up.day`.
- `PostCatalog.tsx`: the day line reads `posts.<post>.day`.
- Analytics: `DESK_POSTS` gains `shield_up`. Tracking plan row and Changed line (2026-11-23).
- Docs: D159 amendment 2026-11-23 (issue 713 part G).
- Tests:
  - `lib/private/catalog-posts.test.ts` (+4):
    - sent once on Friday from 20:30 ST, through overlapping ticks, with `shield_check` off;
    - nothing at 20:15 ST, on Thu or Mon, or after the reset;
    - nothing while off or not allowed, and nothing claimed;
    - the sentinel scan (names, pings, any number but 00:00, with a positive control) in PT-BR;
    - the card's bound, 20:45 and 01:15.
  - `app/api/tick/posts.test.ts` (+1): `POST /api/tick` at Fri 20:15 ST sends nothing, 20:30 ST sends after the answer, 20:45 ST answers 204.
  - `PostCatalog.test.ts` (+1): the reminder's group, its day line and next-post line, and the members' channel only.
  - `e2e/desk-posts.spec.ts`: the index assertion now reads "Posts 1 of 2 on".

## Decisions

- Key `shield_up`, not `shield`. `POST_KEYS` already holds `shield` for the Raid Shield summary's line (D156), so a catalog post named `shield` would share that line and its row. The analytics value follows the key: `shield_up`.
- Time: 20:30 ST, the night check's 23:30 ST minus 3 h, computed from `NIGHT_MINUTE`. The Friday check (`QUOTA_CHECK_AT` "fri 20:00", 45 min window) already opens the database at 20:30 ST, so no new wake is needed (D141). If that tick is lost, these send it: the 22:00 ST heartbeat, or the night check from 23:30 ST. After 00:00 ST it is Saturday, so the reminder is not sent.
- Only the members' channel is offered. The task named that audience, and the post is for members.
- The reminder reads no member data, so it cannot name or count anyone, whatever the data says.

## Deviations

- Analytics value `shield_up` instead of the task's `shield`. Reason: the key collision in Decisions.
- A migration was needed. The `post_key` check constraints list the keys, so the existing tables could not take a new key without one.
- `sendBy` now derives the bound from `tickClockDue` instead of the heartbeat alone. Post 1's output is unchanged (01:15, tested).

## Verified

- `pnpm vitest related --run <changed files>`: 234 files, 1,301 tests passed.
- `pnpm check`: passed. 378 test files passed and 2 skipped; 2,026 tests passed and 4 skipped; no migration drift; i18n up to date.
- Mutation proofs, each reverted:
  - without the `from` check in `postPeriod`, the sender's once test and the tick test fail;
  - without the owner's layer, both switch tests fail;
  - with "12 of you" in the body, the sentinel test fails;
  - without the claim's check, both once tests fail;
  - with the day line hard-coded to post 1's, the card test fails.
- E2E not run. It needs a local Postgres instance and a built server. The only e2e change is the index count string ("1 of 2 on"), which follows from a second allowed post.
- Persona check (text only, no screenshot of the running page): two officers and a D75 reviewer, recorded in the D159 amendment. Adopted:
  - "tonight" removed: at 20:30 ST it is morning for some members;
  - D137's "make sure your shield is on" instead of "turn on your shield": some members already have one.

## Open issues

- Migration 0076 must be applied with the release (it only widens two checks).
- The new-alliance guide (outside the repo) may want the Posts card's new row in its screenshot after release.
- The e2e suite should be run once on this branch before merge (`e2e/desk-posts.spec.ts` on phone).

## Next

- Posts 3–5 (issue 713 parts D, F, E), as listed in `feat-713-post-catalog.md` § Next. Each now also sets `from` and a `BODIES` entry.
- Follow-up: the card could hide the Channel select when a post offers one channel. Not done here.

What was missing from the task prompt? That `shield` is already a `POST_KEYS` value (the Raid Shield summary's line), so the catalog key and analytics value had to differ; and that a migration is needed because the `post_key` checks list the keys.

PR: (added by the orchestrator)
