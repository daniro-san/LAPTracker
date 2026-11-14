# 08zzzs — A player's link preview shows the photo in the avatar frame

## Built
- `GET /img/preview/player/[uid]` (`app/img/preview/player/[uid]/route.tsx`): reads the photo URL and `frame_id` of the player's newest roster row, fetches both (D22 fetch rules), and draws the photo into the frame's 240 px hole of a 380 × 380 PNG with `next/og`. `Cache-Control` is `AVATAR_CACHE` (one day, a week stale-while-revalidate).
  - No frame, a frame that fails to fetch, or a picture the renderer cannot decode: the photo alone, as fetched.
  - No photo or a bad uid: bodyless 404. A failed fetch logs one `image.fetch_failed` line, as the other image routes do.
- `/players/[uid]` `generateMetadata`: the preview image is `/img/preview/player/[uid]` (was `/img/avatar/[uid]`), still only when the player has a photo.
- `lib/repo/alliance-snapshots.ts`: `findAvatarUrl` → `findPhoto`, which returns `{ avatarUrl, frameId }` of the newest row. `/img/avatar/[uid]` uses its `avatarUrl`. `lib/images.ts` exports the `Image` type.
- Test: `app/img/preview/player/[uid]/route.test.ts` (a 380 × 380 PNG with a frame; the photo alone without one; fetch order and URLs).
- Docs: D65 (link preview bullet, "Not done" updated), D22 amendment, DESIGN.md logo paragraph.

## Decisions
- 380 px, twice the 190 px frame file, so a phone's Discord thumbnail stays sharp. The photo (180 px from the avatar host, or larger) is drawn at 240 px.
- The photo and frame come from the same row (the newest), so the preview never pairs a new photo with an old frame.
- A separate route rather than a size parameter on `/img/avatar/[uid]`: D22 rules out URL parameters on image routes.

## Deviations
- None.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (264 passed, 1 skipped; 1 new), drift, i18n.
- Local Postgres + fixture seed + `next dev`, with `LAP_SITE_BASE_URL` set to the real site for the frame PNGs; the API base URL was a dead address, so no quota was spent.
  - `/img/preview/player/339451289925` (frame 5010) and `/img/preview/player/339488760133` (5001): 200 `image/png`, 380 × 380, 238 KB and 174 KB, the photo in the hole as expected.
  - `/players/339451289925` `og:image` → `/img/preview/player/339451289925`.
- Not checked: a real Discord embed. Production rows get `frame_id` from the next snapshot (D65); until then the preview is the photo alone.

## Open issues
- The PNG is 170–240 KB, about 20× the plain photo. It is drawn once per player per day and cached by the CDN, so this seemed fine. A JPEG would be lighter, but `next/og` writes PNG only.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release (patch).
Plan changes needed: none.

<adjustments>
- `findPhoto(db, uid)` in `lib/repo/alliance-snapshots.ts` replaces `findAvatarUrl` and returns `{ avatarUrl, frameId }` of the newest row.
</adjustments>
