# 08zzh — Spike: the event and snapshot model (samples, windows, ranges) — #171 #175 #176

## Built

- This file. It gives one model for #171 (snapshots through the event), #175 (events and their windows from /admin) and #176 (time ranges inside an event), compares it with two alternatives, and answers every issue question with numbers.
- The owner's answers of 2026-11-08 are in the section "Owner answers" and are applied in every section below.
- Mockups at 360 px:
  - `docs/screenshots/08zzh-in-event-range-360-light.png` — #176, the alliance page's "During the event" section, chart-free. It was rendered by a local `next dev` from the preview DB's seed event 3 (alliance OGs).
  - `docs/screenshots/08zzh-admin-event-editor-360-light.png` — #175, the /admin event schedules, the 4-week cycle, the editor and the routine times.
  - `docs/screenshots/08zzh-event-progress-options-360-light.png` — six chart options for event progress (V1–V6). They were drawn with Observable Plot on the real alliance totals in `fixtures/v1-ids`, with a simulated progression.
- The pages and scripts that drew the mockups are throwaway and are not committed.
- No production code, no migration, no dependency, no upstream call.

## Owner answers (2026-11-08)

1. **KvK and Origin of Chaos never run on the same Saturday.** The game runs one or the other. The cycle is 4 Saturdays:
   - a match phase groups 4 servers (kingdoms);
   - 3 Saturdays of KvK follow, 1 vs 1, until there is a champion;
   - then 1 Saturday of Origin of Chaos.
