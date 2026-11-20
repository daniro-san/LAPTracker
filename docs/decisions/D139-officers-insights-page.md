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
