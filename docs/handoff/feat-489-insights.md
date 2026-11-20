# feat — the officers' Insights page, part 1 (issue 489, D139)

## Built

- **The page.** `/w/[slug]/insights` is a view of Members. It shows three cards: the week's pulse, effort at every might level with "Quiet contributors", and the membership flow. From 1024 px a margin note, "How this page counts", sits beside them.
  - Reached from the view switch ("Members · Former members · Insights") below 1280 px, and from the sidebar under Members from 1280 px.
  - Files: `app/(private)/w/[slug]/insights/page.tsx` and `app/(private)/_ui/InsightsSections.tsx`.
- **The read** (`lib/private/insights.ts`) takes the last 36 end-of-day reads, the first-seen days and the break notes. For the people who joined or left, it also reads:
  - the other alliances' daily rosters, through the new `sightingsElsewhere` in `lib/queries/roster-stays.ts` (alliance id and day only);
  - our members' own `player_history` tags.
  - It makes 0 upstream calls.
- **Pure modules.** `lib/private/insights-rules.ts` holds the arithmetic. `lib/private/insights-words.ts` turns it into the rows the bars draw and the "based on" lines.
- **The switch.** `insights` is added to the D126 Tabs group. It is on by default and spends nothing. Its name is in `/admin` and in Alliance settings (EN, PT, FR).
- **Share the thanks** from "Quiet contributors":
  - `sharePropsFor` in `share-thanks-data.ts` builds the same sheet for any list of people;
  - a new deed, `steady` ("kept up their daily quests and donations"), in `lib/ai/thanks-writing.ts`, and the thanks route takes up to 3 deeds;
  - its own pick-help line.
- **Copy.** `lib/private/dictionary.insights.ts` holds the words in EN, PT and FR.
- **Docs.** The decision record D139, a dated amendment to D114, the decisions index and an ARCHITECTURE line.

## Decisions

- **D139.** One null rule for the whole page, D127's:
  - on a read that lists a member, null is "none that day" and counts as 0, in the pulse's shares and in the effort averages;
  - a day with no read is left out.
  - The member card's "Last 7 days" (D136) averages days with a number only. Insights does not follow it, because a comparison must not let one big day out of seven stand for the week (persona panel, analyst).
- **"Quiet contributors" rule.** Below the median might, and above the median in both daily quest points and donations, over the last 7 reads. New members and members on a break are left out (D75). Name order, no numbers.
- **Minimum reads.** With fewer than 3 effort reads there are no groups and no names.
- **Tenure.** Counted from the first daily read that lists a member, never from `joined_at`. A band longer than our records is hidden.
- **Where the page lives.** It is a view of Members, not a sixth tab: the five bottom tabs stay as they are (DESIGN.md "Desk navigation").

## Deviations

- **Coin cap denominator.** The issue's example, "74 of 98 at the coin cap", divided by the members with a coin count. The page divides by every member the read lists (null counts as not at the cap), to keep one null rule. Real numbers will therefore read lower than that example.
- **"Did daily quests" is now "Earned daily quest points".** The page counts quest points above 0. It cannot tell whether the quests were finished.
- **Persona panel data.** Production's public pages and history API answered 500 on 2026-11-20 at about 22:40 UTC (`/`, `/alliances`, `/alliances/67111155/history`, `/api/alliances/67111155/history?at=…`). So the panel saw:
  - one real `/v1/alliances/67111155` read (100 members, mid server day);
  - six real `/v1/players` histories;
  - the invented-data screenshots for the design.
  - Multi-week real numbers (flow, weeks) were not seen.

## Verified

- **`pnpm check` passes** after the rebase onto dev with D137: Prettier, ESLint, tsc, Vitest (1,380 tests in 264 files, 4 skipped), drift and i18n.
- **Tests added**, about one per stated behaviour:
  - `lib/private/insights-rules.test.ts` (5): the pulse; the averages and the four groups; the Quiet contributors rule and its order; joins, leaves, origins and unknowns; tenure and newcomers.
  - `lib/private/insights.test.ts` (1), on PGlite: both origin sources, a member on a break left out, and no private field in the view.
  - The issue 471 suite (`cross-workspace-reads.test.ts`): Alpha's Insights read holds none of Bravo's members, history tags or the private markers, and Bravo's own read holds Bravo's.
  - `turned-off.test.ts`: with the switch off, the page goes to Home.
