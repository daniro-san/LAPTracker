# fix/739-quest-points — daily quest points from the weekly running total (issue 739)

## Built

- **One pure helper** in `lib/private/member-week.ts`:
  - `questDay(day, total, before)` turns the game's `active` into one day's points. On a Monday the day's points are `total`. On any other day they are `total − before`. 0 is "none". No read of the day before is no data (null), unless `total` is 0. A total lower than the day before's inside one week is no data.
  - `questPoints(reads, uid, day)` applies it to the end-of-day reads. A null `active` on a read that lists the member counts as 0 so far this week.
  - `weekQuestPoints` is now `active` on the newest read of the game week that lists the member. It no longer adds up the week's reads. It is still null when the week has none.
  - `QUEST_DAY_CAP = 240` (1,680 a week), commented as provisional: the owner thinks it may be 230.
- **Every consumer reads the helper:**
  - The member card's "Last 7 days" (`member-days.ts`). The card loads `LAST_DAYS + 1` reads, so the first day has the day before.
  - The Me page's "This week" and its "Last week" average (`me-parts.ts`, `cellOf`). It uses `questDay` on `ownDays`, which needs no extra read because both weeks start on a Monday.
  - Insights: the pulse's quest share, out of the members whose day is known (`pulseOf(reads, history)`), and the effort groups and "Quiet contributors" (`effortsOf`).
  - The alliance week line's median (`alliance-week.ts`).
  - The Members row's `activity` and `noQuestsOn` (`members.ts`), so the list, the copy sheet column and "No daily quests on {day}" follow.
  - `weekQuestPoints`, and through it the thanks top 3, caravan suggestions, garrison signal and Elixir picks. Their signatures are unchanged.
  - The offline signal `idleRun`: a quiet day is a derived "none" day with `daily_tech` null.
- **The cap as bar reference:**
  - Quest point bars are drawn against `QUEST_DAY_CAP` on the member card, on Me, and in Insights' effort groups. The effort groups had drawn against the highest group.
  - `allianceBest` now returns donations only. Donations keep the alliance's best member-day (the member's own best day on Me), and coins keep 1,000.
  - `card.days.scale` reads "Bars: coins out of 1,000 and quest points out of {quests}, the daily limit the reads show; donations against {donations}, …" (EN, PT-BR, FR).
