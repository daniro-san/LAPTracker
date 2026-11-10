# 08zzr — Spike: alliance member history (#197)

Owner's request (issue #197, Portuguese, no spec): a daily tick reads each alliance's member list (names, might, kills) so the site keeps a history of who joined, who left, who changed name and how kills changed. First only for OGs, then for every tracked alliance if it is cheap. Shown on a separate page inside the alliance ("player story" or similar).

## Built
- This file. No code, no migration, no dependency, no mockup, no upstream call.
- Throwaway measurements, not committed: read-only SELECTs on the Neon preview branch and a PGlite size script over the real rosters in `fixtures/`.

## Decisions

### 1. What is stored today, and what can be derived from it with zero quota

**Per snapshot, every tracked alliance keeps its full roster.**
- `alliance_snapshots`, one row per alliance per snapshot. It holds `tag`, `name`, `member_count`, `capacity`, `total_power`, `total_kills`, the ranks, `badge_id`, `is_fresh`, `source_updated_at` and `raw_json`. `raw_json` is the trimmed `/v1` body, and it still contains the blocked roster keys (`lib/raw-json.ts`).
- `member_snapshots`, one row per member per alliance row. It holds `uid`, `name`, `power`, `kills`, `lv`, `avatar_url`, `rank_code` and `rank_label` (`lib/schema.ts`).
- The BEFORE run reads all 20 configured alliances. The AFTER run reads the event's copy of that list (`lib/collector.ts` `allianceIds`).
- A failed alliance gets an error row with no members (D18). A `live: true` internal fallback row carries members (D5, D44).

**Snapshots exist only as phases of an event.** Today that means:

| Source | When | Public | Rosters per week |
|---|---|---|---|
| scheduled event, Before and After | Saturday 10:00 and 14:00 server | yes | 2 |
| manual rounds (D28) | when the owner presses | yes, unless visibility `admin` | 0–n |
| rehearsals | Friday 18:00 server (default `REHEARSAL_AT`) | no (`is_test`, pruned to `REHEARSAL_KEEP`) | 2, not usable |

