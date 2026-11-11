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
