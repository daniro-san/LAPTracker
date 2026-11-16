# 08zzzw — Retry for a partly done daily read (D67)

Owner request, 2026-11-16, after 08zzzv: the daily read of 2026-11-16 closed partly done (7 of 20 alliances failed) and `/admin` had no way to read that day again. The owner asked that the admin can run a full retry of a day.

Second request, same day, on two notes of the first report ("today only" and "a kept roster can be hours older than the others"): fix them. The second one is fixed below; the first cannot be, see Decisions.

## Built
- **Which days can be retried** (`reclaimDailyRead` in `lib/repo/daily-reads.ts`): today's read when it is `failed` or `partial`, or left `running` for 150 s or more. Before, `partial` was refused. A `complete` day, a day with no read and a read `running` for less than 150 s still answer 409.
- **The retry keeps the rosters already read** (INVARIANT `daily-read.retry-keeps-rosters`):
  - the claim deletes only the day's error rows; before, it deleted every row of the day;
  - `storeDailyRoster` replaces `insertDailyRoster`: a roster that was read replaces the alliance's earlier roster of that day (one upsert on day and alliance); an error row is stored only when the day has no roster of that alliance.
- **The outcome is the day's** (`readDay` in `lib/daily-read.ts`): after storing, the status, the failed list and the stale list come from the day's rows (`dailyRosterStates`), so they include the rosters a retry kept. A first read gives the same result as before.
- **A kept roster that is old counts as stale in the day's outcome** (second request): a roster more than 20 minutes older than the start of the day's latest read is stale for that day (INVARIANT `freshness.20-min`, applied to the day).
  - `readDay` takes the read's start and puts such a roster in the stale list; the day is `complete` only when no roster is stale.
  - `problemsOf` in `lib/queries/daily-runs.ts` joins `daily_reads` and marks the same rosters, so `/admin/runs` shows `○ [TAG] stale` for them.
  - The stored row is not changed (`is_fresh` stays as read), so the member history keeps showing that roster at its own time. No new column, no migration.
- **`/admin`:** the Retry card under "Run something now" shows for a partly done day too (`dailyView`), with the sentence `run.daily.partial`. The confirmation adds "A roster already read today stays if its new read fails." The 409 text names the three cases it covers.
- **Discord:** the admin line of a `partial` day ends with `[Retry on /admin ↗] · [Daily reads ↗]`; a `failed` day is unchanged.
- **Docs:** D67 and its index line; two notes in D60; the README's Discord table row and the "Daily roster read fell short" paragraph.
- **Screenshot:** `docs/screenshots/08zzzw-admin-daily-retry-360-light.png` (the card and the confirmation at 360 px).

## Decisions
- **"A full retry of a day" read as: the Retry reads every roster of the day again (about 21 calls), and a partly done day can be retried.** Reading only the alliances that fell short (as a snapshot re-run does, D62) would cost fewer calls; it was not built.
- **Today only; a past day cannot be fixed by reading again.** The upstream returns only the roster as it is now. The member history never reads `read_day`: every roster shows at its own `source_updated_at` (`lib/queries/history-readings.ts`). A read made today and stored under a past day would leave that day's gap in the history as it is, and only make `/admin` call the past day done with today's rosters. A gap breaks nothing: the next roster is compared with the last usable one and its card names the span. Not built. What would lower the chance of a gap is in Open issues 3.
- **A complete day is not retried.** Nothing fell short.
- **Rows are no longer deleted before the new read.** With the old rule a retry of a partly done day that reads nothing (the upstream is down, or the quota rule stops it) would leave the day with no rosters.
- **An alliance whose new read failed while its earlier roster was kept is listed as stale, not as failed.** The day has its roster, and "stale" is the existing word for data older than 20 minutes at the read. The failed call still shows in that read's calls table and log. A kept roster less than 20 minutes older than the retry's start is not stale by the same rule, and the day can close `complete`.
- **The mark is derived, not stored.** `is_fresh` on the row means "fresh when read" and the member history depends on it; setting it to false would hide a usable roster from the history.
- **`DailyFailedView` keeps its name** although it now also covers a partly done day; renaming it would touch four files for no change in behaviour.

