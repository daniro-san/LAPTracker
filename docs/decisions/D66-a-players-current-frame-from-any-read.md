## D66 — A player's current frame, from any read (2026-11-14, owner, 08zzzt)

Supersedes D65's "Where it shows" (the frame of the displayed row) and "Freshness" (event snapshots only). Why: the owner wants a frame the player changes in the game to show within a day, and the daily read (D60) already fetches the same `/v1` rosters with `frame_url` in them.

- **Storage.** A new table `player_frames` (migration 0016): one row per player, `uid` primary key, `frame_id`, `seen_at`. Event snapshots (in the transaction that inserts the members) and the daily read write it with `recordFrames()` (`lib/repo/player-frames.ts`). A write only replaces a row whose `seen_at` is not newer, and `seen_at` is the read's upstream `updated_at`, so a late re-run of an old snapshot never undoes a newer daily read. A read without `updated_at` writes nothing. The migration fills the table from the newest `member_snapshots.frame_id` of each player.
- **Not a frame array in `daily_rosters`.** Finding the newest frame across the daily rows' arrays would mean unnesting every stored roster on every page. A one-row-per-player table is read by primary key.
- **Display.** Every query's `frameId` is the player's current frame (`photoColumns`, a subquery on `player_frames`), on every page, old events included, like the photo, which `/img/avatar/[uid]` already serves from the newest row. The player link preview (`findPhoto`) uses it too. `member_snapshots.frame_id` stays as the record of what each event read and is not shown.
- **Reach.** The daily read covers `DAILY_ROSTER_IDS` only; players of other alliances get a new frame from the next event snapshot.
- **Not done:** the photo from the daily read (it would store a ~50-byte URL per member per day; owner's call).
