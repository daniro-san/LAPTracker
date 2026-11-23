## D139 — The officers' Insights page: the week's pulse, effort at every might level with "Quiet contributors", and the membership flow, from stored reads only (2026-11-20, owner, issue 489 part 1; amends D114, D126)

Why: the owner asked for an analysis page for officers, built from the readings the real-data panel did on 2026-11-19 (issue 489). This decision covers sections 1, 2 and 4, which need only roster data. KvK recovery (3), squads coverage (5) and Raid Shield history (6) come later.

**Where.** `/w/[slug]/insights`, a view of Members: "Members · Former members · Insights" in the view switch below 1280 px and under Members in the sidebar from 1280 px. Officers only, after `requireWorkspace`, and only for the workspace's own alliance (D71).

**Its switch (D126, D134).** `insights` is in the Tabs group. It spends no quota, so it is allowed and on by default for every alliance. With it off, the address goes to Home and the view link is gone.

**What it reads.** It reads only stored data and makes 0 upstream calls:

- the alliance's last 36 end-of-day reads (D72): five game weeks plus the read before them;
- the day each member was first seen;
- the officers' break notes;
- for the people who joined or left, the public daily rosters of the other alliances we read, from 60 days before the first change (alliance id and day only, `sightingsElsewhere` in `lib/queries/roster-stays.ts`);
- for joiners, the alliance tags in our members' own `/v1/players` history rows (D132, this alliance's rows only).

It never uses `x`, `y`, `online`, `last_online_at` or `joined_at`, and never reads `avatar_url`.

**Null and missing (D75, D127), one rule throughout.**

- A day with no read is left out, never 0. Each section says what it rests on: "Based on 3 daily reads this week: Mon, Tue, Thu." and "No read on Wed: left out."
- On a read that lists a member, a null is "none that day" and counts as 0:
  - in the pulse's shares: no quest points, not at the coin cap, did not donate;
  - in the effort averages.
- This differs from the member card's "Last 7 days" (D136), whose averages count only days with a number. The persona panel's analyst pointed out that under that rule, one big day out of seven nulls reads as a high average, and a comparison between members must not work that way.

**1. The week's pulse.** Three measures, each against the members each read lists:

- the share who earned daily quest points;
- the share at the 1,000 coin cap;
- the median donation of those who donated, with "the 91 of 100 members who donated".

Each measure shows:

- this game week day by day, as columns (a day with no read is the NoData mark);
- the four weeks before and this week, as horizontal bars, pooled so that every member-day counts once, each with its number of reads.

The issue's "74 of 98 at the coin cap" left out the members with no coin count. Under the rule above they count, as not at the cap.

**2. Effort at every might level.**

- The members of the newest read are split into four equal groups (quartiles) by might, the highest first. New members (D75, `NEW_MEMBER_DAYS`), members on a break and members with no might in the read are left out, and the section says how many.
- For each group, the median of the members' averages over the last 7 reads: daily quest points, Alliance Help coins (drawn against the 1,000 cap) and donations.
- The lead is neutral: "Compare the groups; nobody is ranked." An earlier "Effort doesn't follow might" was a claim that the real read contradicted (persona panel).
- With fewer than 3 reads (`EFFORT_MIN_READS`) there are no groups and no names, only "Needs at least 3 daily reads to compare; 1 so far."

**"Quiet contributors"** is a thanks list, never a ranking:

- **Who.** Members below the alliance's median might, and above its median in both daily quest points and donations, over the same reads.
- **Order.** Name order, with no number beside a name.
- **Share the thanks (D114).** It opens the weekly-thanks sheet with them ticked, under a new deed, `steady`: "kept up their daily quests and donations" (EN, PT, FR in `lib/ai/thanks-writing.ts`; the route takes up to 3 deeds).
- **The sheet's help line.** It reads "The quiet contributors are ticked. Untick anyone you'd rather not name." D114's own line stays on Members and Home.
- **No opposite list.** There is no "lowest effort" list.

**4. Membership flow.**

