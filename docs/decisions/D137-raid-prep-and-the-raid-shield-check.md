## D137 — Raid prep: the Raid Shield check reads the alliance on Friday 23:30 ST and Saturday morning, the Raid Shield roll call gets a second mark (squads off the wall), a ready message, and an opt-in leaders' channel summary (2026-11-20, owner, issue 474; amends D103, D132, D134)

Why: before the raid, which starts at the server reset (00:00 ST) on the night before KvK, the leadership asks every member to turn on a shield, take their squads off the wall and bring their troops home. Officers check it by hand today. The tracker's `/v1/players` answer carries `shielding` and `shield_type` (D132 keeps them), so the desk can suggest who still needs a reminder (owner, issue 474 and its comments of 2026-11-19 and 2026-11-20).

**Facts the owner established** (issue 474):

- The raid starts at 00:00 ST; KvK starts at 12:00 ST on Saturday. Nobody keeps a shield after that, so no shield read runs after 12:00 ST.
- The shield comes from the tracker's map scan (`map_updated_at`). `fresh=1` refreshes the profile, not the map scan (owner's test, 2026-11-20), so the check never sends `fresh` (D117 unchanged). The scan was 1–7 h old in the samples; one test saw it move about 2 h apart.
- `shield_type` 0 is the 8 h Rechargeable Shield, but only when `shielding` is 1: an unshielded player also has 0. The 12 h, 24 h and 3 d kinds are not mapped yet.
- The API cannot say where squads are (no location field), so "squads off the wall" is an officer's mark after scouting.

**The two reads** (`lib/shield-check.ts`, `lib/shield-read.ts`, `lib/shield-tick.ts`). Only for alliances whose `shield_check` is on (D134's two layers). Both fall on Saturday's UTC quota day, and both are keyed by that day's daily read (`day` is Friday's server date, as `squad_reads`).

