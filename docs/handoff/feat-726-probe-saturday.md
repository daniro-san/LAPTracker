# feat-726-probe-saturday — the probe read once more, at 02:30 ST on Sat 2026-11-28

Part of #726. Owner's approval, 2026-11-23: repeat the probe read on raid night, Sat 2026-11-28 at 02:30 ST (04:30 UTC), about 100 calls, once. Afterwards, compare its share of post-reset maps with Monday's 64% and with the night and morning checks of the same raid.

## Built

- `lib/shield-probe.ts`:
  - `PROBE_WINDOW` is now `2026-11-28`, `02:30`–`02:45` ST. The gate line in `lib/tick-gate.ts` (`probeDue`) and the call in `lib/squads-tick.ts` are unchanged; only their comments name the new date.
  - `PROBE_ALERT` is now 4 (see Decisions).
  - Reserve: the probe keeps the morning check's reserve plus the morning read's cap: `squadsReserve(…)` + `SHIELD_CALLS_MAX` on our key, `SQUADS_SAFETY_MARGIN` + `SHIELD_CALLS_MAX` on a workspace key. If the whole read does not fit above that, it makes no call and logs `quota_low`, as before.
  - Squads queue: if the day's `squad_reads` row is still `running` after this tick's batch, the probe makes no call and logs `squads_busy`. The probe still runs after the batch and inside the same `after` budget.
  - `startProbe` now reads the squads row (`getSquadRead`) on both keys, before any `/quota` call: a running read stops it, and on our key its `quota_remaining` is the start, as before.
- `lib/shield-probe.test.ts`: six PGlite tests:
  - the window opens on 2026-11-28 only (not 04:29:59Z, not 04:45Z, not Monday's old window, not the Saturday before);
  - it runs at most once, with Monday's id 3 claim stored, including two overlapping ticks;
  - the window plus the tick's whole `after` budget falls outside both `passWindows` of Friday 2026-11-27; the readings, taken at the window's start, are in neither window; there is no mark, post, might fact, or change to `shield_checks`;
  - `quota_low` when the read fits above `squadsReserve` but not above `squadsReserve + 120`;
  - `squads_busy` while the squads read is `running`;
  - the gate is open at 04:31Z with the queue settled, and the tick's batch runs the probe.
- D137: amendment 2026-11-23b.

## Decisions

- **The claim uses a new id (4), not id 3.** `claimAlert` decides by time, not by whether the row exists: it inserts the row, or on conflict updates it only when `alerted_at <= now − gap`. The gap is 7 days. Monday's id 3 claim (2026-11-23 04:30 UTC) is 5 days before Saturday, so reusing id 3 would refuse and the probe would never run. Id 4 has no row, so the first tick in the window claims it, and every later tick within 7 days is refused, so it runs at most once. No migration is needed: the `app_alerts_single_row_check` constraint was dropped in `drizzle/0011`, and the table has no check on `id`. I chose this over shortening the gap on id 3 because the result would depend on Monday's stored timestamp, and because Monday's row stays as the record of that run for the SQL below.
- **Reserve = the morning's reserve + 120.** The night check (Fri 23:00–00:00 ST = Sat 01:00–02:00 UTC), the probe (04:30 UTC) and the morning check (12:00–14:00 UTC) all spend from the same quota day, Saturday UTC. The morning read keeps `squadsReserve` and makes at most `SHIELD_CALLS_MAX` (120) calls, so the probe keeps both. With production-like settings (KvK samples every 15 min, 20 alliances, no opponent) `squadsReserve` on that day is 465, so the probe needs about 585 + members left before it calls. Monday's run started with about 881 left. A Saturday with the daily read (~21) and Friday's burst (~100) done should start near 880, so the probe should fit and leave about 780.
- **A running squads read → skip, not share.** At 02:30 ST, Friday's burst has normally finished (it ran from 23:30 ST, with about 10 single-batch ticks after it). If it hasn't, the probe's ~100 calls would compete with the queue's retries for quota and time on its quota day. There is only one tick in the window, so skipping loses this probe; I chose that over starving the squads read, as the task allows. The reason is logged as `squads_busy` on the `shield.probe` line (level `warn`).
- The probe's readings land between 02:30 ST and at most 02:48 ST (the window's last instant plus the 180 s `after` budget). That is 2.5 h after the night window and 7 h before the morning window.

## Deviations

- One test more than the five listed: `squads_busy`, for the new skip behaviour.

## Verified

