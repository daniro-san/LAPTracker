# 08zzzt — The daily read updates avatar frames too

## Built
- `player_frames` table (migration `drizzle/0016_young_major_mapleleaf.sql`): `uid` primary key, `frame_id`, `seen_at`. The migration fills it from each player's newest `member_snapshots.frame_id`.
- `lib/repo/player-frames.ts` `recordFrames(db, members, seenAt)`: an upsert that only replaces an older `seen_at`; it skips members without a frame and reads without an upstream `updated_at`.
- Writers:
  - `insertAllianceRow` (event snapshots, the same transaction as the members).
  - `runDailyRead` (after its roster rows, from each read roster's members and `sourceUpdatedAt`).
- Readers:
  - `photoColumns.frameId` is now the player's current frame (a subquery on `player_frames`), so every list, card, compare and player page shows it.
  - `findPhoto` (the player link preview) joins `player_frames`.
- Tests:
  - `lib/daily-read.test.ts`: three daily reads out of time order; the stored frame is always the one from the newest `updated_at`.
  - `lib/queries/photo.test.ts`: each member gets its player's current frame in a select from `member_snapshots` alone, and null without one.
- `lib/db.test-helpers.ts` `truncateAll` also truncates `player_frames`.
- Docs: D66 (supersedes D65's per-row display and its freshness bullet), decisions index, GLOSSARY "avatar frame", DESIGN.md `avatar`.

## Decisions
- One row per player instead of a frame array in `daily_rosters`. The newest frame across daily arrays would need every stored roster unnested on every page view. The table is read by primary key.
- Every page, old events included, shows the player's current frame, the same way the photo already works. Without this, a daily update would only show on pages built after it.
- Order by the upstream `updated_at`, not by write time, so a re-run of an old snapshot cannot undo a newer daily read.
- Frames only, not the photo. The owner did not answer whether the photo should come along. A photo URL per member per day costs about 100 KB a day for 2,000 members, and a frame id costs nothing extra in `daily_rosters` because it goes to `player_frames`. Listed as not done in D66.

## Deviations
- The first local run returned 500 on `/events/[id]/alliances/[unionId]`: "more than one row returned by a subquery". Drizzle renders a select from `member_snapshots` alone with unqualified columns, so `where uid = uid` matched every `player_frames` row. Fixed by qualifying both sides by hand. `lib/queries/photo.test.ts` reproduced the error before the fix and passes after it.
- In 08zzzs (PR #262) I edited a line of D65 ("Not done") and one of D22 inline. `docs/decisions/README.md` says old entries are never edited. Those two edits stay as merged; this change adds D66 instead of editing D65.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (266 passed, 1 skipped; 2 new), drift, i18n.
- Local Postgres with the fixture seed: `db:local:migrate` applied 0016 and filled `player_frames` with 1,798 players and 6 frames.
  - A simulated newer daily read (an upsert at 2026-11-13, frame 5026) replaced 5007 for uid 342234431813. A simulated older one (2026-11-01, 5001) changed nothing (`INSERT 0 0`).
  - `next dev`, every page type 200 with frames from `player_frames`:
    - `/events/6/alliances/67110584`: 5001 ×15, 5026 ×8, 5010 ×2.
    - `/players/342234431813`: 5026, the simulated daily frame.
    - `/players?q=a`.
    - `/events/compare` for an alliance and for a player.
    - `/img/preview/player/339451289925`.
- No daily read was run against the API, so no quota was spent.

## Open issues
- The photo still updates only with event snapshots.
- Players outside `DAILY_ROSTER_IDS` get a new frame only at the next event snapshot.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` (the preview build runs 0016), then release. The release runs 0016 on production, where `member_snapshots.frame_id` is still empty, so `player_frames` starts empty and fills at the next daily read or snapshot.
Plan changes needed: none.

<adjustments>
- A player's frame is `player_frames.frame_id` (current, from any read); `member_snapshots.frame_id` is history only. Write frames with `recordFrames()` wherever a new roster read is stored.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/263
