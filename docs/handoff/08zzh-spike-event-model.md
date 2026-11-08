# 08zzh — Spike: the event and snapshot model (samples, windows, ranges) — #171 #175 #176

## Built
- This file: one model for #171 (snapshots through the event), #175 (events and their windows from /admin) and #176 (time ranges inside an event), compared with two alternatives, with every issue question answered with numbers.
- Two mockups at 360 px, rendered by a local `next dev` from the preview DB's seed event 3 (alliance OGs). The pages that drew them were throwaway and are not committed:
  - `docs/screenshots/08zzh-in-event-range-360-light.png` — #176, the alliance page's "During the event" section.
  - `docs/screenshots/08zzh-admin-event-editor-360-light.png` — #175, the /admin event schedule editor and routine times.
- No production code, no migration, no dependency, no upstream call.

## Decisions
- **Terms used below** (proposed for docs/GLOSSARY.md in the build; not added here):
  - **sample**: one read of all tracked alliances at one time. It is today's `snapshots` row; a Before or an After is a sample.
  - **window**: one stretch of game time an event covers, for example 00:10–00:40 server. An event has 1 to 4 windows.
  - **slot**: a 15-minute tick time (:00, :15, :30, :45) at which a sample is due.
  - **event schedule**: the /admin row that makes the tick create an event a day ahead. It replaces the env vars of D1.
  - **light sample**: a sample in the middle of a window. Its alliance rows carry no `raw_json` and its member rows carry no `avatar_url`, `rank_code` or `rank_label`.
- **Recommended model (Option C below): samples are shared and linked to event windows.**
  - An event has N windows.
  - A window has its own Before slot and After slot, and samples every `cadence_min` (15, 30 or 60) between them.
  - The tick takes one sample per slot, no matter how many windows need that slot, and links it to each of those windows.
  - A window's Before is its first linked sample and its After is its last linked sample.
  - An event's change is the sum of its windows' changes.
  - Any two samples of one event form a #176 range.
- The handoff file name follows the session prompt (`08zzh-spike-event-model.md`), not #171's body (`08zzh-spike-war-snapshots.md`).

