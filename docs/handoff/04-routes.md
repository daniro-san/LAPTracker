# 04 — Routes, logger, notifications

## Built

- `lib/schema.ts` + `drizzle/0001_lowly_luckman.sql`:
  - new tables `run_logs` (FK to snapshots, level CHECK, index on snapshot_id), `auth_attempts` (key pk) and `app_errors` (index on at);
  - on `events`: `unique(event_at_utc)` and a `quota_checked_at` column.
- `lib/repo/`:
  - `run-logs.ts` (`insertRunLog`);
  - `auth-attempts.ts` (`recordFailure`: one atomic upsert with a window reset, plus a prune of rows older than 1 h; `currentCount`; `resetKey`);
  - `app-errors.ts` (`insertAppError` keeps the newest 500 rows; `lastAppErrorAt`);
  - `database.ts` (`databaseSizeBytes`);
  - `events.ts` gains `findOrCreateEvent`, `createTestEvent` and `claimQuotaCheck`.
- `lib/logger.ts`: `createRunLogger(sink, { snapshotId, secrets, now })`, plus `MAX_RUN_LOG_LINES = 400`, `stats()` and `shutdown()`. `Logger` and `consoleLogger` are unchanged.
- `lib/notify.ts`: `createNotifier` (public/admin, silent when the URL is unset), `publicSnapshotMessage` (the three Phase 6 templates) and `adminSnapshotMessage`.
- `lib/schedule.ts`: SERVER_TZ ↔ UTC through `Intl` (works for any IANA zone), `currentEvent`, `actionTimes`, `dueActions`, `nextEvent` and `describeInstant`.
- `lib/auth.ts`: `secretEquals` (sha256 on both sides, then `timingSafeEqual`), `authorize` (the §12.2 limiter) and `clientIp`.
- `lib/run.ts`: `executeSnapshot` (claim id captured, finalise and `logger.shutdown()` in `finally`, then notify) and `quotaReport` (the Friday check).
- `lib/run-response.ts`, `lib/route.ts` (`withContext`, `errorResponse`, `parseQuery`), `lib/app-context.ts` (`getAppContext`, `secretsOf`) and `lib/app-errors.ts` (`recordAppError`: at most 1 insert/s per instance, an admin alert at most once an hour, read from the DB).
- `lib/queries/events.ts`: `listEvents` and `getEventDetail`. Columns are listed one by one; `raw_json` and members are never selected.
- `lib/collector.ts`: a `v1.fetch` line per `/v1` call (quota check and alliance reads) with `endpoint, union_id, http_status, cached, duration_ms, quota_remaining`, plus `error` on failure. `trimRaw` moved to `lib/raw-json.ts`, unchanged, to keep the file under 300 lines.
- Routes:
  - `app/api/tick/route.ts`, replacing the 501 placeholder;
  - `app/api/snapshot/route.ts`;
  - `app/api/events/route.ts` and `app/api/events/[id]/route.ts`;
  - `app/api/quota/route.ts` and `app/api/quota/check/route.ts`.
- `instrumentation.ts`: `onRequestError` → `recordAppError`, nodejs runtime only.
- Tests:
  - `app/api/tick/route.test.ts` (2), replacing the placeholder test;
  - `app/api/snapshot/route.test.ts` (5);
  - `app/api/events/[id]/route.test.ts` (1);
  - `lib/logger.test.ts` (3);
  - 1 added in `lib/collector.test.ts`.
- Test helpers: `lib/db.test-helpers.ts` (PGlite, migrated from `drizzle/`) and `lib/app-context.test-helpers.ts`.
- `@electric-sql/pglite` 0.5.14, devDependency, exact pin (D19).
- `docs/DECISIONS.md` D19 and D20; `docs/ARCHITECTURE.md` (new lib modules, how routes get their deps, `Notifier`).

## Decisions

