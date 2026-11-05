# 07e — Brand guidelines page

## Built
- `app/(pages)/brand/page.tsx`: `/brand` is now a brand-guidelines page with an in-page nav (Logo · Colour · Type · Drawing · Components · Voice) and one section per topic. It replaces the Session 7 catalogue. Header (waxed logo, theme switch, lace) and footer (byline, yarn corner) are kept.
- `app/(pages)/brand/parts.tsx`: shared pieces: `Section` (anchor id, title, lede, drawn rule), `Sub`, `Spec` (specimen plate, name, when to use), `Verdict` (do/don't with icon, word and colour), `Rules`.
- `app/(pages)/brand/LogoSection.tsx`: `MarkLine`, `WaxedMark` in the three wax tones, solid `Mark`; clear space diagram; minimum sizes (line mark at 24/32/48 px, solid at 16/24/32 px); 3 correct and 4 incorrect uses rendered with the real components (stretched, rotated, yarn colour, line mark at 14 px).
- `app/(pages)/brand/ColourSection.tsx`: the seven tokens, each with name, `--token`, role, and light and dark value with a swatch. Values come from `tokenColor()` at render time; no colour literal in `app/`.
- `app/(pages)/brand/TypeSection.tsx`: the three families with role, and the eight-step scale (sample in the real classes, token name, size / line height, family, use).
- `app/(pages)/brand/DrawingSection.tsx`: the confident-nib rules from `docs/brand/DRAWING.md`, then the three vignettes, the two Granny Doctor poses, the wax and the hourglass as examples.
- `app/(pages)/brand/ComponentsSection.tsx`: primary, secondary and seal buttons, the four chip tones, the badge, a text field and a select (`.drawn-field`), the checkbox (`.drawn-check`), the drawn rule, the lace, the yarn corner, each with when to use it.
- `app/(pages)/brand/VoiceSection.tsx`: DESIGN.md "Voice" as rules, the site's own state lines as samples (read from `copy.empty` / `copy.errors`), two do/don't pairs.
- `lib/brand/palette.ts`: `tokenColor(name, mode = "light")` reads the light `:root` block or the dark `:root[data-theme="dark"]` block of `tokens.css`; exports `TOKENS`, `Token`, `Mode`. Existing callers (`icon.tsx`, `opengraph-image.tsx`, `manifest.ts`) are unchanged.
- `lib/copy.ts`: `copy.brand` rewritten for the guidelines page (nested by section). All page text is there; components hold none.
- Screenshots: `docs/screenshots/07e-brand-{360,1280}-{light,dark}.png` (full page).

## Decisions
- Indexing: the page stays `noindex` and is not linked from the site (owner, 2026-11-04).
- Branch first cut from `session/07-brand`, because PR #28 was still open (owner chose: build now, open the PR into `dev` after #28 is merged). #28 was merged during the session; the commit was rebased onto `dev` (`git rebase --onto origin/dev origin/session/07-brand`) and `pnpm check` re-run there. The force-push was refused by the session's permission check, so the rebased work is on `session/07e-brand-guidelines-dev` (owner's choice); `session/07e-brand-guidelines` on the remote is the stale pre-rebase copy and can be deleted.
- Session label 7e: this session is not in the playbook map; 7b–7d are taken, so it takes the next free letter.
- Clear space: a quarter of the mark's width on every side; in wax, the seal is the clear space. DESIGN.md defines no clear space; this is the value the page shows.
- Minimum sizes: line mark ≥ 24 px and solid mark 16–32 px, as the task states.
- "Don't" uses the dropped-stitch icon in seal, "Do" the stitched check in ink: the same icon vocabulary as the status chips, so each verdict has icon, word and colour.
- Type-scale weights are taken from DESIGN.md's front matter and the loaded fonts (Young Serif 400, Alegreya Sans 700), not from the "Weight 600" column of DESIGN.md's Typography table.
- Token names (`--paper`, `display-xl`) are set in Source Sans 3, not monospace: DESIGN.md allows no fourth typeface.
- The Teacup vignette is shown as "spare": no page uses it (the empty state uses `GrannyTea`).
- Screenshots: headless Chrome driven through the DevTools protocol (a script in the session scratchpad, Node's built-in WebSocket, not committed) at widths 360 and 1280, with the `theme` cookie and `prefers-color-scheme` set per mode.

## Deviations
- The sample ledger row and the stand-alone "Snapshot status" block of the Session 7 catalogue are gone. The chips now sit under Components. The ledger row is the subject of Session 7b's row work and is not a brand piece.
- The footer gets a `drawn-rule` on top, as DESIGN.md "drawn-rule" says for footers.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest — 19 files passed (1 skipped), 75 tests passed (1 skipped). `lib/brand/tokens.test.ts` passes: no colour literal in `app/`.
- `next dev` with the main checkout's `.env.local` linked: `/brand` returns the page, `<title>` "Brand guidelines · OG's LAP Tracker", `<meta name="robots" content="noindex">`.
- `scrollWidth` equals the viewport at 360 (360) and 1280 (1280), light and dark (from the screenshot script).
- In the browser at 1280: scrolling `#logo` into view puts its title below the sticky header (`scroll-mt-20`). The nav links were not clicked one by one. In both screenshots the colour table shows the same light and dark values, so a swatch does not follow the page theme.
- Not verified: `/brand` on Vercel. The root layout calls `connection()`, so the page renders per request and reads `lib/brand/tokens.css` with `fs` at request time. Next's output tracing should include the file (`join(process.cwd(), "lib/brand/tokens.css")`); check `/brand` on the first preview, together with the `/icon` check Session 7 already asked for.

## Open issues
- DESIGN.md "Mark" says `MarkLine` is for "96 px and up"; the header uses it at 32 px (owner) and this page states ≥ 24 px (task). DESIGN.md also has no clear-space rule. The owner should record both in DESIGN.md "Mark" so the contract and the page agree.
- DESIGN.md "Typography" table lists weight 600 for the four display steps; the front matter and the loaded fonts say 400 (Young Serif) and 700 (Alegreya Sans). Pre-existing; not changed here.
- `lib/brand/tokens.css`: the `prefers-color-scheme: dark` block declares `--frame-field`, `--check-mark` and `--select-arrow` twice. Pre-existing and harmless (the second wins with the same value); not changed here.

## Next
Session: 7b — Usability and language-light pass
Model / effort: keep — no signal from this session; its work was page layout, not the language-light work 7b does.
Owner must do first: merge this session's PR into `dev`.
Plan changes needed: none. DESIGN.md "Mark" needs the clear-space and minimum-size lines (see Open issues); that is DESIGN.md, not the plan.

<adjustments>
- `lib/copy.ts` is 255 lines; eslint `max-lines` is 300 (blank lines and comments skipped). Moving the Session 6/6b strings in will exceed it. `copy.brand` is about 220 of those lines and is used only by `app/(pages)/brand/*`; moving it to its own module (re-exported from `lib/copy.ts`) keeps one import path and frees the room.
- `copy.brand` is now nested by section (`logo`, `colour`, `type`, `drawing`, `components`, `voice`) and still needs no persona test; the blank-dictionary mode covers it like any other key.
- The 7b grep test for string props longer than two words must skip `className`; `/brand` passes every text through `copy` already, and its only literals are sample times (`12:01`, `16:01`) and `--`/`·` punctuation.
- `tokenColor(name, "dark")` exists in `lib/brand/palette.ts` if 7b needs a dark value outside CSS.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/29