So the stored grain is **one week** (two rosters on the event's day, then nothing until the next event).

**Join, leave, rename and kills history can be derived from these rows today, with zero quota.**
- `compute.rosterDiff(before, after)` already returns `joined`, `left`, `stayed` and `renamed`, all matched by `uid`.
- Partial uses already exist:
  - `rosterChanges` (counts per event);
  - the compare page's joined/left between two events (08zzo);
  - the player page's alliance stays and previous name (`playerHistory`);
  - `allianceNames` for alliance tag and name changes.
- Measured on the preview branch (seed data). Every stored roster in public events was diffed pairwise by `uid`. One query per question took 149–160 ms from this Mac, and that time is the round trip. The diffs found:
  - Oct 24 16:01: uid 339985801541 left YAHO and joined FSPN. The seed's `applyMove` does this on purpose.
  - Oct 31 16:01: one TRI member renamed, and 2 members left URSA.
  - OGs: 0 joined, 0 left, 0 renamed over 5 consecutive pairs.
- **What cannot be derived:**
  - anything between two stored rosters, so a member who joined and left between two Saturdays is not seen;
  - a daily grain;
  - the date a member joined. Only "first seen in the roster read at T" exists, and `joined_at` is blocked (see §3).
- **Caveat on the evidence:** the seed is synthetic. `scripts/seed-data.ts` `drifted()` changes every member's power and kills in every snapshot, so the preview shows that the derivation works, not how often real kills move. The production branch was not read: this worktree has no production URL. Real movement from `fixtures/` (two `/v1` reads of OGs and URSA 666 s apart on a Wednesday): power changed for 11 of 100 and 18 of 95 members, and kills changed for 0 (08zzh).

### 2. Quota (1,000 calls per UTC day, `lib/budget.ts`)

**Today's spend, from the code and from 09-dryrun:**
- A full run is 21 calls: 1 quota check and 20 alliance reads, with 0 retries (09-dryrun, production 2026-11-05).
- A run starts only if `remaining ≥ requiredQuota(n) = 2 × (n + 5)`, which is 50 for 20 alliances (D4, `INVARIANT budget.reserve-for-after`).

| UTC day | Calls today | What |
|---|---|---|
| Saturday | 42 | Before 12:00 UTC + After 16:00 UTC |
| Friday | 43 | rehearsal (2 × 21) at 20:00 UTC + Friday check (1) at 22:00 UTC |
| Sun–Thu | 0 | no scheduled spend |
| any day | +21 per manual phase, +1 per `GET /api/quota` or `/api/quota/check` | by hand |
| Saturday after 08zzh (PR #183, not merged) | 567 KvK / 189 Origin of Chaos | samples every 15 min |

**A daily read at 06:00 server (08:00 UTC)** costs 1 quota check plus k alliance reads. A read retries 502/503/504 at most 3 times, so one alliance costs at most 4 calls.

| | k | Normal | Full outage (1 + 4k) | Sun–Thu | Friday | Saturday today | KvK Saturday (08zzh) | Per week |
|---|---|---|---|---|---|---|---|---|
| OGs only | 1 | 2 | 5 | 2 | 45 | 44 | 569 | +14 |
| all tracked | 20 | 21 | 81 | 21 | 64 | 63 | 588 | +147 |

- At 08:00 UTC the day's counter has just reset (00:00 UTC). Nothing else is scheduled before Saturday's Before (12:00 UTC; 11:45 UTC under 08zzh's KvK window), so the read cannot starve an event phase. A guard still makes that a rule: a daily read starts only if `remaining ≥ requiredQuota(k) + requiredQuota(20)`, which is 62 for OGs and 100 for all 20. Proposed name: `INVARIANT budget.daily-keeps-event-reserve`.
- If 08zzh lands first, its rule replaces this one. Its rule is `remaining ≥ 25 × (1 + window ends still due today)`, and the daily read adds its own `1 + k`.

**The D28 Saturday guard and the other event rules stay untouched only if a daily read is not an event.** `executeSnapshot` refuses every run before a scheduled event's `before_at` (`snapshot_not_due`). A daily read stored as an `events` row would also run into:
- `duePhases` and `tick.skips-manual`;
- the chains `allianceHistory`, `sightingsOf` and `historyRanks`: a daily row sorts between two Saturdays and becomes the "since" reference;
- `homeEvent`, the header selector, `GET /api/events`;
- the rehearsal guard (no real BEFORE within 3 h);
- D31, which gives each event one Discord message per channel.

Every one of those would need an exclusion. A separate pair of tables needs none of them (Options D vs B/C).

**Tick:** D21 allows one action per tick. The daily read becomes the last step, after phases, the Friday check and rehearsals. It is claimed once per server day with an insert-on-conflict, like `rehearsal_slots`, so the 15-minute cron-job.org tick (D30) runs it once. A read takes ≈ 2 s for one alliance and ≈ 10 s for 20 (09-dryrun: 9.6–10.0 s), under the 100 s deadline (D25).

### 3. Privacy: what the page may show

- **Store** per alliance and day: `tag`, `name`, `member_count`, `total_power`, `total_kills`, `source_updated_at`, `is_fresh`, `error`, and the members as `uid`, `name`, `power`, `kills`. **No `raw_json`** on daily rows, so the blocked keys (`x`, `y`, `online`, `last_online_at`, `joined_at`, `daily_*`, `active`, `avatar_url`) are never stored by the daily read at all.
- **Joined / left come from membership diffs only.** A member is "joined" when their `uid` is in today's roster and not in the previous usable roster of that alliance. A member is "left" in the reverse case. The page dates it as "between <previous read> and <this read>", never as a join date. `joined_at` is not read, not stored and not shown.
- **The page may show:**
  - names with a link to `/players/[uid]`;
  - the photo only through `/img/avatar/[uid]` and the badge only through `/img/badge/[id]` (D22);
  - joined / left / renamed (old name → new name);
  - might and kills per member and their change since the previous usable read;
  - the alliance's member count and totals;
  - for a member who left, "now in <tag>" when the same `uid` appears in another tracked alliance's roster at a later read. That is a public roster fact; the player page already shows alliance stays.
- **The page must not show:** online status, last online, "inactive" or any activity label, coordinates, daily honour or tech, or a join date.
- **Gaps:**
  - A failed or stale read gives no diff for that day. The next diff spans both days and says so.
  - An empty or missing roster is never diffed. This is D32's rule: one roster alone does not mean everyone left.
- **No internal fallback for daily reads.** D5 records the fallback for event snapshots only. Widening it needs a DECISIONS entry (CLAUDE.md), and a missed day is an acceptable gap.

### 4. Storage (measured)

PGlite, 22 real `/v1` rosters from `fixtures/` (1,934 members), 30 simulated days with small drift, `pg_total_relation_size` with indexes:

| Layout | Per 100 members per day | OGs per year | 20 alliances (~1,800 members) per year |
|---|---|---|---|
| **one row per alliance and day, members as 4 arrays (`uid`, `name`, `power`, `kills`)** | **3.6 KB** | **1.3 MB** | **24 MB** |
| one row per member and day (`uid`, `name`, `power`, `kills`; unique key + `uid` index) | 15.7 KB | 5.7 MB | 103 MB |
| a full snapshot as today (`raw_json` + `member_snapshots`; 752 KB per 20 alliances, measured by 08zzh) | ≈ 38 KB | ≈ 14 MB | 274 MB |

- The 700 MB warning (`DB_WARN_ABOVE_MB`) is not reached by the array layout in any realistic time. With 08zzh's ≈ 150 MB/year, the total is ≈ 174 MB/year for all 20 alliances.
- **Query:** one alliance, 30 days of arrays, unnest and compare each member with their previous day (first sightings and renames): 11.3 ms (PGlite, mean of 20). On Neon from this Mac each query adds ≈ 150 ms of round trip, measured today.
- The array layout is the same as 08zzh's "light sample" layout (c). Both builds can share one unnest-and-join-by-uid read.

### 5. Options

| | A. Event rosters only | B. Daily read, OGs only | **C. Daily read, all tracked alliances (recommended)** | D. Daily read as a hidden event |
|---|---|---|---|---|
| What | the history page diffs the rosters already stored (Saturday Before/After, `history` and `standalone` manual rounds) | a daily read of OGs into two new tables (below); the page merges daily rows with event rosters | the same build as B; the alliance list is all 20 | a daily `events` row with `visibility = admin`, collected by `runSnapshot` |
| Grain | one week | one day for OGs, one week for the others | one day for every alliance | one day |
| Quota | 0 | 2/day (+14/week) | 21/day (+147/week) | 21/day |
| Storage | 0 | 1.3 MB/year | 24 MB/year | 274 MB/year |
| Migration | no | yes: 2 tables | yes: the same 2 tables | yes: an event kind, plus exclusions in every event query |
| Work | ≈ 1 session: one query, one page, copy | ≈ 1.5 sessions: tables, tick step, collector function + test, page, copy | the same as B | ≈ 2 sessions, mostly exclusions |
| Risk | does not answer "every day"; a member who joins and leaves within a week is not seen | the page has two grains: OGs daily, everyone else weekly | 19 more calls a day than B; an outage day costs up to 81 calls | touches D21, D28, D31, the chains, the selector and the rehearsal guard; `raw_json` with blocked keys stored daily |

**Recommendation: C**, with the alliance list as a constant in `config/alliances.ts` (`DAILY_ROSTER_IDS`, default: every tracked alliance). Setting it to `[67111155]` gives B with no code change, if the owner wants to start with OGs.

Why C over B:
- The difference is 19 calls a day (1.9 % of the quota) and ≈ 23 MB a year.
- With C every alliance page links to a page with the same daily grain. With B, OGs is the only special case.

The page also reads event rosters (option A's data), so its history starts with the rosters stored before the build. A gives the page without the daily read. It does not answer "every day".

**Tables for B/C**, mirroring `snapshots` / `alliance_snapshots`:
- `daily_reads`: one row per server day.
  - `day date primary key`, `started_at`, `finished_at`, `status` (`running` / `complete` / `partial` / `failed`), `calls_used`, `quota_remaining_before`, `error`.
  - The insert is the claim, so two ticks cannot both read.
  - `run_logs.snapshot_id` is NOT NULL, so daily reads cannot log there without a migration. The row's own fields carry the outcome, and the tick's `tick_log.outcome` names it.
- `daily_rosters`: one row per read and alliance.
  - `read_day` (FK to `daily_reads`), `union_id`, `tag`, `name`, `member_count`, `total_power`, `total_kills`, `source_updated_at`, `is_fresh`, `error`.
  - `member_uids bigint[]`, `member_names text[]`, `member_power bigint[]`, `member_kills bigint[]`. Null power or kills stay null (D15).
  - `unique (read_day, union_id)`.

**Cadence:** once a day at `DAILY_ROSTER_AT` = 06:00 server (08:00 UTC), new env var with that default. The time is clear of:
- Saturday's Before (10:00 server, or 09:45 under 08zzh);
- Origin of Chaos window 1 (00:10–00:40 server, 08zzh);
- Friday's rehearsal and check (18:00 and 20:00 server).

Twice a day would double the quota for little gain. The read runs on event days too, so every day has a read at the same time.

**Page:** `/alliances/[unionId]/history`, "Member history". It is not under `/events/[id]/…` because the history belongs to no event.
- **Entry point:** a "Member history" link on the alliance page next to "Across events".
- **Layout:** breadcrumbs, the alliance head (badge, tag, name), filter links (All · Joined · Left · Renamed · Kills, plain GET links). Then one card per read, newest first:
  - the date and read time, or the event title for an event roster;
  - "+ Name" joined, "− Name" left (with "now in TAG" when known), "Old → New" renamed;
  - then the members whose kills changed, ordered by kills gained, each with might and kills change.
- **Paging:** 30 reads per page, "Older" link `?before=<day>`.
- **Unknown or untracked `unionId`:** 404.
- **Layout rules:** 360 px first, cards below 640 px, no charts, nothing hover-only.

## Deviations
- The prompt asked for facts from stored data. Only the preview branch was readable here, and it holds the seed (3 Saturdays, 20 alliances, 10,698 member rows, 11 MB), so real movement numbers come from `fixtures/` and earlier handoffs. Production was not read.
- The PGlite script used 22 rosters (the 20 in `fixtures/v1-ids/` plus OGs and URSA), not exactly the 20 tracked ones. The per-100-members figure does not depend on that, and the 20-alliance figures are scaled to ≈ 1,800 members.
- No mockup: the issue asks for a choice first. The build session takes screenshots.

## Verified
- Read-only SELECTs on the Neon preview branch (`set session characteristics as transaction read only`), 2026-11-09:
  - the snapshot list: events 1–3, 2 phases each, 1,710–1,798 member rows each; event 4 is a rehearsal with no members stored;
  - the database size (11 MB) and the size of `member_snapshots` (2,152 kB);
  - the roster diffs in §1.
- PGlite size and query script: §4.
- Code read for every claim: `lib/schema.ts`, `lib/collector.ts`, `lib/collector-rows.ts`, `lib/raw-json.ts`, `lib/run.ts`, `lib/tick.ts`, `lib/schedule.ts`, `lib/budget.ts`, `lib/compute.ts` (`rosterDiff`), `lib/queries/{rosters,names,players,blocked-keys,index}.ts`, the alliance page, and docs/DECISIONS.md D1, D4, D5, D18, D21, D22, D25, D28, D30, D32, D33, D44.
- Read: 08zzh (PR #183, open) and 08zzk.
- No upstream call, no `/api/quota`, no `/api/tick`, no `/api/snapshot`, no internal-source call.
- `pnpm check` green (exit 0): 48 test files, 227 tests passed and 1 skipped; no schema drift; i18n up to date. This PR changes one Markdown file.

## Open issues
- `member_snapshots.rank_code` would give rank changes (promotions to R4) on the same page. The owner did not ask for it, so it is not in the prompt. Adding `member_ranks smallint[]` to `daily_rosters` costs ≈ 0.2 KB per 100 members per day.
- A failed daily read posts nothing today. The prompt adds one admin Discord line on `partial` or `failed`, as runs do. No public message is proposed.
- The production database size was not read here. The Friday message reports it.

## Next
Session: build of option C — next free session number, `session/<NN>-alliance-history`.
Model / effort: keep (opus · high). It touches the collector (rules/collector.md: a test in the same commit), the tick and the schema, plus one page and 18-language copy, the same size as 08zzo.
Owner must do first:
1. Choose an option (C recommended). B is C with `DAILY_ROSTER_IDS = [67111155]`.
2. Merge this PR.
3. Open the build issue with the prompt below.
4. After the build's release, add `DAILY_ROSTER_AT` to Vercel only if 06:00 server is not wanted.

If 08zzh (#183) merges first, the build reuses its array read and its budget rule.
Plan changes needed: IMPLEMENTATION_PLAN.md §"Not in v1" or Phase 5 — add "member history (daily roster read)" as a v1.x page (owner's call). No edit was made here.

Issue body for the owner to paste (shape of #191):

````markdown
**Why**
Owner, issue #197: keep a daily history of each alliance's members (joined, left, renamed, might and kills) and show it on a page inside the alliance. Spike: docs/handoff/08zzr-spike-alliance-history.md, option C.

**Blocked by** nothing. If #183's build (08zzh, event samples) is in progress, coordinate on lib/tick.ts and lib/budget.ts.

**Session prompt**

```text
<session>
Session <NN>-alliance-history. Read CLAUDE.md, .claude/rules/collector.md, docs/handoff/00-prereqs.md, docs/handoff/08zzr-spike-alliance-history.md (the spec), docs/ARCHITECTURE.md, docs/DESIGN.md (Layout, `history-row`, `details-table`), docs/DECISIONS.md D5, D15, D18, D21, D22, D25, D28, D32, and docs/GLOSSARY.md (member, fresh, blocked roster keys). If docs/handoff/08zzh-spike-event-model.md is merged and its build has landed, reuse its member-array read and its budget rule instead of the one below.
</session>

<task>
Build the daily roster read and the member history page (issue #197, option C):
- Migration: `daily_reads` (day date primary key = server date, started_at, finished_at, status running/complete/partial/failed, calls_used, quota_remaining_before, error) and `daily_rosters` (read_day → daily_reads, union_id, tag, name, member_count, total_power, total_kills, source_updated_at, is_fresh, error, member_uids bigint[], member_names text[], member_power bigint[], member_kills bigint[]; unique (read_day, union_id)). No raw_json.
- config/alliances.ts: `DAILY_ROSTER_IDS`, default every tracked alliance. lib/env.ts: `DAILY_ROSTER_AT` (server time, default "06:00").
- A daily read function next to the collector: claim the day's `daily_reads` row (insert on conflict do nothing); one /v1/quota call; start only if remaining ≥ requiredQuota(k) + requiredQuota(ALLIANCES.length) (INVARIANT budget.daily-keeps-event-reserve); read each alliance through the existing v1 adapter (same retries, User-Agent, call cap, 100 s deadline, is_fresh rule); no internal fallback; finish the row with status and calls_used. One admin Discord line when the read is partial or failed.
- lib/tick.ts: the daily read is the last step, after phases, the Friday check and rehearsals, when the server time is past DAILY_ROSTER_AT and the day has no daily_reads row. It never creates an `events` row.
- lib/queries/member-history.ts: `memberHistory(db, unionId, { before?, limit = 30 })`. It merges the alliance's daily rosters with its public event rosters (`publicEvent`; the event's own reads), in time order. It diffs each usable roster against the previous usable one by uid (compute.rosterDiff): joined, left (with "now in <tag>" when the uid is in another tracked roster at a later read), renamed, and per member the power and kills change. A stale, failed or empty roster is skipped, and the next diff names the span. Export from lib/queries/index.ts.
- Page `/alliances/[unionId]/history` ("Member history"): breadcrumbs, the alliance head, filter links (All, Joined, Left, Renamed, Kills; GET), one card per read (newest first) with joined, left, renamed, then members by kills gained with might and kills change; "Older" link `?before=`. 404 for a union id with no rows. A "Member history" link on the alliance page next to Across events.
- Copy keys in lib/copy.ts and all 18 languages via the translate-copy skill.
- DECISIONS.md: D60 (daily read: tables, time, budget rule, no internal fallback, not an event). GLOSSARY.md: "daily read", "member history". DESIGN.md: the page's component line and Navigation line.
- Tests: one for the daily read (quota below the reserve makes no alliance call; a failed alliance gives an error row and a partial read), one for the tick step (runs once per day, never before a due phase), and one for memberHistory (joined, left, renamed from two rosters; a stale roster gives no diff). PGlite, sized like the neighbouring tests.
- Screenshots at 360 and 1280 px, light and dark → docs/screenshots/<NN>-alliance-history-*.png.
</task>

<constraints>
- No upstream call while building. Tests use the fake sources.
- The daily read stores no raw_json and never reads joined_at. Joined and left come only from roster diffs. The page never shows online, last online, activity, coordinates, daily_* or a join date. Photos only via /img/avatar/[uid], badges only via /img/badge/[id] (D22).
- Not an event: no change to duePhases, the chains, homeEvent, the selector, D28's not-due guard or D31.
- lib/sources/internal.ts is not used by the daily read.
- Mobile-first at 360 px: cards below 640 px, 44 px targets, nothing hover-only, no charts. Reads only through lib/queries.
</constraints>

<done_when>
The daily read runs from the tick in tests; the history page renders from seed data at both widths and themes; the alliance page links to it; pnpm check is green; docs/handoff/<NN>-alliance-history.md written. PR: "feat(alliance): daily roster read and member history (#197)", body `Closes #<this issue>`.
</done_when>
```
````

<adjustments>
- Measured: member arrays (uid, name, power, kills) take 3.6 KB per 100 members per day (PGlite, 22 real rosters). That is 24 MB/year for all 20 alliances and 1.3 MB/year for OGs. One member row per day would take 103 MB/year, so do not use member rows.
- A daily read costs 1 + k calls: 21 for all 20, 2 for OGs; up to 1 + 4k in an outage. It takes ≈ 10 s for 20 alliances (09-dryrun).
- `compute.rosterDiff` already returns joined, left and renamed by uid. Reuse it, do not write a second diff.
- `run_logs.snapshot_id` is NOT NULL, so daily reads cannot write run_logs. Keep the outcome on the `daily_reads` row and in `tick_log.outcome`. Do not alter run_logs.
- The preview seed has one member move (uid 339985801541, YAHO → FSPN at Oct 24 16:01), one TRI rename and 2 URSA leavers at Oct 31 16:01. Use them to check the page. The seed has no daily rows. The page must render from event rosters alone, and a test inserts daily rows.
</adjustments>

<adjustments for="08zzh build (#171/#175/#176)">
- The daily read uses the same member-array layout as the light samples (`member_uids`, `member_power`, `member_kills`, plus `member_names` here). Share one unnest-and-join-by-uid helper.
- The daily read spends 1 + k calls at 06:00 server every day, Saturdays included. Count it in the per-day budget rule. A KvK Saturday becomes 567 + 21 = 588 calls.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/203
