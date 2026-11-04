# Review checklist

Read by `/code-review` on every change that touches `lib/` or `app/api/`. Review against docs/IMPLEMENTATION_PLAN.md, not against taste. Report only findings that affect correctness, the quota guarantees or stated requirements, as: file:line, what the plan requires, what the code does, severity (blocker / should-fix / note), a one- or two-sentence fix. Put everything else under Notes.

## Freshness and deltas (plan §3.7)

- [ ] Can a snapshot be marked `complete` with any row whose `source_updated_at` is older than 20 min? Trace the `/v1` path, the internal fallback path and a re-run.
- [ ] Can a delta ever be displayed when either side is stale, or between a roster number and a board number?
- [ ] Does the AFTER run ever use a different alliance list than the event's copy (`events.alliance_ids`)?

## Quota and bounded work (plan §3.4, §4, Phase 6 "Logging guarantees")

- [ ] Is `MAX_UPSTREAM_CALLS` counted on every upstream call, retries and quota checks included?
- [ ] Does a run abort on `429` and retry only `502/503/504` (max 3)?
- [ ] Can the exception cap be bypassed by aggregated events?
- [ ] Is the run lock race-safe for one scheduler plus one human (a conditional update or unique constraint; read-then-write is not acceptable)?

## Source boundary (plan §3.5)

- [ ] Does any code path call the internal refresh endpoint, or send Origin/Referer/cookie headers to the site?
- [ ] Is `lib/sources/internal.ts` used for anything beyond the ranks board and the `live: true` roster fallback?

## Logger (plan Phase 6)

- [ ] Can a logger failure (DB down) abort or delay a run? Can the logger ever call itself?
- [ ] Does every `data` object pass through `lib/redact.ts`? Do log lines carry ids, counts and codes only, no names?

## Secrets (plan §12.2)

- [ ] Any place a key, PIN or secret could reach logs, the public webhook, a response body or git?
- [ ] `CRON_SECRET` and `EDIT_PIN` compared with `timingSafeEqual`; PIN failures rate-limited in Postgres; the global lockout never blocks the cron secret.

## Blocked roster keys (plan §12.1)

- [ ] No query in `lib/queries`, route, page, `run_logs` line or Discord message reads or returns `BLOCKED_ROSTER_KEYS` (`x`, `y`, `online`, `last_online_at`, `joined_at`, `daily_honor`, `daily_tech`, `avatar_url`). They live only in `raw_json`.
- [ ] `lib/queries/blocked-keys.test.ts` still scans every read-model file, and the route test for `GET /api/events/[id]` runs `findBlockedKeys` on the real response body.
- [ ] Player pages expose only name, uid, alliance tag, power, kills, lv and event dates.

## Tests

- [ ] Tests that assert the wrong thing or pass vacuously (e.g. a detector that never sees a positive case, a mock that makes the assertion trivially true).
- [ ] A change to `lib/compute.ts`, `lib/collector.ts` or `lib/sources/*` ships with a test.
