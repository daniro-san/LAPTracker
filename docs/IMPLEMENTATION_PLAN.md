# LAP Tracker — Alliance Event Tracker: Implementation Plan

> **For Claude Code:** read this whole file first. Implement phase by phase, in order. Stop after each phase and show what was built before moving on. Do not skip Phase 0 checks. Everything in the codebase (code, comments, UI copy, commit messages) is in **English**.
>
> **Companion files:** `SESSION_PLAYBOOK.md` has one prompt per session with model/effort/mode and the handoff contract; `PREREQUISITES.md` lists accounts, CLIs, secrets and what the owner does by hand before each session. Sessions are driven from the playbook; this file is the specification they implement.

## 1. Goal

A small web app, hosted on Vercel, that:

1. Takes a **snapshot** of the 20 configured alliances on server **325** **1 hour before** and **1 hour after** a weekly event (Saturday, 12:00 server time).
2. For every configured alliance, records **might** (total power) and **kill count**, both from the alliance endpoint (one call per alliance; the roster carries per-member `power` and `kills`).
3. Optionally cross-checks against the server-wide ranking boards (one unauthenticated call) where the game's own alliance-kills counter lives.
4. No per-player API calls and no manual data entry in v1: everything the table shows comes from the API.
5. Shows a comparison table: might before / after / delta, kills before / after / delta.
6. **Keeps every snapshot permanently** so past events can be browsed (expected use: ~4 events/month, 6+ months retention).

Keep it simple. No auth system, no multi-server support, no charts in v1 — history is a list of past events plus the same table per event.

## 2. Facts about the documented API — measured 2026-11-04 (`fixtures/v1-*`), docs re-read the same day

| Fact | Consequence |
|---|---|
| Auth: `Authorization: Bearer lap_...` (or `X-API-Key`). Key from `/account` after Patreon login. | One env var, `LAP_API_KEY`. |
| **1,000 requests per UTC day** (free; `patron: false`). Every `/v1` call counts, `/v1/quota` included. The `quota` object is in **every** response body. | Read `remaining` from each response; no extra quota calls mid-run. ~55 calls on a Saturday (§4). |
| No `User-Agent` → Cloudflare 403 before the key is checked. | Always send `User-Agent: laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)`. |
| `GET /v1/alliances/{alliance_id}` returns a **flat** object: `union_id, sid, name, abbr, power, member_count, capacity, level, exp, rank {rank, score}, live, updated_at, cached, cache_seconds: 600, declaration, bulletin, leader_name, members[]`. Members: `uid, nick_name, power, kills, lv, rank_label, online, last_online_at, joined_at, active, daily_honor, daily_tech, x, y, avatar_url`. | **One call per alliance gives might (`power`) and kills (`sum(members.kills)`).** `power == sum(members.power)` exactly in all four reads. No player calls needed. |
| **Refresh-on-read, verified.** Two reads 11 min apart: `cached: false` both times, `updated_at` = now both times, for OGs *and* for URSA (which the site had never pulled). `cache_seconds: 600`. | A `/v1` read is the refresh. A read within 10 min of the last pull returns `cached: true` with that pull's `updated_at`. §3.7 is settled. |
| A read that pulls takes **~2.3–2.6 s**. | 20 alliances at concurrency 4 ≈ 15 s. `maxDuration = 120` with margin. |
| `rank.rank` / `rank.score` is the game's own power ranking of the alliance on the server (OGs #2 at capture). | Stored as `server_rank`; the kills ranking only exists on the internal board (§2b). |
| `declaration` / `bulletin` / names are free text from players. | Untrusted: rendered as text if at all; `declaration`/`bulletin` not shown in v1. |
| Tags are case-sensitive and not unique; `/v1/alliances/{server}/{tag}` can `409`. | Always address by `union_id` (§3.4). |
| Errors: `401, 404, 409, 429, 502, 503, 504`. | Retry only `502/503/504` (max 3, backoff + jitter). Abort the run on `429`. |

### 2b. The site's internal API (observed 2026-11-04, undocumented — see §3.5 before relying on it)

Captured from the browser while loading `lastasylumtracker.com/servers/325` and `/alliance/67111155`. All on `lastasylumtracker.com` (not `api.`), no API key, no documented limits, `busy` flags in responses.

| Endpoint | Returns | Why it matters |
|---|---|---|
| `GET /api/servers/catalog/325` | server summary: `players`, `power`, `alliances: 98`, king, throne alliance, `updated_at` | sanity data |
| `GET /api/servers/catalog/325/ranks` | `boards[]`: `power`, `kills`, `heroes`, `castle` (players, top 100) and **`alliance_power`, `alliance_kills`** (all 99 alliances: `id` = union_id, `name`, `abbr`, `score`, `rank`), each with `pulled_at`; top-level `cached`, `stale` | **One call = might and kills for every alliance on the server, as the game ranks them.** Freshness unknown (`pulled_at` was ~12 h old when captured). |
| `GET /api/alliances/{union_id}` | **two shapes.** `live: true` (someone viewed it on the site): `power`, `member_count`, `updated_at`, `members[]` with `power`, `lv`, `kills`, plus behaviour fields. `live: false` (never viewed — URSA, probably most of the 20): a stub from the daily map crawl — no `power`, no `updated_at`, no name; members keyed `player_id/nick/map_updated_at` from the previous day | not a usable primary source; per-member `kills` do exist on live rosters |
| `POST /api/alliances/{union_id}/refresh` | **403 `Refresh only from the site`** from outside the site (probe 2026-11-04 15:35 UTC; GET gives 405). `GET …/refresh/status` is open and shows a **per-alliance** 600 s cooldown (OGs 546 s left while URSA had 0 in the same minute) | closed on purpose. We don't spoof `Origin`/`Referer`/cookies to get around it. |
| `GET /api/leaderboard?limit=100`, `/leaderboard/faces` | global top players | irrelevant |

Probes 2026-11-04 15:30–15:37 UTC (`fixtures/probe-*`): the internal GET returns whatever the site last pulled (OGs moved 15:01 → 15:34 only because its page was opened), a stub for alliances never viewed, and refuses our refresh. The documented `/v1` pulls on demand (§2) — so the internal API is only ever a cross-check.

Two numbers for the same thing, from different clocks: board `alliance_kills` for OGs = 33,634,507 (`pulled_at` Nov 3 16:35 UTC); the roster's per-member `kills` summed 25.3 M (`updated_at` Oct 31). Board `alliance_power` 3.84 B vs roster `power` 3.71 B. The board is the game's own alliance counter (it counts kills of players who have since left); the roster sum is ours. **Before/after deltas must use one source on both sides, and that source's refresh time must be known.**

## 3. Decisions (with trade-offs)

### 3.1 Scheduling — a dumb tick from cron-job.org, times in env vars
Vercel Hobby cron fires once a day at an imprecise minute, so it's out. GitHub Actions `schedule` was the first choice but never started a run in this repository (D26, D30 (cron-job.org)), and the owner wants to change snapshot times without a commit. So:

