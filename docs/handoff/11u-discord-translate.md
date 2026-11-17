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
  2. "In a thread" / "In the channel" only when the asker may use both. A place is offered only if the asker's channel permissions allow it (`member.permissions`): a thread needs the bot, Create Public Threads and Send Messages in Threads; the channel needs Send Messages. With neither, a private "You can't post in this channel." Without the bot, a one-line note.
  3. A select change or a place button redraws the picker (type 7). Post checks the permissions again from the press, counts the quota, and answers with the picker itself (type 7): "Translating…", no buttons, the embed kept.
  4. After the response (`lib/private/discord-translate-run.ts`): translate, then post in a thread (bot) or the channel (webhook follow-up with the message link). Every public post carries a small "-# Asked by @name" line, with mentions off. Then one line tells the asker where each language went.
- **Thread posting with `DISCORD_BOT_TOKEN`**:
  - opens a public thread on the message, auto-archived after 1 day, and posts one bot message per language;
  - reuses the message's existing thread (Discord's code 160004);
  - falls back to the channel when the bot cannot open one, and tells the asker "Posted in the channel: the bot can't open threads here.";
  - when the thread opened but a later post failed, posts only the languages not yet sent in the channel, and says exactly that ("Posted in the thread: 🇧🇷 Português. The bot could not post the rest in the thread. In the channel: 🇫🇷 Français.").
- **A press is bound to its picker**: the `custom_id` carries the asker's id, and the press must come from a private message (`flags & 64`) whose `interaction_metadata.user.id` is the presser. Anything else gets the "not yours" line.
- **Quota in languages (units)**: 5 a minute per person, and 300 a day for the whole app (`TRANSLATE_PER_DAY`, key `day:translate` in `auth_attempts`). Past the daily cap: "Translations are paused for today. Try again tomorrow." `recordFailure` takes a unit count, and keys starting `day:` are kept a day instead of an hour.
- **A language that failed beside ones posted** is named in the asker's line with the reason ("Not translated: 🇫🇷 Français. The translator is busy. Try again in a minute.").
- **Shared Discord values** (`lib/private/discord-api.ts`): the interaction and response types, `EPHEMERAL`, the permission bits, and `editOriginal`, which both the import's `editReply` and the Translate `editOwn` use.
- **Pure helpers** (`lib/private/translate-message.ts`):
  - `guessLanguage` (marker words and letters; null when no language leads; "que", "mais" and "nos" left out as French too; the curly apostrophe counts);
  - `placesFor` (where the asker may post, from their channel permissions);
  - `mask`/`unmask` (mentions, `@everyone`/`@here`, custom emoji, timestamps, slash mentions and links become `{n}`);
  - the picker's state in each `custom_id`, bound to the message and the asker;
  - `messagesOf`, which cuts a long translation under 2,000 characters.
- **Translator**: `translateText(model, from | null, to, text)`. With `from` null the prompt says "Translate to X". An answer that comes back mostly as sent counts as already in that language (`same: true`) and is not retried. The prompt gained "Keep placeholders such as {1} and {2} exactly as written". A `<text>`/`</text>` tag written inside the text (any case, with spaces) gets ‹ › before it is wrapped, for the notices too.
- **Env**: `DISCORD_BOT_TOKEN` (optional, a secret) in `lib/env.ts`, `.env.example` and `secretsOf`. The interactions route passes whether it is set, and its `maxDuration` went from 60 to 90 s.
- **Copy**: `lib/private/dictionary.translate.ts`, 28 keys in EN, PT-BR and FR (French no-break spaces). It reuses the notices' busy, timeout and "partly untranslated" lines and the import's "no Officers' Desk" line.
- **Tests**:
  - `lib/private/discord-translate.test.ts` (12): locale mapping, already in the asker's language, the language guess (with "Mais bien sûr, nos amis" and "don’t"), the pre-selected languages, masking, places by permission, the re-check at Post, the picker bound to its asker, the length cap, units per minute, the daily cap, and `handleInteraction` routing (both names, a signed press, an unknown command → 400).
  - `lib/private/discord-translate-run.test.ts` (7): new thread with "Asked by", existing thread, fallback, partial thread failure, channel post, a failed language named, and "for me" (embed edit, and the "off" line without a key).
  - `lib/ai/groq.test.ts`: one test for the neutralised `<text>` tags. The registration test in `lib/app-commands.test.ts` expects the three commands.
