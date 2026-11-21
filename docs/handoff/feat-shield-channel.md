# feat: the Raid Shield summary gets its own Discord channel (D147)

## Built

- `lib/schema-discord.ts`: `WEBHOOK_CHANNELS` is `leaders`, `members`, `shield`. The `workspace_webhooks_channel_check` constraint allows `shield`.
- `lib/schema-shield.ts`: `shield_checks.message_hook` holds the sha256 of the webhook URL the summary went through, never the URL itself.
- Migration `0063_shield_channel` (generated with `pnpm db:generate --name shield_channel`): it adds the column and swaps the check constraint.
- `lib/shield-post.ts`:
  - `summaryHook` picks the channel: the saved Raid Shield webhook first, then the leaders' webhook as before (the saved one, then `WORKSPACE_DISCORD_WEBHOOKS`'s `leaders` entry).
  - A saved Raid Shield webhook that the master key cannot open posts nothing. It never falls back to the leaders' channel.
  - `postedThrough` edits the stored message, or treats it as `gone`, only when it went through the same webhook. If the webhook changed, the summary is posted fresh in the new channel.
  - A message from before this change (`message_hook` null) went through the leaders' channel, so it counts as the same webhook while the summary still goes there.
  - The host is hashed as `discord.com`, so a `discordapp.com` copy of the same URL counts as the same webhook.
  - #555's forum handling is unchanged: `thread_name` on the first post, `?thread_id=` on edits.
- `lib/repo/shield-checks.ts`: `keepMessage` stores the hook's hash.
- `lib/private/discord-webhooks.ts`:
  - `shield` has no `WORKSPACE_DISCORD_WEBHOOKS` fallback (`siteHook`).
  - `opened` opens one channel's webhook. `noticeChannels` still opens only `members` and `leaders`. `testWebhook` opens only the channel being tested.
- Alliance settings → Discord (`DiscordChannels.tsx`) has a third card, "Raid Shield channel". It has:
  - the D137 help line;
  - its own unset line ("…goes to the leaders’ channel until you set one");
  - its own Remove line;
  - its own test message.

  Save, Replace, Remove, Test and the forum box are the same as on the other cards.
- Alliance settings → Raid Shield check:
  - The switch label is now "Post the summary to Discord", and its help names both channels.
  - `summaryChannel` (settings page) follows `summaryHook`: the Raid Shield channel's state once one is saved, else the leaders' channel's. It answers `ok`, `reenter` or `none`.
  - With `reenter`, the switch's note says to paste the Raid Shield webhook again (`prep.settings.reenter`).
  - The prop `leaders: boolean` was replaced by `channel`.
- Copy in EN, PT-BR and FR: `lib/private/dictionary.discord.ts`, `dictionary.discord-fr.ts`, `dictionary.raidprep.ts`.
- `ws_webhook_set`'s `channel` gains `shield` (`lib/analytics/events.ts`, `docs/analytics/tracking-plan.md`).
- /admin: the Workspaces line gains "· Raid Shield webhook: set|not set" (`lib/copy-admin-workspaces.ts`, `Workspaces.tsx`).
- Docs:
  - D147 (new), with dated amendments in D129 and D137;
  - the decisions README index;
  - the D129 line in `docs/ARCHITECTURE.md`.
- `lib/shield-post.test.ts` (new, 4 tests):
  - the Raid Shield channel is used once saved, including a forum post and its `thread_id` edit, and the leaders' channel gets nothing;
  - with none saved, the summary goes to the leaders' channel the workspace saved;
  - a Raid Shield webhook under another master key posts nothing, and the leaders' channel gets nothing;
  - a channel changed since Friday gets a fresh post, and later edits go through the new webhook.

## Decisions

- This is a new decision, D147, not only an amendment. It adds a channel, a column, a fallback rule and changes copy that D137 quotes. D146 is taken on another branch, so I checked the highest number first.
- The marker for "which channel posted" is the sha256 of the webhook URL. Other options were considered:
  - The channel slot (`shield`/`leaders`) would miss a Replace with another channel's webhook. The edit would then hit Discord's 404, and the summary would be marked `gone` for the night.
  - The webhook id is part of the secret URL.

  Discord tokens are random, so the hash cannot be reversed.
- `gone` applies only to the webhook it was set under. A message deleted in the old channel does not block the post in the new one.
- A saved Raid Shield webhook that must be pasted again ("reenter") posts nothing, as D129 does for a notice channel. The officers chose to move the summary out of the leaders' channel, so it never falls back there.
- `WORKSPACE_DISCORD_WEBHOOKS` gets no `shield` key, since the variable is being retired (D129).
- The D144 Alliances table counts the summary from `shield_checks.posted_at`, which is the same whichever channel is used. No code change was needed there; D147 records this.

## Deviations

