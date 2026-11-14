# 08zzzn — Stale rows can be read again; one admin message per first phase (D63)

Owner request, 2026-11-14. The Before snapshot of Saturday Event 2026-11-14 came back partial: all 20 alliances stale, none failed. The owner asked how to run it again. No way existed: a re-run without force reads only failed and missing alliances (D62), and force is offered only on a complete snapshot. The admin channel also got the same partial message twice.

## Built
- `lib/collector-claim.ts` (new, split from `lib/collector.ts` for the 300-line limit): `RunRefusedError` (new reason `stale`, with `staleCount`) and `claim()`. A re-run without force and without `stale` is refused while the snapshot has stale rows (read, no error, `is_fresh = false`). With `stale: true`, the claim deletes every `is_fresh = false` row (the failed rows are among them) and the run reads those alliances again. `stale: false` is the D62 re-run. `lib/collector.ts` re-exports `RunRefusedError`; `runSnapshot` takes `{ force, stale }`.
- `lib/repo`: `clearFailedAllianceRows(snapshotId, stale)` deletes `is_fresh = false` rows when `stale`, else `error` rows as before (Postgres and in-memory).
- `lib/run.ts`: `gate()` holds the two refusals that need no claim: not due (moved, unchanged) and the new `event_started`. A scheduled Before with `stale=1` at or after `events.event_at_utc` gets 409 `event_started`; without `stale` it runs as D62 (stale rows kept, no question). `EventInfo` carries `eventAtUtc`. The `snapshot_stale` refusal carries `staleCount`; `lib/run-response.ts` sends it as `stale_count`.
- `app/api/snapshot/route.ts`: optional `stale=0|1`.
- `/admin` (`AdminActions.tsx`, `actions.ts`): on `snapshot_stale` it asks "{count} alliances in this snapshot are stale. Read them again? About {count + 1} API calls. Alliances that failed are read again too." Yes resends with `stale=1`; no stops. The same flow covers the manual round's buttons. Copy for `event_started` added to `lib/copy-admin.ts`.
- `lib/run-notify.ts`: the extra D31 admin post for a run that is not complete is skipped when this run just posted the event's admin message (new id). An edited message still gets its own post.
- Tests: `lib/freshness.test.ts` "re-runs ask before reading stale rows again, and with stale read only those (D63)"; `app/api/snapshot/route.test.ts` "refuses to read a scheduled Before's stale rows again once the event has started (D63)".
- Docs: D63 and its index entry; README "⚠ Partly done"; `.claude/rules/collector.md` checklist line; `docs/ARCHITECTURE.md` lists `lib/collector-claim.ts`.

## Decisions
- **The server asks, the page does not count.** /admin does not know a phase's stale count, so the route refuses with the count (as with `snapshot_complete`) and the page asks. No new query.
- **"No" stops.** Answering no to the stale question runs nothing, including the failed-only re-read. Callers that want the D62 re-run send `stale=0`.
- **The event-start limit applies to a scheduled Before only.** After snapshots and manual rounds have no limit. Before the event starts, a stale Before can be read again any number of times.
- **Duplicate message rule:** "just posted" = `sendOrEdit` returned an id different from the stored one (first post, or the stored message was gone, 404). A failed first post (null) still gets the second post, as before.

## Deviations
- `app/api/snapshot/route.test.ts` "finalises the snapshot as failed…" asserted two admin posts for a first-phase failure: the duplicate the owner reported. It now asserts one post containing "✗ Before snapshot: failed".
- `lib/collector-claim.ts` is a new file, required by `max-lines` (300) on `lib/collector.ts`.

## Verified
- `pnpm check`: prettier, eslint, typecheck, 260 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.
- Each new test fails when its change is removed (refusal off in `claim`, guard off in `gate`, `!posted` off in `run-notify`): 3 failed / 10 passed in the two files; restored afterwards.
- Not run: the /admin dialog in a browser. Reaching it needs a partial snapshot with stale rows on the current event, which only a real run creates (quota). The page code is typechecked and linted; the route answer it reads is covered by the collector test.
- The Neon branch in `.env.local` is a dev branch (newest snapshot id 8), so the production rows of the 2026-11-14 Before (Run 14) were not inspected.

## Open issues
- Why all 20 were stale is unknown. 21 calls in 5.4 s is fast for reads that pull from the game (§2 measured about 1.9 s each), which suggests the upstream answered from its cache without pulling. A re-read helps only once the upstream refreshes again.
- `tick.yml`'s manual dispatch (phase before/after) calls the route without `stale`; on a snapshot with stale rows it now gets 409 `snapshot_stale` and the job fails. The workflow was not changed.
- Pre-existing: a D62 re-run of a scheduled Before after the event has started still reads the failed and missing alliances, whose rosters then include the event's kills. Not changed here.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. The only rework was lint limits (file length, complexity).
Owner must do first: merge this PR into `dev` and release (patch). Today's After snapshot can be read again from /admin if it comes back stale; the Before can be read again only until the event's start time (`EVENT_TIME`).
Plan changes needed: none.

<adjustments>
- `POST /api/snapshot` without `stale` on a snapshot with stale rows answers 409 `snapshot_stale` with `stale_count`. Any new caller of the route must send `stale=0` or `stale=1`, or handle that answer.
- `EventInfo` now has `eventAtUtc`; code that builds an `EventInfo` by hand (tests) must set it.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/254
