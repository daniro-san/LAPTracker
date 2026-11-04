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
