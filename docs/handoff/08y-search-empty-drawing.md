# 08y — Illustration on the empty search (#71)

Depends on #53 (`session/08x-search-pictures`): this branch is cut from it, so its diff includes #53's commit until that PR is merged.

## Built
- `docs/brand/drawing/examples/granny.py` `empty()`: a new Granny Doctor pose, viewBox 160 × 120. Same head placement and shawl as `ledger()`, but the brow is raised (the stern brow is skipped and redrawn higher), the forearm reaches out under the beak, the magnifier is held up high and empty over the left page, and a smaller open ledger sits at the bottom left with blank pages, a lifted page corner and a ribbon. Registered as `granny-empty` in `docs/brand/drawing/build.py`. 3,940 bytes as built.
- `lib/brand/components/Mascot.tsx` `GrannyEmpty`: the built markup pasted unchanged, `aria-hidden="true"`, `fill="currentColor"`; no `data-anim`.
- `app/(pages)/players/page.tsx`: a search with no match shows `GrannyEmpty` (`w-40 text-plum`) above the existing `copy.search.noMatch` line, in the `EmptyState` layout (`py-8`, centred, `mt-3 max-w-[32ch] font-subhead text-display-sm font-semibold`), below the form. `copy.search.noMatch` unchanged; no new strings; no new dependency.
- `docs/DESIGN.md`: a `search-empty` line after `search-pending`.
- `docs/screenshots/08y-granny-empty-sheet.png` (preview sheet: 288/192/96 px on paper and dark, beside the yarn ball and `GrannyLedger` at 192 and 96 px), `08y-search-empty-360-light.png`, `-360-dark.png`, `-1280-light.png`, `-1280-dark.png`.

## Decisions
- Distinct from `GrannyLedger` (shown just before, while the search runs): there the lens lies on a book full of rows; here it is lifted high off a book with blank pages, and the brow is raised. At 96 px the lens position alone tells the two apart.
- No animation: DESIGN.md "Motion" allows it for the error pages and the pending magnifier only; an empty result is a static empty state.
- The line keeps `font-semibold` like `EmptyState`; before this change the no-match line was not semibold. Taken as part of "like `EmptyState`".
- Ornament budget: it is an empty state, which the budget already lists; under 4 KB as rendered (3,964 bytes measured in the served page, with `aria-hidden` and `class`); single colour; no ids, masks, opacity or text.

## Deviations
- None. Three drawing rounds: the first put the hand and handle on the beak; the second had the forearm continue the beak's jaw line; the third (shipped) drops the arm below the jaw and moves the book down 2 units.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint and tsc clean. Vitest: the full run ended with four PGlite `beforeAll` timeouts (`lib/queries/leadership`, `players`, `running`, `upstream-status`) at load average 40–45 (other lanes running on this machine); each of the four passes on its own (3, 4, 1 and 6 tests), and `lib/brand/tokens.test.ts` (the colour-literal test) and `lib/copy.test.ts` pass. This change touches no query or test.
- `build.py` still builds every drawing; the existing functions are unchanged.
- Browser, the same throwaway stack as 08x (local Postgres 18 in the scratchpad, WebSocket bridge, `env -i` placeholders, no upstream, no Neon): `/players?q=zzqx` at 360 and 1280 px, light and dark: the drawing and the line show under the form; at 360 px the field, the Search button, the drawing and the line are all in the first screen; `scrollWidth` equals the width; no interactive element under 44 px.
- Not seen: the drawing under `NEXT_PUBLIC_BLANK_COPY`, or with JavaScript off (it is server-rendered, so it does not depend on it).

## Open issues
- The drawing awaits the owner's approval; the owner may ask for a redraw. To redraw: edit `empty()` in `docs/brand/drawing/examples/granny.py`, rebuild with `python3 -I docs/brand/drawing/build.py <scratch>`, paste the new markup into `GrannyEmpty`.
- `/brand` does not list `GrannyEmpty` (08r added its new drawings there; this task did not ask for it).
- Full-suite PGlite hook timeouts under heavy machine load keep recurring across sessions (08f, 08m, 08r, here); a longer `hookTimeout` for the PGlite files would remove the noise. Not changed here.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call, no query and no timing.
Owner must do first: merge #53's PR, then this one, into `dev`; approve the drawing (or ask for a redraw) from `docs/screenshots/08y-granny-empty-sheet.png`.
Plan change: none.
<adjustments>
- Nothing that changes Session 9's runs; the empty-search drawing is a page-only change.
</adjustments>
