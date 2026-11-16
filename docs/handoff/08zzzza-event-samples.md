# 08zzzza — Event samples every 15 minutes during single-window events (#279, build 1a of #183)

The owner wants heatmaps of the busiest moments of an event. Build 1 of spike #183 (windows, schedules, every reader moved to windows) is too large before the KvK of Saturday 2026-11-21, so this build only adds samples between an event's Before and After. Before and After are stored and read exactly as before.

## Built
- **Migration 0017** (`drizzle/0017_aromatic_sprite.sql`):
  - `snapshots.phase` accepts `sample`;
  - new column `snapshots.slot_at`, with a check that it is set exactly on samples;
  - `snapshots_event_phase_unique` becomes a partial unique index `(event_id, phase) where phase <> 'sample'`;
  - new partial unique index `snapshots_event_slot_unique (event_id, slot_at) where phase = 'sample'`;
  - `alliance_snapshots.member_uids`, `member_names`, `member_power`, `member_kills` (nullable arrays; null on Before and After rows).
- **Tick** (`lib/tick.ts`, `lib/repo/events.ts` `dueSample`, `lib/schedule.ts` `slotOf`):
  - new step after the phases and before the Friday check: the event due at the slot that holds now gets one sample;
  - `SAMPLE_EVERY_MIN` in `lib/env.ts` and `.env.example`: default 15, 0 = off, must divide 60;
  - a slot no tick took is not caught up; manual rounds get no samples;
  - `/api/tick` answers a sample like a run (`runResponse`).
- **Collector** (`lib/collector.ts`):
  - `runSample(eventId, slotAt, deps)` claims the slot with one insert (`startSample`), reads the event's stored alliance list, and goes through the same quota check, `/v1` reads, retries, deadline and call cap as a phase;
  - a sample reads no ranks board and uses no internal fallback: a failed alliance gets an error row `v1 <error>`;
  - rows are stored by `insertSampleRow`: members as arrays, `raw_json` null, no `member_snapshots`.
- **Budget** (`lib/budget.ts` `sampleQuota`, INVARIANT `budget.samples-yield-to-after`): `requiredQuota(n) + 1 + 4n`, which is 131 calls for 20 alliances.
- **Run and notify:**
  - `lib/run.ts`: the claim/logger/finally plumbing of `executeSnapshot` moved into `collect()`, which `executeSnapshot` and the new `executeSample` share;
  - `lib/run-notify.ts` `notifySample`: nothing public; one admin message for the first sample of an event that ends partial or failed, nothing for later ones (`otherShortSample`).
- **Readers:** one predicate, `phaseSnapshot`, plus `phaseColumn` (the phase typed as before/after), in `lib/queries/visibility.ts`. It is applied in:
  - `listEvents` and `getEventDetail`, which feed the event page, compare, `/api/events*`, the event picture and the public message;
  - `getAllianceDetail`, `allianceHistory`, `allianceNames`, `historyRanks` and the upstream banner;
  - member history (`eventUsable` in `history-readings.ts`: one condition);
  - the admin target event, manual round and rehearsal panels;
  - with an inline `phase` check in `loadVerdictInput`, `listPhaseReports` and `scheduledEventDone`.
  - `players.ts` only changes the selected column's type: its reads join `member_snapshots`, so they never see a sample.
- **Admin:**
  - `runningSnapshots`, `listRuns` and `getRun` return `slotAt`;
  - `runWord` in `app/_ui/admin/words.ts` names a sample "Sample 10:15" in the run list, on the run page, in the live candle and in the "last run" fact. No new UI section.
- **Read model** `eventSamples(db, eventId)` (`lib/queries/samples.ts`, exported from `lib/queries`). It returns a public event's Start, samples and End in time order, each alliance with read time, fresh flag, might, kills, members and roster `{uid, might, kills}`. No page uses it yet.
- **Tests:**
  - `lib/samples.test.ts`: 8 PGlite tests through `runTick`;
  - `lib/budget.test.ts`: a property test and the 131 figure for `sampleQuota`.
- **Docs:**
  - `docs/decisions/D69-event-samples.md` and its line in the index;
  - GLOSSARY rows "sample" and "slot";
  - two lines in ARCHITECTURE.md (tick and run).

