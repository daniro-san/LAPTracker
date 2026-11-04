# fixtures/

Raw upstream responses, saved as returned (no key, no headers). They are the contract with the
upstream API and the bodies for parser tests. Adding one spends quota or touches the site, so it is a
deliberate act, never a side effect of a test. Bodies include roster fields that are never served
(plan §12.1); tests may read them, nothing else may.

All recorded on 2026-11-04 (Wednesday). Quota is per account per UTC day (1,000; `quota.used` in each body).

| Folder | What | Recorded (UTC) | Cost |
|---|---|---|---|
| `probe-67111155-20261104T153003Z/` | Internal API, OGs. `01-before` / `04-after` = `GET /api/alliances/67111155` (`live: true` shape); `02-refresh` = `GET …/refresh` → `405 Method Not Allowed`; `03-status-*` = `GET …/refresh/status` every 10 s for 60 s | 15:30–15:31 | 0 quota (internal, no key) |
| `probe-67110250-20261104T153123Z/` | Internal API with an id the site does not know: `GET /api/alliances/67110250` → `alliance not found`; refresh `GET` → 405; status open | 15:31 | 0 quota |
| `probe-67111155-20261104T153457Z/` | OGs again. `02-refresh` = `POST …/refresh` → `403 Refresh only from the site`; status shows the per-alliance cooldown counting down (557 s → 493 s) | 15:34–15:36 | 0 quota |
| `probe-67110320-20261104T153605Z/` | URSA: `live: false` stub (no `power`, no `updated_at`); `POST …/refresh` → 403; status cooldown 0 in the same minute OGs had 546 s | 15:36–15:37 | 0 quota |
| `v1-20261104T154755Z/` | Documented API round 1 (`scripts/probe-v1.sh`): `GET /v1/quota`, `GET /v1/alliances/67111155`, `GET /v1/alliances/67110320`, `GET /v1/quota` | 15:47 | 4 calls (`used` 1 → 4) |
| `v1-20261104T155902Z/` | Same round 11 min later: both alliances `cached: false`, `updated_at` = read time again (refresh-on-read, plan §3.7) | 15:59 | 4 calls (`used` 5 → 8) |
| `v1-ids/<union_id>.json` | `GET /v1/alliances/{id}` for the 18 §7 alliances not covered above (Session 0). All `200`, `cached: false`, `name`/`abbr` equal to the board | 19:40:10–19:40:56 | 19 calls (`used` 32 → 50; one `502` on 67110584 counted and was retried once) |

The internal refresh endpoint is closed to us on purpose (plan §3.5). No fixture will ever be recorded from it again.
