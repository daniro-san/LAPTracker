## D147 — The Raid Shield summary posts only to its own Discord channel: a third webhook, "Raid Shield", in Alliance settings; without it no summary is posted (2026-11-21, owner; amends D129, D137, D144)

Why: D137's Raid Shield summary posted through the leaders' webhook. That channel also carries the leadership notices (D102) and the garrison posts (D121). The owner (2026-11-21) wants the summary in a channel of its own; for OGs it will be `#laptracker-ledger`. **Owner's rule, the same day: if the Raid Shield channel is not set, no shield message is sent. It never falls back to the leaders' channel.**

**The channel.** `WEBHOOK_CHANNELS` gains `shield` (`lib/schema-discord.ts`). In Alliance settings → Discord it is a third card, "Raid Shield channel" ("Canal do Escudo de raid", "Salon du Bouclier de raid"), after the leaders' and members' cards.

- Its help line: "For the Raid Shield check’s summary. It names the members without a shield seen, so use a channel that only leaders and officers can see. Without this channel, no summary is posted." D137 keeps the summary out of the members' channel and anything public. This line asks the officers to keep the new channel the same way.
- While none is saved, the card reads "Not set yet. No Raid Shield summary is posted until you set one."
- The step's lead line adds "The Raid Shield check’s summary is posted only to its own channel."
- The form's help lines describe the summary: "As Discord shows it, without the #. Example: raid-shield." and "Then each week’s summary opens its own post in the forum."
- Save, Send a test message, Replace and Remove are D129's, unchanged. That includes "This is a forum channel", D129's 10 saves, 5 tests per 15 minutes and the request id (D100).
  - The test message reads "LAPTracker can post here. The Raid Shield check’s summary from the Officers’ Desk will come to this channel."
  - Remove asks first and adds "The Raid Shield summary is no longer posted."
- Stored as D129 stores the other two: sealed under `WORKSPACE_KEYS_SECRET`, with `laptracker/webhook-shield/<workspace id>` as associated data. It is opened only at call time, in `lib/shield-post.ts` and in `testWebhook`. No answer, page, log or event carries its URL.
- `WORKSPACE_DISCORD_WEBHOOKS` gets no `shield` entry. It is the notice channels' fallback, and it is being retired (D129).

**Which channel the summary uses** (`summaryHook`, `lib/shield-post.ts`): the Raid Shield channel the workspace saved, and nothing else. No summary is posted when:

- no Raid Shield channel is saved, even if the leaders' channel is;
- the saved one was sealed under another master key ("This webhook needs to be pasted again.");
- the site has no `WORKSPACE_KEYS_SECRET`.

The leaders' channel and `WORKSPACE_DISCORD_WEBHOOKS`'s `leaders` entry are never used for this message. **Existing workspaces** that had the switch on and posted to the leaders' channel stop posting until they save a Raid Shield channel. That is intended, and Settings and /admin say so (below).

**A changed channel and older messages.** `shield_checks.message_hook` (migration `0063_shield_channel`) stores the sha256 of the webhook URL the message went through, never the URL itself. The host is hashed as `discord.com`, so a URL copied as `discordapp.com` counts as the same webhook. A later tick edits the message only through the same webhook.

- If the Raid Shield webhook changed between Friday night and Saturday morning (replaced with another channel's), the next tick posts a fresh message in the new channel and edits that one from then on. The old message stays as it was, and nothing tries to edit it.
- `gone` (D137: Discord said the message was deleted) holds only for the webhook it was set under. A deleted message in the old channel does not stop the post in a new one.
- A message id from before this change has no `message_hook`. It went through the leaders' channel, so it is never edited. The next window posts fresh, to the Raid Shield channel only, if one is set.

Forum channels keep #555's handling: the first post carries `thread_name` (the title without its `**`), and an edit sends `?thread_id=<message id>`.

**Alliance settings → Raid Shield check** (amends D137's quoted words).

- The switch "Post the summary to the leaders' channel" now reads "Post the summary to Discord" ("Postar o resumo no Discord", "Publier le résumé sur Discord").
- Its help line ends "It is posted only to the Raid Shield channel set up under Discord. Never to the leaders' or members' channel."
- The switch can be turned on only when a Raid Shield channel is saved. Its note says why when there is none:
  - off, with no channel: "The summary needs the Raid Shield channel. Set it up under Discord first.";
  - on, with no channel (an existing workspace): "On, but no summary is posted: the Raid Shield channel is not set up under Discord.";
  - a saved one that must be pasted again: "Paste the Raid Shield channel's webhook again under Discord first. Until then the summary is not posted."

**Analytics.** `ws_webhook_set`'s `channel` gains `shield` (`lib/analytics/events.ts`, the tracking plan).

**/admin.**

- The Workspaces line gains "· Raid Shield webhook: set" or "not set (no summary posted)". It has no `env` value, since the variable has no `shield` entry.
- D144's Alliances table counts the shield summary from `shield_checks.posted_at`, so it counts the same whichever channel the summary went to. A fresh post after a channel change stamps `posted_at` again, and it is still one summary a day. Nothing else in the table names a channel.
- The owner's to-do reads "Set the Raid Shield channel (Alliance settings → Discord) before Friday 23:30 ST; without it no summary is posted."

**Owner steps.** Nothing in Vercel. For OGs, before Friday 23:30 ST, in Alliance settings → Discord → Raid Shield channel:

1. In Discord, open `#laptracker-ledger`'s settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
2. Paste it, type `laptracker-ledger`, tick "This is a forum channel" only if it is one, and tap "Check and save".
3. Then "Send a test message".

Without it, OGs gets no Raid Shield summary.

**Tests** (stubs only):

- `lib/shield-post.test.ts`:
  - with a Raid Shield channel saved, the summary goes there, as a titled forum post and its `thread_id` edit, and never to the leaders' channel;
  - with none saved, nothing is posted and the leaders' channel is never called;
  - a Raid Shield webhook sealed under another master key posts nothing;
  - a message from before this change is never edited, a changed Raid Shield webhook gets a fresh post, and later edits go through the new webhook.
- `lib/shield-read.test.ts`: the tick's posting tests (#555's forum test included) post through a saved Raid Shield channel.
- `app/(private)/api/w/[slug]/discord/route.test.ts`: the save's answer lists three channels.
