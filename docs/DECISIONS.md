# Decisions

One paragraph per decision, dated, **append-only**. A reversal is a new entry that names the one it supersedes; old entries are never edited.

Why one file, not an ADR folder: at ~10–15 decisions, a single file you can grep beats N files plus an index. Split into `docs/decisions/` when this file passes ~25 entries, or when people other than the owner start proposing decisions via PR.

---

## D1 — Scheduling: a dumb tick from GitHub Actions, times in env vars (2026-11-04, plan §3.1)

Vercel Hobby cron fires once a day at an imprecise minute, so it can't hit a 10:00 snapshot. GitHub Actions runs `*/15 * * * 5,6,0` and POSTs `/api/tick` with `CRON_SECRET`; the app decides whether a phase is due from `SNAPSHOT_BEFORE`/`SNAPSHOT_AFTER`/`SNAPSHOT_WINDOW_MIN` in `SERVER_TZ`, so the owner moves times in Vercel without a commit. `unique (event_id, phase)` plus the run lock make a double tick harmless. A monthly keepalive commit stops GitHub from disabling the schedule. Precision is ~0–35 min, fine with hours of margin. The manual fallback is "Run now" on `/admin` and `workflow_dispatch`.

## D2 — Persistence: Neon Postgres + Drizzle, keep everything forever (2026-11-04, plan §3.2)

Permanent history is a requirement. Neon's free tier scales to zero and keeps data. Supabase's free tier pauses after ~7 days idle, which is a real risk for a once-a-week app. SQLite is out because Vercel's filesystem is ephemeral, and KV/Blob don't fit relational row edits. Raw upstream responses (trimmed of bulk and free text) are stored in `raw_json` so formulas can be recomputed without spending quota. Volume is ~15–45 MB/year against Neon's 1 GB.

## D3 — Edit protection: one shared PIN (2026-11-04, plan §3.3, §12.2)

The only write action exposed to people is "Run snapshot now", gated by `EDIT_PIN` (6–8 digits), compared with `timingSafeEqual` and rate-limited in Postgres (5 per IP per 15 min, 20 global per hour disables PIN auth only). This isn't real auth, and it's proportional to a guild tool whose worst case is a wasted run.

## D4 — Which alliances: all 20, by union_id, fixed per event (2026-11-04, plan §3.4)

`config/alliances.ts` lists 20 alliances by `union_id`, because tags are case-sensitive, collide and change. The BEFORE run copies the list onto the event, and the AFTER run uses that copy, so a config change mid-Saturday can't make the phases incomparable. Quota rule: a run starts only if `remaining >= 2 × (alliances + 5)` (`lib/budget.ts: requiredQuota`).

## D5 — Data sources: /v1 is the product; the internal API is optional garnish (2026-11-04, plan §3.5)

The documented `GET /v1/alliances/{id}` is the only required source; it refreshes on read. The site's internal API is used read-only for the ranks board (cross-check, 0 quota) and as a per-alliance fallback that accepts only `live: true` rosters, recorded as `source = internal`. The site's refresh endpoint is closed to outsiders on purpose; we never call it or imitate the site's headers. No number in a delta depends on an undocumented endpoint. One API key, no pooling.

## D6 — Run duration: maxDuration 120 s (2026-11-04, plan §3.6)

Measured ~2.4 s per `/v1` read that pulls; 20 alliances at concurrency 4 ≈ 15 s, and 503 retries could double that. `maxDuration = 120` leaves margin. Re-measure in the dry run (Session 9).

## D7 — Dependency policy and the initial set (2026-11-04, plan §12.4, Session 1)

Few dependencies, each maintained, pinned exactly in package.json and by the lockfile. Before adding a package, check its last publish date and its install scripts (`pnpm view <pkg> time.modified scripts`). Measured 2026-11-04. "Install scripts" means `preinstall`/`install`/`postinstall`; build and test scripts in a package's own repo don't run on install.

| Package                                                          | Version | Last modified           | Install scripts                                                                                                                                                                   | Why the platform isn't enough                              |
| ---------------------------------------------------------------- | ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| next                                                             | 16.4.5  | 2026-11-03              | none                                                                                                                                                                              | App Router framework, plan §5                              |
| react, react-dom                                                 | 19.3.1  | 2026-10-31              | none                                                                                                                                                                              | Next peer                                                  |
| drizzle-orm                                                      | 0.45.4  | 2026-10-21              | none                                                                                                                                                                              | typed SQL without string building (§12.3)                  |
| @neondatabase/serverless                                         | 1.2.0   | 2026-10-01              | none                                                                                                                                                                              | Neon HTTP driver; TCP 5432 isn't proxied in cloud sessions |
| zod                                                              | 4.6.7   | 2026-10-12              | none                                                                                                                                                                              | boundary validation (env, upstream, route bodies)          |
| typescript                                                       | 6.0.3   | 2026-11-04              | none                                                                                                                                                                              | see D8                                                     |
| @types/node 26.6.6, @types/react 19.3.0, @types/react-dom 19.3.0 | —       | 2026-10-28 / 2026-10-04 | none                                                                                                                                                                              | types                                                      |
| tailwindcss, @tailwindcss/postcss                                | 4.3.4   | 2026-11-04              | none                                                                                                                                                                              | plan §5                                                    |
| postcss                                                          | 8.5.32  | 2026-10-26              | none                                                                                                                                                                              | Tailwind 4's Next integration                              |
| vitest                                                           | 5.1.0   | 2026-11-02              | none                                                                                                                                                                              | plan §5                                                    |
| fast-check                                                       | 4.10.2  | 2026-09-19              | none                                                                                                                                                                              | property tests, plan §11.3                                 |
| drizzle-kit                                                      | 0.31.11 | 2026-10-21              | none (its deps esbuild 0.18/0.25 have postinstall, denied — D10)                                                                                                                  | migrations / `db:push`                                     |
| eslint                                                           | 10.14.0 | 2026-10-30              | none                                                                                                                                                                              | lint gates §11.2                                           |
| @eslint/js                                                       | 10.0.1  | 2026-07-10              | none                                                                                                                                                                              | ESLint's recommended set                                   |
| typescript-eslint                                                | 8.72.1  | 2026-11-02              | none                                                                                                                                                                              | `strict` config                                            |
| eslint-plugin-import-x                                           | 4.17.1  | 2026-06-28              | none                                                                                                                                                                              | `import-x/order` — see D9                                  |
| prettier                                                         | 3.9.10  | 2026-10-10              | none                                                                                                                                                                              | formatting                                                 |
| lefthook                                                         | 2.2.2   | 2026-10-13              | **postinstall** (`node postinstall.js`, runs `lefthook install`; the binary comes from an npm optional dependency, not a download) — denied, the `prepare` script does it instead | pre-commit runner, plan §11.4                              |

Not packages, installed by `scripts/cloud-setup.sh`: Node 26 (nodejs.org tarball, SHA-256 checked against SHASUMS256.txt) and gitleaks v8.30.1 (`go install` via proxy.golang.org, because GitHub release downloads are blocked in cloud sessions).

## D8 — TypeScript 6.0, not 7.0 (2026-11-04, Session 1)

`typescript@latest` is 7.0.2 (the native port), but typescript-eslint 8.72.1 declares `typescript >=4.8.4 <6.1.0`. Pinned to 6.0.3. Revisit when typescript-eslint supports 7.x; Dependabot will offer it as a major, handled by a session that reads the changelog.

## D9 — eslint-plugin-import-x instead of eslint-plugin-import (2026-11-04, Session 1)

The plan asks for `import/order`. eslint-plugin-import was last published 2025-06-20 (more than a year ago) and its peer range stops at ESLint 9; we run ESLint 10. eslint-plugin-import-x (2026-06-28, peers include ESLint 10) is the maintained fork with the same `order` rule, used as `import-x/order`.

## D10 — Install scripts denied by default (2026-11-04, Session 1)

pnpm 12 fails an install that has unapproved build scripts. `pnpm-workspace.yaml` denies each one explicitly (`allowBuilds: false`): esbuild's postinstall only verifies the platform binary that pnpm already installs as an optional dependency, and lefthook's runs `lefthook install`, which the `prepare` script does. A package added later that needs its install script must get its own entry here.

## D11 — CSP with a per-request nonce in proxy.ts (2026-11-04, Session 1, plan §12.3)