2. **30 minutes is too coarse for KvK.** One server can beat the other quickly, so a battle can end fast.
3. **The KvK window is 10:00–16:00 server.** The event runs 12:00–16:00, and many servers start fighting at 10:00 or 11:00 to clear ground and take positions. This answers plan §10 q6: today's `SNAPSHOT_AFTER=14:00` lands mid-event.
4. **Events to track:** KvK and Origin of Chaos now. Later, other events as they appear, including alliance events: Cheese Trap, Undead Siege, Alliance Duel Raid.
5. **Storage:** keep every sample for now. A thinning strategy comes later and is documented below.
6. **Charts:** wanted. Look at libraries that are simple, free, well maintained, customizable, good looking and reliable. Explore visualizations of event progress. The owner likes the "busiest interval" line.
7. **The "no kills change" list:** not now. It is left for the LLM agent (#61).

Second round (2026-11-09):

8. **Cycle:** Saturday 2026-11-14 is the first KvK of a cycle, and the cycle is always 3 + 1. So 2026-11-07 was Origin of Chaos, and the next Origin of Chaos Saturdays are 2026-12-05 and 2027-01-02.
9. **Origin of Chaos times:** unknown whether they move. They stay editable on /admin.
10. **Alliance events:** each alliance picks its own time. This site is the owner's alliance's, so the owner either runs them by hand or sets them up on /admin at the time the alliance sets.
11. **Discord, public channel:** post at the start and at the end only.
12. **Charts:** Observable Plot. The owner likes all six options V1–V6.
13. **Quota:** the API's Patreon tier would give 2,000 calls a day; the project stays at 1,000 for now.
14. **Storage idea from the owner:** store only what changed in the middle samples. It is measured and answered under #171 question 4: one row per alliance with arrays stores less and keeps reads simple.

## Decisions

- **Terms used below.** They are proposed for docs/GLOSSARY.md in the build and are not added here.
  - **sample:** one read of all tracked alliances at one time. It is today's `snapshots` row; a Before or an After is a sample.
  - **window:** one stretch of game time an event covers, for example 10:00–16:00 server. An event has 1 to 4 windows.
  - **slot:** a 15-minute tick time (:00, :15, :30, :45) at which a sample is due.
  - **event schedule:** the /admin row that makes the tick create an event a day ahead. It replaces the env vars of D1.
  - **light sample:** a sample in the middle of a window. Each of its alliance rows carries the members as three arrays (`member_uids`, `member_power`, `member_kills`) instead of `member_snapshots` rows, and no `raw_json`. Names, levels, photos and ranks come from the window's first and last samples, which stay full. A light sample is kept; only the repeated fields are not stored.
- **Recommended model (Option B): samples are owned by an event window.**
  - An event has N windows.
  - A window has a Before slot, an After slot, and samples every `cadence_min` (15, 30 or 60) between them.
  - A window's Before is its first sample and its After is its last sample.
  - An event's change is the sum of its windows' changes.
  - Any two samples of one event form a #176 range.
  - The first version of this handoff recommended Option C, samples shared by overlapping events. The owner's answer 1 removes the overlap that justified C. See Options.
- **KvK cadence: 15 minutes.** That is the floor the 15-minute tick and the 600 s upstream cache allow. The numbers for 10 minutes are under #171 question 3.
- **Charts: Observable Plot,** chosen by the owner (section "Charts"). It needs a DECISIONS entry that reverses "no charts in v1" and a D7 dependency row.
- **Alliance events:** a schedule or a one-off event may name a subset of alliances, normally only the owner's. A sample then reads 1 + k alliances: 2 calls for one alliance.
- The handoff file name follows the session prompt (`08zzh-spike-event-model.md`), not #171's body (`08zzh-spike-war-snapshots.md`).

## Deviations

- **Production was not read.** The session allowed only the Neon preview DB through `.env.local`. The preview DB holds only seed data:
  - events 1–3 ("Seed Saturday Event") and one rehearsal;
  - `tick_log` empty;
  - 11 MB in total.
  The seed rosters drift by construction: in `scripts/seed-data.ts` `drifted()`, every member's power changes in every snapshot. Their movement is therefore not evidence of upstream behaviour. Real evidence came from `fixtures/` (two `/v1` reads of the same two alliances 666 s apart) and from docs/handoff/09-dryrun.md (real runs on production).
- **Row sizes were measured in PGlite** (local, in memory), from 20 real `/v1` bodies in `fixtures/v1-ids/`, with the `trimRaw` trim and `member_snapshots`' columns and indexes. The seed rows hold a 17-byte stub `raw_json`, so the preview DB cannot show real sizes.
- **Chart libraries were installed in the scratchpad, not the repo,** to measure bundle sizes and draw the chart gallery. `playwright-core` was installed there too, to capture the mockups with the system Chrome.

## Verified

**Read:**
- the three issues with comments;
- CLAUDE.md, 00-prereqs and 08zzg;
- D1, D2, D7, D10, D11, D21, D25, D26, D28, D30, D31, D43, D44, D45, D51, D53 in docs/DECISIONS.md;
- `lib/budget.ts`, `lib/schedule.ts`, `lib/tick.ts`, `lib/run.ts`, `lib/collector.ts`, `lib/collector-rows.ts`, `lib/schema.ts`, `lib/compute.ts`, `lib/env.ts`, `lib/raw-json.ts`, `lib/repo/events.ts` (`duePhases`), `proxy.ts` (CSP);
- `lib/queries/` `events`, `event-page`, `visibility`, `movers`, `ranks`, and the phase use in `players` and `alliances`;
- `app/_ui/AcrossEvents.tsx`;
- plan §2, §3.1, §6.1, §10 q6, and lines 18/381/389/392/662.

**Measured:**

| What | Number | Source |
|---|---|---|
| Calls per sample | 21 (1 quota + 20 alliances), 0 retries | 09-dryrun, production 2026-11-05 |
| Sample duration | 9.6–10.0 s | 09-dryrun |
| Tick start after its slot | +15 to +21 s (20:30:15, 21:00:21, 23:00:20, 23:30:15) | D30 proof, 09-dryrun |
| Upstream cache | `cache_seconds: 600` in all 4 `/v1` fixtures. `cached: false` and `updated_at` = read time when reads are 666 s apart. | `fixtures/v1-20261104T154755Z`, `…155902Z` |
| Weekday movement in 666 s (Wed 15:47 → 15:59 UTC) | OGs: power changed for 11 of 100 members, kills for 0 (Δ might −799,204). URSA: power for 18 of 95, kills for 0 (Δ might −302,544). | same fixtures, uid/power/kills only |
| Full sample, stored | 752 KB in total. Alliance rows: 272 KB (`raw_json` is 646 KB as text and 159 KB after TOAST, 4.1×). Member rows with both indexes: 480 KB (1,739 members). | PGlite, `fixtures/v1-ids/` (20 bodies) |
| One light sample in layout (a), measured alone (table pages not yet shared with other samples) | ≈ 290 KB. Member rows with uid, power, kills and indexes: 272 KB (measured). Name and alliance rows without `raw_json`: ≈ 20 KB (estimated). Superseded by the layout row below. | PGlite |
| A light sample in three layouts (20 real rosters, 25 samples, size averaged per sample) | (a) one narrow row per member (uid, power, kills; key + uid index): 173 KB. (b) rows only for members whose power or kills changed, plus the uid list: 55 KB if 15 % changed, 112 KB if 50 %, 176 KB if 90 %. **(c) one row per alliance with uid/power/kills arrays: 43 KB, whatever changed.** | PGlite |
| #176 queries on layout (c), one year (52 events × 25 samples × 20 alliances × 87 members) | one alliance's members over a range 1.4 ms; every member over a range (top 5) 4.6 ms; per-interval values for one member 0.5 ms | PGlite, mean of 20 runs |
| #176 queries at one year of data with member rows (52 events × 13 samples × 20 alliances × 87 members = 1,176,240 member rows) | One alliance's members over a range: 1.3 ms. Every member over a range (top 5): 2.5 ms. Per-interval table for one alliance: 0.2 ms. Per-interval table for one member: 1.0 ms. | PGlite, mean of 20 runs. Neon adds network time, not measured. |
| Chart libraries, min + gzip, React excluded | visx (shape, scale, axis, group) 23 KB · Chart.js (line, bar, tooltip) 56 KB · Observable Plot 94 KB · Recharts (line, bar, axes, tooltip) 106 KB · ECharts core (line, bar, SVG renderer) 182 KB | esbuild 0.25.12 `--bundle --minify`, gzip -9 |
| Observable Plot under the site's CSP | All 6 gallery charts render with `script-src 'self' 'nonce-…'` (no `unsafe-eval`) and `style-src 'self' 'unsafe-inline'`, as in `proxy.ts`, with 0 console errors. | Playwright, gallery page with a CSP meta tag |
| Mockups at 360 px | `document.documentElement.scrollWidth` = 360 on all three pages (no horizontal scroll). Selects, buttons and table links are `min-h-11` (44 px). | Playwright + Chrome |

Plan §6.1 underestimates storage. It put member rows at ≈ 250 KB per snapshot; the measurement is 480 KB with indexes. Today's 2 samples a week are therefore ≈ 78 MB/year, not 15–45 MB.

### #171 — snapshots through the event

**1. Quota.**
- The limit is 1,000 calls per UTC day. `requiredQuota(20)` = 2 × (20 + 5) = 50.
- Saturday 00:00–24:00 UTC is Fri 22:00 – Sat 22:00 server, so every Saturday window falls on one UTC day.
- The Friday check (Fri 20:00 server = Fri 22:00 UTC) and the rehearsal (Fri 18:00 server = Fri 20:00 UTC) fall on Friday's UTC day.
- There is one event per Saturday (owner answer 1), so the day's cost is that event's cost.

| Saturday | Samples | Calls | Left of 1,000 |
|---|---|---|---|
| Today: Before 10:00 + After 14:00 | 2 | 42 | 958 |
| **KvK 10:00–16:00 every 15 min (09:45 … 16:15)** | 27 | 567 | 433 |
| KvK every 30 min | 14 | 294 | 706 |
| KvK every 10 min (needs a 5-minute tick, see question 3) | 39 | 819 | 181 |
| **Origin of Chaos, 2 windows every 15 min** | 9 | 189 | 811 |

- Retries: each 502/503/504 retry costs 1 call, at most 3 per alliance. A run is capped at 120 calls (`MAX_UPSTREAM_CALLS`).
- A manual re-run costs 21 calls. A plain re-run of a partial sample costs 1 + the number of missing alliances.
- **A budget rule is needed.** In a full upstream outage a sample costs up to 81 calls (1 + 20 × 4), so KvK's 27 samples could spend 2,187. `INVARIANT budget.reserve-for-after` becomes: before any sample, `remaining ≥ 25 × (1 + window ends still due today)`. Middle samples are skipped first, and a window's After is never starved.

**2. Does the data move at that grain?**
- Upstream reads are refresh-on-read: `updated_at` equals the read time and `cached: false` whenever reads are more than 600 s apart.
- On a weekday, might moved for 11–19 % of members in 11 minutes and kills for 0 %. Kills move only in fights.
- In-event movement per 15 minutes is **not measured**: production holds only Before and After, and the preview holds seed data.
- The 20-minute freshness rule is unaffected: our reads are 0.7–1.2 s old (09-dryrun).
- Observations proposed for the owner (not run here):
  - **O1, 0 quota, now.** The read-only SQL below, on production. It counts per alliance how many members' kills and power changed between 2026-11-07's Before and After.
  - **O2, about 84 calls, on the next KvK Saturday.** Start manual rounds with visibility "Admin only" and press Before and After at 12:00, 12:15, 12:30 and 12:45 server (4 samples). Then run O1's query on consecutive pairs. It shows whether kills move in every 15 minutes or in jumps.

```sql
-- O1 (production, read-only): the scheduled event of 2026-11-07, members on both sides.
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
- A sample takes 10 s: 110 s under `maxDuration` 120 s and 140 s under the run lock (150 s). One sample per tick fits.
- **15 minutes is the floor.** A 10-minute cadence would need two changes:
  - the cron-job.org job every 5 minutes (free; 0 quota);
  - consecutive reads of one alliance 600 ± 10 s apart, which is the upstream cache time. Some reads would come back `cached: true` with the previous body, which the freshness rule (20 min) would still call fresh.
  - It also costs 819 of 1,000 calls, which leaves 181. One outage sample costs up to 81.
  - The Patreon tier's 2,000 calls (owner answer 13) would remove the quota limit, but not the 600 s cache limit.
- 15 minutes gives a battle that ends in 30 minutes 2–3 samples.

**4. Data model.** See Options. `unique (event_id, phase)` becomes `unique (window_id, slot_at)`, so a double tick still cannot take a slot twice (D1's guarantee is kept).

**How to store the middle samples.** The owner asked about storing only what changed, leaving an unchanged member empty. Measured on 20 real rosters, per light sample:

| Layout | Size | Reads |
|---|---|---|
| (a) one row per member (uid, power, kills) | 173 KB | a direct join of two samples |
| (b) rows only for members whose power or kills changed | 55 KB if 15 % of members changed (the weekday measure), 112 KB if 50 %, 176 KB if 90 % | Every read must look back for each member's last stored value. An empty slot can mean "unchanged", "left the alliance" or "not read", so each sample also needs its member list. |
| **(c) one row per alliance, members as three arrays (uid, power, kills)** | **43 KB, whatever changed** | `unnest` the two samples' arrays and join by uid: 0.5–4.6 ms at a year of data |

- Layout (b) works, but it makes every read harder.
- (b) saves space only when few members change. During a KvK battle most fighters change every 15 minutes, and that rate is not measured yet (O2).
- **Layout (c) is recommended:** it is smaller than (b) even at 15 % changed, and reads stay a plain join.
- The arrays go on the light sample's `alliance_snapshots` row, so no new table is needed.
- The window's first and last samples stay full (`member_snapshots` rows with names, levels, photos and ranks, plus `raw_json`).

Storage, keeping every sample (owner answer 5):

| Plan | Per KvK Saturday | Per Origin of Chaos Saturday | Per year (13 cycles of 3 + 1) | Reaches the 700 MB warning (`DB_WARN_ABOVE_MB`) |
|---|---|---|---|---|
| Today (2 full samples a week) | 1.5 MB | 1.5 MB | 78 MB | not in practice |
| **15 min, middle samples as arrays (c)** | 2.7 MB (2 full + 25 × ≈ 50 KB) | 3.3 MB (4 full + 5 × ≈ 50 KB) | ≈ 150 MB | ≈ 4.7 years (1 GB in ≈ 6.7 years) |
| 15 min, middle samples as member rows (a) | 6.0 MB | 3.9 MB | ≈ 285 MB | ≈ 2.5 years |
| 15 min, every sample full | 20.3 MB | 6.8 MB | ≈ 880 MB | ≈ 10 months |

- "≈ 50 KB" is 43 KB of arrays plus ≈ 5 KB of alliance rows without `raw_json` (estimated).
- A full sample is counted at 752 KB, which was measured alone. Shared table pages make it somewhat smaller at volume, so these numbers are an upper bound.
- Neon Free is 1 GB per project (docs/PREREQUISITES.md). Production's current size was not read; the Friday message shows it.
- **Later strategy (documented, not built):** when the database passes 500 MB, choose one of:
  - thin light samples older than N weeks to their alliance totals (≈ 5 KB each);
  - move to Neon's paid plan.
- Alliance events with one alliance add ≈ 2 KB per light sample and are not counted here.

**5. Display.** See the section "Charts". The chart-free fallback is mocked in `08zzh-in-event-range-360-light.png`:
- the "Busiest 15 min" line;
- a From/To range picker;
- the range result with the members ranked by kills gained;
- a per-interval table.
At 15 minutes the table has 26 rows (the mock shows it). With charts, the chart leads and the table moves behind a "Details" disclosure as the accessible equivalent.

**6. Privacy.**
- Activity is computed only from might and kills changes between samples.
- `online`, `last_online_at`, `active` and `daily_*` stay blocked keys.
- Light samples store no `raw_json`, so mid-event samples do not even hold the blocked keys.

**7. Discord.** Owner answer 11 settles the public channel:
- Mid-event samples stay site-only.
- The public message (D31) is posted at the event's first sample and edited once, at the event's last After. Origin of Chaos gets no edit between its two windows.
- The admin message is edited at each window's end with a count, for example "samples 19 of 27 complete".
- A partial or failed sample posts its own admin message (D31), at most one per window.
- Why the admin message carries counts, not run blocks: an admin message with 27 run blocks would pass Discord's 2,000-character limit.

### #175 — events and their windows from /admin

**1. Several windows vs linked events.** The issue's A is Options B and C below; its B (linked events) and C (plain events) are Option A.

| Effect on | One event with N windows (Options B, C) | Two linked events "part 1/2" (Option A) |
|---|---|---|
| `unique (event_id, phase)` | B: `unique (window_id, slot_at)`. C: `unique (slot_at)` plus a link table. | kept, plus `unique (event_id, phase, slot_at)` for middle samples |
| `compute.ts` deltas | `delta()` is unchanged per window. The event's change is the sum of its windows' changes, null if any window's is null (`freshness.no-stale-delta` holds). | unchanged per event; a group total needs new code |
| Movers (D53) | rank the event's change (the sum of its windows) | two Movers lists, or a new group ranking |
| Across-events reference value | the last window's After, else the latest usable sample of the event (generalizes "after, else before") | each part is its own link in the chain, so part 2 compares against part 1 |
| Header selector | one entry, for example "Origin of Chaos 2026-12-05" | two entries |
| Discord (D31) | one message per event, edited per window | two messages |

**2. Schedule from /admin** (mock: `08zzh-admin-event-editor-360-light.png`).

- **Table `event_schedules`:**
  - name;
  - weekday (server time);
  - **cycle:** length in weeks (4) and the weeks of the cycle the schedule runs (KvK 1–3, Origin of Chaos 4);
  - the date week 1 starts;
  - windows `[{start, end}]` in server time: 1–4 windows, no overlap, end after start, none across midnight (use two windows instead);
  - `cadence_min` 15/30/60;
  - visibility public/admin, `post_public`, `active`;
  - **alliances:** all tracked alliances (KvK, Origin of Chaos), or a subset, normally only the owner's alliance (alliance events, owner answer 10). A sample reads 1 + k alliances: 2 calls for one alliance.
- **One-off events:** "Add one event" on /admin takes a date, its windows, cadence and alliances. It covers an alliance event whose time the alliance sets each time; a manual round (D28) stays the button for "now".
- **Table `schedule_overrides (date, schedule_id null)`:** "this Saturday runs Origin of Chaos" or "nothing". The /admin section "Next Saturdays" shows the next 4 dates with a select each. When the game shifts the cycle by a week, the owner changes one date or moves the cycle start; the cycle itself stays. The Friday admin message names the event the tick will run next day, so a wrong cycle is seen a day ahead.
- **Save validation** (a system boundary):
  - each schedule's samples × 21 must be ≤ 600 calls, with the number given on refusal. KvK at 15 min is 567.
  - two all-alliance schedules on the same date are refused (owner answer 1);
  - an alliance event may share a date and slots with KvK. The tick then runs both samples at that slot, see #175 question 3.
- **Edits apply to the next event the tick creates.** An event already created keeps its times, as D21 does today.
- **Routine times** (`QUOTA_CHECK_AT`, `REHEARSAL_AT`) move to an /admin settings row, with the env values as defaults.
- **Env keeps:** `SERVER_TZ`, `REHEARSAL_KEEP`, every secret, webhook and URL.
- **Migration:** the first tick with no schedule row creates one from the current `EVENT_WEEKDAY`/`EVENT_TIME`/`SNAPSHOT_BEFORE`/`SNAPSHOT_AFTER`. A later release removes those four env vars.
- **Plan and roadmap:** this replaces D1's "times in env vars" and plan §3.1 line 59 ("A DB-backed settings form is v2"). Issue #63 is the same work.

**3. Timing** (server = UTC−2). Slots are on the :00/:15/:30/:45 grid.
- Before = the latest slot ≤ window start − 5 min. After = the earliest slot ≥ window end + 5 min.
- Why −5/+5: a tick at the window's own start time reads 15–31 s after it opens, so the Before must be one slot earlier.

| Window (server time) | UTC | Samples (server time) |
|---|---|---|
| KvK 10:00–16:00 | 12:00–18:00 | 09:45, 10:00 … 16:00, 16:15 (27) |
| Origin of Chaos window 1, 00:10–00:40 | 02:10–02:40 | 00:00, 00:15, 00:30, 00:45 |
| Origin of Chaos window 2, 12:30–13:00 | 14:30–15:00 | 12:15, 12:30, 12:45, 13:00, 13:15 |

- A missed tick: a sample's due window is `[slot, next slot)`. A missed slot is taken at the next tick with its real read time, or it stays missing.
- **More than one sample per tick.** Today a tick does one action. During KvK every tick has a KvK sample due, so an alliance event at the same time would never get its turn. The tick therefore runs every sample due at its slot, in event order, while less than 60 s have passed since it started:
  - a KvK sample takes 10 s;
  - a one-alliance sample takes ≈ 2 s;
  - the 120 s `maxDuration` keeps 60 s of margin.
  The Friday check and rehearsals stay one action, and only when no sample is due. This amends D21's "one thing per call".
- **"Day ahead" creation (D21):** the tick creates the event 24 h before its first slot. For Origin of Chaos window 1 that is Fri 00:00 server. The event's date is the server date of its first window, and every slot is stored as a UTC instant. A Before that falls before midnight (for a window at 00:00) lands on the previous server day without special code.
- **Rehearsal guard:** "never on `EVENT_WEEKDAY` or the day after" becomes "no slot of any event within 3 h after the rehearsal ends, none running". A Fri 18:00 server rehearsal ends at 18:45; Origin of Chaos window 1's first slot is Sat 00:00, 5 h 15 min later, so it passes.

**4. Quota per day vs per event:**
- There is one all-alliance event per Saturday: at most 567 calls (KvK) or 189 (Origin of Chaos).
- An alliance event for one alliance adds 2 calls per sample. A 30-minute window at 15 minutes is 4 samples, 8 calls.
- The budget rule counts the window ends of every event still due that UTC day.

**5. Recurrence:** answered (owner answers 1 and 8).
- A 4-week cycle: 3 KvK, then 1 Origin of Chaos.
- Week 1 starts on Saturday 2026-11-14.
- Origin of Chaos falls on 2026-12-05, 2027-01-02, and every 4 weeks after.
- Whether Origin of Chaos's times move is unknown (owner answer 9). They are edited on its schedule.

**6. Overlap with #171 and #176:** one model, Option B.

### #176 — time ranges inside an event

**1. Questions** (✓ the data answers, ✗ it cannot):
- ✓ How much might / kills did I gain between T1 and T2?
- ✓ In which 15 minutes did I gain the most kills?
- ✓ My place in my alliance by kills gained in a range.
- ✓ My alliance's might / kills change in a range.
- ✓ Who in my alliance gained the most kills in a range.
- ✓ Which interval was busiest, for my alliance or for all 20.
- ✓ Which alliance gained the most kills in a range.
- ✓ Who overtook whom in might rank during the event.
- ✓ Did a member switch alliance during the event (at sample grain).
- Left for the LLM agent (#61), owner answer 7: who had no kills change in a range.
- ✗ Who was online or active (blocked keys; never).
- ✗ Who fought whom (the API has no attack data).
- ✗ The minute of a kill (grain = 15 minutes).
- ✗ Might lost to dead troops vs might spent (one power number).

**2. Grain.**
- Ranges are in 15-minute steps.
- From and To are selects that list only the samples that exist. A stale sample is listed as "(stale)".
- "11:30" is the 11:30 slot, read at 11:30:15–11:30:31, and the page says so under the picker.
- A range touching a sample where the alliance or member is stale has no change ("—"; glossary "stale").

**3. UI** (mocks: `08zzh-in-event-range-360-light.png`, and charts V1 and V5 in `08zzh-event-progress-options-360-light.png`):
- The "During the event" section goes on the alliance page, after the summary, Leadership and Movers. In order:
  - the busiest-interval line;
  - the event pulse (V1) or "my alliance" (V5) chart;
  - the range picker and its result;
  - the per-interval table behind "Details".
- The range is in the URL (`?from=11:30&to=12:00`), so a range link can be shared.
- Tapping a bar or a table row sets that range. Nothing is hover-only, and targets are ≥ 44 px.
- The player page gets the same rows and chart for one member.
- Reads go only through `lib/queries`.
- For a two-window event, the event page gets segmented tabs "Window 1 · Window 2 · Whole event" above the ledger (not mocked).

**4. Cost:**
- Compute on request, measured at 0.2–2.5 ms per query at one year of data (above).
- A range reads 2 samples × ≤ 100 members for one alliance, or ≈ 3,500 rows for all 20.
- No precomputed per-interval deltas.
- A sample does not change after its window's After, so pages of finished events could be cached later. That is not needed now.

**5. Rules:** might and kills only; stale = no change. A light sample's arrays keep uid, power and kills, which is everything a range needs. Names come from the window's full samples by uid. A member who joined and left between them has no name there, so the read takes the newest `member_snapshots` name for that uid.

## Charts

**Event progress, six options** (`08zzh-event-progress-options-360-light.png`; every one fits 360 px):

| | Chart | Question it answers | Where |
|---|---|---|---|
| V1 | Event pulse: kills per 15 min for all 20 alliances, the busiest bar darkest, the 10:00–12:00 positioning band and KvK 12:00–16:00 marked, with the "Busiest 15 min" line above | When was the server most active? | event page |
| V2 | Kills race: kills gained since 09:45, one line per alliance, top 3 named | How did each alliance's kills grow; who stopped fighting (flat line)? | event page |
| V3 | Rank race: might rank (1–12) at each sample, step lines, alliances that changed rank highlighted | Who overtook whom? | event page |
| V4 | Who fought when: heatmap, alliance × 15 min, darker = more kills | Which alliances fought, and when? | event page |
| V5 | My alliance: kills gained (up) and might change (down) per 15 min | When did my alliance fight and lose might? | alliance page; the same for one member on the player page |
| V6 | Ledger rows with a might sparkline | How did might move through the event, row by row? | event page ledger |

The owner likes all six (owner answer 12). They are split over two builds so that each stays reviewable:
- **Build 3:** V1 on the event page, V5 on the alliance and player pages, V6 in the ledger, and the range picker.
- **Build 4:** V2, V3 and V4 in a "Progress" tab on the event page.

**Libraries** (npm registry on 2026-11-08; sizes measured above):

| Library | License | Version, last publish | Renders | Client cost (min+gzip) | Customizing | Notes |
|---|---|---|---|---|---|---|
| **Observable Plot (chosen by the owner)** | ISC | 0.6.19, 2026-11-05 | SVG; on the server through the `document` option (Plot docs), or in the browser | 0 KB when rendered on the server; 94 KB for an interactive chart in the browser | marks, scales, CSS classes; all 6 gallery charts in ≈ 80 lines | by the D3 authors at Observable; 3 dependencies (`d3`, `interval-tree-1d`, `isoformat`); no install scripts; renders under the site's CSP (measured). Pre-1.0, so a minor release may change the API: pin it. |
| visx (Airbnb) | MIT | 4.0.0, 2026-06-11 | SVG React components, server components included | 23 KB (only what is used) | complete: every path is ours, so the brand's hand-drawn style is possible | low level: axes, scales and layout written per chart, several times Plot's code per chart |
| Recharts | MIT | 3.10.1, 2026-11-03 | SVG, client components only (`"use client"`) | 106 KB | props and custom shapes; built-in tooltips and animation | most used React chart library; 11 dependencies; no heatmap |
| Chart.js | MIT | 4.6.1, 2026-10-22 | canvas, client only | 56 KB | options object; canvas cannot read the CSS colour tokens, so dark mode needs JS | mature; chart text is not in the DOM (screen readers need the table) |
| ECharts | Apache-2.0 | 6.1.0, 2026-05-19 | canvas or SVG, client | 182 KB (core + line + bar) | very complete | the heaviest |
| Not recommended | | | | | | ApexCharts: needs a paid licence for organizations with US$ 2 M+ revenue since v5, and its licence is not OSI. uPlot: no release since 2025-03-14, canvas, low level. Nivo: last release 2025-05-23. Victory: 27 dependencies. |

**Why Observable Plot:**
- Simple: one call per chart.
- Free (ISC) and actively released (last publish 3 days before this measurement).
- SVG, so colours come from the brand tokens and dark mode follows CSS.
- It can render on the server, so pages keep working without client JavaScript, which matches today's server-rendered pages.
- It ran under the site's CSP with no `eval`.

**Plot's limits:**
- Pre-1.0.
- Tap tooltips (`tip` mark) need the chart rendered in the browser (94 KB). The recommended charts do not need tooltips: tapping a bar is a link to that range, and the numbers are in the table.

**visx instead** if the owner wants the charts drawn in the brand's "confident nib" hand-drawn style; that costs more code per chart.

**What adopting a library costs:**
- a DECISIONS entry that reverses "no charts in v1" (CLAUDE.md hard rule; plan lines 18, 381, 389, 392, 662; issue #62);
- a D7 table row (version, last publish, install scripts: none);
- the rule that every chart has its numbers in a table or text next to it.

## Open issues

- **2026-11-07's data.** 2026-11-07 was an Origin of Chaos Saturday (owner answer 8). Its "Saturday Event 2026-11-07" ledger therefore shows 10:00–14:00 server of an Origin of Chaos day: it covers window 2 and misses window 1. The owner can rename it from /admin (D39), for example to "Origin of Chaos 2026-11-07".
- **Until build 2 ships, every Saturday runs the env schedule.** Origin of Chaos on 2026-12-05 would get KvK's window (09:45–16:15), which covers window 2 and misses window 1. The owner can press a manual round at about 00:00 and 00:45 server for window 1 (42 calls), or accept the gap.
- **Plan §6.1** storage numbers are low: member rows are 480 KB per sample, not 250 KB (measured above).
- **Readers to rewrite.** `lib/queries` and the pages read phase strings in 32 non-test files (106 lines matching `"before"`/`"after"`, counted with grep). The build must keep their output the same for one-window events.
- **Alliance events and kills.** It is not known whether Cheese Trap, Undead Siege or Alliance Duel Raid change `power` or `kills` in the API (for example, whether monster kills count). If they do not, tracking them shows no change. Owner question 1 asks; O3 below measures it for 2 calls per sample.

## Options

| | A. Phases stay; middle samples; two-window events as two linked events | **B. Event → windows → samples, each sample owned by one window (recommended)** | C. Samples shared by every window that needs the slot (link table) |
|---|---|---|---|
| Schema | `phase` gains `sample` + `slot_at`; `events.group_id`, `part_n`; `event_schedules` + overrides | `event_windows`; `snapshots.window_id`, `slot_at`; `unique (window_id, slot_at)`; `event_schedules` + overrides | as B, plus a link table `window_samples` and `unique (slot_at)` instead of `(window_id, slot_at)` |
| Quota per Saturday | KvK 567, Origin of Chaos 189 | the same | the same; it saves calls only when two events want one slot, which does not happen (owner answer 1) |
| Storage per year (middle samples as arrays) | ≈ 150 MB | ≈ 150 MB | ≈ 150 MB |
| Work | 3 build sessions. The before/after readers stay, and a group total is new code. | 3 build sessions. Every before/after reader becomes "first/last sample of the window". | B's work, plus a link table, and the claim per slot instead of per window |
| New rules / decisions | group semantics; budget rule; schedules (replaces D1 and plan line 59); Discord per part | windows; the event's change = the sum of its windows' changes; budget rule; schedules and the 4-week cycle; Discord per window (amends D31); light samples (amends D2); charts | B's list, plus "a slot is one sample, linked to every window that needs it" |
| Risks | Origin of Chaos shows as two events in the selector, the chains and Movers (the owner said "it is all one event") | An alliance event during KvK reads the owner's alliance twice at one slot (+2 calls). The tick runs both (#175 question 3). | The extra table and claim exist to save those 2 calls. A forced re-run of a shared sample would change every event linked to it. |

**Recommendation: B.**
- It is the direct step from today's `(event, phase)` to `(window, slot)`.
- Origin of Chaos stays one event, and #176's ranges follow from it.
- KvK and Origin of Chaos never overlap. The only overlap left is an alliance event during KvK, where C would save 2 calls a sample. That does not pay for C's link table.
- **Moving from B to C later is local,** because the build reads a window's samples through one query function (`windowSamples`) and nothing else joins `snapshots.window_id`. The build prompt makes that a constraint.

**O3 (proposed, about 8 calls):** the next time the owner's alliance runs an alliance event, start a manual round with visibility "Admin only" just before it and press After just after it. Then run O1's query for that round. If kills or power changed for the members who took part, alliance events are worth a schedule.

**Owner questions:**
1. Do alliance events (Cheese Trap, Undead Siege, Alliance Duel Raid) change might or kills in the game's numbers? For example, do monster kills count in `kills`? O3 answers it if the owner does not know.
2. Discord, admin channel: is one edit at the end of each window, plus one message per window for a partial or failed sample, right?

## Next

Session: build 1 of 4 for Option B, "Samples and windows: model, collector, tick". It adds no /admin editor and no new UI section.
- Build 2 is the /admin event schedules, the 4-week cycle and one-off alliance events.
- Build 3 is the "During the event" UI with charts V1, V5 and V6 and the range picker.
- Build 4 is the "Progress" tab with V2, V3 and V4.
- Builds 2 and 3 depend only on build 1 and can run in either order. Build 4 follows build 3.

Model / effort: keep (opus, high). The change rewrites how 32 non-test files read phases and adds a migration with a backfill, the same weight as Sessions 3–4.

Owner must do first:
- **Before Fri 2026-11-13 09:45 server (11:45 UTC), with no code change:** set `SNAPSHOT_BEFORE=09:45` and `SNAPSHOT_AFTER=16:15` in Vercel Production and redeploy. The tick fixes the times of 2026-11-14 (the cycle's first KvK) when it creates that row, 24 h before Before (D21). Quota is unchanged (42 calls).
- Answer questions 1 and 2.
- Run O1 (0 quota). On a KvK Saturday, run O2 (≈ 84 calls). At an alliance event, run O3 (≈ 8 calls).
- Merge this PR.

Plan changes needed:
- §3.1: the tick takes slots, not phases; line 59 says "settings form is v2".
- §3.4 and §4: the budget rule per UTC day.
- §6 (schema) and §6.1 (storage numbers).
- §10 q6: KvK 12:00–16:00, fights from 10:00; window 10:00–16:00.
- Lines 18, 381, 389, 392, 662: charts allowed with Observable Plot (owner answer 12).
- docs/SESSION_PLAYBOOK.md gets the four build sessions.

```text
<session>
Build 1 of 4 for spike 08zzh, Option B — samples and windows: model, collector, tick. Read CLAUDE.md, docs/handoff/00-prereqs.md, docs/handoff/08zzh-spike-event-model.md (Owner answers, Options, #171 and #175 answers), D1, D2, D21, D28, D31, D43, D53 in docs/DECISIONS.md, and .claude/rules/collector.md. Spend no upstream quota: every check runs in PGlite tests.
</session>

<task>
1. Migration: `event_windows` (event_id, n, start_at, end_at, before_at, after_at, cadence_min; unique (event_id, n)); `snapshots.window_id`, `snapshots.slot_at`, `snapshots.light`; `unique (window_id, slot_at)`; `alliance_snapshots.member_uids`, `member_power`, `member_kills` (bigint[], null on full samples). Backfill: one window per existing event (before_at/after_at from the event), its two snapshots moved onto it with slot_at = the event's before_at / after_at. Drop `snapshots_event_phase_unique` only after every reader uses windows.
2. One query function, `windowSamples(db, windowId)`, is the only code that joins `snapshots.window_id`; every reader goes through it (so a later move to shared samples changes one function). One function reads a light sample's members (unnest of the three arrays), so readers see the same member shape for full and light samples.
3. Tick: for every open window, the due slots are before_at, every cadence_min after it, and after_at, ≤ now and without a sample. The tick runs every due sample in slot order while less than 60 s have passed since it started; the Friday check and rehearsals stay one action, only when no sample is due (amends D21). Manual rounds and rehearsals keep their buttons and get one window each.
4. Collector: claim per (window, slot). A window's first and last samples are full, as today; middle samples are light: the members as three arrays on each alliance row, no member_snapshots rows, no raw_json. Budget: before any sample, remaining ≥ 25 × (1 + window ends still due this UTC day); a middle sample is skipped first. Name the invariant in a comment.
5. Readers: "before"/"after" become the window's first/last sample; an event's change is the sum of its windows' changes, null if any is null; the across-events reference value is the last window's After, else the latest usable sample. One-window events render exactly as today (existing tests unchanged).
6. Discord: the public message is posted at the event's first sample and edited once, at the event's last After (owner, 2026-11-09); the admin message is edited at each window's After; a partial or failed sample posts at most one admin message per window.
7. Scheduled events still come from the env: one window whose Before and After slots are SNAPSHOT_BEFORE and SNAPSHOT_AFTER, samples every SAMPLE_EVERY_MIN (new env var, default 15) between them. The /admin editor is build 2.
8. DECISIONS entries: samples and windows (supersedes D1's unique (event_id, phase)); the budget rule (amends budget.reserve-for-after); light samples (amends D2); Discord per window end (amends D31). GLOSSARY: sample, window, slot, light sample.
</task>

<constraints>
- No UI section added; the pages must look the same for every existing event.
- A change in lib/collector.ts, lib/compute.ts or lib/sources ships with a test in the same commit.
- Blocked roster keys stay only in raw_json; light samples have none.
</constraints>

<done_when>
`pnpm check` green; a PGlite test runs a KvK-shaped event (09:45–16:15, every 15 min: 27 samples, 25 of them light) and a two-window event through the tick, and shows one sample per (window, slot), two events due at one slot both sampled by one tick, and the budget rule skipping a middle sample; docs/handoff/<NN>-samples-windows.md written. PR: "feat(events): samples and windows — model, collector, tick (#171 #175)" into dev.
</done_when>
```

<adjustments>
- Real numbers to replace the plan's estimates:
  - a full sample is ≤ 752 KB stored (raw_json 159 KB after 4.1× TOAST + member rows 480 KB with indexes);
  - a light sample (arrays) is ≈ 50 KB;
  - a sample is 21 calls and 9.6–10.0 s;
  - ticks start 15–21 s after the slot.
- The preview DB holds only seed data (drift by construction); do not read upstream behaviour from it.
- `cache_seconds` is 600 in every `/v1` body; never sample one alliance less than 15 min apart.
- One all-alliance event per Saturday (owner, 2026-11-08): KvK 27 samples, 567 calls; Origin of Chaos 9 samples, 189 calls. Week 1 of the cycle is 2026-11-14.
- The quota stays at 1,000 calls a day, although the Patreon tier would give 2,000 (owner, 2026-11-09).
</adjustments>

<adjustments for="build 2 (/admin event schedules, #175)">
- Tables `event_schedules` (with the 4-week cycle: length, weeks, start date, plus an alliances subset) and `schedule_overrides (date, schedule_id null)`, as in this handoff's #175 answer 2; mock `docs/screenshots/08zzh-admin-event-editor-360-light.png`. Seed the cycle with week 1 = 2026-11-14: KvK weeks 1–3, Origin of Chaos week 4 (windows 00:10–00:40 and 12:30–13:00, editable: the owner does not know whether they move).
- "Add one event" on /admin: date, windows, cadence, alliances. For alliance events the owner's alliance picks the time of; a one-alliance sample costs 2 calls.
- Save refuses a schedule over 600 calls, and two all-alliance schedules on one date, with the number or the date.
- The Friday admin message names the event the tick will run the next day.
- The first tick with no schedule row creates one from EVENT_WEEKDAY/EVENT_TIME/SNAPSHOT_BEFORE/SNAPSHOT_AFTER.
- Routine times (QUOTA_CHECK_AT, REHEARSAL_AT) move to an /admin settings row with the env as default. This closes #63.
</adjustments>

<adjustments for="build 3 (During the event UI and charts V1, V5, V6, #176)">
- The owner picked Observable Plot (2026-11-09). Render on the server (the `document` option) where no tooltip is needed; pin the exact version (0.6.x is pre-1.0); measured 94 KB min+gzip if rendered in the browser; renders under the site's CSP with no eval.
- Charts V1 (event pulse, with the "Busiest 15 min" line), V5 (my alliance; the same for one member on the player page) and V6 (ledger sparklines) from `docs/screenshots/08zzh-event-progress-options-360-light.png`; each chart's numbers in a table behind "Details".
- Range picker and URL as in `docs/screenshots/08zzh-in-event-range-360-light.png`: From/To selects of existing samples, `?from=HH:MM&to=HH:MM`, tapping a bar or row sets the range.
- Compute on request; no precomputed table (measured 0.5–4.6 ms per query at a year of data on the array layout, PGlite).
- DECISIONS: charts allowed (reverses the CLAUDE.md hard rule; closes #62) and a D7 row for `@observablehq/plot`.
- Not in this build: a "no kills change" list (owner: left for the LLM agent, #61).
</adjustments>

<adjustments for="build 4 (Progress tab, V2–V4)">
- A "Progress" tab on the event page with V2 (kills race), V3 (rank race, step lines) and V4 (who fought when, heatmap), as drawn in `docs/screenshots/08zzh-event-progress-options-360-light.png`; each with its numbers in a table.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/183
