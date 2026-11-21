# feat — the officers' Insights page, part 3: Raid Shield history (issue 489, D139 amendment)

## Built

- **Raid Shield history** (section 6): a sixth card on `/w/[slug]/insights`. It shows only while the Raid Shield check is on (`shield_check`, D134). The page keeps its officer gating.
  - **Closed**, one summary line: "Last raid, Fri, Nov 20: 89% seen with a shield in the morning (Friday night: 29%)."
    - A night-only week reads "…; no morning reading".
    - While the morning check runs, it reads "the morning check is under way (Friday night: 29%)".
    - With no reading in 8 weeks: "No Raid Shield check has a reading in the last 8 weeks. This fills in after the next Friday night."
  - **Behind "Show the details"**:
    - "Thank you to everyone who turned on a shield.";
    - the lead (map scans, and why the night share is low);
    - one block per week for the last 8 Fridays, the newest first, with "Night check" and "Morning check" bars and notes like "28 seen of 95 read · 5 not read".
  - **Missing data**:
    - a check that did not run, or read nobody, is "no reading" with no bar;
    - a week with neither check is its date and "no reading";
    - a check with at least as many members not read as read is "partial reading";
    - a running morning check is "under way" with no share.
- **The read:** `shieldPassCounts` in `lib/repo/shield-checks.ts`, one statement per view, 0 upstream calls.
- **Pure rules:** `lib/private/insights-shield.ts` (the Fridays, the windows, the weeks).
- **Words:** `shieldWords` in `lib/private/insights-more-words.ts`.
- **Card:** `ShieldCard` in `app/(private)/_ui/InsightsMore.tsx`.
- **Bars:** `Bars` gains `bare`, so a row with no share draws no empty track. Only this card uses it.
- **Copy:** EN, PT-BR and FR, `insights.shield.*` in `lib/private/dictionary.insights-more.ts`.
- **Docs:** a D139 amendment and an ARCHITECTURE line.

## Decisions

- **One row per Friday, not per KvK event.** The check runs every Friday night (D137), so a week is a Friday and its two windows (`passWindows`, the same windows Raid prep uses).
  - This week's Friday counts once 23:00 ST has passed, the opening of its night window. Before that, last week leads.
- **A check counts only when `shield_checks` says it ran.**
  - The night: `night_at` is set.
  - The morning: `morning_status` is running, done or stopped. A skipped morning does not count.
  - The squads read on other Fridays also leaves readings in the night window. Without this rule, a week with no check would show a share.
- **The share is out of the members read, not the roster.** Members with no reading are "not read" and never a miss (D75). The members are those of that Friday's daily roster.
- **The officers' hand-mark count was dropped.** The issue made it optional, and the persona panel said it measured officers more than the raid. Dropping it also removed one read.
- **The read goes by window, not by member.**
  - The first form went through `player_reads_member_idx` with `uid = any(roster)`: 1,050 index descents, 3.7k buffers, 4 ms.
  - The window form goes through `player_reads_read_at_idx` and filters to the roster after: 347 buffers, 1.9 ms. Grouping by the roster array cost the rest, so it groups by day and pass only.
  - A window holds every alliance's reads of that hour, but no older history (D149).

## Deviations

- **Copy changes from the task's example.**
  - The summary uses "Last raid, {date}: … (Friday night: 29%)", with a colon, as the persona asked.
  - The lead says the night window as "Friday night, 23:00–00:00 ST". "From 23:30 ST" did not match the window the count uses (QA).
- **Real data was not used.** Every check ran on invented data, on a local production build.

## Verified

- **`pnpm check` passes**: Prettier, ESLint, tsc, Vitest (1,519 passed, 4 skipped), drift and i18n.
- **Tests**:
  - `lib/private/insights-kvk.test.ts` (+1): the 8 Fridays before and after Friday 23:00 ST; both checks; a partial night with a finished morning that read nobody; a week with no check; the "no reading" headline; a running morning ("under way", no share).
  - `lib/private/insights.test.ts` (+1, PGlite): the counts over Friday's roster; the newest reading in the window wins; a missing field is not read; a night-only week; a week with no check; another alliance's reading left out; null while the check is off.