- **Joined and left per week.** A change is counted between consecutive reads and shows on the first read after it.
- **Where newcomers came from.** Each joiner's latest sighting in another alliance on or before the day they appear with us, from that alliance's daily roster or a history row's tag.
- **Where leavers went.** Each leaver's first sighting elsewhere from their last day with us on.
- **Unknown stays "Not known".** These are counts per alliance, never names.
- **How long members have been with us.** Bands from the first daily read that lists them: under 2 weeks, 2 weeks to a month, 1 to 3 months, 3 months or more. A band longer than our records cover is left out, and "Already here at our first read" is its own row.
- **Newcomers' growth.** Members first seen in the last 30 days: how many grew their might since their first day with us, and the median change. Aggregate only (owner, 2026-11-20: newcomer sections show growth and origin only, with no rank hints).

**Charts (D68).** HTML bars, server-rendered, with the label and the number in HTML beside every bar, token colours and nothing hover-only (`app/(private)/_ui/InsightsSections.tsx`). Below 1024 px there is one card per section. From 1024 px the margin column holds "How this page counts".

**Tests.**

- `lib/private/insights-rules.test.ts`: the pulse with a missing day and nulls; the averages and the four groups; the Quiet contributors rule and its order; joins and leaves, origins and unknowns; tenure and newcomers.
- `lib/private/insights.test.ts`: the read from PGlite. It covers both origin sources, a member on a break left out, and no private field in the view.
- The issue 471 suite (`cross-workspace-reads.test.ts`): Alpha's view holds none of Bravo's members, history tags or private markers.
- `turned-off.test.ts`: with the switch off, the page goes to Home.

**Amendment 2026-11-21 (issue 489 part 2): KvK cost and recovery (section 3) and squads seen (section 5).** Two more cards after the membership flow, from stored data only (0 upstream calls). The page was about 4,700 px tall at 360 px, so each new card shows a one-line summary and keeps the rest behind "Show the details" (a native `<details>`, 44 px, `text-button`).

- **KvK cost and recovery** (`lib/private/insights-kvk.ts`, read by `scheduledEventMight` in `lib/repo/workspace-rosters.ts`).
  - **Which events.** The public scheduled events (not manual, not test, not admin-only) from the day before the oldest of the page's 36 reads, whose Start and End rows of our alliance are both fresh and not failed, and whose End is older than the newest daily read. On KvK day the event waits for the night read; until then "now" would be the day before it (QA). At most 4 (`KVK_EVENTS`), the newest first.
  - **Who counts.** Members in the Start read, the End read and the "now" read, with a might in each. The "now" read is the newest read for the newest event. For an older event it is the last read of its recovery week, so a later KvK's loss never shows as this one's (QA). Members of that read not counted (joined since, missing from one event read, or no might) are "other current members"; members who left are a count. Neither moves the numbers.
  - **What it shows.** The summary: "Last KvK, Sat, Nov 14: the alliance lost 11% of its might, and 73% of that is back." Behind the fold, for the newest event: Before (Start read), After (End read) and Now bars, and the share of the loss back on each daily read. The reads run from the server day after the event (its own read only repeats the End read) for at most a week and never past the next event's time. They show as a 7-column day grid like the pulse's. Each older event folds to one line, "KvK Sat, Nov 7 · lost 13% · 50% back", and its last bar reads "On Nov 13, before the next KvK".
  - **Per member** (newest event only, in its own fold, in name order): "lost 31% · now 64% of before".
  - **"Took a heavy hit — maybe offer help"**, visible on the card: members who lost more than 25% of their Start might and whose might now is under 80% of it ("below 80% of it" in the issue: of their might before the KvK). Both tests use the whole percents the page shows, so a name never sits beside "now 80%" (persona panel). Members on a break are left out (D75). Name order, no number beside a name, each name a link to that member's card (`/w/[slug]/members?m=<uid>`). With nobody: "Nobody from the last KvK is still far below where they were."
  - **No KvK yet:** "No KvK in these weeks has both a Start and an End read yet. This fills in after the next one."
- **Squads seen** (`lib/private/insights-squads.ts`, read by `latestSquadSightings` in `lib/repo/squads.ts`). Only while the squads read is on (D126); with it off there is no card.
  - Counts only, for the members of the newest daily read: no names, no heroes, no lineup (owner, 2026-11-20). The summary: "91 of 100 members have squads seen; 74 of them in the last 24 hours." ("none in the last 24 hours" at 0).
  - Behind the fold: members with 1 squad, 2 squads, 3 or more (3 is normal and nothing is compared against 4, D136), and "None seen yet" set apart; how fresh each member's newest sighting is (in the last 24 hours, 1 to 3 days ago, more than 3 days ago, and "The tracker sent no time" when it sent none); and the strongest squad's might in four equal groups with each group's middle value, as section 2 groups might. Fewer than 4 members with squads make no groups. The lead says it counts the squads the tracker has seen, not every squad a member has.
