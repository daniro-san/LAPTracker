# feat — an alliance sets up its own Discord in Alliance settings (issue 451)

## Built

- **Alliance settings → Discord** (`DiscordSection.tsx`, `DiscordBot.tsx`, `DiscordChannels.tsx`), three numbered steps, officers only, EN, PT-BR and FR:
  1. "Add LAPTracker to Discord": Discord's install link, built on the server with `DISCORD_CLIENT_ID`, D101's permission integer `309237648384`, the workspace's `guild_id` and `disable_guild_select=true`. The Manage Server requirement is shown above the button.
  2. "Check": the server asks Discord with the bot token whether the bot is in the workspace's server, then registers in that server only the commands that are on for the workspace (issue 483). It answers "The bot is not in your server yet: tap Add LAPTracker to Discord in step 1 first." when Discord says 403 or 404. Rate limit: 5 per hour per workspace. Then the private-channel note from D101.
  3. Leaders' and members' channels. Each takes a webhook URL (password field), a channel name and a forum flag. One `GET` checks the webhook with Discord, and a webhook of another server is refused (`wrong_server`). The webhook is sealed with D124's AES-256-GCM under `WORKSPACE_KEYS_SECRET`, with associated data `laptracker/webhook-<channel>/<workspace id>`. It is never sent back. Each channel has "Send a test message", Replace and Remove (Remove asks first).
- `POST /api/w/[slug]/discord` (actions `check`, `webhook`, `remove_webhook`, `test`): same origin, `requireWorkspace`, request id on the save (D100), rate limits in `auth_attempts`, `ws_action` feature `discord`.
- **Publishing** (notices, garrison post, weekly thanks) uses the saved webhook. `WORKSPACE_DISCORD_WEBHOOKS` is the per-channel fallback until a workspace saves its own. `noticeChannels(db, ws, env)` (opens the URL) replaced the env-only version, and `channelNames` gives pages names only. Home's thanks channel lookup moved to `_ui/home-cards.ts`, because the page is at the 300-line limit.
- **Commands follow the switches**: `lib/workspace-commands.ts` `syncCommands`. /admin's "Register the Discord command" registers only the commands that are on in each server. A switch change, a copy, or a translate pause or resume on /admin re-registers the servers that already had commands. An empty set removes them.
- **/admin**: one line per workspace: "Discord: bot in server · commands: … · leaders' webhook: set · members' webhook: env".
- **Analytics**: `ws_bot_installed` and `ws_webhook_set` (`channel`) in `lib/analytics/events.ts` and the tracking plan. `ws_action` `discord` with `check`, `save`, `delete`, `test`.
- **Storage**: migration `0051_workspace_discord` (`workspace_discord`, `workspace_webhooks`). Both tables are in D125's list: deleted with the workspace and never downloaded.
- **Docs**: D129, and dated amendments to D73, D101, D102, D124, D125 and D126. ARCHITECTURE.md is updated.
- **Copy**: the "not set up" lines for notices and the thanks sheet now end "An officer can add it in Alliance settings." (D102 amendment).

## Decisions

