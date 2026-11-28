# feat-873-usual-hours

## Built

- `lib/private/usual-hours.ts` (pure): a member's distinct presence readings of the last 30 days give a band, the shortest run of server hours holding 60 % of them (it may run through midnight). Fewer than 7 readings give no band. `hourCounts` counts, per server hour, the members whose band holds it.
- Readings: `last_online_at` from the own alliance's daily rosters (already read by `insightsView`, no extra query) and `last_seen_at` from its own `player_reads`. The added query is `lastSeenTimes` in `lib/repo/player-reads.ts`: own union, `read_at` in the last 30 days, `DISTINCT (uid, last_seen_at)`. It is served by `player_reads_member_idx` (union_id first) and `player_reads_read_at_idx`; no new index. The card uses `lastOnlineTimes` in `lib/repo/workspace-rosters.ts` (one member, usable rosters from 30 days back).
- Insights: new "Usual hours in game" card after Time zones (`app/(private)/_ui/InsightsUsual.tsx`, words in `lib/private/insights-usual-words.ts`). Without a tap: the busiest hours, how many members have enough readings, and "A daily reading leans toward late hours, ...". Behind "Show the details": one row per server hour, count in HTML beside an HTML bar, with the officer's own time beside ST (the calendar's `Times`, set after hydration).
- Member card: one more presence line, "Usually in game around 20:00–21:59 ST (from 14 readings)" or "Usual hours in game: not enough readings yet (N so far)".
- Copy `insights.usual.*` in EN, PT-BR, FR (`lib/private/dictionary.insights-usual.ts`).
- Dated amendment to D153 (2026-11-28).
- Tests in `lib/private/usual-hours.test.ts`: band from seeded readings (also through midnight, 30-day window), fewer than 7 readings (and a time seen twice counts once), histogram counts through `insightsView`, own alliance only, nothing in the public alliance page.

## Decisions

- Band: the shortest run holding at least 60 % of the readings; ties go to the run with more readings, then the earlier start.
- A reading is a distinct timestamp (epoch ms). The window is 30 days back from now, applied to the timestamp.
- The histogram counts each member with enough readings once per hour of their band; bars are a share of those members.
- Hours are written as ranges ending at :59 ("20:00–21:59"), as D153's usual-hours line does.
- "Each officer's own local time" is the viewer's browser zone, shown beside ST after hydration (no stored officer zone exists).
- The bias line is shown without a tap.

## Deviations

- The issue says "20:00–23:00"; the text writes "20:00–22:59" form for consistency with D153.
- Player reads give the member card and the card's histogram `last_seen_at` only from the column, never from `raw_json`.

## Verified

- `pnpm vitest run lib/private/usual-hours.test.ts`: 6 passed.
- `pnpm vitest related --run <changed files>`: 1012 passed; its one failure (the dictionary test on "server hour" wording) was fixed and the test passes.
- `pnpm check` (prettier, eslint, tsc, vitest, drift, i18n): passed.

## Open issues

- Rosters older than the 36 end-of-day reads `insightsView` fetches are not used (30 days fit inside them).
- No e2e spec was added for the card.

## Next

- A per-member "usual hours" column or filter on Members, if officers want to pick who is in game at an hour.
- A note in the new-alliance guide when it next changes.

What was missing from the task prompt? Which time zone "each officer's own local time" means; read as the viewer's browser zone.

PR: (added by the orchestrator)
