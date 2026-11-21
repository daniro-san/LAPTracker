# perf Batch 3: one database connection per request (issue 521)

## Built

- `lib/page.ts`:
  - `withPageDb` keeps one Pool per request. It is memoised with React `cache`, and its close is registered with `after()` before the Pool is created. Every read of one render shares it: page, layouts, `generateMetadata`, the desk frame's status bar and the public `UpstreamBanner`.
  - `scopedDb(open, memo, atEnd)` builds `withPageDb`. Tests inject the three parts.
  - `withOwnDb` is the old behaviour: its own Pool, closed when the read returns.
  - `REQUEST_POOL`: the request's Pool has at most 3 connections, and an idle one closes after 200 ms.
- `lib/db.ts`: `openDb` takes an optional Pool size, which `AppContext.openDb` passes through (`lib/app-context.ts`). Every Pool now listens for `error` and logs the code `db.pool.idle_error` only.
- `app/_ui/event-page.ts`: both event-cache loaders use `withOwnDb`: `turnout-so-far`, and the `progress`/`progress-done` rows.
- Folded into the page's connection with no code change at the call site, because they already called `withPageDb`:
  - `frameReadStatus` (D135). Only its comment changed.
  - `UpstreamBanner`.
- `Promise.all` for independent sequential reads:
  - `latestQuota` on /admin (`lib/queries/admin-page.ts`);
  - `thanksNudge` on desk Home, which now runs with the page's other reads (`app/(private)/w/[slug]/page.tsx`).
- Tests:
  - `lib/page.test.ts`, 3 tests: one `openDb` shared by a scope and closed once after it; still one close after a throw; nothing opened when the scope cannot register the close.
  - `lib/private/read-status.test.ts`: the failed-connection test now stubs `after` and asserts the connection was tried. Without the stub it passed for the wrong reason (`after` threw first).
  - `app/(pages)/admin/gate.test.ts` and `app/(private)/w/[slug]/turned-off.test.ts` stub `after` from `next/server`, as `app/api/manual-event/route.test.ts` already does. They call pages outside a Next request.
- Docs:
  - D141: a dated amendment for Batch 3;
  - D135 and D79: one dated line each, because both said the frame's read, or the cached read, used `withPageDb` on a connection of its own.

## Decisions

- **No new decision number.** This is a dated amendment to D141, after Batch 1's. The only other open PR is #420 (dependency bumps), so D142 is still free.
- **The `progress` loader also uses `withOwnDb`,** not only `turnout-so-far` as the spec names. It goes through the same `unstable_cache` and the same `inFlight` map. Next re-reads it in the background after the response, and another request can await it. D79 already required its own connection for every cached read.
- **Not parallelised:**
  - The player page's `playerHistory` → `listEvents` + `playerProgress` chain stays as it is. Starting all three together saves one round trip on a 200, but adds two reads on every 404, and bots crawl uids.
  - /admin's duplicate `runningSnapshots` and `listRuns` reads in `AdminShell` and the overview are left alone. Deduplicating them changes the shell's props on every admin page (follow-up).
- **The Pool `error` listener is in this change.** The panel first split on it (adversarial: fix now; SRE and product: follow-up). The QA pass then saw uncaught exceptions under concurrent load, and the orchestrator made it a must-fix.
- **Pool size 3 with a 200 ms idle timeout.** QA's must-fix: with the driver's defaults (10, 10 s), one Pool kept every connection it opened until `after`. 20 requests at once held 89 Postgres connections against 52 before, and bursts of 39 got more "too many clients" refusals than before. Measured choices, 4 bursts of 39 and 3 peaks of 20 each:
  - 4 and 1 s: 0–11 refusals a burst, peak 56–57. Not enough.
  - 3 and 200 ms: 0 refusals, peak 35–47, 3 sessions per view. Chosen.
  - 2 and 200 ms: 0 refusals, peak 35, but every view queues more.
- **Panel verdicts.** Technical: approve. SRE: approve. Users (owner, R5, member, a player from another alliance) and product: ship, nothing worse, freshness unchanged. Adversarial: no blocker. What was applied:
  - its should-fixes: the read-status test, the D135 and D141 docs, and the missing test for "a scope that cannot register opens nothing";
  - technical's `thanksNudge` cut.
- **QA verdict.** Items 1–6 passed: Pools balanced, 1 per page; streaming; database-down behaviour the same as before; fresh after writes; fewer transactions; 360 px screenshots byte-identical, light and dark. One must-fix: connections under concurrent load (above), fixed and measured again.

## Deviations

- The spec names only `turnout-so-far` as a read that keeps its own connection. The `progress` loader keeps one too (see Decisions).
- Transactions dropped less than Pools. In `pg_stat_database` every new session costs one transaction, so the transaction cut equals the session cut. The statements did not change.

## Verified

- Local production builds (`next build` + `next start`) of `origin/dev` (port 3531) and this branch (3532). Both had a local-only patch in `lib/db.ts` that logs every Pool opened and ended; it is not committed.
- Local Postgres 18 with 61 migrations, through the bridge. Invented data:
  - `pnpm db:local:seed` (20 fixture alliances, 3 events);
  - 24,000 bulk `daily_rosters` rows (60 alliances × 400 days);
  - one invented workspace with an officer session.