## Deviations
- No test committed (CLAUDE.md: not asked; `lib/daily-read.ts`, `lib/repo/` and `lib/queries/` are outside the collector rule's paths). Four tests were written, run and removed; see Verified and Open issues 1.

## Verified
- Four temporary tests in `lib/daily-read.test.ts` on PGlite (passed, removed):
  - a partly done day is read again in full (both alliances called), closes `complete`, the rows carry the new read's member names, and `calls_used` is the day's total;
  - a roster the day has stays when its new read fails, and stays when the retry may not start (the quota rule): the day is `partial`, the kept roster is unchanged, the other alliance is `not fetched: quota: …`;
  - a complete day answers null and no call is made;
  - a retry 30 minutes after the first read in which one alliance fails again: the day is `partial`, that alliance is in the stale list and not in the failed list, its stored row still has `is_fresh` true and its members, `getDailyRun` lists it as the only problem (not failed); a second retry that reads both closes the day `complete` with no problem.
  - With the "error row never replaces" branch removed from `storeDailyRoster`, the second test failed; with it, all passed.
- Local run, no upstream call: local Postgres (D47, a new database), `next dev`, and a local stand-in for `/v1` that serves `fixtures/` and, while a flag file exists, sends `rank_code: null` for one member of the seven alliances that failed today.
  - `POST /api/tick` inside the daily window: `partial`, 21 calls, 13 rosters and 7 error rows `v1 v1.schema`, as in production today.
  - Chrome at 360 px on `/admin`: the card reads "Today's read closed partly done at … API calls used today: 21." with Retry (44 px tall) and "≈ 21 calls"; `scrollWidth` 360.
  - Retry while the seven still fail: "Daily roster read partly done. API calls used: 21. Stale: 0. Failed: 7."; the database has 13 rosters and 7 error rows, 20 alliances, `calls_used` 42; the card is still there.
  - Retry after removing the flag: "Daily roster read done. API calls used: 21. Stale: 0. Failed: 0."; `complete`, 20 rosters, 0 error rows, `calls_used` 63; the card is gone. The stand-in counted the same calls.
- Same local setup for the stale rule: a partial day (13 rosters, 7 errors), the 13 stored rosters moved 30 minutes back with one SQL update, then Retry with the 7 readable and NSE failing: "Daily roster read partly done. API calls used: 21. Stale: 1. Failed: 0."; the card stays; `/admin/runs?show=daily` shows "partly done ○ [NSE] stale"; the database has 20 rosters, 0 error rows, and NSE's row still has `is_fresh` true. Retry again with everything readable: "Daily roster read done … Stale: 0. Failed: 0.", `complete`, the runs list shows "done" with no mark.
- `dailyReadMessage` printed for a partial and a failed day: the last lines are as described under Built.
- `pnpm check` green: prettier, eslint, tsc, vitest (266 passed, 1 skipped), drift, i18n. No migration: no table changed.

## Open issues
1. **The retry has no committed test.** The four tests above are 86 lines; the owner can ask for them to be committed.
2. **Today's 7 rosters need both PRs released today.** A retry reads the day again only until the server day ends (2026-11-17 00:00 server time, 02:00 UTC). With 08zzzv (PR #267) not released, the seven alliances fail again with `v1.schema`; the 13 rosters stay.
3. **A day that nobody retries in time keeps its gap.** The tick does not retry by itself (D60). An automatic retry later the same day (for example once, an hour after a read that fell short) would cost about 21 calls per attempt; it needs the owner's decision on how many attempts.
4. **No Retry on `/admin/runs/daily/[day]`.** The button is on `/admin` only, as before.
5. **While a retry is running, `/admin/runs` marks the day's earlier rosters stale** (their data is older than the read that just started). It lasts until the retry stores its rows, at most 100 seconds.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge PR #267 and this PR into `dev` and release; then press **Retry** on `/admin` before 02:00 UTC of 2026-11-17 to read today's 7 missing rosters (about 21 calls).
Plan changes needed: none.

<adjustments>
- `storeDailyRoster(db, day, row)` is the only writer of `daily_rosters`; `insertDailyRoster` is gone. `dailyRosterStates(db, day)` gives the day's rows (union id, tag, fresh, error).
- A daily read's status and failed list describe the day's stored rows, not the last attempt's calls. A stored roster more than 20 minutes older than `daily_reads.started_at` is stale for the day, although its `is_fresh` is true.
- The member history orders and labels rosters by `source_updated_at`; `read_day` is only the key of the day's rows and of the admin pages.
- Local browser checks: open the dev server as `http://localhost:<port>`, not `127.0.0.1`; on `127.0.0.1` Next's dev scripts are refused and the PIN form does not submit.
- `/opt/homebrew/bin/pg_ctl` is libpq's and cannot start a cluster; put `/opt/homebrew/opt/postgresql@18/bin` first on `PATH` for `db:local:*`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/268