- **DB-backed tests use PGlite** (owner's choice, D19).
- **`test=1` on `/api/snapshot`** creates an `is_test` event dated now (owner's choice). Without it, a weekday dry run would create the coming Saturday's event and complete its BEFORE, and the real Saturday run would then be refused as `complete`.
- **Quota routes require auth.** Each request costs one `/v1` call, so they take Bearer CRON_SECRET or the PIN plus the limiter (D20).
- **Events are unique on `event_at_utc`**, and the Friday check is claimed through `events.quota_checked_at`. Both are race-safe the same way as the run lock (D20).
- **The tick** runs the earliest due action not yet done. A phase with a snapshot row of any status counts as done, so the tick never re-runs a failed or partial phase; that is a manual run (D20).
- **The crash path:** the route captures the claimed id by wrapping `repo.startSnapshot`, rather than calling `findSnapshot` afterwards as the adjustment suggested. `findSnapshot` could return another run's row if ours died before claiming. The row is closed as `failed` with 0 added calls and the real duration.
- **"shutdown()"** in the constraint and verify maps to `RunLogger.shutdown()`: it awaits inserts already in flight. The plan's Phase 6 says "no shutdown()/flush", meaning no buffer; there is none. The collector fires `v1.retry` without awaiting it, and that line is what `shutdown()` exists for (see Verified, mutation table).
- **The log cap:** at most 400 rows per run, and the 400th is `log.capped` (`{ max: 400 }`). That is my reading of "stops at MAX_RUN_LOG_LINES = 400 with a final log.capped line".
- **Credentials:** a missing or wrong bearer counts per IP only. A wrong PIN counts per IP and globally. A correct PIN resets the IP key. A correct CRON_SECRET is checked before any limit (§12.2: the tick is never locked out). The admin alert fires on the request whose global upsert returns exactly 20, so once per window with no extra state.
- **Error codes:** `unauthorized`, `rate_limited`, `pin_locked`, `bad_request`, `snapshot_running`, `snapshot_complete`, `event_not_found`, `not_found`, `run_failed`, `upstream_error`, `internal`.
- **Discord links** use the request origin, so no new env var is needed. `avatar_url` is left out until the Phase 5b PNG exists.
- **`GET /api/events/[id]`** serves the §12.1 alliance fields, plus `source`, `cached`, `source_updated_at` and `failed` (a boolean, not the error text). It serves no members, `server_rank` or `level`, because §12.1's list doesn't name the latter two.

## Deviations

- §6 `events`: added `unique(event_at_utc)` and `quota_checked_at` (D20).
- Phase 4 lists no auth on `GET /api/quota` and `/api/quota/check`; both require it here.
- §11.3 says "real local Postgres" for integration tests; they use PGlite (D19).
- Phase 6 "Logging guarantees": the failed-insert counter goes to the admin message (`run_logs write failures: N`), not into `RunSummary`, so the collector's types did not change.
- Branch: `claude/laughing-tesla-z7alwg` (assigned by the cloud harness), not `session/04-routes`.

## Verified

Node: the container started on v22.23.4. `bash scripts/cloud-setup.sh` (49 s) installed v26.13.0, pnpm 12.16.1 and gitleaks v8.30.1. Every command ran with `PATH=/opt/node26/bin:$PATH`. No upstream calls were made (0 quota).

`pnpm check` (14.8 s and 17.2 s wall, two runs):

```
All matched files use Prettier code style!
 Test Files  14 passed | 1 skipped (15)
      Tests  59 passed | 1 skipped (60)
```

The skipped test is the opt-in live smoke test. One PGlite open and migration takes ~4.0 s (measured once by itself); three test files open one each.

`pnpm build`: exit 0, and all routes are dynamic:

```
├ ƒ /api/events
├ ƒ /api/events/[id]
├ ƒ /api/quota
├ ƒ /api/quota/check
├ ƒ /api/snapshot
└ ƒ /api/tick
```

It prints one warning: `process.exit` in `register()` is not supported in the Edge runtime. The warning is the same with the committed `instrumentation.ts` restored (checked by building it), so it predates this session.

**Repo semantics on PGlite** (a probe test, since deleted):
- `recordFailure` counts 1, 2, then 1 again once the window has passed;
- `findOrCreateEvent` twice returns the same id;
- `claimQuotaCheck` returns true, then false;
- 503 `insertAppError` calls leave 500 rows (min id 4).

**`next start` smoke** with a dummy env (an unreachable `DATABASE_URL`, `.invalid` upstream hosts):

```
GET /api/events/abc            {"code":"bad_request"} -> 400
GET /api/events?x=1            {"code":"bad_request"} -> 400
GET /api/events/1?x=1          {"code":"bad_request"} -> 400
POST /api/tick                 {"code":"internal"} -> 500
POST /api/snapshot?phase=never {"code":"internal"} -> 500
GET /api/quota                 {"code":"internal"} -> 500
GET /api/events                {"code":"internal"} -> 500
DELETE /api/tick               -> 405
```

- Every response carries `content-security-policy: default-src 'none'; frame-ancestors 'none'`.
- The 500s come from the DB being unreachable. Auth runs first and needs the DB.
- The server log has one line, `app.error { route: '/api/events', message: 'route Error', digest: null }`. The 1/s limit suppressed the rest, and no message, stack or secret appears.

**Mutation checks.** Each mutant was applied, the named tests run, and the file restored from a scratch copy:

| Mutant | Result |
|---|---|
| logger cap `>` instead of `>=` | killed |
| logger skips `redact` | killed |
| logger rethrows sink errors | killed |
| no finalise in `finally` | killed (3/3 runs) |
| `logger.shutdown()` removed | killed (3/3 runs). It survived the first version of the crash test, because every line there was awaited. The test now fires a `v1.retry` without awaiting it, as the collector does, and makes only that insert slow (500 `setImmediate` yields), which models another pooled connection. |
| PIN accepted as a bearer | killed |
| `IP_LIMIT` 6 | killed |
| `GLOBAL_LIMIT` 21 | killed |
| CRON_SECRET subject to the global lockout | killed |
| limiter counts in a module-scope Map | killed (2 tests) |
| `getEventDetail` selects `raw_json` | killed |
| tick ignores an existing snapshot | killed |
| tick runs the later phase first | killed |
| no `v1.fetch` line on success | killed |

**Not testable here:** `secretEquals` vs `===`. Both give the same answers; only timing differs.

**Trace of `/api/snapshot`: every early return and throw** (`withContext` → handler → `executeSnapshot`):

1. `getAppContext()` throws (bad env): nothing is open yet. Next answers 500 and `onRequestError` records it. Boot already exits on a bad env.
2. `authorize` throws (DB down) → `withContext` catch → `recordAppError` → 500 `internal`; `finally` runs `close()`.
3. `authorize` returns 401 or 429 → return; `finally` runs `close()`.
4. `parseQuery` fails → 400; `close()` runs.
5. `createTestEvent` or `findOrCreateEvent` throws → as in 2.
6. `runSnapshot` refused before the claim (`running`, `complete`): `claimedId` is null, so nothing to finalise. `finally` awaits `logger.shutdown()`, then 409, then `close()`.
7. `findSnapshot` or `startSnapshot` throws before the claim: the catch logs `run.crashed` (dropped, no snapshot id). `finally` awaits `shutdown()`, then 500 `run_failed`, then `close()`. The first version returned 409 `snapshot_running` here; fixed during this trace.
8. The collector throws after the claim: the catch logs `run.crashed`. `finally` runs `finishSnapshot(failed)` in its own try/catch, then `shutdown()`. Notify, then 500 `run_failed`, then `close()`.
9. A refusal after the claim (`no-event`): `finally` finalises and shuts down. Notify, then 404, then `close()`.
10. `finishSnapshot` throws inside the finalise: caught, logged `snapshot.finalise_failed`. `shutdown()` still runs; it uses `allSettled` and cannot throw.
11. `notifyFinished` throws (it shouldn't: `send` and `listAllianceRows` are caught): the row is already final → `withContext` catch → 500, then `close()`.
12. Success: the collector finalises its own row. `finally` runs `shutdown()`. Notify, then 200, then `close()`.

Two fixes came out of this trace: path 7, and the duration of a crashed run, which had been recorded as 0.

**curl, one per route.** `$APP_URL`, `$CRON_SECRET` and `$EDIT_PIN` come from your shell; never paste values.

```bash
curl -i -X POST "$APP_URL/api/tick" -H "Authorization: Bearer $CRON_SECRET"
```

```bash
curl -i -X POST "$APP_URL/api/snapshot?phase=before" -H "Authorization: Bearer $CRON_SECRET"
```

```bash
curl -i -X POST "$APP_URL/api/snapshot?phase=after&force=1" -H "x-edit-pin: $EDIT_PIN"
```

```bash
curl -i -X POST "$APP_URL/api/snapshot?phase=before&test=1" -H "Authorization: Bearer $CRON_SECRET"
```

```bash
curl -i "$APP_URL/api/events"
```

```bash
curl -i "$APP_URL/api/events/1"
```

```bash
curl -i "$APP_URL/api/quota" -H "x-edit-pin: $EDIT_PIN"
```

```bash
curl -i "$APP_URL/api/quota/check" -H "Authorization: Bearer $CRON_SECRET"
```

The tick, snapshot and quota calls spend `/v1` quota: a snapshot ~21, quota 1. `/api/tick` spends nothing when it answers 204.

## Open issues

- **Migration 0001 is not applied anywhere but PGlite.** Neon main and preview need it before any route works (Session 8). The tables already exist from 0000.
- **Client IP is unverified:** `x-real-ip`, else the first `x-forwarded-for` hop. Whether Vercel overwrites both could not be checked; vercel.com is outside this session's network allowlist. Session 8 should confirm it from Vercel's request-headers docs. If clients can set them, the per-IP limit can be bypassed by rotating the header; the global 20/h lockout still holds.
- **`pnpm check` went from ~2.5–6.5 s to ~15–17 s**, from PGlite startup (~4 s per instance, 3 files). The Stop hook runs `pnpm check`, so every turn end pays it.
- **PGlite is not Neon's driver.** The WebSocket pool, connection limits and `pool.end()` with queries in flight are untested. `logger.shutdown()` runs before `close()`, so `close()` should never meet a pending insert.
- **`/admin/runs/<id>` and `/admin/errors` are linked from admin messages but don't exist yet** (Session 6 builds `/admin`). The app-error alert uses a relative `/admin/errors`, because `onRequestError` has no origin.
- **A dry-run AFTER through `test=1`** creates a second test event with no alliances and ends `failed`. Phase 7 only runs BEFORE; an AFTER dry run would need an `event` id parameter.
- **The tick never re-runs a failed or partial phase.** A BEFORE that failed at 10:05 is retried only by hand (`/admin`, which doesn't exist yet, or `workflow_dispatch`, Session 8). This follows §3.1's "no snapshot exists".
- **Dry runs post to the alliance channel too**, as Session 9's prompt expects ("watch both Discord messages"). A public "✅ Saturday ledger updated" on a Wednesday may confuse members. If that's unwanted, skipping the public message for `is_test` events is a one-line change in `lib/run.ts`.
- Pre-existing: `next build` warns about `process.exit` in `instrumentation.ts` `register()` (Edge runtime). It is harmless because register returns early outside nodejs, but the warning shows on every build.
- **No `v1.fetch` http status on success:** the adapter does not expose it, so success is recorded as 200 (D20).
- Still open from 03: plain re-runs never re-fetch error or stale rows; GitHub secret scanning and push protection.

## Next

Session: 5 — Adversarial review (read-only)
Model / effort: keep (fable · xhigh). §A sets it as the floor for Sessions 2–5. The measurable signal for keeping it: tracing `/api/snapshot` found 2 defects in code that already passed its tests (409 on a DB error before the claim; duration 0 on a crashed run), and the first shutdown test was vacuous. The review covers 17 new or changed lib/app modules.
Owner must do first: merge this PR into `dev`. Nothing from PREREQUISITES §6 is due before Session 5.
Plan changes needed:
- Phase 4: auth on `GET /api/quota` and `/api/quota/check`, and `test=1` on `/api/snapshot`.
- §6: `events` gets `unique(event_at_utc)` and `quota_checked_at`.
- §11.3: the integration tier is PGlite (D19).
- Phase 6 "Logging guarantees": "no shutdown()/flush" vs the Session 4 constraint. `RunLogger.shutdown()` awaits inserts in flight and buffers nothing; say that.
- Session 9 prompt, step 1: create the test event with `POST /api/snapshot?phase=before&test=1`, not by hand.

<adjustments>
- Files to review beyond Session 3's:
  - `lib/{logger,notify,schedule,auth,run,run-response,route,app-context,app-errors,raw-json}.ts`;
  - `lib/repo/{run-logs,auth-attempts,app-errors,database,events}.ts`;
  - `lib/queries/events.ts`;
  - `app/api/**/route.ts`, `instrumentation.ts`;
  - `drizzle/0001_lowly_luckman.sql`.
- The run lock is still `repo.startSnapshot`'s compare-and-set (Session 3). The routes add no second lock; `RunRefusedError('running')` maps to 409 in `lib/run.ts`.
- Logger: one INSERT per line. Lines before the claim are dropped (`snapshotId()` is null). The 400th row is `log.capped`. `shutdown()` awaits the collector's un-awaited `v1.retry` inserts. `lib/logger.ts` imports only `./redact` and a type from `./repo/run-logs`.
- Things decided here that a reviewer may flag, each recorded in D20:
  - quota routes behind auth;
  - client IP header trust (unverified);
  - `http_status: 200` assumed on success;
  - the tick skipping a phase whose row is failed or partial;
  - 0 calls recorded on a crashed run.
- DB-backed tests run on PGlite (`lib/db.test-helpers.ts`). Route tests replace `@/lib/app-context` with `vi.mock`. The crash test replaces `runSnapshot` and slows only the `v1.retry` insert.
</adjustments>

<adjustments for="Session 6">
- Read models exist: `listEvents(db)` and `getEventDetail(db, id)` in `lib/queries/events.ts` (no members, no `raw_json`). `/admin/runs/[id]` needs a new read model over `run_logs` (`code`, `level`, `at`, `union_id`, `data`); none exists yet.
- The PIN gate can reuse `authorize(headers, db, ctx, { allowPin: true })` from `lib/auth.ts`, which already rate-limits.
- "Run BEFORE/AFTER now" = `POST /api/snapshot?phase=…` with `x-edit-pin`. Codes to show: `snapshot_running` (409), `snapshot_complete` (409, offer force=1), `rate_limited`, `pin_locked` (429), `run_failed` (500).
- `GET /api/quota` spends 1 call per request: warn before calling it (Session 4 constraint).
</adjustments>

<adjustments for="Session 8">
- Apply `drizzle/0001_lowly_luckman.sql` to Neon main and preview: 3 tables, plus the `events` column and unique constraint.
- `tick.yml` posts `/api/tick` with `Authorization: Bearer $CRON_SECRET`. `workflow_dispatch` posts `/api/snapshot?phase=<input>` with the same header (add `&test=1` for dry runs).
- Verify in Vercel's docs that `x-real-ip` and `x-forwarded-for` are set by the edge and cannot be supplied by the client (`lib/auth.ts` `clientIp`).
</adjustments>

<adjustments for="Session 9">
- Dry run: `POST /api/snapshot?phase=before&test=1` (or `workflow_dispatch` with that query) creates the `is_test` event itself; don't create one by hand. Both Discord channels get messages.
- `run_logs` now has a `v1.fetch` line per `/v1` call with `duration_ms` and `cached`: the per-call timings and cached/not-cached counts can be read from the table instead of being timed by hand.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/13
