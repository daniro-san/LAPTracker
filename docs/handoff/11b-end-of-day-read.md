# 11b — The daily read at the end of the server day, with every roster field (D72)

Closes #294. Owner answer 3 of the workspace design (2026-11-16): no extra read; move the daily read from the morning to the end of the server day, before the reset, and keep every roster field.

## Built
- **End of the server day.** `DAILY_ROSTER_AT` defaults to `23:45` (`lib/env.ts`); the 23:52 tick, the last of the server day, runs the read.
- **Never after midnight** (INVARIANT `daily-read.ends-before-midnight`, `lib/tick.ts`):
  - `dailyReadDue` (`lib/schedule.ts`) looks only at today's server date, so a tick at 00:07 never reads the day before. It now returns `{ day, to }`; `from` was only used by the event-day skip.
  - The tick does not start the read when `now + RUN_DEADLINE_MS` (100 s) is past the end of the server day (after 23:58:20).
- **Event days.** The skip on a scheduled event's day is removed, and `hasScheduledEvent` (`lib/repo/events.ts`, its only caller was the skip) with it.
- **Every roster field.** `daily_rosters.raw_json` (jsonb, nullable), migration `drizzle/0017_silent_umar.sql` from `pnpm db:generate`. `lib/daily-read.ts` stores `trimRaw(a.raw)` per roster read. Error rows and older rows stay null. D67's retry upsert (`set: row`) replaces `raw_json` with the roster it replaces.
- **Privacy.** Every select from `daily_rosters` already listed its columns (`lib/queries/daily-runs.ts`, `lib/queries/history-readings.ts`, `lib/queries/member-history.ts`, `lib/repo/daily-reads.ts`). No `select()` without columns exists outside tests. Nothing selects `raw_json`.
- **Tests** (two):
  - `lib/daily-read.test.ts`: a daily read of a roster whose raw is the OGs fixture `v1-20261116T105019Z/alliance-67111155.json` stores `raw_json` with every `BLOCKED_ROSTER_KEYS` key (`daily_tech` among them), and `memberHistoryCard` (the query behind `GET /api/alliances/[unionId]/history?at=`) for that roster returns none.
  - `app/api/tick/route.test.ts`: replaces the old "not on the event's day" test. Saturday 2026-11-07: the Before runs at 12:05Z; the tick at Sat 23:52 server time runs the daily read for 2026-11-07. Sunday's 23:52 tick is missed, and the tick at Mon 00:07 server time (still inside 23:45 + 45 min) reads nothing.
- **Docs.** D72 and its index line; README (Saturday timeline row "Every day 23:52", the admin Discord row, "Daily roster read fell short", the quota rules); `.env.example`; GLOSSARY "daily read"; ARCHITECTURE `lib/daily-read.ts` line. D60 and D67 not edited.

## Decisions
- **23:45, not 23:30.** With 23:45 the only tick in the window is 23:52, which reads 23 h 52 min of the day. With 23:30 the 23:37 tick would read and miss the last 23 minutes every day, in exchange for a second chance at 23:52. The brief asked for the last tick. Cost: a dropped 23:52 tick (D26) is a gap for that day.
- **The midnight guard is in the tick, not in `lib/schedule.ts`.** `RUN_DEADLINE_MS` lives in `lib/collector.ts`; `lib/schedule.ts` stays pure and free of collector imports.
- **The event-day skip goes.** No reason to keep it was found. The event's phases are at 10:00 and 14:00 server time, and their windows close by 14:45. Their rosters are read hours before the day ends, so they do not hold the day's counters.
- **Quota rule checked, unchanged.** 23:52 server time = 01:52 UTC on the next UTC day. Friday's read is spent from Saturday's UTC count: 21 + 42 for the Before and After = 63 of 1,000. `dailyReadQuota` still requires 100 left before the read, which keeps a full event run's reserve. The Friday check (22:00 UTC Friday) sees the same spend as before.
- **Owner facts, recorded in D72:**
  - Vercel production has no `DAILY_ROSTER_AT` variable, so the new default applies on deploy.
  - The game's daily donation counter resets at exactly 00:00 server time (UTC−2).