- **Local production build.** `next build` and `next start`, on local Postgres 18 with all migrations, with invented data:
  - an invented 42-member alliance with 36 days of end-of-day reads, one missing;
  - 5 joins and 3 leaves;
  - two invented other alliances and a history row;
  - a member on a break.
- **The e2e passes 49 of 49 checks**, run at 360, 640 and 1280 px, light and dark, EN (PT and FR at 360 px, PT at 1280 px):
  - every page answers 200, with no sideways scroll;
  - every link and button in `main` is 44 px or taller;
  - all three sections are present, and no blocked key appears in the HTML;
  - the Members switch links to the page and fits at 360 px, and the sidebar marks Insights;
  - "Share the thanks" opens with all quiet contributors ticked (7 of 7).
  - Screenshots are in the scratchpad's `489-shots-r2/`.
- **Persona panel**: an R5, an R4 on a phone, a regular member's view, a data analyst and product strategy.
  - Verdicts: four accepted with changes, and the member's view accepted.
  - All eight must-fix items are applied:
    - the neutral effort lead;
    - one null rule;
    - the sheet's own help line;
    - at least 3 reads before groups or names;
    - singular and plural forms, and a single date;
    - "Earned daily quest points";
    - tenure: bands past our records hidden, and "Already here at our first read";
    - "0" instead of "+0" and "−0".
  - Also applied: the donor share beside the donation median, "n reads" in the week rows, and the French "no read" line.
  - On the one real read: 100 of 100 earned quest points, 47 of 100 were at the coin cap, and the median donation was 5.35K among the 91 of 100 who donated. Before the 3-read minimum, 8 members fitted "Quiet contributors" on that single day. The 6 history rows named only this alliance.
- **Upstream calls.** Exactly 7, all plain (no `fresh`), 1 s apart: 1 `/v1/alliances/67111155` and 6 `/v1/players`. The raw files are kept local in the scratchpad's `489-real/` and deleted after the panel. No Discord or PostHog call was made.
- **Privacy.** No name from the OGs fixture roster is in the added lines.

## Open issues

- **Production was down** (500 on every public page and the history API) at about 22:40 UTC on 2026-11-20. Not investigated here.
- **Real multi-week numbers are not checked yet**: the weekly pulse, joins and leaves, origins and tenure. Look at them on the desk after merge.
- **Day columns** in the pulse use the same 24 px bar as the member card. The percent columns (75–90 %) look alike. The panel suggests one "this week vs last week: up / same / down" line per measure. Follow-up.
- **The coin-cap weekly list is flat** (75–77 % in the invented data, and likely in the real data too). The panel suggests folding it into one line. Follow-up.
- **At 360 px the page is about 4,700 px tall.** Collapsible sections would shorten it. Follow-up.
- **The flow's first change date** ("since Oct 19") differs from the first-read date (Oct 15) when the records start mid-week. Cosmetic.

## Next

- Model/effort: keep.
- **Owner first**: open the page on the real desk after merge and check the multi-week numbers. The panel saw one day only.
- Plan change: none.

<adjustments for="issue 489, part 2 (KvK recovery)">
- Build it as a fourth card in `InsightsSections.tsx`, with its read beside `insightsView`. `Bars` takes label, value, share and note rows.
- "Took a heavy hit — maybe offer help" is the second name list. Follow Quiet contributors: name order, and no number beside a name.
- `scheduledEventKills` in `lib/repo/workspace-rosters.ts` already finds an event's Start and End rows. Might before, after and now needs the members' power from the same snapshots plus the end-of-day reads.
- Use the same null rule as D139.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/522
