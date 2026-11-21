# perf Batch 1: /admin polls only when a run can start, and the `member_uids` index (issue 521)

## Built

- `lib/tick-batch.ts`: `batchMayRun`, the D141 rule, moved out of `app/(private)/_ui/read-status-wake.ts`. The status bar and /admin both import it. Its test moved to `lib/tick-batch.test.ts`.
- `lib/tick-gate.ts` `pollFrom(now, cfg)`: the first tick of either scheduler, up to 24 h ahead, at which `tickClockDue` holds. The count starts from the current tick while its batch can still run. Null when no such tick is in the 24 h.
- `app/_ui/admin/AdminShell.tsx`: on every render it computes `pollFrom`, or `now` while a pressed rehearsal is pending. That is one more query (`hasPendingRehearsal`, re-exported from `lib/queries/admin.ts`) in the shell's existing `Promise.all`. It passes the value through `RunWatch` to `useRunWatch`.
- `app/_ui/admin/useRunWatch.ts`: idle, it refreshes every 20 s only when `pollFrom <= now` and `batchMayRun(now)` both hold. While a run is going, it refreshes every 4 s as before. It also refreshes once when the tab becomes visible.
- `prefetch={false}` on every link /admin renders:
  - the nav;
  - the overview's "Open" link to the last run (`app/(pages)/admin/page.tsx`);
  - the run rows and filters (`RunRows.tsx`);
  - the header's `/` and `/players` links, through a new `SiteHeader` `prefetch` prop. It defaults to on, which passes Next's default `null`, so public pages are unchanged.
- Migration `drizzle/0060_roster_member_uids_gin.sql` (`pnpm db:generate --name roster_member_uids_gin`): a GIN index `daily_rosters_member_uids_idx` on `daily_rosters.member_uids`, declared in `lib/schema.ts` next to `daily_rosters_union_idx`. `rosterSightings` uses `arrayContains` (`@>`) instead of `= any`.
- Tests:
  - `useRunWatch.test.ts`: 4 tests;
  - `pollFrom` in `lib/tick-gate.test.ts`;
  - `lib/queries/roster-stays.test.ts`: the same rows as `= any`;
  - `lib/tick-batch.test.ts`: the moved `batchMayRun` test.
- D141: a dated amendment.

## Decisions

- No new decision number. A dated amendment to D141 records the /admin poll, the prefetch change and the index. It sits after Batch 2's amendment, and D142 is still free.
- Rebased onto `origin/dev` after #528, #529 and #530 (Batch 2, the 3 h heartbeat). `pollFrom` scans `tickClockDue`, which includes the new 3-hourly `heartbeatSlot`. So /admin's idle poll now asks in the first two tick windows of every third hour, as well as in the windows of the daily read, the event and the rehearsal. The `pollFrom` test now expects 21:00 after 18:20. The migration is still 0060: dev has none after 0059.
- The panel replaced the spec's rule ("idle refresh when `batchMayRun`") with `batchMayRun && now >= pollFrom`. Technical and adversarial agreed on this. `batchMayRun` covers 10 of every 15 minutes, and its gaps (2 and 3 min) are shorter than Neon's 5-minute suspend. So an idle tab kept the database awake around the clock. The measurement confirmed it: 130 transactions a minute with `batchMayRun` alone.
- A pending rehearsal makes `pollFrom = now`. A pressed rehearsal is run by a later tick, which the clock alone does not foresee. The check is one cheap query on a database the render has already woken.
- The adversarial review found that a refresh re-prefetched the run-row links too. The overview's "Open" link to the last run did the same; it showed up as `/admin/runs/66` in the measurement. Both got `prefetch={false}`.

## Deviations

- The spec asked for `prefetch={false}` on the footer's links to `/` and `/players`. The footer has none; its only link is a plain `<a href="/w">`, which never prefetches. Nothing was changed there.
- The spec's idle rule was narrowed by `pollFrom`, as described above.

## Verified

- Local production builds (`next build` + `next start`), local Postgres 18 with 61 migrations, and the bridge. Invented data:
  - 24,000 `daily_rosters` rows: 60 alliances × 400 days, 100 members each (62 MB, index 13 MB);
  - 33 events with Before and After runs.
