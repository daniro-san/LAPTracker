---
name: hand-drawn-svg
description: Draw a new illustration, icon, ornament or mascot pose for LAPTracker in the brand's "confident nib" hand-drawn style (tapered filled strokes, single colour), from a plain-language prompt, and wire it into the app. Use when asked to "draw", "illustrate", "make an icon/ornament/vignette/pose", or redraw an existing brand drawing (mark, wax seal, lace, yarn corner, Granny Doctor, error-page vignettes, drawn frame). Do NOT use for charts, photos, UI layout or anything from the game's own art.
---

# Hand-drawn SVG in the brand's hand

Every drawing in LAPTracker is a short Python function that places centreline points by hand; a small engine turns them into tapered, filled strokes. You are the hand: you place the points, render, look, and redraw until it is good. The method and its rules are in `docs/brand/DRAWING.md` — read it first, every time.

## Inputs

The prompt says what to draw and where it goes (e.g. "a teapot for the empty search results", "an icon for 'paused'"). If the use is unclear, decide from DESIGN.md's ornament budget and say which you chose. Nothing from any video game; no traced stock art; reference images are genre reference only.

## Workflow

1. **Read** `docs/brand/DRAWING.md` (style, weights, recipe) and the closest existing drawing in `docs/brand/drawing/examples/` (`objects.py` for vignettes, `ornaments.py` for small ornaments and icons, `granny.py` for the mascot, `mark.py` for the logo, `frame.py` for the frame). Reuse its helpers and proportions.
2. **Pick the frame**: viewBox 160 × 120 for vignettes, 160 × 200 for a standing figure, 64 × 64 for marks, 100 × 100 for seals, 16 × 16 for icons. Pick the smallest size it will be shown at (96 px vignettes, 80 px footer figure, 16 px icons).
3. **Write a function** in the matching `examples/` module, using `lib.py` (`stroke`, `blob`, `ring`, `arc`, `quad`, `rot`, `catmull`, `svg`, `el`). Outer contours `w` 1.2–1.5, details 0.4–0.8, small filled accents for pupils, rivets and knobs; leave one or two pen lifts. Register it in `DRAWINGS` in `docs/brand/drawing/build.py`.
4. **Build into a scratch folder** (never into the repo): `python3 -I docs/brand/drawing/build.py <scratch>/draw-out`.
5. **Preview**: `python3 -I .claude/skills/hand-drawn-svg/preview.py <scratch>/draw-out/<name>.svg <smallest-px> <scratch>/draw-out/sheet.html`, then render it with headless Chrome — `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --screenshot=<scratch>/draw-out/sheet.png --window-size=1200,900 file://<scratch>/draw-out/sheet.html` — and look at the PNG.
6. **Critique harshly and iterate** (the approved drawings took 7–9 rounds). Checklist:
   - Does it read at its smallest size, on paper and on dark?
   - Same family as the yarn ball beside it: same line weights, tapers, pen lifts? Organic and warm, or clip-art?
   - No perfect circles or rectangles where a hand would wobble; no thin outlines that vanish; nothing chunky.
   - Under 4 KB (`wc -c`); single colour; no ids, masks, clip paths, gradients, filters, opacity or text.
   - Below 32 px the hand disappears: use filled shapes with uneven edges, or keep a crisp geometric icon.
7. **Show the owner** the sheet before wiring it in when it is a new kind of drawing; small variations of an existing one can go straight in.
8. **Wire it in**: paste the inner markup into a component in `lib/brand/components/` (JSX attributes: `fillRule`, `strokeWidth`, `strokeLinecap`), `aria-hidden="true"`, `fill="currentColor"` on the `<svg>`. A moving part goes in a `<g data-anim="sway|rock">` with `style={{ transformOrigin: "<x>px <y>px" }}` (viewBox units); `app/globals.css` animates it and stops it under reduced motion. Strings go in `lib/copy.ts`.
9. **Verify**: `pnpm check` (the colour-literal test covers `app/` and `lib/brand/components/`), then screenshot the page that uses it at 360 and 1280 px, light and dark.

## Rules that do not bend

- The engine and examples live in `docs/brand/drawing/`; keep `build.py` reproducing every shipped drawing byte for byte (change a drawing by editing its function, rebuilding and pasting the new markup).
- Colour comes from the CSS token the component sets (`text-plum`, `text-seal`, …); never a hex value in a component.
- Ornaments stay in the margins (DESIGN.md "Ornament budget"); never behind numbers or inside table cells.
