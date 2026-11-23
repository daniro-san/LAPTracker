# feat-726-probe-read — a one-off probe read at 02:30 ST on Mon 2026-11-23

Part of #726. Owner's approval, 2026-11-22: "agenda uma leitura hoje às 2:30… só pra teste", with its quota cost (about 100 calls, once). Goal: learn when the tracker rescans the map after the server reset, from the readings' map times.

## Built

- `lib/shield-probe.ts`:
  - `PROBE_WINDOW` (`2026-11-23`, `02:30`–`02:45` ST): one dated constant, with the issue, the owner's approval and the removal note in the file header.
  - `shieldProbe`: outside the window it returns before any read. Inside, it claims `app_alerts` id 3 (`claimAlert`, one statement, gap 7 days), so only one tick ever runs it.
  - It reads the own alliance (`OWN_ALLIANCE_ID`) only, and only when its `shield_check` is on (`squadTargets(…, "shield_check")`), on that target's key (LAP_API_KEY, or the workspace key when one is saved).
  - Members: the day's roster (`dayRosterUids` of `quotaDayRead`, Sunday 2026-11-22's read at 02:30 Monday ST).
  - Quota: as the morning check's start (`startQuota`; on our key the day's squads read's `quota_remaining`, else the daily read's). The reserve is the morning check's (`squadsReserve` = margin 100 + `eventReserve`; a workspace key: the margin). When the whole read does not fit above the reserve, or the quota is unknown, it makes no call and logs the reason. During the read the cap of 120 (`SHIELD_CALLS_MAX`), the reserve and the tick's deadline stop it.
  - Each call is `readOne`, the checks' call: no `fresh`, no retry, a 429/401/403 stops the read and marks a workspace key as the checks do. The answers go to `player_reads` (and `member_squads`, `player_history`) as the checks store them.
  - One `shield.probe` run-log line (and its console mirror): `union_id`, `members`, `calls`, `players`, `failed`, `quota_remaining`, `reason`. No uid, name or shield value.
- `lib/squads-tick.ts`: `squadsBatch` calls `shieldProbe` after `shieldTick`, within the same `after` budget (`AFTER_BUDGET_MS`).
- `lib/shield-probe.test.ts`: two PGlite tests (below).
- D137: dated amendment.

## Decisions

- No new pass value and no schema change. Every reader of the shield readings (Raid prep, its fill, the member card, the summary, the push, the status bar, Insights) selects them through `passWindows` (Friday 23:00–00:00 ST, Saturday 10:00–12:00 ST). A reading at 02:30 Monday is in neither window, so no check can take it for one of its passes. The second test asserts this for the Friday before and after.
- Claim: `app_alerts` row id 3, through the existing `claimAlert`. Nothing else reads `app_alerts`; ids 1 (retired) and 2 (tick silence) are untouched. This was the least intrusive option: a `shield_checks` row for a Sunday quota day would show up wherever that table is read.
- The probe passes the target with `workspaceId: null` to `readOne`, so it writes no "Main squad might" version. The key stays the target's own.
- The read runs only on the 02:30 tick. It does not continue on the 02:45 tick: the task names one tick, and the claim is taken once. A read cut by the tick's deadline stays partial (logged as `deadline`).
- The quota check covers the whole read (`remaining − members < reserve` → `quota_low`, no call), per "if the quota check fails, it does nothing".

## Deviations

- None from the task.

## Verified

- `pnpm vitest related --run lib/shield-probe.ts lib/squads-tick.ts lib/shield-probe.test.ts`: 7 files, 48 tests passed.
- `pnpm check`: see the report to the orchestrator.
- Each test fails when broken (checked by hand, then reverted): without the claim guard the first test fails (12 extra calls); with the window starting 02:29 the first test fails; with one `fetch` to a Discord URL added to the probe the second test fails.
- No upstream call was made: the tests stub `/v1/players`.

## Open issues

- On LAP_API_KEY the probe's ~100 calls are not added to the day's `squad_reads.quota_remaining`. A squads batch that still runs later that quota day starts from its own stored value until the next answer's `quota.remaining` corrects it. At 04:30 UTC the day's squads read (from 01:30 UTC) is normally done.
- If cron-job.org skips or delays the 02:30 ST tick past 02:45 ST, nothing runs.
- The probe reads the day's roster from Sunday 23:30 ST; a member who joined after it is not read.

## Next

- After 02:45 ST on 2026-11-23 (04:45 UTC), run this read-only SQL. It counts the probe's readings by their map minute (server time, UTC−2), with no names or uids:

  ```sql
  with probe as (select alerted_at as at from app_alerts where id = 3)
  select to_char((p.map_updated_at at time zone 'UTC') - interval '2 hours', 'YYYY-MM-DD HH24:MI') as map_minute_st,
         count(*) as readings,
         count(*) filter (where p.shielding = 1) as shield_seen
  from player_reads p, probe
  where p.union_id = 67111155
    and p.read_at >= probe.at
    and p.read_at < probe.at + interval '10 minutes'
  group by 1
  order by 1;

  select at, level, data from run_logs where code = 'shield.probe';
  ```

  The second query gives the run's counts and its reason, if it stopped. A `map_minute_st` of null is a reading with no map time.
- Removal follow-up: a PR that deletes `lib/shield-probe.ts`, `lib/shield-probe.test.ts` and the `shieldProbe` call and import in `lib/squads-tick.ts`, and notes the removal in D137. Optionally `delete from app_alerts where id = 3`. The readings stay, as any other read (D132).
- Decide #726's question 4 (a third read after the reset) from the result.

What was missing from the task prompt? Nothing blocking; it did not say whether a read cut by the 02:30 tick's deadline should continue on the 02:45 tick (I chose not to).

PR: (added by the orchestrator)
