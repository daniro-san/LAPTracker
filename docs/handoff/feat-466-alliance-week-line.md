# feat — the alliance's week in one line on the desk's Home and Members (issue 466)

## Built

- **`lib/private/alliance-week.ts`**, pure: `allianceWeek(reads, today)` works from the end-of-day reads that `membersView` already loads (`MembersView.reads`). It returns:
  - members at the 1,000 coin cap, out of every member the newest read lists (reuses `pulseOf`);
  - the median daily quest points of the members with points above 0 on that read (reuses `median`);
  - the donations of the newest read's game week, added up;
  - the past days with no read, in that week and in today's week.
- **`app/(private)/_ui/AllianceWeekLine.tsx`**: the words and a `<p class="text-body-sm">`. The parts are joined with a no-break space before each " · ", so a line never starts with a separator.
- **Home** (`HomeMembers.tsx`): in the "Members this week" note, after the top-3 thanks and "Share the thanks", before the check-ins.
- **Members** (`members/page.tsx`): under the "Week: … – …" line, before the thanks box, limited to `max-w-(--measure)`.
- **Copy** in EN, PT-BR and FR: the `week.*` keys in `lib/private/dictionary.members*.ts`.
- **Test:** `lib/private/alliance-week.test.ts`, 4 cases (coin cap with nulls, quest median, the week's donations only, days with no read).
- **Decision D146.**

What the line says (invented data):

- EN: "Alliance Help: 13 of 24 reached 1,000 yesterday · daily quest points yesterday, median 490 · donations this week 506K"
- PT-BR: "Ajuda da Aliança: 13 de 24 chegaram a 1.000 moedas ontem · pontos de missões diárias ontem, mediana 490 · doações nesta semana 506K"
- FR: "Aide d’alliance : 13 sur 24 ont atteint 1 000 pièces hier · points de quêtes hier, médiane 490 · dons cette semaine 506K"
- With a failed read: "… · donations this week 1.2M · no read on Tue, Wed, not in the total".
- On a Monday before its read: "… reached 1,000 yesterday · … · donations last week 8.4M".

## Decisions

- **The day word** is the newest read's day: "today", "yesterday", or "on Fri, Nov 20". The issue's line says "today", but the read runs at about 23:30 ST, so most of the day the newest read is yesterday's. The day is on the quest points too, because the officer panel and the designer both read the median as a weekly figure without it.
- **The quest median** counts only members with quest points (as D127 measured it: "99 of 100 had daily quest points; median 555"). It shows no "n of N".
- **The donations week** is the newest read's game week, so it matches the "Week: …" line above it on Members. The words are "this week", "last week" or "the week of {date}".
- **Away and new members count.** A share for the whole alliance is not a comparison between members, and Insights' pulse (D139) counts them the same way.
- **No `ph-no-capture`.** The numbers are alliance-level (issue 549's rule covers per-member values).
- **EN keeps the owner's "reached 1,000".** PT-BR and FR name the coins ("moedas", "pièces"), as Insights does.

## Deviations

- On Home the line comes after the thanks, not first. The officer/product panel and the designer both asked for this under D75's "thanks first"; the issue only says "Home margin".
- The quest part reads "daily quest points yesterday, median 490" instead of the issue's "daily quest points, median 540", for the reason above.

## Verified

- **`pnpm check` passes:** 285 test files passed (2 skipped), 1,474 tests passed (4 skipped); i18n is up to date for 17 languages.
- **Transactions per view.** Measured with `pg_stat_database` (`xact_commit + xact_rollback`, minimum of 5) on a local production build. The data is invented: 24 members, 36 days of reads with one missing.

  | View | Before (dev) | After |
  |---|---|---|
  | Home | 48 | 48 |
  | Members | 35 | 35 |

  Each view opened 3 sessions, both before and after.
- **Panel** (subagents; every result came back to this session):
  - **Officer R5/R4 with product strategy:** accept with changes, no MUST. Applied: the day on the quest points; "not in the total" instead of "left out"; the day list as "Tue, Wed" instead of "Tue & Wed"; the line after the thanks on Home; the coins named in PT and FR.
  - **Designer:** accept with changes. 26 screenshots at 360, 640, 1024 and 1280, light and dark, EN, PT and FR. Applied its MUST: a separator or a number could start a line, so there is now a no-break space before each " · " and before each value. Also applied: the line after the thanks on Home, and `max-w-(--measure)` on Members.
  - **QA:** PASS, no MUST.
    - The numbers match SQL.
    - The edge cases hold: missing reads, no end-of-day read (no line), Monday, all nulls, and 101 members.
    - There is no double counting across weeks.
    - It confirmed 48 and 35 transactions.
    - 360 px fits in 3 languages, light and dark.
    - No per-member value is added to the HTML.
    - Applied its SHOULD: when the newest read is from an earlier week, the current week's past days with no read are named too.
- **After the fixes,** on a rebuild: still 48 and 35 transactions. At 360 px in EN, PT-BR and FR, light and dark, every page answers 200, there is no sideways scroll, and no line starts with " · ".

## Open issues

- **Not applied, NICE:**
  - "median" against Insights' plain "middle value": the issue's copy says "median", so this is the owner's call.
  - "n of N did daily quests" beside the median.
  - Rows instead of one line on Home: this would change the issue's "one line".
  - A link from the line to Insights: a feature beyond the issue.
  - Capitalising the line when it starts lowercase: only when a read lists no members, which a usable roster never does.
- **Even-count medians** are rounded to a whole number (`f.number`, `maximumFractionDigits: 0`).
- **Pre-existing, seen by the designer:** on Home's "Add your tracker key" card, the two links render with no space between them ("Open the tracker's API pageAlliance settings"), in EN and PT.

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- The same numbers on the public alliance page (issue 466's "Later") would need a public read model and D143's shared cache: the desk line reads `MembersView.reads`, which is private (D71) and must not go into the public cache. A precomputed per-day aggregate stored at the nightly read would serve both pages.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/557
