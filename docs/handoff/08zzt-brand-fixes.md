# 08zzt — Brand fixes (#173)

Applies the brand review in `docs/handoff/08zzs-brand-review.md` with the owner's decisions of 2026-11-10. Part of #173.

## Built

- H1: `site.name` is "Event Ledger", `site.shortName` is "Ledger" (`lib/copy.ts`). In the 17 dictionaries `site.name` is the word each one already uses after the dot in `site.ledger` (de "Event-Chronik", ru "Журнал событий", ja "イベント台帳", pt-BR "Registro de eventos", and so on) and `site.shortName` is the word `site.home` already uses (de "Chronik", ru "Журнал", ja "台帳"). Stamps refreshed. "Old Grandmas" is untouched. The admin layout title, the title doc comments, the Discord picture footer ("Event Ledger · Server 325") and the title fallback in `lib/event-image.tsx` ("Ledger") follow from copy. The 360 px header shows the short name beside the seal (`app/_ui/SiteHeader.tsx`); from 640 px it shows the full name, and the full name is screen-reader text below that. DESIGN.md Voice and `header`, and D48's "brand names stay" line, changed.
- H3 + M4: wax is pigment. `--wax-paper` #efe6d3, `--wax-seal` #8c2f2f, `--wax-ink-paper` #3b2436, `--wax-ink-seal` #efe6d3 in `lib/brand/tokens.css` (outside the theme blocks, registered as `wax-*` colours); `Wax.tsx` and `SealButton.tsx` use them. The yarn tone still follows the theme. The header seal presses the solid `Mark` at 24 px into the 40 px wax (`WaxedMark` has a `solid` prop). `/brand` shows the ivory wax with the solid cut (cuts specimen and the "Ivory wax on the header" tile), and its text about the exception changed. DESIGN.md Mark and `wax` changed.
- M2: `HourglassOutline` in `lib/brand/components/StatusIcons.tsx` (16 px, stroke 1.5, same `BASE` as the stitched check and dropped stitch). The three muted "not yet" chips in `app/_ui/Status.tsx` and the muted chip on `/brand` use it. The legend's `○ Stale` and the `○ n stale` count stay. DESIGN.md `status-strip` and `legend` changed.
- H1 residue (coordinator request): `site.disclaimer` opens with the product name in all 18 languages ("Event Ledger is a fan-made community project for the Last Asylum Plague game. ...", ru "Журнал событий — фанатский проект ...") instead of "OG's LAP event tracker"; the game name and "Old Grandmas" are untouched; stamps refreshed.
- M3: `errors.notFound.back` and `errors.server.back` are "Back to the ledger"; the 17 dictionaries use each language's ledger word in the same sentence frame (ru "Назад к журналу", ja "台帳に戻る", pt-BR "Voltar ao registro").
- M5: `/brand` type-scale samples are "Grandma noticed" (display-md) and "Members" (label); the Voice rule reads "Labels are the game's own words: Might, Kills, Members."; the Movers specimen says four tabs (Might ▲, Might ▼, Kills ▲, Rank ▲▼); the Voice lede reads "Short, dry, grandmotherly: written in English, read in 18 languages."; DESIGN.md Voice column list is Might, Kills, Members.
- M6: `app/opengraph-image.tsx` draws the mark at 340 px with "Event Ledger" under it in Young Serif 96 px, read from `lib/brand/fonts/YoungSerif-Regular.ttf`; the stale comment is replaced.
- L1: `admin.pinLocked` starts with "Locked: PIN entry is off for an hour: {n} wrong PINs." (no emoji). `lib/notify.test.ts` and `app/api/snapshot/route.test.ts` assert the new text.
- M1: DESIGN.md Overview ("yarn marks gains, bronze in daylight and gold by lamplight") and Colors (Yarn). No token change.
- H2 mocks only, code unchanged: `docs/screenshots/08zzt-h2-option-{a,b}-{ru-404,ru-home,vi-home,ja-home}-360-light.png`.
- Screenshots in `docs/screenshots/08zzt-*` (about 2.4 MB): `h1-header-360-{light,dark}` (3×), `h1-header-360-{de,pt-BR,ja,ru}-{closed,open}`, `h3-header-1x-360-{light,dark}`, `h3-seal-options-{1x,3x}-{light,dark}` (current, solid 24 in 40, solid 26 in 40, line 28 in 44), `h3-brand-logo-1280-{light,dark}`, `h3-m4-brand-components-1280-dark`, `m2-status-360-{light,dark}`, `m6-opengraph-image`. The "before" captures are the `08zzs-brand-*` files from the review.

## Decisions