- A fixture player's page answers 200, and its roster read uses the GIN index: EXPLAIN ANALYZE shows a bitmap index scan on `daily_rosters_member_uids_idx`, 0.03 ms.
- No upstream, Discord, Neon or Vercel call, and no `/api/quota`.
- Per view, final build, median of 5 views before and 7 after. Pools come from the patch's log; sessions and transactions from `pg_stat_database`, read from the `postgres` database. ms is local and noisy (the machine ran other work; `/alliances` measured 23 ms in an earlier run of the same code), so it is only a rough guide.

  | View | Pools | Sessions | Transactions | ms |
  | --- | --- | --- | --- | --- |
  | `/` | 3 → 1 | 6 → 3 | 17 → 14 | 70 → 56 |
  | `/alliances` | 3 → 1 | 4 → 3 | 9 → 8 | 29 → 48 |
  | `/players/[uid]` | 2 → 1 | 4 → 3 | 15 → 14 | 44 → 45 |
  | `/w/[slug]` | 2 → 1 | 17 → 3 | 63 → 49 | 62 → 64 |
  | `/w/[slug]/members` | 2 → 1 | 13 → 3 | 48 → 38 | 68 → 62 |
  | `/admin` | 6 → 1 | 27 → 3 | 74 → 50 | 232 → 84 |

- Under concurrent load, the same mix of pages as QA's (`scratchpad/b3/qa/burst.sh`, `peak.mjs`):

  | Load | Before | After |
  | --- | --- | --- |
  | 39 pages at once, 4 bursts: "too many clients" refusals per burst | 0–9 | 0 |
  | the same: uncaught exceptions per burst | 0–1 | 0 |
  | 20 pages at once: peak Postgres connections | 47–56 | 35–47 |

  Local `max_connections` = 100. The first version (Pool of 10, 10 s idle) had 89 connections at peak and 11–13 refusals a burst.
- Batch 1 measured about 68 transactions per /admin render. Before this change it is 74 (Batch 1 added `hasPendingRehearsal`, and this data has more rows); after, 50.
- Pools opened = Pools ended on every view: 404s (`/players/999999`, `/alliances/12345/history`), and with the database unreachable (bridge stopped). With the database down, `/`, `/alliances` and the player page answer 500 on both builds; Batch 4 is meant to change that. The server answered again once the bridge was back.
- QA pass: a separate agent on the same builds (see Decisions).
- `pnpm check`: see below.

## Open issues

- **Follow-up check: is production on Neon's pooled endpoint?** Unknown. The Neon MCP shows the pooler setting false on the endpoint, and pooled hostnames exist. Without the pooler, every connection counts against the compute's `max_connections`, which is the limit the concurrent bursts hit locally. Check which host `DATABASE_URL` names in production.
- The `error` listener has no test of its own.
- A client that disconnects mid-stream makes `after` run at once. That ends the Pool while reads may still be going, and they fail with "Cannot use a pool after calling end". Nobody sees the page. If `app_errors` shows that message, filter it after an abort.
- A request's reads share 3 connections, so the widest page queues: /admin takes 84 ms locally against 63 ms with 10 connections (and 232 ms before). Nothing in page code runs a transaction, so nothing can wait on itself.
- No guard stops a future `unstable_cache` loader from calling `withPageDb`. Inside `unstable_cache`, `after` and React `cache` still find the request, so such a loader would reuse the request's Pool, and its background re-read would fail silently. A source-scan test like `roster-fields.test.ts` could catch it.
- `connectionTimeoutMillis` is unset (pre-existing). When the database is slow, the page and the status bar wait in the same queue with no limit. Batch 4's degrade work is the place for it.
- /admin reads `runningSnapshots` and `listRuns` twice per render: `AdminShell`, and `loadAdminPage` on the overview.

## Next

- Model/effort: keep. The change was small. The panel found the test that passed for the wrong reason and the missing docs; QA's concurrent-load test found the connection count the panel missed.
- Owner first: merge. After the release, run `vercel metrics vercel.function_invocation.function_duration_ms --aggregation p75 --group-by route --since 30m` for `/`, `/alliances`, `/players/[uid]`, `/w/[slug]` and `/admin`, and compare with the days before. Watch the runtime logs for `uncaughtException` and "Connection terminated", and Neon's peak connections.
- Plan change: none. The spec's Batch 3 names `turnout-so-far` only; `progress` also keeps its own connection.

<adjustments for="Batch 4">
- `withPageDb` is now one Pool per request. Reads wrapped in `lib/public-cache.ts` that run inside `unstable_cache` must use `withOwnDb` (`lib/page.ts`), never `withPageDb`: Next re-reads expired entries in the background after the request's Pool is closed.
- With the database down, `/`, `/alliances` and `/players/[uid]` answer 500 on both builds (measured locally). That is the baseline the "data temporarily unavailable" page replaces.
- The Pool `error` listener is done (`lib/db.ts`). `connectionTimeoutMillis` is still unset; the degrade work should set it.
- The request's Pool is `{ max: 3, idleTimeoutMillis: 200 }` (`REQUEST_POOL`). Measure the cached pages' misses with the same burst scripts (`scratchpad/b3/qa/burst.sh`, `peak.mjs`).
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/535