## Deviations
- The e2e "tick right after midnight" step ran `runTick` from a tsx script with the clock set, not through `next dev`: the dev server uses the real clock. The script used the same code, the same local database and the same fixture server. See Verified.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (60 files passed, 1 skipped; 278 tests passed, 1 skipped), drift gate ("Everything's fine"), i18n.
- **Local e2e, no upstream call.** Local Postgres (D47, new cluster in the worktree, migrations 0000–0017). A local stand-in for `/v1` served `fixtures/v1-20261116T105019Z` and `fixtures/v1-ids` with `updated_at` = now. `next dev` (`dev:local`) ran with a local-only `.env.local` (placeholder key, no webhooks) and `DAILY_ROSTER_AT` set 5 minutes back (14:28 server).
  - `POST /api/tick` → `{"action":"daily-read","day":"2026-11-16","status":"partial","calls_used":21}`; the stand-in counted 21 calls. The read was partial because URSA (67110320) has no fixture in those folders.
  - Stored rows: 19 rosters with `raw_json` not null and `raw_json->'members'->0 ? 'daily_tech'` true; URSA's error row (`v1 not found`) has `raw_json` null.
  - `GET /alliances/67111155/history`: 200, 102,269 bytes. `GET /api/alliances/67111155/history?at=2026-11-16T16:33:56.789Z`: 200, 7,338 bytes. The card's keys are `roster, joined, left, renamed, changed, uid, name, power, kills`. In both bodies, grep finds 0 matches for `last_online_at|joined_at|daily_honor|daily_tech|avatar_url|raw_json|rawJson` and 0 matches for any blocked key as a quoted JSON key (`"x"`, `"y"`, `"online"`, `"active"` and the rest).
  - `POST /api/daily-read/retry` on that partial day: the OGs `raw_json->>'updated_at'` changed from `1794846836.789` to `1794846915.274`, so the upsert replaced it. 20 rows, 19 with `raw_json`.
  - `runTick` with the clock set, `DAILY_ROSTER_AT=23:45`:
    - `2026-11-18T02:07Z` (Wed 00:07 server; Tuesday's 23:52 tick missed) → `idle`;
    - `2026-11-19T01:58:30Z` (Wed 23:58:30; the read could outlive midnight) → `idle`;
    - `2026-11-19T01:52Z` (Wed 23:52) → `daily-read 2026-11-18`;
    - `2026-11-19T02:07Z` (Thu 00:07) → `idle`.
    - `daily_reads` then holds 2026-11-16 and 2026-11-18 only; the stand-in counted 42 calls in all.
- **`raw_json` size** (same local database):
  - OGs (101 members): `pg_column_size(raw_json)` = **9,305 bytes per day**; as text, 38,885 bytes.
  - The 19 rosters: average 8,309, largest 10,076, total 157,879 bytes.
  - A year for 20 alliances: 20 × 8,309 × 365 ≈ **61 MB**, or ≈ 68 MB at OGs' size. The member arrays add ≈ 2.7 KB per roster, ≈ 20 MB a year.

## Open issues
1. **A read that falls short at 23:52 has about 6 minutes to be retried.** The read finishes at about 23:52:10 (up to 23:53:40) and the admin line arrives then. D67's Retry works only for today's server day.
   - At 00:00 `/admin` shows the new day, the Retry card is gone, the retry route answers 409, and the day that fell short keeps its gap.
   - The admin line's `[Retry on /admin ↗]` link is then out of date.
   - The retry route has no midnight guard: a Retry pressed after 23:58:20 can read rosters after the 00:00 reset and store them under the day before. A guard like the tick's (`now + RUN_DEADLINE_MS > end of day` → refuse) would fix it. Not built (not asked).
2. **No automatic retry.** One option: `DAILY_ROSTER_AT=23:30` with an automatic retry at 23:52 when the 23:37 read fell short. Each attempt costs about 21 calls, spent only on a day that fell short, and every read would then miss the last 23 minutes. A retry inside 23:52–23:58 would need a tick that does not exist. Needs the owner's decision.
3. **One tick, one chance.** A dropped 23:52 tick (GitHub cron, D26), or any other action due at 23:52 (a phase, the Friday check, a rehearsal slot moved there), leaves the day with no read. Nothing is due then with the documented settings.
4. **Size on Neon is not measured.** 9,305 bytes is the local Postgres 18 compressed size; Neon's may differ a little.
5. **Migration number.** D68–D70 are on open branches. If one of them adds a migration, `0017` here will collide, and the later branch must regenerate its migration after the other merges.

## Next
Session: #295 — workspace sign-in (Discord OAuth), after D71 (#303) is merged.
Model / effort: keep — no signal.
Owner must do first: merge D71 (#303), then this PR; nothing in Vercel (no `DAILY_ROSTER_AT` there, the new default applies on deploy).
Plan changes needed: none.

<adjustments>
- `daily_rosters.raw_json` (jsonb, nullable, migration 0017) holds `trimRaw` of each daily roster from this release on: every member field, `daily_tech`, `daily_honor` and `active` included. Rows before the release and error rows have null. No read model selects it; the workspace (D71) must read it only from `lib/private/`.
- The daily read runs at 23:52 server time, so each day's `daily_tech` covers 23 h 52 min of the server day (the counter resets at 00:00 server time, owner fact). Event days (Saturdays) have a daily roster too.
- A day's `raw_json` for 20 alliances is about 166 KB (≈ 8.3 KB per roster, 9.3 KB for OGs); a year is about 61 MB.
- `hasScheduledEvent` is gone from `lib/repo/events.ts`; `dailyReadDue` returns `{ day, to }`.
- Local e2e: `initdb` cannot read `/dev/stdin` in the agent sandbox. Run `initdb -D .pglocal -U postgres --pwfile=<file> --auth=password -E UTF8` by hand, append `listen_addresses = '127.0.0.1'` and `unix_socket_directories = ''` to `.pglocal/postgresql.conf`, then `pnpm db:local:start`. The main checkout's `.env.local` points at Neon: write a local-only one in the worktree.
- The `/v1` stand-in must send `updated_at` as epoch seconds (a number); an ISO string fails `v1.schema`.
</adjustments>

PR: (added by the orchestrator)