## Deviations
- **Production was not read.** The session allowed only the Neon preview DB through `.env.local`. The preview DB holds only seed data: events 1–3 ("Seed Saturday Event") and one rehearsal, `tick_log` empty, 11 MB. The seed rosters drift by construction (`scripts/seed-data.ts` `drifted()`: every member's power changes in every snapshot), so their movement is not evidence of upstream behaviour. Real evidence came from:
  - `fixtures/`: two `/v1` reads of the same two alliances 666 s apart;
  - docs/handoff/09-dryrun.md: real runs on production.
- **Row sizes were measured in PGlite (local, in memory)** from 20 real `/v1` bodies in `fixtures/v1-ids/`, with the `trimRaw` trim and `member_snapshots`' columns and indexes. The seed rows hold a 17-byte stub `raw_json`, so the preview DB cannot show real sizes.
- `playwright-core` was installed in the scratchpad (not the repo) to capture the mockups with the system Chrome.

## Verified

**Read:**
- the three issues with comments;
- CLAUDE.md, 00-prereqs, 08zzg;
- D1, D2, D21, D25, D26, D28, D30, D31, D43, D44, D45, D51, D53 in docs/DECISIONS.md;
- `lib/budget.ts`, `lib/schedule.ts`, `lib/tick.ts`, `lib/run.ts`, `lib/collector.ts`, `lib/collector-rows.ts`, `lib/schema.ts`, `lib/compute.ts`, `lib/env.ts`, `lib/raw-json.ts`, `lib/repo/events.ts` (`duePhases`);
- `lib/queries/` `events`, `event-page`, `visibility`, `movers`, `ranks`, plus the phase use in `players` and `alliances`;
- `app/_ui/AcrossEvents.tsx`;
- plan §2, §3.1, §6.1, §10 q6, lines 18/381/389/392/662.

**Measured:**

| What | Number | Source |
|---|---|---|
| Calls per sample | 21 (1 quota + 20 alliances), 0 retries | 09-dryrun, production 2026-11-05 |
| Sample duration | 9.6–10.0 s | 09-dryrun |
| Tick start after its slot | +15 to +21 s (20:30:15, 21:00:21, 23:00:20, 23:30:15) | D30 proof, 09-dryrun |
| Upstream cache | `cache_seconds: 600` in all 4 `/v1` fixtures; `cached: false` and `updated_at` = read time when reads are 666 s apart | `fixtures/v1-20261104T154755Z`, `…155902Z` |
| Weekday movement in 666 s (Wed 15:47 → 15:59 UTC) | OGs: power changed for 11 of 100 members, kills for 0 (Δ might −799,204). URSA: power 18 of 95, kills 0 (Δ might −302,544) | same fixtures, uid/power/kills only |
| Full sample, stored | 752 KB: alliance rows 272 KB (`raw_json` 646 KB as text → 159 KB after TOAST, 4.1×) + member rows with both indexes 480 KB (1,739 members) | PGlite, `fixtures/v1-ids/` (20 bodies) |
| Light sample, stored | ≈ 290 KB: member rows with uid, power, kills and indexes 272 KB (measured), plus name and alliance rows without `raw_json` (estimated ≈ 20 KB) | PGlite |
| #176 queries at one year of data (52 events × 13 samples × 20 alliances × 87 members = 1,176,240 member rows) | one alliance's members over a range 1.3 ms; every member over a range (top 5) 2.5 ms; per-interval table for one alliance 0.2 ms; per-interval for one member 1.0 ms | PGlite, mean of 20 runs; Neon adds network time, not measured |
| Mockups at 360 px | `document.documentElement.scrollWidth` = 360 on both pages (no horizontal scroll); selects, buttons and table links are `min-h-11` (44 px) | Playwright + Chrome |

Plan §6.1 underestimates storage: it put member rows at ≈ 250 KB per snapshot. The measurement is 480 KB with indexes, so today's 2 samples a week are ≈ 78 MB/year, not 15–45 MB.

### #171 — snapshots through the event

**1. Quota.** 1,000 calls per UTC day. `requiredQuota(20)` = 2 × (20 + 5) = 50. Saturday 00:00–24:00 UTC is Fri 22:00 – Sat 22:00 server, so every Saturday window below falls on one UTC day. The Friday check (Fri 20:00 server = Fri 22:00 UTC) and the rehearsal (Fri 18:00 server = Fri 20:00 UTC) fall on Friday's UTC day.

| Saturday plan (window 10:00–16:00 server for KvK) | Samples | Calls | Left of 1,000 |
|---|---|---|---|
| Today: Before 10:00 + After 14:00 | 2 | 42 | 958 |
| KvK every 60 min | 7 | 147 | 853 |
| **KvK every 30 min** | 13 | 273 | 727 |
| KvK every 15 min | 25 | 525 | 475 |
| Origin of Chaos alone, every 15 min (2 windows) | 9 | 189 | 811 |
| **KvK 30 min + OoC 15 min, shared slots (Option C)** | 20 (12:30 and 13:00 shared) | 420 | 580 |
| Same, not shared (Options A and B) | 22 | 462 | 538 |
| KvK 15 min + OoC 15 min, shared | 29 | 609 | 391 |

- Margin for retries: each 502/503/504 retry costs 1 call, at most 3 per alliance. A run is capped at 120 calls (`MAX_UPSTREAM_CALLS`).
- A manual re-run costs 21 calls. A plain re-run of a partial sample costs 1 + the number of missing alliances.
- Upper bound: (1,000 − 100 margin) / 21 = 42 samples per UTC day.
- **Budget rule needed:** in a full upstream outage a sample costs up to 81 calls (1 + 20 × 4), so 20 samples could spend 1,620 calls. `INVARIANT budget.reserve-for-after` becomes: before any sample, `remaining ≥ 25 × (1 + window ends still due today, across all events)`. Middle samples are skipped first, and a window's After is never starved.

**2. Does the data move at that grain?**
- Upstream reads are refresh-on-read: `updated_at` equals the read time and `cached: false` whenever reads are more than 600 s apart.
- On a weekday, might moved for 11–19 % of members in 11 minutes and kills for 0 %. Kills move only in fights. In-event movement per 30 minutes is **not measured**: production holds only Before/After, and the preview holds seed data.
- The 20-minute freshness rule is unaffected: our reads are 0.7–1.2 s old (09-dryrun).
- Below 10 minutes between reads, a body may come back cached. Above that, every read is new data.
- Observations proposed for the owner to run (not run here):
  - **O1, 0 quota, now.** A read-only SQL on production, below. It counts per alliance how many members' kills and power changed between today's Before and After. It shows how many members fought.
  - **O2, about 84 calls, next Saturday.** During KvK, start manual rounds with visibility "Admin only" and press Before/After at 12:00, 12:30, 13:00 and 13:30 server (4 samples). Then run O1's query on consecutive pairs. If kills change in most 30-minute pairs, 30 min is the right cadence. If they change in one jump, 60 min is enough.

```sql
-- O1 (production, read-only): today's scheduled event, members on both sides.
with e as (select id from events where event_at_utc = '2026-11-07T14:00:00Z' and not is_test and not manual),
a as (select a.id, a.union_id, a.tag, s.phase from alliance_snapshots a
      join snapshots s on s.id = a.snapshot_id
      where s.event_id = (select id from e) and a.is_fresh and a.error is null)
select b.tag, count(*) as members_both,
  count(*) filter (where ma.kills <> mb.kills) as kills_changed,
  count(*) filter (where ma.power <> mb.power) as power_changed,
  sum(ma.kills - mb.kills) as kills_delta
from a b join a af on af.union_id = b.union_id and b.phase = 'before' and af.phase = 'after'
join member_snapshots mb on mb.alliance_snapshot_id = b.id
join member_snapshots ma on ma.alliance_snapshot_id = af.id and ma.uid = mb.uid
group by b.tag order by kills_delta desc;
```

**3. Scheduler.**
- cron-job.org ticks every 15 minutes at :00/:15/:30/:45 and starts 15–21 s late.
- A sample takes 10 s. That leaves 110 s under `maxDuration` 120 s and 140 s under the run lock (150 s). One sample per tick fits.
- 15 minutes is the practical floor. The tick could run every 5 minutes at no quota cost (cron-job.org setting), but the upstream cache (600 s) makes reads closer than 10 minutes unreliable, and quota caps a 6-hour window at about 8 minutes.
- 15 minutes is enough: 30 min for KvK, 15 min for 30-minute windows (Origin of Chaos), which gives 2 samples inside each window plus Before and After.
- With Option C two events never compete for a tick, because a shared slot is one sample.

**4. Data model.** See Options. `unique (event_id, phase)` becomes `unique (slot_at)` for scheduled samples, plus a link table. A double tick still cannot take a slot twice; D1's guarantee is kept. Storage:

| Plan | Per week | Per year | Reaches the 700 MB warning (`DB_WARN_ABOVE_MB`) |
|---|---|---|---|
| Today (2 full samples) | 1.5 MB | 78 MB | never in practice |
| KvK 30 min, middle samples light (2 full + 11 light) | 4.7 MB | 245 MB | ≈ 2.9 years |
| KvK 30 + OoC 15, shared, middle light (6 full + 14 light) | 8.6 MB | 446 MB | ≈ 1.6 years |
| Same, every sample full (20 full) | 15 MB | 782 MB | < 1 year |

Neon Free is 1 GB per project (docs/PREREQUISITES.md). Production's current size was not read (the Friday message shows it). Light middle samples are needed. A later thinning rule (after N weeks, delete light samples' member rows and keep their alliance totals) would bring the long-run cost down to about 250 MB/year; that is an owner decision, not part of the build.

