## D136 — The member card: a short header over four tabs (Overview · Info · Squads · History), the last 7 days as bars, squads as the game's lineup with both clocks, and where a member came from (2026-11-20, owner, issue 461; amends D109, D117, D127)

Why: the owner, 2026-11-19: the member card is one long column of label/value rows ("a long snake"), hard to read and to use. Owner rules of 2026-11-20 on the issue: troop counts are never shown; a squad always has 5 slots; 3 squads is normal and nothing is compared against 4; the API's `heroes[]` order is the game's slot order (checked on 4 squads); `honor` is each hero's Hall of Honor level; squads and shields always show when the tracker saw them, on the server's clock and the viewer's; officers always see which alliance a member came from, and unknown stays unknown.

**The header** (the same on every tab, `MemberCards.tsx`):

- The status only when it says something: Check in, Needs help, On a break, New. "Fine" and "No data: donations on 1 day" are no longer headlines on the card (the list keeps them); missing data is "—" in its own place.
- One stat strip: Might · Main squad · Kills · Sanctuary (D78 compact numbers). Main squad is the "Main squad might" fact (D117).
- "their time now 05:57" and the languages as `Tag`s ("EN", "PT"). The Info tab's Time zone row no longer repeats "their time now".
- **Where they came from** (`lib/private/member-origin.ts`): "Came from [TAG] Name · joined us Fri, Nov 13", then "Before that: [TAG2] · [TAG3]"; "Came from: not known" when no earlier alliance is known.
  - Sources: the usable daily rosters of every alliance we read (`lib/queries/roster-stays.ts`, public membership: the alliance id and day only) and the `union_abbr` / `player_union_id` of the member's own `player_history` rows (D132, read for `access.unionId` only).
  - The alliances are ordered by their last sighting, the most recent first. A day seen in two alliances counts as the day of the move. "joined us" is the first day seen with us after the last sighting elsewhere; with no sighting elsewhere nothing is said, so a member who was always ours gets no made-up join day.
  - Names come from the alliance labels (D133); a tag from a history row is the tag the alliance had that day. A sighting in no alliance (id 0) is left out.
  - Desk only. Public pages keep D89's counts.

**The tabs** (`MemberCardTabs.tsx`): Overview · Info · Squads · History, four across at 360 px, each 44 px tall, the WAI-ARIA tabs pattern. The last tab picked is remembered on that browser (`localStorage` `ws.cardTab`, best effort; the open tab itself is React state, see below), so "remembered per officer" means per officer's browser. "Edit info" and "Paste what they told you" stay in the sheet's sticky bar and open the editor on any tab.

**Overview**: the Follow-up reasons with their evidence (as before), then:

- **Last 7 days** (`lib/private/member-days.ts`, `MemberLastDays.tsx`): the 7 server days up to the newest end-of-day read (not the game week), one row each for daily quest points, Alliance Help coins (max 1,000) and donations, as HTML bars (D68): plum at 60 %, at most 24 px wide, a hairline under them, the number under each bar, the day names once above. Coins are drawn against their 1,000 cap; the other two against the row's highest day, since the number says the amount. A day with no read of the member is the NoData mark; a read that lists the member with nothing sent is "none" (D127), with no bar. Each row says "Average 589 · 4 days": the mean of the days with a number only, so "none" and missing days never lower it, and the count says how many days it rests on.
- "Might +1.26M since Fri, Nov 13": the newest day with a might against the oldest day of the seven with one; "Might unchanged since …" when equal; a drop reads "−400K" in plain ink.
- This week's Alliance Duel from screenshots, when any was saved this week (issue 299).
- Before the alliance's first end-of-day read: "The last 7 days come with the first daily update."

