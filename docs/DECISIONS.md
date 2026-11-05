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