- **Docs**: D101, its index line, a dated amendment at the end of D96 (file and function renamed), and `docs/ARCHITECTURE.md`: the line for the file and the `lib/private → lib/ai` edge in the dependency rule.

## Decisions
- **Who may use them: any member of a server that has a workspace, for both commands, pending the owner's answer.** Issue #346 says "Available to members of the workspace's Discord server". Officers only would be one gate in `translateCommand`. Channel permissions now decide where a member may post.
- **Nothing stored between the picker and Post.** The bot cannot read a message on its own (no Gateway, no intents), and the button press does not carry the original message. So the picker shows the message's text in an embed, and Post reads it back from the signed component interaction (`message.embeds[0].description`). The only rows written are the two quota counters: one per person, keyed by a SHA-256 of the Discord id, and one for the app.
- **The picker's state lives in `custom_id`**: `tr:<action>:<message>:<user>:<source>:<languages>:<place>`, under 66 characters. The app keeps no session.
- **Thread posts are plain messages, channel posts are embeds.** As a bot, embeds would need the Embed Links permission, which is not in the owner's list. The interaction webhook needs no permission, so the channel reply stays one tidy message with one embed per language.
- **Quota in languages asked**: 5 a minute per person and 300 a day for the app, counted when the translator is about to be called ("for me": 1; Post: one per chosen language). Both are checked before anything is counted. It reuses `recordFailure` on `auth_attempts`, a Postgres fixed window, because each serverless instance has its own memory. 300 a day stays under Groq's 1,000 requests a day per model, even when every language needs the retry and the fallback, and leaves room for the notices.
- **Read Message History is dropped** from the install permissions, because no call reads a message. The integer is now 309237648384. If the first real thread answers "Missing Access", it goes back (309237713920).
- **The asker's last Thread/Channel choice is not remembered**: it would need storage. The owner compares the two modes by looking at the channel. The `discord.translate.thread` / `discord.translate.channel` lines are runtime logs only, kept about an hour, not a stored count.
- **If the asker picks the language the guess named**, the guess is taken as wrong and the model works the source out (`from: null`).

## Deviations
- The owner changed "Translate for everyone" twice during the session. First a picker before posting. Then a bot user with threads, and both modes in the picker. The first brief's plain public deferred reply with EN/PT/FR blocks was replaced by the picker flow.
- The /admin button keeps its label "Register the Discord command" (D96 quotes it). Only the help text changed.
- `lib/ai/notice-writing.ts` changed: `from` may be null, `Translation.same`, one prompt rule, and the neutralised `<text>` tags. The notices get the placeholder rule and the tag neutralising; nothing else changes for them.
- After the PR #378 review: 17 fixes, in a second commit (permissions, "Asked by", the prompt block, the press binding, Post as type 7, the quota in units and the daily cap, partial failures, the dependency rule, Read Message History, the language markers, tests, shared values, casts, the header comment, and D101's wording on the mode comparison and on who may use it).
- The restart of the review round wiped the session's scratchpad, including the first round's screenshots and harness. The e2e harness was written again for the changed paths. The screens were not taken again: no page changed in this round (the /admin help text is the same).

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
- **After the PR #378 review** (second commit):
  - `pnpm check`: vitest **795 passed, 4 skipped**.
  - The e2e harness was rebuilt and run again on a new production build, with the same stubs.
  - With the token, **28 of 28**:
    - "for me" without any channel permission;
    - "for everyone" with no permission (one private line), and with Send Messages only (Channel alone);
    - a press from someone else, and one from a message that is not a private picker, both refused;
    - Post answered at once with type 7 "Translating…" and no buttons, then one edit;
    - "-# Asked by" leading the thread post and in the channel post;
    - the existing thread reused; the fallback;
    - the partial thread failure (French alone to the channel, with the exact line);
    - the rate limit in units; the 429 fallback; a failure with the picker back; /admin's PUT.
  - Without the token, **15 of 15**.
  - The quota rows after the run were `day:translate` (kept past the hourly prune) and the per-person rows, keyed by hash.
  - The server log again held only `discord.translate.*` codes; the grep found nothing.
