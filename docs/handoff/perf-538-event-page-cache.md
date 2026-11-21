# perf issue 538: the event page's reads shared under the `reads` tag

## Built

- `lib/queries/event-page.ts`: one loader, `eventReads`, holds everything the page reads about one event:
  - the detail;
  - alliance names, ranks and roster changes;
  - member movers;
  - war turnout, also "so far";
  - kill share vs might share.

  The three Maps are stored as their entries, and `getEventPage` rebuilds them. `shared` takes the key `[event id, war-turnout flag, kill-vs-might flag]`. An id that is not in the event list answers "no such event" without a read.
- `app/_ui/event-page.ts`: `loadEventPage` passes `sharedRead("event-page", …)` (D143). The event cache's `turnout-so-far` entry is removed. `progress` and `progress-done` stay in the event cache.
- `PublicCache` keys accept booleans.
- `lib/page.ts`: `withOwnDb` opens at most 3 connections, the same as the request's Pool.
- `lib/event-cache.ts` gets the instance fixes that #537 made in `lib/public-cache.ts`:
  - its state is on `globalThis`;
  - an invalidation drops that event's in-flight reads;
  - a finished read removes only its own in-flight entry;
  - a read that ran across an invalidation is served once and not kept (the generation guard).
- History page: a `detailsState` read that cannot reach the database gives `null` (unknown). The page is then served from the shared reads, with no "Get today's details" button and no "Read every day" line. On a miss while the database is down, the statement falls back to none.
- `.github/workflows/uptime.yml` comment: `/w/request` is the only page probe that reaches the database.
- Docs:
  - a D143 amendment, with the three lines it supersedes corrected;
  - amendment lines in D79, D91 and D141;
  - the ARCHITECTURE line for `lib/public-cache.ts`.
- Test: `app/_ui/event-page.test.ts` has two new cases:
  - two views make one read, and the first view after a sample run shows that sample's turnout so far;
  - a made-up event id makes no read.

## Decisions

