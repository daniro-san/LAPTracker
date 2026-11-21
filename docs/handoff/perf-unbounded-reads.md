# perf-unbounded-reads: reads of tables that grow forever (D149)

The owner (2026-11-21): "paginate so we don't fetch tons of data at once". The task, refined: find the queries that read tables growing forever with no time window, row limit or index, and fix the ones that matter. Branch `perf/unbounded-reads` from `origin/dev` (62fd652c).

## Built

- **`latestFacts`** (`lib/repo/member-facts.ts`): a recursive backward loose index scan on `member_facts_version_unique`, one index descent per (member, field). It replaces `DISTINCT ON` over every version. It returns the same rows in the same order, and each value goes through the jsonb column's decoder as before. It serves `factsOf` (about 17 desk callers) and the tick's Raid prep away read.
- **`progressHistory`** (`lib/private/members.ts`) on the new **`factHistorySince`** (`lib/repo/member-facts.ts`). It reads the versions saved from the thanks week's Monday 00:00 UTC minus a day, plus, for each pair among them, the newest version before. It no longer reads every main squad and AD Tech version. The signature is now `(db, access, now, zone)`. Home and Members call it through `membersWithProgress` (`lib/private/members.ts`), which gives `progressHistory` the same `now` and `zone` as `membersView` and keeps both pages under their lint line limits.
- **/admin "First roll call marked"** (`lib/queries/admin-alliances.ts`): a lateral `order by written_at limit 1` per roll call on the new index `roll_call_marks_call_written_idx (roll_call_id, written_at)` (`lib/schema-rollcall.ts`).
- **Migration** `drizzle/0066_roll_call_marks_call_written.sql` (generated: one `CREATE INDEX`).
- **Tests:** `lib/repo/member-facts.test.ts` (2, PGlite). `latestFacts` gives each pair's newest version, scoped to the workspace and ordered. `factHistorySince` gives the window plus only the version before it of the pairs in the window. The existing `admin-alliances.test.ts` setup test already inserts the earlier mark second.
- **Docs:** D149 (new); dated amendments in D109, D144 and D145; the README index.

## Inventory

Tables in `lib/schema*.ts` (67), by how they grow. "Purge" is D125's workspace deletion, which removes every table in `WORKSPACE_TABLES`.

| Tables | Grows | Pruned by |
|---|---|---|
| `app_errors` | capped | the newest 500 rows (`insertAppError`) |
| `tick_log` | capped | the newest 700 rows |
| `auth_attempts` | bounded | rows past their window are deleted on each attempt |
| `workspace_sessions` | bounded | expired sessions deleted at the next sign-in |
| `screenshot_drafts`, `discord_pictures` | bounded | expiry, and saved drafts after their keep time (`lib/repo/import.ts`) |
| `notice_pictures` | bounded | the weekly clean-up (D119) |
| `push_subscriptions` | bounded | 404/410 and replaced devices |
| `player_reads` | forever (rows) | `raw_json` cleared after 90 days; the rows stay |
| `events`, `snapshots`, `alliance_snapshots`, `member_snapshots`, `run_logs` | forever | only rehearsal rows (retention) and a re-run's failed rows |
| `daily_reads`, `daily_rosters`, `alliance_board`, `tracked_sets`, `alliance_lookups` | forever, a row or a roster per alliance per day | a day's failed rosters are replaced on retry |
| `alliances`, `player_frames`, `hero_catalog`, `rehearsal_slots`, `app_alerts` | slowly (per alliance, per player, per slot or per alert kind) | none |
| `member_facts` | forever, fastest per workspace: a squad might version whenever the value differs | purge |
| `roll_calls`, `roll_call_marks` | forever (~260 roll calls, ~30k marks per workspace a year) | purge only (soft delete, D123) |
| `notices`, `notice_edits`, `notice_publishes`, `notice_reviews`, `notice_review_outcomes` | forever | purge |
| `thefts`, `theft_follow_ups`, `theft_attackers`, `member_follow_ups`, `garrison_plans`, `thanks_shares`, `thanks_takedowns`, `calendar_entries`, `calendar_occurrences`, `alliance_duel_points`, `screenshot_checks`, `push_marks`, `workspace_usage` | forever, a few rows a workspace a week or day | purge |
| `squad_reads`, `squad_queue`, `shield_checks`, `shield_queue`, `member_squads`, `player_history` | forever, per member or per day | purge |
| `workspace_key_changes`, `workspace_data_events` | forever, rare | a refused claim is dropped; purge |
| `workspaces`, `workspace_users`, `workspace_discord`, `workspace_webhooks`, `workspace_keys`, `workspace_features`, `feature_defaults`, `allowance_pauses`, `shield_settings`, `start_here`, `name_aliases`, `pending_members`, `roll_call_team`, `alliance_invites`, `access_requests`, `workspace_tombstones` | small, per workspace or setting | as each feature removes them |