- **The scheduler is the cron-job.org job "Vercel Ticker"** (D30 (cron-job.org)): every 15 minutes, **every day** → `POST https://laptracker-inky.vercel.app/api/tick` with `Authorization: Bearer $CRON_SECRET` (30 s timeout, history kept, a notification after 2 failures). One call, no logic. Daily rather than Fri–Sun because the same tick runs **rehearsals** on any weekday (below) and because a tick that answers `204` every 15 minutes is itself the liveness signal. **`.github/workflows/tick.yml`** stays as the manual path (`workflow_dispatch`, `phase=tick|before|after`) and as a second scheduled path at minutes 7, 22, 37 and 52 that fails on any non-2xx (D26); the tick is idempotent, so two callers never duplicate a snapshot. `CRON_SECRET` lives in three places: Vercel Production, the GitHub secret and the cron-job.org header.
- **`POST /api/tick`** is event-driven, one code path for Saturdays and rehearsals: (1) if the coming Saturday has no `events` row yet and `now` is within a day of it, create it with `before_at`/`after_at` computed from `SNAPSHOT_BEFORE`/`SNAPSHOT_AFTER` in `SERVER_TZ`; (2) for every event (real or `is_test`) with a phase whose `[x_at, x_at + SNAPSHOT_WINDOW_MIN)` window contains `now` and no snapshot for `(event, phase)`, run that phase — at most one per tick; (3) after the AFTER phase of an `is_test` event, compute the **rehearsal verdict** (below) and post it. The `unique (event_id, phase)` constraint and the run lock make a double tick harmless. Outside any window it returns `204` in milliseconds.
- **Rehearsal = a test event with its own times.** `/admin` has one button, *Rehearse now*: it inserts an `is_test` event named `REHEARSAL <timestamp>` with `before_at = now + 15 min`, `after_at = now + 45 min`. Nothing else changes — no env edit, no redeploy, and the real cron ticks run it, so what is exercised is exactly the Saturday path: cron-job.org → tick → window → collector → DB → notify. The AFTER phase sits ≥ 30 min after BEFORE, so every `/v1` read must come back with a newer `updated_at` (cache is 10 min) and a real delta. **Verdict** (`✓ Pass` or `✗ Fail`, then one `✓`/`✗` line per check; shown on `/admin` under *Last rehearsal* and added to the rehearsal's one admin Discord message, which starts with `[rehearsal]` and is edited in place after each phase — D31; an edit does not notify, so open the message or `/admin` to read it): both snapshots `complete`; every alliance `is_fresh` in both; `after.source_updated_at > before.source_updated_at` for every alliance; `calls_used` of each run equals the drop in `quota_remaining` between its first and last response; each run under 120 s; both phases started within `SNAPSHOT_WINDOW_MIN` of their scheduled time (reports the lag). Any failed line names the alliance or the number. Test events never reach the public webhook or public pages (Phase 6).
- **Saturday times are env vars** (`SNAPSHOT_BEFORE=10:00`, `SNAPSHOT_AFTER=14:00`, `EVENT_TIME=12:00`, all server time): change them in Vercel from a phone, redeploy, done. No YAML edit, no commit. `/admin` shows the effective schedule read-only and the next event's computed `before_at`/`after_at`. A DB-backed settings form is v2, only if env edits prove annoying; rehearsals don't need one because their times live on the event row.
- Precision = the 15-min cadence: a 10:00 snapshot starts by ~10:15 (the D30 (cron-job.org) proof rehearsal started its phases 4 min after they were due). Fine with hours of margin; stated in the admin message (`scheduled 10:00, ran 10:12`).
- **`.github/workflows/keepalive.yml`** (monthly commit to a `keepalive` branch — `dev` and `main` are protected, §11.6) stays for `tick.yml`'s second path: GitHub disables schedules in a public repo after 60 days without repository activity.
- **Scheduled rehearsal — nobody has to be present.** `REHEARSAL_AT` (default `fri 18:00`, server time; a comma-separated list is allowed, e.g. `wed 18:00, fri 18:00`; empty disables) makes the tick create the same `is_test` event the button creates, in the first tick after that time each week. It runs, the verdict is in the rehearsal's admin message ~50 min later, and the Friday message two hours later shows the quota after it. Guards, for both the button and the schedule: never on `EVENT_WEEKDAY` or the day after it, never within 3 h before a real event's `before_at` or while a real phase is running (`409` / skipped with an admin note), at most one pending rehearsal at a time. Retention: `REHEARSAL_KEEP=4` — older rehearsal events and their rows are deleted when a new one is created, so `/admin/runs` stays readable and nothing accumulates. Rehearsals never touch public pages or the public webhook, and their quota (~45 calls) resets at 00:00 UTC, before any Saturday run.
- **Friday check** is a tick too: `/api/tick` runs it in the first tick after `QUOTA_CHECK_AT` (default Friday 20:00 server). It always posts to the admin webhook: quota `remaining` (⚠️ if `< 900`), database size via `pg_database_size()` (⚠️ above 700 MB), and the next BEFORE/AFTER in server time and UTC — so a silent week means the tick is dead, which is itself the signal.
- Manual fallback: the Before / After seals on `/admin` (PIN), or Actions → tick → Run workflow with `phase=before|after`. This is the real backup if cron-job.org is late or down.

### 3.2 Persistence — permanent history is a requirement
Every snapshot is stored forever; nothing is overwritten. Volume is tiny: 26 weeks × 20 alliances × 2 phases ≈ 1,000 alliance rows, plus ~2,000 members × 2 × 26 ≈ 100k member rows per 6 months. Any free Postgres tier handles this for years.

- **Chosen: Neon Postgres** (via Vercel Marketplace, free tier) + **Drizzle ORM**. Compute scales to zero and wakes on the first query; data is retained.
- **Supabase**: also fine technically, but the free tier **pauses projects after ~7 days of inactivity** and requires a manual restore. This app is used exactly once a week → real risk of the DB being paused on Saturday. Only pick it if you'll upgrade or add a keep-alive ping. *Verify both providers' current free-tier rules before Phase 6; they change.*
- **SQLite: not viable.** Vercel's filesystem is ephemeral — the file disappears on every deploy/cold start. Turso (hosted libSQL) would work, but it's one more vendor for no gain over Neon.
- Avoid KV/Blob: the data is relational and edited row by row.
- Store the **raw upstream responses** (`raw_json`) alongside the computed numbers, so that if the "might" or "kills" formula ever changes, history can be recomputed without spending quota.

**Two databases, one schema — migrations run on deploy (owner's question, 2026-11-04).** Nothing keeps the Neon `main` and `preview` branches in step by itself; as shipped after Session 4 the migrations `drizzle/0000–0002` had been applied only to PGlite in tests. The rule, implemented in Session 8:
- `pnpm db:migrate` = `drizzle-kit migrate` over `DATABASE_URL_UNPOOLED` (direct connection; that is why Preview has one too). Vercel's **Build Command** becomes `pnpm db:migrate && pnpm build`, so every deployment migrates *its own* database first: a PR or `dev` build migrates the `preview` branch, a `main` build migrates production. The two can only drift by one PR's worth, and a migration that fails fails the build — the deploy never runs code against a schema it doesn't have.
- **Additive only (expand/contract):** a migration never drops or renames a column that the previous release still reads, because Instant Rollback puts the previous build back on the migrated schema and two PRs can share `preview`. Removal is a later release, after nothing reads the column.
- **Drift gate in CI:** `pnpm db:generate` must produce no new file (schema.ts changed without a migration = red), and `drizzle-kit check` validates the migration journal. Both in `pnpm check`.
- **Visible:** the Friday message and `/admin` show the production schema version (the newest row in `drizzle.__drizzle_migrations`); `/admin` on a preview shows the preview's. Same number = same schema.
- Data is not synced, and shouldn't be: `preview` holds seed data. To look at real data in a preview, Neon's *Reset from parent* on the `preview` branch copies production in one click; the next deploy re-migrates if needed.

### 3.3 Edit protection
Public page + editable fields with no protection = vandalism. v1: a single shared **PIN** (`EDIT_PIN` env var) required for the "run now" button. Checked server-side. Not real security; good enough for a guild tool.

### 3.4 Which alliances — all 20, by `union_id`, fixed per event
`config/alliances.ts` lists the 20 alliances to track as `{ unionId, tag, name, formerly? }`, seeded from the `alliance_power` board on 2026-11-04 (§7). Identify by `union_id`, not tag: the documented API accepts `/v1/alliances/{alliance_id}`, ids don't change or collide, and tags like `404` or `jGn` are asking for trouble. The set is copied onto the event when the `before` run creates it (`events.alliance_ids`), and the `after` run uses the event's copy, so a config change mid-Saturday can't make the two snapshots incomparable.

Both might and kills come for every tracked alliance from the same alliance call, so there is no tracked subset and nothing manual.

**Quota rule, now one line:** before each run, `remaining ≥ 2 × (len(alliances) + 5)`; otherwise fail with a clear message. With 20 alliances that is ~50 of 1,000. Keep the check: it costs one call and it's what turns "someone used the key on a Saturday" into a Discord message instead of a half snapshot. The Friday check (`GET /api/quota`, alert if `remaining < 900`) stays.

### 3.5 Data sources — `/v1` is the product; the internal API is optional garnish
Probed 2026-11-04 (`fixtures/probe-*`). The internal API offers three things and they are not equal:
- `GET /api/servers/catalog/{sid}/ranks` — open, one call, power and kills of every alliance as the game ranks them, with `pulled_at`. Works from anywhere.
- `GET /api/alliances/{id}` — open, but two shapes (§2b). Only alliances someone viewed on the site have a real roster. Useless as a primary.
- `POST …/refresh` — **403 "Refresh only from the site"**. Closed deliberately. Spoofing headers or cookies to get in is the same class of behaviour as pooling free keys; the maintainer has already said no.

Therefore:
- **Primary, and the only required, source: `GET /v1/alliances/{id}` with the API key.** Verified 2026-11-04 (§2): it pulls from the game on read when its 10-minute cache has expired, for any alliance, in ~2.5 s. A `/v1` read at 13:00 Saturday *is* the refresh.
- **Internal API: ranks board only, best-effort.** One open GET per snapshot for `power_board` / `kills_board` + `pulled_at`. If it 403s or changes shape, the columns are null and the snapshot is still `complete`.
- **Per-alliance fallback, not a second source:** if `/v1` fails for one alliance after retries, the collector may read the internal `live: true` roster for that alliance (same tracker data, with its own `updated_at`) and record `source = internal` on that row. A `live: false` stub is never used.
- **Degradation is designed:** no number that appears in a delta depends on an undocumented endpoint. If `/v1` goes away the tool stops and says so; the fix is a conversation with the maintainer, not a scraper.
- One API key. No pooling. No `LAP_SOURCE` switch.

### 3.6 Run duration
Measured: ~2.4 s per `/v1` read that pulls. 20 alliances at concurrency 4 ≈ 15 s; `503 busy` retries could double it. `maxDuration = 120`. Re-measure in the dry run.

### 3.7 Freshness — settled: `/v1` refreshes on read
The tracker pulls a roster only when something asks. The site's own refresh is closed to us (§3.5); the documented `/v1` asks on our behalf: a read older than the 10-minute cache pulls fresh data (`cached: false`, `updated_at` = now), verified on two alliances including one the site had never pulled (`fixtures/v1-*`, 2026-11-04 15:47 and 15:59 UTC). So every snapshot is fresh by construction, with no refresh endpoint and no human step.

Rules in code, because "by construction" still needs a check:
- Every alliance row stores `source_updated_at`, `cached` and `is_fresh = now − source_updated_at ≤ 20 min`. A `cached: true` read within 10 min of someone's page view is still fresh.
- A snapshot with any `is_fresh = false` row is `partial`, never `complete`; the public message names the stale alliances and the table shows no delta for them. This is the guard against the upstream changing behaviour silently.
- The ranks board (`pulled_at` ~12 h old when captured) is a cross-check with its age displayed; it is never in a delta.

### 3.8 Identity and renames — ids are the identity, names are labels
Alliances rename (URSA was "Wolves" until recently); players rename too. `union_id` and `uid` never change, so every row is keyed by id and names are whatever the snapshot saw. Name history is **derived from snapshots, not stored separately**: for each id, the distinct `(tag, name)` pairs in order of first appearance, each with the `event_at_utc` of the first and last snapshot that showed it (`lib/queries/names.ts`, one query per page; materialize only if the dry run shows it slow).

- Main table: current tag/name, plus a small "formerly WOL · Wolves (until Nov 1)" badge when the history has more than one entry.
- Alliance page: the full name timeline in the header.
- Member table: "(was X)" next to a member whose name differs between the event's before and after rows.
- Resolution is two points per Saturday; a rename that reverts within the week is invisible. History starts with the first snapshot; names from before tracking began are not reconstructed (owner's decision, 2026-11-04). `config/alliances.ts` keeps an optional, unused `formerly` field in the type in case that changes.
- Board rows carry `abbr`/`name` too; they are not used for history (the roster is the source).
- Lookups by name (search, v2 `/ask`) must match historical names as well, so a question about "Wolves" finds URSA.

## 4. Quota budget (per UTC day)

| Item | Calls |
|---|---|
| 20 alliance fetches × 2 phases | 40 |
| quota check × 2, Friday check | 3 |
| retries | ≤ 10 (a `502` counts against quota — measured 2026-11-04, `used` advanced on the 502; `calls_used` counts failed calls too) |
| **Total** | **~55** |
| Headroom | ~945 |

The ranks board is on the internal API and does not count. Rules enforced in code:
- Before a run: one `/v1/quota` call; abort with a clear error if `remaining < 2 × (alliances + 5)`.
- If a run aborts mid-way, persist what was collected and mark the snapshot `partial`; a re-run fetches only alliances without a row.
- **Never run a full test on event day.** Dry runs happen midweek.
- Confirm the **server timezone** (`SERVER_TZ`). Both runs almost certainly fall in the same UTC day; the quota rule assumes they do.

## 5. Stack

- Next.js (App Router) + TypeScript
- Tailwind (minimal styling; one table, one form)
- Drizzle ORM + Neon Postgres (`@neondatabase/serverless`)
- Vitest for unit tests
- Deployed on Vercel Hobby
- Observability: **none third-party**. Run logs and app errors live in Postgres (§6 `run_logs`, `app_errors`) and are read on `/admin`; Discord admin webhook for alerts; Vercel runtime logs (1 h on Hobby) only for live debugging. Decided 2026-11-04 after checking Vercel Hobby limits (runtime logs 1 h, Observability 12 h, no error tracking, Web Analytics without custom events) — PostHog was dropped as a third party holding player data for a job one table does. Page usage is the one exception: Vercel Web Analytics and Speed Insights on production, free tier, no custom events, query string and hash cut before sending (D36, issue #69).

## 6. Data model

```
events
  id             serial pk
  name           text            -- e.g. "Saturday Event 2026-11-08"
  event_at_utc   timestamptz     -- 12:00 server time converted to UTC
  alliance_ids   bigint[]        -- copied from config by the BEFORE run; the AFTER run uses exactly this
  is_test        boolean default false   -- rehearsals and dry runs: admin webhook only, hidden from public pages
  before_at      timestamptz     -- when the BEFORE phase is due (UTC); Saturdays: from SNAPSHOT_BEFORE in SERVER_TZ; rehearsals: now + 15 min
  after_at       timestamptz     -- same for AFTER; rehearsals: now + 45 min
  created_at     timestamptz

snapshots
  id                     serial pk
  event_id               fk events
  phase                  text  check in ('before','after')
  started_at             timestamptz
  finished_at            timestamptz null
  status                 text  check in ('running','complete','partial','failed')
  calls_used             int
  quota_remaining_after  int null
  board_pulled_at        timestamptz null   -- freshness of the ranks board, if fetched
  error                  text null          -- one line; the step-by-step is in run_logs
  duration_ms            int null
  unique (event_id, phase)

alliance_snapshots
  id              serial pk
  snapshot_id     fk snapshots
  union_id        bigint
  tag             text
  name            text
  member_count    int
  total_power     bigint          -- "might": the alliance object's power field
  total_kills     bigint          -- sum(members[].kills) from the same response
  server_rank     int null        -- rank.rank from /v1: the game's power ranking on the server
  level           int null
  power_board     bigint null     -- from the alliance_power board, cross-check only
  kills_board     bigint null     -- from the alliance_kills board, cross-check only
  source          text  check in ('v1','internal')  -- 'internal' only as the per-alliance fallback in §3.5
  source_updated_at timestamptz null -- the response's updated_at: how fresh the roster was
  cached          boolean null    -- /v1's cached flag
  is_fresh        boolean         -- §3.7: now − source_updated_at ≤ 20 min at snapshot time
  error           text null       -- one line, e.g. "503 after 3 retries"
  raw_json        jsonb           -- the alliance response minus bulk/free-text: members[].avatar_url, members[].frame_url, badge_url, server_badge_url, bulletin, declaration, quota (40 KB → 28 KB measured)
  unique (snapshot_id, union_id)

member_snapshots                 -- one row per member of every tracked alliance, every snapshot; all from the roster
  id                   serial pk
  alliance_snapshot_id fk alliance_snapshots
  uid                  bigint
  name                 text
  power                bigint
  kills                bigint
  lv                   int null
  unique (alliance_snapshot_id, uid)
  index (uid)                     -- per-player history later

auth_attempts                    -- rate limiter state (§12.2); tiny, pruned on write
  key          text pk            -- 'ip:<addr>' or 'global'
  count        int
  window_start timestamptz

run_logs                         -- the "why" of every run; one line per upstream call and per collector decision
  id           serial pk
  snapshot_id  fk snapshots
  at           timestamptz
  level        text  check in ('info','warn','error')
  code         text               -- e.g. 'v1.fetch', 'v1.retry', 'internal.fallback', 'stale', 'quota', 'abort'
  union_id     bigint null
  data         jsonb              -- { endpoint, http_status, cached, retry_n, duration_ms, quota_remaining, ... } — counts and codes, never names
  index (snapshot_id)

app_errors                       -- errors outside a run (page render, route handlers), from instrumentation.ts onRequestError
  id        serial pk
  at        timestamptz
  route     text
  digest    text null             -- Next's error digest; groups repeats
  message   text                  -- our one line, not err.message of third-party errors
  index (at)                      -- capped at 500 rows: the insert deletes the oldest beyond that
```

### 6.1 Storage budget (measured 2026-11-04 on the real fixtures; Neon Free = 1 GB per project)
| Item | Per snapshot | Per year (2 snapshots × 52) |
|---|---|---|
| `raw_json`, trimmed as above (28 KB × 20) | 560 KB | ~29 MB before TOAST compression; jsonb with repeated keys compresses 3–5× |
| `member_snapshots` (~2,000 rows × ~90 B + indexes) | ~250 KB | ~13 MB |
| `run_logs` (~60 lines × ~300 B) | ~20 KB | ~2 MB |
| `alliance_snapshots`, `snapshots`, `events`, `auth_attempts`, `app_errors` | — | < 1 MB |

~45 MB/year worst case, ~15 MB/year realistic: the 1 GB project lasts decades. Logs are 4% of it — the budget is `raw_json`, which stays because it is what lets a future field be back-filled from history. The Friday message includes `pg_database_size()` so the number is seen weekly without opening Neon; `/admin` shows it too.

No `manual_kills` table: every number comes from the API. Deltas are `after.total_x − before.total_x` per alliance, roster vs roster; a row with `is_fresh = false` on either side shows a stale marker instead of a delta; board numbers are never in a delta. Roster fields the plan keeps out of every read model are listed in §12.1.

## 7. Config

`config/alliances.ts` — the top 20 by the server 325 `alliance_power` board as captured 2026-11-03 16:35 UTC (extracted from the board JSON, not typed). OGs is #3 by power, #2 by kills. Session 0 resolves each id on `/v1/alliances/{id}` before committing; the owner can swap entries, but the list is config, not runtime discovery (§3.4).
```ts
export const SERVER = 325;
export const ALLIANCES = [
  { unionId: 67109944, tag: "NSE",  name: "Natural Selection" },     // power #1  · kills #1
  { unionId: 67110320, tag: "URSA", name: "Ursus Invictus" },        // #2  · #4  (was "Wolves" before tracking began; history starts with the first snapshot — §3.8)
  { unionId: 67111155, tag: "OGs",  name: "OldGrandmas" },           // #3  · #2
  { unionId: 67110584, tag: "TmS",  name: "TheMightySpartans" },     // #4  · #3
  { unionId: 67110992, tag: "WACK", name: "TheWackyOnes" },          // #5  · #5
  { unionId: 67110335, tag: "YAHO", name: "AGGRESSOR" },             // #6  · #6
  { unionId: 67117338, tag: "FSPN", name: "Slapsticks" },            // #7  · #8
  { unionId: 67110927, tag: "RDK",  name: "Ritter-der-Kokusnuss" },  // #8  · #13
  { unionId: 67110958, tag: "TRI",  name: "TRIUMPHANTS" },           // #9  · #11
  { unionId: 67116075, tag: "TEST", name: "Test-Tickles" },          // #10 · #7
  { unionId: 67111657, tag: "HSR",  name: "Harmonie San. & Reha" },  // #11 · #10
  { unionId: 67110067, tag: "PSY",  name: "Psycho Killers" },        // #12 · #16
  { unionId: 67110079, tag: "IMPA", name: "IMPERIUM AETERNUM" },     // #13 · #9
  { unionId: 67111313, tag: "BRAV", name: "꧁Black Raven꧂" },         // #14 · #14  (name has decorative glyphs; store as-is, render as text)
  { unionId: 67112691, tag: "NDA",  name: "NoDiscord" },             // #15 · #12
  { unionId: 67110465, tag: "BOH",  name: "BladesOfHonor" },         // #16 · #26
  { unionId: 67110415, tag: "CR8R", name: "BCR8RNU" },               // #17 · #18
  { unionId: 67110999, tag: "WOK",  name: "Wolfskinder" },           // #18 · #24
  { unionId: 67111040, tag: "AFR",  name: "AllianceFr" },            // #19 · #15 · v1 #19 — replaced TRM (67110063, v1 #31) on 2026-11-04 at the owner's choice: follow /v1 rank
  { unionId: 67111128, tag: "FGH",  name: "MegaDeath" },             // #20 · #33 · v1 #20 (verified 2026-11-04 20:23 UTC, fixtures/v1-ids) — replaced 404 (67110811, Берсерк, v1 #21)
] as const;
```

Env vars (`.env.example` + Vercel):
```
LAP_API_KEY=lap_...
LAP_API_BASE_URL=https://api.lastasylumtracker.com/v1   # documented API; override if the host or version path moves
LAP_SITE_BASE_URL=https://lastasylumtracker.com/api      # internal API (ranks board, live-roster fallback)
DATABASE_URL=postgres://...
CRON_SECRET=<random 32+ chars>
EDIT_PIN=<6-8 digits>
SERVER_TZ=Etc/GMT+2            # server runs at UTC−2, fixed (observed 2026-11-04: server 14:37:01 at 16:37:08 UTC); POSIX sign is inverted on purpose
EVENT_WEEKDAY=6                # Saturday
EVENT_TIME=12:00               # server time; display and event naming only
SNAPSHOT_BEFORE=10:00          # server time; event window unconfirmed (§10 q6) — adjust here after the first real Saturday if AFTER lands mid-event
SNAPSHOT_AFTER=14:00
SNAPSHOT_WINDOW_MIN=45         # how long after the scheduled minute a tick may still start the snapshot
QUOTA_CHECK_AT=fri 20:00       # server time
REHEARSAL_AT=fri 18:00         # server time; weekly automatic rehearsal (§3.1); comma-separated list allowed; empty = off
REHEARSAL_KEEP=4               # how many past rehearsals to keep
NOTIFY_WEBHOOK_PUBLIC=https://discord.com/api/webhooks/...   # alliance channel
NOTIFY_WEBHOOK_ADMIN=https://discord.com/api/webhooks/...    # private officers channel
NOTIFY_ADMIN_MENTION=123456789012345678                       # optional; a Discord user id (digits only) or role:<id>; the app renders <@id> / <@&id> itself
```

## 8. Phases

### Phase 0 — Prerequisites (≤ 20 documented calls)
Done 2026-11-04: key exists; server 325; OGs 67111155; the 20 alliances (§7); internal probes (`fixtures/probe-*`: refresh closed, two internal shapes, per-alliance cooldown); **the `/v1` experiment (`fixtures/v1-*`): refresh-on-read holds, kills on members, ~2.4 s per pull, quota accounting exact.** Owner decisions: history starts at first snapshot; no manual input in v1; player pages public, stats and names only.

Server timezone: **UTC−2 fixed** (`Etc/GMT+2`) — observed 2026-11-04 (server 14:37:01 at 16:37:08 UTC). With the defaults in §7, `SNAPSHOT_BEFORE=10:00` → 12:00 UTC and `SNAPSHOT_AFTER=14:00` → 16:00 UTC; `QUOTA_CHECK_AT=fri 20:00` → 22:00 UTC Friday. Both snapshots fall in the same UTC day, which the quota rule assumes; if the owner ever moves AFTER past 22:00 server time, re-check that. The tick workflow has no times in it (§3.1). Session 0 re-checks the offset once more against the in-game clock.

Still needed, and that is all Session 0 does:
1. Re-confirm the 2 h offset against the in-game server time (owner reads it; Claude compares with `date -u`).
2. Resolve the 18 remaining §7 ids on `/v1/alliances/{id}` (18 calls): confirm `name`/`abbr` match the board, record `rank.rank`, save each response to `fixtures/` (they double as test bodies). Stop and report if more than two ids fail.
3. Write `config/alliances.ts`, `.env.example`, `CLAUDE.md`, `docs/handoff/00-prereqs.md` (the §2 facts table copied with the fixture file names as evidence, the 18 resolutions, the UTC conversion for Saturday 11:00/13:00 with arithmetic). Weekday only.

### Phase 1 — Scaffold + harness (see §11, §12)

### Phase 2 — Source adapters (`lib/sources/`)
- One output type: `AllianceSnapshotInput = { unionId, tag, name, memberCount, totalPower, totalKills, serverRank, level, members: { uid, name, power, kills, lv }[], sourceUpdatedAt, cached, quota, raw }` — `quota` is the `/v1` response's quota object (null for internal), so the collector reads `remaining` from each alliance response instead of extra quota calls; `members[].power`/`kills` are `number | null` (Session 2, docs/ARCHITECTURE.md).
- `v1.ts`: `fetchAlliance(id)`, `fetchQuota()`; `Authorization` + `User-Agent` on every request; the alliance response is a flat object (no wrapper) — parse `power, member_count, level, rank.rank, updated_at, cached, members[]{uid, nick_name, power, kills, lv}` and `quota` from each response; retries `502/503/504` max 3 (1s/2s/4s + jitter, `Retry-After` honoured); `429` → `QuotaExhaustedError`; `404` → `NotFoundError`; per-call timeout 30 s (a read may be a live pull); concurrency 4.
- `internal.ts`: `fetchRanks(server)` → `{ pulledAt, power: Map<unionId, number>, kills: Map<unionId, number> }` (open GET); `fetchAlliance(id)` parsing the `live: true` shape only and throwing `NotLiveError` on the stub — used only as the per-alliance fallback in §3.5. Header comment: unofficial, read-only, **no refresh calls, ever**.
- `members[].kills` can be `null` (seen once, AFR 67111040, 2026-11-04): the parser keeps `null` on the member row, `sumKills` treats it as 0, the UI shows `—` for that member. Same rule for `power` if it ever happens. Stated in DECISIONS.
- `index.ts` exports `{ v1, internal }`. No source switch.
- **Where the upstream lives is config; what it returns is code.** Base URLs come from `lib/env` (`LAP_API_BASE_URL`, `LAP_SITE_BASE_URL`, §7) and appear nowhere else — a test greps `lib/` and `app/` for `lastasylumtracker` and fails on any hit outside `lib/env.ts` defaults. Each adapter parses with a zod schema of exactly the fields it uses (not the whole response), so an upstream rename fails loudly as `v1.schema` in `run_logs` + a ❌ admin message, never as silent zeros. A new provider is a third file implementing the same two functions; the collector and everything above it don't change. What this does *not* try to be: a config-driven field mapping — a schema change needs a code change and a test either way, and the zod schema is what tells you it happened.
- Tests (mocked `fetch`; bodies from `fixtures/v1-*` and `fixtures/probe-*`): both parsers → the same type; `totalKills == sum(members.kills)`; `cached` parsed; retry then success; `429` aborts; headers always present; ranks parsing; `NotLiveError` on the stub shape.

### Phase 3 — Collector (`lib/collector.ts`)
```
runSnapshot(eventId, phase, deps):
  assert no 'complete' snapshot exists for (eventId, phase) unless force
  quota = deps.v1.fetchQuota()                       # 1 call
  assert quota.remaining >= 2 * (len(ids) + 5) else fail('quota')
  insert snapshot (status 'running')
  ids = phase == 'before' ? config ALLIANCES (store on event) : event.alliance_ids
  board = deps.internal.fetchRanks(SERVER)            # best effort, 0 quota, null on any error
  for each id (concurrency 4):
      a = deps.v1.fetchAlliance(id)                   # read-through: pulls if > 10 min old (§3.7)
      on final failure: try deps.internal.fetchAlliance(id) → source 'internal'; else row with error, no members
      fresh = now − a.sourceUpdatedAt ≤ FRESH_MAX_AGE_MS (20 min)
      insert alliance_snapshots (total_power, total_kills = sum(members.kills), board numbers,
                                 source, source_updated_at, cached, is_fresh = fresh)
      bulk-insert member_snapshots
  finally:
      status = all rows ok && all fresh ? 'complete' : any rows ? 'partial' : 'failed'
      calls_used; quota_remaining_after; stale list for the messages
```
- Resilience: retry only `502/503/504`; `429` aborts; a run left at `running` > 10 min is `stale` and may be re-run without `force`; a re-run fetches only alliances without a row for that snapshot.
- A stale roster is `partial`, not `complete` (§3.7).
- Call counter in one place; `MAX_UPSTREAM_CALLS = 120` (20 × 3 retries × 2).

### Phase 4 — Routes
- `POST /api/tick` — auth `Bearer CRON_SECRET`; the §3.1 decision (create the Saturday event if due, run the one phase whose window is open, post the rehearsal verdict after a test event's AFTER); `204` when nothing is due. `maxDuration = 120`.
- `POST /api/rehearsal` — auth `x-edit-pin` (same limiter); inserts the `is_test` event with `before_at = now + 15 min`, `after_at = now + 45 min`; refuses (409) if a rehearsal is already pending or the §3.1 guards say no (event day, 3 h before a real BEFORE, real phase running). Called by the `/admin` button; the tick uses the same function for `REHEARSAL_AT`.
- `POST /api/snapshot?phase=before|after&force=0|1` — auth `Bearer CRON_SECRET` or `x-edit-pin` (timingSafeEqual, rate-limited); run lock → 409; `maxDuration = 120`; no flush step — the logger writes synchronously to Postgres. Called by the tick and by `/admin`.
- `/admin` (page, PIN gate, `<meta name="robots" content="noindex">`, listed in `robots.txt` Disallow, linked from nowhere public): effective schedule in server time and UTC with the next event's computed times, **Rehearse now** (with the pending rehearsal's progress and the last verdict), "Run BEFORE/AFTER now" for the current event, the runs list (`/admin/runs`, each run's `run_logs` timeline at `/admin/runs/[id]`, app errors at `/admin/errors`). Obscurity is hygiene, not security; the PIN and rate limit are the control.
- `GET /api/events`, `GET /api/events/[id]` — read models only (§12.1).
- `GET /api/quota` — numbers only (1 upstream call; UI warns).
- `GET /api/quota/check` — Friday check.
- No `/api/manual-kills`.

### Phase 5 — UI, mobile-first
Most readers open this from a Discord link on a phone, during the event. Phones are the design target; desktop is the wide variant.

**Rules (checked in Session 6 with screenshots, not assumed)**
- Design at 360 px first; verify at 360, 390 and 1280. No horizontal page scroll at any width.
- Below 640 px the comparison table becomes **one card per alliance**: tag + name on the first line; then `Members 97 ↑ +2 (+3/−1)`, `Might 3.96B ↑ +20.1M (+0.5%)`, `Kills 35.0M ↑ +0.8M (+2.3%)`; the arrow is the sign, the percentage is relative to the before value. A falling Might or Kills total whose alliance lost members carries a `*` after the change (`▼ −3.2M (−0.4%) *`) with one legend item, `* Includes member changes` (D33, 08q); the "−N Members" note sits in the card's Details panel, not on the card, because on the Kills row it was read as a kills figure (07b). Freshness marks inline (only `○ Stale` / `✗ Failed`; nothing when the data is fine, 07d), whole card tappable to the alliance page. At ≥ 640 px the full table carries the same three fields per metric. One component, two layouts.
- Compact numbers by default (`3.94B`, `34.2M`, `+20.1M`); full numbers in a tap-to-reveal / `title` and on the detail pages. Deltas signed and coloured, with a prefix sign so colour is never the only signal.
- Nothing hover-only: freshness time, board numbers and name history open on tap (a details/summary or a small sheet).
- Touch targets ≥ 44 px; sticky compact header with the event selector; the "Run snapshot" buttons live in a bottom action bar on phones.
- Any input we ever add uses one pattern: `inputmode="numeric"` where numeric, a PIN asked once per session via a bottom sheet, a visible saved/failed state. There is no manual input in v1; the pattern exists so a future one is not improvised.
- Server-rendered pages, no client data fetching for the first paint; the only client code is sorting/filtering and the PIN flow. Target: Lighthouse mobile performance ≥ 90 on `/`, measured in Session 6.
- `prefers-color-scheme` dark mode (the brand tokens define both). A web manifest + icons (Session 7) so the page can be added to a home screen; no service worker.

**Routes:** `/` (most recent event) and `/events/[id]` (any past event), same component.
- Header: the title band "Server 325 · Saturday Ledger", the event's long date, two status chips in server time, `Last updated …` and `Next update …` (07b; the "Last updated" chip stays ink in every finished state, with a separate `○ n stale` mark beside it, 07d), and an **event selector** (dropdown of past Saturdays). Quota is not on public pages; it is on `/admin` (owner, 2026-11-05). Past events are read-only.
- Cards ordered by current ledger rank by might (after snapshot, else before; ties by tag; an alliance the after snapshot did not rank shows `#—` and sorts last, 07b, 07d): rank and its movement, tag and name, then Might, Kills and Members with their changes. Each card has a Details panel (`Server time · 10:00 · → 14:00 · Change · Rank`, rows Might, Kills, Members, Ranking; the kills member-loss note; name history). Freshness: `○ Stale` / `✗ Failed` marks only. Board numbers (`power_board`, `kills_board`) are still collected and stored but no longer shown on the main page (07d); never used in a delta. A "formerly …" badge after the tag when the alliance has a name history (§3.8).
- Buttons: "Run BEFORE snapshot now", "Run AFTER snapshot now" (PIN-protected, confirm dialog stating ~21 API calls and up to a minute).

### Phase 5c — Alliance detail page (cheap because the data already exists)
`/events/[id]/alliances/[unionId]` — click an alliance row on the main table to get here. Routed by id, never by tag (§3.8).
- Header: alliance name/tag with its full name timeline (§3.8), member count before → after, total might before → after → delta, kills before → after → delta, freshness of each snapshot.
- Member table: `Name | Might before | Might after | Δ | Kills before | Kills after | Δ | Lv | Status`, for every alliance (kills come from the roster for all of them).
- `Status`: `joined` (uid only in `after`), `left` (uid only in `before`), blank otherwise; `(was X)` after the name when it differs between the two rows. Roster changes and renames for free, keyed by uid.
- Client-side only, no new API: one query returning both snapshots' member rows for that alliance; a name search; sort chips `Might · ± Might · Kills · ± Kills · Level · A–Z` (tap to sort highest first, tap again to flip; no sort select); one might range with two thumbs whose stops are the roster's own might values (no free-text might inputs); a `✕` chip per active filter and "Clear all" when two are on; the first 20 members in the current order, then "Show all (n)" (07f-alliance-page). No server-side filtering, no pagination (≤ ~120 rows). Each member row links to `/players/[uid]`.
- As shipped the header is one summary band: Might · Kills · Members (value and change), then `RANK #n` with its movement, the stale mark and the same Details panel as the main page (07f-alliance-page).
- Phone layout: the member table collapses to cards (name, might before→after Δ, kills before→after Δ, status), same component as the main table.
- Reuse the same table component on the main page. Keep it plain (see Phase 5b rules).
- **Not in v1:** charts, aggregate filters across alliances. The across-events section is Phase 5e.

### Phase 5d — Player pages, same shape as alliance pages
`/players/[uid]` — reached from a member row, or from `/players?q=` (search by current **or historical** name, `ILIKE`, §3.8; ambiguous matches listed).
- Header, mirroring the alliance page: current name, current alliance tag (link), name timeline, alliance-membership timeline (which alliance each event's snapshots saw them in).
- Table / cards, one row per event: `Event | Alliance | Might before → after Δ | Kills before → after Δ | Lv | Fresh`. Same component and the same compact-number rules as everywhere else. Newest first.
- One query (`lib/queries/players.ts`): `member_snapshots` by `uid` → `alliance_snapshots` → `snapshots` → `events`; the `uid` index from §6 is what makes it cheap. No per-player writes, nothing new in the collector.
- Exposes only name, uid, alliance tag, power, kills, lv and the event dates — never the §12.1 fields. A player page is a public page about a person's game stats; it shows nothing the tracker site doesn't already show.
- Not in v1: charts/sparklines, "compare two players", cross-server lookups. The across-events section is Phase 5e.

### Phase 5e — Evolution across events (alliance and player pages)
The reason every snapshot is kept forever is to see change over weeks. v1 shows it as a table section, "Across events", at the bottom of the alliance page and the player page; charts stay in v2.

**Reference value of an event** = the `after` snapshot's row (fallback: `before`). Each history row shows the server time its figures are from (`Sat, Oct 31  14:00 server`; a before-fallback row reads `10:00`); there is no `B` mark and no "Before only" legend item (07d, S1). "vs previous" deltas compare reference values of consecutive events, never `before` of one with `after` of another. A stale reference row (`is_fresh = false`) yields no delta on either side, same rule as everywhere.

- Alliance, one card/row per event, newest first: `Event | Tag / Name (old → new when changed) | Members (n, +joined / −left vs prev) | Might (Δ vs prev) | Kills (Δ vs prev) | Lv (Δ) | Server rank`.
- Player, one card/row per event, newest first: `Event | Name (old → new) | Alliance (old → new) | Might (Δ in-event · Δ vs prev) | Kills (Δ in-event · Δ vs prev) | Lv (Δ) | Fresh`.
- Pure math in `lib/compute.ts`: `seriesDeltas(rows)` takes ordered reference rows and returns per-row deltas and change flags (name, tag, alliance, lv); `rosterDiff` between consecutive alliance references gives joined/left counts. Property test: the sum of consecutive deltas equals last − first when no row is stale.
- Queries: `lib/queries/alliances.ts: allianceHistory(unionId)` and `lib/queries/players.ts: playerHistory(uid)`, one query each; the `uid` index and `(snapshot_id, union_id)` unique index cover them.
- Show the last 12 events by default with "show all"; ≤ 26 rows in 6 months, no pagination.
- Mobile: cards, one per event, three lines (identity changes, might/kills with both deltas, members/lv/rank). Same compact-number rules.
- **Rank movement (owner, 2026-11-05):** every alliance carries two ranks and both move. *Server rank* is the game's own power ranking (`rank.rank` from `/v1`, stored as `server_rank`); *ledger rank* is the position among the tracked alliances, by might and by kills, computed from the snapshot. Show the rank next to the tag as `#n` and its movement as `▲2`, `▼1` or `=` — within the event (before → after) on the comparison page, and event over event in the "Across events" sections of alliance and player pages (players: ledger rank by might/kills inside their alliance). `compute.rankDelta(prev, curr)` is pure; a missing previous value shows `—`, never `▲` from nothing. Movement uses the same three channels as every other delta: colour, arrow, number.


### Phase 5f — Usability and language-light UI (a MUST before the first Saturday)
The alliance is multilingual (Russia, Spain, Brazil, the US, more); translation comes after Phase 8, but the pages must be usable **without** it now. docs/DESIGN.md "Who uses this" and "Language-light rules" are the contract; this phase applies them to the Session 6/6b pages and verifies them with real members:
- every public-page sentence becomes a chip, a label or a number; one legend; order strictly by rank with a per-viewer "my alliance" highlight (localStorage, optional) because other top-10 alliances will use the page too; ranks shown; `Intl` formatting; three channels per state (colour + arrow + word); strings moved to `lib/copy.ts` (i18n-ready: translation later is a file).
- Navigation per DESIGN.md "Navigation and hierarchy": one row shape at three depths, breadcrumbs on deep pages, search in the header.
- **The ten-second test, without real members (owner, 2026-11-05: no real test is possible):** a model can't "not read English", so the words are removed instead. Because every string goes through `lib/copy.ts`, the session renders the public pages with a **blank dictionary** (every value replaced by `░░░` of the same length — pseudo-localisation — except the game's own four terms Might, Kills, Members and Level, which members read daily in the game's English UI; D23, 07b, judged fair in 07c) and screenshots them at 390 px. Three persona subagents in fresh contexts (an officer in Russia, a casual member in Spain, a player in Brazil on a slow phone), each given only those blank screenshots and the three tasks — *find alliance X's kills change; which alliance lost the most members; when are the numbers from* — answer and say where they hesitated. Wrong answers are findings, fixed in the same session; the blank screenshots stay in `docs/screenshots/` as the baseline. Honest limit: this proves the structure carries the meaning without words; it does not prove real people like it. The first real feedback comes from the alliance after the first Saturday.
- Reference, not a template: lastasylumtracker.com's server page is friendlier than our Session 6 output (clear per-alliance cards, sorting). Borrow the clarity, not the look.
- **Review then fix, like the backend:** Session 7b applies the contract and its own persona findings; Session 7c (fable, read-only) reviews the result against DESIGN.md with measurements (axe-core, contrast, tap sizes, blank-dictionary tasks, blocked keys in HTML, CSP, Lighthouse) and returns a ranked list; the owner decides; Session 7d fixes the accepted items. The builder never grades its own taste.

### Phase 5b — Branding: "Old Grandmas" × plague-era aesthetic
The alliance running this is **Old Grandmas**. Visual identity = plague-doctor / apothecary era meets grandma crafts (knitting, crochet, yarn, doilies, tea). Tone: a serious tool with a wink, not a joke page.

**The contract is `docs/DESIGN.md`** (added 2026-11-04 at the owner's request, to keep generic "AI" styling out): tokens with roles, two typefaces, spacing/radius/surface rules, the closed component list, the ornament budget, motion and voice rules, a "never" list, and the enforcement tests. Every UI session reads it first; this section is the brief it was written from. The format follows the DESIGN.md convention that agent toolchains read (getdesign.md / awesome-design-md); the content is ours — a third party's design file (Discord's, say) would carry its look and its trademarks into a project that must own its visuals.

**Hard rules**
- **No assets from the game.** No logo, no character art, no screenshots, no fonts ripped from it. Everything is original SVG or open-licensed (OFL fonts, CC0 textures). Genre motifs (beaked mask silhouette, apothecary bottles, lanterns, wax seals, parchment) are fine; the game's specific designs are not.
- Decoration lives in **corners, borders, header and empty states only**. The data table stays plain: high contrast, monospaced-tabular numerals, no textured background behind numbers.
- Must still read well at 360 px wide; ornaments never touch the card layout. If an ornament breaks the mobile layout, the ornament goes.

**Direction (defaults — adjust after seeing a first render)**
- *Palette:* aged parchment `#EFE6D3` background, ink `#1E1A1F` text, dark plum `#3B2436` header/accents, wax-seal red `#8C2F2F` for negative deltas / warnings, mustard yarn `#C9962B` for highlights / positive deltas, sage `#6F7F62` for the "manual" badge. Dark mode: swap parchment for a near-black plum, keep accents.
- *Typography:* display serif with an old-print feel for headings (e.g. **Cormorant Garamond** or **IM Fell English**, Google Fonts/OFL); **Inter** or **Source Sans 3** for body/table with `font-variant-numeric: tabular-nums`.
- *Mascot (owner, 2026-11-05):* the **Granny Doctor** — an old lady plague doctor with a cane and a knitting bag; original, single-colour SVG, three poses (404, 500, empty state). Game references stay allusions in copy (server, KvK, the game's terms), never its art. Comic but serious. docs/DESIGN.md has the rules.
- *Logo:* wordmark "Old Grandmas" + a small original mark: a plague-doctor beak mask with **knitting needles crossed behind it** like crossed bones, a ball of yarn where a skull would sit. SVG, single colour, works at 24 px favicon size.
- *Ornaments:* a thin crochet-lace border pattern (repeating SVG) along the header; a ball of yarn with a trailing thread in one page corner; the "Run snapshot" buttons styled as wax-seal stamps; empty states with a teacup ("Nothing recorded yet — put the kettle on"). Snapshot status chips get small icons: hourglass (running), stitched check (complete), dropped stitch (partial).
- *Copy voice:* short, dry, slightly grandmotherly. E.g. page title "Old Grandmas — Saturday Ledger"; delta column header "Gained / Lost"; error toast "The ledger is closed for today (quota exhausted)."
- *Error pages (owner's request, 2026-11-04):* `app/not-found.tsx` and `app/error.tsx` (plus `global-error.tsx`) get the same treatment as empty states — the one place the brand can be loud. 404: an original illustration of an empty walker (or a rocking chair with a half-finished scarf) and copy like **"404 — Grandma wandered off."** / "This page isn't in the ledger. Back to the table →". 500: a knocked-over apothecary bottle, **"Something cracked."** / "The grandmas have been told. Try again in a minute." with a Retry button that calls `reset()`. Motion: one small CSS keyframe loop on the inline SVG (a rocking chair rocking, a yarn ball unspooling, steam from a teacup) — a few KB, no Lottie, no video, no new dependency — and `@media (prefers-reduced-motion: reduce)` turns it off. Rules that still apply: `error.tsx` renders **no error message, stack or digest** (§12.3); it keeps the layout, so the user is never stranded; the pages read at 360 px like everything else.

**Implementation**
- `lib/brand/` with `tokens.css` (CSS variables), `Logo.tsx`, `LaceBorder.tsx`, `YarnCorner.tsx`, icon set as inline SVG. Tailwind theme reads the CSS variables.
- Favicon, `opengraph-image` and a web manifest with 192/512 px icons generated from the logo (Next `ImageResponse`), so the page installs to a phone home screen.
- If the `frontend-design` skill is available in Claude Code, load it before this phase.
- Deliver a first pass as a single static mock page (`/brand`) before touching the real table, so the look can be reviewed and rejected cheaply.

### Phase 6 — Scheduling + deploy
- Vercel project, link Neon from Marketplace, set env vars, `drizzle-kit push`.
- Scheduler: the cron-job.org job "Vercel Ticker" posts to `/api/tick` every 15 minutes with `CRON_SECRET` (D30 (cron-job.org), §3.1).
- `.github/workflows/tick.yml`: `schedule: 7,22,37,52 * * * *` (daily, a second path behind cron-job.org) → one `curl -sS --max-time 150 -X POST $APP_URL/api/tick` with `CRON_SECRET`; the job prints the HTTP code and fails unless it is 2xx (D26); plus `workflow_dispatch` with a `phase` input (`tick|before|after`; `before`/`after` call `/api/snapshot` directly) for manual runs from the GitHub UI. `APP_URL` and `CRON_SECRET` as repository secrets. **Public repo: never commit `.env`, keys, or the PIN.** No times in YAML — they are env vars (§3.1).
- `.github/workflows/keepalive.yml`: monthly, commits a timestamp to `.keepalive` on the `keepalive` branch (force-updated; never `dev` or `main`, which are protected). Together with weekly Dependabot PRs this is the "repository activity" that keeps GitHub from disabling the schedule after 60 days. Not optional. `vercel.json` carries `git.deploymentEnabled: { keepalive: false }` so the monthly push never triggers a Vercel build. The Friday message (§3.1) is the detector if GitHub's definition of activity turns out narrower than this.
- `.github/workflows/dependabot-automerge.yml` (Session 8, with the other workflows): on Dependabot PRs for minor/patch updates, `gh pr merge --auto --squash`; CI still has to pass. Majors are left for the owner.
- Document in README how to change the alliance list (edit config → redeploy).
- **Notifications — two audiences, two channels.** Two optional env vars:
  - `NOTIFY_WEBHOOK_PUBLIC` (alliance Discord channel, non-technical readers). Plain language, no numbers that need explaining, no jargon. Templates:
    - complete → `✅ Saturday ledger updated (before the event). All 20 alliances refreshed and recorded. See the table: <link>`
    - partial → `⚠️ Saturday ledger updated (before the event), but 2 alliances came back with old data (ABC, DEF). No change is shown for them. <link>`
    - failed → `❌ The Saturday ledger could not be updated (before the event). An admin has been notified.`
  - `NOTIFY_WEBHOOK_ADMIN` (private officers channel). Technical: phase, status, calls used, quota remaining, duration, per-alliance failures with HTTP codes, link to `/admin/runs/[id]`. Prefixed with `<@id>` (or `<@&id>` for `role:<id>`) when `NOTIFY_ADMIN_MENTION` is set, with `allowed_mentions` restricted to that one id so no message can ever ping `@everyone`. The public message never mentions anyone.
  - No message sets `username` or `avatar_url` in the payload: Discord shows the name and avatar the owner gave each webhook (owner, 2026-11-05; `lib/notify.ts`). Discord's limit is 30 requests/min per webhook.
  - **One message per channel per event** (D31): the Before posts it (`?wait=true`) and stores its id on the event; the After, and a rehearsal's verdict, edit it in place (`PATCH …/messages/<id>`). In the admin channel a run that ends `partial` or `failed` also posts a new message of its own, because an edit does not notify. One-shot messages (Friday check, PIN lock, app errors, skipped rehearsals) post a new message each.
  - Both skip silently when unset. Send after the snapshot row is finalised, never before.
  - **Test events** (`events.is_test = true`): the public webhook is **never** called; the admin message starts with `[rehearsal]` (manual rounds start with `[manual]`), and the verdict (`✓ Pass` / `✗ Fail`) is added to that same message (D31). Public pages don't list test events (`/admin` does). A rehearsal must look like Saturday to the admin and like nothing to the alliance.
- **Observability: Postgres, not a third party.** Vercel Hobby keeps runtime logs for 1 hour and Observability data for 12 hours, has no error tracking, and its Web Analytics has no custom events — so "look at it later" cannot live on Vercel. (Page views and web vitals do go to Vercel Web Analytics and Speed Insights, D36; they say nothing about runs.) It lives in two tables (§6):
  - *`run_logs`* — written by `lib/logger.ts` during a run: one line per upstream call (`endpoint, http_status, cached, retry_n, duration_ms, quota_remaining`) and per decision (fallback to internal, stale roster, quota abort, cap reached). `/admin/runs/[id]` renders them as a timeline. This is where an admin sees **why**, on a phone, forever.
  - *`app_errors`* — written by `instrumentation.ts` → `onRequestError` for anything outside a run (page render, route handler). `/admin/errors` lists them grouped by `digest`. Capped at 500 rows.
  - *Live debugging* stays on Vercel runtime logs via `console.error` mirrors of the `error`-level lines; nothing else goes there.
  - *Alerts* are the admin Discord webhook: status + link to the run, and a message when `app_errors` receives its first row in an hour (at most one message per hour — the notifier reads the last alert time from the DB).
  - No `POSTHOG_*`, no `shutdown()`/flush, no billing limit to babysit. If a hosted tool is ever wanted, it is a second implementation of the `Logger` interface, not a change to the collector.
- **Logging guarantees (enforced in code, covered by unit tests):**
  - *Logger never throws and never recurses:* every method is one `INSERT` wrapped in try/catch; a failed insert increments an in-run counter that goes into the run summary and is mirrored to `console.error` once. The logger imports nothing that imports the logger (`lib/logger.ts` depends only on `lib/repo` and `lib/redact.ts`). No buffering, so there is nothing to flush and no `shutdown()`.
  - *Bounded work:* the collector iterates the fixed alliance list only, retries max 3 per call, keeps a per-run counter with `MAX_UPSTREAM_CALLS = 120` → abort as `failed` if exceeded.
  - *Bounded log volume:* at most `MAX_RUN_LOG_LINES = 400` per run (20 alliances × 3 retries × a few lines, with margin); past the cap the logger counts and writes one final `log.capped` line. `app_errors` inserts are limited to 1 per second per instance and the table to 500 rows.
  - *Run lock:* `POST /api/snapshot` returns `409` if a snapshot for the same `(event, phase)` is `running` and `started_at` is less than 10 min ago. Prevents overlap between the scheduled run and a manual "Run now".
  - *No scheduler retries:* cron-job.org and `tick.yml` call once per slot and do not retry; `workflow_dispatch` is manual. Keep it that way — no `retry` action. The next slot 15 minutes later is the retry.
  - *Frontend tracking: Vercel's two scripts only* (D36): Vercel Web Analytics and Speed Insights, loaded only on production (`VERCEL_ENV === "production"`), with `beforeSend` cutting the query string and hash. No custom events (Hobby has none), no `track()`, no cookie. Nothing else in the browser phones home.
  - *Tests:* collector aborts at `MAX_UPSTREAM_CALLS` with a mocked client that always succeeds; a roster whose `updated_at` didn't move is recorded `is_fresh=false` and the snapshot is `partial`; logger writes `log.capped` once and nothing after `MAX_RUN_LOG_LINES`; a logger whose repo throws never throws itself and the run still finishes; route returns `409` on an active lock.

### Phase 7 — Dry run (empirical, mandatory before the first event)
- On a weekday, trigger `POST /api/snapshot?phase=before` against production for a **test event**.
- Record: wall-clock duration, `calls_used`, `quota_remaining_after`, 503/504 retries, seconds per `/v1` call (baseline: ~2.4 s), how many rows came back `cached: true` vs `false`, any `is_fresh=false` rows and their ages.
- Compare `member_count` vs `members[].length` for all 20 alliances; compare `total_kills` for OGs against the in-game alliance screen (owner checks). **If the roster kill sum is far from in-game, say so — the board `kills` may be the better primary and the plan flips §3.5.**
- Adjust concurrency / `maxDuration` from the measured numbers, not from guesses.
- Delete the test event afterwards (or keep it flagged `is_test`).

**Two rehearsals before the first Saturday, each with a different purpose** (quota: ~45 calls per BEFORE+AFTER pair, so both fit in one UTC day with the Saturday run):
Both are the same button — **Rehearse now** on `/admin` (§3.1) — and take ~50 minutes from tap to verdict, hands off:
1. **Dry run** (Session 9, as soon as production exists): tap it, wait for `✓ Pass` in the `[rehearsal]` admin message (one message, edited in place after each phase, D31; the edit does not notify, so open it ~50 min after the tap, or read *Last rehearsal* on `/admin`), then do the one check a machine can't: OGs `total_kills` vs the in-game alliance screen. Read the two runs' timelines on `/admin/runs/[id]` and the numbers table the session records. Fix what it finds, release again.
2. **Final rehearsal** runs by itself: `REHEARSAL_AT=fri 18:00` (server; 17:00 Brasília) — before the 22:00 quota reset and before the 20:00 Friday message, which then reports the post-rehearsal quota. The owner's job is to read `✓ Pass` in that rehearsal's `[rehearsal]` admin message (or *Last rehearsal* on `/admin`) and then **freeze `main`** until after the event. Released something after 18:00 Friday? Tap **Rehearse now** before 22:00 server — the deploy is what changed.
What the verdict cannot prove: that Saturday's *times* are right (the rehearsal uses its own); the Friday quota message's line "next BEFORE/AFTER at …" is the check for that. Quota: a rehearsal costs ~45 calls; two rehearsals plus Saturday fit in one UTC day with room.

### Phase 8 — Event-day runbook (goes in README)
Everything below runs on its own; the human steps are only *checks*.
1. Friday ~18:50 server: the scheduled rehearsal (`REHEARSAL_AT`) has added its verdict to its `[rehearsal]` admin message; open that message (the edit does not notify) or *Last rehearsal* on `/admin` and look for `✓ Pass`. A `✗ Fail` names the failed check on its own `✗` line. 20:00 server: the Friday message — quota, DB size, and *next BEFORE/AFTER at …*; those two times are the only thing the rehearsal didn't test. No releases to `main` after this; if one is unavoidable, tap **Rehearse now** before 22:00 server.
2. Saturday at `SNAPSHOT_BEFORE` server time (default 10:00): the next cron-job.org tick runs `before` within ~15 min and posts the event's one message in each channel (D31). Watch the Discord channel. On ⚠️/❌ (or nothing within 20 min — check the job's History on cron-job.org), open `/admin/runs` to see why, then press the **Before** seal on `/admin` or run Actions → tick → Run workflow with `phase=before`.
3. At `SNAPSHOT_AFTER` (default 14:00): the tick runs `after`, which edits the same messages in place (no notification); a `partial` or `failed` After also posts a new admin message. Same check. To move either time: edit the env var in Vercel, redeploy.
4. Note in-game when the KvK actually started and ended (server time). If `after` ran while it was still going, the delta is partial: move `SNAPSHOT_AFTER` past the end before next Saturday and write the window into §10 q6.
5. Done. Share the page.

## 8b. v2 (only after v1 has run for a few Saturdays) — natural-language questions over the history

**What it is:** "How many members did ABC have last Saturday?", "What was my might on Nov 8?", "Which alliance gained the most kills this month?". These are exact factual lookups over relational data. **This is not semantic search** — no embeddings, no vector DB. The right shape is *LLM → structured query → deterministic answer*.

**Design**
- A read-only Postgres view `v_history` that joins events, alliance_snapshots and member_snapshots into flat rows (`event_date, phase, tag, alliance_name, member_count, total_power, kills, uid, player_name, player_power, player_kills`).
- A DB role with `SELECT` on that view only. Hard limits: `statement_timeout = 5s`, `LIMIT 200` appended, reject anything that isn't a single `SELECT` (parse with `pgsql-ast-parser` or similar before executing).
- LLM call with a short schema description + 5 example question/SQL pairs. Model returns SQL. App runs it, then a second call (or a template) turns rows into one plain-English sentence. Always show the rows/table under the sentence so people can verify — the model can mis-join; the data can't lie.
- Simpler fallback worth trying first: 6–8 **query templates** (`alliance_at_date`, `player_at_date`, `alliance_delta_range`, `top_gainers`…) and ask the model only to pick the template and extract parameters (tag, date, player name). Less flexible, nearly impossible to get wrong, and tiny prompts.
- Player names: resolve via `ILIKE` against `member_snapshots.name` with a disambiguation list if several match.
- **Clarification turn is part of the model contract.** The model returns one of: `{ template, params }`, or `{ clarify: "Which alliance do you mean?" , options?: [...] }` when a required parameter is missing or ambiguous. The app never guesses a tag or a date. On Discord, the follow-up answer is matched to the pending question (per user, 5-minute window) and the merged params are re-validated deterministically before any query runs. "My alliance" resolves from the Discord user → `uid` → latest `member_snapshots` row; if no mapping exists, the bot asks once and stores it.

**Model:** any free-tier API with JSON output (e.g. Gemini free tier, Groq free tier hosting Llama/Kimi, OpenRouter free models). Pick by **verifying the current free limits at build time** — these change monthly. Volume is trivial (a few dozen questions/week). Keep the provider behind one small adapter so swapping costs nothing.

**Surface:** a Discord slash command (`/ask what was my might on nov 8`) is more useful than a web box — that is where the alliance already is, and Discord identity gives "my" for free (map Discord user → `uid` once). Web box optional.

**Guardrails:** rate-limit per user (e.g. 20/day) and a global daily cap; log every question + SQL + row count to a `ask_logs` table; no PIN needed if read-only on the view. The data contains no secrets, so prompt injection risk is limited to wasting the LLM quota, which the caps cover.

## 11. Codebase conventions and agentic harness

The codebase is maintained mostly by agents with a human reviewing. Every rule here exists to make the next session's diff small, predictable and checkable by a script. Where a "best practice" and "the simplest thing that works here" disagree, the simplest wins; the anti-over-engineering rule in `CLAUDE.md` is not decoration.

### 11.1 Architecture (one rule, one diagram)

```
app/api/*           thin HTTP handlers: auth → parse → call lib → respond. No logic.
app/(pages)/*       UI. Reads through lib/queries only.
lib/collector.ts    domain: runSnapshot, freshness check, per-alliance fallback, resume logic.
lib/compute.ts      pure functions only — sums, deltas, freshness predicate, roster diff; no IO, no Date.now() (passed in).
lib/sources/*.ts    adapters: v1.ts (documented API, primary), internal.ts (site API: ranks board + live-roster fallback, unofficial, read-only). One output type.
lib/repo/*.ts       persistence: one module per table, plain functions over Drizzle.
lib/queries/*.ts    read models for the UI (joins, sorting, name history). Never write.
lib/logger.ts, lib/notify.ts, lib/env.ts
config/alliances.ts
```

Dependency rule: `app → lib/{collector,queries,repo}`; `lib/collector → lib/{compute,sources,repo,logger,notify}` **through interfaces passed in** (`Deps = { v1, internal, repo, logger, notify, now }`); `lib/compute` imports nothing from the project. Nothing in `lib/` imports from `app/`. That is the whole architecture. No DI container, no base classes, no event bus, no generic repository: the one injection boundary is the collector's `Deps` object, because that is the only place tests need to swap implementations.

### 11.2 Code rules (enforced by tooling, not by memory)

- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; `unknown` at boundaries + narrowing.
- Boundaries validated with zod: `lib/env.ts` (fail fast at startup), upstream responses (`lib/sources/v1.ts` and `internal.ts` parse into typed objects; `raw_json` stores the trimmed response, §6), route bodies.
- Errors are classes (`QuotaExhaustedError` etc.); callers match on `instanceof`, never on message strings.
- Pure logic (budget math, delta computation, roster diff) lives in functions with no IO and is tested directly. IO lives at the edges.
- Limits via ESLint, chosen for what they measure: files ≤ 300 lines (a file the agent can read whole), functions ≤ 80 lines (long-but-linear code — an orchestrator, a JSX tree — is fine; splitting it to please a counter adds indirection, which is worse for a reader and for a model), cyclomatic complexity ≤ 12 and nesting ≤ 3 (tangling is what actually hurts; these bind on it). Tests are exempt from the function limit (a `describe` is N cases, not one function). Exceeding one is a signal to split along the architecture, not a reason to disable the rule.
- The dependency rule in docs/ARCHITECTURE.md is **linted**, not remembered: `import-x/no-restricted-paths` zones — `lib/compute`, `lib/budget`, `lib/schedule` import nothing from the project; nothing under `lib/` imports `app/`; `app/` never imports `lib/sources` or `lib/repo` directly (routes go through `lib/run`/`lib/queries`). Added in Session 4 with a test that a forbidden import fails lint.
- Names: **LAP** = Last Asylum Plague, the game (its key prefix is `lap_`); **the tracker** = lastasylumtracker.com, the third-party site and API we read; **LAPTracker** = this project. Never "LAT".
- Naming follows `docs/GLOSSARY.md`: *might* (UI word) = `total_power` (API/DB word); *kills* = `total_kills` (roster sum) vs *board kills* = `kills_board`; *snapshot*, *phase*, *fresh*, *partial*, *stale*, *source* (`v1` | `internal`); *identity* = `union_id` / `uid`, *name* and *tag* are labels with a history. One name per concept, both in code and in prose, so an agent can grep.
- Comments explain *why* (a quota rule, an upstream quirk), never *what*. Each invariant from §3.4, §3.7 and the "Logging guarantees" is referenced by name in a comment next to the code that enforces it, e.g. `// INVARIANT budget.reserve-for-after`.
- Formatting: Prettier, no debate. Imports: ESLint `import-x/order` (eslint-plugin-import-x; Session 1, DECISIONS D9). Commit messages: conventional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

### 11.3 Tests as the spec

| Tier | What | Runs where |
|---|---|---|
| Unit | `lib/compute`, both adapters' parsers; **property-based tests** (fast-check): for any roster, `total_kills == sum(members.kills)` and the delta of two snapshots equals the sum of member deltas plus joined minus left | every commit |
| Integration | collector against a mocked client (fixture bodies) + real local Postgres (`service postgresql start` in cloud sessions; docker/`DATABASE_URL` locally) | every commit |
| Route | handlers with the collector mocked: auth, lock, shutdown-in-finally | every commit |
| Live smoke | one `/v1/alliances/{id}` read (FGH), opt-in `LAP_LIVE_TEST=1`, 1 call | manual |
| Dry run | Phase 7 | once, then after any change to collector/client |

`fixtures/` is the contract with the upstream API. `fixtures/README.md` says when each was recorded and how many calls recording costs; adding a fixture is a deliberate act (the `record-fixture` skill), never a side effect of a test. No numeric coverage threshold — the rule is simpler: a change to `lib/compute.ts`, `lib/collector.ts` or `lib/sources/*` ships with a test, enforced by the collector rules file and by review, not by a percentage. Tests are named as sentences describing the invariant: `it("marks the snapshot partial when any roster is older than 20 minutes")`.

### 11.4 Deterministic gates

- `pnpm check` = `prettier --check && eslint && tsc --noEmit && vitest run`. Everything below calls this.
- Pre-commit (lefthook): prettier + eslint on staged files, `gitleaks git --pre-commit --staged` (gitleaks 8.x syntax; `protect` is gone) with a custom `lap_` rule in `.gitleaks.toml`. The secrets scan is the reason the hook exists — public repo. No pre-push hook: CI and the Stop hook already run `check`.
- `.github/workflows/ci.yml`: `pnpm/action-setup` (pinned SHA, version from `packageManager`) → `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm` → `pnpm install --frozen-lockfile && pnpm check` on push and PR.
- Claude Code hooks in `.claude/settings.json` (committed, so they run in cloud sessions too):
  - `PostToolUse` on `Edit|Write` → `eslint --fix` on the changed file (fast; errors go straight back to the agent). `tsc` runs in the Stop hook, not per edit, unless it proves fast enough.
  - `Stop` → `pnpm check`; blocks the turn from ending while it fails (bounded by Claude Code's block cap).
  - `SessionStart` → `scripts/install_pkgs.sh` (`pnpm install --frozen-lockfile` when the lockfile hash changed; cloud-aware).
  - Permissions: allow `pnpm *`, `git commit`, `git push origin main`, `curl`, `gh api`, `gh workflow *`; deny `rm -rf *`, `git push --force*`, `git reset --hard*`, `pnpm drizzle-kit drop*`.

### 11.5 The harness in `.claude/` — the minimum that pays per session

```
CLAUDE.md                      ≤ 40 lines: stack, commands, the rules block, "architecture: docs/ARCHITECTURE.md; words: docs/GLOSSARY.md"
.claude/settings.json          hooks + permissions above
.claude/rules/
  collector.md                 paths: lib/collector.ts, lib/compute.ts, lib/sources/** — the §3.4/§3.7 invariants as a checklist; "a change here ships with a test"; "internal.ts is unofficial and read-only: never add a refresh call, never widen its use without a DECISIONS entry"
  api-routes.md                paths: app/api/** — handler shape, auth, shutdown-in-finally, never log secrets
  tests.md                     paths: **/*.test.ts — naming, no live calls, fixtures policy
.claude/skills/
  record-fixture/SKILL.md      the one procedure with a side effect (spends quota): confirm cost, call, save raw, update fixtures/README.md
REVIEW.md                      the Session 5 invariant checklist; the built-in /code-review reads it, so no custom reviewer agent
docs/
  ARCHITECTURE.md              §11.1 as-is plus the Deps interface in TypeScript; one page
  GLOSSARY.md                  one line per domain term, UI word ↔ code word
  DECISIONS.md                 one paragraph per decision from §3.x, dated, append-only; a reversal is a new entry that names the one it supersedes.
                               One file, not an ADR folder: at ~10–15 decisions a single grep-able file beats N files plus an index. Its header says so and sets the trigger to split (> ~25 entries, or decisions proposed by people other than the owner via PR).
  handoff/                     per-session handoffs
```

Rules are path-scoped so they load only when the agent touches those files; CLAUDE.md stays short. UI conventions (reads via `lib/queries`, mobile-first at 360 px, no charts) are one line in CLAUDE.md, not a rules file. "Verify a snapshot" is `pnpm snapshot:dry`, "pre-release" is a README checklist — neither needs a skill.

### 11.6 Source control, PRs, releases — two branches, not git-flow
`dev` is where work lands; `main` is production. Feature branches are squash-merged into `dev` through PRs; a release is one PR `dev → main`, merged with a merge commit; Vercel deploys production from `main`. No `release/*` or `hotfix/*` branches, no back-merges: `main` is written only by `dev → main` PRs, so `dev` always contains `main`.

- **Branches:** `session/NN-<slug>` for playbook sessions (`session/03-collector`), `fix/<slug>` and `chore/<slug>` otherwise — all cut from `dev`, all PRs **based on `dev`**. Deleted on merge (repo setting). `main` is the default branch (GitHub runs `schedule` workflows from the default branch, and production code is what a visitor should see first), so every PR names its base explicitly.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), English, imperative, one concern per commit. The PR title follows the same format because the squash commit on `dev` is the PR title + body.
- **PRs into `dev`:** every session ends by pushing its branch and opening a PR whose title is the string in its `<done_when>`; the handoff's last line is the PR URL. The PR body is the handoff's `## Built` + `## Verified` sections, so the diff can be reviewed from a phone with the evidence next to it. **The owner merges** (squash); sessions never merge their own PR. The next session starts from the merged `dev`. Exception: Dependabot minor/patch PRs (targeting `dev`) auto-merge on green CI (`dependabot-automerge.yml`); majors wait for a human.
- **Release = PR `dev → main`,** titled `release: vX.Y.Z` with the GitHub-generated notes as the body, merged with a **merge commit** (never squash or rebase: both rewrite the commits and make the next `dev → main` PR re-show everything already shipped). Vercel deploys production from `main` on that merge and runs `pnpm db:migrate` in its build. As shipped (D29, README "Deploy and operate" → "How to cut a release"): Actions → **Prepare release** (`workflow_dispatch`, input `bump`: patch, minor or major) opens that PR with the generated notes; the owner merges it by hand; `release-publish` (on push to `main`) then creates the tag and the GitHub Release. The tag is the version and the notes are the changelog; no CHANGELOG file. The next version is the latest `v*` tag plus the bump; `package.json` `version` is not read or bumped. `gh release create vX.Y.Z --target main --generate-notes` is only the fallback when the tag does not appear. `v0.1.0` = the first promotion (Session 8), `v1.0.0` = the promotion after the dry run reconciles (Session 9).
- **Rulesets (no bypass actors on either):** `main` — require a PR (0 approvals), require the `check` status, block force-pushes, restrict deletions, allowed merge method **merge** only. `dev` — require a PR, require `check`, block force-pushes, restrict deletions, require linear history, allowed merge method **squash** only. Repo settings: merge commits and squash enabled (rebase off), squash message = PR title and description, auto-delete head branches, allow auto-merge. The per-branch merge-method rules are what stop a wrong click from squashing a release or merge-committing a feature.
- **Keepalive:** with no bypass, the keepalive cannot commit to `dev` or `main`; it pushes to a `keepalive` branch (Phase 6). GitHub's rule is "no repository activity in 60 days"; weekly Dependabot PRs are activity too. The Friday Discord message is the detector if that assumption ever fails.
- **Deploys:** Vercel's defaults — production branch `main`, every other branch a preview. `dev` therefore has a stable preview URL (`laptracker-git-dev-<team>.vercel.app`) that is **staging**: what the alliance can look at before a release. Preview deployments (`dev` and PRs) get **Preview-scoped** env vars: `DATABASE_URL` → a Neon `preview` branch (seeded with `pnpm db:seed`, reset from production data when wanted), their own `CRON_SECRET`/`EDIT_PIN`, no `NOTIFY_*` (a preview never posts to Discord), and Vercel Deployment Protection (Vercel Authentication) so no preview URL is a public copy. The tick only ever calls `APP_URL` = the production domain. **Rollback:** Vercel *Instant Rollback* for the immediate case (Hobby: one deployment back), otherwise a revert PR into `dev` and a new release; `main` is never force-pushed.
- **Hotfix:** same path, shorter — `fix/<slug>` → PR into `dev` → release PR `dev → main`. The only cost is that whatever else sits in `dev` ships with it, which is the point of keeping `dev` always releasable (CI green, nothing half-done merged).
- **Cloud sessions:** `gh pr create` is GraphQL and is rejected there (§A2 of the playbook); the REST call works: `gh api repos/{owner}/{repo}/pulls -f title=... -f head=... -f base=dev -F body=@docs/handoff/NN-*.md`. Locally `gh pr create --base dev --fill` is fine. `gh release create` is REST and works in both.

### 11.7 Evals

For this app, "evals" are three things, in order of value:
1. The **property-based compute tests** and the freshness tests (11.3) — the executable statement of the two guarantees that matter: numbers add up, and stale data is never reported as a delta.
2. The **dry run** (Phase 7) — re-run after any change to `lib/collector.ts` or `lib/sources/*`; the numbers table in `docs/handoff/09-dryrun.md` is the baseline.
3. **`/code-review` against `REVIEW.md`** on every change that touches `lib/` — a fresh context checking invariants, not the author grading itself.

Skill-level evals (`claude plugin eval`) are not worth it at this size.

### 11.8 What this deliberately does not include

Clean-architecture folder trees (`domain/application/infrastructure`), repository interfaces per table, custom error hierarchies beyond the four classes, a custom reviewer agent, more than one skill, numeric coverage gates, a plugin for the harness, monorepo tooling, Storybook, E2E browser tests for v1. Each would add surface for the agent to misread without changing what Saturday needs. If a later session proposes adding one of these, the handoff must say which concrete failure it would have prevented.

## 12. Security — proportional to what we hold

What we hold: one third-party API key, one shared PIN, one scheduler secret, Discord webhook URLs, and snapshots of ~2,000 players' public game stats. Our `/v1` reads can trigger pulls on the maintainer's side, which is a reason to keep them to ~40 a day and never retry in a tight loop. The game data is already public on the tracker site; the things worth protecting are the secrets, the quota, and the few roster fields that describe a person's *behaviour* rather than their stats.

### 12.1 Data we store but never serve
The alliance roster includes `x`, `y` (map coordinates), `online`, `last_online_at`, `joined_at`, `active`, `daily_honor`, `daily_tech` (`avatar_url`, `frame_url` are trimmed before storage, §6). We keep the rest in `raw_json` so history can be recomputed, and **nothing reads them out**: not `lib/queries`, not any route, not the UI, not `run_logs`, not Discord. The read models expose only: alliance name/tag/union_id/member_count/total_power/total_kills/board numbers/freshness, member name/uid/power/lv/kills. A test asserts that `GET /api/events/[id]` responses contain none of the blocked keys. If v2 ever wants roster churn by timestamp, it reads `joined_at` server-side and returns a boolean. The player pages (Phase 5d) follow the same list: stats and names only.

### 12.2 Secrets
- Secrets reach the app only via environment variables (Vercel) or network secrets (cloud sessions). Never in code, fixtures, logs, Discord messages, responses or commit history. `gitleaks` in pre-commit and GitHub push protection are the two automated checks; `lib/logger.ts` redacts `Authorization`, `x-edit-pin`, and any value equal to a known secret before emitting.
- `CRON_SECRET` and `EDIT_PIN` are compared with `crypto.timingSafeEqual`, never `===`.
- PIN brute force is the one realistic attack, so the limiter is **in Postgres, not in memory**: on Vercel every function instance has its own module scope and cold starts reset it, so an in-memory counter is only a limit per instance per warm period. One table, `auth_attempts(key text pk, count int, window_start timestamptz)`, one upsert per failed attempt; keys are `ip:<addr>` and `global`. Rules: 5 failures per IP per 15 min → 429; 20 failures from any IP in an hour → PIN auth disabled until the window passes, admin webhook fires once. The global lockout disables **PIN auth only**: `CRON_SECRET` failures are counted per IP but the tick is never locked out, so a PIN flood can't stop the scheduled snapshots, and during a lockout the owner still has `workflow_dispatch` on GitHub. A correct PIN resets the IP counter. `EDIT_PIN` is 6–8 digits: with 6 digits and 5 tries per 15 min, exhausting the space takes decades per IP, and the global lockout stops a distributed attempt at 20.
- The API key is used only by `lib/sources/v1.ts`. The quota endpoint proxy (`GET /api/quota`) returns numbers, never the key.
- Rotation is documented in the README (Session 8): revoke on the tracker's panel, replace the env var, redeploy. Same for the PIN.
- `/admin` is unlinked and `noindex`, but that is hygiene: it is protected by the PIN gate and rate limit like every write route, and it never renders a secret.

### 12.3 Input and output
- Every request body and query string is parsed with zod before use; unknown fields rejected. Drizzle only — no string-built SQL.
- Responses never include stack traces or internal error messages; the one-line `error` fields in the DB are written by our code, not from `err.message` of third-party errors.
- No `dangerouslySetInnerHTML`; player and alliance names are rendered as text. They come from an external API and must be treated as untrusted (a player named `<script>` is a Tuesday).
- Security headers set in `next.config` (`Content-Security-Policy` without `unsafe-inline` for scripts, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). The CSP is the reason the brand ornaments are React components, not inline SVG strings with scripts.
- Discord messages contain alliance tags, counts and a link — never member names, never numbers that identify a person.

### 12.4 Dependencies and supply chain
- Policy: few dependencies, each actively maintained, each pinned by the lockfile. Prefer the platform (`fetch`, `crypto`, `URL`) over a package. New dependency = a line in `docs/DECISIONS.md` saying why the platform wasn't enough.
- `pnpm install --frozen-lockfile` only in CI and hooks. `pnpm audit --audit-level high` runs in CI and fails the build; a finding that can't be fixed within a week gets a dated exception in `DECISIONS.md`, not a silent `--omit`.
- Dependabot enabled for the npm ecosystem (it covers pnpm lockfiles) and GitHub Actions, weekly, grouped minor/patch; majors handled by a session reading the changelog first.
- GitHub Actions pinned to commit SHAs, `permissions:` set to the minimum per workflow (`contents: read` for CI and snapshots, `contents: write` only for keepalive).
- Node **26** (Active LTS since Oct 2026; Vercel default `26.x`; 24/22 are Maintenance). `.nvmrc` holds the major only (`26`): nvm, fnm, asdf and `actions/setup-node` all resolve it to the newest installed/available 26.x, which is the same policy Vercel applies (majors pinned, patches rolled by the platform), so local, CI and production track the same line without a monthly bump. `engines.node: "26.x"` — Vercel maps it to the latest 26.x and, unlike an open range (`>=22`), never auto-upgrades the production runtime to a future major (Vercel warns about exactly that). Claude cloud sessions on Node 22 still install because `.npmrc` has `engine-strict=false` (a warning, not a failure) and the setup script installs 26 anyway. CI runs on `.nvmrc`, so 26.x is what gates every merge. One file, no `.node-version` duplicate. Next.js stable channel. No pre-release packages.
- Node 26's `fetch` negotiates HTTP/2 and leaves `response.statusText` empty: adapters branch on `response.status` only. `VERCEL_FETCH_DISABLE_H2=1` is the documented opt-out if the upstream misbehaves over h2 (Session 9 checks the dry-run logs for it).
- **pnpm 12**, pinned with `"packageManager": "pnpm@12.x.y"` in package.json (pnpm self-selects the pinned version). Vercel: `ENABLE_EXPERIMENTAL_COREPACK=1` env var so the build honours `packageManager`; Session 8 confirms the pnpm version in the build log. `pnpm install --frozen-lockfile` everywhere but a developer's first install.
- No Dockerfile: nothing in this project builds or runs from one — Vercel builds from the repo, GitHub Actions uses `setup-node`, Claude cloud sessions use Anthropic's VM. A container would be a fourth environment to keep in sync. Reproducibility comes from `.nvmrc` + `packageManager` + the lockfile.
- Before adding any package: check last release date, open-issue response, and whether it runs install scripts (`pnpm view <pkg> scripts`). A package with a `postinstall` that downloads binaries needs a reason.

### 12.5 Platform
- Vercel: env vars marked sensitive and scoped — Production values never reach Preview (§11.6: preview DB branch, own secrets, no webhooks); previews behind Vercel Deployment Protection. Function logs contain no secrets by construction (12.2).
- Neon: v1 runs migrations with the integration's role at build time (§3.2); a separate least-privilege role for the app is v2 — with one deployable and no user data it buys nothing yet.
- `run_logs` / `app_errors`: carry `union_id`, `uid`, counts and codes — no names, no secrets (the logger passes every `data` object through `lib/redact.ts`).
- GitHub: public repo; `main` and `dev` rulesets per §11.6 (PR + `check` + no force-push, no bypass actors, including for the Claude GitHub App — sessions push branches); secret scanning + push protection on; Dependabot alerts on; Actions `permissions` minimal per workflow.

### 12.6 What we don't do, and why
No user accounts, no OAuth, no per-user permissions: a shared PIN plus rate limiting is proportional to a guild tool whose worst case is a vandalised kill count. No WAF, no secrets manager, no SOC2 theatre. If the alliance ever stores anything private (Discord IDs for `/ask` in v2 is the first candidate), §12.1 gets a new row and §12.2 gets a real auth story.

## 9. Out of scope for v1 (do not build unless asked)

**Tracking:** every post-v1 item below, every deferred finding from the handoffs and every open decision is a GitHub issue labelled `roadmap` with a milestone (`v1.0 — first Saturday`, `v1.1 — after the first Saturday`, `v2 — after a few Saturdays of data`): https://github.com/daniro-san/LAPTracker/issues?q=label%3Aroadmap. The issue tracks; this document specifies. A PR that finishes an item says `Closes #N`.


- **Translation (i18n)**: after Phase 8. Prepared for now by `lib/copy.ts` (every string, stable keys) and `Intl` formatting; the later work is a dictionary per language and a switcher, not a refactor. Languages first in line: ru, es, pt-BR.
- Multiple servers / multiple events on one page
- Charts / sparklines (the across-events tables in Phase 5e carry the data; a line chart is a v2 layer on top)
- Natural-language questions (§8b) — v2, after real data exists
- Data pruning — never delete snapshots
- Real authentication
- Auto-discovery of the top 20 from the ranks board at run time (the list is config so before/after stay comparable; re-seeding it is a config change)

## 10b. As shipped — corrections the sessions reported (Sessions 3–5b, 2026-11-04)
Where the text above and the code disagree, the code is right and this list says how. Each item names the handoff that found it. Sections are not rewritten retroactively; a session that reads a section listed here reads this list too.

- **§3.1 manual fallback** (05b): "Run BEFORE/AFTER now" is allowed only at or after the event's `before_at`; an earlier press answers `409 snapshot_not_due`.
- **§3.1 verdict, quota line** (04): the drop is `first − last + 1` (the first response counts itself). (05, N1): if the run's last `/v1` attempts all fail and the internal fallback fills the row, those attempts carry no quota object and the line can read `calls_used ≠ drop` on a run that was fine; the verdict says "n `/v1` attempts returned no quota" when `run_logs` has a `v1.fetch` warn for the run. Rare; an exact count needs a column.
- **§3.4 / Phase 3** (05b): AFTER on an event with no alliance list fails with "no alliance list on the event: BEFORE has not run" and makes no quota call. (03): the run claim happens before the quota call; `force` clears the rows (D18). An abort at `MAX_UPSTREAM_CALLS` is `failed`; a `429` mid-run is `partial` — the code follows the more specific section in each case.
- **§4 / Phase 4** (04): the quota routes are authenticated like the others.
- **§6** (03, 04): nullable as shipped — `alliance_snapshots.{tag,name,member_count,total_power,total_kills,raw_json}` on error rows, `member_snapshots.{power,kills}` (D15). Added: `events.unique(event_at_utc)`, `events.quota_checked_at`, `snapshots.quota_remaining_before`, and a `rehearsal_slots` table (the weekly `REHEARSAL_AT` bookkeeping).
- **Phase 6 partial template** (05, N11 / 05b): alliances with no row at all are listed under `failed` as "not fetched: …", not as "came back with old data".
- **Phase 6 observability, alert cadence** (05, N2): as shipped, the app-error alert fires after an hour *without* errors, not once per hour of continuing errors, and two instances can post at once. Accepted for v1; the fix is a claimed alert row like `claimQuotaCheck`.
- **Phase 6 logging guarantees** (04): `RunLogger.shutdown()` exists but only awaits in-flight inserts; nothing is buffered. The "no flush" wording meant "no buffered transport".
- **§11.3 integration tier** (03, 04): PGlite in tests, not the in-memory Repo.
- **§11.2 dependency-rule lint** (owner): the `import-x/no-restricted-paths` zones were scheduled for Session 4 after it had started; they move to Session 8.
- **§12.2 client IP** (05, N10): whether a client can spoof `x-real-ip` on Vercel is unverified; the per-IP limit may be weaker than stated, the global 20/h lockout is not. Session 8 checks.

### Sessions 6–8 (2026-11-05): sections rewritten in place under #118
The one exception to "Sections are not rewritten retroactively": the owner allowed issue #118 (decision comment of 2026-11-05) to rewrite these sections in place, because people follow them on Friday and Saturday. Each item names the handoff that found the change; the section itself now says what shipped.

- **§3.1 scheduler** (08f, 08): cron-job.org is the scheduler, `tick.yml` the manual and second path at minutes 7/22/37/52 (D26, D30 (cron-job.org)). Same text in Phase 6 and Phase 8.
- **§3.1 verdict, Phase 6 test events, Phase 7, Phase 8 runbook** (07f-discord-templates, 08o, 07d): `[rehearsal]` prefix, `✓ Pass` / `✗ Fail`, one admin message per event edited in place (D31).
- **Phase 6 Discord payload** (07f-discord-templates, 07d, 08b): no `username` or `avatar_url` override.
- **§5 and Phase 6 observability** (08zd): Vercel Web Analytics and Speed Insights on production (D36).
- **§11.6 releases** (08j): Prepare release and release-publish (D29, README "Deploy and operate").
- **Phase 5 Routes header and cards** (07b, 07d, 08q): status chips `Last updated` / `Next update` in server time, quota only on `/admin`; order by ledger rank; Details panel; no "Game board" section; the kills member-loss note in Details and the `*` mark (D33).
- **Phase 5c member filters** (07f-alliance-page): sort chips and a two-thumb might range replace the two free-text might inputs and the sort select.
- **Phase 5e `B` mark** (07d): replaced by the row's server time.
- **Phase 5f blank dictionary** (07b, 07c): the four game terms stay readable (D23).
- **Playbook** (same handoffs): Session 4 task 3c and its `/admin` line, Session 8 tasks 3 and 4, Session 9 task 1 and `<done_when>`, and "How to use" item 8.

## 10. Open questions for the owner (answer before Phase 1)
1. ~~Server number and alliances~~ — answered: 325, §7 list from the board; Session 0 verifies the ids.
2. ~~Game server timezone~~ — answered: UTC−2 fixed, `Etc/GMT+2` (2026-11-04).
3. ~~API key~~ — answered: exists.
4. ~~Lost-power breakdown~~ — answered 2026-11-04: no per-member breakdown; the card shows members ↑↓ with `+joined/−left`, might ↑↓ with %, kills with % and a member-loss note when negative (Phase 5).
5. ~~Maintainer~~ — notified 2026-11-04.
6. ~~Event window~~ — deferred by the owner 2026-11-04: ship with `SNAPSHOT_BEFORE=10:00` / `SNAPSHOT_AFTER=14:00`; the real window is unconfirmed, so the first real Saturday (Phase 8 runbook) is also the measurement — if the AFTER lands mid-event, move the env var and redeploy, no code change.
