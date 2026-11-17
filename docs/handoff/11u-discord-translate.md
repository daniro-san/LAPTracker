# 11u — Discord "Translate for me" and "Translate for everyone" (issue #346)

Branch `session/11u-discord-translate`, from `origin/dev` at `2afa453`. Decision: D101.

## Built
- **Three message commands in one list.** `lib/import-command.ts` became `lib/app-commands.ts`:
  - `IMPORT_COMMAND`, `TRANSLATE_FOR_ME`, `TRANSLATE_FOR_EVERYONE`, together in `APP_COMMANDS`;
  - `registerAppCommands` (was `registerImportCommand`) PUTs all three in one request, because Discord's PUT replaces a guild's whole command set.

  `scripts/discord-register-command.ts`, `POST /api/admin/discord-command` and the /admin card use it. The /admin help text now names the three commands.
- **"Translate for me"** (`lib/private/discord-translate.ts`): checks, then a private deferred reply (type 5, flag 64). After the response it is edited with one embed in the asker's Discord language. If the message is already in that language, the reply says so at once.
- **"Translate for everyone"**:
  1. A private picker (type 4) holds the message's text and a language select with the non-source languages pre-selected.
  2. With the bot, "In a thread" / "In the channel" (Thread by default); without it, a one-line note.
  3. Post: a select change or a place button redraws the picker (type 7); Post sends a deferred update (type 6).
  4. After the response (`lib/private/discord-translate-run.ts`): clear the picker's buttons, translate, post in a thread (bot) or the channel (webhook follow-up with the message link), then one line saying where it went.
- **Thread posting with `DISCORD_BOT_TOKEN`**:
  - opens a public thread on the message, auto-archived after 1 day, and posts one bot message per language;
  - reuses the message's existing thread (Discord's code 160004);
  - falls back to the channel when the bot cannot open one, and tells the asker "Posted in the channel: the bot can't open threads here."
- **Pure helpers** (`lib/private/translate-message.ts`):
  - `guessLanguage` (marker words and letters; null when no language leads);
  - `mask`/`unmask` (mentions, `@everyone`/`@here`, custom emoji, timestamps, slash mentions and links become `{n}`);
  - the picker's state in each `custom_id`, bound to the message and the asker;
  - `messagesOf`, which cuts a long translation under 2,000 characters.
- **Translator**: `translateText(model, from | null, to, text)`. With `from` null the prompt says "Translate to X". An answer that comes back mostly as sent counts as already in that language (`same: true`) and is not retried. The prompt gained "Keep placeholders such as {1} and {2} exactly as written".
- **Env**: `DISCORD_BOT_TOKEN` (optional, a secret) in `lib/env.ts`, `.env.example` and `secretsOf`. The interactions route passes whether it is set, and its `maxDuration` went from 60 to 90 s.
- **Copy**: `lib/private/dictionary.translate.ts`, 20 keys in EN, PT-BR and FR (French no-break spaces). It reuses the notices' busy, timeout and "partly untranslated" lines and the import's "no Officers' Desk" line.
- **Tests** (`lib/private/discord-translate.test.ts`, 12): locale mapping, already in the asker's language, the language guess, the pre-selected languages, masking, the 1,500-character cap, the 5-a-minute rate limit, the picker bound to its asker, and four posting cases (new thread, existing thread, fallback, channel). The registration test in `lib/app-commands.test.ts` now expects the three commands.
- **Docs**: D101, its index line, a dated amendment at the end of D96 (file and function renamed), and `docs/ARCHITECTURE.md`'s line for the file.

## Decisions
- **Who may use them: any member of a server that has a workspace, for both commands.** Issue #346 says "Available to members of the workspace's Discord server", so I did not apply the officer rule to "for everyone". The coordinator's later message says "after the officer picks languages"; if officers only was meant, it is a one-line change in `translateCommand` (see Open issues).
- **Nothing stored between the picker and Post.** The bot cannot read a message on its own (no Gateway, no intents), and the button press does not carry the original message. So the picker shows the message's text in an embed, and Post reads it back from the signed component interaction (`message.embeds[0].description`). The only row written is the rate-limit counter, keyed by a SHA-256 of the Discord id.
- **The picker's state lives in `custom_id`**: `tr:<action>:<message>:<user>:<source>:<languages>:<place>`, under 66 characters. The app keeps no session.
- **Thread posts are plain messages, channel posts are embeds.** As a bot, embeds would need the Embed Links permission, which is not in the owner's list. The interaction webhook needs no permission, so the channel reply stays one tidy message with one embed per language.
- **Rate limit: 5 a minute per person**, counted when the translator is about to be called ("for me" after its checks; "for everyone" at Post, not when the picker opens). It reuses `recordFailure` on `auth_attempts`, a Postgres fixed window, because each serverless instance has its own memory.
- **The asker's last Thread/Channel choice is not remembered**: it would need storage. Use per mode is logged as `discord.translate.thread` / `discord.translate.channel`. PostHog runs only in the browser (D77), so there is no server event.
- **If the asker picks the language the guess named**, the guess is taken as wrong and the model works the source out (`from: null`).

