# 07 — Player photos and alliance badges

An inserted session (branch `session/07c-photos-badges`, cut from `session/07-brand`, then merged with `dev` after PR #28). The file is named `07-photos-badges` so it does not clash with the playbook's Session 7c (`07c-ui-review.md`).

## Built

- `CLAUDE.md` — hard-rule line edited at the owner's request (2026-11-05): `avatar_url` is stored but never returned or logged; photos reach pages only through `/img/avatar/[uid]`, badges only through `/img/badge/[id]`.
- `lib/raw-json.ts` — keeps `badge_url` and `members[].avatar_url`; still drops `server_badge_url`, `frame_url`, bulletin, declaration, quota.
- `lib/schema.ts`, `drizzle/0003_white_power_man.sql` — nullable `alliance_snapshots.badge_id` (integer) and `member_snapshots.avatar_url` (text).
- `lib/sources/shared.ts` — optional `badge_id` and `members[].avatar_url` in the shared roster schema; `photoUrl()` keeps a URL only when it is plain https on `phs-image.globallap.com`.
- `lib/sources/types.ts`, `lib/repo/index.ts`, `lib/collector.ts` — `badgeId` on the snapshot input and alliance row, `avatarUrl` on members.
- `lib/repo/alliance-snapshots.ts` — `findAvatarUrl(db, uid)`: the newest roster row's stored URL.
- `lib/images.ts` — badge and photo sources, `fetchImage` (5 s timeout, `redirect: "error"`, 1 MB cap, raster types only), cache headers, bodyless 404.
- `app/img/badge/[id]/route.ts`, `app/img/avatar/[uid]/route.ts` (+ one test each).
- `proxy.ts` — `/img/*` gets the deny-all CSP that `/api/*` has.
- `lib/queries/{alliances,events,players}.ts` — return `badgeId` and `hasAvatar`, never a URL.
- `app/_ui/Pictures.tsx` — `AllianceBadge`, `PlayerAvatar`, both in the soft drawn frame, lazy, `alt=""`.
- `lib/brand/components/Placeholders.tsx` — `NoPhoto` (the Granny Doctor in profile: bun with a knitting needle, beak mask with seam, goggle and strap) and `NoBadge` (a crocheted banner: scalloped hem with eyelets, picots, a granny square). Generator: `docs/brand/drawing/examples/ornaments.py` `no_photo`, `no_badge`, registered in `build.py`.
- Pages: badge beside every tag on the main page rows/cards, the alliance title and totals row, the player page's current alliance and alliance timeline; photo on member rows and beside the player page title.
- `app/_ui/StatTable.tsx` — `icon` slot before the lead; cards below 640 px carry `stat-card` (soft drawn frame, `app/globals.css`); the search results too.
- `app/_ui/SiteHeader.tsx`, `lib/brand/components/ThemeSwitch.tsx` — Players, event selector and theme switch in the soft drawn frame (the selector's plain border is gone).
- `app/_ui/Status.tsx`, `app/_ui/EventView.tsx` — chips now read "Last updated: done at Oct 31 16:01 UTC" / "Updating now" / "Not updated yet" and "Next update scheduled at …"; the "Last sync / Next sync" sentences are removed (the chips say the same). `relative()` and `utcClock()` in `app/_ui/format.ts` were left unused and are deleted.
- `scripts/seed-data.ts`, `scripts/seed.ts` — badges and photos from the fixtures; alliance 4 (WACK) seeded without a badge, marked fake.
- Docs: `docs/DECISIONS.md` D22, `docs/DESIGN.md` components `alliance-badge` and `avatar`, `docs/ARCHITECTURE.md` (`app/img/*`, `lib/images.ts`, `app → lib/images`).
- Screenshots: `docs/screenshots/07-photos-{main,alliance,player,player-nophoto}-{360,1280}-{light,dark}.png`.

## Decisions

- **Own routes, not `next/image` `remotePatterns`.** `next/image` writes the upstream URL into the page (`/_next/image?url=…`), which the rule forbids, and bills image optimisation per source image (~2,000 photos). The route serves the original bytes and Vercel's CDN caches them (`s-maxage`).
- **Badge origin comes from `LAP_SITE_BASE_URL`**, not a literal: `lib/sources/no-upstream-literals.test.ts` allows the upstream host only in `lib/env.ts`. Confirmed with one plain GET (our User-Agent, no Origin/Referer/cookies): `https://lastasylumtracker.com/static/alliance/badge_110.png` → 200 `image/png`, 300×300, 33,049 bytes, Cloudflare `max-age=14400`.
- **What counts as a photo is decided at the adapter:** 1,048 of the 2,128 non-empty `avatar_url` values in the fixtures are the game's default heads, relative paths (`/static/avatars/head_90001.png` ×680, `head_90002.png` ×368). They are stored as null and get the drawn placeholder; showing them would mean serving game art and a second host. The avatar route re-checks the host at serve time.
- **The avatar route serves the newest stored URL for the uid**, so a player who drops their photo gets the placeholder from the next snapshot on. Cache: a day, `stale-while-revalidate` a week; a changed photo can show the old one for up to a day.
- **Failures are not logged.** Nothing to redact and no URL can leak; the 404 is cached 5 minutes so a broken upstream is not hammered.
- **Raster only** (png, jpeg, webp, gif, avif): an SVG served from our origin could carry script.
- **Photos and badges are content, not ornament**, so DESIGN.md's ornament budget ("never on cards") does not apply to them; their placeholders go where they would.
- **Frames on cards only below 640 px:** the owner asked for the drawn frame on cards; DESIGN.md keeps the ≥ 640 px table on plain 1 px rules, so the frame is scoped to the card layout.
- **Search results** keep text only (no badge or photo): the task named the main, alliance and player pages.

## Deviations

- Plan §196 (raw_json trimming) changed for `badge_url` and `avatar_url`; recorded in D22, plan not edited.
- Plan §12.3: the page CSP is unchanged (`img-src 'self' data: blob:`); `/img/*` now also gets the API's deny-all CSP.
- CLAUDE.md was edited by the agent, at the owner's explicit request in chat ("please edit it for me and carry on"), not by the owner.
- Beyond the brief, at the owner's request during the session: the two drawn placeholders (owner approved the banner, then the profile Granny Doctor after one redraw), the drawn frame on cards, badges and header controls, and the status-chip copy.
- The fixtures do not match the brief's "non-empty on 1,080 of 2,129": 2,128 are non-empty, 1,080 of them real photos (the rest default heads). The brief's count is the real-photo count.

## Verified

- `pnpm check` → prettier clean, eslint clean, `tsc --noEmit` clean, `Test Files 21 passed | 1 skipped (22)`, `Tests 77 passed | 1 skipped (78)`.
- `app/img/avatar/[uid]/route.test.ts`: a stored `https://phs-image.globallap.com/…` URL is fetched once (200); `https://evil.example/…`, `https://phs-image.globallap.com.evil.example/…`, `http://phs-image…` and `https://phs-image…:8443/…` all return an empty 404 and fetch is never called again.
- `app/img/badge/[id]/route.test.ts`: 101 and 110 fetch `<site origin>/static/alliance/badge_{id}.png`; `100`, `111`, `0`, `1101`, `abc`, `10a`, `-101` return an empty 404 without a fetch.
- `pnpm db:generate` → `drizzle/0003_white_power_man.sql` (two `ADD COLUMN`). The preview branch had 0003 applied by the Vercel preview build of the pushed branch (`db:migrate: nothing to apply (journal at 1793847262919)`, 0003's own timestamp).
- Owner ran `pnpm db:seed -- --reset` on the Neon preview branch (the agent's run was blocked as a mass delete): `seeded 22 alliances × 3 events, 1 rehearsal`.
- `next dev` on the preview branch: `/` lists 22 rows, 21 with `/img/badge/<id>` and WACK with `NoBadge`; WACK's alliance page shows photos and placeholders on member rows; the player page shows the 56 px photo (`/players/339936739653`) or the Granny Doctor (`/players/340243734853`, a default head).
- Screenshots over the Chrome DevTools protocol with exact viewport and `prefers-color-scheme` (headless `--window-size=360` lays out wider than 360 and `--force-dark-mode` is ignored): `scrollWidth` equals the viewport on all 16 (360 and 1280). Alliance pages are cut at 3,000 px tall (full page 20,674 px at 360). The set mixes runs: the seed was re-run while some captures were being taken (the owner stopped the retakes), so a capture may show a page mid-reseed; retake with the CDP script when it matters.
- Drawings: `python3 -I docs/brand/drawing/build.py <scratch>` builds both; `no-photo.svg` 1,440 bytes, `no-badge.svg` 1,803 bytes; previews at 28–96 px on paper and dark.

## Open issues

- The alliance title still breaks mid-word at 360 px ("TheWa / ckyOnes"); Session 7's screenshot already broke "OldGrand / mas". The badge takes 52 px more of that line. 7b's `[TAG] Name` line and title work should fix it.
- Search results (`/players?q=`) show `tag · alliance name` without a badge or photo.
- The image routes log nothing. If the photo or badge host starts refusing us, the only sign is empty frames on the pages (an `<img alt="">` that gets a 404 renders nothing). A failure count on `/admin` would make it visible; not built.
- `hasAvatar` comes from the roster row shown; the route serves the newest row's URL. They differ only for a player whose photo changed between snapshots.
- `.claude/launch.json` (local dev server on port 3007) and the `.env.local` symlink are untracked and not committed.

## Next
Session: 7b — Usability and language-light pass
Model / effort: keep (opus · medium) — no signal against it; this session's work was routine except the drawings, which 7b does not need.
Owner must do first: merge this PR into `dev`; keep `.env.local` linked into the 7b worktree.
Plan changes needed: §196 (raw_json keeps `badge_url` and `members[].avatar_url`) and §12.1's blocked list (`avatar_url` is stored in a column now, still never returned) — recorded in DECISIONS D22, plan not edited. §12.3 unchanged.

<adjustments>
- Alliance badges and player photos are done: `AllianceBadge` and `PlayerAvatar` in `app/_ui/Pictures.tsx`, `StatRow.icon` in `StatTable`. Skip 07-brand's "build badges only if the plan change is approved" item. Put the badge before `[TAG] Name` wherever 7b writes that line (cards, rows, breadcrumbs, player page); search results have none yet.
- Queries return `badgeId` and `hasAvatar`; there is no URL to show and none may be added (CLAUDE.md, D22).
- The status strip is already "Last updated: <state> at <date time> UTC" and "Next update scheduled at <date time> UTC" (owner, 2026-11-05), not Before/After chips; the "Last sync / Next sync" prose is gone. 7b moves its words into `lib/copy.ts` and formats the dates, without bringing Before/After back.
- Cards below 640 px wear the soft drawn frame (`stat-card` in `app/globals.css`); the ≥ 640 px table keeps plain rules. Header controls are framed too.
- The 360 px alliance title breaks mid-word; the badge sits beside it. The `[TAG] Name` line should keep the tag and name from splitting inside a word.
- Full-page screenshots: drive Chrome over CDP (`Emulation.setDeviceMetricsOverride`, `Emulation.setEmulatedMedia` for dark); headless `--window-size=360` renders wider than 360 and `--force-dark-mode` does nothing here.
- Seed: alliance WACK (67110992) has no badge (fake, for the placeholder); 1,048 of 2,129 member rows have no photo (real default heads), e.g. `/players/340243734853`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/30