- `pnpm vitest related --run lib/shield-probe.ts lib/shield-probe.test.ts lib/squads-tick.ts lib/tick-gate.ts`: 16 files, 102 tests passed.
- `pnpm check`: see the report to the orchestrator.
- Each test fails when broken. I checked each mutation by hand and reverted it:
  - window back on 2026-11-23: all six fail;
  - `PROBE_ALERT` back to 3: "at most once" fails;
  - claim guard removed: "at most once" fails;
  - window moved to 10:30–10:45 ST: the windows test fails;
  - `+ SHIELD_CALLS_MAX` removed: the reserve test fails;
  - `quota_low` check removed: the reserve test fails;
  - `squads_busy` check removed: its test fails;
  - the gate's `probeDue` line removed: the gate test fails.
- I made no upstream call. The tests stub `/v1/players`.

## Open issues

- On LAP_API_KEY the probe's calls are not subtracted from `squad_reads.quota_remaining` (as on Monday). The morning check starts from that stored value, so its first estimate is about 100 too high. Its first answer's `quota.remaining` corrects it (`readOne`), and from then on each call checks the reserve. It is not a correctness risk at about 780 left, but it is one call of slack.
- If cron-job.org skips or delays the 02:30 ST tick past 02:45 ST, or the squads read is still running then, nothing runs. There is no retry on the 02:45 tick.
- The probe reads Friday 23:30 ST's roster. A member who joins after that is not read.

## Next

- After 02:45 ST on Sat 2026-11-28 (04:45 UTC), run the first and third queries below. After 12:00 ST (14:00 UTC), when the morning check is done, run the second. All are read-only and return counts only, with no names or uids. Server time is UTC−2. 67111155 is `OWN_ALLIANCE_ID`.

  ```sql
  -- 1. The probe's readings by map minute (server time).
  with probe as (select alerted_at as at from app_alerts where id = 4)
  select to_char((p.map_updated_at at time zone 'UTC') - interval '2 hours', 'Dy YYYY-MM-DD HH24:MI') as map_minute_st,
         count(*) as readings,
         count(*) filter (where p.shielding = 1) as shield_seen
  from player_reads p, probe
  where p.union_id = 67111155
    and p.read_at >= probe.at
    and p.read_at < probe.at + interval '10 minutes'
  group by 1
  order by 1;

  -- 2. Share of members whose newest reading in each window has a map from after the reset
  --    (Sat 00:00 ST = 02:00 UTC): the night check, the probe, the morning check. Compare with Monday's 64%.
  with probe as (select alerted_at as at from app_alerts where id = 4),
  windows(pass, ord, from_at, to_at) as (
    select 'night', 1, timestamptz '2026-11-28 01:00+00', timestamptz '2026-11-28 02:00+00'
    union all select 'probe', 2, at, at + interval '10 minutes' from probe
    union all select 'morning', 3, timestamptz '2026-11-28 12:00+00', timestamptz '2026-11-28 14:00+00'
  ),
  newest as (
    select distinct on (w.pass, p.uid) w.pass, w.ord, p.map_updated_at, p.shielding
    from windows w
    join player_reads p
      on p.union_id = 67111155 and p.read_at >= w.from_at and p.read_at < w.to_at
    order by w.pass, p.uid, p.read_at desc
  )
  select pass,
         count(*) as members,
         count(*) filter (where map_updated_at >= timestamptz '2026-11-28 02:00+00') as post_reset_map,
         round(100.0 * count(*) filter (where map_updated_at >= timestamptz '2026-11-28 02:00+00')
               / nullif(count(*), 0)) as post_reset_pct,
         count(*) filter (where map_updated_at is null) as no_map_time,
         count(*) filter (where shielding = 1) as shield_seen
  from newest
  group by pass, ord
  order by ord;

  -- 3. The run's counts and its reason, if it stopped (Monday's line and Saturday's).
  select at, level, data from run_logs where code = 'shield.probe' order by at;
  ```

  If query 3 shows `squads_busy` or `quota_low`, the probe made no call and query 1 is empty.
- Then decide #726's question 4: make the 02:30 ST read a weekly third read that feeds "To check by hand" if most members again have a post-reset map, or drop it.
- Removal follow-up: a PR deletes `lib/shield-probe.ts`, `lib/shield-probe.test.ts`, the `shieldProbe` call and import in `lib/squads-tick.ts`, and the `probeDue` line and import in `lib/tick-gate.ts`, and notes the removal in D137. Optionally, `delete from app_alerts where id in (3, 4)`.

What was missing from the task prompt? Whether the probe should still run if the squads read is running at 02:30 ST, given that the window has only one tick. I chose to skip it and log `squads_busy`.

PR: (added by the orchestrator)
