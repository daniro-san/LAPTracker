# 08zzzq — Link previews show the alliance's badge and the player's photo

## Built
- `app/_ui/preview.ts` `previewImage(url, alt)`: `openGraph.images` and `twitter.images` set to one picture, `twitter:card summary` (a small square beside the title in Discord, not the large picture).
- `generateMetadata` of three pages adds it:
  - `/alliances/[unionId]/history`: `/img/badge/[badgeId]` when the history has a badge.
  - `/events/[id]/alliances/[unionId]`: `/img/badge/[badgeId]` of the alliance's newest phase row (After, else Before).
  - `/players/[uid]`: `/img/avatar/[uid]` when the player has a stored photo.
  - The alt text is the alliance label (`[TAG] Name`) or the player's name.
- A page without a badge or photo sets nothing, so it keeps the site's large preview (`app/opengraph-image.tsx`), as every other page does.
- `docs/DESIGN.md` (logo mark paragraph) and D22 (one dated bullet) say which pages use which picture.

## Decisions
- Option A, chosen by the owner: point the preview at the existing image routes, no new rendering. The rules for which picture show are the same as `AllianceBadge` / `PlayerAvatar` (`badgeId != null`, `hasAvatar`).
- A player without a photo keeps the site's preview, not the alliance badge: the owner asked for the player's photo.

## Deviations
- None.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (261 passed, 1 skipped), drift, i18n.
- `next build` + `next start` locally against the Neon preview branch (`.env.local` without webhooks), `curl` of the HTML:
  - `/alliances/67111155/history`: `og:image` and `twitter:image` `/img/badge/110`, `twitter:card summary`, alt `[OGs] OldGrandmas`.
  - `/players/341954486597`: `/img/avatar/341954486597`, `summary`, alt `ny21dvl`.
  - `/events/3/alliances/67109944`: `/img/badge/110`, `summary`, alt `[NSE] Natural Selection`.
  - `/`: unchanged, `/opengraph-image?…` 1200×630, `summary_large_image`. The page's picture replaces the root file-based one; the layout's other tags (title, description) are still there.
- With a `Discordbot/2.0` User-Agent: `/img/avatar/341954486597` 200 `image/jpeg` 180×180 (8 KB); `/img/badge/110` 200 `image/png` 80×80 (8 KB).
- Not checked: a real Discord embed. Discord caches the preview per URL, so links posted before the deploy keep the old picture.

## Open issues
- The badge route serves 80×80 (the size pages draw, 07c S11), so the Discord thumbnail (about 80 pt, 160–240 device px on a phone) may look soft. A larger fixed size for the preview would need a second size in `/img/badge/[id]` (no URL parameter, D22). Owner's call after seeing it in Discord.
- Avatar frames: the next change, on its own PR (owner, 2026-11-14).

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`. The owner's next request is avatar frames on every player photo (store `frame_url` once per distinct frame, not per player).
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release (minor: a new visible feature).
Plan changes needed: none.

<adjustments>
- Pages declare their own link preview with `previewImage()` from `app/_ui/preview.ts`; the root `app/opengraph-image.tsx` stays the fallback.
</adjustments>
