# 08o — One Discord message per channel per event

## Built
- Migration `0006_tranquil_black_bolt.sql`: `events.discord_public_message_id`, `events.discord_admin_message_id` (text, nullable). `EventInfo` carries both; `setDiscordMessageId` in `lib/repo/events.ts`.
- `lib/discord-send.ts` (new): `sendOrEdit`. Edits when it has an id (`PATCH <webhook>/messages/<id>`), else posts with `?wait=true` and returns the id.
- `lib/notify.ts`: `Notifier.public` and `Notifier.admin` take an optional message id and return the id to store. New `adminEventMessage(name, blocks)`. `publicSnapshotMessage` takes `beforeAt` and adds "Before snapshot done at …" on the After.
- `lib/run-notify.ts` (new, moved out of `lib/run.ts`): `notifyFinished` builds the whole event message each time, from this run plus the other phase's row (`listPhaseReports` in `lib/repo/snapshots.ts`), and stores the id.
- `lib/copy-discord.ts`: `public.beforeDone`, `admin.eventHeader`.
- Tests: `lib/notify-event-message.test.ts` (first post returns the id, next phase PATCHes, 404 posts again, other PATCH failure posts nothing, missing id returns null and logs without the URL, Saturday event text, manual round text); the rehearsal route test now expects one admin post, one edit with the verdict, and the stored id. The test helper's fake fetch behaves like Discord (ids, PATCH, 404 for unknown messages).
- `docs/DECISIONS.md` D31.

## Decisions
- Number D31 (D30 was the last).
- A failed PATCH that is not a 404 keeps the id and posts nothing, so a Discord outage does not create a second message per phase. The brief named only the 404 case.
- The other phase's admin block is rebuilt from its `snapshots` row: no failed/stale alliance lists and no run_logs write-failure line. The current phase keeps them.
- The 07f run block is reused unchanged, so a manual round's name appears in the header and in its run lines.
- Saturday events and manual rounds have the event name only in the admin header; the public embed keeps its title chip (no name line was added for Saturday events).
- `NOTIFY_ADMIN_MENTION` is untouched; an edit never pings, a new post still can.

## Deviations
- None from the design. Files `lib/discord-send.ts` and `lib/run-notify.ts` exist only because ESLint's file-length and complexity limits failed on the grown code.

## Verified
- `pnpm check` on Node 26: prettier, eslint, tsc and 135 tests pass (1 skipped as before).
- Not run: a real Discord post, a real event. Upstream API calls made: 0.

## Open issues
- Migration 0006 must be applied to Neon before the deployed code runs a phase (the new columns are selected on every run).
- A message edited after Discord's 2000-character limit would be cut; an event message is far below it.
- Editing does not notify anyone, so a failed After is easy to miss in a quiet channel; the owner dropped pings, so this is by design.

## Try it with a throwaway channel
1. In a private test channel create two webhooks (public and admin), or one for both.
2. In `.env.local` (not committed) set `NOTIFY_WEBHOOK_PUBLIC` and `NOTIFY_WEBHOOK_ADMIN` to those URLs; point `DATABASE_URL` at a Neon branch with migration 0006 applied (`pnpm db:migrate`).
3. Run the app locally, create a manual round on `/admin` with the Discord post on, press Before, then After. Costs about 21 upstream calls each, so use the test channel only when quota is fine, or use Rehearse for the admin message (same cost).
4. Expected: one message per channel, posted at Before and edited at After. Delete the message in Discord and run the After again to see the 404 fallback post a new one.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; the dry run reads measured numbers, which this change does not affect.
Owner must do first: merge this PR into `dev`, apply migration 0006 to the production database.
Plan change: SESSION_PLAYBOOK.md Session 9 task 1 (the `[TEST] Rehearsal PASS/FAIL` message): the verdict is now the last block of the rehearsal's single admin message, edited in place after the After, not a separate message.
<adjustments>
- Session 9 step 1: wait for the admin message to be edited (it gains the After block and the Pass/Fail verdict at its end) and paste that message. The edit does not notify.
- Rehearsal admin text starts `[rehearsal] **<event name>**`, not `[TEST]`.
</adjustments>