Next.js injects inline bootstrap scripts, so a static CSP without `'unsafe-inline'` for scripts breaks hydration. `proxy.ts` (Next 16's name for middleware) generates a nonce per request and sets `script-src 'self' 'nonce-…' 'strict-dynamic'` (plus `'unsafe-eval'` in dev only). The root layout calls `connection()`, so pages render per request and receive the nonce. That fits the plan's server-rendered pages, at the cost of no static caching of HTML. Styles keep `'unsafe-inline'` (the plan restricts scripts only). The other headers are static in `next.config.ts`; API routes get `default-src 'none'`.

## D12 — gitleaks: `gitleaks git --pre-commit --staged`, plus a lap_ rule (2026-11-04, Session 1)

`gitleaks protect` is hidden/deprecated in v8.30 in favour of `gitleaks git --pre-commit --staged`, which is what lefthook runs. The default rules don't know the LAP key format, so `.gitleaks.toml` extends them with `lap_[A-Za-z0-9]{20,}`. Placeholders (`lap_...`, `lap_cloud-placeholder`) don't match.

## D13 — Planning docs live in docs/ (2026-11-04, Session 1, owner request)

IMPLEMENTATION_PLAN.md, SESSION_PLAYBOOK.md and PREREQUISITES.md moved from the repo root to `docs/` (git mv, history kept). Their internal path references were updated, and nothing else in them changed. The root keeps only files that tools or people look for there: README.md, CLAUDE.md, REVIEW.md.

## D14 — Tests may exceed max-lines-per-function (2026-11-04, Session 1)

ESLint counts a `describe(() => { ... })` callback as one function, so any test file with more than a few cases trips the 50-line limit, even though each `it` is small. The rule is turned off for `**/*.test.ts` in eslint.config.mjs instead of adding disable comments. `max-lines` (300) still applies to tests.

## D15 — A null member `kills` or `power` stays null and sums as 0 (2026-11-04, Session 2, plan Phase 2)

`/v1` sends `kills: null` for some members: one in AFR (`fixtures/v1-ids/67111040.json`) and two in FGH (`fixtures/v1-ids/67111128.json`). The adapters keep `null` on the member row, so "unknown" is not stored as "zero kills", and `sumKills` (lib/compute.ts) counts it as 0, so `total_kills` is still a number. The UI shows `—` for that member. `power` gets the same rule, although no fixture has a null `power` yet. Cost: an alliance total can rise between BEFORE and AFTER only because a member's `kills` went from `null` to a value. That is a real but rare distortion. Marking the whole row unusable over one member would lose the alliance instead.

## D16 — Source adapter details the plan left open (2026-11-04, Session 2)

- **Retry delays:** 1 s, 2 s, 4 s plus 0–250 ms of random jitter. A numeric `Retry-After` replaces the backoff and is clamped to 30 s, so one header cannot push a run past `maxDuration = 120`. An HTTP-date `Retry-After` falls back to the backoff.
- **Timeouts** (30 s, `AbortSignal.timeout`) are not retried. A timed-out read may still have used quota, and the collector's per-alliance fallback is the next step anyway. Other non-2xx statuses (401, 403, 409, 500) throw `UpstreamError` with the status and are not retried.
- **Concurrency 4** is a module-level cap on in-flight `/v1` requests, across every caller in the process. A request waiting out a retry delay does not hold a slot.
- **The internal adapter never retries.** It is best-effort, and the collector decides what a failure means.
- **`RanksBoard.pulledAt`** is the older of the `alliance_power` and `alliance_kills` boards' `pulled_at`; they are written ~10 ms apart.
- **Schema failures** throw `SchemaError` with `code` `v1.schema` or `internal.schema`, and the zod issue paths only. A path never carries a value, so the error can be logged as is. A non-JSON body is a schema failure too.
- **`lib/env.ts` `getSourceEnv()`** validates only `LAP_API_KEY`, `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL`. The adapters use it, so the live smoke test runs without the database and schedule variables. `instrumentation.ts` still validates the full set at server start.
- **The output type adds `totalKills` and `quota`** to the plan's `AllianceSnapshotInput`. `quota` is the `quota` object from that `/v1` response and is `null` for the internal source, where `cached` is also `null`.

## D17 — tsx runs `pnpm snapshot:dry` (2026-11-04, Session 3)

`pnpm snapshot:dry --phase before` has to run a TypeScript file that imports lib/. Node 26 strips types but rejects parameter properties (`constructor(readonly code …)` in lib/sources/types.ts) and does not resolve extensionless imports. The `--experimental-transform-types` flag no longer exists, and vitest rejects unknown CLI flags such as `--phase`. Added `tsx` 4.23.15 (devDependency, exact pin), released 2026-09-20. It was already in the lockfile as a drizzle-kit dependency, so nothing new is downloaded. tsx has no install scripts of its own; its esbuild dependency has a postinstall, which stays denied (D10). Used only by `snapshot:dry`.

## D18 — Collector details the plan left open (2026-11-04, Session 3)

- **Error rows** (v1 failed and the internal fallback failed) store null `tag`/`name` (unless the id is in config), `member_count`, `total_power`, `total_kills` and `raw_json`, with `is_fresh = false` and `source = 'v1'`. Those columns are nullable for this case (owner's choice), so a failed alliance is never stored as zeros. `member_snapshots.power`/`kills` are nullable for D15.
- **The claim comes before the quota call.** `findSnapshot` decides: a complete snapshot needs `force`, and a `running` one younger than 10 min is refused. `startSnapshot` is a compare-and-set: an insert with `on conflict do nothing`, or an update guarded by the row's last status and `started_at`. Two runs cannot both claim, and neither spends quota before claiming.
- **`force`** deletes the snapshot's alliance and member rows and collects every alliance again. Without it, a re-run fetches only alliances with no row. An error or stale row counts as a row, so only `force` re-fetches it.
- **`calls_used` counts `/v1` attempts only** (the quota check, alliance reads and retries), through the `onAttempt` hook on the adapter. Internal calls cost no quota and are not counted, so `calls_used` reconciles with `/v1` `used`. A re-run adds its calls to the stored value.
- **Status:** `failed` when the call cap was hit or no row holds data; `complete` when every alliance has a fresh row without error; `partial` otherwise, including a 429 mid-run.
- **Unexpected errors** (repo, bugs) are not caught. They propagate, and the snapshot stays `running` for the caller (Session 4's route) to finalise. After 10 min it can be re-run without `force`.
- **`quota_remaining_after`** is the lowest `remaining` seen in this run's `/v1` responses.

## D19 — PGlite for DB-backed tests (2026-11-04, Session 4, owner's choice)

Session 4's rate-limiter test has to read state back from a real database, and CI has no Postgres; the Neon driver cannot reach a plain Postgres without a WebSocket proxy. Added `@electric-sql/pglite` 0.5.14 (devDependency, exact pin), released 2026-10-31. 0.5.15 came out 2026-11-03, one day before this session, so the previous release was taken. 0 dependencies, no install scripts (`pnpm view @electric-sql/pglite scripts` lists only build/test scripts), 26 MB unpacked (the WASM build of Postgres). drizzle-orm 0.45.4 supports it (`drizzle-orm/pglite`, optional peer `>=0.2.0`). Tests open one in-process instance per file, migrate it from `drizzle/` and cast it to `Db`, as Session 3 did by hand with node-postgres. Alternatives rejected: `pg` plus a Postgres service in ci.yml (DB tests would be skipped or fail on a laptop without a running cluster), and the memory repo (cannot show that limiter state outlives a module). Cost measured: opening and migrating one instance takes ~4.0 s; `pnpm check` went from ~2.5–6.5 s to 17.2 s in the cloud container. It is the same Postgres engine, not Neon's server: driver-level behaviour (WebSocket pool, connection limits) is not covered.

## D20 — Route details the plan left open (2026-11-04, Session 4)

- **`GET /api/quota` and `GET /api/quota/check` require Bearer CRON_SECRET or the PIN**, with the same rate limiter as `/api/snapshot`. Plan Phase 4 lists no auth for them, but each request spends one `/v1` call, so an open route lets anyone drain the 1,000/day quota in a loop.
- **Events:** `events.event_at_utc` is unique, and the event row is found-or-created by it (insert on conflict do nothing, then select). Without the constraint two concurrent ticks could create two events, and so two runs and twice the quota. `events.quota_checked_at` makes the Friday check exactly-once: a conditional update claims it, like the run lock.
- **`test=1` on `/api/snapshot`** creates a new `is_test` event dated now (owner's choice), so the weekday dry run (Phase 7) cannot complete the coming Saturday's BEFORE. Test events notify both channels like any run (Session 9 watches both messages).
- **The tick** runs the earliest due action (Friday check, BEFORE, AFTER) whose window `[at, at + SNAPSHOT_WINDOW_MIN)` holds now and that is not done yet: a snapshot row of any status, or `quota_checked_at` set. It never re-runs a phase that has a row; a failed or partial run is re-run by hand. The Friday check uses the same window as the snapshots.
- **Finalising a crashed run:** the route wraps `repo.startSnapshot` to capture the id the claim returned, instead of `findSnapshot` afterwards, which could finalise another run's row if ours died before its claim. The row gets `status = failed`, 0 added calls (the real count died with the run) and the real duration.
- **Logger:** a line is one INSERT; error lines are mirrored to `console.error`; the first failed insert of a run is mirrored once. The 400th line is written as `log.capped` and nothing after it, so a run has at most 400 rows. `shutdown()` only awaits inserts already in flight (the collector fires `v1.retry` without awaiting); nothing is buffered.
- **Links in Discord messages** use the request's origin, so no new env var: the tick is called on `APP_URL`. `avatar_url` is left out until Phase 5b's PNG exists.
- **Client IP** for the limiter is `x-real-ip`, else the first `x-forwarded-for` hop. That Vercel overwrites both was not verified (vercel.com was not reachable from the session). If a client could set them, the per-IP limit weakens; the global lockout does not.
- **`v1.fetch`** lines record `http_status: 200` on success: the adapter returns only on 2xx and does not expose the status then.

## D21 — Event-driven tick and rehearsals (2026-11-04, Session 4 follow-up; supersedes parts of D20)

The Session 4 prompt was rewritten on `dev` (#11, #12) while the session ran; #13 was merged with the first version. This entry covers the follow-up that implements the rewrite.

- **Supersedes D20's `test=1`:** that parameter is gone from `/api/snapshot`. A dry run is a rehearsal (`POST /api/rehearsal`).
- **Supersedes D20's tick bullet:** phase times live on the event (`events.before_at`, `after_at`, NOT NULL; migration 0002). The tick does one thing per call, in this order:
  - it creates the coming Saturday's row from the env, silently, from 24 h before BEFORE until AFTER's window closes;
  - it runs the earliest phase of any event (Saturday or rehearsal) whose `[x_at, x_at + SNAPSHOT_WINDOW_MIN)` window holds now and that has no snapshot row of any status;
  - otherwise it runs the Friday check, claimed on the coming Saturday's row;
  - otherwise it runs a due `REHEARSAL_AT` slot.

  A Saturday row's times are fixed when the row is created, so changing `SNAPSHOT_BEFORE` after that does not move that week's run.

- **Credentials per route:**
  - `/api/tick` accepts CRON_SECRET only;
  - `/api/rehearsal` accepts the PIN only (plan Phase 4);
  - the others accept either.
- **`REHEARSAL_AT` slots are rows in `rehearsal_slots`.** The first tick in a slot's window claims it (insert on conflict do nothing), then creates the rehearsal, or records why it was skipped and posts one `[TEST]` admin note. So a slot runs at most once and a skip is announced once.
  - An empty `REHEARSAL_AT` means off: `lib/env.ts` keeps that one key's empty value instead of applying the `fri 18:00` default.
  - `REHEARSAL_KEEP` defaults to 4.
- **Rehearsal guards** (button and schedule alike), in this order:
  - neither now nor the rehearsal's AFTER (now + 45 min) may fall on `EVENT_WEEKDAY` or the day after;
  - no real BEFORE in (now, now + 3 h], checked against both the DB rows and the env-computed coming Saturday;
  - no real snapshot `running` and younger than 10 min;
  - no pending rehearsal (AFTER window still open, AFTER not finished).

  The pending check is read-then-insert, so two simultaneous button presses could create two rehearsals; a scheduled slot cannot race.

- **A rehearsal's `event_at_utc`** is the midpoint between its phases (created + 30 min). It keeps the column unique.
- **Retention:** creating a rehearsal deletes all but the newest `REHEARSAL_KEEP` test events, with their run_logs, member rows, alliance rows and snapshots, in one transaction. Slot rows stay, with `event_id` set to null.
- **The verdict** is computed from the database (`loadVerdictInput` + `rehearsalVerdict`), so `/admin` can recompute it. It is posted after any test event's AFTER run. Its quota line uses `snapshots.quota_remaining_before` (new, migration 0002): the quota check's `remaining`. That response already counts its own call, so a run's quota drop is `before − after + 1`, and it has to equal `calls_used`. No AFTER run means no verdict; the missing message is the signal.
- **Test events** never reach the public webhook. Their admin lines start with `[TEST]`. `GET /api/events` and `/api/events/[id]` don't serve them. Admin run messages now include "scheduled …, started …" (plan §3.1).

## D22 — Player photos and alliance badges, served from our own origin (2026-11-05, owner)

- **Owner decision** (2026-11-04): "lets go with the change on purpose, we will display player profile pictes and alliance badges", served "throug our own image route". The server's players agreed to share their data. This reverses plan §196 for `avatar_url` and `badge_url` and the CLAUDE.md hard rule that listed `avatar_url` as never returned (the owner asked the agent to edit that line, 2026-11-05).
- **Storage:** `raw_json` keeps `badge_url` and `members[].avatar_url` (still drops `server_badge_url`, `frame_url`, bulletin, declaration, quota). New nullable columns (migration 0003): `alliance_snapshots.badge_id`, `member_snapshots.avatar_url`. Both sources read them as optional fields, so a missing photo or badge never fails a run.
- **Never returned:** queries return `badgeId` and `hasAvatar`, never a URL. `avatar_url` stays in `BLOCKED_ROSTER_KEYS`.
- **Own image routes, never an open proxy** (no URL parameter):
  - `/img/badge/[id]`: only ids 101–110, fetched from the origin of `LAP_SITE_BASE_URL` (`/static/alliance/badge_<id>.png`, confirmed with one plain GET: 300×300 PNG, 33 KB). `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`.
  - `/img/avatar/[uid]`: the newest stored `avatar_url` for that uid, fetched only when it is plain `https` on `phs-image.globallap.com` (no port, no credentials). `Cache-Control: public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800`.
  - Both: 5 s timeout, `redirect: "error"`, 1 MB cap, raster `image/*` only (no SVG), our User-Agent, no Origin/Referer/cookies. Any failure is a bodyless 404 (cached 5 min); nothing is logged, so no URL reaches a log. `proxy.ts` gives `/img/*` the same deny-all CSP as `/api/*`; the page CSP stays `img-src 'self' data: blob:` (plan §12.3 unchanged).
- **Not `next/image` with `remotePatterns`:** it puts the upstream URL in the page (`/_next/image?url=…`), which the rule above forbids, and it spends Vercel image-optimisation quota on ~2,000 photos; our route serves the original bytes from the CDN cache instead.
- **Placeholders:** without a photo, the Granny Doctor in profile (`NoPhoto`); without a badge, a crocheted banner (`NoBadge`). Both drawn with the `hand-drawn-svg` skill and approved by the owner (2026-11-05).

## D23 — Language-light pages: copy, locale, server time, ranks (2026-11-05, Session 7b)

- **One copy module:** every user-facing string is in `lib/copy.ts` under stable keys; `/brand` text is `lib/copy-brand.ts` and admin text `lib/copy-admin.ts`, re-exported as `copy.brand` and `copy.admin` (one import path; `copy.ts` stays under the 300-line limit). `{name}` placeholders are filled by `fill()`. Signs, arrows and `#` stay in components, never in copy. `lib/copy.test.ts` parses every `.tsx` under `app/` and fails on JSX text or a string prop (other than class names, ids, hrefs) of more than two words.
- **Blank dictionary:** `NEXT_PUBLIC_BLANK_COPY=1` replaces every copy value with `░` per non-space character, placeholders kept, for the persona test. Read directly from `process.env` in `lib/copy.ts` (not `lib/env.ts`) because client components need it, which only a literal `process.env.NEXT_PUBLIC_*` reference gives. Inert when `NODE_ENV` is `production`. The four game terms (Might, Kills, Members, Level) stay readable in blank mode: DESIGN.md chooses them because players read them in the game's own English UI daily (persona round 1 showed that without them the rows are told apart only by magnitude).
- **Locale:** `Intl` with the first `Accept-Language` tag Intl supports (`app/_ui/locale.ts`), `en` otherwise; numbers format on the client too, so the locale reaches client components through `LocaleProvider`. Compact suffixes are the locale's own (`3,94 bi` in pt-BR, not `3,94 B`).
- **Server time only:** every public time is in `SERVER_TZ` with the word "server" after it; the status chips moved from UTC to server time so one page has one clock. `/admin` keeps UTC.
- **Ranks:** ledger rank = competition ranking (`1, 2, 2, 4`) by `total_power` or `total_kills` among the alliance rows of one snapshot (comparison page) or among every alliance's reference row of one event (across events); a player's is among their alliance snapshot's roster. Movement (`compute.rankDelta`) is shown only when both sides are fresh and not failed (and, for players, in the same alliance), the same rule as every delta; otherwise `—`.
- **Main page order:** strictly by the current ledger rank by might (after snapshot, else before), not by `before.total_power`.

## D24 — Two moderate Dependabot alerts accepted as dev-only, dated exception (2026-11-05, owner)

Plan §12.4: `pnpm audit --audit-level high` fails CI; a moderate finding that can't be fixed within a week gets a dated exception here, not a silent `--omit`.

- **esbuild 0.18.20** (GHSA: dev server accepts cross-origin requests) — reaches the lockfile only through `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` (both deprecated). The vulnerable code is esbuild's `serve` dev server; drizzle-kit uses esbuild only to transform `drizzle.config.ts` and never starts a server. Nothing of this reaches the Next bundle (devDependency). Patched esbuild (≥ 0.25) can't be forced in: `@esbuild-kit` is unmaintained and pins 0.18; an override would run untested esbuild APIs under drizzle-kit. **Resolves when drizzle-kit drops `@esbuild-kit`.**
- **minimatch 10.2.6** (globparts DoS amplification) — reached through `@eslint/config-array`, `@typescript-eslint/typescript-estree` and `eslint-plugin-import-x`, all pinning `^10`; the patched line is `11.x`, a major those packages haven't adopted. The DoS needs attacker-controlled glob patterns; ours come from `eslint.config.mjs` and our own file paths. Dev-only. **Resolves when the three upstreams move to minimatch 11** (Dependabot's weekly grouped PR will carry it).
- Action: dismiss both alerts in GitHub with reason _"Vulnerable code is not actually used"_ and this entry as the comment. Re-check at the first `v1.1` release: `pnpm why esbuild@0.18.20` and `pnpm why minimatch` should then be empty or point at updated parents. No `pnpm.overrides`.

## D25 — The collector closes the snapshot as partial at a 100 s deadline (2026-11-05, 08e)

- **Why:** on 2026-11-05 the upstream answered every keyed alliance read with 504 after ~46 s. With 4 calls in flight and a 30 s client timeout the run outlived the route's `maxDuration = 120`; Vercel killed the function, snapshot 1 stayed `running` with `finished_at` null and `calls_used` 0, no admin message was sent, and the 10-minute run lock blocked a retry.
- **Rule:** `RUN_DEADLINE_MS = 100_000` in `lib/collector.ts`, measured from the run's start (`Run.startedAt`). Reads started before it are raced against a timer; when it fires, no new read starts, the logger writes one `run.deadline` line, and the run's `AbortController` cuts every in-flight `/v1` call. `lib/sources/v1.ts` combines that signal with `TIMEOUT_MS` via `AbortSignal.any`, so `TIMEOUT_MS` keeps its meaning and no call can outlive the deadline. A retry that wakes after the deadline is neither sent nor counted.
- **Result:** the snapshot finishes `partial` (even with zero rows; the usual "no rows = failed" rule does not apply to a deadline) with `error = "deadline"`, the true `calls_used`, `quota_remaining_after` when known and a real `duration_ms`. Alliances without a row are listed as `not fetched: deadline`, which feeds the existing partial admin message and public chip. A call cut by the deadline writes no row, no `v1.fetch` line and gets no internal fallback.
- **Not changed:** `CONCURRENCY`, the 502/503/504 retry policy, `TIMEOUT_MS`, `lib/sources/internal.ts`, `MAX_UPSTREAM_CALLS`. The 20 s of headroom covers the finalise writes and the notifications.

## D26 — The tick runs at minutes 7, 22, 37 and 52 and fails on any non-2xx (2026-11-05, 08f)

- **Why:** after `tick.yml` reached `main` at 10:05 UTC, GitHub started no scheduled run in the next two hours (slots 10:15 to 11:00 missing from the Actions history); only manual dispatches ran. GitHub documents that schedule events can be delayed or dropped under load, and that the start of the hour is the peak. Also, `curl --fail` treats a `308` as success, so a wrong `APP_URL` (`http://`) passed as a green run that did nothing.
- **Rule:** cron `7,22,37,52 * * * *` (still every 15 minutes, still daily); the job prints the HTTP code and fails unless it is 2xx; `curl -sS` replaces the progress table. This replaces plan §3.1's `*/15` and Phase 6's "one `curl --fail`".
- **Not proven:** that the new minutes fix the missing runs. If scheduled runs still do not appear, the next step is a second pinger (plan §3.1 notes the manual fallback) and a tick log in the database.

## D30 — cron-job.org is the scheduler; GitHub's schedule is not relied on (2026-11-05, 08)

- **Why:** `gh run list --workflow tick.yml --event schedule` has returned no run since `tick.yml` reached `main` (2026-11-05 10:05 UTC), including after the minute change in D26 and a release at 14:18 UTC; checked again at 18:37 UTC. Manual `workflow_dispatch` runs work. The cause was not found (GitHub does not say why a schedule is not started).
- **Rule:** the job "Vercel Ticker" on cron-job.org sends `POST https://laptracker-inky.vercel.app/api/tick` with `Authorization: Bearer <CRON_SECRET>` every 15 minutes (30 s timeout, history kept, a notification after 2 failures). It is the scheduler. `tick.yml` stays for manual runs (`phase=tick|before|after`) and keeps its schedule as a second path; the tick is idempotent, so two callers do not duplicate a snapshot.
- **Proof:** a rehearsal on 2026-11-05 (event 5) ran its Before at 20:30:15 UTC (due 20:26) and its After at 21:00:21 UTC (due 20:56), both `complete`, with no manual call. The job ran several times inside the Before window and there is one snapshot per phase.
- **Cost:** `CRON_SECRET` lives in three places (Vercel Production, the GitHub secret, the cron-job.org header). A rotation must change all three and redeploy production; a mismatch makes the job fail with 401 (the app records the failed attempt in `auth_attempts`).
- **Not done:** a tick log table (a heartbeat row per call) and an alert when no tick arrived for an hour; both stay suggestions.

## D27 — A banner says when the upstream is not answering (2026-11-05, 08g)

- **Why:** on 2026-11-05 every alliance read returned 504 for about 17 hours and the pages showed old numbers with no reason.
- **Rule** (`lib/queries/upstream-status.ts`, read only, from stored rows; the banner never calls the upstream and spends no quota). Take the newest snapshot of a public event (rehearsals excluded). The upstream is "not answering" when that snapshot started less than 24 hours ago and one of these holds:
  1. it is `running` and started more than 10 minutes ago (the run lock's age, `RUN_STALE_AFTER_MS`): the run never closed;
  2. it is `partial` or `failed` with `error = "deadline"` (D25);
  3. it is `partial` or `failed` and at least half of its alliance rows carry `http 5xx`, `TimeoutError` or `AbortError`.
- **Clears** when a newer snapshot completes or fails for another reason (404, quota, stale rows), or 24 hours after the failed attempt started.
- **Shown:** one slim notice above the header of every page, with the newest time an alliance row was fresh with no error (`MAX(source_updated_at)`, server time). It has no controls and renders nothing when the rule is false or the read fails.
- **Limits:** the state is that of the last attempt. Few attempts exist (two per event, plus manual runs), so the banner can lag a recovery until the next run and can miss an outage between runs.
- **Not done:** a status page, an outage history, a live probe.

## D28 — Manual rounds: a public event the owner runs by hand (2026-11-05, 08h)

Why: the upstream was down for about 17 hours and the real Saturday event (id 2) has no snapshot yet. The owner needs real data on screen on a weekday, and later wants runs in other windows. `POST /api/snapshot` refuses any run before the event's `before_at` (`snapshot_not_due`), force included, and that guard stays: a weekday press on the Saturday event would store Saturday's phase with weekday data and the tick would skip the real run.

- **A manual event is an `events` row with `manual = true`** (migration 0004), `is_test = false`, the default name `Manual round <UTC date>`, `event_at_utc = before_at = after_at = its creation time`. Its visibility and Discord setting are below; by default it is public on its own page.
- **Created** by `POST /api/manual-event` (no body, PIN only, same rate limiter as every PIN route), from "Start a manual round" on `/admin`. Several can exist; the card shows the newest.
- **Renamed** by `POST /api/manual-event/rename` `{event_id, name}` (PIN only): only a manual event that has at least one snapshot (409 `rename_before_run` before that), name trimmed, 1–80 characters, no control characters. The name is stored and rendered as text (React escapes it), so it shows in the event selector, event pages and `GET /api/events`. The /admin field appears only after the first snapshot.
- **Two windows:** Before and After have no time relation. The owner can run Before today and After on another day; nothing checks the gap.
- **Run** by `POST /api/snapshot?phase=…&event=<id>` (the card's Before and After buttons). The route accepts an `event` only if that row is manual; any other id answers 404 `event_not_found`, so the Saturday guard cannot be bypassed. For a manual event `executeSnapshot` skips the not-due check.
- **One snapshot per phase** is unchanged: a second press answers `snapshot_complete` and the button asks "Take it again?", then sends `force=1`, which replaces that phase's rows. To keep two runs, create a second manual event.
- **An open round never blocks Saturday.** The tick ignores manual events entirely, so a Before without an After does not delay the real run. The collector claims per event and phase, so a manual run and a Saturday run could overlap if started in the same minute; both would spend quota. No extra guard was added: the owner chooses when to press, and the 100 s deadline (D25) bounds a run.
- **The tick never runs it** (INVARIANT `tick.skips-manual`): `duePhases` filters `manual = false`. Its phase times equal its creation time only so that nothing about it is "not due"; they are not a schedule.
- **Previous event.** Both places that pick a "previous event" order public events by `event_at_utc`: `allianceHistory` (alliance pages) and `sightingsOf` (player pages); `historyRanks` feeds the same chains. A manual round would sort before Saturday and become its "since" reference, so a round is excluded from all three unless its visibility is `history` (a test runs Saturday after a manual round and checks Saturday has no previous event).
- **Nothing is overwritten.** One event row per round (`event_at_utc` is its creation time, unique), one snapshot per event and phase (`snapshots_event_phase_unique`). Saturday and a manual round are different events, so running one never touches the other; only a forced re-run of the same phase of the same event replaces that phase.
- **Standalone rounds stay out of cross-event chains.** `allianceHistory`, `sightingsOf` (player history) and `historyRanks` filter `manual = false`, so Saturday's "since last event" deltas, ranks and player rows never compare against a demo. The event's own page, its alliance pages (`getAllianceDetail`), the name history and player search still include it.
- **Visibility** (`events.visibility`, migration 0005; the owner picks it on /admin, at any time, even after the round ran; default `standalone`):
  - `admin`: no public read sees the round. Every public query uses the one predicate in `lib/queries/visibility.ts` (`publicEvent`: not a rehearsal, not `admin`), INVARIANT `queries.public-event`.
  - `standalone` (default): public on its own page, the selector and `GET /api/events`, and its alliance pages; outside the comparison chains.
  - `history`: public and part of the chains (`chainEvent`: real events plus `history` rounds): alliance history and "since the previous event", player history, ledger ranks. It sorts by `event_at_utc` (its creation time) like any event. Deltas are computed at read time, so switching needs no re-collection.
  - Effect on Saturday: with a `history` round dated before Saturday, Saturday's "since last event" deltas compare against that round's reference row (its After, else its Before); with `standalone` or `admin` they do not.
- **Home page:** with no event chosen it shows the newest real event, never a manual round (`getEventPage`; `GET /api/events` rows carry `manual`). A manual round is reached from the selector or its link.
  - Amended 2026-11-06 (08zzc): "has data" decides first. `/` shows the newest real event with a `complete` snapshot, else the newest event of any kind with one, else the newest real event, else the newest (`homeEvent` in `lib/queries/events.ts`). The tick creates Saturday's event a day ahead with no snapshot, and it no longer takes `/`. The header selector marks that same event "latest" and links it to `/`; every other event, an upcoming one included, links to `/events/<id>`.
- **Discord** (`events.post_public`, default off, read when a run finishes): when on, a Before or After run posts the same public message the tick posts (`notifyFinished`, no copy); the "next snapshot" line is left out because a round has no schedule. `admin` visibility and a public post cannot be combined: `POST /api/manual-event/settings` answers 409 `admin_cannot_post`, and the /admin checkbox is disabled while the round is admin only (switching to `admin` sends `post_public: false`). The admin channel keeps its usual run line.
- **Quota:** each snapshot costs about 21 calls of the 1,000 per UTC day; the card says so and the confirmation names the cost.
- **Not built:** deleting a manual event from the UI (a manual delete must remove, in order, its run_logs, member rows, alliance rows, snapshots, then the event: the foreign keys do not cascade), a different visibility per phase.

## D29 — Releases: Prepare release opens the PR, the merge stays manual, publishing is automatic (2026-11-05, 08j)

Why: a release was three manual steps (PR, merge, `gh release create`) and the tag was easy to forget. The owner wants to choose when to release and to merge by hand, and everything else to follow.

- **Two workflows, not one.** `release-prepare` (`workflow_dispatch`, input `bump`) opens the PR `dev → main` titled `release: vX.Y.Z` with the generated notes. `release-publish` (push to `main`) tags the merge commit and creates the GitHub Release. They are separate because a merge happens between them, and a workflow cannot wait for a human without holding a runner; a `push` to `main` is the event that says the merge happened.
- **The merge stays manual.** The `main` ruleset allows only merge commits and requires `check`. Prepare release never pushes to `main` or `dev` and never merges; the owner reads the notes and the diff, then merges. Auto-merge is not enabled.
- **Version source is the latest `v*` tag.** `package.json` stays at 0.1.0 and is not touched: bumping it would need a commit on `dev` per release (a second PR, or a push to a protected branch), and nothing reads it. Only strict `vX.Y.Z` tags count, sorted by version (so `v0.10.0` is above `v0.2.10`).
- **Publish trigger.** The merge commit's title is the PR title (`merge_commit_title = PR_TITLE`), so it starts with `release: v`. The step matches `^release: vX.Y.Z` on any line, so GitHub's default merge message (title on line 3) also works. It is idempotent: if the tag exists it does nothing, and a failed lookup other than 404 fails the run. The tag points at the pushed commit SHA, not at the moving `main`.
- **No deploy logic.** Vercel deploys `main` and runs `pnpm db:migrate` in its build (`vercel.json`).
- **Setting needed.** "Allow GitHub Actions to create and approve pull requests" must be on, or `gh pr create` fails with the `GITHUB_TOKEN`. `default_workflow_permissions` stays `read`; each workflow declares its own permissions.
- **Required check.** A PR opened with `GITHUB_TOKEN` starts no new workflow runs, but a required status check is read from the head commit, and `ci` already ran on the push to `dev` (check run `check`, from github-actions, the integration the ruleset names). If the newest push to `dev` has no finished `check`, the release PR will wait on it.
- **Limit.** Workflows run from the default branch, so Prepare release exists in the Actions tab only after a release carries it to `main`.

## D40 — /admin "Run something now": one row of seals, a manual round options form (2026-11-05, 08k) (numbered D30 by mistake until 2026-11-05)

Why: the owner found the run area cluttered, the visibility dropdown hard to read and the bare "run or cancel" confirmation before a round was created unhelpful.

- **Layout.** Before, After and Rehearse are three columns on one row (360 px included), each with a one-line help and its cost. "Manual round" is its own row below.
- **One options form, two places.** `RoundOptions` (name, visibility as three radio options with one line each, Discord post as a checkbox) is used by "Start a manual round" (opens inline under the button; "Create round" is the confirmation, so no separate confirm sheet) and by the round's card ("Change options", "Save changes"). Seals still ask for a confirmation that names the cost. Save sends only what changed: a rename (only after the Before ran, D28), then the settings, as two calls.
- **API change (minimal).** `POST /api/manual-event` accepts an optional JSON body `{name?, visibility?, post_public?}` (same name rules as rename, same `admin_cannot_post` 409). With no body it behaves as before. Needed because the name and options are set before the round exists and a rename is refused until a snapshot exists.
- **Round summary.** The card shows name, Before and After state, visibility, Discord and the API calls the round has used (sum of its snapshots' `calls_used`, read in `latestManualEvent`).
- **Not built:** a modal for the form (inline keeps the round's options next to the button), deleting a round (D28).

## D31 — Discord: one editable message per channel per event (2026-11-05)

Why: the channels now carry several kinds of events (Saturday, rehearsal, manual round, D28), and two to three messages per channel per event was noise. The owner dropped the ping idea.

- **One message per channel per event.** The Before posts it with `POST <webhook>?wait=true`, which returns the message; its `id` is stored on the event: `events.discord_public_message_id` and `events.discord_admin_message_id` (text, nullable, migration 0006). The After, and a rehearsal's verdict, edit it with `PATCH <webhook>/messages/<id>`. Admin and public are separate messages with separate ids.
- **The edited message shows the event so far.** Public embed: the same status chip, counts and movers as before, plus a "Before snapshot done at …" line on the After (the colour bar still follows the latest run's state). Admin text: a bold event-name header (after the `[rehearsal]` / `[manual]` tag), then one block per phase run so far (the 07f run block, unchanged), then, for a rehearsal, the verdict block. The current phase's block has the full detail (failed and stale alliances); the other phase's block is rebuilt from its `snapshots` row and has none (its run page has them).
- **Fallbacks, no extra machinery.** Nothing stored: post and store. PATCH answers 404 (message deleted): post a new message and store its id. Any other failed PATCH: keep the stored id and post nothing (a second message is what this removes); `notify.failed` logs the status only. `wait=true` returns no id: nothing is stored, the next phase posts again (today's behaviour) and `notify.no_message_id` is logged. The webhook URL is never logged, thrown or put in a message.
- **Channels (owner, 2026-11-05).** The public channel (`laptracker-ledger`) is strictly one message per event. The admin channel keeps one editable message per event on the normal path, and a run that ends `partial` or `failed` also posts a new message of its own (that run's block under the event header), besides editing the event message. Why: an edit does not notify and has no link of its own, so a problem hidden in an edit is easy to miss; the event message stays the complete record. A rehearsal verdict that fails is inside the edited message only (not a run status).
- **Same mechanism for every kind of event.** Saturday events, rehearsals (admin only) and manual rounds. A manual round with its public toggle off never touches the public channel (D28).
- **No locking.** A Before and an After of one event never run at once (one claim per event and phase), so the read of the stored id and its write cannot race. Two forced re-runs of the same phase pressed together could, as they could already double-send.
- **One-shot messages are unchanged:** Friday quota check, PIN lock, app errors and skipped rehearsals post a new message each (they belong to no event).
- **Not verified against Discord:** edits through `message_reference` replies were not used (unverified for webhooks); threads are not possible in a plain text channel.

## D32 — Alliance capacity is stored; a one-roster member list is not diffed (2026-11-05)

- `alliance_snapshots.capacity` (nullable integer, migration 0007) holds the `/v1` `capacity` field. The public pages show `members / capacity`, and only the plain count when it is null (old rows, internal source). It is an alliance field, not a roster field.
- The member list compares the two rosters only when both are non-empty. Otherwise the non-empty one is the current roster, with no Joined / Left status and no change figures. Before this, a Before-only event listed every member as Left.

## D33 — A `*` on a falling total whose members left, with one legend item (2026-11-05)

Why: an alliance's Kills (and Might) total is the sum of its members, so it falls when members leave. A tester read that as a bug. The note "−N Members" already sits in Details, but a note on the Kills row was read as a kills figure (7b), so the row itself needs something smaller than words.

- **Mark.** `*` after the change (`▼ −3.2M (−0.4%) *`), when the delta is negative and at least one member left (`fellWithLeavers`, `app/_ui/event-rows.ts`). It applies to Might as well as Kills: the cause is the same and the check is the same function. "Includes member changes" stays true when the fall is partly something else.
- **Not `±`.** `±` already means "change" on the site (`± Kills` sort chips) and beside a number reads as a margin of error. The asterisk is the language-free footnote sign.
- **Legend.** One item, `* Includes member changes`, shown only when the page has at least one mark (`Legend memberMark`). Event page and alliance page; the player page has no alliance totals. Nothing hover-only: the legend is always visible; the mark carries the same words as screen-reader text.
- **Details unchanged.** The "−N Members" note stays in Details. No number is computed differently.
- **Alliance page leavers.** Counted from the two rosters (status `left`) only when both exist, the same rule as the member list (D32).

## D34 — The dependency rule is linted; migration drift fails `pnpm check` (2026-11-05, 08s)

- **Zones** (`import-x/no-restricted-paths` in `eslint.config.mjs`): `lib/compute.ts` and `lib/budget.ts` import nothing from the project; `lib/schedule.ts` imports only `lib/env.ts` (its `Env` type); `lib/**` and `config/**` never import `app/**`; `app/**` never imports `lib/sources/**`; `app/(pages)/**` and `app/_ui/**` never import `lib/repo/**`. Packages under `node_modules` stay allowed.
- **Two zones narrower than plan §11.2.** `lib/schedule` may import `lib/env` (a type-only import it has always had). The `lib/repo` zone covers pages and UI only: ARCHITECTURE.md lets route handlers (`app/api`, `app/img`) use `lib/repo`, and five do. Pages and UI read through `lib/queries`.
- **Resolver.** The rule skips any import it cannot resolve, and the default resolver resolves neither `.ts` nor the `@/` alias, so the zones passed silently without it (0 errors on 7 forbidden imports). `settings["import-x/resolver-next"]` uses the plugin's own `createNodeResolver` with the tsconfig paths. No new dependency.
- **Drift gate** (`scripts/check-drift.ts`, last step of `pnpm check`, so CI runs it): `drizzle-kit generate` must write nothing under `drizzle/`, then `drizzle-kit check` must pass. If generate writes files, the script lists them, removes new files and restores changed ones, then fails, so a red check leaves no stray migration in a dev tree. No database connection.

## D35 — Static assets carry no CSP; the proxy matcher stays narrow (2026-11-05, 08t)

Why: 07c (N6) measured that `/_next/static/*` responses have no `Content-Security-Policy` header, 12–15 files per page, locally and on Vercel, while every other response has one. The proxy matcher (`proxy.ts`) skips `_next/static`, `_next/image` and `favicon.ico`.

- **Browsers enforce a CSP only from a document's response, or a worker script's.** A script, stylesheet or font that a page loads runs under that page's policy: the page's `script-src 'self' 'nonce-…' 'strict-dynamic'` decides whether a chunk may load, `style-src` and `font-src 'self'` decide CSS and fonts. A CSP header on a `.js`, `.css` or `.woff2` response is ignored. So the static files are already covered by the nonce CSP of the page that loads them (D11).
- **What `/_next/static` serves.** `next build` on `922190a`: 22 `.js`, 1 `.css`, 16 `.woff2`. No HTML, SVG or worker. The app creates no Worker and registers no service worker; the `importScripts` mentions in two chunks are Turbopack's chunk loader and a polyfill checking whether they run inside a worker.
- **Opened directly.** A `.js` or `.css` file opened in a tab is shown as text. `X-Content-Type-Options: nosniff` (`next.config.ts`, every path including `/_next/static`) stops a browser from sniffing one as HTML. They are build output from this repo, not user content. The SVGs in `public/brand/` are served outside `/_next/static`, so the proxy gives them the page CSP.
- **Not done: widening the matcher.** It would run the proxy on every static request for a header browsers ignore.
- **Revisit** if the app adds a Worker or service worker, or serves HTML or SVG from `/_next/static`: a worker script's own response sets its policy.

## D36 — Vercel Web Analytics and Speed Insights on production (2026-11-05, owner, issue #69)

The owner asked to track page usage and events without identifying anyone, then limited it to what Vercel's free (Hobby) plan offers: nothing from Pro. This supersedes plan §7 "No frontend tracking" for these two scripts only. §5's Hobby finding still holds: Web Analytics on Hobby has no custom events, so there are none (no `track()`, no own event counter).

- **What.** `<Analytics />` (`@vercel/analytics/next`) and `<SpeedInsights />` (`@vercel/speed-insights/next`) in `app/_ui/VercelInsights.tsx`. `app/layout.tsx` renders them only when `VERCEL_ENV === "production"`, so previews (`preview`), `next dev`, `next start` and tests load nothing. In dev mode the packages would load `va.vercel-scripts.com`, which the CSP blocks.
- **No typed text.** Both get `beforeSend`, which cuts the query string and hash from the URL (`/players?q=<name>#x` → `/players`). No `track()`, no `identify`, no cookie mode.
- **What leaves the browser.** Web Analytics (read in the served `/_vercel/insights/script.js` on 2026-11-05): the page URL after `beforeSend`, the route pattern (`/players/[uid]`), the referrer only when it is another site, and the SDK name and version. Vercel adds country/region/city, OS, browser, device type and time from the request. Speed Insights (Vercel's privacy page): the URL after `beforeSend`, route, network speed, browser, device type, OS, country, the vital's value and its element selector, and the SDK version. Neither script sets a cookie. Per Vercel, visitors are counted by a hash of the request that is discarded after 24 h, and no IP is stored. A player page URL holds the viewed player's uid, which is a public page address and says nothing about the visitor. No roster field, avatar URL or name is ever in a payload (D22).
- **CSP unchanged.** A nonced Next chunk adds each script with `createElement`, which `'strict-dynamic'` trusts (`'self'` in browsers without it). The scripts (`/_vercel/…` or Vercel's per-build `/<seed>/…` path, "Resilient Intake") and their POSTs are same-origin, so `connect-src 'self'` covers them. No new source and no nonce prop.
- **Hobby limits (Vercel docs, 2026-11-05).** Web Analytics: 50,000 events a month across the team (a page view is one event), a 1-month reporting window, no custom events. Past the limit there is a 3-day grace period, then collection pauses; the site keeps running. Custom events need Pro ($0.03 per 1,000 events, 2 properties per event). Speed Insights free tier: 10,000 events over a rolling 30 days across the team, Real Experience Score only, 24 h and 7 d ranges. Past that, collection pauses for at least 14 days.
- **Dashboard.** The owner enables Web Analytics and Speed Insights for the project in Vercel (project → Analytics / Speed Insights → Enable). Until then the script paths return 404 and nothing is collected.

| Package                | Version | Released   | Install scripts                                | Dependencies | Why the platform isn't enough                                                                                                         |
| ---------------------- | ------- | ---------- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| @vercel/analytics      | 2.0.1   | 2026-03-12 | none                                           | 0            | Vercel's documented Next.js loader for its own page-view script: it injects the script, reports client-side navigations and the route |
| @vercel/speed-insights | 2.0.0   | 2026-03-10 | none (1.x had a postinstall, dropped in 1.3.0) | 0            | the same for the web-vitals script; 2.1.0 was released 2026-11-05, less than two weeks ago, so 2.0.0 was taken                        |

## D38 — Per-viewer time zone and date order are cookies, set from a header settings gear (2026-11-05, owner, issues #26, #27)

Viewers on server 325 live from UTC−8 to UTC+10 and write dates in different orders. The owner chose option A of the Session 08ze mockups: a settings gear replaces the header's theme switch, and its panel holds Theme, Times and Dates.

- **Cookies, like `theme`.** `tz` holds the IANA zone the browser reports (`Intl.DateTimeFormat().resolvedOptions().timeZone`), set when the viewer picks "Your time" and removed when they pick "Server time". `date` holds one of `d-mmm`, `mmm-d`, `dd/mm`, `dd.mm`, `iso`, removed by "Auto". Both are one year, `SameSite=Lax`, path `/`, per browser, never server state. The client sets them and calls `router.refresh()`.
- **Read on the server only.** `requestClock` (`app/_ui/locale.ts`) reads both. A `tz` that is not a real zone (`isTimeZone` from `lib/env.ts`, at most 64 characters) and a `date` outside the allow-list are ignored, so the page falls back to server time and the locale's own dates. With no cookie, `makeClock` produces exactly what it did before.
- **Words.** In the viewer's zone a time reads `16:01 your time` and a table corner reads `Your time`, the same shape as `server time`. The panel shows the zone's city ("Moscow") as confirmation. Offsets were not used because the owner ruled out a UTC twin (DESIGN.md). IANA ids were not used either: as words they can read like `Etc/GMT+2 time`.
- **Date orders.** `31 Oct`, `Oct 31`, `31/10`, `31.10`, `2026-10-31` are built from `Intl.DateTimeFormat#formatToParts` in the request locale, so month names stay localized. `day`, `weekday`, `long` and `at` follow the choice; `hhmm` is always 24-hour. The admin-only `stamp` keeps its full numeric date.
- **Where it does not apply.** /admin uses `requestServerClock` (always server time, the zone its schedule is set in), and its gear shows the theme only. Discord messages (`lib/notify.ts`) keep their own server-time clock. The upstream banner in the root layout follows the viewer's setting on every page, /admin included.
- **No hydration risk.** Every Clock call runs on the server. The panel, which reads the browser's zone and the cookies, renders only after it is opened.
- **Known effect.** The event is Saturday 12:00 server time (14:00 UTC), so at UTC+10 and east of it the event's weekday reads Sunday in "Your time".

## D37 — /admin: framed sections, status at a glance, one poller in the shell (2026-11-05, 08zb, owner-approved mock, issue #91)

- **Why.** The owner found `/admin` flat: headings, facts and help at the same size and contrast, no state on the quota, actions mixed with facts, and a round card that said "not run" without saying what to press.
- **Layout.** Four `admin-section` frames (flat 1 px rule, no shadow, no radius): Status (facts only: quota OK / Low under 900 / Unknown, what runs now, the next scheduled run, the last result with the last run durations), Run something now (every action, each with a `cost-tag`), Last rehearsal (verdict chip on the title row), Schedule (read-only). Group titles moved from the off-scale 18 px to `display-sm`. `/admin/runs`, `/admin/runs/[id]` and `/admin/errors` use the same frame; runs carry their state as a chip and are titled by their event's name.
- **Live indicator.** A drawn chamberstick (`LiveCandle`, `icon_live`) in the admin nav on every admin page: the flame sways and the glow flickers while a run is in progress, dimmed with "Idle" otherwise, still under reduced motion; the word is always shown; not a control. The owner asked for the motion after round 1 (round 1 pulsed the whole flame).
- **One poller, moved.** `useRunWatch` moved from `AdminActions` into `RunWatch`, rendered by `AdminShell` around every admin page (owner's answer, 2026-11-05). It is still the only poller (4 s running, 20 s idle, none in a hidden tab); `/admin` gets the "finished" line from it through context. The shell reads the running snapshots and the newest run itself, so `/admin` reads them twice per render.
- **Round phases** say what to do next: "Not started: press Before", "Running since {time}", "Done {time}", "Partly done {time}", "Failed: {reason}"; `latestManualEvent` now returns each phase's start, finish and error.

## D39 — Any public event can be renamed from /admin (2026-11-05, 08zb, issue #106)

- **Rule.** `POST /api/manual-event/rename` (PIN only, the D28 name rules) renames any event that is not a rehearsal. A scheduled (Saturday) event can be renamed whenever its row exists, from a day before its Before (the tick makes it then), before any snapshot included: naming the coming event ahead ("KvK 12-11") is the use the owner showed in the approved mock. A manual round keeps D28: only after a snapshot exists (409 `rename_before_run`). A rehearsal answers 404 `event_not_found`.
- **Where.** `/admin` "Run something now" shows the current event by name with Rename (free); before its row exists a line says when it can be renamed. A manual round is still renamed in its card's options.
- **Path kept.** The route keeps its D28 path rather than a new one; `renameManualEvent` became `renameEvent`. Discord messages already sent keep the old name.

## D48 — Public pages in 18 languages: native dictionaries, a staleness check and a translate-copy skill (2026-11-05, owner, issue #60)

Members play from many countries. The owner asked for translation in v1.1 rather than v2 (#60) and chose native dictionaries over a library, kept fresh by the coding agent itself: "seguimos com dicionário, uma skill e script de llm que fica no harness e gera a nova tradução quando algum copy mudar". First batch: es, pt-BR, fr, de, it, nl, sv, pl, ru, uk, tr, zh-CN, ja, ko, id, vi, th, plus the English source.

- **What is translated.** The public pages' strings (`en` in `lib/copy.ts`). /admin (one operator), /brand (guidelines), Discord messages (one shared channel, D31; owner, #60 comment 6673792132), the web manifest and the OG image stay English. Might, Kills, Members and Level stay English in every language (D23; amended by D52: the game's own word where sourced). Brand names stay: "OG's LAP Tracker", "Old Grandmas".
- **One registry, one file per language.** `LANGUAGES` in `lib/copy.ts` lists the tags; `lib/i18n/<tag>.ts` is `as const satisfies Translation` (any of `en`'s keys), registered in `lib/i18n/index.ts`. An extra or misspelt key fails tsc. A missing key reads English at runtime (`withEnglish`, applied once at start-up), so a new English string never breaks a page.
- **Staleness stamps.** `lib/i18n/<tag>.stamps.json` keeps, per key, the first 8 hex of the SHA-256 of the English it was translated from. `scripts/i18n-check.ts`, the last step of `pnpm check` (so of the Stop hook and CI), reports missing, stale, extra and placeholder-broken keys per language and ends with "Run the translate-copy skill". `pnpm i18n:todo` prints the work as JSON; `pnpm i18n:stamp` marks translated keys fresh.
- **The translator is the coding agent.** `.claude/skills/translate-copy/SKILL.md` orchestrates: todo, one `translator` subagent per language in parallel, a spot-check, stamp, `pnpm check`. `.claude/agents/translator.md` runs on Haiku on purpose (cost) with Read, Edit, Write, Glob and Grep only (no shell, no web); its prompt holds the rules: exact placeholders, the game terms in English, labels of at most two words, `Label: {n}` for counts, DESIGN.md voice, and `lib/i18n/glossary/<tag>.md` reused and extended so terms stay consistent across runs. A language that reads poorly is rerun on a bigger model. No external translation API.
- **Language per request.** `pickLanguage` (`app/_ui/locale.ts`): the `lang` cookie, else the first Accept-Language tag (by q) in a written language, else English. Any Portuguese reads pt-BR and any Chinese reads zh-CN. The Intl locale is the viewer's own tag in that language (en-GB keeps `31 Oct`), else the chosen language; with no cookie and no match it stays the first tag Intl supports, as before.
- **How code reads it.** Server components call `requestCopy()` (React `cache`); client components call `useCopy()` from `LocaleProvider`, which the root layout fills with the request's dictionary only, so the client never downloads other languages. Components shared by both, and the ones tests render synchronously, take `copy` as a prop, like `clock`. `<html lang>` is the language; /admin and /brand wrap their content in `lang="en"`. No inline script: the first paint is already in the right language.
- **Switcher.** The first control in the settings gear (D38) on public pages: a native `select`, each language named in itself by `Intl.DisplayNames`. It writes a one-year SameSite=Lax `lang` cookie and calls `router.refresh()`. A select because 18 radios pushed Theme, Times and Dates out of the panel at 360 px.
- **No library.** next-intl (MIT) would add a dependency and turn the ~50 `copy` import sites into hooks, for features the copy does not use (ICU plurals, rich text). Counts are written `Label: {n}`, so no language needs plural forms; `Intl.PluralRules` is the tool if one ever does.
- **Fonts.** Source Sans 3 and Alegreya Sans already serve latin-ext, Vietnamese, Cyrillic and Greek through next/font. Young Serif (page titles) has latin and latin-ext only, so Cyrillic and Vietnamese titles use the system serif; Chinese, Japanese, Korean and Thai use system fonts.
- **Not done: right-to-left** (Arabic, Persian, Hebrew). It needs `dir="rtl"`, logical instead of physical spacing classes (about 25 today), mirrored arrows (12 files) and its own font check; a separate issue.
- **Review.** A native reviewer for each of 17 languages is not realistic. The first drafts were written by Claude (Opus) and spot-checked; players can report wording in an issue, and a fix is one line in `lib/i18n/<tag>.ts` plus `pnpm i18n:stamp`.

## D49 — Events are named by their title; the closed event selector shows the date only (2026-11-05, owner, 08zj, issues #132, #130)

- **Why.** A member's 360 px screenshots: with a manual round selected the closed selector wrapped to three lines (seven with a long name), and on dev the header grew from 64 px to 140–160 px at 320, 360 and 390 px in English, German and Russian, with the settings gear pushed off-screen at 320 and 360. A renamed event ("KvK 12-11", D39) was shown nowhere: every label used the weekday.
- **Title.** An event is named by its title: a manual round's name (D28) or the name the owner gave a scheduled event (D39). While a scheduled event keeps its generated name ("Saturday Event 2026-10-31", `isGeneratedName` in `lib/schedule.ts`) it is named by its date, because that name is English and says no more than the date. This applies to the selector's list, the event page's heading and the player's "Across events" rows; each shows the date under a title. A manual round carries a ✎ mark whose screen-reader text is "Manual round".
- **Closed selector.** It shows the date only (`Thu, Nov 5` at 360 px and up, `Nov 5` below), with the ✎ mark for a manual round, so it is one line in any language; its accessible name carries the full title. Options weighed with the owner: the title cut with an ellipsis ("✎ Manual ro…" at 360 px), the selector moved under the header (scrolls away, repeats the title on the event page), and a calendar icon with no current event in the sticky header (the viewer loses which event a long alliance page is on).
- **Pages that span every event.** The player page and /players have no current event; the closed selector reads "All events" there instead of "Events", which read as if the choice had been lost.
- **Search link below 420 px: the magnifier alone** (owner, after the merge with #136). With the real dictionaries, the search word plus the closed selector needs up to 262 px at 360 px, where 216 px is left. The worst cases are "All events" in ja (46 px over), fr, pl, es and pt-BR, and a manual round's date in vi, pt-BR and ja. In ja and ko the squeezed link also wrapped its word. Below 420 px the word is screen-reader only and the link is a 44 px square. The magnifier is one of DESIGN.md's universal symbols. From 420 px up, the word fits in every language. The other option, a date without the weekday plus an ellipsis, would have cut "All events" in several languages.

## D50 — An officer's mark comes from the title text, with the in-game names as aliases (2026-11-05, 08zx, owner)

- **Rule.** A titled R4 gets the drawing of its title slot: Diplomat → dove, Recruiter → horn, Militarist → crossed swords, Overseer → eye (`officerMark` in `lib/brand/components/RoleMark.tsx`). The title is compared trimmed, lower-cased, inner spaces collapsed. Any other title keeps the stitch star; an untitled R4 still has no mark (`roleOf`).
- **Why the text.** The data has no slot id: every R4 is `rank_code` 104 and the title is only the text after `R4 · ` in `rank_label`. All 26 recorded rosters use the same four English names, at most one of each per alliance, and no other title text.
- **Aliases.** The owner calls two titles "Goddess" and "God of War". They are taken as the in-game names of the Overseer and Militarist slots (not confirmed), so `goddess` maps to the eye and `god of war` to the swords. If the site ever sends them, they get the right drawing; if the mapping is wrong, it is two lines in `BY_TITLE`.
- **One tone.** All officers stay sage. Yarn and seal mean gain and loss and plum is the leader; the shape names the title, the word is always beside it or `sr-only`.

## D42 — Client IP: Vercel overwrites x-real-ip and x-forwarded-for; the limiter keeps them (2026-11-06, 08zo, owner, issue #119)

Supersedes the D20 "Client IP" bullet ("was not verified").

- **Docs (vercel.com/docs/headers/request-headers, last updated 2025-12-13).** `x-forwarded-for`: "we currently overwrite the X-Forwarded-For header and do not forward external IPs. This restriction is in place to prevent IP spoofing." `x-real-ip` and `x-vercel-forwarded-for` are each "identical to the `x-forwarded-for` header". A client-chosen `X-Forwarded-For` is honoured only through a trusted proxy, which is an Enterprise feature.
- **Probe (production, 2026-11-06 02:45:36 UTC, the owner's allowed probe).** Two `POST https://laptracker-inky.vercel.app/api/snapshot` with no `Authorization` and no `x-edit-pin`: one with `x-real-ip: 203.0.113.77`, one with `x-forwarded-for: 203.0.113.78`. Both answered `401`. Such a request reaches only `failIp` (`lib/auth.ts`), which counts the `ip:<clientIp>` row and never the `global` key, and `authorize()` runs before any upstream call, so the probe spent no quota and could not trigger the PIN lockout.
- **Result.** `select key, count, window_start from auth_attempts where key like 'ip:%'` on the production branch (Neon `main`, marked "vercel production branch") returned one row: `ip:<the caller's real IPv4>`, count 2, window start 02:45:36 UTC. No `ip:203.0.113.77` and no `ip:203.0.113.78`. Both forged values were replaced at the edge by the real address, and both requests counted against the same per-IP row.
- **Rule.** `clientIp` keeps `x-real-ip`, else the first `x-forwarded-for` hop. On Vercel both carry the edge's view of the client, so the per-IP limit (5 per 15 min) holds as plan §12.2 states. No code change.
- **Limits.** Verified on the production domain only; preview deployments sit behind Vercel Authentication and were not probed. If a proxy (Cloudflare, a trusted proxy) is ever put in front of Vercel, this must be checked again. When neither header is present (not the case on Vercel) every caller shares `ip:unknown`.

## D51 — Event, scheduled event, manual event: the domain terms; "Saturday" names only the weekday (2026-11-06, owner, 08zy, issue #130)

- **Why.** The owner (2026-11-05): "Saturday event" must not be the project's business term. The game event is an **event**; that the schedule falls on Saturday is a setting (`EVENT_WEEKDAY`), and "Saturday Event 2026-11-07" is only that event's default title, which the owner can rename (D39).
- **Terms.** An **event** is one game event, either a **scheduled event** (the tick creates it a day ahead on `EVENT_WEEKDAY`, Saturday by default, at `EVENT_TIME`) or a **manual event** (D28, called "manual round" there). Rehearsals are test events (`is_test`). docs/GLOSSARY.md has the rows; docs, code comments, identifiers, test names and copy use these words.
- **"Saturday" stays** only for the weekday itself: the `EVENT_WEEKDAY` setting and its default, weekday and date formatting, the default title `<Weekday> Event <date>` (`eventOn`, `isGeneratedName`) and the stored titles it produced (no migration), and test fixtures that are such titles.
- **Earlier entries.** This file is append-only, so D1–D50 are not edited. Where they say "Saturday", "a Saturday row" or "the coming Saturday" for the event rather than the weekday, read "scheduled event".

## D43 — Collector and route robustness: a lost phase is not a failure, a 150 s run lock, bounded shutdown and notify (2026-11-06, 08zr, owner, issue #120)

- **A tick that loses its phase answers 204.** Amends D26 ("fails on any non-2xx"). The tick reads the due phase, then claims it; when another caller (cron-job.org and `tick.yml` at the same minute, or _Run now_) claims it in between, `executeSnapshot` refuses with `snapshot_running` or `snapshot_complete`. `runTick` (`lib/tick.ts`) maps those two refusals to `idle`, so the tick answers 204: the phase is held by someone, which is all the tick wanted. A 409 from the manual `POST /api/snapshot` does not change.
- **Rehearse now takes an advisory lock.** `createRehearsal` (`lib/rehearsal.ts`) runs its guards and the insert in one transaction that first takes `pg_advisory_xact_lock(1)` (the app's only advisory lock). Two presses at once used to both pass the pending check and create two rehearsals (about 84 quota calls for the duplicate); the second now waits and is refused as `pending`. No migration. PGlite serialises transactions, so the test proves the flow; the lock itself is proven only on Neon.
- **The run lock is 150 s.** Supersedes the 10 min figure in D18's claim bullets, D21's real-running guard and D27 rule 1, and plan §3.4/Phase 4's "10 min". `maxDuration` is 120 s on both routes that run the collector (`/api/snapshot`, `/api/tick`), so a `running` row older than 150 s belongs to a killed function. One constant, `RUN_STALE_AFTER_MS` in `lib/compute.ts` (pure, so `lib/queries` may import it), is read by the collector's claim, the rehearsal's real-running guard, the upstream banner (D27 rule 1) and /admin's live list (it replaces `LIVE_MS`). Nothing auto-closes the row: closing it as `failed` would switch off D27 rule 1 for exactly this case.
- **Logger shutdown is bounded.** `RunLogger.shutdown()` waits at most `LOG_SHUTDOWN_MS` (3 s) for inserts in flight; a line still in flight then counts in `failedWrites`, which the admin message already reports.
- **A worker's throw cuts the run.** When one collector worker throws (a repo error), it aborts the run's `AbortController`, and `collectAll` waits for every worker before rethrowing. A read the abort cut writes no row, no log line and gets no fallback, so no row lands after `finaliseCrashed` has closed the snapshot as failed.
- **The v1 retry wait is abortable.** The backoff sleep in `lib/sources/v1.ts` ends when the run's signal aborts (deadline or a worker's throw), instead of waiting out a Retry-After of up to 30 s.
- **Notify is capped at 115 s from the run's start.** `executeSnapshot` (`lib/run.ts`) races `notifyFinished` against what is left of `NOTIFY_CAP_MS = 115_000`; past it the notify is abandoned with one `notify.cut` runtime log line and the route still answers. Vercel would cut the whole function at 120 s anyway.
- **Accepted, not bounded:** the finalise and notify database calls (`finishSnapshot`, `listPhaseReports`, `getEventDetail`, `loadVerdictInput`, `setDiscordMessageId`) have no per-query timeout. Neon has shown no hang, and a per-query timeout would need a driver-level change. The 115 s cap above bounds the notify part of them; `finishSnapshot` before it is not bounded. Discord already has 5 s per call (`lib/discord-send.ts`).

## D44 — Data correctness: retry status and quota-call retries in the trace, `active` blocked; five limits accepted (2026-11-06, 08zs, owner, issue #123)

- **Fixed: `v1.retry` carries the status.** `OnAttempt` takes the status of the response that caused the retry (`lib/sources/types.ts`; null on the first attempt). `lib/sources/v1.ts` passes it, and the collector writes it as `http_status` on the `v1.retry` line.
- **Fixed: quota-call retries are counted.** `runTrace` (`lib/queries/admin.ts`) counts `v1.retry` lines with no union id on the quota row (a run makes one quota call) and in the total. `TraceCall.retries` is now always a number. The quota row on the run page shows it instead of a dash.
- **Fixed: `active` is a blocked roster key.** `BLOCKED_ROSTER_KEYS` (`lib/queries/blocked-keys.ts`) lists `active`, as plan §12.1 already did. It stays in `raw_json` and no read model, route, page, log or message returns it. The owner adds it to the CLAUDE.md hard-rule list.
- **Accepted: internal-fallback rows stay in deltas (N9), with no UI mark.** Amends D5's "No number in a delta depends on an undocumented endpoint": a delta may use an internal-fallback roster (`source = internal`), which the collector accepts only when it is `live: true` and has the same member data as `/v1`.
- **Accepted: re-run rows hours apart (N8).** Each side's head shows its own data time (`app/_ui/EventView.tsx`, the alliance page, `app/_ui/Status.tsx`). The caveat: the head shows hh:mm with no day, so a re-run on another day reads like the same day.
- **Accepted: `hasAvatar` and the avatar route can disagree.** `hasAvatar` comes from the shown roster row, and `/img/avatar/[uid]` serves the newest row's photo. They differ only when a player removes their photo between snapshots; the route does not fall back to a photo the player removed.
- **Accepted: `calls_used` on re-runs.** `calls_used` is the phase's total spend across attempts, and the quota fields describe the last attempt, so the rehearsal verdict's quota line holds only for a single-attempt phase. A fix would need a per-attempt column and a migration.
- **Accepted: the banner's query cost is not measured by a session.** The owner reads TTFB in Speed Insights (D36) after a release.
- **Accepted: the banner shows only the last attempt.** Already recorded in D27 "Limits".

## D45 — Tick heartbeat: a tick log, a watch route and one alert per silent hour (2026-11-06, 08zt, owner, issue #121)

Supersedes D30's "Not done" line (a tick log table and a no-tick alert), which this entry builds.

- **Log.** `tick_log` (`started_at`, `finished_at` null, `outcome` null; migration 0011). `POST /api/tick` writes the row after `authorize` and the query check pass and **before** `runTick`, so a function that is killed still leaves a row with no `finished_at`; after `runTick` it sets `finished_at` and the outcome (`idle`, `run`, `quota-check`, `rehearsal`). A tick that lost its phase to another caller is `idle` (D43). The insert keeps the newest 700 rows (about 7 days at 96 a day), like `app_errors`.
- **401 is not a heartbeat.** A tick with the wrong `CRON_SECRET` writes no row, so a secret left behind by a rotation (D30) also ends in the silence alert. `auth_attempts` already records the 401s.
- **Watcher.** `POST /api/tick/watch` (cron auth, the same limiter as the tick) reads the newest `tick_log.started_at`. When it is more than 60 min old, or no row exists, it claims alert id 2 and posts one admin message: "⚠ No tick for {min} min (last {at}) …", or "⚠ No tick recorded yet …". It takes no snapshot, spends no quota and answers 204. A second cron-job.org job calls it every 15 min.
- **Cadence.** One alert per silent hour, the same claim as the app-error alert (#103): `app_alerts` loses its `id = 1` CHECK and holds one row per kind (id 1 app error, id 2 tick silence). `claimAlert(db, id, now, gapMs)` in `lib/repo/app-errors.ts` is the one statement; `claimAppErrorAlert` calls it with id 1 and behaves as before.
- **/admin** shows the last tick's start in server time under Status, and the outcomes of the last five ticks, newest first.
- **Accepted:** a cron-job.org-wide outage stops both jobs, so no alert fires; cron-job.org emails on its own failures (D30's job notifies after 2 failures). The first watch call after the release that applies 0011 alerts "No tick recorded yet" if no tick has run since; the owner adds the watch job after the first tick row exists.

## D52 — Game terms: the game's own word in each language, English where it is unknown (2026-11-06, owner, 08zzb, issue #153)

Amends D23 and D48 ("Might, Kills, Members and Level stay English in every language"). Members read these four words in their game's own language, not in English, so each language shows the game's word where a source with the game's own text gives it.

- **Source rule.** A word is used only when its source carries the game's own text: datamined game text (lastasylum.gg serves it in en, ru, ko, vi and zh-TW) or an in-game screenshot. A guide's or shop's prose, a store review or a translator's choice is not a source. Research: issue #153 comment 6676547046.
- **Used.** ko: Might 전투력, Kills 처치, Members 인원 (the event rules' count word; 길드원 is a person). vi: Might Lực Chiến, Kills Tiêu diệt, Members Thành viên. ru: Might Мощь, Kills Убийства, Members Участники, nominative plural for headers and lower case after an abbreviation (`Мин. мощь`). The same word goes inside labels (`± 전투력`, `Lực Chiến thấp nhất`).
- **English.** Level in every language: the game writes a level as a prefix before the number (`Lv.10`, `ур.10`), not as a header, and no sourced header word exists. All four terms in ja (its only sources are a fan guide's prose and an ad listing) and in the other 13 languages (no source; sv, pl and uk are not game languages at all).
- **Where the words live.** `lib/i18n/glossary/<tag>.md`, section "Game terms (from the game)": English, word, source URL, quote. The translations test (`lib/copy.test.ts`) fails when a dictionary's `ledger.might`/`kills`/`members`/`level` differs from that table, or from English where the table has no row. The translator agent uses the table's word or English and never adds a row.
- **Blank mode.** The blank dictionary keeps the four terms of the page's language readable, as before.
- **Not done.** The game calls an alliance a guild in ko (길드) and vi (Công Hội); the dictionaries still say 연맹 and liên minh. Korean particles change with the word's last syllable, so it is a retranslation of those strings, not a swap.

## D53 — Movers: one ranking for the page and Discord, unusable sides left out, no "left" split (2026-11-06, owner, 08zze, issue #70)

The owner held two points of #70 until the first Saturday's data and on 2026-11-06 asked for the section in v1.1.0 with these defaults:

- **No "left" vs "lost in battle" split.** An alliance's might loss is shown as one number. When its members left, the change carries the D33 `*` ("Includes member changes"), as on the ledger. Revisit once Saturday's data shows whether losses are mostly leavers.
- **Unusable sides are left out.** An alliance or member with a missing, stale or failed Before or After is not ranked, as the Discord movers already did (INVARIANT freshness.no-stale-delta). A member read on one side only is not ranked either; they are in the joined/left counts.
- **One ranking.** `compute.topMovers(rows, metric, n, direction)` ranks the page's lists (`lib/queries/movers.ts`) and the Discord message's top gains (`lib/notify.ts`), so the two agree. A change of zero or of the other sign is not a mover. Equal changes keep the input order (alliances by union id, members by uid) and share a competition rank (1, 1, 3).
- **Sizes and keys** (owner, 2026-11-05): alliances top 3 per list, members top 5; members keyed by `uid` across every tracked alliance, a switcher counted under the After alliance.
- **Layout.** Segmented tabs (`Might ▲`, `Might ▼`, `Kills ▲`) in one card, picked by the owner from four variants on 2026-11-06. It sits under the ledger on the event page (amends DESIGN.md Navigation's "nothing else after the ledger") and between Leadership and the member list on the alliance page.

## D54 — Movers tabs lead with drawn marks (2026-11-06, owner, 08zzf, issue #70)

Amends DESIGN.md's language-light rule "no icons that need a culture to read (no skull for kills)" for one place. With the Rank tab the Movers card has four tabs, and at 360 px the game's words wrapped to a second line in ru and de. The owner asked for icons instead.

- **Marks.** A boxing glove for Might, a skull for Kills, a trophy for Rank: the brand's 16 px filled cut (`icon_might`, `icon_kills`, `icon_rank` in `docs/brand/drawing/examples/ornaments.py`; `lib/brand/components/MoverMarks.tsx`). A flexed arm was tried first and read as a sock at 16 px.
- **The word stays.** Below 640 px a tab shows its mark and arrow, with the word as screen-reader text; the open tab's `WORD ▲` heads its panel, so the word is one tap away. From 640 px the word shows beside the mark. Section headings, legend and every other label keep the game's word.
- **Only here.** Every other place still follows the no-culture-icon rule.

## D55 — A complete manual round is closed (2026-11-06, owner, 08zzg)

Amends issue 157's round card. Once both phases of a manual round are done, /admin shows it as one collapsed line (its name, "Round complete", ▾) that opens to its phases, facts and "Open on the site", read-only: no "Record again", no "Change options". To record again, the owner starts a new manual round. While a round is still running, "Record again" on a done phase and "Change options" stay as before.

- **UI only.** The manual-snapshot route still accepts `force` on a complete phase (D28); the page just no longer offers it for a complete round.
