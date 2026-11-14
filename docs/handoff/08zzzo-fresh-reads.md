# 08zzzo — Alliance reads ask for a live lookup (D64)

Owner request, 2026-11-14 (Saturday, event day), pointing at the upstream docs' "Freshness" section. That morning the Before snapshot came back with all 20 alliances stale (D63).

## Cause
- The upstream keeps a cached copy of each alliance for up to 60 minutes (`cache_seconds`). The fixtures recorded on 2026-11-04 show `cache_seconds: 600`, so it was 10 minutes then.
- It returns that copy immediately, and fetches a newer one in the background only once the copy is older than 60 minutes.
- Our freshness rule marks a roster stale when `updated_at` is more than 20 minutes old. A cached answer is now often stale by our rule.
- The app never asked for a live read.

## Built
- `lib/sources/v1.ts`: `fetchAlliance` requests `/alliances/{id}?fresh=1`, retries included. The upstream then waits for a live game lookup (docs: "usually one to two seconds", "counts as one request like any other"). `/v1/quota` is unchanged.
- `lib/sources/v1.ts`: `x-cache` joins the headers kept in a failed call's detail (D61).
- `lib/sources/v1.test.ts` (committed; the collector rule requires a test with `lib/sources/**`): "asks for a live game lookup (fresh=1) on every alliance read, retries included, never on the quota call (D64)". Three existing assertions now expect the `?fresh=1` URL or path.
- `docs/decisions/D64-alliance-reads-ask-for-a-live-lookup.md` and its index line.

## Decisions
- **Always live, for snapshots and the daily read.** The cost is the same, and both are judged by the same 20-minute rule.
- **No cached fallback when a live read fails.** A cached copy would most likely be stale by our rule. The existing retries, internal fallback (snapshots) and error rows (daily read) stay.
- `age_seconds` and `refreshing` are not parsed. With `fresh=1` the answer is live (`age_seconds` 0), and `updated_at` still drives the freshness rule.

## Deviations
- None. The PR was merged before the live checks below were added; this follow-up records them.

## Verified
- Live check, approved by the owner in chat, 2026-11-14 ~12:38 UTC, alliance 67111155 (OGs), 2 quota requests. The key was read from `.env.local` and never printed.
  - Without `fresh`: 200 in 825 ms, `X-Cache: hit`, `cached: true`, `age_seconds: 3135`, `updated_at` 52.3 min old, which is stale by our 20-minute rule.
  - With `?fresh=1`: 200 in 849 ms, `X-Cache: live`, `cached: false`, `age_seconds: 0`, `updated_at` 0.0 min old.
  - Both answers had `cache_seconds: 3600`.
- A full live read with this code, requested by the owner, ~12:39 UTC: `runDailyRead` with the real `/v1` source over all 20 alliances. It wrote to the local Postgres only (D47; the script refused a non-local host), as day 2026-11-14. It cost 23 requests (quota 935 → 912).
  - Result: `complete`, 20 of 20 fresh (the oldest 0.7 min), none failed, 35.3 s wall time.
  - 18 alliances answered live in 0.64–1.21 s.
  - TmS and WACK first got a 502 ("the profile could not be prepared"), each about 30 s after the request. The retry got 200, at about 34 s in total. Those two set the wall time and the 2 extra requests.
- The new test passes. With the old path restored it fails, along with the three updated assertions (4 failed). Restored: 21 passed in `v1.test.ts`.
- `pnpm check`: prettier, eslint, typecheck, 261 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.

## Open issues
- **A live lookup can take about 30 s before it fails.** TmS and WACK each got their 502 about 30 s after the request; `TIMEOUT_MS` is 30 s. Had either taken a little longer, the call would have ended as `TimeoutError`, which is not retried (only 502/503/504 are). The alliance would then go to the internal fallback (snapshots) or get an error row (daily read). Watch the `v1.fetch` seconds of the next runs; if such cases show up, consider a slightly longer timeout for live reads, or one retry on a timeout.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release (patch). On 2026-11-14 the After runs at 14:00 server time (16:00 UTC). A release that is live before then gives the After live reads; do not deploy while a snapshot runs. Until 12:00 server time (14:00 UTC), D63's "read the stale alliances again" on today's Before can use the live reads too.
Plan changes needed: plan §2 lists `GET /v1/alliances/{id}`; it should mention `?fresh=1` (D64).

<adjustments>
- Every `/v1` alliance read is live (`?fresh=1`). A stale row now means the game itself had not updated the alliance within 20 minutes, not that the API's cache was old.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/256
