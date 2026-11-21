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
- **Raid Shield history (section 6) is not built here.** It is listed as a follow-up in the handoff.

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
