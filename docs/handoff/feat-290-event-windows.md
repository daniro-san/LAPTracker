# feat/290-event-windows — Event windows: two-window events like Origin of Chaos (#290, build 1b of #183)

## Built

- **Discovery (origin/dev 7d43ad6f, 2026-11-27; rebased on bd0044d2, which took migration 0079).**
  - #279's samples (D69, PR 292) are on dev: `snapshots.phase = 'sample'`, `slot_at`, the member arrays, the partial unique indexes. Nothing on dev modelled event windows: no `event_windows`, no `event_schedules`, no `schedule_overrides`, no cycle.
  - Build 2 (#175: /admin schedules, the 4-week cycle, one-off alliance events) is not on dev. See "Build 2" under Open issues.
- **Migration 0080** (`drizzle/0080_event_windows.sql`, generated with `pnpm db:generate`, then reordered by hand and given the backfill):
  - table `event_windows (event_id, n, before_at, after_at)`, primary key `(event_id, n)`, `n` 1 to 4, foreign key to `events` with `on delete cascade` (a pruned rehearsal takes its windows);
  - backfill: one window per existing event, from its own `before_at`/`after_at`;
  - `snapshots.window_n smallint not null default 1` and `snapshots.between_windows boolean not null default false`, with two checks;
  - unique index `snapshots_event_window_phase_unique (event_id, window_n, phase) where phase <> 'sample'` is created, then `snapshots_event_phase_unique` is dropped. `snapshots_event_slot_unique` stays.
- **Tick and collector:**
  - `duePhases` and `dueSample` read `event_windows`: each window has its own Before, After and samples; nothing is due between windows.
  - `findOrCreateEvent` stores the windows with the event in one transaction. An existing event with no window row gets window 1 from its own times.
  - `ScheduledEvent.windows`: the env still gives one window.
  - The D141 clock gate (`tickClockDue`) opens per window.
  - A later window's Before reads the event's stored alliance list.
  - The window is threaded through `RunRequest`, `SampleRequest`, `runSnapshot`, `runSample`, `claim` and the `Repo` (`findSnapshot`, `startSnapshot`, `startSample`, `eventWindows`). The window argument is optional everywhere and defaults to 1, so existing callers and tests are unchanged.
- **Budget** (INVARIANT `budget.reserve-for-later-windows`):
  - `requiredQuota(n, laterReads)` and `sampleQuota(n, k, laterReads)` reserve one read (n + 5) for each Before and After of the event's other windows still due that UTC day (`laterWindowReads`).
  - `dailyReadQuota` and its callers (tick, `/api/daily-read/retry`) reserve the event windows' reads still due that day (`eventReadsDueToday`).
  - The squads reserve counts every window.
- **Readers:**
  - `phaseSnapshot` now means the event's Start and End (`phase <> 'sample' and not between_windows`).
  - `getEventDetail` adds `between` (ids and alliance rows), only for a multi-window event.
  - `windowedStart` / `windowedStartRows` (`lib/compute.ts`) make each change the sum of the windows' changes.
  - Moved to it: the event page's ledger rows, alliance and member movers, who gained kills, kill share vs might share (per-window pairing in SQL), compare (alliances and members), the player compare, the alliance page's chain, and the End's public message and picture.
  - Member-row readers that group by phase now filter with `phaseSnapshot`: `sightingsOf` (player pages), the workspace's event might and the KvK recap (post 5, `workspace-rosters.ts`) and a member's own Start (`me.ts`).
  - The live progress (`lib/queries/live.ts`) skips the rows between windows and is not live between windows, so no reading shows as late. `eventSamples` leaves them out.
- **Discord** (`lib/run-notify.ts`):
  - Public: posted by window 1's Before and edited only by the last window's After.
  - Admin: posted by window 1's Before and edited at each window's After, with one block per window phase. A later window's Before does not edit it and posts its own message only when it falls short.
  - Sample shortfalls: one message per window.
- **Tests:**
  - `lib/windows.test.ts` (PGlite, through `runTick`):
    - the two-window event 00:00…00:45 and 12:15…13:15 server, every 15 min;
    - the Discord rule;
    - the quota refusal at 99.
  - `lib/budget.test.ts`: `laterWindowReads`, `requiredQuota(20, 2)`, `dailyReadQuota`, `sampleQuota`.
  - `lib/compute.test.ts`: a property test that the change equals the sum of the windows' changes, and null when any window's is null.
- **Docs:**
  - `docs/decisions/D160-event-windows.md` and its index line;
  - a D69 amendment;
  - GLOSSARY row "event window".

## Decisions

- **Model:** Option B as the spike decided. Readers read `snapshots.window_n` and `between_windows`, not `event_windows`, so rows inserted by hand (tests, `scripts/seed.ts`) keep working with no window row. For the same reason there is no foreign key from `snapshots` to `event_windows`.
- **One predicate stays the Start/End test.** The Befores and Afters between windows are flagged rows, so the 64 files that read a phase keep reading the event's Start (window 1's Before) and End (the last window's After) with no change. Only the code that computes a change reads the rows between windows.
- **The sum rule:** the Start is shifted by what changed between the windows (`windowedStart`). `delta` then gives exactly the sum of the windows' changes, and a missing or stale row between windows makes the change null. A property test checks both. The shifted value is never displayed. Percent changes in the movers use the shifted Start as their base.
- **Window times:** `event_windows` stores the Before and After slots only, not the game window (00:10–00:40). D63's "event started" check still uses `events.event_at_utc` (window 1's start): a later window's stale Before cannot be read again with `stale: true`.
- **Discord picture:** only the event's Start and its last End post a picture. The End's picture shows the event's change (the sum of the windows).
- **Member history (D60):** shows the event's Start and End rosters only. Its changes are roster to roster, so the rows between windows are not cards.
- **No persona panel.** The public and admin message rules come from the owner's answers 11 and 16. The page shows the same sections as for a one-window event; no new UI choice was made.

