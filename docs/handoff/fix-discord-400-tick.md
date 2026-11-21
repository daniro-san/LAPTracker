# fix: the Raid Shield summary was refused by Discord in a forum leaders' channel (400 on /api/tick)

## Built

- `lib/shield-post.ts`: `leadersHook` now returns the webhook URL and whether the channel is a forum. This comes from `workspace_webhooks.forum`, or from the `WORKSPACE_DISCORD_WEBHOOKS` fallback's `forum`.
  - In a forum, the first post carries `thread_name`: the message title without its `**` ("Raid Shield check", "Conferência do Escudo de raid", "Vérification du Bouclier de raid").
  - In a forum, the edit sends `?thread_id=<message id>`. The first message of a forum post has the post's own id.
- `lib/discord-send.ts`: `editOnly` takes an optional `threadId` and adds it to the PATCH URL as `?thread_id=`.
- `lib/shield-read.test.ts`: the webhook stub takes a `forum` option and answers 400 to a forum POST without `thread_name`, as Discord does. One new test checks two things:
  - the forum post is opened with the title;
  - the Saturday edit goes to `/messages/900?thread_id=900` and keeps the message id.

## Decisions

- Root cause, from production data (read-only SELECTs on Neon `main`):
  - `workspace_webhooks`: workspace 1, channel `leaders`, `forum = true`. The `members` channel is a forum too.
  - `shield_settings`: `discord = true`, updated 2026-11-21 04:58Z (02:58 ST Saturday). That is after Friday's night pass ended (00:00 ST), so the Saturday morning pass (10:00–12:00 ST) made the first post attempt.
  - `shield_checks` for day 2026-11-20 / union 67111155: `morning_status = done` (101 calls, 12:00:59Z–12:02:08Z), `message_id` NULL, `posted_at` NULL. No message was ever stored.
  - `deliver()` sent `{ content, allowed_mentions }` with no `thread_name`. Discord refuses this in a forum channel with a 400. Because no message id was stored, every tick in the window went through `sendOrEdit(…, null)` → `post`, which logs `notify.failed { http_status: 400 }`.
  - Notices, garrison and thanks already send `thread_name` for forums (`lib/private/notice-publish.ts`). Only the shield post did not.
- The size suspects are ruled out:
  - The roster of 2026-11-20 has 100 names. The longest has 18 characters, and all 100 together have 918.
  - The message lists at most 40 names (`NAMES_MAX`), so the content stays well under 2,000 characters. It has no embeds and no components.
  - The `allowed_mentions` shape is the same one the other webhook posts use.
- The forum post title is the existing title copy with the bold marks removed. No new copy string was added.

## Deviations

- The task suggested splitting or truncating an oversized message. The cause was not size, so nothing was truncated. The test uses invented names (`Wren1`…`Wren4`) through the existing fixture helper.

## Verified

- `pnpm vitest run lib/shield-read.test.ts`: 11 of 11 pass, including the new forum test.
- `pnpm check` (prettier, eslint, tsc, the full vitest run, drift and i18n checks) passes on this branch.

## Open issues

- Today's leaders got no Raid Shield message at all. Their channel never had one to go stale. Today's window closed at 12:00 ST, and this fix cannot post today's summary after the fact. The data is intact:
  - the morning pass finished `done`;
  - the readings are stored in `player_reads` before any post is tried;
  - the Raid prep page reads them, not Discord.
- Only two `notify.failed` lines were reported (11:30 and 11:45 ST). By the code path, every tick from 10:00 to 11:45 ST should have tried to post and logged one. I did not check Vercel's logs for 10:00–11:15 ST. The earlier lines are probably outside the log view that was reviewed.
- Follow-up, not done: in a forum, every week's summary opens a new post titled "Raid Shield check". Putting the date in the title would tell the weeks apart, but it needs a new copy string in three languages.
- Follow-up, not done: the test stubs of the other leaders-channel paths all use `forum: false`. That is how this case got past the tests.

## Next

- Model/effort: keep.
- Owner first: merge and deploy before next Friday 23:30 ST, when the night pass makes the next first post.
- Plan change: none.

<adjustments>
- Discord rule for every webhook writer: a forum channel's first post needs `thread_name`, and an edit of a message inside a forum post needs `?thread_id=` (for the first message, its own id). Both leaders and members channels of workspace 1 are forums.
</adjustments>

PR: (added by the orchestrator)
