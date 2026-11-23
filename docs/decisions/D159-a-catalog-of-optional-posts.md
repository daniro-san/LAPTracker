## D159 — A catalog of optional posts: a code table, two layers, off until the alliance turns a post on, sent once per period in a tick that opens the database anyway; post 1 "This week in the alliance" (2026-11-23, owner, issue 713 part C; amends D125, D129, D134, D141, D156)

Why: the owner (issue 713, approved in the chat on 2026-11-22 and recorded on the issue) wants LAPTracker to make a few posts for an alliance on its own, from a catalog: 1 This week in the alliance, 2 Shield-up reminder, 3 Welcome new members, 4 Weekly members summary (leaders' channel), 5 KvK recap. A new alliance gets each post allowed by the owner but off until it turns the post on. This decision builds the catalog and post 1; posts 2 to 5 are follow-ups.

**The catalog** (`POST_CATALOG`, `lib/post-catalog.ts`, pure). One entry per post, keyed by its template (`CATALOG_POSTS` in `lib/schema-discord.ts`, today `week`). Each entry names:

- `feature`: the owner's layer, a D134 feature (`post_week`);
- `weekday`: when it is due, a server weekday (0 = Monday);
- `audience` and `channels`: who reads it (its default channel) and the channels officers may pick, the two notice channels (D129);
- `editable`: whether officers may change its weekday or turn a picture on. Post 1 has neither: the calendar week starts on Monday, and the post has no picture.

Every post also has an officers' title (at most 80 graphemes, empty: ours, in the post's language), the language it is written in (English, Português, Français; the tick has no officer whose language it could use, as D137's summary), and the alliance's own line (D156, its key is the post's key).

**Two layers** (D134).

1. **The owner allows the post.** Its feature is in /admin's Discord group ("Post: This week in the alliance (off until the alliance turns it on)") and in "Defaults for new alliances". It spends nothing, so the code's default allows it, for OGs too.
2. **The alliance turns it on** in Alliance settings → Posts. `workspace_posts.on`, false without a row: every post is off for every alliance, OGs included, until its officers turn it on. The catalog's features are not listed on the Features card, and `POST /api/w/[slug]/features` refuses them (`bad_request`): the post's own switch is the alliance's layer.

A post goes out only while both say on. With either off nothing is sent and nothing is claimed, so turning it on later that Monday still sends that week's post at the next tick that opens the database.

**Storage** (migration `0075_post_catalog`).

- `workspace_posts(workspace_id → workspaces on delete cascade, post_key, on, channel in (members, leaders), weekday 0–6 or null (the catalog's day), title, picture, language in (en, pt-BR, fr), updated_by → workspace_users on delete set null, updated_at)`, primary key (workspace, post). A save of the values already stored writes nothing.
- `post_runs(workspace_id → workspaces on delete cascade, post_key, period, status in (posting, posted, failed, unanswered), sent, attempts, at)`, primary key (workspace, post, period). The period is the post's server day (`2026-11-23`).
- **At most once** (INVARIANT `posts.once-per-period`, `claimPostRun`): the claim is one insert, or one conditional update of a failed claim. However many ticks overlap, exactly one caller gets it.
  - A send that Discord refused with an error before any message went through (`failed`, `sent = 0`) is claimed again by a later tick of the same period, up to 3 attempts.
  - A send Discord never answered (`unanswered`: a timeout or a lost connection) is never sent again: Discord may have posted it, and the adversarial review asked that a lost answer never double the week.
  - A send that got part way is never sent again either, since a second send would repeat its first messages.
- `workspace_post_touches.post_key` also allows `week` (D156's line).

**When the tick sends** (`lib/posts-tick.ts`, D141). After `runTick`, on a tick that already passed `tickMayBeDue` (so the database is awake), the route calls `schedulePostsTick`. The clock comes first: on a day when no catalog post is due (`postsMayBeDue`) nothing is scheduled and nothing is read. On a due day it sends, after the answer and on its own connection, every post whose period has no claim yet. `tickMayBeDue` is not widened: a post never wakes the database.

Post 1's period is Monday, server time, which starts after Sunday's end-of-day read (D72, 23:30 ST). In practice it goes at the first tick that opens the database on Monday: the squads queue's tick after Sunday's read, or at the latest the heartbeat at 01:00 ST (03:00 UTC, D141). Alliance settings says "Every Monday, between 00:00 and 01:15 ST, in #channel." The 01:15 is the end of the first heartbeat slot after 00:00 ST, computed from `SERVER_TZ` and `HEARTBEAT_EVERY_H` (`sendBy`).

**The second lib/private import from the tick.** The post is made and sent by `lib/private/catalog-posts.ts`. `lib/posts-tick.ts` may import that one module (an `eslint.config.mjs` zone, like D148's `push-roll-calls.ts`). Reasons:

- the post reuses the calendar's own words in three languages (`titleOf`, `stOf`, the day headings);
- it reuses the notice channels and their site fallback (`noticeChannels`, D129);
- it reuses the notices' 2,000-character split and send loop with its forum title (`discordMessages`, `postMessages`, D102), rather than copying any of them into `lib/`.

The module reads the calendar entries members can see and no roster field.

**Post 1, "This week in the alliance".**

- Holds the week's calendar entries (Monday to Sunday) that officers marked "Members can see this", as the members' board shows them (D105): the Alliance Duel theme first, then each day with an entry, one line per entry: "18:00 ST · Cheese Trap I · Lv.7". An entry is named as the calendar names it.
- Leaves out entries not marked for members, caravan seats, notes, links, the author and every roster field. It names no person (D71, D75).
- An officer's own words (the post's title, an entry's name) link nothing. `breakLinks` (`lib/post-callout.ts`, split out of D156's `discordCallout`) puts the zero-width break into web addresses, host dots and channel or command mentions. The notices' formatter then escapes markdown and breaks `@everyone`, `@here` and `<@`.
- Every message carries `allowed_mentions: {"parse": []}`.
- A week with no entry for members posts nothing and claims nothing: no empty post.
- Sent as plain `content` to the chosen channel (the workspace's own webhook, else the site's `WORKSPACE_DISCORD_WEBHOOKS` one, as notices). Without a usable webhook nothing is sent or claimed, and the card says so: "Nothing is posted until the members' channel is set up: paste its webhook under Discord, above."
- The alliance's line (D156) goes first, then our title in bold, then the week. Split into messages of at most 2,000 characters at line breaks.
- In a forum channel the first message opens a post whose title (`thread_name`) is the post's title, and the rest go into it.
- The log carries `posts.week.sent` or `posts.week.failed` with counts and the HTTP status. A workspace whose send throws is reported as `w.posts.send_failed` (a closed pair, D115) and never stops the others.

**Alliance settings → Posts** (`PostCatalog.tsx`, after Discord and before "Your line on our posts"; EN, PT-BR, FR in `lib/private/dictionary.posts.ts`).

- Shown while the owner allows any catalog post. One group per post: its name, what it holds ("… No player names, notes or links. Nothing is posted in a week with none."), and a 44 px "Post it" switch.
- Right under the switch, "Next post" in plain words: "Every Monday, between 00:00 and 01:15 ST, in #general.", "Off: nothing is posted.", or, in yarn and semibold, "Nothing is posted until the members' channel is set up: paste its webhook under Discord, above." (persona check: below the fold it was missed).
- A Channel select ("Members' channel (#general)", or "(not set up)") and the day as text ("Every Monday: the calendar week starts then.").
- A Title field ("Leave it empty for "This week in the alliance".", "n of 80 characters", in seal past it with `aria-invalid`) and a "Language of the post" select.
- One Save for the card (issue 585's save row). The index has a row "Posts · 1 of 1 on". "Your line on our posts" lists "This week in the alliance" while the owner allows it.
- `POST /api/w/[slug]/posts {post, on, channel, title, language}`. Officers only, same origin, JSON (401 `signed_out` for a member's or another workspace's session).
  - 403 `not_allowed` when the owner does not allow the post.
  - 400 `bad_channel` or `too_long`.
  - 429 `rate_limited`: at most 30 saves per 15 minutes per workspace (`auth_attempts` key `posts:ws:<id>`).
  - It answers the cleaned title.

**Download and delete** (D125). `workspace_posts` is downloaded as `posts.csv` (the officers' title and choices) and deleted with the workspace. `post_runs` is deleted with it and never downloaded: codes and counts, like the push marks.

**Analytics.** `ws_action` feature `posts`, with the property `post` (closed list: `week`):

- `turn_on` or `turn_off`: a save that changed the switch;
- `save`: a save that changed anything else.

A save of the same values sends nothing, and the title never goes. The posts sent are counted from `post_runs`, not as events (tracking plan, Changed 2026-11-23).

**Tests.**

- `lib/private/catalog-posts.test.ts` (PGlite):
  - two overlapping ticks and a later one send Monday's post once, nothing on Sunday, and its exact text;
  - with the switch off, or the owner's not allowed, nothing is sent or claimed, and it goes once both are on;
  - no roster value, member name, note, live link or ping in the body (a sentinel scan with a positive control), and `allowed_mentions` is empty;
  - a long week splits under 2,000 characters, and in a forum the first message carries the title;
  - a refused send is tried 3 times and no more, and an unanswered one once.
- `app/api/tick/posts.test.ts`: `POST /api/tick` on a Monday posts the week after its answer at the 01:00 ST heartbeat, an idle 00:30 ST tick answers 204 and schedules nothing, and the next heartbeat sends nothing more. This is the step the e2e suite cannot drive, since its server runs on the real clock.
- `PostCatalog.test.ts`: the labels, the next-post line in its three states (the warning in yarn, between the switch and the channel), the title count and the too-long state.
- E2E `e2e/desk-posts.spec.ts`: an officer turns the post on for the leaders' channel with a title, the next-post line says when and where, and all of it survives a reload; the index counts it on; the test turns it off again.
- The D125 purge and download tests cover both tables through the seed. Dropping either from `WORKSPACE_TABLES` fails the purge test (proved once).

**Persona check** (build agent, on the real card at 360 × 780, the e2e seed's invented alliance; each persona saw the first screen for about 5 seconds, then the rest; the Discord text of the test above).

- R5 in a hurry, "Will our members get a weekly calendar post, and is it on now?": right ("off, would go to the members' channel"). But after ticking "Post it" nothing on screen changed, and "(not set up)" was small text inside the select: he would have saved and believed it posts. MUST, adopted: "Next post" moved right under the switch, the no-webhook state in yarn and semibold.
- Officer reading English as a second language, "What exactly will it post, and will it ping everyone?": right ("the entries for members, with server times, pings no one"). "No names" read as "the event names are removed too". Adopted: "No player names, notes or links."
- Officer in her 50s, "When and where does the next post go out?": wrong from the first screen ("Monday, in the members' channel", though nothing would go out there), and the time was below the fold in small grey type. Adopted: the move above, and "Next post" in body size and full contrast.
- Product strategist: high value; it replaces a weekly chore and gives officers a reason to mark entries for members. Measure adoption (`turn_on` less `turn_off`), turn-offs within 14 days of the first send, failures from `post_runs`. Not adopted here, follow-ups: a `channel_ready` property on `save`, empty weeks recorded in `post_runs`, a post for entries added mid-week.
- Adversarial (spam, D75, private fields): one post per Monday per alliance; turning it off and on again does not post again; nothing ranks, scores or names a person; no roster field is read, and seats, notes and links are left out; the alliance's line goes through D156's `discordCallout`. One finding, adopted: a timeout may still have posted, so a send Discord never answered is not tried again (`unanswered`).
- Not adopted (COULD): a preview of the message on the card, and the officer's own time beside ST.

**Not done here.** Posts 2 to 5 (issue 713 parts D–G). A post whose weekday or picture officers may change (the columns exist, the route does not take them yet). A "last posted" line on the card. Home's recent activity for a post's settings.
