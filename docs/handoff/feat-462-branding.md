# feat/462-branding: Workspace branding

## Built

- Alliance settings → Branding card (`app/(private)/_ui/BrandingCard.tsx`), officers only, one Save row:
  - tab title (default `[TAG] Desk`, at most 40 characters, plain text, cleaned);
  - icon: alliance badge (default), Discord server icon, desk mark; no uploads;
  - accent: 6 curated colours (`burgundy`, `indigo`, `teal`, `forest`, `umber`, `slate`) with a header preview.
- `POST /api/w/[slug]/branding` (`requireWorkspace`, same origin, rate limited 30 per 15 minutes).
- Storage: `workspaces.brand_title`, `brand_icon`, `brand_accent`, `discord_icon_hash` (migration `0095_branding`, highest on origin/dev was 0094).
- Applies to:
  - page metadata title and icons, header band colour (`data-accent` on the `/w/[slug]` layout wrapper, `[data-accent]` rules in `lib/brand/tokens.css`), a 32 px icon in the signed-in header;
  - the per-workspace manifest (D110): name, short name, icons, theme colour;
  - webhook messages (`username` and `avatar_url`): notices, thanks, garrison, catalog and welcome posts, `/join` note, test message, Raid Shield summary.
- `GET /img/desk/[slug]?size=192|512`: serves the badge or the Discord server icon from our own origin. The Discord icon is fetched server side, redirects refused, never redirected to the client. The icon hash is read through the bot on Save and on every "Check".
- Copy in EN, PT-BR, FR (`lib/private/dictionary.branding.ts`).
- Decision D167; amendments appended to D22 and D110.

## Decisions

- Accent changes `--burgundy` only (header band and the preview swatches), as the owner's "header band and accents only".
- The accent CSS lives in `lib/brand/tokens.css` (only file allowed colour literals); `accentColor()` in `lib/brand/palette.ts` reads it for the manifest and the contrast test.
- Values equal to the defaults are stored as null, so the title follows the alliance's tag.
- Branding is public to read (title, icon choice, colour id) so the manifest and tab icon need no session. Only the write needs the officer session.
- The Discord icon is read when saving the choice (refused with `no_discord_icon` when none), so the card never keeps a choice that cannot render.
- Webhook name: the title, unless it contains "clyde" or "discord" (Discord refuses such names); then only the avatar is set.
- `/img/desk/[slug]` also serves the badge at 192/512 px because an installed app needs those sizes; the header and tab use the same route.
- Layout and frame each read the branding (one small query on the request connection; no shared cache, issue 471): `app/(private)/_ui/desk-branding.ts`.
- Architecture zones: the read lives in `lib/repo/workspace-branding.ts` and the pure rules in `lib/workspace-branding.ts`, because `app/img` and `lib/shield-post.ts` may not import `lib/private`.

## Deviations

- The owner's 2026-11-20 comment says webhook messages post as `[TAG] Desk` with the icon as avatar. The avatar URL needs our own origin; routes pass the request origin and the Raid Shield tick passes its own. The daily catalog job (`lib/private/catalog-posts.ts`) and the welcome post (`lib/private/join-requests.ts`) have no request address, so they post the name only.
- No analytics event for the save (`ws_action` lists are closed; not asked).
- Board pages keep their own `<title>` ("Members' board", "Your page"); they set one of their own, which overrides the layout's.

## Verified

- `pnpm vitest related --run <changed files>`: one expected failure (the discord route test now sees the webhook `look`), fixed.
- `pnpm check` (prettier, eslint, tsc, vitest 436 files / 2398 tests, drift, i18n): passes.
- New tests: accent contrast in light and dark, title cleaned and capped, manifest follows the setting, `/img/desk` never redirects to Discord's CDN, another workspace's officer and a member cannot save, webhook look on posts; the D105 fixture for the new route.
- Not run: a production build or a browser (see Open issues).

## Review round

- Webhook look only once a title or icon was saved; a workspace that never saved posts as before (D167 note, tests updated).
- Icon URL carries `v=<choice>-<badge id or hash>`; CDN fetch at 256 or 512 px, downscaled; manifest falls back to defaults if the read throws; `botIn` reused; a title over 80 code points or naming clyde/discord drops `username`; zod raw bound 1000.
- `deskBranding` uses React `cache` in `lib/desk-branding.ts`, outside the folders the issue 471 test scans (the cache lasts one request).
- UX: accent swatches and preview always carry their own `data-accent` (burgundy rules restored in tokens.css); the preview shows a tab strip and the real header (desk name, alliance line) above the Icon group; Save is off while the title is too long; refusal clears on change; own saved line; teal dark value changed to #236569 and the contrast test covers the 90 % subtitle; save limit 60 per 15 minutes.
- Tests added: Check keeps and clears the icon hash, malformed hash or guild id fetches nothing, shield summary look.

## Open issues

- Not checked in a real browser: the layout's `icons` replacing the root `app/icon.tsx` link in the rendered head, and a real Discord avatar fetch. Check the head of `/w/<slug>` once on dev.
- Catalog and welcome posts carry no avatar until a site address is available to them (see Deviations).
- The Discord icon hash is refreshed only on Save and on "Check"; a server icon changed later shows after the next Check or Save, and the icon route is cached 1 hour.
- Migration number 0095: a PR for #285 was said to run in parallel; origin/dev had no 0095 when this was cut. If it lands one first, renumber this one.

## Next

- Site address setting (env) so every webhook post carries the avatar.
- Patch notes entry in `lib/patch-notes.ts` at the next release-prepare.
- Guide screenshot of the new card, per the standing rule on workflow changes.

What was missing from the task prompt? Whether the header should show the title or the icon only; I kept the desk's name in the header and added the icon beside it.

PR: (added by the orchestrator)
