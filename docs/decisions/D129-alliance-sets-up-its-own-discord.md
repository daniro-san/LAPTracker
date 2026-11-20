## D129 — An alliance sets up its own Discord in Alliance settings: it adds the bot, turns on the commands that are on for it, and saves its own notice webhooks, stored encrypted (2026-11-20, owner, issue 451; amends D73, D96, D101, D102, D124, D125, D126)

Why: until now the owner sent each alliance the bot's install link, registered the message commands from /admin, and put the alliance's notice webhooks in the Vercel variable `WORKSPACE_DISCORD_WEBHOOKS` (D102). A new alliance waited for the owner at every step. The owner (issue 451 and its comment of 2026-11-19): officers do it themselves, in Alliance settings → Discord, and the owner no longer touches Vercel for an alliance. Issue 483: a command turned off for an alliance is not registered in its server at all.

**Alliance settings → Discord** (`/w/[slug]/settings`, `DiscordSection.tsx`). Three numbered steps, each with a one-line tip. Officers only (`requireWorkspace`); EN, PT-BR and FR words in `lib/private/dictionary.discord.ts` and `dictionary.discord-fr.ts`.

1. **"Add LAPTracker to Discord"**: a link to Discord's install page, built on the server (`installUrl`, `lib/private/discord-setup.ts`) from `DISCORD_CLIENT_ID` (public), `scope=bot applications.commands`, D101's permission integer `309237648384` (View Channels, Send Messages, Create Public Threads, Send Messages in Threads; no admin right) and this workspace's `guild_id` with `disable_guild_select=true`, so the bot can only be added to the alliance's own server. The base is `DISCORD_API_BASE_URL` (`…/api/oauth2/authorize`). Without `DISCORD_CLIENT_ID` the step says Discord is not set up on this site.
2. **"Check"**: the server asks Discord, with `DISCORD_BOT_TOKEN`, for `GET /guilds/{workspace's guild}`.
   - 200: the bot is in. `workspace_discord.bot_seen_at` is set the first time, and the browser sends `ws_bot_installed` once.
   - 403 or 404: 409 `bot_missing`, "The bot is not in your server yet: tap Add LAPTracker to Discord in step 1 first." Nothing is registered.
   - No answer or another status: 503 `unreachable`.
   - Then the commands that are on for the workspace (D126: `discord_send`, `discord_translate_me`, `discord_translate_everyone`, less a paused allowance) are registered in that server only, through D96's client-credentials `PUT` (`lib/workspace-commands.ts` → `registerAppCommands`). What Discord took is recorded in `workspace_discord.commands`. A refused `PUT`: 502 `commands_failed`.
   - At most 5 checks every 15 minutes per workspace (`auth_attempts`, key `botcheck:ws:<id>`), refused ones included: each check is up to three Discord calls.
   - Without the bot token or the app's credentials: 503 `bot_off`, and the step says the bot is not set up on this site.
   - Then D101's note on private channels: add LAPTracker to the channel's permissions.
