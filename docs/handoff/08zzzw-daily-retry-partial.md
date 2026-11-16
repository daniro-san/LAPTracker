# 08zzzw — Retry for a partly done daily read (D67)

Owner request, 2026-11-16, after 08zzzv: the daily read of 2026-11-16 closed partly done (7 of 20 alliances failed) and `/admin` had no way to read that day again. The owner asked that the admin can run a full retry of a day.

## Built
- **Which days can be retried** (`reclaimDailyRead` in `lib/repo/daily-reads.ts`): today's read when it is `failed` or `partial`, or left `running` for 150 s or more. Before, `partial` was refused. A `complete` day, a day with no read and a read `running` for less than 150 s still answer 409.
- **The retry keeps the rosters already read** (INVARIANT `daily-read.retry-keeps-rosters`):
  - the claim deletes only the day's error rows; before, it deleted every row of the day;
  - `storeDailyRoster` replaces `insertDailyRoster`: a roster that was read replaces the alliance's earlier roster of that day (one upsert on day and alliance); an error row is stored only when the day has no roster of that alliance.
- **The outcome is the day's** (`readDay` in `lib/daily-read.ts`): after storing, the status, the failed list and the stale list come from the day's rows (`dailyRosterStates`), so they include the rosters a retry kept. A first read gives the same result as before.
- **`/admin`:** the Retry card under "Run something now" shows for a partly done day too (`dailyView`), with the sentence `run.daily.partial`. The confirmation adds "A roster already read today stays if its new read fails." The 409 text names the three cases it covers.
- **Discord:** the admin line of a `partial` day ends with `[Retry on /admin ↗] · [Daily reads ↗]`; a `failed` day is unchanged.
- **Docs:** D67 and its index line; two notes in D60; the README's Discord table row and the "Daily roster read fell short" paragraph.
- **Screenshot:** `docs/screenshots/08zzzw-admin-daily-retry-360-light.png` (the card and the confirmation at 360 px).

## Decisions
- **"A full retry of a day" read as: the Retry reads every roster of the day again (about 21 calls), and a partly done day can be retried.** Reading only the alliances that fell short (as a snapshot re-run does, D62) would cost fewer calls; it was not built.
- **Today only.** A past day is not retried: a read made today would be stored under that day's date (D60).
- **A complete day is not retried.** Nothing fell short.
- **Rows are no longer deleted before the new read.** With the old rule a retry of a partly done day that reads nothing (the upstream is down, or the quota rule stops it) would leave the day with no rosters.
- **An alliance whose new read failed while its earlier roster was kept is not listed as failed.** The day has its roster. The failed call still shows in that read's calls table and log.
- **`DailyFailedView` keeps its name** although it now also covers a partly done day; renaming it would touch four files for no change in behaviour.

## Deviations
- No test committed (CLAUDE.md: not asked; `lib/daily-read.ts` and `lib/repo/` are outside the collector rule's paths). Three tests were written, run and removed; see Verified and Open issues 1.

## Verified
- Three temporary tests in `lib/daily-read.test.ts` on PGlite (passed, removed):
  - a partly done day is read again in full (both alliances called), closes `complete`, the rows carry the new read's member names, and `calls_used` is the day's total;
  - a roster the day has stays when its new read fails, and stays when the retry may not start (the quota rule): the day is `partial`, the kept roster is unchanged, the other alliance is `not fetched: quota: …`;
  - a complete day answers null and no call is made.
  - With the "error row never replaces" branch removed from `storeDailyRoster`, the second test failed; with it, all passed.
- Local run, no upstream call: local Postgres (D47, a new database), `next dev`, and a local stand-in for `/v1` that serves `fixtures/` and, while a flag file exists, sends `rank_code: null` for one member of the seven alliances that failed today.
  - `POST /api/tick` inside the daily window: `partial`, 21 calls, 13 rosters and 7 error rows `v1 v1.schema`, as in production today.
  - Chrome at 360 px on `/admin`: the card reads "Today's read closed partly done at … API calls used today: 21." with Retry (44 px tall) and "≈ 21 calls"; `scrollWidth` 360.
  - Retry while the seven still fail: "Daily roster read partly done. API calls used: 21. Stale: 0. Failed: 7."; the database has 13 rosters and 7 error rows, 20 alliances, `calls_used` 42; the card is still there.
  - Retry after removing the flag: "Daily roster read done. API calls used: 21. Stale: 0. Failed: 0."; `complete`, 20 rosters, 0 error rows, `calls_used` 63; the card is gone. The stand-in counted the same calls.
- `dailyReadMessage` printed for a partial and a failed day: the last lines are as described under Built.
- `pnpm check` green: prettier, eslint, tsc, vitest (266 passed, 1 skipped), drift, i18n. No migration: no table changed.

## Open issues
1. **The retry has no committed test.** The three tests above are 63 lines; the owner can ask for them to be committed.
2. **Today's 7 rosters need both PRs released today.** A retry reads the day again only until the server day ends (2026-11-17 00:00 server time, 02:00 UTC). With 08zzzv (PR #267) not released, the seven alliances fail again with `v1.schema`; the 13 rosters stay.
3. **A kept roster can be hours older than the others of the same day.** It keeps its own `source_updated_at` and `is_fresh` from the read that stored it.
4. **No Retry on `/admin/runs/daily/[day]`.** The button is on `/admin` only, as before.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge PR #267 and this PR into `dev` and release; then press **Retry** on `/admin` before 02:00 UTC of 2026-11-17 to read today's 7 missing rosters (about 21 calls).
Plan changes needed: none.

<adjustments>
- `storeDailyRoster(db, day, row)` is the only writer of `daily_rosters`; `insertDailyRoster` is gone. `dailyRosterStates(db, day)` gives the day's rows (union id, tag, fresh, error).
- A daily read's status and failed list describe the day's stored rows, not the last attempt's calls.
- Local browser checks: open the dev server as `http://localhost:<port>`, not `127.0.0.1`; on `127.0.0.1` Next's dev scripts are refused and the PIN form does not submit.
- `/opt/homebrew/bin/pg_ctl` is libpq's and cannot start a cluster; put `/opt/homebrew/opt/postgresql@18/bin` first on `PATH` for `db:local:*`.
</adjustments>