- **Raid Shield history (section 6) is not built here.** It is listed as a follow-up in the handoff. (Built 2026-11-21, see the amendment below.)

**Bounded reads (D149).**

- The KvK read is one statement bounded by the date. It reads events by `events_event_at_utc_unique`, then each table by its own unique index. On one year of invented data (52 KvKs × 30 alliances, 312k member snapshots) it touches 91 buffers in 0.19 ms.
- The squads read walks a new index, `member_squads_latest_idx (union_id, uid, squad, read_at, id)` (migration `0067_member_squads_latest`), backwards. This is the same recursive form as `latestFacts`: one descent per (member, squad number) pair, landing on that pair's newest row. It grows with the pairs, not the rows. On 310k squad rows it makes 270 descents, 1,144 buffers, 1.06 ms. The index replaces `member_squads_member_idx (union_id, uid, squad)`; the card's `latestSquads` and `squadPairs` still lead with the same columns.
- Per Insights view: 7.3 transactions, about 1,840 buffer hits and 25–26 ms, against 5.3–6 transactions, about 430 hits and 23 ms before. Measured with `pg_stat_database` through the real lib functions, 20 views per run, warm.
- Nothing is cached. The page stays per request and private (D143); per-member names are `ph-no-capture` (issue 549).

**Copy** in `lib/private/dictionary.insights-more.ts` (EN, PT-BR, FR), spread by `dictionary.insights.ts`.

**Tests.** `lib/private/insights-kvk.test.ts`:

- who counts and the recovery day by day;
- the help rule at the 79.6% edge, its name order and members on a break;
- squads seen, freshness and the four groups.

`lib/private/insights.test.ts` reads both from PGlite and checks that another alliance's KvK and squad rows stay out.

**Amendment 2026-11-21 (issue 489 part 3): Raid Shield history (section 6).** A sixth card after squads seen, from stored data only (0 upstream calls). It is shown only while the Raid Shield check is on (`shield_check`, D134). With the check off there is no card and no read. The page keeps its officer gating (D71).

- **What it shows.** One row per week for the last 8 Fridays (`SHIELD_WEEKS`), the newest first. This week's Friday counts once its night window has opened (23:00 ST). Each week has two bars:
  - "Night check": the share seen with a shield;
  - "Morning check": the same share for the morning.
  - Each bar's note reads "28 seen of 95 read · 5 not read".
- **The summary while closed.** "Last raid, Fri, Nov 20: 89% seen with a shield in the morning (Friday night: 29%)." Behind "Show the details", the card first shows "Thank you to everyone who turned on a shield." (D75, thanks first), then the lead. The lead says these are the tracker's map scans and that a shield turned on later may not show. It also says the night check runs before the reset on map scans 1 to 7 hours old, so most shields turned on for the raid show only in the morning. That keeps the night share from reading like a verdict (persona panel).
- **What counts.**
  - A check counts only when `shield_checks` says it ran: the night when `night_at` is set, the morning when `morning_status` is running, done or stopped. A skipped morning does not count.
  - Members: those of that Friday's daily roster with no error. Each member's newest `player_reads` row in the check's window counts (`passWindows`: Friday 23:00–00:00 ST, Saturday 10:00–12:00 ST, the same windows Raid prep uses).
  - Share: members seen with a shield, out of members whose reading said shielded or not. Members with no reading, or with a missing field, are "not read" and never count as a miss (D75).
- **Missing and partial.**
  - A check that did not run, or that finished having read nobody, is "no reading", never 0 %. A week with neither check is its date and one "no reading" line, with no bar.
  - A check with at least as many members not read as read is labelled "partial reading".
  - A morning check still running shows "under way" in its row and in the summary, with no share yet.