- **Screens** (first round; the files in `scratchpad/11u-shots/` were lost when the scratchpad was wiped, and the page did not change after): /admin's Discord section after Register, at 360 and 1280 in light and dark in Chrome, and at 390 in iPhone WebKit. No sideways scroll, no field under 16 px, no target under 44 px in the section. /admin is English only (D48), so there is no PT run. The Discord picker and posts cannot be rendered without a Discord client; their exact payloads are checked in the e2e.
- **Designer-persona critique of the shots and the Discord payloads:**
  - Without the bot, the picker said "Choose the languages and where to post", but no place could be chosen. Fixed with its own line: "Choose the languages, then press Post. It is posted in the channel for everyone." The no-bot e2e was re-run on a new build.
  - The /admin button says "command" and registers three. Left as a follow-up (D96 quotes the label).
  - The thread and channel posts look different (plain messages vs embeds). Kept on purpose (see Decisions); the officers compare the two modes anyway.
- Privacy: the diff and the new files were checked against the 127 names in the OGs fixture rosters: no hit. All names and ids in tests and docs are invented.

## Open issues
- **Who may post for everyone.** Built: any member of the server (issue #346), within their channel permissions; pending the owner's answer. Officers only would be D96's `officerOf` rule in `translateCommand`.
- **To confirm on the first real use**:
  - a public follow-up after a private picker posts publicly;
  - Discord still answers code 160004 for a message that already has a thread;
  - the `channel_id` field is present on message-command and component interactions (the code reads `channel_id`; Discord also sends a `channel` object);
  - `member.permissions` and `message.interaction_metadata` arrive on component interactions as documented;
  - starting a thread works without Read Message History.
- **Follow-ups, not done:**
  - the /admin label "Register the Discord command" could become plural, with an amendment to D96;
  - remembering the last Thread/Channel choice, which needs storage.
- The language guess is a heuristic. Short or mixed messages give "no clear language": all three are offered, and the model's own answer drops the source.

## Next
Session: the next workspace batch the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The two mid-session changes fit, and most of the time went to the e2e harness and two production builds.
Owner must do first: follow D101's owner steps.
1. Create the bot user (Public Bot off, intents off) and put its token in Vercel as `DISCORD_BOT_TOKEN` (Production, Sensitive); redeploy.
2. Install the bot with `https://discord.com/oauth2/authorize?client_id={CLIENT_ID}&scope=bot+applications.commands&permissions=309237648384&guild_id=1544808864262914060&disable_guild_select=true`.
3. Press "Register the Discord command" on /admin.
4. Answer whether "Translate for everyone" stays open to every member.

Plan changes needed: none.

<adjustments>
- The app now has a bot user, but only to open threads and post translations (D101): no Gateway, no intents. Anything that needs the bot to read messages on its own still needs a separate always-on host.
- `lib/app-commands.ts` holds every message command. Discord's PUT replaces a guild's whole set, so a new command must be added to `APP_COMMANDS`, and the owner presses Register again.
- Component interactions (type 3) reach `handleInteraction`. Any new picker must use its own `custom_id` prefix; `tr:` is taken by the Translate picker.
- `translateText` accepts `from: null` and returns `same`; the notices route ignores `same`.
- Numbers measured here: thread mode makes 1 thread call plus 1 bot message per language; channel mode makes 1 follow-up. Post answers with the picker (type 7) and edits it once more at the end.
- `auth_attempts` keys starting `day:` are kept a day (Translate's daily cap); every other key is still pruned after an hour. `recordFailure` takes a unit count.
- `lib/private/discord-api.ts` holds Discord's interaction numbers, the permission bits and `editOriginal`; new Discord code should import from it.
</adjustments>

PR: not opened; the orchestrator pushes the branch and opens it.
