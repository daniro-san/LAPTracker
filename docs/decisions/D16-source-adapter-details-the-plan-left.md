## D16 — Source adapter details the plan left open (2026-11-04, Session 2)

- **Retry delays:** 1 s, 2 s, 4 s plus 0–250 ms of random jitter. A numeric `Retry-After` replaces the backoff and is clamped to 30 s, so one header cannot push a run past `maxDuration = 120`. An HTTP-date `Retry-After` falls back to the backoff.
- **Timeouts** (30 s, `AbortSignal.timeout`) are not retried. A timed-out read may still have used quota, and the collector's per-alliance fallback is the next step anyway. Other non-2xx statuses (401, 403, 409, 500) throw `UpstreamError` with the status and are not retried.
- **Concurrency 4** is a module-level cap on in-flight `/v1` requests, across every caller in the process. A request waiting out a retry delay does not hold a slot.
- **The internal adapter never retries.** It is best-effort, and the collector decides what a failure means.
- **`RanksBoard.pulledAt`** is the older of the `alliance_power` and `alliance_kills` boards' `pulled_at`; they are written ~10 ms apart.
- **Schema failures** throw `SchemaError` with `code` `v1.schema` or `internal.schema`, and the zod issue paths only. A path never carries a value, so the error can be logged as is. A non-JSON body is a schema failure too.
- **`lib/env.ts` `getSourceEnv()`** validates only `LAP_API_KEY`, `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL`. The adapters use it, so the live smoke test runs without the database and schedule variables. `instrumentation.ts` still validates the full set at server start.
- **The output type adds `totalKills` and `quota`** to the plan's `AllianceSnapshotInput`. `quota` is the `quota` object from that `/v1` response and is `null` for the internal source, where `cached` is also `null`.