- **One entry per event and flag pair**, not one per query. Every write that changes any of these reads goes through `lib/run.ts`, which already invalidates `reads`.
- **The war turnout "so far" moved from a 60 s event-cache entry into the `reads` entry.** It is now bounded by the next run's invalidation, or by 1 h if a run is killed after it writes. Users, product and adversarial accepted this. `LiveRefresh` reloads the page after each sample, and both caches are dropped in the same `finally`.
- **"Updating now" on the public event page is generally not seen during a Start or End run.** This is an accepted trade-off. Invalidating at the claim cannot help, because Next applies the tag only after the run's handler returns. A killed run leaves the state from before the run for up to 1 h, where before the chip turned to "failed". Product judged that keeping the event-day pages up is worth more. If the owner wants the chip back, it costs one per-view read of the running row (one statement a view).
- **Made-up event ids are answered from the shared event list.** It uses the same `publicEvent` filter as `getEventDetail` (technical SHOULD).
- **The `withOwnDb` cap of 3** is the SRE SHOULD. The burst was 0 × 500 both before and after the cap, so the gain comes from the cache, not the cap.
- **The generation guard was ported to the event cache in this PR.** It was small and the file was already open (technical FOLLOW-UP, applied on the coordinator's call).
- **Panel verdicts:**
  - technical: approve with changes; SHOULD 1 and FOLLOW-UP 3 applied;
  - adversarial: approve with changes; SHOULDs 1, 2 and 6 are covered in the docs and in this handoff;
  - SRE: approve with changes; SHOULDs 1 and 2 applied;
  - users (R5, R4, member, a player from another alliance): approve, with "Updating now" noted;
  - product: approve.
- **QA verdict:** no MUST. Its SHOULD, the stale D143 line, is fixed.

## Deviations

- Not limited to the five reads the issue names. The war turnout and kill share are in the same entry, keyed by their flags, so that a repeat view makes 0 reads with the flags on too.
- The history page fix and the event-cache fixes are in the same PR, as the task allowed when they are small.

## Verified

- **Setup:**
  - local production builds of `origin/dev` (3541, BEFORE) and of this branch (3542, AFTER);
  - local Postgres 18, with the #537 invented data (24,240 `daily_rosters` rows, a board of 60 alliances, a desk session);
  - no upstream, Discord, Neon or Vercel calls, and no `/api/quota`.
- **Statements and sessions per view, from `pg_stat_database`.** "First" is the first view after a PIN rename; "repeat" is the median of 5 views.

  | View | BEFORE first | BEFORE repeat | AFTER first | AFTER repeat |
  | --- | --- | --- | --- | --- |
  | `/` | 25 / 8 | 10 / 3 | 26 / 9 | **0 / 0** |
  | `/events/3` | 25 / 8 | 10 / 3 | 26 / 9 | **0 / 0** |
  | `/alliances/67111155/history` | 23 / 9 | 9 / 3 | 23 / 9 | 9 / 3 |
  | `/alliances`, `/players`, `/players?q=a`, `/players/[uid]` | unchanged | 0 / 0 | unchanged | 0 / 0 |
  | `/w/ogs` (desk) | 51 / 3 | 50 / 3 | 51 / 3 | 50 / 3 |

  QA measured these as well:
  - made-up event ids: 2/1 → 0/0;
  - 20 cold views at once of `/events/3`: 215/65 → 25/8.
- **Bursts** (`scratchpad/b538/qa/burst4*.mjs`, public pages):
  - 96 views on a warm cache: BEFORE had 18 and 19 × 500 ("too many clients", all on `/` and `/events/*`), with a peak of 97 and 80 backends. AFTER had 0 × 500 in every run (2 runs before the `withOwnDb` cap, 2 after, plus QA's), with a peak of 48–67.
  - 48 views right after an invalidation: 0 errors on both builds, with a peak of 65 backends BEFORE and 32–37 AFTER.
- **Freshness** (`qa/fresh-event.mjs`): I renamed event 3's End row in SQL.
  - Without an invalidation, AFTER kept showing the old name on `/events/3` and `/`.
  - The first view after the PIN rename showed the new name.
  - The test covers a sample through the tick on PGlite. It cannot cover Next applying the tag after the handler returns.
- **Database down** (bridge stopped):
  - AFTER answers 200 from the cache on `/`, `/events/3`, `/events/1`, `/alliances/67111155/history` and `/alliances/32/history`. On `/alliances/32/history`, a non-daily alliance, the button is hidden while the database is down and shown while it is up.
  - BEFORE answered 500 on all of these.
  - Chrome at 360 px, light and dark: no overflow. Screenshots are in `scratchpad/b538/shots/`.
- **The event entry is about 30 KB** for a 20-alliance event (`.next/cache/fetch-cache`), against Next's 2 MB item limit.
- **Privacy:** the loaders select no roster key, `raw_json` or `avatar_url` (adversarial and the users panel both checked).
- `pnpm check` passes: 1444 tests.

## Open issues

- **`/events/[id]/alliances/[unionId]`** still costs 16 statements and 3 sessions per view, and answers 500 when the database is down.
- **A page not yet in the cache** shows the 503 page when the database is down. This is expected.
- **History with the database down:**
  - The "Read every day" line is hidden (documented).
  - If today already had a lookup, the page cannot know the lookup's time. The cached entry is then not found, and the page shows the 503 page.
  - If the database accepts the connection and never answers, `detailsState` waits up to 10 s before the cached page is served. The page waits for it because the lookup time is part of the key (adversarial FOLLOW-UP).
  - A refusal with 53300 (too many connections) also counts as down. A daily alliance can then show a statement card it does not normally show. This is cosmetic.
- **The "Updating now" chip during a run** was not tested live (QA).
- **Cross-instance race** (adversarial FOLLOW-UP): another instance can keep a read that straddled a write until the next write or the hour. For a finished event, its End could stay missing for up to 1 h. A fix would be an optional per-read max age in `PublicCache.read`: `LIVE_MAX_AGE_S` while the event has no complete End.
- **While the database is down, a live event's page fails** if the event's entry is cached but its live-section rows are not. This is no worse than before.
- **Warming the entry from `after()`** after a sample is worth doing only if bursts after a sample show errors (technical FOLLOW-UP).
- **The largest real event's encoded size** is not measured against production data. The invented 20-alliance event is about 30 KB.

## Next

- Model/effort: keep. The panel's findings were docs and small guards; no timing bug turned up this time.
- Owner first: merge. After the release, compare Neon compute hours and `vercel metrics vercel.function_invocation.function_duration_ms --aggregation p75 --group-by route --since 30m` for `/` and `/events/[id]` with the days before. Decide whether "Updating now" on the public event page is worth one statement per view.
- Plan change: none.

<adjustments>
- `/` and `/events/[id]` now make 0 statements on repeat views. Of the public pages, only `/events/[id]/alliances/[unionId]` (16/3) and the history page's `detailsState` (9/3) still read on every view.
- `uptime.yml`'s only page probe that reaches the database is `/w/request`.
- `lib/event-cache.ts` already has the `globalThis` state, in-flight drop and generation guard: do not redo them.
</adjustments>

PR: (added by the orchestrator)