- **Alliance-level counts only.** No name, no uid, no ranking, no "who forgot" list (D75). The officers' hand-mark count (the issue's optional part) was dropped (persona panel): it measured officers more than the raid, and it cost a read.
- **The read (D149).** One statement, `shieldPassCounts` in `lib/repo/shield-checks.ts`.
  - It reads the checks and Friday rosters by their keys, and each window's readings through `player_reads_read_at_idx`. A window holds every alliance's reads of that hour (10 alliances' squads reads in the test data), but no older history.
  - An earlier form went member by member through `player_reads_member_idx` and touched 3.7k buffers. The window form touches 347 buffers in 1.9 ms on one year of invented data: 368k player reads, 51 checks, 100 members.
- **Cost per Insights view**, from `pg_stat_database` through the real `insightsView`, 20 views a run, warm, 3 runs:

  |                  | transactions | buffer hits | ms (median) |
  | ---------------- | ------------ | ----------- | ----------- |
  | before           | 7.3          | 1,843       | 25.0–25.8   |
  | after            | 8.3          | 2,076–2,126 | 28.1–28.2   |
  | after, check off | 7.3          | 1,843       | 25.3        |

- **Privacy (amends D137's "read only by lib/private/raid-prep.ts").** `lib/private/insights.ts` also reads the shield columns, after `requireWorkspace`, for the workspace's own alliance only. It returns counts only, to the officers' page. Nothing is logged, cached or sent.
- **Code and tests.**
  - Code: `lib/private/insights-shield.ts` (pure: the Fridays, the windows, the weeks); `shieldWords` in `lib/private/insights-more-words.ts`; `ShieldCard` in `app/(private)/_ui/InsightsMore.tsx`. `Bars` gains `bare`, so a row with no share draws no empty track.
  - Copy: `insights.shield.*` in `dictionary.insights-more.ts` (EN, PT-BR, FR).
  - Tests: `lib/private/insights-kvk.test.ts` covers the Fridays, a check with no reading, a partial reading and a running morning. `lib/private/insights.test.ts` (PGlite) covers each week's counts over Friday's roster, a night-only week, a week with no check, another alliance's reading left out, and no card while the check is off.

**Amendment (2026-11-21, issue 585):** the Raid Shield card is titled "Raid Shield check", each week is dated by its raid's Saturday ("Last raid, Sat, Nov 21: 89% seen with a shield at the morning check (night check: 29%)."), and its explanation is two sentences. See D137's amendment of that date.

**Amendment (2026-11-21, issue 585): the KvK card says why it is empty.** On KvK Saturday at 22:35 ST an officer read "No KvK in these weeks has both a Start and an End read yet." as "nothing was recorded". The KvK's Start and End were read; the card was waiting for the 23:30 ST daily read, and the alliance's daily reads began after the KvK before it. `kvkOf` now also returns `waiting` (an event whose End is read with no daily read after it yet) and `readsFrom` (the first read's day, when a KvK before the reads has both reads). The page reads events from one KvK week before its reads to know the latter; such an event is still not shown. The card's top lines:

- **Waiting, KvK day:** "Today's KvK is recorded: its Start and End reads are in. Its cost and recovery show here after tonight's daily read at 23:30 ST." Another day: "The KvK of Sat, Nov 21 is recorded: …after the next daily read at 23:30 ST." The time is `DAILY_ROSTER_AT`. It leads, and the last KvK's summary and help list stay below it.
- **A KvK before the reads, none inside:** "This page's daily reads start on Tue, Nov 17, so earlier KvKs are not shown here. The next KvK shows here after the daily read at 23:30 ST on its day."
- **No KvK at all:** the line above, unchanged.

**Amendment 2026-11-22 (issue 585 batch 3, slice 5): "Took a heavy hit — maybe offer help" links to Follow-up.** The help list keeps its names (4 of 6 officers and the designer; with Follow-up turned off the names must stay anyway). Under them, "Offer help: Follow-up ›" ("Oferecer ajuda: Acompanhar ›", "Proposer de l’aide : À suivre ›"), a 44 px link to `/w/[slug]/follow-up#follow-up-kvk`, shows while Follow-up's "After KvK, offer help" has someone in it: the Follow-up tab on (D126), the KvK inside its week (`afterKvk`) and at least one help member who is not marked Needs help and has no record this week or since the KvK's End read (`kvkGroupOpen`, with Follow-up's own `kvkOpen`). Otherwise the card is as before. The link has no count: Insights lists everyone who took the hit, Follow-up only those still to offer help to. To know it, the page reads `followedUpSince` (uid, action, time) once, only while the tab is on and the KvK is in its week. See D104's amendment of the same day.

**Amendment 2026-11-22 (issue 585 batch 4, slice S2; personas under the owner's standing approval, `.specs/features/585-words/plan.md`): the daily update by its UI word.** The page calls the end-of-day read "daily update" (PT "atualização diária", FR "mise à jour quotidienne"), never "read" or "relevé"; the rules are unchanged. The quoted lines now read "Based on 3 daily updates this week: Mon, Tue, Thu.", "No daily update on Wed: left out.", "Needs at least 3 daily updates to compare; 1 so far.", "… with no might in the daily update", "A change shows on the first daily update after it.", "Counted from the first daily update that lists them.", "Already here at our first daily update, {date}", "… after tonight's daily update at 23:30 ST.", "This page's daily updates start on {date} … after the daily update at {time} ST on its day." and "… for the {n} members in the newest daily update." A week bar's note is "5 daily updates" (it read "5 reads"), never "5 days", which officers read as days played. A KvK's "Start read" and "End read", the Raid Shield check's "reading" and the tracker's "squad reads" keep their words.

**Amendment 2026-11-22 (owner's decision on #663; D136 amended the same day): one average rule.** The paragraph "This differs from the member card's "Last 7 days" (D136) …" no longer holds. The member card and a member's own page (D142) now average the way Insights does: a "none" day counts as 0, and a day with no daily update is left out. All three call one function, `dayAverage` (`lib/private/member-days.ts`). Each effort average now also carries how many days it rests on and how many of them were "none" (`DayAverage`). The page's groups, medians and Quiet contributors are computed as before, and its numbers do not change. The last-7-reads window and the "few reads" rule stay.

**Amendment 2026-11-22 (owner's request, D153): a seventh card, Time zones.** After Raid Shield check (the last card shown), the members of the newest daily update counted by their recorded time zone (D80), grouped by offset west to east, with now, the next 00:00 ST reset and the next KvK on each group's clock, and "Not recorded yet" as a count that never joins a share (D75). Counts only; it reuses the facts the page already reads, so the page makes no new query. See D153.

**Amendment 2026-11-22 (owner's request, #678; persona panel under the standing approval, `.specs/features/678-insights-drilldown/plan.md`): a count opens exactly the members it counts.** The owner asked: "one part says 22 members are in might range X. Who are those members? Why can't I tap it and see those members filtered?"

- **One rule per set.** Each set's function returns its members' uids, and the number shown is that list's length: `bandsOf` (`Band.uids`), the left-out kinds (`leftOut`), each week's joiners and leavers (`flow.weeks`), `tenureOf` and `newcomersOf` (`uids`). The words carry each set as `MemberSet` (`setOf`, `lib/private/insights-sets.ts`). Nothing is read again: the names come from the newest daily update and the flow's moves (`InsightsView.people`), so the page makes no new query (D149).
- **In place, not a Members filter.** Members cannot rebuild these sets without a second copy of each rule or the reads only Insights makes. A row that counts members is a native `<details>` (44 px), its count plum with a ▾; it opens the names under it at full width, in two columns at 360 px, in name order (the page language's collation, punctuation ignored), with no number, rank or measure beside a name (D75, D114). Each name is a 44 px link to the member's card, `members?m=<uid>` (D122), or `members?view=former&m=<uid>` for a member who left. A count of 0 opens nothing. Each card with sets says once "Tap a count to see who." ("Toque em um número para ver quem.", "Touchez un nombre pour voir qui.").
- **Effort.** The groups' members open once, in "Who is in each group" ("Quem está em cada grupo", "Qui est dans chaque groupe") before the three measures; the "22 members" notes in the measures stay plain text, so no name sits beside a group's median (the officers, the designer and product strategy: names under the lowest median read as a low-effort list; "No opposite list" above still holds). Under "Left out", "See who" opens the members on a break and those with no might, only while the card has its groups (3 daily updates or more), as "no groups and no names" above says. New members stay a count (see "Newcomers" below).
- **Membership flow.** Each week is one fold: its label and its two bars, opening the names under "Joined (1)" and "Left (1)" ("Entradas (1)", "Saídas (1)"; "Arrivées (1)", "Départs (1)"), never the bar's "−1" over a name. The list holds moves, as the count does: a member who left and came back in one week is named twice. Tenure bands from 30 days with us on ("1 to 3 months", "3 months or more", "Already here at our first daily update") open their members.
- **Newcomers stay counts.** Newcomers' sections are "Aggregate only" (owner, 2026-11-20), and the owner has not answered whether they may be named. So no set that holds only newcomers opens: "Left out: n new", and the tenure bands a newcomer (first seen under `NEWCOMER_DAYS`, 30, ago) can be in, "Under 2 weeks" and "2 weeks to a month", keep their counts with no ▾ and no names. A tenure band opens only when its fewest days with us are `NEWCOMER_DAYS` or more. A joiner still shows by name in their week's "Joined" list, as the flow's own fact.
- **"1 new".** It takes a singular now ("1 novo", "1 nouveau"; it read "1 novos", "1 nouveaux" in the left-out line).
- **Still counts only.** "Where newcomers came from" and "where leavers went" ("counts per alliance, never names"), newcomers (above), squads seen ("counts only: no names", owner 2026-11-20), the pulse (member-days, not a set; a per-day list would be a list of who did not do their quests), Raid Shield check (no "who was not seen") and the KvK card's based lines. The owner's request names might ranges only, so those owner decisions stand; whether they open is asked in the handoff.
- **Back.** Opening a set writes its key into the address fragment (`#who-<key>`, replaceState); after an officer opens a card from it and goes Back, the page opens that set again (`InsightsSetMemory`). The fragment is compared raw, never decoded, so a fragment the page does not own (a stray "%") never stops it loading. On a phone the card is a sheet and the first Back closes it, as anywhere on Members.
- **Privacy.** Only uid and name, to officers after `requireWorkspace`, for the workspace's own alliance (D71); the lists are `ph-no-capture`. Opening a set sends the one desk drilldown event, `ws_drilldown_opened`: `surface` (`insights`), `kind` (the set's kind) and `count_bucket` (`0`, `1`, `2_4`, `5_9`, `10_plus`, `lib/analytics/count-bucket.ts`), a bucket only, never the exact count, which range, a uid or a name (docs/analytics/tracking-plan.md). The fragment never reaches analytics.
- **Tests.** `lib/private/insights-sets.test.ts` (PGlite, one test per set kind, each checked to fail when its rule is broken; newcomer bands and new members unnamed); `app/(private)/_ui/InsightsSetMemory.test.ts` (a stray fragment, and the event's three properties); `e2e/desk-insights.spec.ts`: the top might group opens exactly the seed's members, a name opens their card, and Back finds the group open.

**Amendment 2026-11-23 (issue 752, D158 rule 7 (c); owner's approval of 2026-11-22, "o que as personas recomendarem é o que vamos fazer", of the chart review in issue 736, which says a pulse day lists "who reached it"): a day of the week's pulse names who did each measure.** The 2026-11-22 amendment's "Still counts only" kept the pulse as member-days, because "a per-day list would be a list of who did not do their quests". A pulse day (`?pulseDay=<day>`) now shows, for daily quest points, the coin cap and a donation, "n of N members" and, behind a tap, the names of those who did it that day:

- **Who did it, never who did not.** Only the members who reached the measure are named, thanks first (D75). There is no list or count by name of those who did not; an officer can still tell who is not named, which the panel accepted as officer-only.
- **Names only, in place.** Name order, nothing beside a name, no ranking, no Members `?set=` link (the list opens in place, or in the sheet or the side pane past 12, D158 rule 7 (c)). Each name opens the member's card.
- **Officers only, own alliance.** The page stays behind `requireWorkspace` with the officer tier, for the workspace's own alliance (D71); the names are `ph-no-capture`, and analytics gets a bucket only (`ws_drilldown_opened`, `kind` `pulse_reached`).
- **One rule with the count.** The names come from `reachedOn`, which the pulse's own counts (`pulseOf`) are built from, so a day's names are its column's count.
- **Still counts only:** the week rows of the pulse (member-days), where people came from and went (also on a flow day), newcomers, squads seen and the Raid Shield check, as the 2026-11-22 amendment lists them.
