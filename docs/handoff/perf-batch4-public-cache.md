# perf Batch 4: public reads shared until the next read, and a page that says when the database is down (issue 521)

## Built

- `lib/public-cache.ts` (D143): Next's `unstable_cache`, tag `reads`, the deployment id in the key, `revalidate` 1 h. Values are stored as JSON text (`encode`/`decode`). A `null` is never kept. One read per key at a time in an instance. `invalidate()` clears the in-flight reads, bumps a generation so a read that ran across the invalidation is served once and not kept, and calls `revalidateTag("reads", { expire: 0 })`. The instance's state sits on `globalThis`, because Next gives route handlers and pages their own copies of the module. Reached through `AppContext.publicCache`; tests use `memoryPublicCache()`.
- `app/_ui/public-reads.ts`: `sharedRead` (loads run through `withOwnDb`), plus:
  - `sharedEvents`;
  - `sharedAllianceList`, clamped to the real pages;
  - `sharedEventAllianceIds`;
  - `sharedPlayerSearch`, keyed by the lower-cased text;
  - `sharedUpstreamRows`.
- Pages:
  - `/` and `/events/[id]` take the event list from `sharedEvents`. `getEventPage` gained a `listed` parameter.
  - `/alliances`.
  - `/players`.
  - `/players/[uid]`: `player`, which holds history and progress.
  - `/alliances/[id]/history`: the first page and the statement are cached, keyed by today's lookup time. `detailsState` is still read per view.
  - merge, balance, flow and the alliance-in-event page take their header from `sharedEvents`.
  - The ledger's "All alliances" count.
  - `boardCount` was removed because nothing uses it any more.
- Banner: `getUpstreamStatus` is split into `upstreamRows(db)`, which is cached, and `upstreamStatusOf(rows, now)`, which runs per request.
- Invalidation:
  - the tick: a new scheduled event row; the day's tracked set; the daily read and its automatic retry, in the body of the request; a part-written write unless the database is down;
  - `/api/daily-read/retry`;
  - `/api/alliances/[unionId]/details`;
  - `/api/snapshot`, when it created the scheduled event row;
  - `lib/run.ts`, beside `eventCache.invalidate`;
  - manual-event create, rename and settings.
  - `findOrCreateEvent` now returns `created`.
- Database down:
  - `lib/data-unavailable.ts`: `databaseDown` and `DataUnavailableError`, digest `data-unavailable`.
  - `withPageDb` and `withOwnDb` rethrow connection failures as that error.
  - `app/error.tsx` shows "503 · Data temporarily unavailable." for it, and its "Try again" now calls `router.refresh()` together with `reset()`.
  - Page reads wait at most 10 s for a connection (`PAGE_CONNECT_TIMEOUT_MS`), on both the request Pool and `withOwnDb`.
- Copy:
  - `lib/copy-errors.ts`: the `errors` strings, moved out of `lib/copy.ts` (which was at its line limit), plus `errors.unavailable`. All 17 languages are translated and stamped.
  - The error title is `display-lg` below 640 px.
- Docs:
  - D143.
  - Dated amendment lines in D79 and D141.
  - An ARCHITECTURE line.
  - The `uptime.yml` comment now says that `/alliances` checks the site, not the database.
- Tests:
  - `lib/public-cache.test.ts`: the codec; a read across an invalidation is not kept (mutation-checked); and INVARIANT `cache.write-invalidates-reads`, a source scan (mutation-checked on the rename route and the tick).
  - `app/api/manual-event/public-reads.test.ts`: create, run, rename and settings, and a second view after a write sees the new row.
  - `app/api/tick/public-reads.test.ts`: the night read, its automatic retry, Retry, and the event creation.
  - One added case each in the details route, `upstream-status`, `lib/page` and `app/error` tests.

## Decisions

