# 08zzzzs — Feature flags

Basis: owner request of 2026-11-17. Four features are switched by PostHog feature flags; a feature is off until its flag exists and is on. Decision D91.

## Built
- `lib/flags.ts` (new, server only): `FLAGS` (`merge-simulator`, `chart-details`, `kill-vs-might`, `war-turnout`), `type Flag`, `flagsOf(env)` (PostHog's `/flags?v=2`, or `LOCAL_FLAGS` without a key) and `isOn(flag)` (React `cache()` per request).
- `lib/flags.test.ts` (new): 3 tests (enabled true on, enabled false / missing key off and the request body; 500 / failed fetch / non-JSON off; `LOCAL_FLAGS` only without a key).
- `lib/env.ts`: `LOCAL_FLAGS` (optional string); comment on `POSTHOG_KEY`.
- `app/(pages)/alliances/merge/page.tsx`: `notFound()` in the page and in `generateMetadata` while `merge-simulator` is off; reads `war-turnout` and passes it to the read and to `MergeResultView`.
- `lib/queries/merge.ts`: `mergePage(..., turnout = true)`; `false` skips `latestTurnouts`.
- `app/_ui/MergeSimulator.tsx`: `MergeResultView` prop `turnout`; the "War turnout" section only when true.
- `app/_ui/AllianceLinks.tsx`: async; "Simulate a merge" only while `merge-simulator` is on.
- `app/_ui/FlowView.tsx` + `app/(pages)/alliances/flow/page.tsx`: prop `merge`; the "Merge simulator →" link only when true.
- `lib/queries/event-page.ts`: `getEventPage(..., sections = { turnout: true, carried: true })`; `warReads` skips `memberTurnout` / `memberTurnoutSoFar` and `whoCarried` when their flag is off.
- `app/_ui/event-page.ts`: `loadEventPage` reads `war-turnout` and `kill-vs-might` and passes them as `sections`.
- `lib/run-notify.ts`: `endTurnout` returns null while `war-turnout` is off (`flagsOf(ctx.env)`), so the End's public message has no turnout line and its picture no turnout block.
- `lib/run-notify-turnout.test.ts`: the two existing tests run with `LOCAL_FLAGS: "war-turnout"`; one new test: flag off, `memberTurnout` not called, no line, picture gets null.
- `app/_ui/PlayerProgress.tsx`: reads `chart-details`; the readings `MoreBar` only when on.
- `app/_ui/LiveProgress.tsx` (`LiveSections`, now async) reads `chart-details`; `app/_ui/LivePulse.tsx` `Pulse` prop `details`; the interval `MoreBar` only when true.
- `app/(pages)/events/fight-clock/page.tsx`: reads `chart-details` into `View.details`; `PulseDetails` per row only when true.
- `app/_ui/ComparePulse.tsx`: prop `details`; `PulseDetails` only when true; the "no samples" frame moved into `Off` (lint size). `app/(pages)/events/compare/page.tsx` `PulseSection` reads the flag. `app/_ui/ComparePulse.test.ts`: passes `details: true`.
- `app/_ui/Standing.tsx`: `AllianceStanding` reads `chart-details`; `StandingBody` prop `details`; `RanksTable` only when true.
- `app/_ui/BalanceRows.tsx`: `BalanceTrend` async, reads `chart-details`; the trend table moved into `TrendTable` (lint size) and shown only when on.
- `app/_ui/PulseStrip.tsx`: header comment.
- `docs/decisions/D91-feature-flags-from-posthog.md` (new), its line in `docs/decisions/README.md`, an amendment line in D68, one line in `docs/ARCHITECTURE.md`, `LOCAL_FLAGS` in `.env.example`.

Gated surfaces, per flag:
- `merge-simulator`: `/alliances/merge` (404, page and metadata); the alliance page's "Simulate a merge" (`AllianceLinks`); the member flow page's "Merge simulator →" (`FlowView`). No sitemap exists; `app/robots.ts` lists only `/admin`. `mergeHref` / `MERGE_PATH` are used elsewhere only inside the merge page itself (`MergePicker`).
- `chart-details`: player daily progress readings table; event page server pulse table; fight clock rows' figures table; compare page server pulse table; alliance page standing ranks table; balance page top-3 trend table.
- `kill-vs-might`: event page "Kill share vs might share" (`WhoCarried`) and its read `whoCarried`.
- `war-turnout`: event page "War turnout" / "War turnout so far" (`WhoFought`) and its reads (`memberTurnout`, and `memberTurnoutSoFar` through the D79 `turnout-so-far` entry); the "{share} with kills" figure inside kill share vs might share rows (it comes from the same read); the merge simulator's "War turnout" section and its read; the End's public Discord line "Most members with kills gained" and the turnout block of the End picture.

Left, and why:
- `app/_ui/LiveStandings.tsx`: the live standings (kills and might since Start per alliance). It only imports `visibleEntries` from `WhoFought.tsx`; it shows no turnout.
- The live strip's top three (`NSE +10.9M`) and the busiest-span sentence: kills, not turnout.
- Details of tables that are not charts: `StatTable` rows, `EventCompare`, `PlayerAcrossEvents`, `AcrossEvents` "Show all", the event-alliance page's rank card. The member flow's phone rows (`<details open>` in `FlowView`) are the matrix's form under 640 px, not a Details table under a chart.
- The standing rows' sparklines and every chart's summary line, value labels and HTML bars.
- Admin pages and the admin Discord message: they show no turnout.

## Decisions
- Cache: `unstable_cache` (key `flags`, tag `flags`, `revalidate: 60`), as `lib/event-cache.ts` does. Next's fetch cache was not used: `patch-fetch.js` (Next 16.4.5) sets `autoNoCache` for a non-GET request when the route's revalidate is 0, and these pages are dynamic (`connection()` in the root layout), so a POST with `next.revalidate` would not be stored.
- The cached function throws on every failure, so a failed read is never cached: a failed refresh keeps the last answer (Next serves the stale entry), a failed first read is off for that request.
- The key is not an argument of the cached function: Next puts the arguments into the cache key and into the `revalidating cache with key: …` line it logs on a failed refresh.
- `errorsWhileComputingFlags` is not read; only `flags[key].enabled === true` counts.
- `LOCAL_FLAGS` is a plain optional string in the env schema; unknown keys are ignored.
- Flags are read wherever `POSTHOG_KEY` is set, with no `VERCEL_ENV` check (owner: previews read the same flags). Analytics stays production only (D77).
- `getEventPage` and `mergePage` default to every section on, so their existing tests and callers stay as they were; the two page loaders pass the flags explicitly.
- `generateMetadata` of the merge page also calls `notFound()`, so a 404 does not carry the title "Merge simulator".
- The Discord path reads the flags with `flagsOf(ctx.env)`, only for the End's public message.

## Deviations
- The task said pages read the flags and pass booleans down. Where the page or function is at the lint limit (max-lines 300 per file, 80 per function), the async server component that draws the gated part reads its own flag instead: `AllianceLinks` and `AllianceStanding` (the event-alliance page is at exactly 300 lines), `LiveSections` (`EventView` is at 80 lines), `PlayerProgress` (`PlayerPage` is at 79), `BalanceTrend` (`BalancePage` would reach 82). Same server-side read, React-cached per request, no client SDK, no flash. Client components and components with tests (`WhoFought`, `WhoCarried`, `ComparePulse`, `Pulse`, `FlowView`, `MergeResultView`, `StandingBody`) get a boolean or null data.
- Three small extractions to stay inside lint limits: `TrendTable` (`BalanceTrend` was at 78 of 80 lines), `Off` in `ComparePulse` (it would reach 83), `warReads` in `lib/queries/event-page.ts` (complexity would reach 14 of 12).
- One new test case in `lib/run-notify-turnout.test.ts` (flag off): the Discord path cannot be checked in the local run.
- Comments updated beyond the listed files: `.env.example` and `lib/env.ts` on `POSTHOG_KEY`, the header comments of the gated components.

## Verified
- `pnpm check`: "All matched files use Prettier code style!"; eslint and tsc clean; "Test Files 156 passed | 2 skipped (158)", "Tests 824 passed | 4 skipped (828)"; drizzle "No schema changes, nothing to migrate", "Everything's fine"; "i18n: 17 languages up to date with English".
- Local run: dummy `.env.local` in this worktree only (the CONTRIBUTING.md placeholders, no `POSTHOG_KEY`), Postgres on 127.0.0.1:54391, bridge on 54392, `pnpm db:local:seed --with-states` ("seeded 20 alliances × 3 events and 12 daily reads, 1 rehearsal, an empty event and a running one"), `next dev -p 3191` with the preload. Three runs: no `LOCAL_FLAGS`; `LOCAL_FLAGS=merge-simulator,chart-details,kill-vs-might,war-turnout`; `LOCAL_FLAGS=merge-simulator,kill-vs-might`.
- HTTP: `/alliances/merge` and `/alliances/merge?a=67111155&b=67111040` answer 404 with the flags off and 200 with them on; the 404's title is "Grandma wandered off. · Event Ledger".
- 360 px: Chrome headless driven over the DevTools protocol (Node 26's WebSocket, nothing installed), `Emulation.setDeviceMetricsOverride` 360 × 780 mobile, DOM queries after load. Results (off → all on):
  - `/events/3`: war turnout section false → true; kill share vs might share false → true; "with kills" false → true; pulse table false → true; `<details>` in main 20 → 21.
  - `/events/3/alliances/67111155`: merge link false → true; standing ranks table false → true; `<details>` 5 → 6.
  - `/players/340581761349`: `<details>` 4 → 5 (the readings table); the progress card keeps its sentence and both charts.
  - `/alliances/flow`: merge link false → true.
  - `/events/fight-clock`: "Share of the kills" table false → true; `<details>` 0 → 2.
  - `/events/compare?a=2&b=3`: pulse table false → true; `<details>` 20 → 21.
  - `/alliances/balance`: trend table false → true; `<details>` 0 → 1.
  - Mixed run (`merge-simulator,kill-vs-might`): event page shows kill share vs might share without "with kills" and no war turnout; merge page renders without its "War turnout" section; both merge links present.
  - `document.documentElement.scrollWidth > innerWidth` was false on every page in every run.
- Screenshots (not committed): `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/4b1db06c-0daf-4084-bd36-a4bfc06f9eda/scratchpad/shots360/`.
- All processes started (dev server, Chrome, bridge, Postgres) were stopped by PID / `pnpm db:local:stop`; `next dev` wrote no `AGENTS.md`.

## Open issues
1. In `next dev`, a 404 page screenshots blank in headless Chrome (the body is a client-rendered error fallback). The same happens for the pre-existing `/events/999999`; the status is 404 and the title is the 404 page's.
2. Previews read the production flags (they have `POSTHOG_KEY`, so `LOCAL_FLAGS` is ignored there): a feature cannot be turned on for a preview alone.
3. README.md's PostHog paragraph still says the key is used on production only; it does not mention the flags. Not changed (not asked).
4. PostHog request volume: one `/flags` request per minute per Next data cache while pages are viewed (about 43,200 a month at one a minute). The owner can see the count under PostHog billing / usage.
5. `.env.local` (placeholders) and `.pglocal/` stay in this worktree; both are gitignored.

## Next
Session: none planned; the orchestrator picks the next issue.
Model / effort: keep — no signal; the work was gating, one cache and docs.
Owner must do first: in PostHog project 741657, create four boolean flags with the keys `merge-simulator`, `chart-details`, `kill-vs-might`, `war-turnout`, release condition all users 100 %, and switch on the ones to show. Without that, the merge and release hide all four features.
Plan changes needed: none.

<adjustments>
- A new gated feature: add its key to `FLAGS` in `lib/flags.ts`, read it with `isOn(...)` in the page or the async server component that draws it, pass a boolean to client or tested components, and skip its read when off. Local: `LOCAL_FLAGS=<key>` without `POSTHOG_KEY`.
- `getEventPage(db, id, windowMin, shared, sections)` and `mergePage(db, pair, tracked, events, turnout)` take the war flags; their defaults are "on".
- The event-alliance page is at exactly 300 lines and `EventView` at 80 lines per function: any addition there needs a component that reads its own data or a small extraction first.
</adjustments>

## Review fixes (2026-11-17, `/pr-review` of #382)
- `lib/flags.ts`: a failed read is remembered for 30 s per server instance and concurrent reads share one request, so a PostHog outage costs one 1.5 s timeout per 30 s, not one per page (test in `lib/flags.test.ts`). `flagsOf` takes the `fetch` to use; the Discord run passes `ctx.fetch`.
- The event page and the merge page start the flag read together with their database reads; only the war reads wait for the flags (`getEventPage` and `mergePage` accept the flags as a promise).
- Tests: `getEventPage` with both war sections off (`lib/queries/carried.test.ts`), `mergePage` with the turnout flag off (`lib/queries/merge.test.ts`).
- `docs/ARCHITECTURE.md` lists `lib/flags` in the `app` and `lib/run` edges; the `lib/flags.ts` header and D91's cache line match the code.

https://github.com/daniro-san/LAPTracker/pull/382
