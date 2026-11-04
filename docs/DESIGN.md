# DESIGN.md — Old Grandmas · Saturday Ledger

The design system for every UI session (6, 6b, 7 and anything after). Read it before touching `app/`. Tokens live in `lib/brand/tokens.css`; this file says what they mean and what is never done. When the owner changes a decision, change it here first, then in tokens, then in components. Plan Phase 5b is the brief; this is the contract.

## 1. Idea

A guild ledger kept by someone's grandmother in a plague year: paper, ink, a wax seal, a half-finished scarf on the chair. **A serious tool with a wink** — the numbers are the point, the craft is in the margins. If an ornament competes with a number, the ornament loses.

## 2. Colour (roles, not decoration)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | `#EFE6D3` | `#1A1418` | page background |
| `--ink` | `#1E1A1F` | `#EADFCB` | text |
| `--plum` | `#3B2436` | `#B48BA6` | header, links, primary actions |
| `--seal` | `#8C2F2F` | `#D46A6A` | negative deltas, errors, "stale" |
| `--yarn` | `#C9962B` | `#E0B04A` | positive deltas, highlights |
| `--sage` | `#6F7F62` | `#93A585` | neutral badges (`[TEST]`, "fallback source") |
| `--rule` | `#D9CDB4` | `#3A2F36` | borders, table rules |

Rules: colour means something or isn't used. Deltas are coloured by sign only. **No gradients anywhere.** Contrast ≥ 4.5:1 for text, ≥ 3:1 for large numerals; check both modes. Dark mode is the same ledger by lamplight, not a different product: same tokens, swapped values, nothing redesigned.

## 3. Type

- **Display:** Cormorant Garamond (OFL, Google Fonts) — headings, the wordmark, empty-state lines. Weight 600, tight leading, never below 20 px.
- **Text and numbers:** Source Sans 3 (OFL). Body 16 px / 1.5. Numbers always `font-variant-numeric: tabular-nums`, right-aligned, compact (`3.94B`, `+20.1M`), full value on tap/hover title.
- Two families, no third. No italics for emphasis in headings. No all-caps display. Letter-spacing untouched except small-caps labels (`0.04em`).

## 4. Space, shape, surface

- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48. Page gutter 16 px on phones, 24 px above 640 px.
- Radius: **2 px** on inputs and badges, **0** on tables and cards. Paper doesn't have rounded corners; the one exception is the wax-seal button (circle).
- Surfaces are separated by `--rule` borders (1 px), not shadows. One shadow exists: the bottom sheet (PIN, confirmations).
- Max content width 960 px; the comparison table may scroll horizontally above 640 px only if 20 columns truly don't fit — try first.

## 5. Components (the whole list)

`Header` (wordmark + lace border + event selector) · `StatTable` (one component, table ≥ 640 px / cards below) · `DeltaCell` (value · signed delta with arrow · percent; member-loss note) · `FreshnessDot` · `Badge` · `SealButton` (destructive/confirming actions) · `BottomSheet` · `EmptyState` (teacup) · `Timeline` (run_logs) · `ErrorPage` (404, 500). Anything else is a composition of these; a new component needs a line here first.

Touch targets ≥ 44 px. Nothing hover-only: every hover affordance has a tap equivalent. Focus rings visible (`--plum`, 2 px offset). Keyboard reachable.

## 6. Ornament budget

Allowed places: header lace border, one yarn corner per page, wax-seal buttons, empty states, error pages, the favicon. **Not** allowed: behind numbers, inside table cells, on cards, as page backgrounds, as section dividers. Every ornament is an original single-colour SVG under 4 KB, inline, `aria-hidden`. Nothing from the game: no logo, art, fonts or screenshots (plan Phase 5b).

## 7. Motion

Only where it carries meaning or a smile: error pages (one keyframe loop each), the freshness dot when a run is live, the bottom sheet entering. 200 ms ease-out for UI, slower (2–4 s) for illustrations. Everything stops under `prefers-reduced-motion: reduce`. No page-load animations, no parallax, no shimmer skeletons — a plain "Loading the ledger…" line.

## 8. Voice

Short, dry, grandmotherly, English. Title: "Old Grandmas — Saturday Ledger". Columns: "Might", "Kills", "Members", "Gained / Lost". States: "Nothing recorded yet. The kettle is on." · "The ledger is closed for today (quota exhausted)." · "Grandma wandered off." (404) · "Something cracked." (500). No exclamation marks, no emoji, no "Oops", no "Awesome".

## 9. Never (the slop list)

Inter/Roboto/system-ui for display · purple or any gradient · glassmorphism, blur, glow · `rounded-2xl`, pill buttons · `shadow-lg` cards · hero sections, three-column feature grids, numbered "01/02/03" labels · italic accent words · emoji in UI copy · sparkles ✨ · generic illustration packs · charts (v1 has none) · auto-playing anything · a dark mode that is a different design · a component that exists only once and only here.

## 10. Enforcement

- `lib/brand/tokens.css` is the only place a colour literal appears; a test greps `app/` and `lib/brand/components/` for `#[0-9a-f]{3,6}` and `rgb(` and fails on any hit.
- Fonts load from `next/font/google` with `display: swap`; no other `@font-face`.
- Screenshots at 360 / 390 / 1280 in both modes for every page a session touches; they go in the PR.
- The `frontend-design` skill, when available, is opened with this file as the brief.
