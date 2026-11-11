## D18 — Collector details the plan left open (2026-11-04, Session 3)

- **Error rows** (v1 failed and the internal fallback failed) store null `tag`/`name` (unless the id is in config), `member_count`, `total_power`, `total_kills` and `raw_json`, with `is_fresh = false` and `source = 'v1'`. Those columns are nullable for this case (owner's choice), so a failed alliance is never stored as zeros. `member_snapshots.power`/`kills` are nullable for D15.
- **The claim comes before the quota call.** `findSnapshot` decides: a complete snapshot needs `force`, and a `running` one younger than 10 min is refused. `startSnapshot` is a compare-and-set: an insert with `on conflict do nothing`, or an update guarded by the row's last status and `started_at`. Two runs cannot both claim, and neither spends quota before claiming.
- **`force`** deletes the snapshot's alliance and member rows and collects every alliance again. Without it, a re-run fetches only alliances with no row. An error or stale row counts as a row, so only `force` re-fetches it.
- **`calls_used` counts `/v1` attempts only** (the quota check, alliance reads and retries), through the `onAttempt` hook on the adapter. Internal calls cost no quota and are not counted, so `calls_used` reconciles with `/v1` `used`. A re-run adds its calls to the stored value.
- **Status:** `failed` when the call cap was hit or no row holds data; `complete` when every alliance has a fresh row without error; `partial` otherwise, including a 429 mid-run.
- **Unexpected errors** (repo, bugs) are not caught. They propagate, and the snapshot stays `running` for the caller (Session 4's route) to finalise. After 10 min it can be re-run without `force`.
- **`quota_remaining_after`** is the lowest `remaining` seen in this run's `/v1` responses.
