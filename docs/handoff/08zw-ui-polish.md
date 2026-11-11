# 08zw-ui-polish — issue 125

## Built

1. StatTable Lead (`app/_ui/StatTable.tsx`): the lead row is `items-baseline`, so the rank sits on the name's first line. The picture sits in a box one name line tall (`h-[1lh]`, `self-start`), so on a one-line lead the rank, picture and name share one centre line. The picture overflows that box and no longer gives the row its height, so the row `li` has `sm:min-h-11 sm:content-center` (review follow-up).
2. Breadcrumbs (`app/_ui/Breadcrumbs.tsx`): the `<ol>` is inline text with 44 px lines (`leading-11`), each `<li>` is inline, and each link is padded (`py-3`, and `px-3.5` with `-mx-3.5` so a short home crumb is 44 px wide without moving its text; review follow-up). A long alliance name now breaks inside the name. This changes all four callers: the player page, the alliance page, member history and the compare page.
3. Player history rows (`app/_ui/PlayerAcrossEvents.tsx`): `MoreBar` takes `inline="sm"`. From 640 px the stale mark and "Details ▾" sit in a sixth grid column on the row's first line (`sm:row-start-1`, last column), and the open panel spans the row. Below 640 px nothing changes. Each line's head starts in column 2 from 640 px (`sm:col-start-2`), so no line runs into the Details column. The change lines keep the percent under the change up to 768 px (`Delta` takes `stack="md"`; review follow-up). The CSS is `.stat-more-sm` in `app/globals.css`, under `@supports selector(::details-content)` and `min-width: 640px`. `MoreBar`'s `inline` prop is now `boolean | "sm"`.
4. Search row (`app/(pages)/players/page.tsx`): the literal `·` is gone and "SEEN <date>" is `whitespace-nowrap`.
5. Drawn frame without `-webkit-mask-box-image` (`app/globals.css`): the 1 px border fallback is replaced by a nine-slice built from eight standard `mask` layers. Each layer is a piece of `frame.svg` or `frame-soft.svg`, cut out with an `#svgView(viewBox(...))` fragment: four 12-unit corners drawn at 6 px and four edges stretched between them. It covers `.drawn-frame`, `.drawn-frame-soft` and `.stat-card` below 640 px.
6. Details panel (`app/_ui/DetailLines.tsx`): when there is no After, `DetailTable` gets `to={null}` and its head reads `—` with screen-reader text "No data" (the existing `copy.fresh.missing` string), with no arrow. The new `rankCell` shows one muted `—` in the Rank column when there is no rank, instead of `#— —`. The callers pass `null` when there is no After: the event table (`EventView.tsx`), the alliance Summary band and the player history rows.
7. Focus ring on the Details control (`app/globals.css`): `summary.details-bar:focus-visible:has(> .drawn-frame-soft)` drops the ring from the whole bar, and `summary.details-bar:focus-visible > .drawn-frame-soft` draws the plum 2 px ring, 2 px offset, around the framed control only. This applies to every Details bar: StatTable rows, player history rows, compare cards and the alliance Summary band. The `details-bar` class is on the `MoreBar` summary and on the Summary band's summary; other summaries keep the global ring (review follow-up).

DESIGN.md: updated the lines for focus ring, `stat-table`, `history-row`, `details-table`, `breadcrumbs` and `button-secondary` (the frame fallback). Two comments in `app/globals.css` that still described the 1 px border fallback now point to the mask block.

## Decisions

- Item 3 scope: only the player page's history rows changed. Compare cards and the alliance Summary band keep their full-width Details line. This is the triage comment's default reading; the owner did not answer it.
- Item 6 scope: only the After head and the Rank cell changed. With only a Before, the After column still repeats the Before figures (`app/_ui/event-rows.ts:57`). This is the triage comment's default reading; the owner did not answer it.
- Item 6: the row lead outside Details still reads `#— —` for an unranked alliance with no move. DESIGN.md says an unranked alliance reads `#—`, and the prompt says to keep the change inside the Details cell.
- Item 7: the ring is moved onto the framed control instead of being removed after a pointer press. After a click and then a key press, the ring now sits round "Details ▾" only. A keyboard user keeps a visible ring, and the whole bar is never framed.
- The `EventView.tsx` hunk is kept. Item 6 needs it: the owner's screenshot was of the event table, and `EventView.tsx` renders that table's Details panel.
- Started from the earlier attempt's patch (8 files, 140 insertions, 33 deletions). I read every hunk against the seven items and kept them all. The only additions are the two globals.css comments and DESIGN.md.
- Review follow-ups (after PR 225 merged, in the follow-up PR):
  - Item 3: at 640 px the 6.75rem Details column leaves each figure column about 73 px, and `▼ −2.11M (−6.3%)` ran into the Kills change. The percent now stays under the change up to 768 px, on the player history rows only (`stack="md"`). Item 3's placement from 640 px is kept. At 768 px a figure column is about 96 px; on dev before PR 225 the narrowest was about 94 px (at 640 px).
  - Item 1: one-line member rows were 42 px at 640 px and wider when there is no change line (only a Before). The row now has a 44 px minimum and centres its content; before PR 225 these rows were 49 px.
  - Item 2: the breadcrumb link gets 14 px of side padding with an equal negative margin. The hit area of two neighbouring crumbs overlaps over the `›`; the later crumb wins there.
  - Item 7: the two focus rules are scoped to `summary.details-bar`. Without the class they also matched the closed round's summary on `/admin`, whose direct child is a status chip.