- **The Date codec deviates from the spec's "JSON values only, no Date".** The loaders return `Date`s, so they are encoded as `{"$date": ms}`. A Map or Set throws. The technical persona approved this; it is recorded in D143.
- **`detailsState` is not cached.** It depends on the clock, the day's lookup claims and the workspaces' sealed keys (D71).
- **No invalidation when a phase's run claims its row.** The adversarial persona pointed out that Next applies `revalidateTag` only after the handler returns, so a run that is killed never applies it. D143 records the 1 h bound for that case.
- **History keys include today's lookup time.** "Get today's details" refreshes the page before Vercel applies the tag (adversarial MUST).
- **No invalidation when the write failed because the database is down.** When the database is down, the cached pages are all the public site has (SRE).
- **Bounded keys** (orchestrator): the alliance list is keyed by the page it shows, history is cached only without `before`, and search keys are lower-cased. Search stays cached per text.
- **The connect limit is also on the request Pool.** This is the orchestrator's decision after QA hit a hang. The adversarial persona and the SRE had asked for it on `withOwnDb` only, because the driver also counts the queue wait. The widest page takes about 0.1 s, so a false "down" needs a 10 s queue.
- **The error title is `display-lg` below 640 px.** DESIGN.md's `error-page` says `display-xl`. At 48 px, pt-BR and fr titles broke mid-word at 360 px, and `hyphens: auto` hyphenated every line. From 640 px the title is unchanged. The 404 and 500 pages get the same size.
- **Panel verdicts.**
  - Technical: approve with changes. Applied: the in-flight guard; the codec deviation is recorded.
  - Adversarial: approve with changes. Its MUSTs 1 and 2 are fixed, and SHOULDs 3, 4, 5, 6 and 7 are applied. SHOULD 3 was then overridden by the orchestrator (see above). For SHOULD 8, QA ran the burst.
  - SRE: approve with changes. SHOULDs 1, 6 and 10 are applied.
  - Users (R5, R4, member, a player from another alliance) and product: approve. Their MUST, the translations, is done.
- **QA verdict:** no MUST. The orchestrator then required four fixes, all done and verified in Chrome:
  - the race;
  - the 503 title at 360 px;
  - "Try again" recovering;
  - the hang.

## Deviations

- The spec says JSON values with no Date. A codec is used instead (see Decisions).
- More tables are invalidated than the five the spec names: `snapshots`, `tracked_sets`, `alliances` and `player_frames` are added. The cached reads read them.
- Repeat views of `/`, `/events/[id]` and the history page are not 0 queries. The event detail reads and `detailsState` are outside the spec's list of reads to wrap.
- With the database down and nothing cached, the HTTP status stays 500 (Next sets it for a thrown render). The page says 503.

## Verified

- Local production builds of `origin/dev` (3541, BEFORE) and this branch (3542, AFTER).
- Local Postgres 18 with 62 migrations, through the bridge.
- Invented data: the Batch 3 seed (24,240 `daily_rosters` rows) plus an invented ranks board of 60 alliances, and an invented desk session.
- No upstream, Discord, Neon or Vercel calls, and no `/api/quota`.
- Statements and sessions per view, from `pg_stat_database`. "First" is the first view after a real invalidating write (a PIN rename); "repeat" is the median of 5 views:

  | View | BEFORE (every view) | AFTER first | AFTER repeat |
  | --- | --- | --- | --- |
  | `/` | 18 / 3 | 27 / 8 | 10 / 3 |
  | `/events/3` | 18 / 3 | 25 / 8 | 10 / 3 |
  | `/alliances` | 12 / 3 | 15 / 5 | **0 / 0** |
  | `/alliances/67111155/history` | 16 / 3 | 23 / 9 | 9 / 3 |
  | `/players` | 5 / 2 | 6 / 2 | **0 / 0** |
  | `/players?q=a` | 7 / 2 | 9 / 3 | **0 / 0** |
  | `/players/340508418373` | 14 / 3 | 16 / 4 | **0 / 0** |
  | `/w/ogs` (desk, not cached) | 51 / 3 | 51 / 3 | 50 / 3 |

  The first view of `/` and `/events/3` also misses the event cache (D79), because the rename invalidates it too.
