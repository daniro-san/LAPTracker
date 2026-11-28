## D159 — A catalog of optional posts: a code table, two layers, off until the alliance turns a post on, sent once per period in a tick that opens the database anyway; post 1 "This week in the alliance" (2026-11-23, owner, issue 713 part C; amends D71, D125, D129, D134, D141, D156)

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
- `post_runs(workspace_id → workspaces on delete cascade, post_key, period, status in (posting, posted, failed, unanswered, skipped), sent, attempts, at)`, primary key (workspace, post, period). The period is the post's server day (`2026-11-23`).
- **At most once** (INVARIANT `posts.once-per-period`, `claimPostRun`): the claim is one insert, or one conditional update of a failed claim. However many ticks overlap, exactly one caller gets it.
  - The claim comes after the post is built (its title, the alliance's line, its messages), right before the send, so a build that throws leaves no claim and the next tick of the period tries again (review of PR 761).
  - A send that Discord refused with an error before any message went through (`failed`, `sent = 0`) is claimed again by a later tick of the same period, up to 3 attempts.
  - A send Discord never answered (`unanswered`: a timeout or a lost connection) is never sent again: Discord may have posted it, and the adversarial review asked that a lost answer never double the week.
  - A send that got part way is never sent again either, since a second send would repeat its first messages.
- `workspace_post_touches.post_key` also allows `week` (D156's line).

**When the tick sends** (`lib/posts-tick.ts`, D141). After `runTick`, on a tick that already passed `tickMayBeDue` (so the database is awake), the route calls `schedulePostsTick`. The clock comes first: on a day when no catalog post is due (`postsMayBeDue`) nothing is scheduled and nothing is read. On a due day it sends, after the answer and on its own connection, every post whose period has no claim yet. `tickMayBeDue` is not widened: a post never wakes the database.

The posts have 120 s from the tick's answer (`POSTS_BUDGET_MS`; they run beside the squads batch's 180 s in the function's 300 s). A workspace's send starts only while 45 s of that are left (`POST_START_MS`: the notices' loop gives one post's messages at most 40 s), and the workspaces whose turn did not come wait for the next tick of the period (review of PR 761).

Later ticks of the same Monday stay cheap. A posted, unanswered or settled week drops out of the one query that lists the posts due (`postsDue`), and a week with no entry for members is settled (`skipped`) the first time. A post the owner does not allow costs one read per tick, and a channel with no usable webhook two; neither is settled, so the owner allowing the post or an officer pasting the webhook later that Monday still sends the week.

Post 1's period is Monday, server time, which starts after Sunday's end-of-day read (D72, 23:30 ST). In practice it goes at the first tick that opens the database on Monday: the squads queue's tick after Sunday's read, or at the latest the heartbeat at 01:00 ST (03:00 UTC, D141). Alliance settings says "Every Monday, between 00:00 and 01:15 ST, in #channel." The 01:15 is the end of the first heartbeat slot after 00:00 ST, computed from `SERVER_TZ` and `HEARTBEAT_EVERY_H` (`sendBy`).

**The second lib/private import from the tick.** The post is made and sent by `lib/private/catalog-posts.ts`. `lib/posts-tick.ts` may import that one module (an `eslint.config.mjs` zone, like D148's `push-roll-calls.ts`). Reasons:

- the post reuses the calendar's own words in three languages (`titleOf`, `stOf`, the day headings);
- it reuses the notice channels and their site fallback (`noticeChannels`, D129);
- it reuses the notices' 2,000-character split and send loop with its forum title (`discordMessages`, `postMessages`, D102), rather than copying any of them into `lib/`.

The module reads the calendar entries members can see and no roster field. This is a second exception to D71's fence, recorded there (amendment 2026-11-23).

**Post 1, "This week in the alliance".**

- Holds the week's calendar entries (Monday to Sunday) that officers marked "Members can see this", as the members' board shows them (D105): the Alliance Duel theme first, then each day with an entry, one line per entry: "18:00 ST · Cheese Trap I · Lv.7". An entry is named as the calendar names it.
- Leaves out entries not marked for members, caravan seats, notes, links, the author and every roster field. It names no person (D71, D75).
- An officer's own words (the post's title, an entry's name) link nothing. `breakLinks` (`lib/post-callout.ts`, split out of D156's `discordCallout`) puts the zero-width break into web addresses, host dots and channel or command mentions. The notices' formatter then escapes markdown and breaks `@everyone`, `@here` and `<@`.
- Every message carries `allowed_mentions: {"parse": []}`.
- A week with no entry for members posts nothing: no empty post. It is settled as `skipped`, so an entry added later that Monday does not post that week.
- Sent as plain `content` to the chosen channel (the workspace's own webhook, else the site's `WORKSPACE_DISCORD_WEBHOOKS` one, as notices). Without a usable webhook nothing is sent or claimed, and the card says so: "Nothing is posted until the members' channel is set up: paste its webhook under Discord, above."
- The alliance's line (D156) goes first, then our title in bold, then the week. Split into messages of at most 2,000 characters at line breaks.
- In a forum channel the first message opens a post whose title (`thread_name`) is the post's title, and the rest go into it.
- The log carries `posts.week.sent` or `posts.week.failed` with counts and the HTTP status. A workspace whose send throws is reported as `w.posts.send_failed` (a closed pair, D115) and never stops the others.

**Alliance settings → Posts** (`PostCatalog.tsx`, after Discord and before "Your line on our posts"; EN, PT-BR, FR in `lib/private/dictionary.posts.ts`).

- Shown while the owner allows any catalog post. One group per post: its name, what it holds ("… No player names, notes or links. Nothing is posted in a week with none."), and a 44 px "Post it" switch.
- Right under the switch, "Next post" in plain words: "Every Monday, between 00:00 and 01:15 ST, in #general.", "Off: nothing is posted.", or, in yarn and semibold, "Nothing is posted until the members' channel is set up: paste its webhook under Discord, above." (persona check: below the fold it was missed).
- A Channel select ("Members' channel (#general)", or "(not set up)") and the day as text ("Every Monday: the calendar week starts then.").
- A Title field ("Leave it empty for "This week in the alliance".", our title in the language the post is written in; "n of 80 characters", in seal past it with `aria-invalid`) and a "Language of the post" select.
- One Save for the card (issue 585's save row). The index has a row "Posts · 1 of 1 on". "Your line on our posts" lists "This week in the alliance" while the owner allows it.
- `POST /api/w/[slug]/posts {post, on, channel, title, language}`. Officers only, same origin, JSON (401 `signed_out` for a member's or another workspace's session).
  - 403 `not_allowed` when the owner does not allow the post.
  - 400 `bad_channel` (a channel the catalog does not offer for the post; post 1 offers both) or `too_long`.
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
  - a refused send is tried 3 times and no more, an unanswered one once, and a partly delivered one never again;
  - an empty week posts nothing and is settled; the alliance's line sits above our title; a build that throws leaves no claim and the next tick sends; a deadline in reach starts no send.
- `app/(private)/api/w/[slug]/posts/route.test.ts`: the cleaned title, 403 `not_allowed`, 400 `bad_channel` (a catalog entry narrowed to the leaders' channel), 400 `too_long` at 81 graphemes, 401 for a member, 429 on the 31st save; `turn_on`, `save`, `turn_off` with `post`, none for the same values, never the title. `features/route.test.ts`: the Features card lists no `post_week` and refuses it (400).
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

**Amendment 2026-11-23 (issue 713 part G): post 2, "Shield-up reminder".**

- **What.** On Friday evening, one reminder to the members' channel before the raid at the server reset (00:00 ST, D137): make sure your shield is on, take your squads off the wall and bring your troops home, because a shield does not protect troops outside. It reuses the words of D137's message to many ("make sure your shield is on", not "turn on": some already have one). EN "The raid starts at the reset (00:00 ST). Before then, please make sure your shield is on, take your squads off the wall and bring your troops home: a shield doesn't protect troops outside. Thanks, everyone!", PT-BR "O raid começa no reset (00:00 ST). Antes disso, por favor confirmem que o escudo está ligado, …", FR "Le raid commence au reset (00:00 ST). D'ici là, pensez à vérifier que votre bouclier est actif, …". Our title: "Shield up before the reset" ("Escudo ligado antes do reset", "Bouclier actif avant le reset").
- **No names, no counts, no pings.** The text is the same every Friday. The sender reads no roster, reading, mark or count for it. The officers' title and the alliance's line (D156) go through the same `breakLinks` and formatter as post 1, and `allowed_mentions` is `{"parse": []}`.
- **Not linked to the Raid Shield check.** It sends whether `shield_check` is on or off, and reads none of the check's tables.
- **Catalog entry.** Key `shield_up` (not `shield`: `POST_KEYS` already has `shield` for the Raid Shield summary's line, D156). Feature `post_shield_up` in D134's Discord group, /admin "Post: Shield-up reminder (off until the alliance turns it on)"; free, so allowed by default, like `post_week`. Weekday 4 (Friday), audience and only channel: members. No weekday or picture to edit.
- **When: from 20:30 ST.** A catalog entry now has `from`, the earliest server time on its day (post 1: 00:00). `postPeriod` is due only from then, so `postsMayBeDue` and the gate follow the clock alone. Post 2's `from` is the night check's start (23:30 ST, `NIGHT_MINUTE`) less 3 hours.
- **No extra wake (D141).** The Friday check (`QUOTA_CHECK_AT` "fri 20:00", a 45-minute window) already opens the database at 20:00, 20:15 and 20:30 ST. The 20:30 ST tick sends the reminder. If that tick is lost, the next tick that opens the database that Friday sends it: the 22:00 ST heartbeat, or the night check from 23:30 ST. After 00:00 ST it is Saturday and the reminder is not sent: a reminder after the raid began helps no one.
- **"Next post" on the card.** `sendBy(cfg, day, from)` now finds the first tick slot (:00, :15, :30, :45 UTC) at or after `from` in which the clock alone opens the database (`tickClockDue`), and gives that slot's end. Post 2: "Every Friday, between 20:30 and 20:45 ST, in #channel." Post 1 still reads 00:00–01:15 (the 01:00 ST heartbeat). The day line is per post: "Every Friday evening, before the raid at the reset (00:00 ST)." (`posts.<post>.day`; post 1's is unchanged).
- **Storage.** Migration `0076_post_shield_up` widens the `post_key` checks of `workspace_posts` and `workspace_post_touches` (`post_runs` has none). The tables are unchanged.
- **The sender.** `sendDuePosts` loops over `CATALOG_POSTS`, each with its own period; each post builds its text through `BODIES`. The claim, retry, deadline, settle and log rules are post 1's. Log codes: `posts.shield_up.sent`, `posts.shield_up.failed`.
- **Analytics.** `post` gains `shield_up` (tracking plan, Changed 2026-11-23).
- **Tests.** `lib/private/catalog-posts.test.ts`: once on Friday from 20:30 ST through two overlapping ticks and two later ones, nothing at 20:15 ST, on Thursday, on Monday or past the reset, with `shield_check` off; nothing while off or not allowed and nothing claimed; the sentinel scan (private markers, the member's name, pings, any number but 00:00, with a positive control) in PT-BR with a title that tries `@everyone`; the card's bound, 20:45 for post 2 and 01:15 for post 1. `app/api/tick/posts.test.ts`: `POST /api/tick` at Friday 20:15 ST posts nothing, at 20:30 ST posts the reminder after the answer, and at 20:45 ST answers 204. `PostCatalog.test.ts`: the reminder's group, its day line, its next-post line and the members' channel only. The e2e index row now reads "Posts 1 of 2 on".
- **Persona check** (build agent, on the wording only: the card's group as its 360 px column wraps it and the Discord message, in EN, PT-BR and FR; no screenshot of the running page). Officer in a hurry, reading English as a second language: understood what goes out, when and where from the card's first lines. Officer in her 50s, reading PT-BR: "Toda sexta-feira à noite, antes do raid no reset (00:00 ST)" read right. D75 reviewer: reads as help (please, the reason, thanks), names and counts no one. Adopted: "tonight" removed ("The raid starts at the reset (00:00 ST)"): at 20:30 ST it is morning for some members; and D137's "make sure your shield is on" in place of "turn on your shield". Not adopted: the officer's own time beside ST (D159's COULD).

**Amendment 2026-11-23 (issue 713 part D): post 3, "Welcome new members".**

- **What.** Every day after the daily update (the end-of-day read, D72), one welcome to the members' channel. It names the members in the day's roster who were not in the day before's.
  - EN "Welcome, Dee Newcomer and Eve Newcomer! We’re glad you’re here. Say hello, and ask us anything you need."
  - PT-BR "Boas-vindas, …! Que bom ter vocês aqui. Digam oi e perguntem o que precisarem." With one name: "Que bom ter você aqui. Diga oi e pergunte o que precisar."
  - FR "Bienvenue, … ! Nous sommes ravis de vous compter parmi nous. Dites bonjour, et demandez-nous ce dont vous avez besoin."
  - The names are joined as the post's language lists them (`Intl.ListFormat`). Our title: "Welcome to our new members" ("Boas-vindas aos novos membros", "Bienvenue aux nouveaux membres").
- **Names only, and only joiners.** Player names are public (D22). The sender reads `member_uids` and `member_names` of two `daily_rosters` rows (`freshRosterOfDay`), never `raw_json`, power, kills or any private field. Who left is never computed, named or counted.
- **More than 15 new members: a count.** "Welcome to our 16 new members! …" (`WELCOME_NAMES_MAX` = 15). So many in one day is most likely a read glitch, and a count names no one wrongly.
- **Only when both reads worked.** It sends only when the day's daily read is over (its `daily_reads` row is there and not `running`) and both the day's and the day before's rosters of the alliance were read and are fresh (no error, `is_fresh`). A failed, stale or missing roster on either day posts nothing and is not settled, so the read's automatic retry later in its window can still send it that day. A failed read never makes anyone "new".
- **No one new: nothing is posted, and the day is settled** (`post_runs.status` `skipped`), like post 1's empty week.
- **No pings.** A name goes through `breakLinks`, then the notices' formatter escapes markdown and breaks `@everyone`, `@here` and `<@`, as for post 1's entry names. `allowed_mentions` is `{"parse": []}`.
- **Catalog entry.** Key `welcome`. Feature `post_welcome` in D134's Discord group, /admin "Post: Welcome new members (off until the alliance turns it on)"; free, so allowed by default. Audience and only channel: members. A catalog entry's `weekday` may now be null (every day), and its `from` may be `read`: the day's `DAILY_ROSTER_AT` (`fromOf`). The period is the read's server day.
- **No extra wake (D141).** Due from `DAILY_ROSTER_AT` (23:30 ST) to the end of the server day. The daily read's own ticks (23:30, 23:45 ST and, while its window lasts, later ones before midnight) open the database by the clock. The read runs in the tick's body and `schedulePostsTick` runs after it, so the post sees the finished read. After 00:00 ST it is the next server day, whose period has not started: a day whose read never came gets no welcome.
- **"Next post" on the card.** A daily post reads "Every day, between 23:30 and 00:00 ST, in #channel." (`posts.whenDaily`; `PostView.day` is null). A post due from the read ends its window at 00:00 ST, not at `sendBy`'s first slot: the read's automatic retry can come at any tick of its window before midnight (review of PR 766). The day line: "Every day, after the daily update."
- **The card's lead.** "They ping no one, and only the welcome names anyone: the members who just joined." replaces "They name no one and ping no one."
- **Storage.** Migration `0077_post_welcome` widens the `post_key` checks of `workspace_posts` and `workspace_post_touches`. `postsDue` also returns the workspace's `union_id`.
- **Analytics.** `post` gains `welcome` (tracking plan, Changed 2026-11-23). No name or count goes to analytics.
- **Tests.** `lib/private/catalog-posts-welcome.test.ts` (PGlite):
  - joiners named and the leaver absent, once through two overlapping ticks and a later one, nothing at 23:15 ST;
  - a count above 15, names at 15;
  - nothing when the day before's or the day's read failed, when a roster is stale, or while the read is running, none of them settled; a day with only a leaver settled as `skipped`;
  - nothing while off or not allowed;
  - the sentinel scan (private markers, power, kills, the leaver, `@everyone`, `@here`, `<@`, with a positive control) in PT-BR, with a name and a title that try pings.
  - a name `evil.example` reaches Discord broken (`breakLinks`), and one newcomer gets the PT-BR one-name form;
  - `postsView`: the welcome has no day name, 23:30 to 00:00 ST. `PostCatalog.test.ts`: the daily line and the day line (review of PR 766).
  - Mutation proofs, each reverted: dropping the fresh check, the running check or the day before's check, adding a leaver, `>=` for the limit, or dropping the claim each fail a test.
- **Persona check** (build agent, on the wording only, EN, PT-BR and FR; no screenshot of the running page). Officer in a hurry, reading English as a second language: understood "names who joined, never who left, a count over 15" and that it pings no one. Officer in her 50s, reading PT-BR: read the message as warm, and the one-name form ("Que bom ter você aqui") as right for a single newcomer. D75 reviewer: it welcomes, never names a leaver, and a missed read posts nothing rather than guessing. Adopted: "daily update", the glossary's UI word, in place of "end-of-day read" on the card. Not adopted: a member who joined on a day whose read failed is never welcomed afterwards (a gap, never a wrong name; a follow-up if officers ask).

**Amendment 2026-11-23 (issue 713 part F): post 4, "Weekly members summary".**

- **What.** On Monday, one message to the leaders' channel about the week that just ended (Monday to Sunday):
  - EN "Mon, Nov 23 to Sun, Nov 29" / "Joined: 3" / "Left: 3" / "Members on Sun, Nov 22: 4" / "Members on Sun, Nov 29: 4" / "From 3 of 7 daily updates this week."
  - PT-BR "Entraram: …", "Saíram: …", "Membros em …: …", "Com base em … de 7 atualizações diárias da semana."; FR "Arrivés : …", "Partis : …", "Membres le … : …", "D'après … des 7 mises à jour quotidiennes de la semaine."
  - Our title: "Members last week" ("Membros na semana passada", "Les membres la semaine dernière").
- **Counts only.** The sender reads `member_uids` of the alliance's usable `daily_rosters` rows (fresh, no error, not empty; `freshUidsBetween`), never `member_names`, `raw_json`, power, kills, totals, coins, quests, donations or any per-member field. No name appears, so no one is singled out for leaving (D75).
- **How it counts.** Joined and left are counted between each usable roster and the one before it, as Insights' membership flow counts them (a change across a day with no usable roster shows on the next one). The base is the last usable roster before the week, at most 7 days before it; the end is the week's last usable roster. The two member counts are dated, so a missing Sunday read shows as an earlier day instead of a wrong "now". "From n of 7 daily updates" says how many of the week's days had a usable roster.
- **Nothing to compare: nothing posted, and the week is settled** (`skipped`): no usable roster in the week, or none in the 7 days before it (for example an alliance's first week).
- **When: Monday from 00:00 ST, as post 1.** The week's last daily update is Sunday's (23:30 ST, D72), and its retry ends before midnight, so on Monday the week is complete. The first tick that opens the database on Monday sends it (the squads queue's tick after Sunday's read, or at the latest the 01:00 ST heartbeat). The card reads "Every Monday, between 00:00 and 01:15 ST, in #channel." No extra wake (D141).
- **Catalog entry.** Key `summary`. Feature `post_summary` in D134's Discord group, /admin "Post: Weekly members summary (off until the alliance turns it on)"; free, so allowed by default. Audience and only channel: leaders. No weekday or picture to edit.
- **No pings.** The officers' title and the alliance's line go through the same `breakLinks` and formatter as the other posts, and `allowed_mentions` is `{"parse": []}`.
- **Storage.** Migration `0078_post_summary` widens the `post_key` checks of `workspace_posts` and `workspace_post_touches`.
- **Analytics.** `post` gains `summary` (tracking plan, Changed 2026-11-23). No count goes to analytics.
- **Tests.** `lib/private/catalog-posts-summary.test.ts` (PGlite): the exact text once on Monday through two overlapping ticks and a later one, nothing at Sunday 23:00 ST; a stale base and one older than 7 days post nothing and settle the week; nothing while off or not allowed; the card's Monday 00:00–01:15 ST row for the leaders' channel; the sentinel scan (private markers, coin, quest and donation values, power, total power, kills, every member name, pings, with a positive control) in PT-BR with a title that tries `@here`.

**Amendment 2026-11-23 (issue 713 part E): post 5, "KvK recap".**

- **What.** On the KvK's day, once its End read has finished, one message to the members' channel, thanks first:
  - EN "Thank you, everyone, for this KvK!" / "Kills gained together: 6.50M" / "Members with kills gained: 4 of 5" / "Biggest kills gains:" / "1. Ana Example +3.00M" … "3. …" / "Defenders and support players gain no kills, and they count just as much. Well done, all of you!"
  - PT-BR "Obrigado a todos por esta KvK!", "Kills ganhos juntos: …", "Membros com kills ganhos: … de …", "Maiores ganhos de kills:"; FR "Merci à tous pour cette KvK !", "Kills gagnés ensemble : …", "Membres ayant gagné des Kills : … sur …", "Plus gros gains de Kills :". The kills words are the public pages' (War turnout, "Kills gained").
  - Our title: "KvK recap" ("Resumo da KvK", "Bilan de la KvK").
- **The data: the event page's War turnout, nothing new.** The totals are `killsTurnout` (#271, `lib/compute.ts`) over the alliance's Start and End `member_snapshots` of the scheduled event: the kills gained by the members in both rosters (a fall counts as none, a null as 0, D15), how many of them gained kills, and of how many. A kill gain is `killsGain`, the figure the matchup's "Start to End" (D152) and Kill share (D83) also count: a member who joined brings no lifetime kills in. The top 3 are the first `KVK_TOP` (3) of `killsTurnout`'s gainers, biggest gain first (a tie: the lower uid), by the public name in the End roster (D22; the event page already shows members' kills gains by name). Not used: might (a KvK costs might; Insights' KvK card shows it for help, D139), the opponent and its result (admin-only, D152), samples.
- **Nobody else is named.** No bottom list, no one who gained nothing or lost kills, no joiner or leaver; beyond the War turnout's "n of m", no count of who did not fight. The closing line thanks defenders and support players, who gain no kills (D83's help text). D75.
- **Only uid, name and kills are read** (`recapKills`, `lib/repo/workspace-rosters.ts`): never power, `raw_json`, `avatar_url` or any private roster field. A name goes through `breakLinks`, then the notices' formatter; `allowed_mentions` is `{"parse": []}`.
- **When: the KvK's day from `SNAPSHOT_AFTER`.** A catalog entry's `weekday` may now be `event` (`EVENT_WEEKDAY`, `weekdayOf`) and its `from` may be `after` (`SNAPSHOT_AFTER`). The period is the KvK's server day, so it posts at most once per KvK. The End's tick runs the End in its body and the posts after it, so the post usually goes in that tick. The card reads "After each KvK (Saturday), between 14:00 and 14:15 ST, in #channel." (`posts.whenKvk`): "Every Saturday" would promise a post in a week with no KvK.
- **Waiting and missing data.** The day's public scheduled event (not manual, not a test) is found by its time. While its End has no row or is `running`, nothing is sent or settled, and a later tick that day looks again (the End's window, the heartbeat, the daily read). Once the End has finished, each of these posts nothing and settles the KvK (`skipped`), like post 4: no event that day, the alliance's Start or End row missing, stale or failed, no member with kills gained. The tick runs each phase once, so a finished End does not change later.
- **No extra wake (D141).** The End's own ticks (`SNAPSHOT_AFTER` and its window) open the database by the clock; `postsMayBeDue` is true for this post only on the KvK's day from then.
- **Catalog entry.** Key `kvk`. Feature `post_kvk` in D134's Discord group, /admin "Post: KvK recap (off until the alliance turns it on)"; free, so allowed by default. Audience and only channel: members. No weekday or picture to edit. The card's lead now says two posts name anyone: the welcome, and the KvK recap's top 3.
- **Storage.** Migration `0079_post_kvk` widens the `post_key` checks of `workspace_posts` and `workspace_post_touches`.
- **Analytics.** `post` gains `kvk` (tracking plan, Changed 2026-11-23). No name or figure goes to analytics.
- **Tests.** `lib/private/catalog-posts-kvk.test.ts` (PGlite): the exact text once after the End through two overlapping ticks and a later one, nothing at 13:45 ST; a running End waits unsettled, then posts; a stale End row, no event that day, no Start row, or no member with kills gained each post nothing and settle; nothing while off or not allowed; the card's Saturday 14:00–14:15 ST row for the members' channel; the sentinel scan (private markers, power, total power, the 4th gainer, a member whose kills fell, a joiner, a leaver, pings, with a positive control) in PT-BR with a title that tries `@everyone`. `PostCatalog.test.ts`: the recap's day line and "After each KvK (Saturday) …". Mutation proofs, each reverted: `KVK_TOP` 4, treating a running End as finished, and dropping the fresh check each fail a test.

**Amendment 2026-11-28 (orchestrator, issue 806): no recap after Origin of Chaos.** Post 5 is due on a KvK's day only: `postPeriod` returns null for a post on the `event` weekday when that day is an Origin of Chaos day (`isKvkDay`, D160 amendment 2026-11-28). Nothing is read, sent or settled that day. The card's "After each KvK (Saturday)" stays true. Test: `catalog-posts-kvk.test.ts`, "is not due on an Origin of Chaos Saturday".

**Amendment 2026-11-28 (orchestrator, issue 831): post 6, "KvK reminder".**

- **What.** On the KvK's day, 60 and 15 minutes before the start of the KvK in the alliance's calendar (its first KvK entry that day, by time, that officers marked "Members can see this", D105: an officers-only plan never reaches the members' channel), one reminder each to the members' channel: EN "KvK starts in 60 minutes, at 12:00 ST.", then "Roles:" and one line per role with confirmed people ("Castle defence: Bo Example", the KvK plan's role line, names in name order), then "Good luck, everyone, and thank you!". PT-BR "A KvK começa em {n} minutos, às {time}." / "Funções:" / "Boa sorte a todos, e obrigado!"; FR "La KvK commence dans {n} minutes, à {time}." / "Rôles :" / "Bonne chance à tous, et merci !". The minutes are counted from the tick that sends it. Our title: "KvK soon" ("KvK daqui a pouco", "La KvK approche").
- **Names.** The people officers confirmed in the plan's roles (D161 amendment 2026-11-28), by public name from the newest roster (`anyRoster`, as the plan's page; no private field). Members who only asked, the officers' note and every other roster value stay out. Names and role names go through `breakLinks` and the notices' formatter; `allowed_mentions` is `{"parse": []}`.
- **Catalog entry.** Key `kvk_soon`. Feature `post_kvk_soon` in D134's Discord group, /admin "Post: KvK reminder (off until the alliance turns it on)"; free, so allowed by default. Weekday `event`, so never on an Origin of Chaos day (`isKvkDay`, #806). Audience and only channel: members. A catalog entry may now have `marks` (minutes before a start, here 60 and 15) and `from: "before"` (`SNAPSHOT_BEFORE`).
- **Periods.** One per mark: "2026-11-28 T-60" and "2026-11-28 T-15" (`periodsOf`, `markOf`), each claimed at most once. A mark is due from its time until the next mark (T-60) or the start (T-15); before that nothing is sent or settled, after it the mark is settled as `skipped`, so a lost tick never sends a late "in 60 minutes". A day with no KvK entry members can see settles both marks.
- **No extra wake (D141, D160).** Due on the KvK's day from the Before read (10:00 ST): the event window's ticks (Before to After) open the database anyway, every 15 minutes. A KvK at 12:00 ST gets the 11:00 and 11:45 ST ticks. A start outside the window is reminded only if a tick that opened the database anyway (the heartbeat) falls in a mark's span. The card reads "On each KvK day (Saturday), 60 and 15 minutes before the KvK starts, in #channel. The KvK must start between 11:00 and 14:00 ST." (the Before plus the largest mark, to the End).
- **Storage.** Migration `0089_kvk_claims` widens the `post_key` checks of `workspace_posts` and `workspace_post_touches`. `post_runs.period` is text, so the marked periods need no change.
- **Analytics.** `post` gains `kvk_soon` (tracking plan, Changed 2026-11-28). No name goes to analytics.
- **Tests.** `lib/private/catalog-posts-kvk-soon.test.ts` (PGlite): the exact text once at T-60 and once at T-15 through ticks at 10:45, 11:00, 11:15, 11:45 and 12:00 ST, the asker and the note absent; nothing while off or not allowed, nothing claimed; nothing for a KvK entry not marked for members, both marks settled; nothing on an Origin of Chaos Saturday; the card's 11:00–14:00 ST.

**Amendment 2026-11-28 (orchestrator, issue 872): the KvK recap's counting, on the desk as Insights → KvK → Debrief.**

- **What.** `/w/[slug]/insights/debrief`, linked as "KvK debrief ›" on Insights' KvK card. Officers only (`requireWorkspace`), own alliance (D71), under the Insights switch (D126). 0 upstream calls. Sections, all from data already stored, for the KvK the KvK map shows (the newest public scheduled event of the last 4 weeks with a fresh Start and End, `eventEndPlaces`):
  - **Thanks.** Post 5's counting: `recapKills` for that event and `killsTurnout`. Each member who gained kills, by public name in name order, with their gain; "Members with kills gained: n of m. Kills gained together: …"; then post 5's closing line for defenders and support players. A member who gained nothing, lost kills, joined or left is not named (D75).
  - **Roll call.** That KvK's Raid prep (the week's `shield` roll call whose raid, `raidOf`, is that Saturday, D103, D137): the members with ✓ Shield up and with ✓ Squads off the wall, in name order. A ✗, "no problem seen" or no mark is never named.
  - **Map.** Near, mid and far from the castle point (`kvkMapOf`, issue 791): members and kills gained per band, counts only, no names.
  - **Recovery.** Insights' KvK cost and recovery (`kvkOf`) for that KvK: might at the Start, End and now, and the share of the loss back day by day; without the per-member and help lists.
  - **Opponent.** The matchup's Start to End (D152, `eventMatchup`): the server, how many alliances each side counts, and each side's kills gained and might change, sums only, no win or loss word; only while the `kvk-matchup` flag is on, as on the event page. With no matchup, the raid opponent of that KvK's raid (issue 861, D165, `raidOpponentView`, under Raid prep's check switch): its tag and server and each side's kills gained and might change, once both sides have a usable Start and End read.
- **Origin of Chaos.** When that event's day is not a KvK day (`isKvkDay`, #806), there is no debrief: the page says so and the card answers 404.
- **The card.** `GET /api/w/[slug]/insights/debrief/card`: one PNG in the officer's desk language, to save and post in the leaders' channel by hand (nothing is sent anywhere). Drawn by next/og with the event picture's fonts, 2× scale and `drawable` (`lib/event-image-parts.tsx`), the brand band and mark; no game art, no URL. It names only members who gained kills; a name the fonts cannot draw at all is shown as `#uid`, as `label` does for an alliance. The roll call and the map are counts. Its model (`debriefCard`) is made from the debrief alone, which never holds a place, last seen or online state. 401 `signed_out` for a member's or another workspace's session, 403 `turned_off` with Insights off, 404 with no debrief, 429 `rate_limited` past 10 renders an hour per workspace (each render draws a picture on the server; counted with `recordFailure`, as the castle point's saves), `private, no-store`.
- **Charts.** D68/D158: the map's bands and the recovery's might are HTML bars with their numbers beside them; the recovery days are Insights' own day columns.
- **Copy.** EN, PT-BR, FR in `lib/private/dictionary.insights-debrief.ts`; the marks and the roll call's name are the roll call's own words.
- **Tests.** `lib/private/kvk-debrief.test.ts` (PGlite): each section from a seeded KvK; a member with no gain unnamed on the data and the card; no debrief when the newest event is an Origin of Chaos (mutation: dropping the `isKvkDay` check fails it); the card's model has no blocked roster key, no place and no roll call name, and renders a PNG; only the own alliance's members, Raid prep marks and castle point; an undrawable name drawn as `#uid`; the raid opponent's Start to End with no matchup. `app/(private)/api/w/[slug]/insights/debrief/card/route.test.ts` (PGlite, real Request): 403 `turned_off`, 404, the PNG with `private, no-store` and its file name, 429 past the limit. `member-session.test.ts` has the card route's fixture.