3. **Channels for notices**: the leaders' and members' channels of "Publish to Discord" (D102), the garrison post (D121) and the weekly thanks (D114). Each card shows "Set · #name", "Using a channel the site set up (#name). Add your alliance's own webhook to post to your channel instead." (the env fallback), "Not set yet.", or "This webhook needs to be pasted again." (sealed under another master key; quotes corrected to the shipped words, 2026-11-20, issue 498).
   - The form: the webhook URL (a password field), the channel name as Discord shows it (a leading `#` is dropped, 1–100 characters), and "This is a forum channel" (D102's `forum`). Saving is "Check and save".
   - The server accepts only `https://discord.com/api/webhooks/<17–20 digits>/<token>` or `discordapp.com` (`WEBHOOK_URL`), else 400.
   - It checks the webhook with one `GET {DISCORD_API_BASE_URL}/webhooks/{id}/{token}`. Discord answers the webhook's server and channel and posts nothing. 401, 403 or 404: 422 `refused`. A server that is not this workspace's: 422 `wrong_server` (INVARIANT `discord.own-server`). Two workspaces never share a server (D126), so a webhook can belong to one workspace only. No answer: 503 `unreachable`.
   - Then it is sealed with D124's `sealKey` under `WORKSPACE_KEYS_SECRET`, with `laptracker/webhook-<channel>/<workspace id>` as associated data, so a row copied to another workspace or to the other channel does not open. Without `WORKSPACE_KEYS_SECRET` saving is off (503 `off`) and the cards say so.
   - A repeat of a save's request id (D100) answers the channels as they stand and makes no second check. At most 10 saves per 15 minutes per workspace.
   - The answer, the page, /admin, logs and analytics carry only the channel's state and name. The URL is opened only in `lib/private/discord-webhooks.ts`, at call time, to post.
   - Actions: Send a test message, Replace, Remove (asked first, safe answer first). Remove deletes the row.
   - **"Send a test message"**: one message in the officer's language, "LAPTracker can post here. Leadership notices from the Officers' Desk will come to this channel.", through D102's `postMessages` (`allowed_mentions` empty; a forum channel gets a post titled "LAPTracker test"). At most 5 per 15 minutes per workspace. It logs `discord.webhook.test` with the count sent and Discord's status only.
   - The browser sends `ws_webhook_set` with `channel` (`leaders` or `members`) after a save.

Every route call is `POST /api/w/[slug]/discord` (actions `check`, `webhook`, `remove_webhook`, `test`): same origin, JSON, a member's or another workspace's session gets 401 `signed_out`. Each one that went through counts as `ws_action` feature `discord`, action `check`, `save`, `delete` or `test`.

**`WORKSPACE_DISCORD_WEBHOOKS` stays as the fallback**, per channel, the same pattern as D124's `LAP_API_KEY` for OGs: a channel the workspace has not saved posts through the variable's entry for its slug, if any. Once the workspace saves its own, that one is used; Remove brings the variable's back. A saved webhook that the current master key cannot open is not replaced by the variable's: it must be pasted again. **To retire the variable:** once every workspace listed in it shows "set" for both channels on /admin, delete the variable in Vercel and redeploy; nothing else changes.

**Commands follow the switches (issue 483).**

- /admin's "Register the Discord command" now registers, in each workspace's server, only the commands that are on there, and records them. A server where all three are off gets an empty `PUT`, which removes the app's commands.
- When the owner turns a Discord command on or off, copies settings, or pauses or resumes the translate allowance on /admin, each server that already had the app's commands registered gets exactly those now on. A server that never had them is left alone. A Discord refusal leaves the change saved. The interactions route's "This command is turned off for your alliance." line stays as the fallback for a stale command.
- `pnpm discord:register <guild>` still registers all three (no database there); the owner uses /admin or the alliance uses Check instead.

**/admin** (Workspaces card): one line per workspace, "Discord: bot in server · commands: Send to LAPTracker · leaders' webhook: set · members' webhook: env". It reads only `bot_seen_at`, the recorded command names and which channels have a row; never a webhook.

**Storage** (migration `0051_workspace_discord`): `workspace_discord` (workspace, `bot_seen_at`, `commands`, `commands_at`) and `workspace_webhooks` (workspace and channel; `ciphertext`, `nonce`, `master_fp`, `name`, `forum`, `saved_by`, `saved_at`, `request_id`). Both are in D125's list and deleted with the workspace; neither is downloaded.

**Owner steps.**

1. Nothing new in Vercel: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` (D101) and `WORKSPACE_KEYS_SECRET` (D124) are the ones already set.
2. Discord Developer Portal → the app → Installation: the install link works with "Public Bot" off only for the app's owner. For another alliance's R5 to add the bot, turn **Public Bot on** (Bot tab). The bot still has no privileged intents and acts only on a command; `disable_guild_select` keeps the link on the alliance's own server.
3. Keep `WORKSPACE_DISCORD_WEBHOOKS` until OGs shows both channels "set" on /admin, then delete it (above).

**Tests** (one per behaviour): Check says the bot is missing, then registers only the commands that are on, in this server only; a webhook of another server is refused and its own is saved sealed, never answered back; a repeat of a save's request id makes no second check; posting uses the saved webhook over the variable's and goes back after Remove; the test message pings no one and no log carries the webhook; a switch change re-registers a server that had commands and leaves others alone; `commandsFor`; the isolation suite (issue 471): Alpha cannot save a webhook of Bravo's server and Check asks about Alpha's server only; every officer route refuses another workspace's session.

**Not done here.** The new-alliance guide (a document outside the repo) still needs its steps 6 and 7 changed to "Tap Add LAPTracker in Alliance settings" and "Paste your channel's webhook in Alliance settings → Discord". Reading the channel's real name and type with the bot instead of asking for them.

**Amendment (2026-11-20, issue 498, review of PR 497).**

- **Which /admin changes re-register the commands** is now one rule in `lib/workspace-commands.ts` (`changesCommands`), built on `COMMAND_FEATURE` in `lib/app-commands.ts`: a command's switch, a copy of settings, or a pause of an allowance that a command spends (today `translate`). A cap changes no command. It is not in `lib/private`, which only `app/(private)` may import (D71); `/api/admin/workspaces/features` imports it. Behaviour is unchanged.
- **Board, Members and Garrison read the channel names in parallel** with the page's own read. No change to what they show.
- **Card wording**: the quotes above now match `lib/private/dictionary.discord.ts`. The env fallback card reads "Using a channel the site set up (#name)…", not "Set up by the site's owner · #name".
- **Tests added**: 5 Checks, 10 saves and 5 test messages per 15 minutes, refused ones included (the 6th Check, 11th save and 6th test get 429); `commands_failed` when Discord refuses the `PUT`, with nothing recorded; the install link carries this server's `guild_id`, `disable_guild_select=true` and permissions `309237648384`; after `WORKSPACE_KEYS_SECRET` changes, a saved webhook shows "reenter" and posting gets no channel, never the `WORKSPACE_DISCORD_WEBHOOKS` one.

**Amendment (2026-11-20, owner, issue 476, D134):** command registration follows both layers. A command is registered when the owner allows it and the alliance has it on. The alliance's own switch in Alliance settings, and a change of "Defaults for new alliances", re-register each server that already had the app's commands, like the owner's switch.