## Deviations

- The issue says "Starts from #279's branch". #279 was merged long ago, so the branch was cut from origin/dev.
- Lint limits (complexity 12) required small extractions: `publicSides`, `startFinishedAt`, `blockTimes` in `lib/run-notify.ts`, `memberMeasured`/`memberBetween` in `lib/queries/compare.ts`, `playerBetween` in `lib/queries/compare-player.ts`. `claim`'s `window` option is required (its one caller always passes it).
- The `event_windows` check that Before ≤ After was dropped. The backfill cannot be checked against production here, and a violating row would fail the migration.

## Verified

- `pnpm vitest related --run <39 changed .ts files>`: `Test Files 381 passed | 2 skipped`, `Tests 2046 passed | 4 skipped`. That was before the last change to `lib/queries/live.ts`. After it, `pnpm vitest related --run lib/queries/live.ts lib/windows.test.ts`: 30 files, 179 tests passed.
- The full suite's first run had one failure (`lib/notify-event-message.test.ts`, database down during notify). Fixed: notify falls back to one window when the window read fails.
- Mutation check: with `windowedStart` returning the Start unchanged, `lib/windows.test.ts` fails with `[2240, 2240, 2240]` instead of `[240, 240, 240]`. Restored.
- `pnpm check` after the rebase on bd0044d2: prettier, eslint and tsc green. vitest: `Test Files 6 failed | 376 passed | 2 skipped`, `Tests 6 failed | 2050 passed | 4 skipped`. All 6 failures are `Test timed out in 10000ms` (13–43 s each) at load average 41–47 from other sessions on this machine. Re-run on their own: 5 of the 6 files and `lib/windows.test.ts` passed together; `lib/squads-read.test.ts` timed out again in that group (16 s) and passed alone (11/11) at load 46. The drift and i18n steps, run on their own: "Everything's fine" (migration 0080 matches the schema) and "17 languages up to date with English". `pnpm db:generate` regenerated 0080 from the schema with the same statements as the hand-edited file, except the backfill insert.
- After the review fixes, `pnpm check` at load average 3–5: green. prettier, eslint, tsc; vitest `Test Files 382 passed | 2 skipped (384)`, `Tests 2058 passed | 4 skipped (2062)`; drift "Everything's fine"; "i18n: 17 languages up to date with English". The earlier timeouts were load only.
- Not run: `next build`, a browser view of a two-window event page, the migration on Neon (no production or preview access in this session). 0 upstream calls.

## Open issues

