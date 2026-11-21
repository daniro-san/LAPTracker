# feat — the officers' Insights page, part 2: KvK cost and recovery, squads seen (issue 489, D139 amendment)

## Built

- **KvK cost and recovery** (section 3), a fourth card on `/w/[slug]/insights`.
  - Closed, it shows a one-line summary ("Last KvK, Sat, Nov 14: the alliance lost 11% of its might, and 73% of that is back.") and "Took a heavy hit — maybe offer help".
  - The help list holds members who lost more than 25% and are now under 80% of their might before the KvK. Name order, no numbers, each name a link to `/w/[slug]/members?m=<uid>`, members on a break left out.
  - Behind "Show the details", the newest KvK: Before, After and Now bars; the share of the loss back day by day (a 7-column grid like the pulse); and "Each member, in name order" in its own fold ("lost 31% · now 64% of before").
  - Up to 3 older KvKs, each folded to one line: "KvK Sat, Nov 7 · lost 13% · 50% back".
- **Squads seen** (section 5), a fifth card, only while the squads read is on.
  - Closed, it shows "91 of 100 members have squads seen; 74 of them in the last 24 hours."
  - Behind the fold:
    - 1 squad, 2 squads, 3 or more, and "None seen yet";
    - how fresh each member's newest sighting is;
    - the strongest squad's might in four equal groups, with each group's middle value.
  - Counts only: no names, no heroes, no lineup.
- **Reads**:
  - `scheduledEventMight` in `lib/repo/workspace-rosters.ts`: one statement, bounded by date.
  - `latestSquadSightings` in `lib/repo/squads.ts`: a recursive skip-scan on a new index, `member_squads_latest_idx (union_id, uid, squad, read_at, id)`. It replaces `member_squads_member_idx` (migration `0067_member_squads_latest`).
  - Both make 0 upstream calls.
- **Pure modules**:
  - `lib/private/insights-kvk.ts` and `lib/private/insights-squads.ts` (the rules);
  - `lib/private/insights-more-words.ts` (the words);
  - `lib/private/insights-format.ts` (the shared number and plural formats, moved out of `insights-words.ts`).
  - Cards are in `app/(private)/_ui/InsightsMore.tsx`.
- **Copy** in EN, PT-BR and FR: `lib/private/dictionary.insights-more.ts`, spread by `dictionary.insights.ts`.
- **Docs**: a dated amendment to D139 and an ARCHITECTURE line.

## Decisions

- **Help rule.** "Below 80% of it" is read as below 80% of their might before the KvK, which matches the per-member "now X% of before".
  - Both thresholds test the whole percents the page shows. Without that, a name sat beside "now 80%" (persona panel MUST).
  - Members on a break are left out (D75).
- **Who counts.** A member counts when they are in the Start read, the End read and the "now" read, each with a might. Everyone else in the "now" read counts as an "other current member", and leavers are a separate count. Neither moves the numbers.
- **"Now".**
  - For the newest KvK, "now" is the newest read.
  - For an older KvK, "now" is the last read of its recovery week: "On Nov 13, before the next KvK". Otherwise a later KvK's loss would show as this one's (QA).
- **Recovery reads.**
  - They start the server day after the KvK. The KvK day's own read only repeats the End read.
  - They run for at most a week, and never past the next KvK.
  - A KvK waits until a daily read newer than its End exists. On KvK day, between the End (14:00 ST) and the night read, the page otherwise showed the day before as "now" (QA MUST).
- **Squad might groups.** Four equal groups, like section 2, not equal-width bands. In the invented data, one strong squad put 81 of 91 members in "0 – 10.0M" (all three reviewers).
- **Collapsed by default.** The page is long, so both cards keep their detail behind native `<details>`, using the kit's `text-button` and `text-link` hover and press states (designer MUST).

## Deviations

- **Raid Shield history (section 6) is not built.** It needs a per-week, per-pass read of `player_reads` over `shield_checks`. That is about three more statements and a sixth card. Left as a follow-up, so #489 stays open.
- **Real data was not used.** Every panel and QA run used invented data, at one year of scale, on a local production build. No real `/v1` read was made for this part.

## Verified

- **`pnpm check` passes**: Prettier, ESLint, tsc, Vitest (1,517 passed, 4 skipped), drift and i18n.
- **Tests**:
  - `lib/private/insights-kvk.test.ts` (3):
    - who counts, and recovery day by day from the day after;
    - the help rule at the 79.6% edge, name order, a member on a break, an older event's window and "now", and a KvK whose End is newer than the newest read;
    - squads seen, freshness and the four groups.
  - `lib/private/insights.test.ts` (+1, PGlite): both reads, with another alliance's KvK and squad rows kept out.
