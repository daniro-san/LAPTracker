# Perf triage: database cost from issues 507 and 509

Size M: it includes a migration. The plan was the four triage items below. Two short self-reviews checked it (engineering and adversarial, under Decisions). No spec-lean plan was written: the plan did not grow.

## Built

1. **The 90-day raw purge reads its own partial index** (#507). Migration `0068_player_reads_raw_read_at` adds `player_reads_raw_read_at_idx (read_at) where raw_json is not null` (`lib/schema-squads.ts`). `clearOldPlayerRaw` is unchanged: the planner picks the new index for its `read_at < … and raw_json is not null`. `player_reads_read_at_idx` stays as it was, for `shieldReadings`' and `shieldPassCounts`' windows. D149 has a dated amendment.
2. **An answer no longer re-sends the whole roster to the queue** (#507). Each squads batch keeps a set of the uids it knows are in the day's queue (`Call.queued`, `lib/squads-call.ts`). The set starts as the day's roster, which the batch has just inserted (`lib/squads-read.ts`), and grows with each newcomer the batch queues. An answer whose newer alliance roster lists only known uids sends no statement. A newcomer is sent once per batch. `insert … on conflict do nothing` still decides. The Saturday morning read (`lib/shield-read.ts`) passes an empty set; it never queues newcomers (its `rosterAt` is far in the future).
3. **The alliance label is read only for a session of the workspace** (#509). `openSession` (`lib/private/access.ts`) reads the label after the workspace, session and other-workspace checks, by `workspace.unionId` from the row it already read. `workspaceAllianceLabel` (a second read of `workspaces` by slug) is removed from `lib/repo/alliances.ts`.
4. **One `isSameOriginJson`** (#509). It is in the new `lib/same-origin.ts`, which imports nothing. `lib/private/http.ts` re-exports it, so the 34 workspace routes keep their import. The public lookup route (`app/api/alliances/[unionId]/details/route.ts`) imports it directly. The copy in `lib/route.ts` is gone. `docs/ARCHITECTURE.md` lists the module.

Tests:

- `lib/private/sign-in.test.ts`: "names the workspace's alliance by its board tag on the desk and on the board (D133)".
- `lib/squads-newcomers.test.ts` (new): "sends the queue a batch's roster and each newcomer once, not the roster after every answer (issue 507)". It counts the rows of each `insert into "squad_queue"` that reaches PGlite. The existing newcomer test moved into this file with it, unchanged, because `lib/squads-read.test.ts` was at 297 of its 300 lines.
- `lib/same-origin.test.ts`: the five `isSameOriginJson` tests, moved from `lib/private/http.test.ts`, unchanged.

## Decisions

**Engineering persona (is it simple, is it worth it?)**

- Item 1: one schema line and a generated migration. The purge is a cron job, not user-facing, but D149 measured 1–2 s on each cold wake, and that cost grew every day. Now it stays bounded. Worth it.
- Item 2: about 6 lines and no new query. An in-memory set beats a "smarter statement": an `insert … select … where not exists` still costs a round trip on every answer, but the set sends nothing in the common case. Worth it: about 100 statements and 10k conflicting rows a day per workspace go away, and nobody can see the change.
- Item 3: one call moved and one function removed, with the same round trips on the critical path (below). Worth it.
- Item 4: no performance gain. It removes the risk that a security check drifts between two copies. Cheap, so worth it.
- Nothing dropped.

**Adversarial persona**

- Item 1, the migration lock: `scripts/migrate.ts` runs each migration as one Neon HTTP transaction (`sql.transaction`). `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, so the index uses a plain `CREATE INDEX`, as `0066` did. That takes a SHARE lock, which blocks writes to `player_reads` (the squads read's inserts and the purge) while the index builds. Reads are not blocked. The build took 50 ms on PGlite at one year (366k rows). The real table is about 320 KB a day for 100 members (D132). So a squads write waits a few ms at most during the deploy's `db:migrate`. Running CONCURRENTLY would need `migrate.ts` to run a statement outside its transaction, which is not worth it at this size.
- Item 1, HOT updates: `raw_json` is now in an index predicate, so an update that changes it can no longer be HOT. The only writer is the purge itself (`clearOldPlayerRaw`); `player_reads` has no other update. The purge's write work was the same before and after (13,078 against 13,076 buffer hits for the same 999 rows), because the pages are full and the old updates were not HOT either.
- Item 1, the planner: EXPLAIN shows it uses the partial index for the purge and keeps `player_reads_read_at_idx` for the shield window.
- Item 2, races on the queue: one batch per (day, alliance) holds the claim. A batch that loses it to a stale takeover gets "lost" on its next save and stops. The set is local to one batch. It only skips uids that are already in the queue: the roster the same batch inserted before its first call, and newcomers whose insert it has awaited. Queue rows are never deleted during a day (only `saveCall` updates them; only a workspace purge deletes them). A newcomer queued by an earlier batch is sent again once, and `on conflict do nothing` drops it. `b.joined` counts the same rows as before. INVARIANT `squads.once-per-member` is untouched: `saveCall` still writes the member's row before `keep` runs.
- Item 3, same behaviour: every refusal returns before the label is needed, as before. The success path reads the label of the same `workspaces` row, not a second read by slug, so the label can no longer come from a different row. Latency: before, the slowest of the parallel reads was the label (slug, then `alliances`: 2 round trips). After, the parallel reads take 1 and the label takes 1. That is 2 either way, or 3 when the label falls back to a daily roster, as before.
- Item 4, same-origin security: the two copies behaved the same; one only stored Origin in a local variable first. So there was no stricter copy to keep. `lib/private` cannot import `lib/route`: `lib/route` imports `lib/app-errors`, which imports `lib/notify`, so `lib/private` would reach `lib/notify*` and break D71's rule. Public routes cannot import `lib/private` (the eslint allowlist). Hence a module with no imports.

## Deviations

- The task named only `squads-call.ts`. The batch's own roster insert at the start of every batch (`lib/squads-read.ts`, "a no-op once it is") still sends the whole roster once per batch. That is about 100 conflicting rows per tick's batch, not per answer. Left as it is (see Open issues).
- A new module (`lib/same-origin.ts`) instead of keeping one of the two existing copies. Neither existing home can be imported by both sides (Decisions, item 4).

## Verified

Measurements on PGlite, through the real code (`openTestDb`, migrated from `drizzle/`):

| What | Before | After |
| --- | --- | --- |
| Statements per officer's desk request (`requireWorkspace`, signed in) | 6 | 5 |
| Statements per signed-out private request | 5 | 3 |
| Purge scan at one year (366k reads, 91k with a body, 999 to clear) | Seq Scan, 5,829 pages, 365,001 rows filtered out | Index Scan on `player_reads_raw_read_at_idx`, 48 pages |
| Purge total (scan plus the 999 updates), warm | 28.0 ms, 18,907 buffer hits | 26.1 ms, 13,124 buffer hits |
| Index size at one year | — | 3.7 MB (`player_reads_read_at_idx`: 14.8 MB) |
| Shield window (`read_at` hour, one alliance) | `player_reads_read_at_idx` | `player_reads_read_at_idx` (unchanged), 47 buffers |
| Queue rows sent per answer with a newer roster (100 members) | 100 (one statement) | 0 (a newcomer: 1, once per batch) |
| One such re-insert (EXPLAIN ANALYZE) | 0.48 ms, 215 buffer hits, 100 conflicting, 0 inserted | not sent |
| Rows sent over two batches in the test (3 members, 1 newcomer) | 3, 4, 4, 4, 3, 4 | 3, 1, 3, 1 |
| Index build at 366k rows | — | 50 ms |

The warm purge time barely moves on PGlite: the 999 updates cost most of it. The gain is on a cold Neon wake: the scan reads about 48 pages instead of the whole table (D149 measured 3.9k cold pages, about 1–2 s, growing about 11 pages a day).

Breaks (each test failed with the code broken on purpose, then passed when restored):

- Label read by `workspace.id` instead of `workspace.unionId`: the sign-in label test fails. Label set to null: it fails.
- Queue filter removed (`roster.uids` sent whole): the issue-507 test fails with `[3, 4, 4, 4, 3, 4]`. Newcomers not added to the set: it fails with `[3, 1, 1, 1, 3, 1]`.
- `isSameOriginJson` without the Sec-Fetch-Site check: "refuses a write the browser marks cross-site" fails. Without the Origin check: two `lib/same-origin.test.ts` tests fail, plus the lookup route's "takes only a same-origin JSON press" test.
- Item 1 changes no behaviour, so it has no new test. The existing purge test (`lib/repo/player-reads.test.ts`) passes.

`pnpm check` (Node 26.5.0) passes: prettier, eslint, tsc, vitest (314 files passed and 2 skipped; 1,658 tests passed and 4 skipped), the drift check ("Everything's fine") and i18n (17 languages up to date).

Not run: Neon itself (not reachable here), so no cold-wake timing. Measure after the release with `EXPLAIN (ANALYZE, BUFFERS)` of the purge on the first cold wake.

## Open issues

- #507, still open after this PR: a line on /admin when the daily read's 90-day purge fails (today it reaches the log and PostHog only). The newcomer test bites since #630 (the older roster names 8; checked again after the rebase: removing the newer-roster check fails it), the purge trigger test is in #630, and the Settings item was done by D135.
- #509: this PR does its last two code items (the label query, one `isSameOriginJson`); #623 did the lookups and the four tests. Two items were not built, by the 2026-11-22 triage: the per-address lookup counting (three lines in the details route, no user value) and a count query for the home page (#537 serves the count from the cached shared list, so no extra read happens per visit). The orchestrator closes #509 by hand with that note.
- Follow-up seen while measuring: `featuresBySlug` reads `workspaces` by slug again (`settingsBySlug`), plus `allowance_pauses`, on every private request. That is 2 of the 5 statements. Folding the settings into the workspace read, by id, would save one more.
- Follow-up: the roster insert at the start of every squads batch (Deviations) could be skipped once the day's queue holds the roster. That saves about 100 conflicting rows per batch.

## What was missing from the task prompt?

The prompt listed #509's items without the triage's decisions on the two not built, so the PR body first said "Closes #509" without recording why.

## Next

- #507: a line on /admin when the daily read's 90-day purge fails.
- `featuresBySlug`: fold the settings read into the workspace read (one statement less per private request).
- The roster insert at the start of every squads batch could be skipped once the day's queue holds it.
- A test that the alliance label is read only after the three refusals.
- Model/effort: keep. All four items were small, and the measurements settled each one.
- Owner first: merge and release. The migration blocks `player_reads` writes for a few ms during `db:migrate`, so avoid deploying during Friday's 23:30 ST shield burst.
- Plan change: none.

<adjustments>
- `scripts/migrate.ts` runs each migration in one transaction: an index is always a plain `CREATE INDEX` (a SHARE lock while it builds), never CONCURRENTLY.
- A predicate or column added to an index on `player_reads` makes the purge's updates non-HOT; measured no cost today because the pages are full.
- Per private request now: 5 statements when signed in, 3 signed out (was 6 and 5).
- To count statements in a PGlite test, wrap `db.$client.query` for the test's span (`lib/squads-newcomers.test.ts`, `queueInserts`).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/631
