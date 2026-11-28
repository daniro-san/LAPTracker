# feat-789-api-probe — one-off /v1 discovery read from production, Sun 2026-11-29 02:30 ST

Part of #789 (item 6, upstream API discovery). Owner's authorization in chat, 2026-11-28: the discovery runs from production on the server-side LAP_API_KEY; the key never comes to a local file.

## Built

- `lib/api-probe.ts`, modelled on `lib/shield-probe.ts`:
  - `API_PROBE_WINDOW`: `2026-11-29`, `02:30`–`02:45` ST (04:30–04:45 UTC). `apiProbeDue` opens the tick's gate (`lib/tick-gate.ts`), and `squadsBatch` runs `apiProbe` after the shield probe, inside the same `after` budget (`lib/squads-tick.ts`).
  - `API_PROBE_ALERT` = 5, claimed with `claimAlert` (7-day gap), so it runs at most once.
  - `PROBE_PATHS`: the owner's 12 paths, in the given order, sequential, paced by `PACE_MS` (500 ms).
  - Cap: every attempt is counted in `onAttempt` before it is sent, and the 13th throws, so at most 12 attempts go out. `probePath` sends no retry.
  - A 401, 403 or 429 stops the run (`status_401`/`status_403`/`status_429`).
  - Guards: `squads_busy` when the own alliance's `squad_reads` row for the day is `running`; `quota_low` when `remaining − 12 < squadsReserve(…)`, where `remaining` is what the squads read (or the daily read) left, as in the shield probe on our key; `no_daily` and `quota_unknown` when the start is not known.
  - `shape`/`render` ported from the local probe-789.mjs script: key paths, types, array lengths (a single length, or min/max/count). Numeric keys become `<numeric-key>`, other non-identifier keys become `<other-key>`. No value is kept.
- `probePath` in `lib/sources/v1.ts` (and on `V1Source`): GET one path once through the adapter's `request`, so the headers are the usual three (Bearer key, User-Agent, Accept). Returns `{ status, body, chars }`. A 404, 429 or other error status comes back as its status, with the error detail's redacted body start (D61). A request that gets no answer throws. `fakeV1` in `lib/collector.test-helpers.ts` gets a rejecting stub.
- Storage: `run_logs`, no migration. One `api.probe.path` line per path with `data = { path, status, chars, json, shape }` (`shape` is text, cut at 16,000 characters with a `…[cut: N more characters]` marker), and one `api.probe` line with `{ calls, paths_stored, quota_remaining_before, reason? }`. The lines' `read_day` is the quota day's daily read (`2026-11-28`). The console gets one line: `api.probe { calls, stored }`.
- `lib/api-probe.test.ts`: seven PGlite tests:
  - the window: only inside it; the window plus the whole `after` budget is outside every event window and every Raid Shield pass window;
  - at most once: two overlapping ticks plus a later tick, with ids 3 and 4 already stored;
  - structure without values: a seeded string sentinel, a number, the uid in the path and the quota number never appear in `run_logs`; the expected key paths do; a 404 that is not JSON stores `shape: null`; a 3,000-key answer is cut;
  - the cap of 12 attempts (each call reporting a retry stops after 6 paths), and a stop after a 429;
  - `quota_low`;
  - `squads_busy`;
  - the gate opens at 04:31Z with the queue settled, and `squadsBatch` runs the probe.
- D5: amendment 2026-11-28 records the owner's authorization, the 12 paths and the 12-call budget.

## Decisions

- Which decision to amend: D5 (data sources, /v1 use), not D137. This read is about the API itself, not the Raid Shield check.
- `app_alerts` id 5. Ids 1–4 are used (retired, tick silence, and issue 726's probes of 2026-11-23 and 2026-11-28). Id 4 was claimed 24 h before this window, so reusing it would be refused.
- `run_logs` over `app_errors.detail`. `run_logs.data` is jsonb, is read by SQL, and goes through the logger's `redact`. `app_errors` is for errors and is purged after 30 days.
- Paths are stored with a player's uid masked (`/players/[uid]`), as error messages show them (D115). The call itself uses the given uid.
- Reserve = `squadsReserve` only, without the Raid Shield check's 120: there is no shield read on Sunday's quota day.
- The squads-busy guard checks the own alliance's row only, as the shield probe does. Workspace-key alliances spend their own quota.
- `probePath` sends no retry (`maxRetries: 0`), so a 502/503/504 is one stored status, not three more calls.

## Deviations

- The script's "new key paths vs. fixtures" comparison is not ported: fixtures are not available in production. The comparison can be made afterwards from the stored shapes.
- The script printed `quota.remaining` from the answer. That is a value, so it is not stored. `quota_remaining_before` on the summary line is our own start figure, as on the shield probe's line.
- One test more than listed: a 429 stops the run.

## Verified

- `pnpm vitest run lib/api-probe.test.ts`: 7 passed.
- `pnpm vitest related --run` on the seven changed code files: 192 files, 1172 tests passed, 1 skipped.
- `pnpm check`: exit 0 (399 files passed, 2 skipped; 2165 tests passed, 4 skipped). The first runs failed on Prettier for the test file and ESLint's complexity limit on `shape`; both are fixed.
- I made no upstream call. The tests stub `probePath`.

## Open issues

- The logger's `redact` replaces the type after a private key name (for example `$.members[].x: …`). The key path still shows that the field exists, but its type is hidden. This is the intended behaviour for private fields.
- A key that looks like an identifier is kept as it is. If an answer is keyed by a player's name (an object keyed by nickname), those names would be stored as key paths. The known endpoints use arrays.
- One tick only: if cron-job.org skips the 04:30 UTC tick, or the squads read is still running then, nothing runs and there is no retry at 04:45.
- On LAP_API_KEY, the probe's 12 calls are not subtracted from `squad_reads.quota_remaining`. The next read corrects it from its first answer's quota.

## Next

- After 02:45 ST on Sun 2026-11-29 (04:45 UTC), run these read-only queries:

  ```sql
  -- 1. The claim: when the probe ran (no row: it never ran).
  select id, alerted_at from app_alerts where id = 5;

  -- 2. The run's counts and its reason, if it stopped.
  select at, level, data from run_logs where code = 'api.probe' order by at;

  -- 3. Each path's status, size and JSON structure, in call order.
  select at,
         data->>'path'   as path,
         data->>'status' as status,
         data->>'chars'  as chars,
         data->>'json'   as json,
         data->>'error'  as error,
         data->>'shape'  as shape
  from run_logs
  where code = 'api.probe.path'
  order by id;
  ```

  If query 2 shows `squads_busy`, `quota_low`, `no_daily` or `quota_unknown`, no call was made and query 3 is empty.
- Compare the shapes of `/alliances/67111155` and `/players/[uid]` with `lib/sources/shared.ts` (`rosterFields`) and `lib/sources/v1-player.ts` (`playerSchema`), and report the new fields and endpoints on #789. Report names, types and counts only. Private fields stay private.
- Removal follow-up (cleanup PR): delete `lib/api-probe.ts` and `lib/api-probe.test.ts`. Remove the `apiProbe` call and import in `lib/squads-tick.ts`, the `apiProbeDue` line and import in `lib/tick-gate.ts`, `probePath` in `lib/sources/v1.ts`, `probePath` and `ProbeAnswer` in `lib/sources/types.ts`, and the `probePath` stub in `lib/collector.test-helpers.ts`. Note the removal in D5. Optionally, `delete from app_alerts where id = 5`.

What was missing from the task prompt? Whether a probe that the squads read skips should try again on the 02:45 tick. I kept one window with no retry, as on the Saturday probe.

PR: (added by the orchestrator)
