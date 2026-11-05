# 07 — Branding

## Built
- `lib/brand/tokens.css`: DESIGN.md colours (light and dark), type scale (`display-xl` added), spacing, radius and the sheet shadow, mapped into the Tailwind theme. Dark follows the system unless `data-theme` on `<html>` says otherwise. It is the only file with colour literals.
- `lib/brand/tokens.test.ts`: fails on any colour literal in `app/` or `lib/brand/components/`.
- `lib/brand/fonts.ts`: Cormorant Garamond 600 and Source Sans 3 400/500/600 via `next/font/google`, on `<html>` in `app/layout.tsx`.
- `lib/brand/components/`: `Logo` (mark + wordmark), `LaceBorder`, `YarnCorner`, `SealButton`, `StatusIcons` (hourglass, stitched check, dropped-stitch ladder), `ThemeSwitch`, `Vignettes` (yarn ball left behind, two-piece cracked bottle, teacup).
- `lib/brand/theme.ts` (reads the `theme` cookie) and `lib/brand/palette.ts` (reads light-mode token values out of `tokens.css` for the raster images and the manifest).
- `lib/copy.ts`: created; holds every string added in this session (site name, byline, theme switch label, error pages, empty state, brand sheet).
- `/brand`: static brand sheet (noindex): mark at 200 and 24 px, palette, both typefaces, lace border, yarn corner, seal button, status chips, one ledger row.
- Applied to the Session 6/6b pages: plum header with the mark (32 px), wordmark from 640 px, Players link, event selector, theme switch and the lace border; display serif on every heading; every zinc/emerald/red/amber class mapped to tokens (admin pages included, colours only); status chips with the three stitched icons; `SiteFooter` with the byline and the page's one yarn corner; `EmptyState` (teacup + one display-sm line) on the no-events page and empty tables.
- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` on a shared `app/_ui/ErrorPage.tsx`: the message is set large (`display-xl`), the vignette is a small detail beside it, one keyframe loop each (`granny-sway` / `granny-rock` in `globals.css`, off under `prefers-reduced-motion`), Retry calls `reset()`, the error is never rendered.
- `app/error.test.ts`: renders `error.tsx` with an error carrying a message, digest and stack and asserts none of that text is in the markup.
- `app/icon.tsx` (32, 192, 512 px at `/icon/{size}`), `app/opengraph-image.tsx` (1200×630), `app/manifest.ts` (`/manifest.webmanifest`, icons 192/512).
- `docs/brand/granny-doctor-bust.svg`: the bonnet bust drawn as a mark candidate, kept for a later mascot.
- Screenshots: `docs/screenshots/07-brand-*`, `07-{main,alliance,player,search}-{360,1280}-{light,dark}`, `07-{404,500}-360-{light,dark}`.

## Decisions
- Header controls (Players, event selector, theme switch) get a paper tint on hover, deeper while pressed or open; the selector arrow flips while open; the current event and the Players link on player pages carry `aria-current` and a tint (owner feedback: they looked tappable but did not respond).
- Error pages: below 640 px the vignette sits above the headline (beside it, a 48 px word broke mid-word); the footer leaves out its yarn corner there, so the vignette is the page's one ornament.
- Owner, at the mock (2026-11-04): mark B (plague doctor under a wide brim, yarn ball and needles in the hatband); colours kept as in the contract; a light/dark switch added; the mascot deferred in favour of objects; the 500 line "It's okay, grandma will clean it." DESIGN.md records each of these.
- Theme choice lives in a `theme` cookie, so the server renders `data-theme` and the first paint is right without an inline script (the CSP forbids one). The switch draws both icons and CSS shows the right one, so it needs no server prop.
- The Tailwind `dark:` variant is redefined in `globals.css` to follow `data-theme` first and the system second, so the Session 6 pages follow the switch too.
- Muted text is `text-ink/70` (5.7:1 light, 7.2:1 dark); DESIGN.md has no muted token and this keeps it at one colour.
- "Data up to date" is ink, not yarn: yarn means gains.
- Below 640 px the wordmark is screen-reader only; mark, Players, event selector and theme switch fill 360 px.
- `global-error.tsx` reuses the 500 vignette and copy; "one illustration each" read as one per page, not three different drawings.
- Icons and the manifest read colours from `tokens.css` at build time (`lib/brand/palette.ts`) rather than repeating hex values.
- The Open Graph image is the mark only: the display serif is not available to the image renderer, and the link preview carries the title.

## Deviations
- Components live in `lib/brand/components/` (DESIGN.md "Enforcement" names that folder), not `lib/brand/` as Phase 5b says.
- Error-page headline uses a new `display-xl` (48 px) instead of `display-lg`: the owner asked for the message to be the focus. Added to DESIGN.md.
- No mascot: two rounds of Granny Doctor poses (single colour, then 2.5D chibi) were rejected; the vignettes replace them (DESIGN.md "Mascot" says so).
- 404 copy: "Back to the table" without the arrow from Phase 5b's sample copy (DESIGN.md "Do's and Don'ts" has no arrows in copy).
- Admin pages got token colours only. The seal button is not on the admin Run/Rehearse actions: the task named main, alliance, player and search.
- New screenshots are named `07-*`; the `06-*` / `06b-*` files are left as the before record. 390 px was not re-taken (the task asked for 360 and 1280).

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest — 19 files passed (1 skipped), 75 tests passed (1 skipped).
- `lib/brand/tokens.test.ts` fails when a hex literal is planted in `app/globals.css`; `app/error.test.ts` fails when `error.tsx` renders `error.message`. Both restored and green.
- `next dev` against the Neon preview branch after `pnpm db:seed -- --reset` (owner ran it): `/`, `/events/3/alliances/67111155`, `/players/339985801541`, `/players?q=so` return 200; `/no-such-page` returns 404 with the branded page. The 500 page was captured through a temporary route that threw (`app/(pages)/zz-boom`), deleted before commit. `scrollWidth` equals the viewport at 360 and 1280 on every page, light and dark.
- Theme switch in the browser: with no cookie it follows the system; one tap sets `data-theme` and `theme=light|dark`; a reload keeps the choice from the server render.
- `/icon/32`, `/icon/192`, `/icon/512`, `/opengraph-image` return PNGs; `/manifest.webmanifest` lists the 192/512 icons with paper/plum colours.
- No game assets in the repo: every SVG was drawn for this project; the owner's reference images stayed in the scratchpad and were used for genre only.
- Not verified: the error boundary in a real thrown render in the browser (covered by the unit test, not clicked); the reduced-motion switch-off by eye (the CSS rule is in place); a production build on Vercel.

## Open issues
- Light-mode contrast: yarn text on paper 2.15:1 and paper on sage 3.46:1 are under DESIGN.md's 4.5:1 rule. The owner accepted it; tracked in #25.
- Owner asked for per-viewer timezone and date-format settings: #26, #27.
- Owner feedback at review for Session 7b: the main table looks cluttered; wants a simple card first and the full metrics on tap; "About this data" is hard to see; dates should be formatted and "(14:00 UTC)" dropped from the event line; quota line off the public page. Listed in the adjustments below.
- Owner decision at review (2026-11-04): alliance badges may be shown — the owner considers them alliance-made emblems, as the reference tracker shows them. Not built here; see "Plan changes needed".
- `.claude/launch.json` (local dev-server helper with placeholder env values) is untracked and not committed.
- The Neon preview branch changed under the session once more: a capture taken while a reseed was running showed three alliances; re-taken after it finished.

## Next
Session: 7b — Usability and language-light pass
Model / effort: keep (opus · medium). This session's escalations were all illustration quality, which 7b does not need; its work is structure and copy.
Owner must do first: merge this PR into `dev`. Keep `.env.local` linked into the 7b worktree (`ln -s <main>/.env.local .env.local`) so `pnpm db:seed` and `next dev` reach the preview branch.
Plan changes needed: yes, for alliance badges (owner decision, 2026-11-04). IMPLEMENTATION_PLAN.md §196 (`raw_json` drops `badge_url` and `server_badge_url`) must keep `badge_url` and the collector must store it; §12.3's page CSP (`img-src 'self' data: blob:` in `proxy.ts`) must allow the badge host, or the app serves badges through its own image route; docs/DECISIONS.md needs the entry. Not edited here (CLAUDE.md: the owner changes the plan). Player `avatar_url` stays forbidden (CLAUDE.md hard rule).

<adjustments>
- `lib/copy.ts` exists with `site`, `errors`, `empty` and `brand` keys; move the Session 6/6b strings into it rather than creating a second module.
- The owner's review asks, in their words: alliance cards instead of the table or a less cluttered view; a simple view first and the full details on tap; "About this data" is overshadowed; format the dates; remove "(14:00 UTC)" from the event line (server time only). Build the 7b status strip and row shape to answer these.
- "Data requests left today: N" is still on the public event line; 7b's task already moves quota details to /admin.
- Header at 360 px: mark (32 px), Players, event selector and theme switch fill the width with the wordmark hidden. The 7b title "Server 325 · Saturday Ledger" and its byline will not fit beside them; put them under the header, not in it.
- Status chips already carry the stitched icons and a word; 7b only shortens the words.
- `EmptyState` (`app/_ui/EmptyState.tsx`) and `SiteFooter` exist; reuse them.
- Muted text is `text-ink/70`; delta colours are `text-yarn` / `text-seal`; links are `text-plum`.
- Owner wants alliances written the way the game writes them: `[NSE] Natural Selection`, `[OGs] OldGrandmas` — tag in brackets, then the name, on one line. Use it on cards, rows, breadcrumbs and the player page.
- Alliance badges: the owner allowed them (see this handoff's "Plan changes needed"). Build them in 7b only if the plan change is approved first; otherwise leave a square slot out and ship without.
- The blank-dictionary mode replaces `lib/copy.ts` values; the brand sheet strings live under `copy.brand` and need no persona test.
</adjustments>

<adjustments for="Session 8">
- The Discord `avatar_url` (plan Phase 6) can be `${APP_URL}/icon/512`, a 512 px PNG of the mark on plum generated by `app/icon.tsx`.
- The site name is "OG's LAP Tracker"; the plan's webhook `username: "LAPTracker"` may want to match it (owner's call).
- `app/icon.tsx`, `app/opengraph-image.tsx` and `app/manifest.ts` read `lib/brand/tokens.css` with `fs` at build time; check `/icon/192` and `/manifest.webmanifest` on the first Vercel preview.
</adjustments>
