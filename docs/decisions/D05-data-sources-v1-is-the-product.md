## D5 — Data sources: /v1 is the product; the internal API is optional garnish (2026-11-04, plan §3.5)

The documented `GET /v1/alliances/{id}` is the only required source; it refreshes on read. The site's internal API is used read-only for the ranks board (cross-check, 0 quota) and as a per-alliance fallback that accepts only `live: true` rosters, recorded as `source = internal`. The site's refresh endpoint is closed to outsiders on purpose; we never call it or imitate the site's headers. No number in a delta depends on an undocumented endpoint. One API key, no pooling.

**Widened (2026-11-20, D133, issue 459; owner's decision of 2026-11-19).** The ranks board is no longer only a cross-check: it also picks the day's tracked set, and its might, kills and places are shown on `/alliances` and each alliance's page, labelled "Ranks board". Board numbers still never enter a delta. The endpoint, GET only, with no refresh call and no Origin, Referer or cookies, is unchanged.

**Cross-reference (2026-11-21, D69 amendment "wrong-alliance reads").** A `/v1` 200 that holds another alliance's roster counts as a `/v1` failure. In a Before or an After it gets the same one internal fallback read, which is checked the same way. No new use of the internal API.
