# 08zw-ui-polish — issue 125

## Built

1. StatTable Lead (`app/_ui/StatTable.tsx`): the lead row is `items-baseline`, so the rank sits on the name's first line. The picture sits in a box one name line tall (`h-[1lh]`, `self-start`), so on a one-line lead the rank, picture and name share one centre line.
2. Breadcrumbs (`app/_ui/Breadcrumbs.tsx`): the `<ol>` is inline text with 44 px lines (`leading-11`), each `<li>` is inline, and each link is padded (`py-3`). A long alliance name now breaks inside the name. This changes all four callers: the player page, the alliance page, member history and the compare page.
3. Player history rows (`app/_ui/PlayerAcrossEvents.tsx`): `MoreBar` takes `inline="sm"`. From 640 px the stale mark and "Details ▾" sit in a sixth grid column on the row's first line (`sm:row-start-1`, last column), and the open panel spans the row. Below 640 px nothing changes. Each line's head starts in column 2 from 640 px (`sm:col-start-2`), so no line runs into the Details column. The CSS is `.stat-more-sm` in `app/globals.css`, under `@supports selector(::details-content)` and `min-width: 640px`. `MoreBar`'s `inline` prop is now `boolean | "sm"`.
4. Search row (`app/(pages)/players/page.tsx`): the literal `·` is gone and "SEEN <date>" is `whitespace-nowrap`.
5. Drawn frame without `-webkit-mask-box-image` (`app/globals.css`): the 1 px border fallback is replaced by a nine-slice built from eight standard `mask` layers. Each layer is a piece of `frame.svg` or `frame-soft.svg`, cut out with an `#svgView(viewBox(...))` fragment: four 12-unit corners drawn at 6 px and four edges stretched between them. It covers `.drawn-frame`, `.drawn-frame-soft` and `.stat-card` below 640 px.
6. Details panel (`app/_ui/DetailLines.tsx`): when there is no After, `DetailTable` gets `to={null}` and its head reads `—` with screen-reader text "No data" (the existing `copy.fresh.missing` string), with no arrow. The new `rankCell` shows one muted `—` in the Rank column when there is no rank, instead of `#— —`. The callers pass `null` when there is no After: the event table (`EventView.tsx`), the alliance Summary band and the player history rows.
7. Focus ring on the Details control (`app/globals.css`): `summary:focus-visible:has(> .drawn-frame-soft)` drops the ring from the whole bar, and `summary:focus-visible > .drawn-frame-soft` draws the plum 2 px ring, 2 px offset, around the framed control only. This applies to every Details bar: StatTable rows, player history rows, compare cards and the alliance Summary band.

DESIGN.md: updated the lines for focus ring, `stat-table`, `history-row`, `details-table`, `breadcrumbs` and `button-secondary` (the frame fallback). Two comments in `app/globals.css` that still described the 1 px border fallback now point to the mask block.

## Decisions

- Item 3 scope: only the player page's history rows changed. Compare cards and the alliance Summary band keep their full-width Details line. This is the triage comment's default reading; the owner did not answer it.
- Item 6 scope: only the After head and the Rank cell changed. With only a Before, the After column still repeats the Before figures (`app/_ui/event-rows.ts:57`). This is the triage comment's default reading; the owner did not answer it.
- Item 6: the row lead outside Details still reads `#— —` for an unranked alliance with no move. DESIGN.md says an unranked alliance reads `#—`, and the prompt says to keep the change inside the Details cell.
- Item 7: the ring is moved onto the framed control instead of being removed after a pointer press. After a click and then a key press, the ring now sits round "Details ▾" only. A keyboard user keeps a visible ring, and the whole bar is never framed.
- The `EventView.tsx` hunk is kept. Item 6 needs it: the owner's screenshot was of the event table, and `EventView.tsx` renders that table's Details panel.
- Started from the earlier attempt's patch (8 files, 140 insertions, 33 deletions). I read every hunk against the seven items and kept them all. The only additions are the two globals.css comments and DESIGN.md.

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

## Open issues

- Item 5 is not verified in a real Firefox (see Deviations). Before merging, open any page with a framed button in Firefox. If no frame appears around "Details ▾" or the header buttons, restore the 1 px border fallback. The removed rules were `.drawn-frame, .drawn-frame-soft { border: 1px solid currentColor }` and `::before { display: none }` under `@supports not (-webkit-mask-box-image: none)`.
  - Resolved 2026-11-11, after the merge: Firefox still could not start on this Mac, even outside the command sandbox (same "Could not find profile folder"), so the owner chose the 1 px border fallback. A follow-up PR restored those rules and removed the eight-layer mask block, its two comments and the DESIGN.md wording. Item 5 ends in the accepted fallback, as the owner's decision on issue 125 allowed. `08zw-frame-nineslice-chrome-sim-360.png` now shows code that is no longer on `dev`.
- Firefox cannot start on this Mac until `~/Library/Application Support/Firefox` can be created. That folder is under macOS privacy protection.
- Follow-up, not changed: the row lead of an unranked alliance with no move reads `#— —` (Rank plus RankMove) outside Details.
- Follow-up, not changed: with only a Before, the After column of the Details table repeats the Before figures (`app/_ui/event-rows.ts:57`).
- Breadcrumbs on 44 px lines leave a wide gap between the two lines of a wrapped alliance name at 360 px. This is the cost of the 44 px link height in inline text.

## Next

Session: none queued. Issue 140 is parked by the owner.
Model / effort: keep (opus · medium) — no signal: the code was the earlier attempt's patch, reviewed and kept, and `pnpm check` failed only on load timeouts in untouched files.
Owner must do first: check one framed control in Firefox (see Open issues), then merge this PR into `dev` (`Closes #125`).
Plan changes needed: none.

<adjustments>
- `MoreBar` takes `inline="sm"`: the control is a grid item of the row from 640 px only. It needs the row's grid to have a last column for it, and lines that start in column 2 from 640 px.
- `DetailTable`'s `to` is `null` when there is no After. `rankCell(pair)` in `app/_ui/DetailLines.tsx` is the Rank column's cell.
- Every summary whose direct child is `.drawn-frame-soft` puts its keyboard ring on that child (`app/globals.css`, top).
- Playwright's Firefox does not launch on this Mac ("Could not find profile folder"). Plan Firefox checks on another machine or by the owner.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/225