- The task asked for the tests "sized like their neighbours". `lib/shield-read.test.ts` is at the 300-line lint limit, so the channel tests are in a new file, `lib/shield-post.test.ts`. They call `postShieldSummary` directly with a Discord stub.
- `postShieldSummary` went over the complexity limit (12), so the same-webhook check moved into `postedThrough`.
- The switch label "Post the summary to the leaders' channel" (quoted in D137) was changed, because it became wrong once a Raid Shield channel is set. The change is recorded in D147.

## Verified

- `pnpm vitest run lib/shield-post.test.ts lib/shield-read.test.ts`: 15 of 15 pass. That is the 4 new tests plus the 11 existing ones, including #555's forum test and the site-leaders fallback.
- `app/(private)/api/w/[slug]/discord/route.test.ts` now expects three channels in the save's answer. It passes.
- Mutation check: with the same-webhook comparison removed from `postedThrough`, the "posts fresh in a channel changed" test fails. It passes again once restored.
- `pnpm check` (prettier, eslint, tsc, vitest, drift, i18n) passes after the panel's fixes:
  - 285 test files and 1,475 tests pass, 4 skipped;
  - drift reports "Everything's fine";
  - i18n reports "17 languages up to date".
- In an earlier run, `lib/queries/roster-stays.test.ts` timed out while the QA build was running. It passed when run alone.
- Adversarial review (subagent). Its result reached the orchestrator, which relayed it to me.
  - One MUST: the route test's expected channels. Fixed.
  - Five more items, all applied: the switch's note when the Raid Shield webhook must be pasted again; legacy rows count as the leaders' webhook; the host is normalised before hashing; a test for the paste-again case; the test file path in D147.
  - It found no problem with secrets and leaks, the fallback and `canPost`, isolation, the migration, the D125 export or i18n.
- QA (subagent): a local production build (`next build` and `next start`) on the local Postgres with all 64 migrations, an invented workspace and officer, and a node stub for Discord's webhook GET. No request went to discord.com, and "Send a test message" was not tapped.
  - 52 of 52 checks passed, with no MUST.
  - At 360 px, in light and dark, EN and PT, and at 1280 px: the three cards are in order, nothing overflows, and every touch target is at least 44 px.
  - Save with the forum box ticked, then Replace with it unticked: both answered 200, the database row changed to match, and the stored value was encrypted.
  - The webhook URL, id and token appear 0 times in the responses, the page HTML, the /admin HTML and the server log.
  - The Remove sheet shows the Raid Shield line.
  - The switch label is right, and the switch is enabled or disabled correctly for no channel, Raid Shield only and leaders only.
  - /admin shows "Raid Shield webhook: set".
  - Screenshots are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/qa-shield/`.
  - QA ran before the reviewer's fixes. The "paste again" note is covered by typecheck and the code path, not by a screenshot.
  - Applied from QA: the step's lead line now mentions the Raid Shield channel (EN, PT, FR), and there is a gap under the card's help line.

## Open issues

- A check posted before this deploy has `message_hook` null. It is edited as before, unless a Raid Shield channel is saved during that check: then it gets a fresh post there.
- Follow-up, not done: the old message in the previous channel stays as it was (Friday's summary). The task said not to edit it.
- Follow-up, not done: the French raid-prep copy says "salon des dirigeants", while the Discord section says "salon des chefs" for the same channel. This is pre-existing and unchanged here.
- Done after the panel (orchestrator's call): the Raid Shield card's name and forum help lines describe the summary ("Example: raid-shield.", "Then each week’s summary opens its own post in the forum.") in EN, PT and FR. The card's French copy says "salon des chefs" throughout. The step heading "3. Channels for notices" is quoted in D129 and was left as it is. Its lead line now adds "The Raid Shield check’s summary can have a channel of its own."
- Follow-up, not done: the comments in `lib/shield-tick.ts`, `lib/shield-read.ts`, `lib/private/shield-settings.ts` and the raid-prep route still say "leaders' channel".

## Next

- Model/effort: keep.
- Owner first: merge and deploy before Friday 23:30 ST. Then, in OGs' Alliance settings → Discord → Raid Shield channel:
  1. paste `#laptracker-ledger`'s webhook (Discord: channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL);
  2. type `laptracker-ledger`;
  3. tick "This is a forum channel" only if it is one;
  4. tap Check and save, then Send a test message.
- Plan change: none.

<adjustments>
- The Raid Shield summary's webhook is chosen by `summaryHook` in `lib/shield-post.ts`: `shield` when saved, else `leaders`. A message is edited only through the webhook whose sha256 is in `shield_checks.message_hook`. Any future writer that edits a stored Discord message should keep the same "same webhook or post fresh" rule.
- Migration `0063_shield_channel` may need renumbering at merge if another branch took 0063.
</adjustments>

PR: (added by the orchestrator)