## Deviations

- Firefox was not run. Playwright's Firefox 159 (build 1572, the one playwright-core 1.65 expects) stops at launch with "Could not find profile folder." macOS refuses to create `~/Library/Application Support/Firefox` ("Operation not permitted"), even outside the sandbox and with an explicit `-profile`. Setting HOME, XRE_PROFILE_PATH or a scratch TMPDIR did not help. The older build 1495 in the cache is missing `libmozglue.dylib`. So there are no Firefox screenshots, and item 5 has only a Chrome stand-in: Chrome with `-webkit-mask-box-image` turned off and the app's `@supports not (-webkit-mask-box-image: none)` block applied unconditionally. In that stand-in the eight-layer frame draws correctly (`docs/screenshots/08zw-frame-nineslice-chrome-sim-360.png`). It is not proven in Firefox. Firefox may read `url(file.svg#svgView(...))` in `mask-image` as a reference to an SVG `<mask>` element instead of as an image. If it does, frames in Firefox would be invisible instead of a 1 px border.
- The screenshots are Chrome only. The done_when asks for Chrome and Firefox.

## Verified

- `pnpm check`, run three times. Run 1 had 5 timeouts and run 2 had 1 timeout, all in files this change does not touch (`scripts/seed.test.ts`, `lib/event-image.test.ts`, `app/(pages)/admin/gate.test.ts`, `app/api/snapshot/route.test.ts`). The load average was 30–47 from other sessions. `pnpm exec vitest run "app/(pages)/admin/gate.test.ts"` alone: 6 passed. Run 3, after I stopped the dev server: exit 0. "All matched files use Prettier code style!", eslint and tsc clean, "Test Files 55 passed | 1 skipped (56)", "Tests 253 passed | 1 skipped (254)", drift "No schema changes, nothing to migrate", "i18n: 17 languages up to date with English".
- App: `next dev` on 3125 against a throwaway Postgres 18 on 127.0.0.1:54125, seeded with `--with-states` by the earlier attempt, through a WebSocket bridge on 54225. A preload refuses every fetch that is not to localhost. No upstream call, no /api/quota.
- Chrome 157.0.8103.51 (system Chrome, playwright-core in the scratchpad):
  - Breadcrumb link heights from `getClientRects()`, at 360 and at 1280, on `/players/339562357061`, `/events/3/alliances/67111657`, `/alliances/67111657/history` and `/events/compare?a=2&b=3&alliance=67111657`: every link is 46 px. At 360 the alliance page's `<ol>` is 88 px, two 44 px lines, and breaks as "…[HSR] Harmonie San. &" / "Reha".
  - Item 7: on a player history row at 1280 and on the alliance Summary band at 360, I clicked the summary and then pressed Shift. With this change's two rules removed from the CSSOM, the summary matched `:focus-visible` with outline `solid`, which framed the whole bar. With the rules in place, the summary outline is `none` and the ring is round the Details control only.
