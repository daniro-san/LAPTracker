# 08zzze — Daily read retry

Owner request, 2026-11-12. That day's 06:00 daily roster read closed `failed`: every `/v1/alliances/:id` call hit the 30 s `TIMEOUT_MS`, and the 100 s deadline stopped the run. The owner asked for an `/admin` button that runs a failed day again.

## Built
- `lib/repo/daily-reads.ts`:
  - `reclaimFailedDailyRead(db, day, startedAt)`: one conditional `UPDATE … WHERE day = ? AND status = 'failed'` back to `running`, so exactly one caller wins. After it wins, it deletes that day's `daily_rosters` rows, which for a failed read are all error rows. `daily_rosters_day_union_unique` would refuse the new rows otherwise.
  - `getDailyRead(db, day)`: the day's status, finish time, calls and error, for `/admin`.
  - `finishDailyRead` now adds `callsUsed` to the stored value. A first read starts at 0, so nothing changes for it.
- `lib/daily-read.ts`: `runDailyRead` is now the claim plus `readDay` (the old body, unchanged). The new `retryDailyRead` is `reclaimFailedDailyRead` plus the same `readDay`.
- `lib/schedule.ts`: `serverDay(now, cfg)` returns the server date as `daily_reads.day`.
- `app/api/daily-read/retry/route.ts`: `POST`, PIN only through `authorize` (same rate limiter), no query, `maxDuration = 120`. It runs `retryDailyRead` for today's server day. It answers 200 with `{ day, status, calls_used, error, failed, stale }`, or 409 `daily_read_not_failed`.
- `lib/queries/admin-page.ts`: `loadAdminPage` also returns today's `getDailyRead`.
- `/admin` "Run something now": when today's read is `failed`, a "Daily roster read" block (`app/_ui/admin/DailyRetry.tsx`) shows the line "Today's read failed at {time}: {error}. API calls used today: {n}." It also has a **Retry** button with the cost tag "≈ 21 calls". The button uses the existing confirm sheet and PIN flow (`DAILY_RETRY` in `actions.ts`). It is off while a snapshot runs or another press is in flight.
- `app/_ui/admin/outcome.tsx`: the retry's answer in words: "✓ Daily roster read done. API calls used: 21. Stale: 0. Failed: 0." The `!` / `✗` marks work as for snapshots.
- Copy: `copy.admin.run.daily.*` and `refusals.daily_read_not_failed` (`lib/copy-admin.ts`, English only, D48).
- Docs: D60 has a new "Retry a failed day" bullet. The README runbook has a new "Daily roster read failed" item.

## Decisions
- **Only `failed`, only today.** The request says "the day that failed". A `partial` day keeps its data rows, so a retry would have to merge them, and that was not asked for. A past day is never retried: a read made today would be stored under the earlier date.
- **No Discord line for a retry.** The owner pressed the button and sees the outcome on the page. The tick's own read still sends its admin line.
- **`calls_used` is the day's total** (failed attempt + retry). It is the row that tells how much quota the day's read spent.
- **The card shows only while today's read is failed.** `/admin` still has no status line for a complete or partial daily read. That would be a new feature.
- `AdminActions` was at the 80-line function limit. The card went into its own file, like `ManualSection`, and `locked` was inlined (`running.length > 0`) to stay under the limit.

## Deviations
- No committed test. The task did not ask for one (CLAUDE.md "Commit tests only where the task asks for them"). The behavior was checked with temporary tests, deleted before the commit (see Verified). The only test change is `AdminActions.test.ts`, which now passes `daily: null` for the new required prop.

## Verified
- Temporary PGlite tests (`vitest run`, 3 tests passed, then deleted):
  - Failed day (3 alliances, every call a `TimeoutError`, 4 calls), then a retry with a working source: the retry returns `complete` with 4 calls. The day's 3 rows are data rows with 3 members each and no error. The row reads `complete`, `callsUsed: 8`, `error: null`. A second retry returns null.
  - Refused: no row for the day, and a `partial` day. Two retries at once on a failed day: exactly one runs.
  - Route: no PIN returns 401. A day that did not fail returns 409 `{ code: "daily_read_not_failed" }`. After a failed read it returns 200 with `status: "complete"`, `calls_used: 21` (20 alliances + quota) and empty `failed` / `stale`.
- Temporary render test (`renderToStaticMarkup`, deleted): the card does not render for `daily: null`. With a failed day it renders the label, the line, the **Retry** button (`min-h-11`, 44 px) and the cost tag. The button is `disabled` while a run is in progress. The answer texts for `complete`, `partial` and 409 read as shown under Built.
- `pnpm check`: typecheck, lint, 254 tests passed (1 skipped), drizzle check "No schema changes", i18n "17 languages up to date".
- Not run: a browser check of `/admin` at 360 px. It would need a `failed` row for today in the Neon preview database. The card uses only existing components (`buttonClass`, `CostTag`, the label style of "Target event").
- No upstream call was made.

## Open issues
- The daily read's Discord line lists only the alliances that got an error row. Alliances that the deadline cut or never started are missing from it. On 2026-11-12 the line listed 12 of 20, and the read looked partial when nothing was read. The event collector writes `not fetched: deadline` for these alliances.
- A `partial` day cannot be retried (see Decisions).
- If the function dies during a read, the day's row stays `running`. Neither the tick nor the retry can take it back.
- Server-side, the retry does not refuse while a snapshot runs. The page turns the button off then, and the quota rule (`dailyReadQuota`) keeps the event reserve either way.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. All checks passed on the first full run; the only rework was the ESLint length limits.
Owner must do first: merge this PR into `dev`. The next time a daily read fails, open `/admin` and press **Retry** once to see it work on production (≈ 21 calls).
Plan changes needed: none.

<adjustments>
- `retryDailyRead` and `POST /api/daily-read/retry` exist. A later retry for `partial` days should reuse `readDay` and decide how to merge with the existing data rows (the unique key is `(read_day, union_id)`).
- `daily_reads.calls_used` is now the day's total across attempts, because `finishDailyRead` adds to the stored value.
- `AdminActions` is at 80 counted lines (the function limit). New `/admin` actions should go in their own component file, like `DailyRetry.tsx` and `ManualSection.tsx`.
</adjustments>