- **Local production build** (`next build`, `next start`, Postgres 18, all 68 migrations). Invented data:
  - 100 members;
  - 365 daily rosters;
  - 52 KvKs × 30 alliances (312k member snapshots);
  - 310k squad rows;
  - joins and leaves around the last KvK;
  - members with no squads;
  - a second workspace with no KvK and squads off.
- **e2e: 87 of 87 checks pass** at 360, 640 and 1280 px, light and dark, EN (PT and FR at 360, PT at 1280), closed and with every fold open:
  - 200 and no sideways scroll;
  - 44 px targets;
  - five sections, with the folds closed at first;
  - help names link to cards;
  - per-member lists are `ph-no-capture`;
  - no blocked key in the HTML;
  - no lineup;
  - the empty state.
  - Screenshots are in the scratchpad's `489b-shots-r2/`.
  - At 360 px, closed, the KvK card is 590 px and the squads card 144 px.
- **Query cost** per Insights view, from `pg_stat_database` through the real `insightsView`, 20 views a run, warm:

  | | transactions | buffer hits | ms (median) |
  |---|---|---|---|
  | before (dev) | 5.3 | 431 | 23.1 |
  | after | 7.3 | 1,847 | 26.0 |

  - The KvK read: 91 buffers, 0.19 ms.
  - The squads skip-scan: 270 index descents, 1,144 buffers, 1.06 ms. It grows with the (member, squad) pairs ever stored, not with rows.
- **Panel** (3 subagents; all three reports came back):
  - **Officer and product strategy**: both accept with changes.
    - MUST applied: rounding in the help rule.
    - SHOULDs applied: members on a break left out; the "joined since" count relabelled; the squads summary reworded; quartile might groups; PT and FR copy fixes; the KvK day's own read dropped.
  - **Designer**: accept with changes.
    - MUST applied: `text-link` and `text-button` states, and no WebKit marker.
    - SHOULDs applied: the day grid; older KvKs folded to one line; the ▾ turns when open; the double rule fixed; a zero-case summary; "None seen yet" set apart.
  - **QA**: one MUST applied: a KvK waits for a read after its End.
    - SHOULDs applied: a 7-day window cap, so a later KvK whose End failed cannot leak in; an older event's "now".
    - Checked and found correct: privacy (no x, y, online, last_online_at, joined_at or avatar_url in the page); copy keys in all three languages; manual, test and admin events, and failed or not-fresh rows, excluded.
- **Privacy**: no name from the OGs fixture roster is in the added lines.

## Open issues

- **Raid Shield history (section 6)** is not built (see Deviations).
- **Stale squad rows count.** A squad number's newest row can be months old (a squad no longer sent), and it still counts toward "3 or more" and the strongest squad. Follow-up: ignore rows older than that member's newest `read_at` (QA).
- **Index size.** `member_squads_latest_idx` was 27 MB against a 30 MB table at 91k rows on the QA count, because the extra columns stop btree deduplication. Watch its size in production (QA).
- **`allLatestSquads`** (the garrison plan's read, D121) still reads every squad row with `DISTINCT ON`. It could move to the same skip-scan. Not touched here.
- **The per-member list is long**: 92 rows, about 3,100 px when opened. Possible follow-ups:
  - two columns from 640 px;
  - linking each name to its card;
  - listing only members still under 95%.
- **The help list sits in the closed card**: about 45 px per name. Past about 10 names, a "Show all (n)" would help (designer).
- **InviteRoles and ImportParts summaries** lack `text-button` too (designer). Pre-existing, not touched.

## Next

- **Model/effort**: keep.
- **Owner first**:
  - After merge, open Insights on the real desk after a KvK. Check the help list and the recovery days against what officers know.
  - Confirm the reading of "below 80% of it" as 80% of their might before the KvK.
- **Plan change**: none.

<adjustments for="issue 489, part 3 (Raid Shield history)">
- Build it as a sixth card in `app/(private)/_ui/InsightsMore.tsx`, collapsed like the KvK and squads cards (`Fold`), only while `shield_check` is on.
- Reuse `passWindows`, `suggestionOf` (`lib/shield-check.ts`) and `shieldReadings` (`lib/repo/shield-checks.ts`). Batch the windows of the last 5 checks into one statement; do not make one call per pass.
- Count per pass "seen with a shield" over that Friday's roster (`dayRosterUids`). A reading is a hint, never a ✗ (D137).
- Measure it with the harness in the scratchpad's `489b-e2e/statdb.mts`. Today the page costs 7.3 transactions and about 1,850 buffer hits per view.
</adjustments>

PR: (added by the orchestrator)
