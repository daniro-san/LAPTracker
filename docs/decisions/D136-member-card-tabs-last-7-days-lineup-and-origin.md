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
  - Confirmed by the owner on 2026-11-21: API slots 1–2 are the front row (top) and slots 3–5 the back row.
- **One layout at every width.** The lineup is a 6-column grid. Each hero is two columns wide and has a fixed row and column: front at columns 2–3 and 4–5 of row 1, back at columns 1–2, 3–4 and 5–6 of row 2. No breakpoint changes it, so the phone is the desktop layout drawn smaller. Rows take their content's height, so a hero whose facts wrap never runs into the one below.
- **No row labels** (owner, 2026-11-21).
- **The list below 360 px is gone.** The 2-and-3 grid fits 320 px with the 40 px portrait (measured: no overlap, no sideways scroll at 320, 360, 390, 640 and 1280). Screen readers still get the heroes as a list in slot order ("Slot 1: …"), and the lineup stays `aria-hidden`.
- Unchanged: an empty slot is still the last slot(s), shown as a dashed "Empty slot" in its place (the back row's right end for 4 heroes).

**Amendment 2026-11-21 (owner): every squad in its own frame.** Only the strongest squad had a frame; the others were split by one hairline, so it was hard to see where one squad ended and the next began. Now every squad sits in the soft drawn frame (`drawn-frame-soft`, as `radio-field` options do), with the same padding (8 px) and 12 px between squads for the frame's tails. The strongest keeps its 5 % plum tint and the word "Strongest"; the word carries the meaning, as D117 says. This amends D117's "It sits in the soft drawn frame", which now holds for every squad.

**Amendment 2026-11-21 (issue 585):** the viewer's time names another day in words: "00:32 your time (the next day)", and "(the day before)" for a clock behind the server's ("(dia seguinte)" / "(dia anterior)", "(le lendemain)" / "(la veille)"). "(+1 d)" and "(−1 d)" read as cryptic to an officer who reads English as a second language. The words are the shared `calendar.nextDay` and `calendar.prevDay`, so every "your time" changes with them, the members' board's time column included.

**Amendment 2026-11-22 (issue 516, orchestrator under the owner's standing approval): the Follow-up action and the ready message on the card.** This builds the first item of "Not built here", not in the sticky bar (it holds two buttons, DESIGN.md "Sheet frame") but on the Overview, after the reasons:

- **The week line**, for a member followed up this game week (from Monday 00:00 ST) or on the week's Follow-up list: "This week: Talked Thu, Nov 19 · Ana" with the note on its own line, or "This week: no follow-up note yet." (PT "Esta semana: …", FR "Cette semaine : …"). A member off the list with nothing noted gets no line (D75). In `ph-no-capture`.
- **"Talked to them"** records a Talked through Follow-up's route, one tap, with "Saved. Off the Follow-up list until Monday." (or "Saved." for a member who was not on it) and a 44 px Undo; Talked is off while that line shows. The card is read again after a save or an undo. A refused undo says "Could not undo: the notes changed since."
- **"Message to send ▾"** (a 44 px chip with `aria-expanded`; "Copy a hello" in the issue, renamed after the persona panel because it did not copy by itself) opens D140's message block: the EN · PT · FR chips with the member's language pressed, the text, "Copy for game mail" and "Copy for Discord". The message is built from the member's Follow-up work item with this week's records not counted (`readyTexts`, `inputOf` in `ready-message.ts`, shared with Follow-up's page), so it is Follow-up's message and does not change after a Talked.
- Analytics: `ws_action` `follow_up` carries `from` (`follow_up`, `card`) and `on_list`; the browser's `ws_message_copied` (`where`, `to`) counts a copy (tracking plan, 2026-11-22).
- Tests: `lib/private/card-follow-up.test.ts`, the follow-up route's test, the issue 471 suite and the desk e2e card flow.

The Shield line ("Shields are not on the card") is still not built: showing the Raid Shield reading on the card changes D137's Privacy rule and how this decision's owner rule of 2026-11-20 ("squads and shields always show when the tracker saw them, on the server's clock and the viewer's") is applied, so it waits for the owner (`.specs/features/516-card-followup-shield/plan.md`, S2).

**Amendment 2026-11-22 (issue 585 batch 4, slice S1; personas under the owner's standing approval, `.specs/features/585-words/plan.md`): one way to write dates, times and zones.** The squads' "seen" line joins the date and the time the desk's one way: "seen Thu, Nov 19, 22:32 ST" (PT "visto em qui., 19 de nov. às 22:32 ST", FR "vue le jeu. 19 nov. à 22:32 ST"). On the desk card the viewer's time follows, as before. On a member's own page see D142's amendment of today.

**Amendment 2026-11-22 (owner's decision on #663: "yes, go with the recommendation"; issue 585 batch 4, slice S1b, `.specs/features/585-words/plan.md`): one average rule.** This replaces the sentence "Each row says "Average 589 · 4 days": the mean of the days with a number only, so "none" and missing days never lower it, and the count says how many days it rests on."

- Each row's average is over the days whose daily update lists the member. A "none" day counts as 0. A day with no daily update never counts.
- The line names the "none" days: "Average 400 · 6 days, of which 2 none" (PT "Média 400 · 6 dias, dos quais 2 sem nada", FR "Moyenne 400 · 6 jours, dont 2 sans rien"). With no "none" day it reads as before: "Average 589 · 4 days".
- When every listed day is "none", the line reads "None on all 7 days" ("Nada enviado nos 7 dias", "Rien sur les 7 jours"; one day: "None on 1 day", "Nada enviado em 1 dia", "Rien sur 1 jour"), never "Average 0". With no listed day the row still shows the no-data mark.
- The cells do not change: "none" stays "none", and a day with no daily update stays the no-data mark (D127).
- The rule is one function, `dayAverage` in `lib/private/member-days.ts`, with its words in `averageLine`. A member's own page (D142) and Insights (D139) use the same function, so the three agree on the same days.
- The owner's comment wrote "6 days, 2 none". The persona panel of 2026-11-22 added "of which" ("dos quais", "dont"), because an officer who reads English as a second language could not tell whether the 2 were among the 6.
- Tests: `lib/private/day-average.test.ts` (the card, Me and Insights give the same average and the same count of "none" days, read from PGlite), `lib/private/member-days.test.ts`, `lib/private/me-parts.test.ts`, `lib/private/insights-rules.test.ts`.

**Amendment 2026-11-22 (owner, issue 634, option A): the Raid Shield on the card, only during the raid.** "Shields are not on the card" no longer holds. From Friday's night check (23:30 ST) until KvK starts (Saturday 12:00 ST), the header shows the member's Raid Shield block under the status (D137's amendment of the same day has the words and the rules). Outside that window it shows nothing about shields. For shields, the owner's rule of 2026-11-20 ("squads and shields always show when the tracker saw them, on the server's clock and the viewer's") now reads: only in that window, and on the server's clock only, as Raid prep's tiles. Squads keep both clocks.

- **Amendment 2026-11-22 (owner, issue 736).** Amended by [D158](D158-charts-honest-scales-and-tap-to-read.md): on the member card, daily quest points and donations are drawn against the alliance's best member-day in the same 7 days, not the row's own highest day; coins stay against 1,000; a member's own page keeps their own best day. A line under the rows says what the bars are drawn against.

**Amendment 2026-11-22 (D127 and D158 amended, issue 739, orchestrator, from a read-only check of the stored reads): the quest points row.** The "Last 7 days" daily quest points row shows each day's quest points derived from the week's running total (`questPoints`, D127 amended 2026-11-22): the bars no longer climb through the week, Monday no longer looks like a collapse, and a day with no quests reads "none". A day whose day before has no read is the no-data mark. The card reads 8 end-of-day reads, one more than its 7 days. The bars are drawn against the daily cap (`QUEST_DAY_CAP` in `lib/private/member-week.ts`: 240 a day (1,680 a week), provisional until the owner confirms 230 or 240); donations keep the alliance's best member-day, coins 1,000. The line under the rows reads "Bars: coins out of 1,000 and quest points out of 240, the most a day; donations against {donations}, the alliance's best day by one member in these 7 days."
