# 04 — Routes, logger, notifications

This session first implemented the Session 4 prompt as it stood when it started. PRs #11 and #12 rewrote that prompt on `dev` during the session (event-driven tick, rehearsals). The owner asked for the PR to be extended to the new prompt, but #13 had already been merged at 22:06 UTC with the first version (head `ccaabb9`). The extension is therefore a follow-up PR on the same branch: migration 0002 on top of the merged 0001, and D21 appended after the merged D20. Everything below describes the state after the follow-up.

## Built

- **Schema** (`lib/schema.ts`; `drizzle/0001_lowly_luckman.sql` merged in #13, `drizzle/0002_woozy_yellow_claw.sql` in the follow-up):
  - new tables `run_logs`, `auth_attempts`, `app_errors` and `rehearsal_slots`;
  - `events`: `before_at` and `after_at` (NOT NULL, as 3b asks), `quota_checked_at`, and `unique(event_at_utc)`;
  - `snapshots`: `quota_remaining_before`.
- **`lib/repo/`:**
  - `run-logs.ts`, `auth-attempts.ts` (an atomic upsert with a window reset, plus pruning), `app-errors.ts` (keeps the newest 500 rows) and `database.ts` (`pg_database_size`);
  - `events.ts`: `findOrCreateEvent` (with its times), `duePhases` (DB windows, no snapshot row, earliest first) and `claimQuotaCheck`;
  - `rehearsals.ts`: `claimSlot`, `setSlotOutcome`, the guard queries, `insertRehearsal`, `pruneRehearsals` and `loadVerdictInput`.
- **`lib/logger.ts`:** `createRunLogger` with `MAX_RUN_LOG_LINES = 400`, `stats()` and `shutdown()`; `Logger` and `consoleLogger` are unchanged.
- **`lib/notify.ts`:**
  - `createNotifier`: `public`, and `admin(content, { test })` with a `[TEST]` prefix;
  - `publicSnapshotMessage` (the Phase 6 templates);
  - `adminSnapshotMessage` (with "scheduled …, started …");
  - `rehearsalVerdictMessage`.
- **`lib/schedule.ts`** (pure): SERVER_TZ ↔ UTC through `Intl`, `currentEvent`, `eventsToCreate`, `nextEvent`, `quotaCheckDue`, `rehearsalSlotsDue`, `serverWeekday` and `describeInstant`.
- **`lib/tick.ts`:** `runTick`, the §3.1 decision.
- **`lib/rehearsal.ts`:** `createRehearsal` (the guards, insert and retention) and the pure `rehearsalVerdict`.
- **`lib/auth.ts`:** `secretEquals`, `authorize(…, { cron, pin })` (the §12.2 limiter) and `clientIp`.
- **`lib/run.ts`:**
  - `executeSnapshot` captures the claim id, then in `finally` finalises a crashed row and awaits `logger.shutdown()`;
  - after that it notifies: public unless the event is a test event, admin with `[TEST]` for test events, and the verdict after a test event's AFTER;
  - `quotaReport` is the Friday check.
- **Route plumbing:** `lib/route.ts`, `lib/app-context.ts`, `lib/app-errors.ts` and `lib/run-response.ts`.
- **`lib/queries/events.ts`:** `listEvents` and `getEventDetail`. Columns are listed explicitly; no `raw_json`, no members, no test events.
- **`lib/env.ts`:** `REHEARSAL_AT` (default `fri 18:00`; an empty value means off) and `REHEARSAL_KEEP` (default 4); `.env.example` lists both.
- **`lib/collector.ts`:**
  - a `v1.fetch` line per `/v1` call;
  - it records `quota_remaining_before`;
  - `trimRaw` → `lib/raw-json.ts` and `describe`/`httpStatusOf` → `lib/upstream-errors.ts`, both unchanged, to stay under 300 lines.
- **Routes:** `app/api/{tick,snapshot,rehearsal,events,events/[id],quota,quota/check}/route.ts`.
- **`instrumentation.ts`:** `onRequestError` → `recordAppError`.
- **Tests** (16 files, 68 passing + 1 skipped):
  - `app/api/tick/route.test.ts` (4);
  - `app/api/snapshot/route.test.ts` (5);
  - `app/api/rehearsal/route.test.ts` (4);
  - `app/api/events/[id]/route.test.ts` (1);
  - `lib/logger.test.ts` (3);
  - `lib/rehearsal.test.ts` (3);
  - `lib/collector.test.ts`: 1 test and 1 assertion added.
- **Test helpers:** `lib/db.test-helpers.ts` (PGlite migrated from `drizzle/`) and `lib/app-context.test-helpers.ts`.
- **Dependency:** `@electric-sql/pglite` 0.5.14 (dev, exact pin, D19).
- **Docs:** `docs/DECISIONS.md` D19, D20 (merged in #13) and D21 (the follow-up; it supersedes D20's `test=1` and tick bullets); `docs/ARCHITECTURE.md`.

## Decisions

All of these are in D19, D20 and D21. The ones a reviewer should know first:

- **DB-backed tests run on PGlite** (owner's choice, D19).
- **The tick does one thing per call:**
  1. it creates the coming Saturday's row, silently, from 24 h before BEFORE;
  2. it runs the earliest open phase that has no snapshot row of any status;
  3. otherwise the Friday check;
  4. otherwise a `REHEARSAL_AT` slot.

  A failed or partial phase is never re-run by the tick.
- **`REHEARSAL_AT` slots are claimed rows (`rehearsal_slots`).** Each slot runs once, and a skipped slot gets exactly one `[TEST]` admin note. Window: `SNAPSHOT_WINDOW_MIN` from the slot time.
- **Rehearsal guards:**
  - start or AFTER on `EVENT_WEEKDAY` or the next day → `rehearsal_event_day`;
  - a real BEFORE in (now, now + 3 h] → `rehearsal_before_real`, checked against both the DB rows and the env-computed coming Saturday;
  - a real snapshot running → `rehearsal_real_running`;
  - a pending rehearsal → `rehearsal_pending`.
- **The verdict's quota line:** the quota check's response already counts itself, so a run's drop is `quota_remaining_before − quota_remaining_after + 1`, and it must equal `calls_used`. That needs the new `snapshots.quota_remaining_before` column, written by the collector.
- **The verdict is posted after any test event's AFTER** (tick or manual), computed from the DB, so `/admin` can recompute it.
- **Credentials:** the tick takes CRON_SECRET only, the rehearsal route the PIN only, the others either. The quota routes need auth because each call spends quota.
- **The crash path** captures the claimed id by wrapping `repo.startSnapshot`, instead of calling `findSnapshot` afterwards. The row is closed `failed` with 0 added calls and the real duration.
- **"shutdown()"** in the constraint and verify is `RunLogger.shutdown()`: it awaits inserts in flight (the collector's un-awaited `v1.retry`). Nothing is buffered.
- **Log cap:** at most 400 rows per run, the 400th being `log.capped`.

## Deviations

- §6: `events.unique(event_at_utc)`, `events.quota_checked_at`, `snapshots.quota_remaining_before` and the `rehearsal_slots` table are not in the plan (D20, D21).
- Phase 4 lists no auth on the quota routes; both require it.
- §11.3 says "real local Postgres"; the tests use PGlite (D19).
- Phase 6 "Logging guarantees": the failed-insert counter goes into the admin message (`run_logs write failures: N`), not into `RunSummary`.
- Branch: `claude/laughing-tesla-z7alwg`, assigned by the cloud harness.
  - The branch started from `main`, so `origin/dev` was merged in (no conflicts) and the PRs target `dev`.
  - After #13 merged, `dev` was recorded as merged with `-s ours`, which is exact because `dev`'s tree equalled the branch's pre-extension tree. The follow-up was not rebased, because `git push --force*` is denied by `.claude/settings.json`.

## Verified

- **Node:** the container started on v22.23.4. `bash scripts/cloud-setup.sh` (49 s) installed v26.13.0, pnpm 12.16.1 and gitleaks v8.30.1. Every command ran with `PATH=/opt/node26/bin:$PATH`.
- **Quota:** 0 upstream calls this session.

`pnpm check` (15.7 s wall):

```
All matched files use Prettier code style!
 Test Files  16 passed | 1 skipped (17)
      Tests  68 passed | 1 skipped (69)
```

`pnpm build`: exit 0, and all routes are dynamic:

```
├ ƒ /api/events
├ ƒ /api/events/[id]
├ ƒ /api/quota
├ ƒ /api/quota/check
├ ƒ /api/rehearsal
├ ƒ /api/snapshot
└ ƒ /api/tick
```

The one build warning (`process.exit` in `register()`, Edge runtime) also appears with the committed `instrumentation.ts`, so it predates this session.

**The new spec's tests**, as named in the prompt:

- tick creates the Saturday event once and never twice: rows appear at Fri 12:05 UTC (a day before BEFORE), not at 11:45, with `before_at` 12:00 / `after_at` 16:00 UTC on Saturday;
- REHEARSAL_AT once per slot per week, never on the event day or the day after: slots `wed 18:00, sat 18:00, sun 09:00` over two weeks → 2 rehearsals, 2 `event-day` skips, 2 `[TEST]` notes;
- the 3 h guard: 409 `rehearsal_before_real` at 2 h 59 min before, 201 at 3 h 01 min;
- REHEARSAL_KEEP: the oldest rehearsal and its snapshot, alliance row, member row and run_logs line are deleted;
- a rehearsal created at T runs BEFORE at T+15 and AFTER at T+45: 204 at T+14, T+30, T+44 and T+50;
- verdict: PASS on a fresh pair; FAIL `updated_at did not advance: A2`; FAIL `calls_used ≠ quota drop: after 4 ≠ 6`;
- test events post to admin only: 0 public posts, 3 admin posts all prefixed `[TEST]`, the last `[TEST] Rehearsal PASS|FAIL (event N)`.

**Mutation checks.** Each mutant was applied, the named tests run, and the file restored from a scratch copy; all are killed:

| Area | Mutants |
|---|---|
| logger | cap `>` vs `>=`; no redact; sink errors rethrown |
| snapshot route | no finalise in `finally`; no `logger.shutdown()` (killed only after the crash test fired an un-awaited `v1.retry` with a slow insert; the first version was vacuous) |
| auth | PIN accepted as a bearer; `IP_LIMIT` 6; `GLOBAL_LIMIT` 21; CRON_SECRET under the lockout; limiter in a module-scope Map |
| read models | `raw_json` selected |
| tick | ignores an existing snapshot; runs the later phase first; Saturday row 2 days ahead; slot not claimed |
| rehearsal | no event-day guard; 3 h guard as 2 h; 3 h guard as 4 h (survived as 2 h until the test moved to the boundary); keep one more; BEFORE at +10 |
| notify | test events go public; no `[TEST]`; no verdict after AFTER |
| verdict | quota drop without +1; `updated_at` equal counts as advanced |
| collector | no `v1.fetch` line on success |

**Not testable here:** `secretEquals` vs `===`. Both give the same answers; only timing differs.

**`next start` smoke** (before the rehearsal extension) with a dummy env and an unreachable DB:
- bad input → 400 `{"code":"bad_request"}`;
- DB-dependent routes → 500 `{"code":"internal"}`, with no message or stack;
- every API response carries `default-src 'none'; frame-ancestors 'none'`;
- one `app.error` log line, holding only the route pattern and the error class.

**Trace of `/api/snapshot`: every early return and throw** (`withContext` → handler → `executeSnapshot`):

1. `getAppContext()` throws (bad env): nothing is open. Next answers 500 and `onRequestError` records it.
2. `authorize` throws (DB down) → `withContext` catch → 500 `internal`; `finally` runs `close()`.
3. `authorize` returns 401 or 429 → return; `close()`.
4. `parseQuery` fails → 400; `close()`.
5. `findOrCreateEvent` throws → as in 2.
6. Refused before the claim (`running`, `complete`): nothing to finalise. `finally` awaits `logger.shutdown()`, then 409, then `close()`.
7. `findSnapshot` or `startSnapshot` throws before the claim: `run.crashed` is logged (dropped, no snapshot id). `shutdown()`, then 500 `run_failed`, then `close()`. This returned 409 until the trace caught it.
8. The collector throws after the claim: `run.crashed`. `finally` runs `finishSnapshot(failed)` in its own try/catch, then `shutdown()`. Notify, then 500, then `close()`.
9. A refusal after the claim (`no-event`): finalised and shut down. Notify, then 404, then `close()`.
10. `finishSnapshot` throws inside the finalise: caught and logged; `shutdown()` still runs (it uses `allSettled`).
11. `notifyFinished` throws (`loadVerdictInput` for a test event, or a bug): the row is already final → 500 via the `withContext` catch, then `close()`.
12. Success: `shutdown()`. Notify, then 200, then `close()`.

**curl, one per route.** `$APP_URL`, `$CRON_SECRET` and `$EDIT_PIN` come from your shell; never paste values.

```bash
curl -i -X POST "$APP_URL/api/tick" -H "Authorization: Bearer $CRON_SECRET"
```

```bash
curl -i -X POST "$APP_URL/api/rehearsal" -H "x-edit-pin: $EDIT_PIN"
```

```bash
curl -i -X POST "$APP_URL/api/snapshot?phase=before" -H "Authorization: Bearer $CRON_SECRET"
```

```bash
curl -i -X POST "$APP_URL/api/snapshot?phase=after&force=1" -H "x-edit-pin: $EDIT_PIN"
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

Quota cost: a snapshot ~21 calls; a rehearsal ~45 over ~50 min, spent by the ticks; quota 1. `/api/tick` costs nothing when it answers 204.

## Open issues

- **Migrations 0001 and 0002 are applied only in PGlite.** Neon main and preview need both before any route works.
  - 0002's `ALTER TABLE events ADD COLUMN before_at … NOT NULL` fails if `events` already has rows (0001 may already have been applied after #13 merged; that would not add rows by itself). Check with `select count(*) from events` first. If there are rows, delete the test rows or add the columns nullable, backfill them, then set NOT NULL.
- **Vercel env:** the owner reports adding the rehearsal variable(s) and fixing one value during the session. Unverified from here. An empty `REHEARSAL_AT` turns rehearsals off; unset means `fri 18:00`.
- **Client IP is unverified:** `x-real-ip`, else the first `x-forwarded-for` hop. If clients can set these, the per-IP limit can be bypassed; the global 20/h lockout still holds.
- **Two simultaneous "Rehearse now" presses** can both pass the pending check (read-then-insert) and create two rehearsals. Scheduled slots can't race.
- **No verdict is posted if a rehearsal's AFTER never runs** (missed window, dead tick). The missing message is the signal.
- **The tick never re-runs a failed or partial phase.** That is manual (`/admin`, Session 6, or `workflow_dispatch`, Session 8), following §3.1.
- **`pnpm check` went from ~2.5–6.5 s to ~15–17 s**, from PGlite startup (~4 s per instance, 4 files). The Stop hook pays it on every turn end.
- **PGlite is not Neon's driver.** The WebSocket pool and `pool.end()` are untested; `logger.shutdown()` runs before `close()`.
- **`/admin/runs/<id>`, `/admin/runs` and `/admin/errors` are linked from admin messages but don't exist yet** (Session 6). The app-error alert uses a relative `/admin/errors`.
- **No `v1.fetch` http status on success:** recorded as 200 (D20).
- Pre-existing: the `process.exit` Edge warning on every build.
- Still open from 03: plain re-runs never re-fetch error or stale rows; GitHub secret scanning and push protection.

## Next

Session: 5 — Adversarial review (read-only)
Model / effort: keep (fable · xhigh). §A sets it as the floor for Sessions 2–5. Measurable reasons:
- tracing `/api/snapshot` found 2 defects in code that already passed its tests;
- 2 tests were vacuous until mutation checks caught them (the shutdown test, the 3 h guard);
- the scope doubled mid-session: 23 new or changed lib/app modules.

Owner must do first: merge this PR into `dev`. Nothing from PREREQUISITES §6 is due before Session 5.

Plan changes needed:
- Phase 4: auth on the quota routes.
- §6: `events.unique(event_at_utc)`, `events.quota_checked_at`, `snapshots.quota_remaining_before` and the `rehearsal_slots` table.
- §3.1 verdict: "the drop in quota_remaining between its first and last response" is `first − last + 1`, because the first response counts itself. Say so, or the check reads as off by one.
- §11.3: the integration tier is PGlite.
- Phase 6 "Logging guarantees": "no shutdown()/flush" vs the constraint. `RunLogger.shutdown()` awaits in-flight inserts and buffers nothing.

<adjustments>
- Files to review beyond Session 3's:
  - `lib/{logger,notify,schedule,tick,rehearsal,auth,run,run-response,route,app-context,app-errors,raw-json,upstream-errors}.ts`;
  - `lib/repo/{run-logs,auth-attempts,app-errors,database,events,rehearsals}.ts`;
  - `lib/queries/events.ts`;
  - `app/api/**/route.ts`, `instrumentation.ts`;
  - `drizzle/0001_lowly_luckman.sql`, `drizzle/0002_woozy_yellow_claw.sql`.
- The run lock is still Session 3's compare-and-set in `repo.startSnapshot`; `RunRefusedError('running')` → 409 in `lib/run.ts`.
- Due phases come from `events.before_at` and `after_at` (`duePhases`). The env only creates Saturday rows (`eventsToCreate`). A Saturday row's times are fixed when the row is created, a day ahead: changing `SNAPSHOT_BEFORE` after that does not move that week's run.
- Logger: one INSERT per line; lines before the claim are dropped; the 400th row is `log.capped`; `shutdown()` awaits the collector's un-awaited `v1.retry` inserts.
- Choices to check against the plan, each in D20 or D21:
  - the quota routes behind auth;
  - client IP header trust (unverified);
  - `http_status: 200` assumed on success;
  - the tick skipping phases whose row is failed or partial;
  - 0 calls recorded on a crashed run;
  - verdict quota = `before − after + 1`;
  - the pending-rehearsal race on the button.
- Route tests replace `@/lib/app-context` with `vi.mock` and run on PGlite (`lib/db.test-helpers.ts`). The crash test replaces `runSnapshot` and slows only the `v1.retry` insert.
</adjustments>

<adjustments for="Session 6">
- **Read models:** `listEvents(db)` and `getEventDetail(db, id)` exist in `lib/queries/events.ts`. They exclude test events, members and `raw_json`.
- **Needed and not built:**
  - an admin read model over `run_logs` (`at`, `level`, `code`, `union_id`, `data`);
  - one for rehearsals (test events with their snapshots).
- **The last verdict** can be recomputed with `rehearsalVerdict(await loadVerdictInput(db, eventId), env.SNAPSHOT_WINDOW_MIN)` (`lib/rehearsal.ts`, `lib/repo/rehearsals.ts`).
- **"Rehearse now"** = `POST /api/rehearsal` with `x-edit-pin`:
  - 201 `{ event_id, before_at, after_at }`;
  - 409 `rehearsal_event_day | rehearsal_before_real | rehearsal_real_running | rehearsal_pending`;
  - 429 `rate_limited | pin_locked`.
- **"Run BEFORE/AFTER now"** = `POST /api/snapshot?phase=…` with `x-edit-pin`. Codes: `snapshot_running` (409), `snapshot_complete` (409, offer `force=1`), `run_failed` (500).
- **The PIN gate** can reuse `authorize(headers, db, ctx, { cron: false, pin: true })`.
- **`GET /api/quota`** spends 1 call per request: warn before calling it.
</adjustments>

<adjustments for="Session 8">
- Apply `drizzle/0001_lowly_luckman.sql` and `drizzle/0002_woozy_yellow_claw.sql` to Neon main and preview, after checking that `events` is empty: 0002's NOT NULL `before_at`/`after_at` columns can't be added to existing rows.
- `tick.yml`: `*/15 * * * *` → `POST /api/tick` with `Authorization: Bearer $CRON_SECRET`. `workflow_dispatch` → `POST /api/snapshot?phase=<input>` with the same header.
- Step 4's rehearsal: `POST /api/rehearsal` takes `x-edit-pin` only (CRON_SECRET is refused there by design).
- Verify in Vercel's docs that `x-real-ip` and `x-forwarded-for` are set by the edge (`lib/auth.ts` `clientIp`).
- Confirm `REHEARSAL_AT` holds a value (not empty) and `REHEARSAL_KEEP` is a number. The owner set them during Session 4; their values were not checked here.
</adjustments>

<adjustments for="Session 9">
- Admin messages for a rehearsal arrive as `[TEST] … snapshot …` twice, then `[TEST] Rehearsal PASS|FAIL (event N)` with six ✅/❌ lines. A `calls_used ≠ quota drop` line names the phase and both numbers; if anything else used the key during the rehearsal, this line fails.
- `run_logs` has a `v1.fetch` line per `/v1` call with `duration_ms` and `cached`: read the per-call timings and the cached/not-cached counts from there.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/14