**Info**: "Still to ask: …" (Members' "Missing info", `factsToAsk`), the member facts with their sources (two columns from 768, label over value), then Seen since, Joined and Last online only while the API sends them (D71, unchanged), and, behind a "Show map position" button (a 44 px `chip`), the Map position: hidden until an officer taps it, every time the card opens. D71 allows it on the desk, but people come first (orchestrator, 2026-11-20, after the persona panel). Copies and exports still leave it out. "Updated …" under Main squad and AD Tech shows only after "Show when each was updated" (a `chip`, `aria-pressed`); pending and former members' cards keep showing it as before.

**Squads** (amends D117's card section):

- "3 squads seen · last Thu, Nov 19", then each squad: "Squad 1 · Strongest", "Might 18.6M", "seen Thu, Nov 19 22:32 ST · 00:32 your time (+1 d) · 8 h ago". The viewer's time is added in the browser after hydration (the D101 two-clock rule, `clockIn`). The age ("8 h ago" under 2 days, then "3 days ago", when the card is made) is plain muted text, never a warning colour: in the six real reads of 2026-11-20 sightings ran from 2 h to 64 h old, and all of one member's squads were 54–58 h old (persona panel).
- **The lineup.** Heroes keep the API's order, which is the game's slot order: 0 top centre, 1 middle right, 2 middle left, 3 centre, 4 bottom right. They are drawn in a 3-column grid of 5 half-height rows, each hero two rows tall, so the staggered shape takes 2.5 hero heights. Each slot: the picture in its rarity frame (q 3 SR blue, q 4 SSR purple, q 5 UR gold, D117), the name, the rarity letters, "Lv 150", "Honor 42" when the Hall of Honor level is above 0, and the game's five stars. Honor 0 says nothing: in the six real reads about 75 of 85 hero slots were 0, and a row of zeros read as a shortfall (persona panel); a row stored before D132 has no `honor` and says nothing either. D117's sort (UR first, then stars, then level) is gone.
- **5 slots always.** A squad the tracker sent with fewer heroes shows a dashed "Empty slot" in the remaining slots and "1 slot empty" in the squad's muted line, never a warning. Which slot is empty cannot be known from the API (it sends the heroes it has, in order), so the missing ones are the last slots.
- **Below 360 px and for screen readers** the same heroes are a list in slot order ("Slot 1: …"); the lineup is `aria-hidden` and hidden below 360 px.
- Troop counts (`soldiers`, `soldier_load`, `troops`) are never read for the card. Squad numbers keep their gaps (squads 1 and 4 seen read "2 squads seen"); nothing says a squad is missing.

**History**: the follow-up notes (as before) and "Earlier values": every version of each fact before its newest, newest first, "AD Tech: 61% · Tue, Nov 10". "Nothing recorded yet." when there is neither.

**Not built here** (depend on the open issue 460): the Overview's #460 action and "Copy a hello" in the sticky bar, and the ready message beside "Still to ask". Roll call marks and thanks in History have no per-member read yet; left for a follow-up.

**Deferred: the avatar in the header.** The issue's header has the avatar beside the name, rank and stat strip. The card still shows the avatar and rank in their own row above the header (`MemberSheet.tsx`), as before; folding them into the header is left for a follow-up.

**Shields are not on the card.** The card shows no shield data, so "map seen HH:MM" (`player_reads.map_updated_at`, D132) has nowhere to go here yet. It comes with the shield read (#474), with the same two-clock code as the squads' "seen" line.

**The tabs keep their state in React.** A tap always opens its tab; `localStorage` only remembers the last pick, best effort, so blocked storage (private mode) never freezes the tabs. The tab panel takes the keyboard focus (`tabIndex` 0), since a panel such as History may hold nothing focusable.

**Privacy.** The card route's answer has no `avatar_url`, `online`, `last_online_at` or troop field (checked in the e2e). Map position and Joined/Last online are unchanged from D71. The new public query selects only an alliance id and a read day. The origin lines read `player_history` by `access.unionId` only.

**Words** in `lib/private/dictionary.card.ts` and `dictionary.squads.ts` (EN, PT-BR, FR). The card's old "Donations this week · total …" strip, its "Daily quest points" and "Alliance Help coins today" rows, and the strip's donations and quest points are replaced by the last 7 days.

**Tests:** `lib/private/member-days.test.ts` (the 7 days, none and no data, averages, coins against 1,000, might since); `lib/private/member-origin.test.ts` (order and join day, nothing made up; both sources from PGlite); `app/(private)/_ui/MemberSquads.test.ts` (slot order, 5 slots, Honor, the server clock, the list for screen readers, no troops); `lib/private/member-card.test.ts` (map position out of the shown details, behind its button); `app/(private)/_ui/MemberCardTabs.test.ts` (a pick opens its tab with storage blocked).

**Persona panel** (2026-11-20; an R4, a regular member's point of view, product strategy; invented-data screenshots plus six real `/v1/players` reads seen locally and deleted after). All three: accept with changes.

- Applied: "Honor N" only above 0; each sighting's age; "their time now" once.
- Facts from the real reads: the history rows reach back 6–13 days (40 rows a read) and named only this alliance for all six, so "Came from" rests mainly on our daily rosters of other alliances; squad numbers have gaps (squads 1 and 4 seen; 1 and 3 seen), shown as the game numbers them.
- Decided by the owner (2026-11-20, relayed by the orchestrator): "Troops" stays, in Info and in "Still to ask": it is the troop tier fact (T1–T12, D80) on the owner's own list of facts to ask, not a troop count. "none" stays beside the no-data mark (D127). Map position goes behind "Show map position" on Info.

**Amendment 2026-11-21 (owner): the lineup is 2 in front and 3 behind.** This replaces "The lineup" and "Below 360 px and for screen readers" above.

- The game shows 2 heroes in front on top (the tanks) and 3 behind below (damage and support). D136's staggered shape (top centre, middle right, middle left, centre, bottom right) was wrong. On a phone it also looked different from what the owner expected from desktop.
- **Slot mapping:** API slots 1–2 (`heroes[0]`, `heroes[1]`) are the front row, left to right; slots 3–5 (`heroes[2..4]`) are the back row, left to right.
  - Evidence: no hero field gives a position or row. `heroSchema` in `lib/sources/v1-player.ts` reads only `id, lv, star, q, awaken, honor`. `fixtures/` holds no recorded `/v1/players` body, and `hero_catalog` keeps only id and name, with no role. So the API order decides.
  - The split at 2 is an assumption for the owner to confirm on a real squad, for example one with a known tank in slot 1 or 2.
- **One layout at every width.** The lineup is a 6-column grid. Each hero is two columns wide and has a fixed row and column: front at columns 2–3 and 4–5 of row 1, back at columns 1–2, 3–4 and 5–6 of row 2. No breakpoint changes it, so the phone is the desktop layout drawn smaller. Rows take their content's height, so a hero whose facts wrap never runs into the one below.
- **No row labels** (owner, 2026-11-21).
- **The list below 360 px is gone.** The 2-and-3 grid fits 320 px with the 40 px portrait (measured: no overlap, no sideways scroll at 320, 360, 390, 640 and 1280). Screen readers still get the heroes as a list in slot order ("Slot 1: …"), and the lineup stays `aria-hidden`.
- Unchanged: an empty slot is still the last slot(s), shown as a dashed "Empty slot" in its place (the back row's right end for 4 heroes).
