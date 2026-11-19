# 11ao — Translate for everyone: say why there is no thread (issue 394)

## Built

- `lib/private/discord-translate-run.ts`: when Discord refuses `POST /channels/{channel}/messages/{message}/threads`, the bot reads Discord's JSON error code. The asker's final line names what is missing:
  - 50001: the bot can't see the channel. Add LAPTracker in the channel's Permissions with View Channel, Send Messages, Create Public Threads and Send Messages in Threads.
  - 50013: a permission is missing. Give LAPTracker Create Public Threads and Send Messages in Threads.
  - 50024: Discord allows no thread on a message in this kind of channel.
  - 160006: the channel's active-thread limit is reached.
  - Anything else (no code, network error, no bot token): the old "the bot can't open threads here" line.
  - 160004 is unchanged: the bot posts in the existing thread.
- `lib/private/dictionary.translate.ts`: four new keys (`translate.discord.noThreadAccess|noThreadPermission|noThreadType|noThreadLimit`) in EN, PT-BR and FR. Permission names follow Discord's own UI in each language. French has a no-break space before ":".
- The `discord.translate.thread_refused` log line carries `code` beside `status`: numbers only.
- `docs/decisions/D101-discord-translate-commands.md`: a dated amendment with the mapping, the Read Message History finding, and owner step 4 for private channels.

## Decisions

- Read Message History (65536) was not added back. Discord's "Start Thread from Message" section (read 2026-11-19 at docs.discord.com/developers/resources/channel) lists no permission for the endpoint and never mentions Read Message History. The docs name that permission only for replies and message references (codes 160002, 160009). So the install integer stays 309,237,648,384.
- The owner setup checklist for the bot is D101's "Owner steps" (`docs/PREREQUISITES.md` does not cover the Discord app). The private-channel step went there as step 4, in the amendment.
- Mapped 50024 and 160006 beyond the issue's two codes. 50024 covers the forum and channel-type case D101 already describes, and 160006 is the thread limit from Discord's 1600xx codes. 10008 (message deleted) and 160005 (thread locked) fall to the fallback line.

## Deviations

- None.

## Verified

- `pnpm vitest run lib/private/discord-translate-run.test.ts lib/private/dictionary.test.ts`: 23 passed. The fallback test became one case per code (50001, 50013, 50024, 160006) plus the fallback (no code, HTTP 500). One more test checks the 50001 line in PT-BR.
- `pnpm check`: passes (prettier, eslint, tsc, vitest 1125 passed / 4 skipped in 210 files, drift, i18n).
- No real Discord call: the tests stub `fetch`.

## Open issues

- Not confirmed on real Discord: that a private channel without the bot answers 50001, and not 10003 or 50013. If it answers something else, the asker reads the fallback line. The log's `code` will show which one it was.
- If 50001 persists after the bot is added to the channel, try adding Read Message History (65536). The amendment records this.

## Next

- Model/effort: keep. A small mapping change.
- What the owner must do first: in each private channel where officers translate, add the LAPTracker role in Edit Channel → Permissions with View Channel, Send Messages, Create Public Threads and Send Messages in Threads. Then try "In a thread" again.
- Plan change: none.

<adjustments>
- `discord.translate.thread_refused` now logs Discord's `code`. Read it in the runtime logs (kept about an hour) after the first refused thread to confirm the mapping.
</adjustments>

PR: (added by the orchestrator)
