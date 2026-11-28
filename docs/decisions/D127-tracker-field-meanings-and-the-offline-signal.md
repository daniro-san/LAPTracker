## D127 — What the tracker's roster fields mean, and the offline signal: null on a successful read that lists a member is "nothing today" (2026-11-19, owner, issue 458; amends D71, D75, D76, D103, D121)

Why: on 2026-11-19 the owner and a guest alliance's leader checked the tracker's roster fields against the game and her spreadsheet. Two of the three were named wrong in the workspace. The offline signal (D75) never fired for members who do not log in, because it skipped null, and it assumed a weekly activity that resets on Monday.

**What the fields mean.**

- `active`: daily quest points. Live; resets at 00:00 ST. Not weekly. No fixed cap: a full day is about 750, seen up to 1,035.
- `daily_honor`: Alliance Help coins today, max 1,000 ("Daily Alliance Coin" on the Alliance Help screen). Not honor.
- `daily_tech`: tech donated today. Unchanged.
- The game sends null, never 0, for all three. In an early-day read, about 21 of the 101 members in that read had all three null (the tracker listed one unranked extra; the cap is 100, see #481).

**What one roster read showed** (aggregates of the alliance's 100 roster rows, 2026-11-19; no member's values):

- `active`: 99 of 100 had daily quest points; minimum 250, median 555.
- `daily_honor`: 74 of 98 with a value were at the 1,000 cap.
- `daily_tech`: median 6,500 a day.
- `online` was false and `last_online_at` null on all 100, so the tracker cannot tell who is offline. That is why the offline signal reads quest points and donations instead.
- `joined_at` was null on all 100, so a member's first day is the first roster that lists them (first seen), not a join date.

**Null on a successful read that lists the member means "nothing today".** This settles what a null means under D75's first rule ("data we failed to capture is never counted"). A read that failed, or a day with no read, is still "no data" and never counts against anyone.

**The offline signal** (`idleRun` in `lib/private/member-week.ts`):

- `active` null and `daily_tech` null on 3 end-of-day reads in a row (`IDLE_READS`), counted back from the newest read.
- Each of the 3 reads succeeded (a usable roster, D60, D72), lists the member, and is the server day after the one before it.
- A failed or missing read, a read that does not list the member, or a day with quest points or donations ends the run.
- A member first seen less than 7 days ago (`OFFLINE_GRACE_DAYS`) never gets the signal (owner, 2026-11-19; 7 days, not the 14 of the "New" tag, owner 2026-11-20). The "New" tag and the thanks keep `NEW_MEMBER_DAYS` (14).
- The evidence is the number of reads in the run: "no new donations or activity for 3 days". `daily_honor` is not part of the rule.
- The Monday reset is gone: `active` is daily, so there is nothing to reset.

**Thanks and picks use the week.** The week's "Daily quest points" thanks, and the "active" signal of the caravan suggestions, the garrison plan's order and the Elixir team picks, read `weekQuestPoints`: the member's `active` added up over the end-of-day reads of the newest read's game week (Monday to Sunday), null when no day has a number. In one line: "each day's quest points this week, added up". A card says "Did daily quests this week" ("Quests this week" on a team pick) when the sum is above 0. The number stays on the server (D76).

**Labels** (EN, PT-BR, FR):

- "Activity this week" and "Most active" → "Daily quest points" ("Pontos de missões diárias", "Points de quêtes du jour"). The Members card's line reads "Daily quest points {v}", today's number.
- "Day's honor" → "Alliance Help coins today (max 1,000)".
- "Active this week" → "Did daily quests this week" on caravan suggestions and garrison cards; "Active" → "Quests this week" on team picks; the caravan and team help lines say "most daily quest points this week".

**A day with no daily quests or no donations is a fact, not missing data.** The owner decided it for daily quest points on 2026-11-19 and confirmed the same rule for donations (`daily_tech`) on 2026-11-20. The read runs at the end of the server day (about 23:30 ST, D72), so a null `active` or `daily_tech` on it means none that day.

- Neither is in the Members tab's "No data" list (`missingOf`), and neither makes a member's status "No data". "No data: donations on {n} days" counts only the days with no read of the member.
- The list row says, in the status's muted text and never as a warning, with `{day}` the newest read's server day (since D136, 2026-11-20, the card no longer has this line: its "Last 7 days" shows that day as "none"):
  - "No daily quests on {day}" ("Sem missões diárias em {day}", "Pas de quêtes du jour le {day}");
  - "No donations on {day}" ("Sem doações em {day}", "Pas de dons le {day}");
  - both in one line: "No quests or donations on {day}" ("Sem missões nem doações em {day}", "Ni quêtes ni dons le {day}").
- In the card's week of donations, a day whose read sent none shows "none" ("nada", "rien"), muted (`DayValue` `"none"`); it is never 0 and never in the week's total.
- "—" and "No data" stay for what no read told: a day with no read, might or Sanctuary not sent.

**Amendment 2026-11-20 (owner, issue 461; D136): the member card's days.** The card's week of donations and its "Daily quest points {v}" and "Alliance Help coins today (max 1,000)" rows are replaced by "Last 7 days": the 7 server days up to the newest read, a row each for daily quest points, Alliance Help coins and donations. The rules above hold there: "none" on a read that lists the member with nothing sent, "—" (the no-data mark) for a day with no read, neither ever 0, and each row's average counts only the days with a number. "No data: donations on {n} days" stays on the Members list but is no longer a headline on the card.

**Amendment 2026-11-22 (owner's decision on #663; D136 amended the same day): a "none" day in an average.** In the 2026-11-20 amendment, "each row's average counts only the days with a number" no longer holds. The member card's, a member's own page's and Insights' averages count a "none" day as 0, and the line says how many such days there were ("Average 400 · 6 days, of which 2 none"; "None on all 7 days" when every listed day is "none"). A "none" cell is still written "none", never 0. A day with no read still never counts.

**Amendment 2026-11-22 (issue 739, orchestrator, from a read-only check of the stored reads): `active` is the week's running total, not a day's value.** The field meaning above is wrong for `active`, and so is everything built on it:

- `active` is the daily quest points earned since the week's reset, Monday at the daily reset (00:00 ST), added up. Inside one game week it never dropped from one read to the next (1,876 member pairs); from Saturday to the next week's Friday or Tuesday it dropped for 65 of 81 and 88 of 90 members. "Live; resets at 00:00 ST. Not weekly." and "The Monday reset is gone" no longer hold.
- "A full day is about 750, seen up to 1,035" and "median 555" were a Wednesday's and a Thursday's running totals. The alliance's highest value grows by about 240 a day (Tuesday 480, Sunday 1,660). The data fits a cap of 240 a day; the owner thinks 230 and has not confirmed: `QUEST_DAY_CAP` in `lib/private/member-week.ts`: 240 a day (1,680 a week), provisional until the owner confirms 230 or 240.
- **A day's quest points** come from one pure helper, `questDay` (`questPoints` over the end-of-day reads) in `lib/private/member-week.ts`. On a Monday they are that day's `active`. On any other day they are the day's `active` less the day before's, in the same week. A null `active` on a read that lists the member is 0 so far this week. A result of 0 is "none" (#663: it counts as 0 in averages and is written "none"). With no read of the day before that lists the member, the day is no data (D75), unless the total is 0: nothing yet this week means nothing that day. A total below the day before's inside one week is no data.
- Every use reads the helper: the member card's "Last 7 days" and a member's own "This week" (D142), rows and averages, Insights' pulse ("Earned daily quest points", out of the members whose day is known) and effort bands with "Quiet contributors" (D139), the alliance week line (D76), the Members row's "Daily quest points" and its copy sheet column, and "No daily quests on {day}", which now means none earned that day. The member card reads one end-of-day read more (8), so the first of its 7 days has the day before.
- **The week's quest points** (`weekQuestPoints`) are `active` on the newest read of the game week that lists the member: the week so far, never the reads added up. "In one line: each day's quest points this week, added up" now reads "the week's quest points so far". Null when no read of the week lists the member or the total is 0, as before. The thanks list (D114), the caravan suggestions, the garrison plan's order (D121) and the Elixir team picks keep their words.
- **The offline signal** counts a read as quiet when the member's derived quest points that day are "none" and `daily_tech` is null. A day whose quest points are no data ends the run, as a failed read does. Before this, one quest point on a Monday kept `active` above 0 until the next reset, so the signal came up to about 9 days late.
- `daily_tech` and `daily_honor` are daily values, as this entry says; nothing changes for them.

**Amendment 2026-11-27 (owner, issue 739): the daily quest points cap is 250.** The owner confirmed in the game that a day with every daily quest done totals 250 (2026-11-26/27). `QUEST_DAY_CAP` is 250 a day (1,750 a week), confirmed; the 240 read from the stored reads, provisional until now, is replaced (D158, amended 2026-11-27).

**Amendment 2026-11-28 (issue 465, see D114).** The "Most active" top 3 quoted above no longer exists: the Members thanks and Home show who did quests every day this week instead, by name and with no number.