Reads of growing tables. They were checked in `lib/repo`, `lib/queries`, `lib/private` and the tick, and measured where they run on every view or tick.

| Read | Table | Shape before | Runs | Outcome |
|---|---|---|---|---|
| `latestFacts` | `member_facts` | every version (`DISTINCT ON`) | every desk view through `factsOf`; Raid prep fill per tick | fixed |
| `progressHistory` (`factHistory` of TREND_FIELDS) | `member_facts` | every squad might and AD Tech version | Home, Members | fixed |
| `allianceUsage` marks part | `roll_call_marks` | the whole table | every /admin render | fixed (index 0066) |
| `allianceUsage` posts part | `notice_publishes`, `garrison_plans`, `thanks_shares`, `shield_checks` | full scans, no time index | every /admin render | 0.8 ms at 20k posts: not fixed |
| `allianceUsage` errors part | `app_errors` | full scan | every /admin render | capped at 500: not fixed |
| `firstSeenDays` | `daily_rosters` | unnest of the whole roster history | every `membersView`, Insights | 3.4 ms: follow-up |
| `clearOldPlayerRaw` | `player_reads` | every row older than 90 days | once a day | 9 ms warm: follow-up |
| `memberHistoryIndex` (#551) | `daily_rosters`, `member_snapshots` | member lists of up to 15 rosters | public history, page 1 shared | 1 ms: not fixed |
| away facts (#567) | `member_facts` | = `latestFacts` | Raid prep fill | fixed with `latestFacts` |
| `endOfDayReads`, `dailyReadings`, `eventReadings` | `daily_rosters`, `member_snapshots` | `LIMIT n` | desk views | bounded |
| `playerHistory`, `playerProgress` | `member_snapshots`, `daily_rosters` | one player's sightings, GIN | public, shared (D143) | bounded per player |
| `memberOrigin`, `gameLanguages`, Insights' `player_history` | `player_history`, `player_reads` | by `(union_id, uid, …)` | card, follow-up, Insights | bounded per member |
| `listThefts`, `listFollowUps` | `thefts`, `theft_follow_ups` | the whole log | Thefts page | the page's content (D97): not fixed |
| run lists, daily runs, run logs | `snapshots`, `daily_reads`, `run_logs` | `LIMIT 60`, by day or snapshot id | /admin | bounded |
| desk activity (D108), `ownMarks` | several | the D108 cursor bound, `day >= today` | Home, member's page | bounded |

## Decisions

- **The panel decided** (3 subagents; all three results came back to me): a technical design-patterns persona, an adversarial persona and an SRE persona. None raised a MUST. Applied:
  - the `factHistory` comment no longer claims the week's progress;
  - the first-mark index is described as "one probe a roll call", not as growing with roll calls instead of marks (both forms grow with roll calls; marks per roll call stay about 115);
  - buffers are reported next to the times;
  - D149 records that the /admin part depends on index 0066;
  - each raw value goes through the jsonb column's own decoder (adversarial N1). Drizzle's jsonb `mapFromDriverValue` parses a string value again, so a note stored as `"123"` reads as the number 123. A raw read would have returned the string. That would change what a page shows, and the card's `factHistory`/`factVersion` would still decode the other way. So the old decoding is kept and the double parse is a follow-up.
- **No new cache, no write-time state, no backfill.** A "latest" flag on `member_facts`, or `first_marked_at` on workspaces, would need writer changes and a data migration for about 5 ms. The design persona and the SRE persona agreed.
- **Plain `CREATE INDEX`.** `scripts/migrate.ts` runs each migration in a transaction, so `CONCURRENTLY` cannot be used. It took 131 ms at 299k marks locally; production has a few thousand marks. It blocks mark writes only while it builds, so do not deploy during Friday's Raid prep fill.

## Deviations

- QA was run by me, not as a fourth subagent (the task allowed at most 3). It compared the old and new code on the seeded database through the real lib functions, and counted with `pg_stat_database` and `pg_stat_statements`. It did not click through a local production build: the three reads change no rendered value, and the equivalence check compares the values the pages render from.
- The seed is my own SQL (`generate_series`), not `pnpm db:local:seed`. That seed has 20 fixture alliances and no desk history.

## Verified

Invented data, local Postgres 18.0, tables clustered in the order production writes them:

- 10 workspaces;
- 30 alliances read daily for a year (10,980 rosters of 100 members, with `raw_json`);
- 104 events (416k `member_snapshots`);
- 222k `member_facts`;
- 2,600 roll calls and 299k marks;
- 20k `notice_publishes` and 20k `notice_edits`;
- 366k `player_reads` and 366k `player_history`;
- 500 `app_errors`;
- edge rows: versions at both sides of Monday 00:00 ST, members with versions only in the week, a workspace with roll calls and no marks, one with nothing, and text notes that look like JSON.

Harness: `measure.mts` calls the real lib functions; per call, warm, mean of 5.

| Read (where) | Statements | DB ms before → after | Buffers before → after |
|---|---|---|---|
| Home / Members: `progressHistory` + `membersView` | 9 → 9 | 42.8 → 21.0 | 6,417 → 4,259 |
| Card / Follow-up: `membersView` | 8 → 8 | 26.7 → 20.0 | 3,388 → 3,178 |
| `latestFacts` (`factsOf`, the Raid prep away read) | 1 | 11.2 → 5.0 | 3,022 → 2,812 |
| `progressHistory` (all versions → window) | 1 | 15.4 → 0.8 | 3,022 → 1,067 |
| /admin `allianceUsage` | 1 | 19.3 → 6.2 | 3,352 → 8,338 (index probes) |
| Insights `insightsView` | 5 | 36.7 → 29.6 | 3,308 → 3,098 |
| `firstSeenDays` (not changed) | 1 | 3.5 | 94 |
| `endOfDayReads(30)` (not changed) | 1 | 16.8 | 110 |
| public `memberHistoryIndex`, page 1 / older (not changed) | 3 | 1.0 / 0.9 | 192 |
| public `playerHistory` / `playerProgress` (not changed) | 2 / 6 | 4.1 / 13.9 | 2,533 / 2,201 |
| `clearOldPlayerRaw`, daily (not changed, `EXPLAIN`) | 1 | 9 warm, 17 cold | 4,248 |

Before is dev's `lib` (`git archive origin/dev`) on the same data. Ranked by cost × frequency (the SRE persona's per-day estimate at 10 workspaces):
1. `latestFacts`: about 1,000 calls a day, 12 → 5 s a day. After a wake it reads about 117 table pages per workspace, down from 2,996.
2. /admin marks part: at most 375 renders a day, 9.4 → 2.3 s a day.
3. `progressHistory`: about 300 calls a day, 4.5 → 0.3 s a day.

Unchanged: `endOfDayReads`, 7–13 s a day, flat; `firstSeenDays`, 2.7 s a day, growing; `clearOldPlayerRaw`, 1–2 s a day on a fresh wake.

`pg_stat_database` per view (20 renders on their own Pool, the Pool closed so its backends flush):

| View | Transactions | Blocks hit | Tuples returned | Tuples fetched |
|---|---|---|---|---|
| Home / Members | 9.3 → 9.3 | 6,711 → 4,506 | 53,191 → 9,948 | 48,712 → 5,469 |
| Card / Follow-up | 8.3 → 8.3 | 3,592 → 3,385 | 30,746 → 9,085 | 26,268 → 4,607 |
| /admin `allianceUsage` | 3.2 → 1.1 | 3,958 → 8,460 | 347,957 → 48,571 | 547 → 171 |

/admin's 3.2 transactions before are the full scan's parallel workers; blocks read from disk were 0 in every run (all cached).

- **Same numbers:** `equivalence.mts` compared dev's queries with the new ones on the seeded data. Every check matched:
  - `latestFacts` on 12 workspaces (deep equal);
  - `progressOf` output over the whole history against the window, for 5 workspaces in 4 zones (`Etc/GMT+2`, `Pacific/Kiritimati`, `Etc/GMT+12`, `America/Sao_Paulo`), every 3 hours from Nov 8 to Nov 22, Sundays and Mondays included: 2,417 checks, 45,746 progress rows;
  - /admin's first roll call for 12 workspaces, including one with roll calls and no marks and one with none.
- **The adversarial persona** also found 0 differences with its own edge rows: negative uids, NULL values, odd field names, uid 0 and the largest bigint, a version backdated before the window, and rows exactly at `since` and 1 µs before it.
- **Plans** (`EXPLAIN ANALYZE`):
  - `latestFacts` uses `Index Cond: ((workspace_id = 3) AND (ROW(uid, field) < ROW(p.uid, p.field)))` with 700 searches;
  - the window uses `member_facts_workspace_written_idx`;
  - the marks part is an Index Only Scan on `roll_call_marks_call_written_idx`, 2,600 loops.
- **`pnpm check`** (Node 26.5.0): passed. Prettier, eslint, tsc, 1,513 tests passed (4 skipped) in 293 files, drift check and i18n.

## Open issues

- **`firstSeenDays`** (`lib/repo/workspace-rosters.ts`): 3.4 ms on every `membersView`, growing one roster a day (about 10 ms at three years). It is the next growing read on the hot path. Its map also feeds Insights' flow and tenure.
- **`clearOldPlayerRaw`** (`lib/repo/player-reads.ts`): once a day, about 9 ms warm, 3.9k cold pages after a wake, growing about 11 a day. Fix with a partial index `player_reads (read_at) where raw_json is not null`. Not with a date floor: a tick outage longer than the floor would leave raw bodies past 90 days (D132).
- **`endOfDayReads`** (8.5–16.5 ms, jsonb over `raw_json`) is now the largest cost per desk view. It is bounded, so it was outside this audit.
- **The jsonb double parse.** Every Drizzle select of `member_facts.value` decodes a string value again, so a note that is exactly `123`, `null` or `{"a":1}` comes back as a number, null or an object. This is a pre-existing bug, kept as it is here; the fix belongs in all fact reads at once.
- **`factHistory` without a uid** has no caller left (only the card calls it, with a uid).
- **`factHistorySince` with an empty `fields`** would build `in ()`. Its only caller passes the constant `TREND_FIELDS`.
- **On a cold compute** the marks part reads about 1,100 random index pages instead of 2,800 table pages read in order, which Neon prefetches. At production's size this does not matter.

## Next

- Model/effort: keep. The panel found no MUST, but its N1 (jsonb decoding) would have changed what a page shows, and only a reader of Drizzle's internals caught it.
- Owner first: merge and release. Avoid deploying during Friday's Raid prep fill (0066 blocks mark writes while it builds, for a few ms).
- Plan change: none.

<adjustments>
- A raw `db.execute` of a Drizzle jsonb column must decode it with the column's `mapFromDriverValue` to read as the builder's selects do.
- Newest-per-key reads over an append-only versioned table: walk the unique index backwards with a row comparison (`latestFacts`), one descent per key.
- Measured at one invented year (10 workspaces): Home/Members 41.9 → 21.0 ms of database time per view; /admin's statement 18.9 → 6.2 ms.
- Next growing reads, in order: `firstSeenDays`, then `clearOldPlayerRaw`'s partial index.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/576