- **Local production build** (`next build`, `next start`, Postgres 18, 68 migrations). Invented data at one year of scale:
  - 100 members, 365 daily rosters;
  - 368k player reads: ours and 9 other alliances' daily squads reads, plus Saturday morning reads;
  - 51 checks, with gaps:
    - Oct 30 and Oct 2: no check;
    - Nov 6: night only;
    - Oct 23: a stopped morning that read 50;
  - 52 Raid prep roll calls;
  - "fern" with the check off.
- **My browser checks**, on the final source: 35 of 35 pass.
  - Sizes: 360 px EN light and dark, PT and FR light, and 1280 px.
  - Each one: 200; no sideways scroll; summary 44 px; the thanks line; "under way" and "partial reading" shown (EN and PT); no empty bar track.
  - `/w/fern/insights`: 200 with no card.
  - Screenshots are in the scratchpad's `489c-shots/`. At 360 px in PT, "em andamento · 86 vistos de 97 lidos · 3 sem leitura" fits on one line.
- **Query cost** per Insights view, from `pg_stat_database` through the real `insightsView`, 20 views a run, warm, 3 runs:

  | | transactions | buffer hits | ms (median) |
  |---|---|---|---|
  | before (dev) | 7.3 | 1,843 | 25.0–25.8 |
  | after | 8.3 | 2,076–2,126 | 28.1–28.2 |
  | after, check off | 7.3 | 1,843 | 25.3 |

- **Panel** (2 subagents). Both results reached the orchestrator, which relayed them to me.
  - **Officer and product persona.**
    - MUSTs applied: "seen of … read" in the note; the line that explains the low night share; the colon in the summary.
    - SHOULDs applied: "partial reading"; "under way"; the officers' count dropped; thanks first.
    - COULDs applied: the empty week's heading; PT and FR wording.
  - **QA**, on the build that still had the officers' line: no MUST.
    - Passed: all 8 weeks matched QA's own SQL; the Friday boundary; hidden while off with unchanged cost; 0 names and 0 uids; 360 px light and dark in EN, PT and FR.
    - Applied: the window wording; the same heading for empty weeks; no empty track. QA's SHOULD (re-test the new states and re-measure) is the browser check and cost table above.
- **Privacy**: the card holds counts only. No name from the OGs fixture roster is in the added lines.

## Open issues

- **Coverage share (follow-up, persona panel).** One share of members "seen by the tracker or ✓ by an officer" per week would show how ready the alliance was, not only what the map scan saw.
- **KvK's gender in PT and FR** (o/a KvK, le/la KvK) is not consistent across the Insights copy (persona panel). Follow-up only.
- **The window read grows with the number of alliances read in that hour**, not with history. At 10 alliances it is 347 buffers. Watch it if many more workspaces turn on the squads read.
- **`Bars` `bare`.** Other cards still draw an empty track for a row with no share. Not changed here.

## Next

- **Model/effort**: keep.
- **Owner first**: after merge, open Insights on the real desk the Saturday after a Raid Shield check. Compare both shares with Raid prep's own counts for that week ("Friday's read: 87 of 97 with a shield seen").
- **Plan change**: none. Issue 489 has no section left.

<adjustments for="issue 489 follow-ups">
- Every section of issue 489 is built (1–6); close the issue with this PR.
- The Raid Shield history costs +1 transaction, about +260 buffer hits and +3 ms per Insights view (7.3 → 8.3 transactions).
- A coverage share ("seen by the tracker or ✓ by an officer") would need the week's Raid prep marks. The newest version per member per roll call (`newestMarks`) costs about 32 buffers for 8 weeks.
</adjustments>

PR: (added by the orchestrator)
