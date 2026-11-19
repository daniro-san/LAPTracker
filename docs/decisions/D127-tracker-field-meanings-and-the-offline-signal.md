## D127 — What the tracker's roster fields mean, and the offline signal: null on a successful read that lists a member is "nothing today" (2026-11-19, owner, issue 458; amends D71, D75, D76, D121)

Why: on 2026-11-19 the owner and a guest alliance's leader checked the tracker's roster fields against the game and her spreadsheet. Two of the three were named wrong in the workspace. The offline signal (D75) never fired for members who do not log in, because it skipped null, and it assumed a weekly activity that resets on Monday.

**What the fields mean.**

- `active`: daily quest points. Live; resets at 00:00 ST. Not weekly. No fixed cap: a full day is about 750, seen up to 1,035.
- `daily_honor`: Alliance Help coins today, max 1,000 ("Daily Alliance Coin" on the Alliance Help screen). Not honor.
- `daily_tech`: tech donated today. Unchanged.
- The game sends null, never 0, for all three. In an early-day read, about 21 of 101 members had all three null.

**Null on a successful read that lists the member means "nothing today".** This settles what a null means under D75's first rule ("data we failed to capture is never counted"). A read that failed, or a day with no read, is still "no data" and never counts against anyone.

**The offline signal** (`idleRun` in `lib/private/member-week.ts`):

- `active` null and `daily_tech` null on 3 end-of-day reads in a row (`IDLE_READS`), counted back from the newest read.
- Each of the 3 reads succeeded (a usable roster, D60, D72), lists the member, and is the server day after the one before it.
- A failed or missing read, a read that does not list the member (a member who joined in the last 2 days), or a day with quest points or donations ends the run.
- The evidence is the number of reads in the run: "no new donations or activity for 3 days". `daily_honor` is not part of the rule.
- The Monday reset is gone: `active` is daily, so there is nothing to reset.

**Thanks and picks use the week.** The week's "Daily quest points" thanks, and the "active" signal of the caravan suggestions, the garrison plan's order and the Elixir team picks, read `weekQuestPoints`: the member's `active` added up over the end-of-day reads of the newest read's game week (Monday to Sunday), null when no day has a number. In one line: "each day's quest points this week, added up". A card says "Did daily quests this week" ("Quests this week" on a team pick) when the sum is above 0. The number stays on the server (D76).

**Labels** (EN, PT-BR, FR):

- "Activity this week" and "Most active" → "Daily quest points" ("Pontos de missões diárias", "Points de quêtes du jour"). The Members card's line reads "Daily quest points {v}", today's number.
- "Day's honor" → "Alliance Help coins today (max 1,000)".
- "Active this week" → "Did daily quests this week" on caravan suggestions and garrison cards; "Active" → "Quests this week" on team picks; the caravan and team help lines say "most daily quest points this week".

**Not changed here.** The Members tab still shows a null `active` as "—" and lists it under "No data: daily quest points". Under this decision it means "no quests yet today"; changing that display is a separate change.