1. **Build 2: does the tick know about 2026-12-05 today? No.**
   - `lib/schedule.ts` builds one weekly event from the env (`EVENT_WEEKDAY`, `EVENT_TIME`, `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`).
   - On Fri 2026-12-04 at `SNAPSHOT_BEFORE` server (10:00 per #279's owner step, 12:00 UTC), the tick creates "Saturday Event 2026-12-05" with one window at KvK times (10:00–16:15 server). That covers window 2 (12:30–13:00), misses window 1 (00:10–00:40), and spends a KvK's quota (≈ 26 reads, 546–598 calls).
   - **Smallest way:** a dated cycle in `lib/schedule.ts` `eventOn`: week 1 = 2026-11-14, 4 weeks; weeks 1–3 use the env (KvK); week 4 is "Origin of Chaos YYYY-MM-DD" with windows `[{00:00, 00:45}, {12:15, 13:15}]` server and `eventAtUtc` 00:10.
   - This build already carries `ScheduledEvent.windows` into `findOrCreateEvent`, the D141 gate and the squads reserve, so that change is about 20–30 lines plus a schedule test. It needs no database read, so D141 holds.
   - Owner-set on /admin (#175 as specced) is the larger form and can follow later.
   - **Deadline for build 2:** deployed before Fri 2026-12-04 12:00 UTC (10:00 server). After that the tick may already have created the KvK-shaped row for 12-05. The Origin of Chaos row has another `event_at_utc`, so both events would then exist.
2. **Release of this branch:**
   - Migration 0080 must ship with this release (`pnpm db:migrate` in the release, as for 0018).
   - Apply it when no Before, After or manual round can be claimed. The previous build's claim (`on conflict (event_id, phase) where phase <> 'sample'`) has no matching index once 0080 runs. Weekdays outside the daily read's window are safe.
   - Never roll back below 0080.
   - The backfill is safe on production data: it only inserts one `event_windows` row per `events` row from that row's own two non-null times. The two new columns have defaults that mean "window 1, not between". No row is updated or deleted.
   - An event created by the old build between the migration and the deployment gets its window on the next `findOrCreateEvent`.
3. **Live views between windows** (D69's pulse, the fight clock, the standings "so far", #307's turnout so far):
   - They read the Start, the samples and the End.
   - During window 2 the pulse shows the 12 hours between windows as missing slots (48 at 15 min, from the 00:30 sample to the 12:30 one). The "so far" figures include what changed between the windows.
   - Between the windows the strip is not live (fixed here: no false "late").
   - Fixing this needs a reader choice (a gap marker, or a pulse per window). Follow-up for build 3.
4. **The event page between windows** shows no End and no change until the last window's After (about 12 h for Origin of Chaos). The public Discord message waits too, as the owner asked.
5. **Admin buttons** (`/api/snapshot`, "Run something now", re-runs) act on window 1. A forced re-run of window 2's Before or After from /admin is not possible yet.
6. **D63 for a later window:** a stale window-2 Before cannot be read again with `stale: true` (see Decisions).
7. **The event pause** (`inEventWindow` in `lib/schedule.ts`: squads reads, lookups, the workspace's site reads) spans the scheduled event's first Before to its last After. It is unchanged here because the env gives one window. Build 2 decides whether a two-window event pauses those reads for the 12 h between windows or only inside each window.
8. **The alliance-in-event page's member list** (`viewsOf` in `app/_ui/member-views.ts`) shows each member's change from Start to End. Its totals and member movers sum the windows (review fixes below); the per-member list does not yet.
9. **Window-row repair** in `findOrCreateEvent` still runs its `insert … on conflict do nothing` on every tick in the creation span. Skipping it when the rows exist needs a select of the same cost, so it was left.

## Review fixes (PR #784, 2026-11-27)

1. `GET /api/events/[id]` no longer serves `between`: its alliance rows carried `powerBoard`, `killsBoard`, `source` and `cached` (D5). Test: a two-window event serves its Start and End only, with no board numbers.
2. `getEventDetail` reads the Befores and Afters in one statement and splits the rows between windows in memory: no extra round trip.
3. Live strip: a later window's Before counts as the newest reading when it finished after the latest sample (`lastReadAt`), so window 2's 14:15 UTC slot is not late before its 14:30 sample. Test at 14:25 UTC (12:25 server); it fails without the fix.
4. `memberMovers` takes `between` as a required argument. The alliance-in-event page passes `eventBetweenIds(db, eventId)`, and its totals use `getAllianceDetail`'s new `changeFrom` (the windowed Start, multi-window events only).
5. `memberTurnout` takes `between` as a required argument. The merge simulator's `latestTurnouts` passes `eventBetweenIds` per event. Test: with an alliance's window-1 After stale, that alliance has no turnout figure, and the other 19 have 240 each.
6. Kill share vs might share: an alliance has a gained figure only when every window up to the End has a usable (fresh, no error) Before and After pair, as in `windowedKills`. Same test: the stale alliance is not in the rows, and the totals count 19 alliances.
7. Player page: Might and Kills in an event are the sum of the windows' changes (`betweenSightings`, `windowedStart`), as in the player compare. With no rows between windows the old Start-to-End path stays, so a null kills (D15) is shown as before. Level stays Start to End. Test: the member's kills change is 120.
8. `allianceHistory` runs one chain query over the non-sample rows and splits it by `between_windows` in memory.

## Next

- Build 2, before Fri 2026-12-04 12:00 UTC: the dated 4-week cycle in `lib/schedule.ts` (Open issue 1). It needs this branch merged first, or merged together. Then #175's /admin editor.
- Build 3: live views across windows (Open issue 3) with the D68/D158 charts.
- Owner, after this release: check `/admin/runs` on 2026-12-05 for 4 phase runs (Start, window 1 End, window 2 Start, End) and 5 samples.
- Plan changes needed (not edited here): docs/IMPLEMENTATION_PLAN.md §3.1 (the tick takes windows), §3.4/§4 (budget per later window on the UTC day), §6 (schema: `event_windows`, `snapshots.window_n`, `between_windows`).

What was missing from the task prompt? Which live-view behaviour between windows is wanted (gap marker or per-window pulse), and whether admin re-runs must reach window 2 before 2026-12-05.

PR: (added by the orchestrator)
