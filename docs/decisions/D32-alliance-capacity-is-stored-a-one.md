## D32 — Alliance capacity is stored; a one-roster member list is not diffed (2026-11-05)

- `alliance_snapshots.capacity` (nullable integer, migration 0007) holds the `/v1` `capacity` field. The public pages show `members / capacity`, and only the plain count when it is null (old rows, internal source). It is an alliance field, not a roster field.
- The member list compares the two rosters only when both are non-empty. Otherwise the non-empty one is the current roster, with no Joined / Left status and no change figures. Before this, a Before-only event listed every member as Left.
