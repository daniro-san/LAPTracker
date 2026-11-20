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

**A day with no daily quests or no donations is a fact, not missing data.** The owner's 2026-11-19 answer covered daily quest points only; extending the rule to donations (`daily_tech`) is the builder's, pending the owner's confirmation. The read runs at the end of the server day (about 23:30 ST, D72), so a null `active` or `daily_tech` on it means none that day.

- Neither is in the Members tab's "No data" list (`missingOf`), and neither makes a member's status "No data". "No data: donations on {n} days" counts only the days with no read of the member.
- The list row and the card say, in the status's muted text and never as a warning, with `{day}` the newest read's server day:
  - "No daily quests on {day}" ("Sem missões diárias em {day}", "Pas de quêtes du jour le {day}");
  - "No donations on {day}" ("Sem doações em {day}", "Pas de dons le {day}");
  - both in one line: "No quests or donations on {day}" ("Sem missões nem doações em {day}", "Ni quêtes ni dons le {day}").
- In the card's week of donations, a day whose read sent none shows "none" ("nada", "rien"), muted (`DayValue` `"none"`); it is never 0 and never in the week's total.
- "—" and "No data" stay for what no read told: a day with no read, might or Sanctuary not sent.