- **Decisions:** dated amendments to D127 (the field's meaning, the helper, the week total, the offline signal), D76, D114, D121, D136, D142 and D158.
- **Fixtures:**
  - The unit and PGlite test fixtures that sent `active` as a daily value now send running totals. These are the files under `lib/private/*.test.ts`, `app/(private)/api/w/[slug]/me/route.test.ts` and `app/(private)/_ui/replay-masking.test.ts`.
  - The e2e seed sends `active` as `questTotalOf`, the days added up from Monday, with the IDLE members earning nothing on their quiet days. `questPointsOf` stays the day's figure the pages show.
  - The sentinels are now 175 (Lantern Keep) and 155 (Moss Hollow), under the cap. The linked member's offsets are halved (±15, +10, +25), so every day stays at or under 240.
  - `fixtures/*.json` (the upstream contract) are untouched.
- **Tests (each fails when its rule is broken):**
  - `member-week.test.ts`: Monday's first value, mid-week differences, the Sunday-to-Monday reset, no data without the day before, no data on a drop, "none" on 0 and on a null total, the week total as the newest read, and the offline signal on a flat running total. The old code never fired, because `active` stayed non-null.
  - `caravans.test.ts` (PGlite): `weekQuestPoints` equals Sunday's running total (480, 230, null, 700), not the sum (3,120 …), and the caravan and Elixir orders follow it.

## Decisions

- **Refinement of the "missing previous read is no data" rule.** When the day's running total is 0, the day is "none" even with no read of the day before. The counter starts at 0 on Monday and never drops inside a week, so 0 means nothing earned on any day so far, that day included. Without this, a member with nothing all week would have no data on the day after every missed read, and the offline signal and "none" days would vanish there.
- **Insights pulse share:** the quest share's denominator is now the members whose day's points are known, so a day after a missed read is not counted as "did no quests". Coins and donations keep "of the members the read lists".
- **The alliance week line's median** stays "of those who earned some that day", as before.
- **The quest cap is used on Me too.** The cap is not another member's value, so D158's reason for Me's own-best-day scale does not apply to it.
- **The effort groups' quest bars use the cap,** since D158 rule 2 draws a share against a known cap. The task named "the quest-point bars" without limiting it to the card.
- **The e2e leak scan still looks for the day's figure only.** I tried a second pattern for the newest read's raw running total, but every weekly multiple of every candidate from 150 to 235 occurs somewhere in the app's sources. 165 is a coordinate in the mascot's SVG path, which the first e2e run tripped on. So the pattern would fail on some weekdays and not others.

## Deviations

- The task said a missing previous read is always no data. The refinement above makes it "none" when the total is 0. I added it because the PGlite follow-up fixtures (quiet members from a Tuesday read on) and real data both hit it, and the result is certain, not a guess.
- I did not add "(max 240)" to the quest labels, which both officer personas asked for as nice-to-have. The data-honesty reviewer found that "the most a day" already overstated an unconfirmed cap, so the scale line now says "the daily limit the reads show". A label belongs with the owner's confirmation.

## Verified

- `pnpm vitest related --run` on every changed file: green (599 tests over 111 files at the main step; 448 tests over 84 files after the copy fix).
- `pnpm check`: green (370 files, 1,978 tests, 4 skipped; i18n up to date in 17 languages; no schema drift).
- e2e on my own cluster (127.0.0.1:54330, database `lap_e2e_739`) and ports (app 3487, bridge 54387, https 3488, stub 3489):
  - Run 1: the leak scan flagged `b.active` on every page, because 165 is in the mascot's SVG path. I changed the sentinels.
  - Run 2: 82 passed, 10 skipped, 0 failed.
  - Final run on a fresh build of the final code: 82 passed, 10 skipped, 0 failed.
- **Persona check** on 360 px screenshots from the local production build with the e2e seed: the card's Last 7 days, Insights' effort groups, Home's week line and Me's This week.
  - Officer, R4, English as a second language: the numbers read as one day's points. Their "must-fix", the scale line cut off at the bottom of the card, is a screenshot artefact. The card is a scrolling sheet with a sticky action bar, and the line continues when you scroll; that layout is unchanged by this PR. Their "(max 240)" label is under Deviations. Their "median", "Left out: 1 new" and Home-vs-Insights counts are older copy and are left for a follow-up.
  - Officer, R5: consistent across card, Insights, Home and Me; nothing leads to a wrong seat, thank-you or check-in. Same notes.
  - Data-honesty reviewer: "honest", no must-fix. The numbers match the rule (175/240 = 72.9 % fill measured at 72.8 %). The cap copy overstated certainty, which I fixed. The other findings are under Open issues.
- The shots stay in the session scratchpad's `shots/` folder; none are committed.

## Open issues

- **Owner: 230 or 240?** Every read fits 240: Tuesday reads at 480, and Sunday reads above 7 × 230 = 1,610. If 230 is confirmed, change only `QUEST_DAY_CAP` (the e2e seed's highest day, 200, stays under either cap) and the D127 and D158 amendments' figure. Then consider "(max N)" on the quest labels. A Monday read after the reset would also pin the reset moment.
- **Follow-up (data-honesty):** a null `active` after a nonzero total inside one week counts as 0. That day becomes no data (a drop), but the next day reads the whole total. In the stored data, 0 of 1,876 in-week pairs dropped, so this was not guarded (CLAUDE.md: no handling for cases that cannot happen). If it ever happens, treat a null after a nonzero total as no data in `totalOn` and in `me-parts.ts` `totalOn`.
- **Follow-up:** a read about 30 minutes before the reset lets a day carry a few points past the cap. The bar clamps, and the number shows as read. A one-line note on the card could say so.
- **Follow-up:** the e2e leak scan finds a raw `active` leak only on days when the newest read is a Monday, where the running total equals the sentinel. A sentinel scheme whose weekly multiples are also unique in the page markup would close it.
- **Follow-up (older copy):** Home's "median" could say "of those who earned some". The Insights effort line "Left out: 1 new" and Home's "11 of 11" next to Insights' "10 members" both confused the officer personas.
- Analytics: no change. No event is added, changed or removed, and no event carries quest points (D76).

## Next

- Owner answers 230 or 240 on #739, and the constant follows.
- Follow-ups above, as issues, if the orchestrator agrees.

What was missing from the task prompt? Whether a running total of 0 with no previous read is "none" or no data. The fixtures and the offline signal hit it at once.

PR: (added by the orchestrator)
