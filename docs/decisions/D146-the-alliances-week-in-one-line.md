## D146 — The alliance's week in one line on the desk's Home and Members: alliance-level D76 aggregates from the reads Members already holds (2026-11-21, owner, issue 466; uses D75, D76, D127)

Why: the owner approved on 2026-11-19 one line that sums up the alliance's day and week for the officers: "Alliance Help: 62 of 100 reached 1,000 today · daily quest points, median 540 · donations this week 1.2M", on Home's margin and the Members heading.

**What the line says** (`lib/private/alliance-week.ts`, words in `app/(private)/_ui/AllianceWeekLine.tsx`, EN · PT-BR · FR):

- **Alliance Help:** the members at the 1,000 coin cap (`daily_honor`) out of every member the newest end-of-day read lists (D72). A null is none that day (D127), so it counts in the "of", not in the reached.
- **Daily quest points:** the median `active` of the members with quest points above 0 on that read. Nobody with quest points: "no daily quest points {day}".
- **The day word** is that read's server day: "today" when it is today, "yesterday", else "on Fri, Nov 20". The issue said "today", but the read runs at about 23:30 ST, so most of the day the newest read is yesterday's. The day is on both the coins and the quest points.
- **Donations:** `daily_tech` added up over every end-of-day read of the newest read's game week (Monday to Sunday). "this week", "last week" (a Monday before its read), else "the week of {date}". None sent: "no donations this week".
- **Missing reads:** the days of that week before today, or up to the newest read, with no end-of-day read: "no read on Tue, Wed, not in the total". When the newest read is from an earlier week, today's week's past days are named too (QA, 2026-11-21: missing data is always stated, never silent). They are never 0 (D75). Today is never named: its read runs at the end of the day.
- Nothing before the alliance's first end-of-day read (Home already says "Nothing yet").

**The rules.** Alliance-level numbers only, own alliance (D76): no name, no per-member value, no ranking. It is not a comparison between members, so away and new members count, as in Insights' pulse (D139). On Home it comes after the thanks and "Share the thanks", before the check-ins (D75: thanks first). On Members it is under the "Week: … – …" line, before the thanks box.

**Cost.** No query: the line is computed from `MembersView.reads`, the end-of-day reads `membersView` already loads for both pages. Nothing is cached or logged. Measured on a local production build with invented data (`pg_stat_database`, minimum of 5): Home 48 transactions before and after, Members 35 before and after.

**Session replay.** Alliance-level numbers, so no `ph-no-capture` (issue 549 covers per-member values).

**Later (issue 466):** the same numbers may go on the public alliance page for the own alliance (D76 allows aggregates there). That needs a read on the public side and the public cache's rules (D143); it is not built here.

**Amendment 2026-11-22 (issue 585 batch 4, slice S2):** the missing days read "no daily update on Tue, Wed, not in the total" (PT "sem atualização diária em …", FR "sans mise à jour quotidienne : …"; it read "no read on Tue, Wed, …"): "daily update" is the glossary's UI word. The rule is unchanged.

**Amendment 2026-11-22 (D127 amended, issue 739):** `active` is the week's running total since Monday's reset, not a day's value. The line's daily quest points are now the median of the newest read's day's derived points (`questPoints`: the day's total less the day before's, the total itself on a Monday), among the members who earned some that day. A member whose day cannot be derived (no read of the day before) is left out of the median. The words are unchanged.
