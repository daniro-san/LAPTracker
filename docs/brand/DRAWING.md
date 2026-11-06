# Drawing style: the confident nib

Every illustration of the brand — the vignettes (yarn left behind, the bottle broken in two, the teacup), the line mark, the Granny Doctor, the wax seal, the yarn corner, the lace and the hourglass — is drawn the same way. This page is the recipe, so a later session (or a person) can draw a new one that sits in the same family. The owner approved this hand at the Session 7 review; the earlier chunky-silhouette and 2.5D chibi attempts were rejected as "too hard, not organic".

## What it looks like

- **Lines are filled shapes, not strokes.** Each line is a closed shape that swells in the middle and tapers to a point at both ends, like a dip pen or a brush with pressure. Nothing has an even stroke width.
- **Two weights.** Outer contours peak at about 2.4–3 units on a 160-unit-wide drawing; inner details (wraps, hatching, rivets, steam) at about 0.9–1.4. On a 64-unit mark scale both down proportionally.
- **Curves flow; nothing is a primitive.** A cup rim is not an ellipse and a ball is not a circle: outlines carry a slight wobble (1–3 % of the radius) and an opening where the pen would lift.
- **Texture by hatching.** Yarn wraps, glass shading and shadows are a few short tapered strokes, never a fill or a tone.
- **Small filled accents only.** Pupils, rivets, cork ends, needle knobs, the hatband: small solid dots or blobs. Large solid areas belong to the small mark cut only.
- **One colour.** Every shape is `fill="currentColor"`; holes are `fill-rule="evenodd"` or the opposite winding. No masks, clip paths, ids, gradients, filters, opacity or text. Under 4 KB per file (DESIGN.md ornament budget), coordinates rounded to one decimal.

## How a drawing is built

A drawing is a short program. Its author places centreline points by hand and asks for a stroke along them; the engine turns that into the tapered filled outline.

1. **Centreline.** A list of 3–12 points through the middle of the line, placed by eye on the viewBox grid (160 × 120 for vignettes, 160 × 200 for a standing figure, 64 × 64 for the mark, 100 × 100 for the seal, 16 × 16 for an icon).
2. **Curve.** The points become a smooth Catmull-Rom curve (each point's tangent is the direction from its previous to its next neighbour; segments are cubic Béziers with control points at one sixth of that direction).
3. **Width profile.** At each point the half-width is `w × rise × fall`, never less than a floor `e`:
   - `rise` eases from 0 to 1 over the first `a` of the line's length, `fall` from 1 to 0 over the last `b`, both with a smoothstep (`3x² − 2x³`), so the line swells and tapers instead of ramping.
   - Typical values: contour `w` 1.2–1.5, `a` 0.08–0.15, `b` 0.1–0.2; detail `w` 0.4–0.8, `a`/`b` 0.3–0.5; `e` 0.12 (a hairline end), up to 0.4–0.85 for a blunt end such as a needle.
4. **Outline.** Each curve point is pushed out by its half-width along the curve's normal on both sides; the left side runs forward, the right side back, and the two join into one closed shape. All outlines are wound the same way so overlapping strokes merge instead of cancelling.
5. **Helpers.**
   - _Arc_: points on an ellipse between two angles, with an optional per-point wobble — the base of every round outline.
   - _Bowed strand_: a quadratic curve between two points that bows by a fraction of its length — yarn wraps and hatching.
   - _Blob_: a closed filled shape through points — dots, knobs, pupils, drips.
   - _Ring_: a blob with a matching hole — the goggle rim, the seal's pressed ring.
   - _Leaf_: two quadratic curves meeting in points at both ends — the cheapest short detail stroke (fringe, hatching) when the byte budget is tight.
6. **Output.** All shapes go into one or two `<path>` elements (`fill="currentColor"`), one more path for any part that animates (`data-anim`, pivot noted in viewBox units).

## Recipe for a new drawing

1. Sketch the composition in words first: the object, what it says, which one part moves (if it is an error-page vignette).
2. Block in the outer contours with 6–12 centreline points each, weight 1.2–1.5. Leave one or two pen lifts (gaps) where a hand would.
3. Add the inner details with lighter strokes (0.4–0.8) and short hatching, then the small filled accents.
4. Render it at its real size and at 3–4×, on paper (`--paper`/`--plum`) and dark (`--dark-paper`/`--dark-plum`), next to `yarn` at the same scale. Compare line weights directly.
5. Critique harshly and iterate (the approved drawings took 7–9 rounds): does it feel drawn by a confident hand, warm and organic, or like clip-art? Is it recognisable at the smallest size it will be shown (96 px for vignettes, 80 px for the footer Granny)?
6. Below 32 px the hand disappears: tapered stitches turn into beans. There, use filled shapes with slightly uneven edges (the small mark cut) or keep a crisp geometric icon (the done and partial status icons stayed geometric for this reason).

## Where the drawings are

The shipped SVG markup lives in `lib/brand/components/` (`Vignettes.tsx`, `Mascot.tsx`, `Logo.tsx` `MarkLine`, `SealButton.tsx`, `YarnCorner.tsx`, `LaceBorder.tsx`, `StatusIcons.tsx` `Hourglass`, `Wax.tsx`), plus the drawn frame for secondary buttons and chips in `public/brand/frame.svg` and `frame-soft.svg` (`fill="black"`, used as a nine-slice mask so CSS tints it; the straight edges keep an even width so they stretch). The bonnet bust kept from an earlier round is `docs/brand/granny-doctor-bust.svg` (old style, character reference only).

The generator that produced them is in `docs/brand/drawing/` (standard library only):

- `lib.py` — the nib engine: `stroke`, `blob`, `ring`, `arc`, `quad`, `catmull`, `widths`.
- `examples/` — one module per family, one function per drawing: `objects.py` (vignettes), `mark.py` (line and small cuts), `ornaments.py` (seal, yarn corner, lace, icons), `granny.py` (both poses, sharing `head()`), `frame.py` (the nine-slice frame).
- `build.py` — writes every drawing into a folder: `python3 -I docs/brand/drawing/build.py <out-dir>`. Its output is byte-identical to the shipped SVGs (checked at Session 7); to change a drawing, edit its function, rebuild, and paste the new markup into its component.

To draw something new, add a function next to the closest example, add it to `DRAWINGS` in `build.py`, and follow the recipe above.

Two switches for drawings shown at another size or in another pose:

- **`GAIN`** (`lib.py`) multiplies every stroke, ring and leaf width. It is 1.0 for every shipped drawing. A drawing shown below the size its line weights were set for raises it while it draws and sets it back to 1.0 after: the Discord avatars (`examples/discord.py`, 40 px, below the 96 px the vignette weights assume) draw with 1.4, because at 1.0 their lines broke up.
- **`head(p, T, skip=…)`** (`examples/granny.py`) leaves out `"brim"`, `"beak"` (with its rivets), `"brow"` or `"pupil"`, so a pose can redraw that part itself.
