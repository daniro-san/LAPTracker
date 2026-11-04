# 05b — Fix review findings

Input: `docs/handoff/05-review.md` (review of `dev` at `52599bb`). Owner's choice: every Blocker, all Should-fix items, Notes only if trivial. The review has no Blockers.

## Built

| Finding | Change | Test that covers it |
|---|---|---|
| Blockers | None in the review. | — |
| S1. A manual run before `before_at` completes the coming Saturday's phase | `lib/run.ts` `executeSnapshot`: when `ctx.now() < req.event.beforeAt`, it returns 409 `snapshot_not_due` through `REFUSALS`. This happens before the claim and before the logger exists, so there is no snapshot row, no run log and no upstream call. `force=1` does not bypass it. An AFTER run on Saturday before `after_at` is still allowed. | `app/api/snapshot/route.test.ts` "refuses a manual run before the event's before_at, force included" (Wednesday 2026-11-04 12:00 UTC, `force=1`: 409, no snapshot row, `v1.calls` empty) |
| S2. A 429 mid-run leaves `stale` and `failed` empty | `lib/collector.ts` `finish`: every id in the run's list with no stored row is added to `failed` as `{ unionId, tag (from ALLIANCES), error: "not fetched: <run error>" }`. This also covers a quota refusal and the call cap. `lib/notify.ts` is unchanged: both templates and `runResponse` now name these alliances. | `lib/collector.test.ts` "stops on a 429 mid-run…", extended: `stale` is empty and `failed` equals exactly the ids without a row, with their config tags |
| S3. AFTER on an event with an empty alliance list spends the quota call and records `error: null` | `lib/collector.ts` `runSnapshot`: when `ids.length === 0`, it returns `finish(run, ids, phase, "no alliance list on the event: BEFORE has not run")` before `checkQuota`. Result: 0 calls, status `failed`, and the reason in the row and in the admin message. The route still answers 200 (an expected `failed` run), so the row can be re-run. | `lib/collector.test.ts` "fails an AFTER run on an event with no alliance list without a quota call" |
| N4. `secretsOf` omits `DATABASE_URL` | `lib/app-context.ts`: `DATABASE_URL` is added to `secretsOf` (one line, trivial). | `lib/logger.test.ts` "redacts DATABASE_URL, which carries the database password" |

Also committed: `docs/handoff/05-review.md`, which was untracked in the main checkout. Its Open issues allowed 5b to add it.

## Decisions

- S1 is enforced in `executeSnapshot` and not in the route. The tick and rehearsals also call `executeSnapshot`, but they only run a phase whose time has passed (`duePhases` uses `[x_at, x_at + W)`), so the guard never fires for them.
- The S1 guard runs after `findOrCreateEvent` in the route. A Wednesday press can therefore create the coming Saturday's event row with `alliance_ids = []`. This is the same row the tick creates a day ahead (insert-or-nothing), so it does no harm.
- S2 applies to every finish where ids have no row, not only to a 429. That is the wording of the review's fix ("every id in `ids` without a row").

## Deviations

- None from the review's proposed fixes. In `executeSnapshot`, the S1 comment is above the function and the `if` has no braces, to stay within the 50-line `max-lines-per-function` lint limit.

## Verified

- `pnpm check` (prettier, eslint, tsc, vitest), Node v26.13.0: `Test Files 16 passed | 1 skipped (17)`, `Tests 71 passed | 1 skipped (72)`, 2.5 s. The 68 earlier tests plus 3 new tests; the 429 test was extended.
- Mutation check: I restored `lib/run.ts`, `lib/collector.ts` and `lib/app-context.ts` from `dev` and kept the new tests. Result: exactly the 4 new or extended tests fail (`4 failed | 67 passed`). Then I restored the fixes.
- `app/api/snapshot/route.test.ts` auth matrix (`phase=after`, two 200s) still passes with S3. The first AFTER is now `failed` with a named error and 0 calls, and the second one re-runs it.
- `pnpm build` exits 0. It prints one Turbopack warning: `process.exit` in `instrumentation.ts` is not supported in the Edge Runtime. That warning was already there and is recorded in handoffs 01 and 04.
- No upstream calls and no DB other than PGlite.

## Open issues

- Notes not taken (not trivial, or an owner decision): N1 (verdict quota line undercounts after a trailing failed attempt), N2 (alert cadence and multi-instance), N3 (the tick answers 409 when a manual run took the phase first), N5 (`logger.shutdown()` has no upper bound), N6 (migration 0002 needs an empty `events` table), N7 (two "Rehearse now" presses in the same second), N8 (re-run rows can be hours apart), N9 (`source = internal` rows enter deltas), N10 (client IP trust), N11 (partial template says "old data" for alliances that returned nothing; with S2, "not fetched" alliances now appear under that wording too).
- Still open from 03/04: plain re-runs never re-fetch error or stale rows; migrations 0001/0002 are not applied on Neon; GitHub secret scanning and push protection.

## Next

Session: 6 — UI: main table + alliance page, mobile-first
Model / effort: keep (sonnet · medium). The session is UI and seed work on read models that already exist. This session changed no query or read model: the diff touches `lib/run.ts`, `lib/collector.ts` and `lib/app-context.ts` only.
Owner must do first: merge this PR into `dev`.
Plan changes needed (do not edit in 6):
- §3.1 manual fallback: "allowed only at or after the event's `before_at`; earlier presses answer 409 `snapshot_not_due`".
- Phase 3 pseudocode / §3.4: AFTER on an event with no alliance list fails with "no alliance list on the event: BEFORE has not run" and makes no quota call.
- Phase 6 partial template: alliances with no row are listed in `failed` as "not fetched: …".
- The plan-change items for N1 and N2 from 05-review.md stay as they are.

<adjustments>
- `/admin` "Run BEFORE/AFTER now": before the event's `before_at` (from Wednesday 12:00 UTC on, the current event is the coming Saturday), `POST /api/snapshot` answers 409 `{ code: "snapshot_not_due", snapshot_id: null }`. Show that as "not due until <before_at>", not as an error, or disable the button until then.
- In a run response, `failed` now also lists alliances the run never fetched (429, quota refusal, call cap, missing list). Their stored error starts with `not fetched: `. The admin run view can show it as it is.
- A snapshot can be `failed` with 0 calls and error "no alliance list on the event: BEFORE has not run". The status chips should show the error line, not only "failed".
</adjustments>

<adjustments for="Session 8">
- N3 is still open: a tick that loses a phase to a manual run answers 409, and `curl --fail` in `tick.yml` makes that a red run. Either accept it or map the tick's refusal to 2xx before Session 8.
</adjustments>