## Deviations
- The owner changed "Translate for everyone" twice during the session. First a picker before posting. Then a bot user with threads, and both modes in the picker. The first brief's plain public deferred reply with EN/PT/FR blocks was replaced by the picker flow.
- The /admin button keeps its label "Register the Discord command" (D96 quotes it). Only the help text changed.
- `lib/ai/notice-writing.ts` changed: `from` may be null, `Translation.same`, and one prompt rule. The notices' behaviour is unchanged; only their prompt carries the extra placeholder rule.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest **787 passed, 4 skipped**, drift check, i18n check.
- **Local e2e** on a production build (`next build` + `next start`). Setup: local Postgres 18 with 27 migrations, the database bridge, an invented workspace row, a Discord stub that records webhook edits, follow-ups, thread creation and bot posts, and the 11p-style in-process Groq preload. Interactions were signed with a test Ed25519 key. No real Discord, Groq or upstream call.
  - With `DISCORD_BOT_TOKEN`, **28 of 28**:
    - PING and an unsigned 401;
    - "for me": deferred and private, edited with the Portuguese embed, mention, link and custom emoji put back verbatim, `allowed_mentions` none;
    - already in the asker's language; too long in French ("1 689 caractères … 1 500");
    - the picker: private, PT and FR pre-selected, Thread the default, the text shown; the select redraw; a press by someone else refused;
    - thread: a new thread named "Translation", 1 day, posted as the bot; the picker cleared first, then "Posted in the message's thread."; the existing thread reused; the fallback to the channel with its line;
    - the Channel button, then the channel post with the link;
    - the 6th translation in a minute refused;
    - a 429 on the first model answered by the second;
    - both models failing: a plain line and the picker back;
    - /admin's register PUT with the three commands.
  - Without the token, **16 of 16**: no Thread/Channel row and the note, Post goes to the channel, "Posted in the channel."
  - Groq stub totals for the bot run: 27 calls to gpt-oss-120b and 12 to qwen.
  - Server log: only `discord.translate.*` codes with numbers. A grep for the message text, the invented ids, the bot token and the gsk key found nothing.
- **Screens** (`scratchpad/11u-shots/`): /admin's Discord section after Register, at 360 and 1280 in light and dark in Chrome, and at 390 in iPhone WebKit. No sideways scroll, no field under 16 px, no target under 44 px in the section. /admin is English only (D48), so there is no PT run. The Discord picker and posts cannot be rendered without a Discord client; their exact payloads are checked in the e2e.
- **Designer-persona critique of the shots and the Discord payloads:**
  - Without the bot, the picker said "Choose the languages and where to post", but no place could be chosen. Fixed with its own line: "Choose the languages, then press Post. It is posted in the channel for everyone." The no-bot e2e was re-run on a new build.
  - The /admin button says "command" and registers three. Left as a follow-up (D96 quotes the label).
  - The thread and channel posts look different (plain messages vs embeds). Kept on purpose (see Decisions); the officers compare the two modes anyway.
- Privacy: the diff and the new files were checked against the 127 names in the OGs fixture rosters: no hit. All names and ids in tests and docs are invented.

## Open issues
- **Who may post for everyone.** Built: any member of the server (issue #346). The coordinator's later message speaks of "the officer". If the owner wants officers only for "Translate for everyone", gate the picker with D96's `officerOf` rule in `translateCommand`.
- **To confirm on the first real use**:
  - a public follow-up after a private picker posts publicly;
  - Discord still answers code 160004 for a message that already has a thread;
  - the `channel_id` field is present on message-command and component interactions (the code reads `channel_id`; Discord also sends a `channel` object).
- **Follow-ups, not done:**
  - the /admin label "Register the Discord command" could become plural, with an amendment to D96;
  - a server-wide daily cap on Groq requests, since the per-person limit does not bound the day's total;
  - remembering the last Thread/Channel choice, which needs storage.
- The language guess is a heuristic. Short or mixed messages give "no clear language": all three are offered, and the model's own answer drops the source.

## Next
Session: the next workspace batch the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The two mid-session changes fit, and most of the time went to the e2e harness and two production builds.
Owner must do first: follow D101's owner steps.
1. Create the bot user (Public Bot off, intents off) and put its token in Vercel as `DISCORD_BOT_TOKEN` (Production, Sensitive); redeploy.
2. Install the bot with `https://discord.com/oauth2/authorize?client_id={CLIENT_ID}&scope=bot+applications.commands&permissions=309237713920&guild_id=1544808864262914060&disable_guild_select=true`.
3. Press "Register the Discord command" on /admin.
4. Answer whether "Translate for everyone" stays open to every member.

Plan changes needed: none.

<adjustments>
- The app now has a bot user, but only to open threads and post translations (D101): no Gateway, no intents. Anything that needs the bot to read messages on its own still needs a separate always-on host.
- `lib/app-commands.ts` holds every message command. Discord's PUT replaces a guild's whole set, so a new command must be added to `APP_COMMANDS`, and the owner presses Register again.
- Component interactions (type 3) reach `handleInteraction`. Any new picker must use its own `custom_id` prefix; `tr:` is taken by the Translate picker.
- `translateText` accepts `from: null` and returns `same`; the notices route ignores `same`.
- Numbers measured here: thread mode makes 1 thread call plus 1 bot message per language; channel mode makes 1 follow-up. Every "for everyone" post edits the picker twice.
</adjustments>

PR: not opened; the orchestrator pushes the branch and opens it.