- Bursts (QA, `scratchpad/b4/qa/burst4*.mjs`):
  - 48 views right after a write: 500s fell from 21–24 of 48 to 0.
  - 96 views with a warm cache: 500s fell from 64 of 96 to 16, all of them on `/` and the event pages.
- Freshness:
  - An SQL write followed by an invalidating route shows on the first view after it.
  - An SQL write with no invalidation stays hidden.
  - QA's race (`qa/race.sh`: a slow miss straddling a write): before the fix, the old rows were kept. After it, the straddling view shows the old rows once and every later view shows the new ones.
- Made-up `?page=9999`, `?before=` and unknown uids leave no entries.
- The banner turns "down" from `now` on a cached row.
- Database down (bridge stopped), in Chrome at 360 px:
  - `/alliances`, `/players` and `/players/[uid]` answer 200 from the cache.
  - Misses show "503 · Data temporarily unavailable." in en, pt-BR, fr, de, es, ru, it and pl, with no word split and no overflow.
  - "Try again" after the database comes back renders the page.
- Desk and /admin: unchanged.
- No private field is cached (adversarial and QA both checked).
- Mobile screenshots: `scratchpad/b4/shots/`.
- `pnpm check`: passes (see the commit).

## Open issues

- **Event pages** still run about 10 statements a view (event detail, names, ranks, roster changes as a Map, movers, End turnout). That is the main remaining Neon cost, and the reason `/` and `/events/[id]` fail with the database down and under the warm burst. This is the top follow-up for product, SRE and QA.
- **History while the database is down:** `detailsState` runs on every view, so the cached history never shows. Catch `DataUnavailableError` there and hide the button.
- **Cross-instance race:** a read in another instance that straddles a write is kept, for one read's duration (about 100 ms), until the next write or the hour.
- **Misses open one Pool per shared read:** up to 9 sessions on a first view, against 3 before. A per-instance Pool for shared reads would cut that.
- **A part-written write that fails with 53300** (too many connections) skips the invalidation.
- **`lib/event-cache.ts`** has the in-flight delete bug fixed here, and its in-flight map is per bundle (the same `globalThis` fix applies).
- **Log noise** (pre-existing): `cookies() inside after()`, and "Cannot use a pool after calling end".
- **Status 500 against 503** on a miss with the database down.
- **SRE follow-ups:**
  - `recordAppError` waits with no limit when the database is down; skip it for `data-unavailable`.
  - A failed background refresh logs the key, which holds the search text.
  - Some Neon `XX000` errors (quota, endpoint disabled) are not classified as down.
- **Empty searches** (`[]`) are kept per text.
- **Not yet known:** whether production uses Neon's pooled endpoint (still open from Batch 3).

## Next

- Model/effort: keep. The panel found two real timing bugs (the claim invalidation and the details refresh), and QA found the module duplication that would have left the race fix inert.
- Owner first: merge. After the release, compare `vercel metrics vercel.function_invocation.function_duration_ms --aggregation p75 --group-by route --since 30m` and Neon compute hours with the days before. Check that the first public view after the night read shows the read.
- Plan change: none to the spec's Batch 4. A next batch should cache the event pages' reads under `reads`.

<adjustments>
- `app/_ui/public-reads.ts` `sharedRead` is the way to share a public read; `invalidate` already runs on every write path, so new public reads only need a loader.
- Module-level state in `lib/` is per bundle under Next (route handlers and pages get separate copies): put per-instance state that a route must reach on `globalThis`.
- Measured: repeat views of `/alliances`, `/players`, `/players?q=` and `/players/[uid]` are 0 statements; `/` and `/events/[id]` are 10.
</adjustments>

PR: (added by the orchestrator)