- Screenshots in `docs/screenshots/` (608 KB in total, each clipped to the region that matters): `08zw-player-{360,1280}`, `08zw-alliance-top-{360,1280}`, `08zw-alliance-across-{360,1280}`, `08zw-search-{360,1280}`, `08zw-details-before-only-{light,dark}-{360,1280}` (event 6, first row: the After head reads `—`, the Rank cell reads `—`), `08zw-details-both-{light,dark}-{360,1280}` (event 3, first row: `10:00 → 14:00`, `#1 =`), `08zw-focus-before-fix-360`, `08zw-focus-after-click-shift-360`, and `08zw-frame-nineslice-chrome-sim-360`.
- Review follow-ups, after PR 225 merged. `pnpm check`: exit 0. "All matched files use Prettier code style!", "Test Files 55 passed | 1 skipped (56)", "Tests 253 passed | 1 skipped (254)", "No schema changes, nothing to migrate", "i18n: 17 languages up to date with English". App: `pnpm dev:local` on 3125 against a throwaway Postgres on 127.0.0.1:54125 (`pnpm db:local:seed --with-states`), bridge on 54225; Chrome 157 through playwright-core. Before means dev at dddde30, after means this change:
  - Player history rows, `/players/339562357061`: smallest gap between two figures on one line. Before: −21.6 px at 640, −10.6 px at 700, 1.5 px at 767. After: 12 px at 640, 700 and 767; 1.7 px at 768 and 38.7 px at 1024 and 1280 (unchanged); 12 px at 360 and 639 (unchanged). Row heights at 640: 92 and 120 px before, 112 and 160 px after. No sideways scroll.
  - Member rows, `/events/6/alliances/67111657` (only a Before): 19 rows of 42 px at 640 px before; 44 px at 640 and at 1280 after. `/events/3/alliances/67111657` (61 px rows) and the cards at 360 px (150 px) are unchanged.
  - Breadcrumbs, all 17 languages plus English, the four pages, at 360 and 1280: every link is 46 px tall; the narrowest is 45.4 px wide (vi `Sổ`; ja `台帳` 60, zh-CN `账本` 60.6, ko `장부` 55.7, th `สมุด` 57.7, sv `Logg` 60.8, id `Buku` 63). The text starts where it did (16 px from the page edge at 360).
  - Focus: on a player history row at 1280 and on the alliance Summary band at 360, click then Shift: summary outline `none`, the Details control `solid 2px rgb(59, 36, 54)`. A summary without `details-bar` and with a `.drawn-frame-soft` child (the `/admin` closed round's shape, built in the page; `/admin` itself was not run): summary outline `solid 2px`, the chip has none.

## Open issues

- Item 5 is not verified in a real Firefox (see Deviations). Before merging, open any page with a framed button in Firefox. If no frame appears around "Details ▾" or the header buttons, restore the 1 px border fallback. The removed rules were `.drawn-frame, .drawn-frame-soft { border: 1px solid currentColor }` and `::before { display: none }` under `@supports not (-webkit-mask-box-image: none)`.
- Firefox cannot start on this Mac until `~/Library/Application Support/Firefox` can be created. That folder is under macOS privacy protection.
- Follow-up, not changed: the row lead of an unranked alliance with no move reads `#— —` (Rank plus RankMove) outside Details.
- Follow-up, not changed: with only a Before, the After column of the Details table repeats the Before figures (`app/_ui/event-rows.ts:57`).
- Follow-up, not changed: on the player history row with only a Before, Details shows `—` under the `10:00` head and the figures under the `—` head. `rowDetail` (`app/_ui/PlayerAcrossEvents.tsx`) puts `r.inEvent` (null) in the Before column and the reference figures in the After column. `docs/screenshots/08zw-player-360.png` and `08zw-player-1280.png` show it.
- Item 5, from the review's reading of the specs and of Gecko's source (no Firefox run): a mask layer whose URL fragment is not a `<mask>` element is painted as an image, and Gecko parses the `svgView(viewBox(...))` fragment, so the frames should draw in Firefox. Still unmeasured: the cost of eight mask layers on each framed element (several hundred on an alliance page below 640 px), and seams between the pieces. If the mask images fail to load, there is no frame and no card border below 640 px, because the 1 px fallback is gone. PR 225 is merged, so this check is now on `dev`.
- Player history rows at 768 px: the gap between the Might change and the Kills change is 1.7 px with the seed's figures. A wider change (for example `▼ −123.45M (−12.3%)`) would touch the next one from 768 px to about 900 px. Before PR 225 the same was true at 640 px.
- Pre-existing, not changed: in pt-BR and ru at 360 px the four breadcrumb pages scroll sideways by 2 px. The element is a `whitespace-nowrap` span outside the breadcrumbs; I did not trace it further.
- Member rows of 44 px leave about 2.5 px between a 32 px photo's frame and the row rules. If that is too tight, give the row the 49 px it had before PR 225.
- Breadcrumbs on 44 px lines leave a wide gap between the two lines of a wrapped alliance name at 360 px. This is the cost of the 44 px link height in inline text.

## Next

Session: none queued. Issue 140 is parked by the owner.
Model / effort: keep (opus · medium) — no signal: the code was the earlier attempt's patch, reviewed and kept, and `pnpm check` failed only on load timeouts in untouched files.
Owner must do first: check one framed control in Firefox (see Open issues), then merge this PR into `dev` (`Closes #125`).
Plan changes needed: none.

<adjustments>
- `MoreBar` takes `inline="sm"`: the control is a grid item of the row from 640 px only. It needs the row's grid to have a last column for it, and lines that start in column 2 from 640 px.
- `DetailTable`'s `to` is `null` when there is no After. `rankCell(pair)` in `app/_ui/DetailLines.tsx` is the Rank column's cell.
- A summary with the `details-bar` class whose direct child is `.drawn-frame-soft` puts its keyboard ring on that child (`app/globals.css`, top). A new Details bar needs that class.
- Playwright's Firefox does not launch on this Mac ("Could not find profile folder"). Plan Firefox checks on another machine or by the owner.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/225