## Decisions
- **The Start's slot is the slot of `before_at`.** Samples are due at slots strictly after it and strictly before `after_at`. Using the Before's actual start time instead would only matter when the Before runs late; then the first sample can come less than 15 minutes after it.
- **"Start done" means the Before row exists and is not `running`, whatever its status.** A failed Before still stored the alliance list, and a sample during an outage is still useful. A sample whose Before failed on quota fails on quota too.
- **Sampling stops once the After has a row.** This also stops sampling when an After was pressed early by hand.
- **A sample skipped by the budget rule keeps its row.** The row closes `failed` with `quota: remaining … < required …`, so the slot is used and no second caller in that slot spends another quota call. That failed row also triggers the event's one admin sample message.
- **No ranks board for a sample.** The board comes from the internal API, and D5/CLAUDE.md say not to widen its use. A sample's `power_board`/`kills_board` are null.
- **Samples do not update `player_frames` (D66).** That would be new behaviour; the Before and After still update it.
- **Discord: post once per event, later failures post nothing; no edit.** An edit does not notify (D31). The run list holds every sample.
- **`eventSamples` gives the Start and End the event's `before_at`/`after_at` as their `at`, and samples their slot.** Each alliance carries its upstream read time (`readAt`) for exact times.
- **Constraint form:** two partial unique indexes, not `nulls not distinct`. Why is in D69.

