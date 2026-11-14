# 08zzzr — Avatar frames around every player photo

## Built
- Source: `frame_url` parsed by both adapters (`lib/sources/shared.ts`, optional field); `frameId()` keeps only the number of `/static/frames/frame_<id>.png`, null for anything else. `MemberInput.frameId`, `MemberRow.frameId`.
- Storage: `member_snapshots.frame_id integer` (migration `drizzle/0015_graceful_dagger.sql`, nullable). The collector passes members through unchanged, so no collector change. `scripts/seed-data.ts` / `seed.ts` seed it from the fixtures.
- Route: `GET /img/frame/[id]` (`app/img/frame/[id]/route.ts`), `frameSource()` and `FRAME_CACHE` in `lib/images.ts`. Digits only; the file from the tracker site's origin; served as fetched with a one-year immutable cache; 404 with no body on any failure.
- Queries: `lib/queries/photo.ts` holds `Photo` (`hasAvatar`, `frameId`) and `photoColumns`, used by `alliances.ts`, `compare.ts`, `compare-player.ts` and `players.ts` instead of four copies of the `hasAvatar` column. `Photo` is exported from `lib/queries`.
- UI: `PlayerAvatar` takes `photo: Photo` (was `hasAvatar`). With a frame id: the game frame over the photo, no drawn frame, 51 px box on rows (photo 32 px) and 80 px for the large size (photo 50 px). All 7 call sites pass `photo={…}`; `member-views.ts` carries `frameId`.
- Docs: D65 (with the storage comparison and the measurements), its index line, DESIGN.md `avatar`, GLOSSARY "avatar frame". Screenshots `docs/screenshots/08zzzr-*.png`.
- Tests: `lib/sources/v1.test.ts` (frame id kept, null when missing or not a frame path), `app/img/frame/[id]/route.test.ts` (fetch path, cache header, refused ids).

## Decisions
- Storage, the owner's question: an id per member row and the picture fetched once per frame through our CDN-cached route. Measured and compared in D65: 6 distinct frames in 2,723 recorded rows, 190 × 190 PNGs of 5–24 KB. The other options were the URL per row, the images in our own table, or the PNGs in the repository. Each costs more or misses new and temporary frames.
- The game frame replaces our soft drawn frame. Two frames, one inside the other, read as clutter in the test sheet.
- The large size is 80 px, not 89. At 89 px (photo kept at 56 px), "TheChickenJockey" wrapped onto two lines beside the photo at 360 px, and it fit at 56 px before this change. At 80 px it fits on one line.
- The frame shown is the one on the displayed row, like `hasAvatar`. It is not "the newest frame of this uid".

## Deviations
- `lib/queries/players.ts` went over eslint's 300-line limit with the new field. The shared `Photo` / `photoColumns` brought it back under, and it now serves all four query files.
- `PlayerPage` went over the 80-line function limit when prettier split the `PlayerAvatar` call. Passing `photo={current}` keeps it on one line.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (263 passed, 1 skipped; 2 new), drift, i18n.
- One GET for each of the six frame files on lastasylumtracker.com (our User-Agent): all 200, measured as in D65. No API call and no quota spent.
- Local Postgres (`db:local`, migrations 0000–0015, `db:local:seed --with-states`): `frame_id` stored on all 12,496 seeded rows (5001: 11,205; 5010: 696; 5026: 574; 5007/5008/5009: 7 each). `next dev` with `LAP_SITE_BASE_URL` pointed at the real site, so the frame and badge PNGs load. The API base URL was a dead address.
- Playwright + system Chrome at 360 px, light and dark: `/players/342234431813` (5007, photo missing upstream → `NoPhoto` inside the frame), `/players/340581761349` (5008), `/events/6/alliances/67109944` (leadership and member cards, 25 frames), `/players?q=a` (50 frames, mixed with rows without frames). `scrollWidth` 360 on every page, every frame image loaded.
- Not checked on the deployed site: production rows have no `frame_id` until the next snapshot.

## Open issues
- No backfill: `raw_json` never kept `frame_url`, so frames appear from the first snapshot after the deploy (the next Saturday's Before, or a manual round).
- Frames change only with event snapshots. The daily read (D60) stores no photos or frames. Storing frames there would need a frame array in `daily_rosters` and a "newest frame for this uid" lookup. Owner's call.
- `CLAUDE.md`'s hard rule lists the photo and badges as reaching pages only through their image routes; frames follow the same rule (`/img/frame/[id]`, D65), but the line does not name them. Edit only if the owner asks.
- Frames are not in the Discord event picture or the link preview.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` (the preview build applies migration 0015 to the preview branch), then release. The release runs 0015 on production. Run a manual round or wait for Saturday's Before to see frames on the live site.
Plan changes needed: none.

<adjustments>
- `PlayerAvatar` takes `photo: Photo` (`{ hasAvatar, frameId }`) from `lib/queries`; queries add `...photoColumns` to a member select instead of writing `hasAvatar` by hand.
- `member_snapshots.frame_id` exists from migration 0015; `/img/frame/[id]` serves any numeric frame id.
</adjustments>
