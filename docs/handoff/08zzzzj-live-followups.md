# 08zzzzj — Live event page follow-ups (#327)

Closes #327.

Branch `session/08zzzzj-live-followups`, cut from `origin/dev` at 75174b4 (#319 merged). The PR targets dev.

## Built
1. **Busiest span from the cadence.** `ledger.liveBusiest` and `ledger.liveBusiestDone` say "Busiest {span} minutes". `app/_ui/LivePulse.tsx` fills `{span}` with `2 × everyMin` (30 at `SAMPLE_EVERY_MIN=15`). The comments in `lib/live.ts` (file header, `busiestSpan`) and `LivePulse.tsx` that said "30 minutes" now say "two intervals" or `2 × SAMPLE_EVERY_MIN`.
2. **So-far help line.** New key `ledger.foughtSoFarHelp`: "Members who were in the alliance at Start and at its latest reading. Support players gain no kills." `app/_ui/WhoFought.tsx` shows it when `lists.soFar` is set; otherwise `foughtHelp` as before.
3. **Translations.** The three keys in all 17 languages (`lib/i18n/<tag>.ts`), stamped with `pnpm i18n:stamp`; `i18n-check`: "17 languages up to date with English".
4. **Shared cache for event progress (D79).**
   - `lib/event-cache.ts`: the `EventCache` interface (`read(eventId, name, maxAgeS, load)`, `invalidate(eventId)`) and `nextEventCache`, over `unstable_cache` with the tag `event:<id>` and `revalidateTag(tag, { expire: 0 })`. A module-level map shares one read between requests that miss the same key at the same time in one instance.
   - `AppContext.eventCache` (`lib/app-context.ts`) is the injection point. `testContext` gets `memoryEventCache()` (`lib/app-context.test-helpers.ts`).
   - `lib/queries/live.ts`: `eventProgress` is split into `progressRows(db, eventId)` (the select, times as epoch ms so the rows survive JSON) and `eventProgressOf(rows, { now, everyMin })` (pure, per request). `eventProgress` stays as the two composed.
   - `app/_ui/event-page.ts`: `loadProgress(detail, now)` reads the rows through the cache under `progress` (no End row, 60 s) or `progress-done` (End row, 1 day) and computes the figures per request. A cache hit opens no database connection. `loadEventPage` passes a `shared` function to `getEventPage`, which reads `memberTurnoutSoFar` through it under `turnout-so-far` (60 s).
   - `lib/queries/event-page.ts`: `getEventPage(db, eventId, shared?)`; the turnout choice moved into `turnoutOf` (complexity limit).
   - `app/(pages)/events/[id]/page.tsx` no longer reads progress beside the page: `EventView` reads it with the event detail on both `/` and `/events/[id]`. `EventView`'s `progress` prop is removed.
   - Invalidation: `lib/run.ts` `collect` calls `ctx.eventCache.invalidate(eventId)` after every run that claimed a row (sample, Before, After, forced re-run, D63 re-read), in its `finally`, after the row is final (INVARIANT `cache.write-invalidates-event`). `POST /api/manual-event/rename` and `POST /api/manual-event/settings` call it after their write.
   - Docs: D79, its line in `docs/decisions/README.md`, `docs/ARCHITECTURE.md` (`lib/event-cache.ts`, the split in `lib/queries/live.ts`, `eventCache` in the context line, "busiest two intervals").
5. **Tests** (`app/_ui/event-page.test.ts`, 2 tests, through the tick on PGlite with the in-memory cache):
   - two `loadProgress` reads of one event run one `db.select`, and each read computes `asOf` at its own `now`;
   - a sample stored by the tick drops the entry, so the next read shows 2 readings instead of 1.
   Both fail when their behaviour is removed: without the cache the first sees 2 selects; without the invalidation the second sees 1 reading.

## Decisions
- **`unstable_cache`, not `'use cache'`.** `'use cache'` needs `cacheComponents: true` in `next.config.ts`, which this session must not change (another session's PR edits it). `revalidateTag` takes two arguments in Next 16; `{ expire: 0 }` is used so the first read after a write waits for fresh rows instead of getting the old ones once.
- **Cache rows, not figures.** Only `progressRows` and `memberTurnoutSoFar` are cached; `eventProgressOf` runs per request with `now` and `SAMPLE_EVERY_MIN`, so live/finished, the next reading, the overdue slot and the standings are never frozen.
- **Safety net 60 s for a live event** (`LIVE_MAX_AGE_S = SAMPLE_WAIT_MS / 1000`). The page looks for a slot's reading 60 s after the slot, so the viewers of one refresh share one read, and a missed invalidation leaves rows at most a minute old (plus one request: Next serves an expired entry once while it reads again). At most one read per event per minute even if every invalidation were lost.
- **One day for a finished event** (`DONE_MAX_AGE_S`). After the End no sample comes; admin re-runs and renames invalidate. The key changes from `progress` to `progress-done` when the End appears, so the switch does not depend on an invalidation.
- **The page needs the event detail before it reads progress** (to pick the key), so `/events/[id]` no longer starts both reads together. On a cache hit the progress read costs no database time; on a miss it adds one round trip after `getEventPage`.
- **In-flight sharing.** Without it, 20 viewers missing at the same time ran 20 reads (`unstable_cache` keeps the pending read per request). With it, 1 per server instance.
- **Visibility change invalidates too** (`/api/manual-event/settings`): `publicEvent` decides whether progress is returned at all.
- **D79** records the cache, its keys, the safety nets and the measurements.

## Deviations
- **Delete of an event is not invalidated.** The only delete is `pruneRehearsals`. A rehearsal is never public (`publicEvent` excludes `is_test`), so its entry is always null, and ids are not reused; an invalidation there would change nothing a viewer sees.
- **A rename does not change any cached value** (neither the rows nor the turnout hold the name). It invalidates anyway, as the task asked; it was also the route used to check Next's invalidation end to end (Verified).
- **Translations written by hand, not by the translate-copy skill's translator agents.** The first dispatch (es) was lost when the session restarted, before it wrote anything. Two of the three keys only replace "30" with `{span}` in the existing translation; the new sentence reuses each language's `foughtHelp` and its word for "reading" (from `liveNoReading`). Stamped with the skill's own `pnpm i18n:stamp`. Glossaries unchanged (no new terms).
- **Comments in `LivePulse.tsx`** that said "30 minutes" were fixed too (the task named only `lib/live.ts`).

## Verified
- `pnpm check` green in one run: Prettier "All matched files use Prettier code style!"; eslint and `tsc --noEmit` clean; vitest "Test Files 86 passed | 2 skipped (88)", "Tests 456 passed | 4 skipped (460)"; check-drift "Everything's fine"; "i18n: 17 languages up to date with English".
- New tests: `app/_ui/event-page.test.ts` 2 passed; each fails with its behaviour removed (see Built 5).
- Local measurement, scratch Postgres 18 cluster in the session scratchpad (port 54391, database `lt327`, `pg_stat_statements`), migrated and seeded with `scripts/seed.ts` (seed event 3: 15 samples, finished). Production builds (`next build` + `next start`) of the commit before the cache (`git archive HEAD` of the copy commit) and of this tree. 20 concurrent `GET /events/3` per wave; counts from `pg_stat_statements` after a reset:

  | Case | All statements | Progress reads | Turnout-so-far reads |
  |---|---|---|---|
  | Finished, before the cache | 240 | 20 | 0 |
  | Finished, after, cold | 221 | 1 | 0 |
  | Finished, after, warm | 220 | 0 | 0 |
  | Live, before the cache | 240 | 20 | 20 (60 statements) |
  | Live, after, cold | 164 | 1 | 1 (3 statements) |
  | Live, after, warm | 160 | 0 | 0 |

  The live case was made with SQL (End removed, every time of the event moved so its latest sample is the current slot). The progress read returns about 320 rows per call for this event (16 readings × 20 alliances). Both builds render the same "During the event" section (busiest 12:15–12:45, 38%) and the same live strip ("15 readings so far", "War turnout so far" with the new help line).
- Invalidation in a real Next server: after deleting one sample with SQL (no invalidation) the page still said "15 readings so far"; after `POST /api/manual-event/rename` (200) the next load said "14 readings so far".
- Safety net, same server, no invalidation: one more sample deleted with SQL; loads right after it and 65 s later still said "14 readings so far" (the 65 s load got the expired entry while Next read again), the next load said "13 readings so far".
- Not run: Neon itself (compute and transfer on the hosted database), Vercel's data cache across regions and instances, a real tick writing a sample into a running `next start` (the tick needs the upstream API; the rename route ran the same `nextEventCache.invalidate`).

## Open issues
1. **Neon compute and transfer before and after** (the issue's "done when") are not measured on Neon: only statement counts on a local cluster. The first sampled KvK (2026-11-21) can be compared with a previous Saturday in Neon's console.
2. **The rest of the event page still reads per request**: 8 statements per load for a live event and 11 for a finished one (event list, detail, names, ranks, movers, roster changes, End turnout). They are the same for every viewer and could use the same cache with the same invalidation (follow-up).
3. **Vercel**: `unstable_cache` uses Vercel's data cache there, shared per region; the in-flight sharing is per function instance, so two instances that miss at the same second each read once. Not measured.
4. **A request that started reading just before a write** can store the old rows after the invalidation; the 60 s safety net bounds it.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after this one.

Model / effort: keep. The cache needed reading Next's own source (`unstable_cache` and `revalidateTag` in `node_modules/next/dist`) to find that it cannot run under vitest and that a miss is not shared between requests; that took reading, not a larger model.

Owner must do first: merge this PR before Saturday 2026-11-21 if the live page should be cached during the KvK; after it, open Neon's console for that day's compute and transfer (Open issue 1).

Plan changes needed: none.

<adjustments>
- Page reads that are the same for every viewer of one event go through `getAppContext().eventCache.read(eventId, name, maxAgeS, load)`; a write that changes an event calls `ctx.eventCache.invalidate(eventId)` in its route or in `lib/run.ts`. Cache only database rows (no `Date`: values go through JSON), and compute anything that depends on `now` per request.
- Measured: 12 statements per event-page load before this change; on a cache hit, 8 for a live event and 11 for a finished one. Caching the rest of `getEventPage` is the next saving.
- The window build (D69) must keep the `progress` / `progress-done` key choice in `loadProgress` in step with whatever marks an event finished (today: an `after` row in the event detail).
</adjustments>

PR: (pending)