- No upstream, Discord, Neon or Vercel call, and no `/api/quota`.
- Idle /admin, measured with headless Chrome at 360 px. Refreshes and prefetches were counted from the RSC requests. Transactions come from `pg_stat_database`, read from another database so that sampling adds nothing. Background noise is 2 a minute.

  | Build                                      | Refreshes/min | Prefetches/min | Transactions/min                                   |
  | ------------------------------------------ | ------------- | -------------- | -------------------------------------------------- |
  | before (`origin/dev`), 15 min              | 2.9           | 15.9           | 228, all day                                       |
  | `batchMayRun` alone (first build), 15 min  | 1.9           | 2.1            | 130: 193 in windows, 2 outside                     |
  | final, nothing due by the clock, 15 min    | **0**         | **0**          | **2** (noise only), also inside tick windows       |
  | final, daily read's window open, 8 min     | 3 in windows, 0 outside | **0** | 206 in the 5-minute windows, 2 outside            |

- EXPLAIN ANALYZE on the invented rows: `scratchpad/b1/explain.txt`.

  | Query                                    | Without the index      | With it                 |
  | ---------------------------------------- | ---------------------- | ----------------------- |
  | `rosterSightings` / `playerProgress` (`@>`) | 66 ms, seq scan     | 1.3 ms, bitmap index scan |
  | member history / `sightingsElsewhere` (`&&`, 100 uids) | 805 ms, seq scan | 5 ms, bitmap index scan |
  | the old `= any`                          | 17.9 ms, parallel seq scan, even with the index there | — |

- QA pass, a separate run on the final build: **PASS, no bugs.**
  - Own press: the page refreshed after 614 ms.
  - Idle tab: a refresh every 20 s inside a due window; 0 while hidden; exactly 1 on becoming visible; one more refresh after the window, then nothing.
  - Navigation /admin → Runs → Errors → back: 1 request per click, and no prefetch on any /admin page.
  - Public header links still prefetch.
  - /admin at 360 px, light and dark: OK.
  - The index: EXPLAIN 0.66 ms with it, 12.7 ms without it. No public page used it with this data: `/players/7042` answered 404, because the invented data has no snapshot rows.
- `pnpm check` exits 0 after the rebase: prettier, eslint and tsc pass; vitest has 271 files passed and 2 skipped, 1413 tests passed and 4 skipped; drift "Everything's fine"; i18n has 17 languages up to date.

## Open issues

- Bounds this change accepts (also in D141):
  - A press made on another device shows on an idle tab only at its next refresh. That is about 3 minutes if the press falls in a window with work, otherwise the next such window, a visibility change or a reload.
  - A run shorter than the gap between refreshes may never be seen as running. The run log has it, but the "finished" line does not show.
  - A late `tick.yml` start can show up to about 3 minutes late.
- One /admin render costs about 68 transactions locally (206 a minute at 3 refreshes), more than the spec's "about 25 queries". Batch 3 (one Pool per request) should measure it again.
- Follow-ups (not built):
  - When the run log shows a run that finished unseen, show its "finished" line.
  - The visibility refresh can fire together with an interval refresh, making two refreshes on one return.
  - `useRunWatch.test.ts` runs the effect once. It does not run the cleanup or a second run of the effect.
  - QA could not run an end-to-end check of a run started by a tick: that needs invented data where the tick has work.
  - The rehearsal check adds 1 query to every /admin render.
  - `/alliances/[id]/history?show=joined` reads all of `daily_rosters` on every view (133 transactions locally). This belongs to Batch 3 or 4.
- `CREATE INDEX` without `CONCURRENTLY` locks writes on `daily_rosters` while the deploy's `db:migrate` builds it. On the invented 24,000 rows the build took 219 ms. Production has fewer rows (about 20 alliances a day since 2026-10). The writers are the nightly read and "Get today's details".

## Next

- Model/effort: keep. The batch was small, and the panel and QA found what mattered.
- Owner first: merge. After the release, compare Neon's compute hours per day with an /admin tab left open. Re-run the 12 h `vercel logs requests` export and compare the /admin counts.
- Plan change: none. The spec's Batch 1 text says "`batchMayRun`"; the built rule is `batchMayRun && now >= pollFrom` (D141 amendment).

<adjustments for="Batch 3">
- Measure first: one /admin render ran about 68 transactions locally.
- AdminShell's `withPageDb` now also runs `hasPendingRehearsal`.
</adjustments>

PR: (added by the orchestrator)