## Deviations
- **`TEST_ENV` sets `SAMPLE_EVERY_MIN: "0"`** (`lib/app-context.test-helpers.ts`). With the default of 15, two existing tick tests take samples in their windows. Existing test files are unchanged; `lib/samples.test.ts` turns samples on.
- **Small refactors to stay under the lint limits** (max-lines 300, complexity 12):
  - `runSnapshot` destructures its options;
  - `allianceIds` takes `SnapshotPhase` (a sample, like an After, reads the event's stored list);
  - the sample's error row is chosen inside `fallbackRow`;
  - `store()` picks the insert;
  - the tick's sample step is its own function.
- **`RunRefusedError` has a new reason, `taken`** (answered as `409 sample_taken`). The tick maps it to `idle`.

## Verified
- `pnpm check` green:
  - prettier, eslint, tsc;
  - vitest: `Test Files 60 passed | 1 skipped (61)`, `Tests 280 passed | 1 skipped (281)`;
  - drift (migration 0017 matches the schema);
  - `i18n: 17 languages up to date with English`.
- `lib/samples.test.ts` (PGlite). The KvK-shaped Saturday is SNAPSHOT_BEFORE 10:00, SNAPSHOT_AFTER 16:15, every 15 min, ticks 20 s after each slot:
  - Ticks 12:00…18:15 UTC with a second tick at 13:05: Before at 12:00 and After at 18:15 (the only `run` ticks); 24 samples at 12:15…18:00 UTC (10:15…16:00 server); the 13:05 tick is `idle`, so one sample per slot.
  - A sample row has the member arrays, no `raw_json` and no member rows. The Before rows keep `raw_json` and member rows and have no arrays.
  - With After at 16:10 server, a tick at 18:11 UTC (After due, slot 18:00 still open) runs the After, and a tick at 18:13 does nothing: phases win, and nothing is sampled after the After.
  - Budget: with `remaining` 130 (After needs 50, sample 131), the 12:15 and 12:30 samples close `failed` with `quota: remaining 130 < required 131`, and the After then runs `complete`.
  - One alliance failing in two samples: an error row `v1 Error` in each, the internal source never called, no public post, exactly one admin post, containing "Sample 10:15: partly done".
  - A manual round with its Before taken: two ticks in later slots are `idle` and no sample row exists.
  - Unchanged output, on a shorter event of the same shape (After 11:00 server, 3 samples, to keep the suite under its 10 s test timeout), checked two ways:
    - the event page (`getEventPage`), member history (`memberHistory`, `memberHistoryIndex`), alliance history and a player's history are deep-equal with the 3 samples present and after deleting them;
    - the public Discord messages of the run with samples are identical to a run with `SAMPLE_EVERY_MIN=0`.
  - `eventSamples` (same shorter event): kinds `before`, 3 × `sample`, `after`, at 12:00…13:00 UTC in order. One alliance's 12:15 sample is checked field by field, and a null kills stays null.
  - The unchanged-output test failed when I removed the filter from `eventUsable` (member history), and again when I removed it from `getEventDetail`. Both filters were put back.
- The full suite timed out once (another file's test) while three tests ran the whole 26-tick event; the page and `eventSamples` tests now use the shorter event, and the one full-event test has a 60 s limit. `pnpm check` then passed twice in a row.
- Not run: `next build`, a browser check of the "Sample 10:15" label on /admin, and a run against Neon. No upstream call; 0 quota.

## Open issues
1. **Owner, before Friday 2026-11-20 12:00 UTC (10:00 server)**, which is when the tick creates Saturday's event row and fixes its times (D21):
   - Merge and release this PR. The release must apply migration 0017.
   - In Vercel Production, set `SNAPSHOT_BEFORE=10:00` and `SNAPSHOT_AFTER=16:15`, then redeploy. The Start is then at 10:00, samples run 10:15…16:00 server, and the End is at 16:15. `SNAPSHOT_BEFORE=09:45` adds one sample (+21–23 calls).
   - `SAMPLE_EVERY_MIN` can stay unset (default 15); `0` turns samples off.
   - If the row already exists with other times, they do not move with the env.
2. **Expected quota for Saturday 2026-11-21 (one UTC day):**
   - 26 reads (Before, 24 samples, After) × 21 calls = 546 calls, or × 23 = 598 calls with two 502 retries per read (the measured 21–23); the daily read is skipped on that day.
   - Each read takes up to 35 s, which is under the 100 s deadline and the 15-minute tick, so one read per tick.
   - In an outage a sample can cost up to 81 calls. The budget rule skips samples once `remaining < 131`, which keeps 50 for the After.
   - Friday's rehearsal (18:00 server) now takes 1–2 samples: +21–42 calls on Friday.
3. **After the parallel #270 PR (`session/08zzzx-player-daily-progress`) merges:**
   - `lib/queries/player-progress.ts` needs the same sample check. It reads event rosters through an inner join on `member_snapshots`, so samples should not appear, but confirm it, or add `phaseSnapshot`.
   - That PR renames the usable-roster conditions in `history-readings.ts` (`eventFit`). The `phaseSnapshot` line in `eventUsable` must move into `eventFit`.
   - The event page's "Who fought" (#271/PR #278) needs the same check if it reads `snapshots` by event outside `getEventDetail`.
4. **The admin run list fills with samples on a Saturday.** `listRuns` shows the newest 60 runs; a KvK adds 26, so the Before stays visible but older events scroll off sooner. A filter (Events / Samples) is not built.
5. **A sample left `running` by a killed function stays `running`,** like a phase (D43). Its slot stays taken and no admin message is sent for it.
6. **Storage:** about 63 KB per sample of 20 alliances (spike review measurement, not re-measured here), so about 1.5 MB more per KvK Saturday.
7. **Not run in a browser:** the "Sample 10:15" label on `/admin/runs` and on the run page.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`. Two follow-ups, in either order once samples exist in production:

Model / effort: keep. For both, the size of the change is close to this session's (a read model or a migration plus readers), and nothing went wrong here that would call for more.

Owner must do first: Open issues 1 (merge, release, env before Fri 2026-11-20 12:00 UTC). After Saturday, check `/admin/runs` for the 24 samples.

Plan changes needed: none in this PR. The window build changes plan §3.1 (the tick takes slots), §3.4/§4 (budget per window end) and §6 (schema), as the spike's handoff lists.

Prompt sketch, chart build (V1 pulse, V4 heatmap alliance × slot, V5 my alliance):
```text
<session>
Charts of an event's samples (spike #183 build 3, D68 + D69). Read CLAUDE.md, D68, D69, docs/handoff/08zzzza-event-samples.md, lib/queries/samples.ts.
</session>
<task>
1. On the event page, under a "During the event" section shown only when eventSamples(db, id) has samples: V1 pulse (the tracked alliances' kills gained per slot, the "Busiest 15 min" line), V5 my alliance (one alliance's might and kills per slot; the same for one member on the player page), V4 heatmap (alliance × slot, kills gained; behind "Details" at 360 px because the cells are under 44 px).
2. Compute deltas between consecutive usable readings per alliance; a stale reading shows no change (glossary "sample").
3. Draw with D68's hand-built SVG server components; each chart's numbers in a table behind "Details".
4. Copy in lib/copy.ts (public, all languages via translate-copy).
</task>
<done_when>pnpm check green; screenshots at 360 px of an event with and without samples; pages of events without samples unchanged.</done_when>
```

Prompt sketch, window build (Origin of Chaos, next on 2026-12-05):
```text
<session>
Event windows (spike #183 build 1b, amends D69). Read CLAUDE.md, D1, D21, D31, D69, docs/handoff/08zzh-spike-event-model.md (Options, #171, #175, Review) and docs/handoff/08zzzza-event-samples.md.
</session>
<task>
1. Migration: event_windows (event_id, n, start_at, end_at, cadence_min; unique (event_id, n)); snapshots.window_id; backfill one window per event; unique (window_id, slot_at) replaces snapshots_event_slot_unique.
2. A window's first and last samples are its Start and End (full: member rows, raw_json); middle samples stay as D69 stores them.
3. Readers move from phase before/after to windows; one-window events render exactly as today.
4. Budget: remaining ≥ requiredQuota(n) × window ends still due this UTC day + one sample's worst case.
5. Discord: public message at the event's first Start, edited at its last End; admin message edited at each window end; at most one failed-sample message per window.
6. Origin of Chaos windows from the env until the /admin schedule build (00:10–00:40 and 12:30–13:00 server, owner-editable).
</task>
<done_when>pnpm check green; a PGlite test runs a two-window event through the tick (one sample per (window, slot), both windows' Start/End, the budget rule); before 2026-12-05.</done_when>
```

<adjustments>
- Samples exist from build 1a (D69): `snapshots.phase = 'sample'`, `slot_at`, member arrays on `alliance_snapshots`. The window build keeps that storage and adds `window_id`. Every sample already has its event and slot, so the backfill does not need to compute them.
- Every reader of Before/After already goes through `phaseSnapshot` (defined in `lib/repo/snapshots.ts`, re-exported by `lib/queries/visibility.ts`) / `phaseColumn` (`lib/queries/visibility.ts`), or `isSample` for rows in memory. Grep those names to find the readers the window build must move.
- `eventSamples` is the one read model for charts. It returns Start, samples and End with rosters `{uid, might, kills}`; names come from the Start/End member rows.
- Real numbers: a KvK with Before 10:00 and After 16:15 is 26 reads, 546–598 calls; `sampleQuota(20)` = 131.
- Skip: the spike's O2 observation (manual rounds every 15 minutes on a KvK). Samples now collect that data on their own.
</adjustments>

## Review fixes (2026-11-16)

Applied from the review of PR 292.

1. `eventRanks` filters with `phaseSnapshot` in SQL and selects `phaseColumn`; the event-page test that compares pages with and without samples covers its output.
2. `eventSamples` test: a running sample and a failed alliance row are absent; a rehearsal and an admin-only event return null.
3. Rehearsal test through the tick: a sample row exists between its Before and After; `latestRehearsal` shows two phases and the same verdict with the sample deleted.
4. The not-a-sample predicate is defined once as `phaseSnapshot` in `lib/repo/snapshots.ts`; `lib/queries/visibility.ts` re-exports it; `scheduledEventDone` uses it. `isSample(phase)` replaces the in-memory comparisons (`loadVerdictInput`, `listPhaseReports`, `eventSamples`). D69 has an amended bullet.
5. Property test for `slotOf` in `lib/schedule.test.ts`: for every cadence that divides 60, the slot is on the grid, at most the input, and less than one cadence before it.
6. Tick test for the lost claim: `dueSample` is queued to report a slot free that another caller has already taken (a pass-through `vi.mock` of `lib/repo/events`); the tick answers idle.
7. The retry count has one definition, `MAX_RETRIES` in `lib/budget.ts`, and `lib/sources/v1.ts` imports it; `ATTEMPTS_PER_READ = MAX_RETRIES + 1`. The review asked for the reverse direction (export from `v1.ts`, derive in `budget.ts`). That would make `lib/budget.ts` import from `lib/sources`, which docs/ARCHITECTURE.md forbids ("`lib/compute` and `lib/budget` import nothing from the project"), so the constant lives in `budget.ts`. `lib/budget.test.ts` references it and `lib/sources/v1.test.ts` still pins 4 attempts.

https://github.com/daniro-san/LAPTracker/pull/292