- Header seal: option (a), the solid `Mark` at 24 px in the 40 px seal. At 1× (`08zzt-h3-seal-options-1x-*.png`) the hat brim, the beak and the cowl read as a head; option (b), the line mark at 28 px in a 44 px seal, is still a scribble at 1× and costs 4 px of header width that the wordmark needs. At 3× both read. A 26 px solid mark touches the pressed ring, so 24 px (0.6 of the seal).
- Wordmark below 640 px is `shortName`, not the full name: the full names ("Registro de eventos", "Журнал событий") need 150 px or more and the three controls leave about 80 px at 360 px. This is how `shortName` ends up in the header; it is also the manifest `short_name`.
- The wordmark is 18 px (`text-lg`, tight tracking) below 420 px and `display-sm` (20 px) from 420 px. At 20 px in pt-BR it overlapped the selector. To fit the row at 360 px I also took the header side padding from 16 to 12 px, the gaps between controls from 8 to 6 px and the selector's side padding from 12 to 8 px, all below 640 px.
- Wax tokens are plain `:root` variables, with no dark override, because wax does not change with the theme.
- Yarn wax tone keeps the theme colour and paper ink (unused in the app, shown on `/brand`).
- M3 and H1 translations were written directly (17 one-line edits each, reusing each dictionary's existing ledger word) instead of dispatching one translator subagent per language, then stamped with `pnpm i18n:stamp`. The glossary files were not touched.
- L1 wording: "Locked: PIN entry is off for an hour" rather than "Locked: PIN entry is locked", to avoid saying the word twice.
- The `/brand` Cuts specimen shows the ivory seal with the solid cut and the red and gold seals with the line cut.

## Deviations

- Items 1 to 3 are one commit because they share `SiteHeader.tsx`, `Logo.tsx` and DESIGN.md.
- The wordmark is 18 px, not `display-sm`, below 420 px (see Decisions).
- The `/admin` seal buttons were not screenshotted (it needs the PIN). M4 is shown by the seal-button specimen on `/brand` in dark (`08zzt-h3-m4-brand-components-1280-dark.png`) and by `Wax.tsx` using the fixed tokens.
- The header was checked at 360 px with the event selector closed and open in de, pt-BR, ja and ru, light and dark mixed (see file names), and the closed header in all 18 languages by measurement. 320 px was measured too: pt-BR and uk overlap there by 1 to 3 px; 320 px is outside the design width.

## Verified

- `pnpm check` green after the last code change (prettier, eslint, tsc, vitest 228 passed, drift, i18n 17 languages current).
- `pnpm build` and `pnpm start -p 3174` with the main checkout's env file (copied, gitignored, never printed). Reads only: no upstream call, no `/api/quota`, no Discord message. Server stopped.
- At 360 px on the production build in all 18 languages: `scrollWidth` equals the viewport width and the gap between the wordmark and the search box is at least 3 px (pt-BR; next tightest uk 19 px, de 21 px). In the 17 header captures no header link, summary or button is under 44 px in either dimension.
- The opengraph image renders at 1200 × 630 with the name (`08zzt-m6-opengraph-image.png`).
- Not verified: Android and Windows fonts for the wordmark; the Discord picture with the new footer (the footer is copy-driven; no picture was rendered or sent).

## Open issues

- H2 is open: the owner picks option a or b (below). Both use Alegreya 400 loaded by `next/font` with the latin, latin-ext, cyrillic, cyrillic-ext, vietnamese and greek subsets, and the fallback stack `"Hiragino Mincho ProN", "Songti SC", "Noto Serif CJK SC", "Noto Serif Thai", serif`.
  - Option a: Alegreya 400 replaces Young Serif as the display face in all languages. Three families stay three. The Latin titles lose Young Serif's solid, even stroke. See `08zzt-h2-option-a-*`.
  - Option b: Young Serif for Latin, Alegreya 400 for Cyrillic and Vietnamese through the font stack (Young Serif ships only the latin subset, so the browser falls to Alegreya per glyph). Four families, and ru and vi titles mix Young Serif digits and dots with Alegreya letters (visible in `08zzt-h2-option-b-ru-home-360-light.png`). See `08zzt-h2-option-b-*`.
  - Either way DESIGN.md Typography and D48 Fonts change in the same commit as the code.
- The Discord webhook names are set in Discord by the owner: "KvK Scout" and "LAP Tracker Admin" still carry the old name. Suggested: rename to the Event Ledger persona (for example "Event Ledger" for the public one and "Event Ledger Admin" for the admin one). Not changed by this PR.
- `docs/screenshots` is 95 MB in total; the 08zzt set is about 2.4 MB.
- Follow-up, not done: the manifest and `<title>` of `/brand` and `/admin` are English by D48; the README and GLOSSARY still say "LAPTracker".

## Next

Session: #174, the UX review (read-only, docs-only; its prompt is GitHub issue #174; `docs/SESSION_PLAYBOOK.md` has no entry for it).

Model / effort: keep. The review method ran in 08zzs without a retry and this session's measurements (overflow, 44 px targets) used the same scripts.

Owner must do first: merge this PR into `dev`; pick H2 option a or b (a follow-up session applies it with DESIGN.md Typography and D48 Fonts); rename the two Discord webhooks in Discord.

Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`. DESIGN.md Typography and D48 Fonts change when H2 is applied.

<adjustments>
- Settled for #174, do not reopen: the product name "Event Ledger" (maker line "kept by the Old Grandmas"); the 360 px header is seal (solid mark at 24 px in 40 px wax), short wordmark, search, event selector, settings; wax is ivory or red in both themes; "not yet" chips carry the unfilled hourglass and `○` means stale only; the 404 and 500 buttons say "Back to the ledger".
- The header row at 360 px is full: the tightest language (pt-BR) has 3 px between the wordmark and the search box. Any proposal to add a header control or lengthen the selector text has to remove something.
- Still pending for #174 to design around: H2 (the display face in ru, uk, vi, CJK and Thai).
- Handed over from 08zzs and not touched here: L3 (settings panel density), L4 (admin date order), the 18,806 px alliance page, the status strip's four lines at 360 px.
- Reusable: `/brand` now has the unfilled hourglass, the solid-cut ivory seal and the fixed-wax seal button, for reference screenshots.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/207
