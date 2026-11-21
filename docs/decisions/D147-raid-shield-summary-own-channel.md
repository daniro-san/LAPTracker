## D147 — The Raid Shield summary gets its own Discord channel: a third webhook, "Raid Shield", in Alliance settings; the leaders' channel stays the fallback (2026-11-21, owner; amends D129, D137, D144)

Why: D137's Raid Shield summary posts through the leaders' webhook. That channel also carries the leadership notices (D102) and the garrison posts (D121). The owner (2026-11-21) wants the summary in a channel of its own; for OGs it will be `#laptracker-ledger`.

**The channel.** `WEBHOOK_CHANNELS` gains `shield` (`lib/schema-discord.ts`). In Alliance settings → Discord it is a third card, "Raid Shield channel" ("Canal do Escudo de raid", "Salon du Bouclier de raid"), after the leaders' and members' cards.

- Its help line: "For the Raid Shield check’s summary. It names the members without a shield seen, so use a channel that only leaders and officers can see." D137 keeps the summary out of the members' channel and anything public. This line asks the officers to keep the new channel the same way.
- While none is saved, the card reads "Not set yet. The summary goes to the leaders’ channel until you set one."
- Save, Send a test message, Replace and Remove are D129's, unchanged. That includes "This is a forum channel", D129's 10 saves, 5 tests per 15 minutes and the request id (D100). The test message reads "LAPTracker can post here. The Raid Shield check’s summary from the Officers’ Desk will come to this channel." Remove asks first and adds "The Raid Shield summary goes back to the leaders’ channel."
- Stored as D129 stores the other two: sealed under `WORKSPACE_KEYS_SECRET`, with `laptracker/webhook-shield/<workspace id>` as associated data. It is opened only at call time, in `lib/shield-post.ts` and in `testWebhook`. No answer, page, log or event carries its URL.
- `WORKSPACE_DISCORD_WEBHOOKS` gets no `shield` entry. It is the notice channels' fallback, and it is being retired (D129).

**Which channel the summary uses** (`summaryHook`, `lib/shield-post.ts`):

1. The Raid Shield channel, when the workspace saved one.
2. Else the leaders' channel, exactly as before: the saved one, else `WORKSPACE_DISCORD_WEBHOOKS`'s `leaders` entry. Nothing changes for a workspace that never saves a Raid Shield channel.
3. A saved Raid Shield webhook that the current master key cannot open ("This webhook needs to be pasted again.") posts nothing. The summary does not go to the leaders' channel or the site's channel in its place: the officers chose to move it out of there.
4. Without `WORKSPACE_KEYS_SECRET` no saved webhook is read at all, and the site's `leaders` entry is used, as before.

**A channel changed while a check is running.** `shield_checks.message_hook` (migration `0063_shield_channel`) stores the sha256 of the webhook URL the message went through, never the URL itself. The host is hashed as `discord.com`, so a URL copied as `discordapp.com` counts as the same webhook. A later tick edits the message only through the same webhook.

- If the webhook changed (a Raid Shield channel saved, replaced or removed between Friday night and Saturday morning), the next tick posts a fresh message in the new channel and edits that one from then on. The old message stays as it was, and nothing tries to edit it.
- `gone` (D137: Discord said the message was deleted) holds only for the webhook it was set under. A deleted message in the old channel does not stop the post in a new one.
- A check that has a message id but no `message_hook` was posted before this change, so it went through the leaders' channel. It counts as the same webhook while the summary still goes to the leaders' channel: it is edited, and a `gone` mark still holds, so D137's "never posted again that night" is kept across the deploy. Once a Raid Shield channel is used, that message counts as another channel's.

Forum channels keep #555's handling: the first post carries `thread_name` (the title without its `**`), and an edit sends `?thread_id=<message id>`. That holds for whichever channel is used.

**Alliance settings → Raid Shield check** (amends D137's quoted words). The switch "Post the summary to the leaders' channel" now reads "Post the summary to Discord" ("Postar o resumo no Discord", "Publier le résumé sur Discord"). Its help line adds "It goes to the Raid Shield channel, or to the leaders' channel while that one is not set." The switch can be turned on when the summary has a channel: the Raid Shield channel when one is saved, else the leaders' channel. When it cannot, the note is one of two:

- a saved Raid Shield webhook must be pasted again: "Paste the Raid Shield channel's webhook again under Discord first. Until then the summary is not posted.";
- otherwise: "Set up the Raid Shield channel or the leaders' channel under Discord first."

**Analytics.** `ws_webhook_set`'s `channel` gains `shield` (`lib/analytics/events.ts`, the tracking plan).

**/admin.**

- The Workspaces line gains "· Raid Shield webhook: set" or "not set". It has no `env` value, since the variable has no `shield` entry.
- D144's Alliances table counts the shield summary from `shield_checks.posted_at`, so it counts the same whichever channel the summary went to. A fresh post after a channel change stamps `posted_at` again, and it is still one summary a day. Nothing else in the table names a channel.

**Owner steps.** Nothing in Vercel. For OGs, in Alliance settings → Discord → Raid Shield channel:

1. In Discord, open `#laptracker-ledger`'s settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
2. Paste it, type `laptracker-ledger`, tick "This is a forum channel" only if it is one, and tap "Check and save".
3. Then "Send a test message".

From the next check, the summary goes there.

**Tests** (`lib/shield-post.test.ts`, stubs only):

- with a Raid Shield channel saved, the summary goes there, as a titled forum post and its `thread_id` edit, and never to the leaders' channel;
- with none saved, it goes to the leaders' channel the workspace saved;
- a Raid Shield webhook sealed under another master key posts nothing, and nothing goes to the leaders' channel;
- a channel changed between Friday and Saturday gets a fresh post, and later edits go through the new webhook.

The existing tests in `lib/shield-read.test.ts` still pass: the site's leaders channel as the fallback, and #555's forum test. `app/(private)/api/w/[slug]/discord/route.test.ts` now expects the save's answer to list three channels.