- One route with four actions, like `tracker-key`, rather than four routes.
- Check is one button: it confirms the bot and then registers the commands. When no command is on, it only confirms the bot.
- `ws_bot_installed` fires in the browser on the first Check that finds the bot (`workspace_discord.bot_seen_at` was null). It also fires when the commands then fail.
- The env fallback works per channel and for any slug the variable lists. This is D124's "until it saves its own" pattern. A new workspace inherits nothing, because the variable is keyed by slug. A saved webhook that the current master key cannot open shows "paste again", with no fallback.
- The webhook check calls `DISCORD_API_BASE_URL/webhooks/{id}/{token}`, not the pasted host, so tests and the e2e use a stub. The test message posts to the saved URL itself.
- The officer types the channel name and the forum flag (owner's comment on issue 451). The bot does not read them.
- Removing a webhook takes no request id, because it is idempotent.

## Deviations

- `pnpm discord:register <guild>` still registers all three commands, because it has no database. D129 records this.
- `registerAppCommands` now takes `{guildId, commands}` targets. `workspaceGuildIds` was removed because nothing uses it any more.

## Verified

- `pnpm check` result: see the commit report.
- Tests added, one per behaviour:
  - `discord/route.test.ts` (5): Check reports the bot missing, then registers only the commands that are on, in this server only; the other server's webhook is refused, our own is saved sealed and never sent back; a repeated request id makes no second check; publishing prefers the saved webhook over the env one and goes back after Remove; the test message pings no one, and no log carries the URL.
  - Features route (1): a switch change re-registers a server that had commands, and leaves alone a server that never had any.
  - `commandsFor` (1).
  - Isolation suite (issue 471): Alpha cannot save a webhook of Bravo's server, and Check asks only about Alpha's server, with Bravo's rows unchanged. `member-session.test.ts` covers the new route (401 for a member, another workspace and no session). The D125 seed covers both new tables (purge, export, `ownedRows`).
- All 52 migrations applied to an empty local Postgres 18.
- **Local e2e** on a production build: local Postgres, an invented guest workspace (`wack`, invented guild), a Discord stand-in, and a preload that sends every discord.com call to the stand-in. **22 of 22 checks pass**, after the persona fixes:
  - the install link is locked to the server, with the right permissions, and ≥ 44 px;
  - Check before the install says "missing", and after it registers only Send to LAPTracker;
  - the other server's webhook is refused, and our own shows "Set · #leadership-notes";
  - the env fallback is shown, and the test message is sent;
  - no token appears in the page HTML;
  - no sideways scroll at 360 and 1280, light and dark, in EN, PT and FR (FR at 360 light only);
  - Remove asks first;
  - the commands `PUT` went only to the workspace's server.
- 13 screenshots are in the scratchpad's `451-shots/`.
- **Persona panel** (new R5 alone, R4, product strategy): "ship with listed fixes". The four agreed fixes are applied and checked again in the e2e:
  - the step 3 lead names Publish to Discord as a button;
  - the private-channel note starts "Only if a channel is private:";
  - the fallback reads "Using a channel the site set up (#name)…";
  - the Manage Server line is above the Add button.
  - Also applied: "without the #" in the name help.
  - Also fixed: after Check the state line no longer repeats as a note.
- No name from the 128 in the OGs fixture rosters appears in the diff.

## Open issues

- Owner step: for another alliance's R5 to add the bot, the Discord app's **Public Bot** must be on (Developer Portal → Bot). D101 said to keep it off. D129 records the change.
- Not done (persona "nice to have"):
  - a "Done" mark on each step;
  - "Checked <date>";
  - a red style for Remove;
  - a "send a test message next" hint after saving;
  - a note that command names stay in English.
- The Check rate limit is 5 per hour. The product persona found "wait an hour" harsh. It is unchanged.
- The new-alliance guide is outside the repo. Steps 6 and 7 still need the new wording.
- Retiring `WORKSPACE_DISCORD_WEBHOOKS`: once OGs shows both channels "set" on /admin, delete the variable and redeploy.
- Not checked against real Discord: the webhook `GET` answer shape (`guild_id`), and a bot guild read answering 403 or 404 when the bot is absent. Both follow Discord's documentation.

## Next

- Model/effort: keep.
- Owner first: turn Public Bot on, then on the deployed site do Check and save both webhooks for OGs, then delete `WORKSPACE_DISCORD_WEBHOOKS`.
- Plan change: none.

<adjustments>
- #453 (invite flow) can reuse `installUrl` and `checkBot` in `lib/private/discord-setup.ts`, and `syncCommands({ only: [id] })` to register commands when the workspace is created.
- #486: `ws_bot_installed` and `ws_webhook_set` exist. Skip them there.
- `app/(private)/w/[slug]/page.tsx` is at the 300-line limit again.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/497
