# 08zl — Discord: escape typed text, no numbers when the detail read fails

## Built
- `lib/notify.ts`: `escapeDiscord(text)`, a module-local helper. It puts a backslash before `\ * _ ~ ` ` | > [ ]`, puts a zero-width space after the `@` of `@everyone` and `@here`, and after `<@` (user `<@id>` and role `<@&id>` mentions). Used on:
  - a manual round's name in the public message (`Manual round: {name}. Taken by hand.`);
  - the round's name in the admin run line (`manualRun`) and the event header of the admin message (`**{name}**`);
  - the alliance tag and the alliance name inside `allianceLabel`, which feeds the public stale line, the public movers lines, and the admin `failed` and `stale` lines. `allianceLabel` adds the brackets itself, so `[NSE] Natural Selection` comes out unchanged.
- `lib/notify.ts`: `PublicContext.alliances` is now `PublicAlliance[] | null`. Null means the event detail could not be read: `publicSnapshotMessage` then leaves out the `{good}/{total} alliances` line, the stale line and the movers blocks. It keeps the status chip (title), the manual-round line, the `Before snapshot done at …` line and the `Next update at …` line.
- `lib/run-notify.ts`: `notifyPublic` logs `console.error("notify.detail_failed", { event_id })` when `getEventDetail` throws, and passes `rowsOf(phase)` (null when there is no detail) instead of `?? []`. The message is still posted, or the stored one edited (D31).
- `lib/notify.test.ts`: one test. A round name and an alliance name of `**Win** @everyone <@123> [click](https://x.test)` come out escaped. An alliance with the tag `A_B` comes out as `[A\_B] …`, and `[NSE] Natural Selection` is unchanged.
- `lib/notify-event-message.test.ts`: one test. `notifyFinished` runs against a database whose `select` throws. The posted public embed's description is only `Next update at Sat, Nov 7, 14:00 server time`, and `notify.detail_failed` is logged with `{ event_id: 9 }`.

## Decisions
- Owner's recommended answers from the issue triage, taken as given: when the detail read fails, post without the count, stale and movers lines, and log `notify.detail_failed`. The alliance tag and name are escaped too, because players type them in game.
- Mentions use a zero-width space after the `@`, the same way discord.py's `escape_mentions` and discord.js's `cleanContent` do it. Webhook payloads already send `allowed_mentions: { parse: [] }` (public) or only the configured id (admin), so nothing pinged before this change. The escape stops `@everyone` and `<@id>` from showing as highlighted mentions.
- The backslash itself is escaped first. Without that, a name ending in `\` would cancel the escape of the character after it.
- `[` and `]` are escaped, so `[text](url)` no longer becomes a masked link. A bare URL is still auto-linked by Discord. It shows as its literal text, so it is not hidden behind other words.
- The helper stays inside `lib/notify.ts` (not exported). Every Discord text built from typed input is built in that file. `lib/run-notify.ts` builds no text of its own; it only passes `event.name` into the `lib/notify.ts` functions.
- `console.error`, not the run logger: the run logger writes to `run_logs` for the snapshot, and the other notify failures (`notify.failed`, `notify.no_message_id` in `lib/discord-send.ts`) already use `console.error`. The log carries the event id only, no error text.
- `getEventDetail` returning null (the event is not public) now also leads to no numbers. It does not log, because nothing failed. `notifyFinished` already sends the public message only for public events, so this case should not occur.

## Deviations
- None from the task.

## Verified
- `pnpm exec vitest run lib/notify.test.ts lib/notify-event-message.test.ts`: 2 files, 22 tests passed.
- The same two files run against the `origin/dev` versions of `lib/notify.ts` and `lib/run-notify.ts` (copied in, then restored): exactly the two new tests fail (`shows typed markdown, mentions and links literally …`, `leaves out the alliance count, stale and movers lines …`), and the other 20 pass. The tests catch the old behaviour.
- `pnpm check`: prettier, eslint and `tsc --noEmit` pass. Vitest: 34 files passed, 4 failed with `Error: Hook timed out in 10000ms` in `openTestDb()` (`lib/queries/leadership`, `players`, `running`, `upstream-status`). Load average was 33. Those 4 files run alone: 4 files, 14 tests passed. This is the PGlite setup timeout #124 is fixing. `tsx scripts/check-drift.ts` run on its own: "Everything's fine".
- No upstream API call, no webhook call: the tests use the fake fetch from `lib/app-context.test-helpers.ts`.

## Open issues
- Not escaped: Discord's line-start markdown (`# ` headings, `- `/`* ` lists, `-# ` subtext). Typed text reaches the start of a line only in a movers line of an alliance that has no tag, because `allianceLabel` then starts with the name. A follow-up could escape a leading `#` or `-` if that ever shows up.
- Not escaped: error text in the admin message (`error: {error}`, `✗ failed {alliance}: {error}`, `✗ App error on {route}: {message}`). These are run codes, upstream error descriptions and thrown error messages, not text that people type. If upstream error bodies ever echo alliance text, they would need the same helper.
- The two places named in the issue, `docs/handoff/07f-discord-templates.md:56` and `docs/handoff/08n-manual-discord.md:24`, still describe the old behaviour. Handoffs are history, so they were not edited.
- Lane A (#121) also edits `lib/notify.ts`. This diff touches `allianceLabel`, `PublicContext.alliances`, the `if (summary.status !== "failed" …)` line in `publicSnapshotMessage`, the `manualRun` fill and `adminEventMessage`.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches only message text and one fallback; no collector, cron path or quota code.
Owner must do first: merge this PR into `dev`. No migration, no environment variable.
Plan changes needed: none.

<adjustments>
- If a Discord public message shows the status line and the next-update line but no `N/N alliances` line, the event detail read failed. Look for `notify.detail_failed` with the event id in the Vercel runtime log. The data is still in the database; only the message went without numbers.
- Typed text in Discord messages (manual round names, alliance tags and names) is now escaped. A name that shows backslashes or a zero-width space after an `@` in the raw message text is expected, not a bug. The generated event names (`Saturday Event YYYY-MM-DD`, `REHEARSAL <ISO time>`) have nothing to escape and show unchanged.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/134