**5. Display.**
- **Chart-free (recommended for this build, mocked):** a "During the event" section with:
  - one "Busiest half hour" line;
  - a per-interval table (time, might change, kills change; the busiest row bold with a "most" chip);
  - a From/To range picker whose result is the alliance's totals and the members ranked by kills gained.
- **Chart option (owner decision, issue #62):**
  - Hand-drawn inline SVG bars per interval: no dependency, about 120 lines. It needs a DECISIONS entry that reverses the CLAUDE.md hard rule and plan lines 18, 381, 389, 392, 662. The table stays as the accessible equivalent.
  - A chart library would be a new dependency (D7/D10 policy, release date, install scripts). It is not recommended.

**6. Privacy.**
- Activity is computed only from might and kills changes between samples.
- `online`, `last_online_at`, `active`, `daily_*` stay blocked keys.
- Light samples store no `raw_json`, so mid-event samples do not even hold the blocked keys.
- "No kills change" must not be worded as "inactive" or "offline": the data does not show that.

**7. Discord.**
- Mid-event samples stay site-only.
- The public message (D31) is posted at the event's first sample and edited at each window's After: KvK gets 1 edit, Origin of Chaos 2.
- The admin message is edited at window ends with "samples 7 of 9 complete".
- A partial or failed sample posts its own admin message (D31), at most one per window, so an outage gives 1 message per window, not 1 per sample.
- An admin message with 13 run blocks would pass Discord's 2,000-character limit, which is the reason the admin message carries counts, not run blocks.

### #175 — events and their windows from /admin

**1. Several windows vs linked events.** The issue's A is Options B and C below; its B (linked) and C (plain) are Option A.

| Effect on | One event, N windows (Options B, C) | Two linked events "part 1/2" (Option A) |
|---|---|---|
| `unique (event_id, phase)` | replaced: B `unique (window_id, slot_at)`; C `unique (slot_at)` + link table | kept, plus `unique (event_id, phase, slot_at)` for middle samples |
| `compute.ts` deltas | `delta()` unchanged per window; event change = sum of window changes, null if any window's is null (`freshness.no-stale-delta` holds) | unchanged per event; a group total needs new code |
| Movers (D53) | rank the event change (sum of windows) | two Movers lists, or a new group ranking |
| Across-events reference value | last window's After, else the latest usable sample of the event (generalizes "after, else before") | each part is its own link in the chain; part 2 compares against part 1 |
| Header selector | one entry "Origin of Chaos 2026-11-14" | two entries |
| Discord (D31) | one message per event, edited per window | two messages |
| Overlap with KvK (OoC window 2, 12:30–13:00, lies inside KvK's 10:00–14:00) | B: two reads per shared slot, one waits a tick; C: one read, linked to both | two reads per shared slot |

**2. Schedule from /admin** (mock: `08zzh-admin-event-editor-360-light.png`):
- **Table `event_schedules`:** name; weekdays (server weekday list) or one date; windows as `[{start, end}]` in server time (1–4, no overlap, end after start, none across midnight: use two windows); `cadence_min` 15/30/60; visibility public/admin; `post_public`; `active`.
- **Editor:** behind the PIN, under "Event schedules".
- **Save validation** (a system boundary): per server weekday, the sum of all active schedules' samples × 21 must be ≤ 600 calls. That keeps 400 for retries, re-runs and manual rounds. A save over the limit is refused with the number.
- **Edits apply to the next event the tick creates.** An event already created keeps its times, as D21 does today.
- **Routine times** (`QUOTA_CHECK_AT`, `REHEARSAL_AT`) move to an `/admin` settings row, with the env values as defaults.
- **Env keeps:** `SERVER_TZ`, `REHEARSAL_KEEP`, every secret, webhook and URL.
- **Migration:** the build's first tick with no schedule row inserts one from the current `EVENT_WEEKDAY`/`EVENT_TIME`/`SNAPSHOT_BEFORE`/`SNAPSHOT_AFTER` (KvK, Saturday, one window 10:00–14:00, cadence 30). A later release removes those four env vars.
- **Plan and roadmap changes:** this replaces D1's "times in env vars" and plan §3.1 line 59 ("A DB-backed settings form is v2"). Issue #63 is the same work.

**3. Timing** (server = UTC−2). Slots are on the :00/:15/:30/:45 grid.
- **Before** = the latest slot ≤ window start − 5 min. **After** = the earliest slot ≥ window end + 5 min.
- Origin of Chaos:
  - window 1, 00:10–00:40 server (02:10–02:40 UTC): samples 00:00, 00:15, 00:30, 00:45 server;
  - window 2, 12:30–13:00 server (14:30–15:00 UTC): samples 12:15, 12:30, 12:45, 13:00, 13:15 server.
- Why −5 / +5: a tick at the window's own start time reads 15–31 s after it opens, so the Before must be one slot earlier.
- A missed tick: a sample's due window is `[slot, next slot)`. A missed slot is taken at the next tick with its real read time, or it is missing.
- **"Day ahead" creation (D21):** the tick creates the event 24 h before its first slot. For window 1 that is Fri 00:00 server. The event's date is the server date of its first window, and every slot is stored as a UTC instant. A Before that falls before midnight (for a window at 00:00) lands on the previous server day without special code.
- **Rehearsal guard:** "never on `EVENT_WEEKDAY` or the day after" becomes "no slot of any event within 3 h after the rehearsal ends, none running". Fri 18:00 server ends 18:45, and OoC window 1's first slot is Sat 00:00, 5 h 15 min later, so it passes.

**4. Quota per day vs per event:** see #171 table. Two windows (9 samples) + KvK (13) = 420 calls with shared slots, 462 without. The budget rule must count window ends across all events of the UTC day, not per event.

**5. Recurrence:** owner question (below).

**6. Overlap with #171 and #176:** one model, Option C.

### #176 — time ranges inside an event

**1. Questions** (✓ the data answers, ✗ it cannot):
- ✓ How much might / kills did I gain between T1 and T2?
- ✓ In which half hour did I gain the most kills?
- ✓ My place in my alliance by kills gained in a range.
- ✓ My alliance's might / kills change in a range.
- ✓ Who in my alliance gained the most kills in a range.
- ✓ Which half hour was busiest, for my alliance or for all 20.
- ✓ Which alliance gained the most kills in a range.
- ✓ Did a member switch alliance during the event (at sample grain).
- ✓ but not recommended: who had no kills change in the event. The data answers it; showing it as a list names people, and "no kills change" is not "inactive". Owner decision.
- ✗ Who was online or active (blocked keys; never).
- ✗ Who fought whom (the API has no attack data).
- ✗ The minute of a kill (grain = cadence).
- ✗ Might lost to dead troops vs might spent (one power number).

**2. Grain.**
- KvK at 30 min gives ranges in 30-minute steps; Origin of Chaos at 15 min gives 15-minute steps.
- From and To are selects that list only the samples that exist. A stale sample is listed as "(stale)". "11:30" is the 11:30 slot, read at 11:30:15–11:30:31, and the page says so under the picker.
- A range touching a sample where the alliance or member is stale has no change ("—"; glossary "stale").

**3. UI** (mock: `08zzh-in-event-range-360-light.png`):
- The section sits on the alliance page, after the existing summary, Leadership and Movers.
- The range lives in the URL (`?from=11:30&to=12:00`), so a range link can be shared.
- Each per-interval row is a link that sets that range.
- The player page gets the same per-interval rows for one member.
- Reads go only through `lib/queries`. Targets are ≥ 44 px, and nothing is hover-only.
- For a two-window event, the event page gets segmented tabs "Window 1 · Window 2 · Whole event" above the ledger (not mocked).

**4. Cost:**
- Compute on request. Measured 0.2–2.5 ms per query at one year of data (above). A range reads 2 samples × ≤ 100 members per alliance, or ≈ 3,500 rows for all 20.
- No precomputed per-interval deltas.
- A sample does not change after its window's After, so pages of finished events could be cached later; not needed now.

**5. Rules:** might/kills only; stale = no change. Light samples keep uid, name, power, kills and lv, which is everything a range needs.

## Open issues
- **Overlap:** if Origin of Chaos runs on the KvK day, its window 2 (12:30–13:00 server) lies inside KvK's Before/After (10:00–14:00). KvK's change then includes OoC window 2's losses and kills. No model can split them, because the API gives one number per member.
- Plan §6.1 storage numbers are low; members are 480 KB per sample, not 250 KB (measured above).
- The KvK window is still unconfirmed (plan §10 q6; #50 is closed, the plan text still says "unconfirmed"). The owner's "11–16" suggests After at 14:00 lands mid-event.
- `lib/queries` reads phase strings in 32 non-test files (106 lines matching `"before"`/`"after"`, counted with grep). The build must keep their output the same for one-window events.

## Options

| | A. Phases stay; middle samples; two-window events as two linked events | B. Event → windows → samples, each sample owned by one window | **C. Shared samples linked to event windows (recommended)** |
|---|---|---|---|
| Schema | `phase` gains `sample` + `slot_at`; `events.group_id`, `part_n`; `event_schedules` | `event_windows`; `snapshots.window_id`, `slot_at`; `event_schedules` | `event_windows`; `snapshots.slot_at`, `kind`, `light`; link table `window_samples`; `event_schedules` |
| Quota, Saturday KvK 30 + OoC 15 | 462 calls (22 samples) | 462 calls (22 samples), and OoC samples wait a tick at shared slots | 420 calls (20 samples) |
| Storage per year (middle light) | ≈ 476 MB | ≈ 476 MB | ≈ 446 MB |
| Work | 1 build session (model + collector) + 1 (/admin) + 1 (UI); the before/after readers stay; a group total is new code | 3 sessions; every before/after reader becomes "first/last sample of the window" | 3 sessions, same as B, plus one link table and a slot claim instead of an (event, phase) claim |
| New rules / decisions | group semantics; budget rule; schedules (replaces D1, plan line 59); Discord per part | windows; event change = sum of windows; budget rule; schedules; Discord per window (amends D31); light samples (amends D2) | B's list, plus "a slot is one sample, linked to every window that needs it" (replaces D1's `unique (event_id, phase)` guarantee with `unique (slot_at)`) |
| Risks | OoC shows as two events in the selector, chains and Movers (the owner said "it is all one event"); double reads on overlap | tick contention: one action per tick, so two events due at one slot shift one sample by 15 min | the migration rewrites how snapshots attach to events (backfill: one window per existing event, both samples linked); a forced re-run of a shared sample changes every event linked to it |

**Recommendation: C.** It is the only option where the owner's two real events (KvK and Origin of Chaos, overlapping at 12:30–13:00 server) cost one read per slot and never compete for a tick. Origin of Chaos stays one event. #176's ranges follow from it with no extra model. B costs the same work and keeps the overlap problems. A is cheapest at first but adds group logic that duplicates multi-window logic.

**Owner questions:**
1. On which weekday(s) does Origin of Chaos run? Every week? Did it run on Saturday 2026-11-07, overlapping KvK?
2. Are its times fixed (00:10–00:40 and 12:30–13:00 server), or do they move?
3. When does KvK end in game? Is the window 10:00–16:00 right? If After moves from 14:00 to 16:00, KvK's ledger "After" changes meaning from that event on.
4. Which other events besides KvK and Origin of Chaos should be tracked?
5. Cadence: 30 min for KvK and 15 min for Origin of Chaos (420 calls on Saturday)?
6. Keep every middle sample forever (≈ 450 MB/year, 700 MB warning in ≈ 1.6 years), or thin them after N weeks?
7. Charts: stay chart-free (recommended), or allow hand-drawn SVG bars (reverses the CLAUDE.md rule; #62)?
8. Discord: the public message edited only at each window's end, with no mid-event posts?
9. A "no kills change" list per range: show it or not?

## Next
Session: build 1 of 3 for Option C — "Samples and windows: model, collector, tick" (no /admin editor, no new UI section; those are builds 2 and 3).
Model / effort: keep (opus, high). The change rewrites how 32 non-test files read phases and adds a migration with a backfill, the same weight as Sessions 3–4.
Owner must do first:
- choose Option C (or A/B) and answer questions 1, 3 and 5;
- run O1 (0 quota) and, if possible, O2 next Saturday;
- merge this PR.
Plan changes needed:
- §3.1 (tick: slots instead of phases; line 59 "settings form is v2");
- §3.4 and §4 (budget rule per UTC day);
- §6 (schema) and §6.1 (storage numbers);
- §10 q6 (KvK window);
- if charts are allowed: lines 18, 381, 389, 392, 662.
- docs/SESSION_PLAYBOOK.md gets the three build sessions.

```text
<session>
Build 1 of 3 for spike 08zzh, Option C — samples and windows: model, collector, tick. Read CLAUDE.md, docs/handoff/00-prereqs.md, docs/handoff/08zzh-spike-event-model.md (Options, #171 and #175 answers), D1, D2, D21, D28, D31, D43, D53 in docs/DECISIONS.md, and .claude/rules/collector.md. Spend no upstream quota: every check runs in PGlite tests.
</session>

<task>
1. Migration: `event_windows` (event_id, n, start_at, end_at, before_at, after_at, cadence_min; unique (event_id, n)); `snapshots.slot_at`, `snapshots.kind` ('scheduled' | 'manual' | 'test'), `snapshots.light`; link table `window_samples (window_id, snapshot_id)`; `unique (slot_at) where kind = 'scheduled'`. Backfill: one window per existing event (start = before_at, end = after_at), both existing snapshots linked. Drop `snapshots_event_phase_unique` only after every reader uses windows.
2. Tick: compute the due slot from every open window (Before = latest slot ≤ start − 5 min, After = earliest slot ≥ end + 5 min, middle every cadence_min); take one sample per slot and link it to every window that lists the slot. Manual rounds and rehearsals keep their buttons and get one window each.
3. Collector: claim per slot; middle samples are light (no raw_json, no avatar_url/rank fields). Budget: before any sample, remaining ≥ 25 × (1 + window ends still due this UTC day across all events); a middle sample is skipped first. Name the invariant in a comment.
4. Readers: "before"/"after" become the window's first/last linked sample; an event's change is the sum of its windows' changes, null if any is null; the across-events reference value is the last window's After, else the latest usable sample. One-window events must render exactly as today (existing tests unchanged).
5. Discord: the public and admin messages are edited at each window's After, not at middle samples; a partial or failed sample posts at most one admin message per window.
6. Scheduled events still come from the env (one window SNAPSHOT_BEFORE–SNAPSHOT_AFTER, cadence from a new env var, default 30). The /admin editor is build 2.
7. DECISIONS entries for: samples and windows (supersedes D1's unique (event_id, phase)); the budget rule (amends budget.reserve-for-after); light samples (amends D2); Discord per window end (amends D31). GLOSSARY: sample, window, slot, light sample.
</task>

<constraints>
- No UI section added; the pages must look the same for every existing event.
- A change in lib/collector.ts, lib/compute.ts or lib/sources ships with a test in the same commit.
- Blocked roster keys stay only in raw_json; light samples have none.
</constraints>

<done_when>
`pnpm check` green; a PGlite test runs a two-window event plus an overlapping one-window event through the tick and shows one sample per shared slot; docs/handoff/<NN>-samples-windows.md written. PR: "feat(events): samples and windows — model, collector, tick (#171 #175)" into dev.
</done_when>
```

<adjustments>
- Real numbers to replace the plan's estimates: a full sample is 752 KB stored (raw_json 159 KB after 4.1× TOAST + member rows 480 KB with indexes); a light sample ≈ 290 KB; a sample is 21 calls and 9.6–10.0 s; ticks start 15–21 s after the slot.
- The preview DB holds only seed data (drift by construction); do not read upstream behaviour from it.
- `cache_seconds` is 600 in every `/v1` body; never schedule two samples of one alliance less than 15 min apart.
- Slots for Origin of Chaos (server time): 00:00, 00:15, 00:30, 00:45 and 12:15, 12:30, 12:45, 13:00, 13:15. With KvK at 30 min from 10:00, the shared slots are 12:30 and 13:00.
</adjustments>

<adjustments for="build 2 (/admin event schedules, #175)">
- Table `event_schedules` as in this handoff's #175 answer 2; mock `docs/screenshots/08zzh-admin-event-editor-360-light.png`.
- Save refuses a plan over 600 calls on any server weekday, with the number.
- The first tick with no schedule row creates one from EVENT_WEEKDAY/EVENT_TIME/SNAPSHOT_BEFORE/SNAPSHOT_AFTER.
- Routine times (QUOTA_CHECK_AT, REHEARSAL_AT) move to an /admin settings row with the env as default.
- This closes #63.
</adjustments>

<adjustments for="build 3 (During the event UI, #176)">
- Mock `docs/screenshots/08zzh-in-event-range-360-light.png`: busiest half hour line, From/To selects of existing samples, range result with members ranked by kills gained, per-interval table whose rows set the range, `?from=HH:MM&to=HH:MM` in the URL.
- Compute on request; no precomputed table (measured ≤ 2.5 ms per query at a year of data in PGlite).
- Chart-free unless the owner reverses the rule (#62).
</adjustments>

PR_URL_PLACEHOLDER