1. **Friday from 23:30 ST, a burst.** The tick's `after` (D132) runs the day's squads queue as batches, one after another, for the shield-check alliances (`SquadsRun.shield`), until nobody's turn has come, a batch makes no call, or the next batch could end after 00:00 ST or the tick's budget (180 s after `after` starts). So **Friday's burst is that day's squads read**: one call per member, the same queue, cap (120), reserve and storage (D132), and nobody is read twice that night. The 23:45 tick picks up the retries the same way. An alliance with the squads read off is still read by the burst; its later retries wait for the next 23:30–00:00 window only on Fridays.
2. **Saturday morning, from the alliance's own time** (Alliance settings: 10:00, 10:15 … 11:00 ST; 10:00 by default), until 12:00 ST. Every member of the day's roster once more, from a queue of its own (`shield_queue`, the squad queue's rules: oldest first, a 5xx goes to the back 15 minutes later, 3 attempts), on the alliance's own key (D124), paced (500 ms). At most 120 calls (`SHIELD_CALLS_MAX`, INVARIANT `shield.calls-capped`): past it the read stops with `reason: cap`. The reserve waits as in D132 (on `LAP_API_KEY`, `squadsReserve`: the margin plus the event's reads on the event's quota day). The claim (`shield_checks.morning_batch_at`) is held at most 140 s per tick, under D132's 150 s staleness.
   - **No event-window pause on our key.** KvK's Before read is at 10:00 ST, so D132's event pause would stop OGs' morning read. The tick runs the event read inside the request and the shield read in `after`, so they never overlap; the reserve keeps the event's quota.
   - A workspace key makes one `/quota` call at the morning's start (D124). On our key the start is what that day's squads read left (`squad_reads.quota_remaining`).
3. **Nothing at other times**: not on other days, not before the morning time, not from 12:00 ST. The tick checks the clock first (`shieldWindowOpen`) and reads no workspace or setting outside the two windows. The morning read checks the clock before each call too, so no call is made at or after 12:00 ST (review of PR 517).

**Expected calls** (about 101 members, measured retry rate of about 5 %, D132): Friday 23:30–00:00 ST, about 106 calls, which are that day's squads read (no extra call when the squads read is on). Saturday from 10:00 ST, about 101–106 calls, at most 120. So Saturday's UTC quota day holds about 210 calls of the alliance's key instead of about 106. D134's estimate now counts the shield check as one read per member when the squads read is on, two when it is off (`trackerEstimate`).

**What a reading suggests** (`suggestionOf`, people first, D75):

- `shielding` 1: "Tracker: shield seen". For `shield_type` 0 it adds "8 h shield, ends by 06:32 ST at the latest" (the map scan's time plus 8 h); another kind reads "shield on, length unknown". If that end is before Saturday 12:00 ST, the row gets the tag "May end before KvK". A hint, never a ✗.
- `shielding` 0: "Tracker: no shield seen yet". A shield turned on after the last scan shows like this, so it is a hint, never a ✗, and the page says so.
- No reading (or the field missing): no line. It never counts.
- Seen on Friday night and not seen by the morning read: "Seen Fri 22:32 ST, not seen this morning (09:40 ST)".
- Every line shows "map seen 22:32 ST" and the officer's own clock beside it (D101's `Times`). "Not seen yet" and "not seen this morning" are in the attention colour (yarn, semibold); "shield seen" is plain.
- Above the rows: "12 not seen yet · 10 may end before KvK", then each read's counts: "Friday's read: 87 of 97 with a shield seen · 4 not read yet", then Saturday's. Members without a reading are a count, never a name.
- **Order** (persona review): the page still opens with not set first and never moves a row under a tap (D103); among the not-set rows, not seen yet comes first, then may end before KvK, then no reading, then seen.
- A read's answers are each member's newest `player_reads` row in its window: 23:00–00:00 ST for Friday, 10:00–12:00 ST for Saturday.

**Raid prep, the roll call** (amends D103). The Raid Shield roll call is now named **"Raid prep"** (EN), "Preparação do raid" (PT), "Préparation du raid" (FR); the stored kind stays `shield`.

- **"No problem seen"** (the Shield's "the rest", and old Raid Shield roll calls' marks) shows its word under the Shield pair like ✓ and ✗, and counts as done for the message: the message never asks about the shield when its mark is ✓ or "no problem seen" (review of PR 517).
- **Two marks per member.** Shield (the roll call's own mark, unchanged: ✓ Shield up, ✗ No shield, "the rest" is "no problem seen") and **Squads off the wall** (✓ Off the wall, ✗ On the wall), stored in `roll_call_marks` with `part` `wall` (migration `0058`): the same append-only versions and 409 rule, counted per part. The counts, "the rest" and the copy for a spreadsheet read the Shield mark only; Home's activity line ("Ana took the roll call “Raid prep”") counts a write of either. A `wall` mark on any other kind is refused (400 `invalid`). "Not set" is the default for both and never counts (D75).
- **"The rest"** ("Mark the other n as no problem seen") leaves out the members the tracker did not see with a shield: "no problem seen" is never given against the tracker's own hint (persona review).
- **"Accept the tracker's (n)"** (shown only while the check is on and the newest reading saw someone with a shield): writes ✓ Shield up for every member the newest reading saw with a shield, not away that day and not marked yet. "Not seen yet" and "no reading" stay not set: a hint is never turned into a ✗. A member someone marked meanwhile keeps that mark. Counted as `ws_action` `roll_call` / `accept` and `ws_roll_call_marked` `how: tracker`.
- **A ready private message** under each row ("Message", a disclosure with the text and Copy), in the member's language: their recorded languages first (member facts), then the game's language from the tracker's reading, else English (EN, PT-BR, FR). It holds only the parts not yet ✓, then "bring your troops home" (a shield does not protect troops outside). When the tracker saw a shield, the shield part reads "check your shield is still on" instead of "turn on your shield" (persona review): "Hi Ana, before the reset, please turn on your shield, take your squads off the wall and bring your troops home. Thanks!" After 00:00 ST it says "before KvK starts at 12:00 ST". When both marks are ✓, the row says "All set" and has no message.
- While the check is off, the page shows the two marks and the message, with no tracker line and no counts (D126 amendment: turned-off features are hidden).

**The leaders' channel summary** (`lib/shield-post.ts`, `lib/copy-shield.ts`). Opt-in in Alliance settings → Raid Shield check ("Post the summary to the leaders' channel", off by default; its language EN, PT-BR or FR). One message through the workspace's leaders webhook (D129, the site's `WORKSPACE_DISCORD_WEBHOOKS` as its fallback), posted after Friday's read and edited in place by a later tick of either read only when its text changed (`shield_checks.message_id`, `message_hash`: the text's sha256). A message Discord says was deleted (404) is never posted again that night: `message_hash` becomes `gone` and the log line `shield.message_gone` holds no more than that code. On Saturday, until the morning read has an answer, the message keeps Friday's summary and its "Not seen yet" names (review of PR 517):

```
**Raid Shield check**
Fri 23:31 ST: 87 of 97 with a shield seen · 4 not read
Sat 10:04 ST: 80 of 86 with a shield seen · 15 not read
Not seen this morning: Aster 2, Briar 3, …
The tracker sees shields at its map scan: a shield turned on since may not show yet.
[Raid prep ↗](<…/w/ogs/roll-call?week=2026-11-16>)
```

- "with a shield seen", not "shielded": the message never claims more than the map scan knows (persona review).
- Names are typed in game, so they show literally: Discord markdown and `@everyone`/`@here` are escaped (`escapeDiscord`, lib/notify.ts; review of PR 517).
- Never to the members' channel or anywhere public. At most 40 names, then "and 12 more". `allowed_mentions` is empty, so nobody is pinged. It is built in `lib/` (the tick), outside `lib/private`, from the shield columns and the roster's names only.

**Privacy** (D71). The shield state is attack-relevant. It stays in `player_reads` (D132) under the alliance whose workspace read it, is read only by `lib/private/raid-prep.ts` after `requireWorkspace` for that workspace's own alliance, and by the tick for that alliance's own leaders' message. No log line, `run_logs` row, analytics event or error carries a name or a shield value: `shield.morning` holds counts, the quota left and a reason. Nothing is cached or public.

**Data** (migrations `0058_raid_prep_shield_check` and `0059_shield_message_hash`, `pnpm db:generate`): `shield_checks` (one row per quota day and alliance: the night burst's start, the morning read's claim, cost and reason, the message id), `shield_queue` (the morning read's queue, uids only), `shield_settings` (the morning time, the message switch and language), and `roll_call_marks.part`. All three tables are in `WORKSPACE_TABLES` (D125) and deleted with the workspace; none is downloaded (counts and codes, as `squad_reads`); the shield facts are already in `player-reads.csv`. The marks' download gains the `part` column.

**Alliance settings → Raid Shield check** (only while the check is on): the morning time and the message switch and language, one Save (`POST /api/w/[slug]/raid-prep`, officers only, 30 saves per 15 minutes, `ws_action` `raid_prep` / `save`). The message switch is off until the leaders' channel is set up under Discord.

**The read status bar** (D135; `lib/private/shield-status.ts`), only while the check is on, counts and server times only, for the check's quota day until KvK starts. It shows the newest read that started:

- under way: "Checking Raid Shields · 40 of 101 · started 23:31 ST" (the bar polls while it runs). Friday's read runs while that day's squads queue runs and 00:00 ST has not come; Saturday's while `morning_status` is `running`;
- done (a stopped morning read too, with what it read): "Raid Shield check 23:42 ST · 87 of 101 seen with a shield", at the newest answer's time, until 12:00 ST on Saturday.

**Not built here.**

- Web push (issue 474's optional part 3).
- `shield_type` for the 12 h, 24 h and 3 d kinds: one plain read after a known kind is turned on, per kind, as the owner's test of 2026-11-20 did for type 0.
- "A squad seen outside at the last scan" as a hint (the issue's clue about `seen_at`): to be confirmed by the owner's test first.

**Tests** (stubs only, no upstream or Discord call):

- `lib/shield-check.test.ts`: the windows (Friday from 23:30 ST, Saturday from the alliance's time, nothing at 12:00 ST or on Thursday), the 8 h end and "may end before KvK".
- `lib/shield-read.test.ts` (review of PR 517 too): no batch that could end after 00:00 ST on Friday; no call at or after 12:00 ST on Saturday; the reserve stops the morning read, which waits; typed names shown literally; Friday's summary kept until a morning answer and no edit of an unchanged text; a deleted message never posted again. `app/(private)/_ui/prep-message.test.ts`: the message with ✓ and "no problem seen". And: Friday's burst reads each member once as the squads read and a second tick reads nobody again; Saturday reads everyone once more from the alliance's time and nothing before or after; at most 120 calls; one leaders' message posted and then edited, only when turned on.
- `lib/private/raid-prep.test.ts`: the row hints, "Accept the tracker's" writing ✓ only for those seen and keeping an officer's mark, the wall mark apart from the Shield mark and refused on another kind.
- `lib/private/shield-status.test.ts`: the status bar's line under way on Friday, done, under way on Saturday, and none while off or after 12:00 ST.
- The issue 471 suite: Alpha's wall mark and Accept on Bravo's roll calls are refused; Alpha's Raid prep never shows Bravo's readings. The member-session suite has the new route's fixture. `lib/private/features.test.ts`: the estimate.

**Amendment (2026-11-21, owner, D147):** the summary goes to the workspace's own Raid Shield channel when one is saved in Alliance settings → Discord, else to the leaders' channel as above. A message is edited only through the webhook that posted it; a channel changed since posts fresh. The switch now reads "Post the summary to Discord". See D147.
