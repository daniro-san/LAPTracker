---
paths:
  - "lib/collector.ts"
  - "lib/compute.ts"
  - "lib/budget.ts"
  - "lib/sources/**"
---

# Collector, compute and sources

A change in these files ships with a test in the same commit. No exceptions; review rejects it otherwise.

Invariants (docs/IMPLEMENTATION_PLAN.md §3.4, §3.7, Phase 3, "Logging guarantees"). Reference each by name in a comment next to the code that enforces it, e.g. `// INVARIANT budget.reserve-for-after`.

- [ ] Alliances are addressed by `union_id`, never by tag. Members by `uid`.
- [ ] The BEFORE run copies the configured ids onto the event; the AFTER run uses `events.alliance_ids`, never the config.
- [ ] Before a run: one `/v1/quota` call; abort unless `remaining >= requiredQuota(n)` (lib/budget.ts).
- [ ] `is_fresh = now - source_updated_at <= 20 min`. `now` is passed in (`Deps.now`); no `Date.now()` in lib/compute.ts.
- [ ] Any row with `is_fresh = false` makes the snapshot `partial`, never `complete`.
- [ ] `total_kills = sum(members.kills)`; board numbers are cross-checks and never enter a delta.
- [ ] Retry only 502/503/504 (max 3, backoff + jitter, honour Retry-After). 429 aborts the run.
- [ ] Every upstream call (quota checks and retries included) counts toward `MAX_UPSTREAM_CALLS = 120`.
- [ ] A re-run fetches only alliances without a row for that snapshot. A re-run without force first drops the snapshot's failed rows (D62), so it reads those again; a forced re-run drops every row.
- [ ] Adapters branch on `response.status`, never `statusText` (empty over HTTP/2 on Node 26).
- [ ] `User-Agent: laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)` on every request.

`lib/sources/internal.ts` is unofficial and read-only: the ranks board and the `live: true` roster fallback. Never add a refresh call, never send Origin/Referer/cookies, never widen its use without an entry in docs/decisions/.

Errors are classes (`QuotaExhaustedError`, `NotFoundError`, `NotLiveError`, ...); callers match with `instanceof`, never on message text.
