## D101 — Discord "Translate for me" and "Translate for everyone": message commands on the Groq translator, posted in a thread by a bot that only does that (2026-11-17, owner, 11u, issue #346)

Why: the alliance uses a flag-reaction bot ("Jake Translation") whose output is literal and sometimes wrong (it turned "Wed" into "Casamento"). The owner asked whether the app can translate in Discord with the notices' translator (D81). A reaction reaches an app only over Discord's Gateway, which a Vercel app cannot hold. So the trigger is a message command (Apps on a message), served by the interactions route of D96. Both bots stay active while the officers compare them on about 10 real messages; the owner then decides whether the flag bot is still needed (issue #346, owner, 2026-11-16).

- **Two message commands** next to "Send to LAPTracker" (`lib/app-commands.ts`).
  - **"Translate for me"**: a deferred reply only the asker sees, then edited with the translation into the asker's Discord `locale`: `pt-*` → Portuguese (pt-BR), `fr*` → French, anything else → English (`pickWorkspaceLanguage`, the same mapping as the workspace). When the message already seems to be in that language, the reply says so at once and the translator is not called.
  - **"Translate for everyone"**: first a picker only the asker sees. It holds:
    - the message's text;
    - a select of English, Português and Français, with every language except the message's own picked;
    - "In a thread" / "In the channel", shown only when the asker may use both;
    - Post.

    Changing the select or the place redraws the picker (type 7). Post answers with the picker itself (type 7): "Translating…" and no buttons, the embed kept, so a second press has nothing to press. The translating and posting run after the answer, then the picker is edited to one line saying where each language went.
- **Who may use them** (pending the owner's answer; officers-only would be one gate in `translateCommand`). Built: anyone in a Discord server that has a workspace, for both commands, because issue #346 says "available to members of the workspace's Discord server". A server without a workspace gets the import's "no Officers' Desk" line.
- **Channel permissions.** Discord resolves the asker's permissions for the channel into `member.permissions`.
  - "In a thread" needs the bot plus Create Public Threads and Send Messages in Threads. "In the channel" needs Send Messages.
  - The picker offers only the places the asker may use; its first line says where the post goes, and without the bot it adds "Threads need the bot. See /admin."
  - With neither, "Translate for everyone" answers privately "You can't post in this channel."
  - Post checks again from the press's own `member.permissions`. "Translate for me" posts nothing public and does not check them.
- **The picker is bound to the asker and the message.** Every component's `custom_id` is `tr:<action>:<message id>:<user id>:<source>:<languages>:<place>`. A press counts only when:
  - that user id is the presser;
  - the message it came from is private (`flags & 64`);
  - that message's `interaction_metadata.user.id` (or the older `interaction.user.id`) is the presser.

  Anything else gets "Only the person who opened this menu can use it." Component interactions are signed and checked like commands (same route, same Ed25519 check and 5-minute window).

- **Where it is posted.** Every public post says who asked: a small line, "-# Asked by @name" (the mention is shown but, with mentions off, pings no one).
  - **Thread** (only with `DISCORD_BOT_TOKEN`): the bot opens a public thread on the message (`POST /channels/{channel}/messages/{message}/threads`), named "Translation" / "Tradução" / "Traduction" in the asker's language and archived after 1 day without messages.
    - Each language is its own message ("**🇧🇷 Português**" then the text, cut at line breaks under Discord's 2,000 characters). Plain messages, not embeds, so the bot does not need Embed Links.
    - When the message already has a thread (Discord's code 160004), the bot posts in it: a message's thread has the message's id.
    - When the bot cannot open one (no permission, a forum post, a message inside a thread, a DM), everything goes to the channel and the asker reads "Posted in the channel: the bot can't open threads here."
    - When the bot opened it but a later post failed, only the languages not yet posted go to the channel, and the asker reads exactly that: "Posted in the thread: 🇧🇷 Português. The bot could not post the rest in the thread. In the channel: 🇫🇷 Français."
  - **Channel**: one public follow-up through the interaction's webhook. Its content is the original message's link (`https://discord.com/channels/{guild}/{channel}/{message}`, which Discord shows as a chip) and the "Asked by" line; each language is an embed titled with its flag and name. A webhook cannot reply to a message, so the link is the reference.
- **Both modes stay, so the officers can compare which clutters the channel less, by looking at the channel** (owner, 2026-11-17). The asker's last choice is not remembered: that would need storage. Each post also prints `discord.translate.thread` or `discord.translate.channel` with the number of languages. These are runtime logs only, kept about an hour: not a comparison, and not stored anywhere.
- **Which languages.** `guessLanguage` (`lib/private/translate-message.ts`) scores short words that only one of the three languages uses ("the", "você", "nous"; "que", "mais" and "nos" are left out as French too) and letters only one writes (ã õ; è ù œ ë); the curly apostrophe counts as the straight one ("don’t"). It returns a language only when one clearly leads; otherwise null ("gg 18:00", a name, a fourth language).
  - The translator is never asked into the message's own language.
  - With no clear language, all three are offered, and `translateText` is called without a source ("Translate to French:"). If that answer comes back mostly as sent (D81's untranslated check), the text was already in that language: the language is left out, with no retry (`same`).
  - When the asker picks the language the guess named, the guess is taken as wrong and the model works the source out.
  - If every chosen language turns out to be the message's own, the asker reads "Nothing to post: the message is already in the chosen languages."
- **The translator** is D81's: `translateText` with the glossary, the own names put in first, the untranslated check and its one retry, and the second model on a 429 or any other failure of the first. Two changes, shared with the notices:
  - the prompt gained "Keep placeholders such as {1} and {2} exactly as written";
  - a `<text>` or `</text>` tag written inside the text (any case, with spaces) gets ‹ › for its angle brackets before it is wrapped, so a message cannot close the data block early.
- **Mentions, links and custom emoji are kept verbatim.** Before the request, `mask` replaces user, role and channel mentions, `@everyone` and `@here`, custom emoji, timestamps, slash-command mentions and `http(s)` links with `{1}`, `{2}`, …; `unmask` puts them back. So Discord ids and links never reach Groq. Every reply, edit and post sends `allowed_mentions: { parse: [] }`, so a translated `@everyone` or `<@id>` pings no one.
- **Privacy.** D81 sends officer-written text. Here a message may be written by any member, so this records the owner's terms (issue #346):
  - Only the text of the one message a person explicitly chose is sent to Groq, with the system prompt; nothing else about the message, its author or the server.
  - Nothing is stored. The text travels from the command to the picker message, and from the picker back to Post inside Discord's signed interaction; no table holds it.
  - The rate limit keeps two counter rows in `auth_attempts`: one keyed by a SHA-256 of the person's Discord id, deleted within the hour, and one for the whole app (`day:translate`), deleted within a day.
  - Logs are codes and numbers only: `discord.translate.me|thread|channel|done|limited|paused|refused|off|thread_refused|thread_post_failed|channel_failed|reply_failed`, with counts, ms and Discord's HTTP status. Never the text, a name or an id.
  - Groq's terms are D81's: inputs are not used for training, and the account's Zero Data Retention turns off the 30-day abuse log.
- **Limits.**
  - At most 1,500 characters (`MAX_TRANSLATE_CHARS`). A longer message gets "This message is too long to translate: 1,689 characters. The limit is 1,500.", with numbers in the asker's language.
  - A message with no letters once masked (only links, mentions, numbers) gets "This message has no text to translate."
  - Quota, counted in languages asked (units), when the translator is about to be called: at "for me" (1), or at Post (one per chosen language).
    - Per person: 5 units a minute (`TRANSLATE_PER_MINUTE`).
    - For the whole app: 300 units a day (`TRANSLATE_PER_DAY`), a fixed 24 h window from the first use. Past it, everyone reads "Translations are paused for today. Try again tomorrow."
    - Why 300: Groq's free tier allows 1,000 requests a day per model. A unit is one request on the first model when all goes well, at most two on each model with the untranslated retry and the fallback (D81). So 300 units stay under the free tier and leave room for the notices' Translate and Improve writing.
    - Both counters use the same `auth_attempts` upsert as the PIN limiter (`recordFailure` with a unit count), checked before anything is counted. Keys starting `day:` are kept a day instead of an hour.
- **Failures.**
  - Both models busy: the notices' "The translator is busy. Try again in a minute." A timeout: the notices' "took too long" line. Anything else: "The translator did not answer this time. Try again in a minute."
  - When nothing could be translated or posted, the picker comes back with its buttons so the asker can try again.
  - When one language failed and others were posted, the asker's line names it and the reason: "Not translated: 🇫🇷 Français. The translator is busy. Try again in a minute."
  - No reply carries a stack. Without `GROQ_API_KEY`: "Translate isn't available yet. Ask the site owner."
- **Threads, and the bot.** The bot exists only to open threads and post translations in them.
  - It reads nothing on its own: no Gateway connection and no intents. Message Content is not needed, because a message command delivers the target message's content in the interaction.
  - It acts only on a person's command.
  - `DISCORD_BOT_TOKEN` is optional and a secret: it is sent only to Discord as `Authorization: Bot …`, never compared or logged, and it is on the log redaction list (`secretsOf`). Without it, the picker offers the channel only.
- **Registration.** Discord's guild command `PUT` replaces the guild's whole set, so `registerAppCommands` (was `registerImportCommand`) registers all three commands in one request, from `pnpm discord:register` and from /admin's "Register the Discord command". The label D96 quotes is kept; the help text names the three commands.
- **`maxDuration`** of the interactions route went from 60 to 90 s: a translation is at worst four model calls of 15 s (D81), plus the posts.
- **Owner steps** (once, after the release):
  1. Developer Portal → the app → Bot: enable the bot user, set a username and icon, Reset Token, and copy it into Vercel as `DISCORD_BOT_TOKEN` (Production, Sensitive); redeploy. Keep "Public Bot" off and every privileged intent off.
  2. Install the bot into the OGs server with this URL (`{CLIENT_ID}` is `DISCORD_CLIENT_ID`, the app's Application ID, not a secret):
     `https://discord.com/oauth2/authorize?client_id={CLIENT_ID}&scope=bot+applications.commands&permissions=309237648384&guild_id=1544808864262914060&disable_guild_select=true`
     The permissions are View Channels (1024), Send Messages (2048), Create Public Threads (34359738368) and Send Messages in Threads (274877906944): 309,237,648,384 together.
     - Read Message History is not asked for. None of the bot's calls reads a message: it opens a thread on a message whose id it already has, and posts. Whether Discord also wants Read Message History to start a thread from a message could not be checked without real Discord.
     - If the first real thread answers "Missing Access" (50001), add it (65536); the integer becomes 309,237,713,920.
  3. /admin → Discord → "Register the Discord command" (it now registers three commands).
- **To confirm on the first real use.**
  - Starting a thread works without Read Message History (above).
  - A public follow-up after a private picker posts publicly (Discord documents follow-up flags per message).
  - The thread answer for an existing thread is still code 160004.
  - `member.permissions` and `message.interaction_metadata` arrive on component interactions as documented.
- **Not done here.** A flag-reaction trigger (needs a Gateway host); remembering the asker's last Thread/Channel choice; a stored count per mode.
