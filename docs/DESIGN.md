---
version: 1
name: Old Grandmas — Saturday Ledger
description: The design contract for every UI session of LAPTracker. A guild ledger kept by someone's grandmother in a plague year — paper, ink, a wax seal, a half-finished scarf on the chair. A serious tool with a wink; the numbers are the point, the craft lives in the margins.

colors:
  paper: "#efe6d3"
  ink: "#1e1a1f"
  plum: "#3b2436"
  seal: "#8c2f2f"
  yarn: "#c9962b"
  sage: "#6f7f62"
  rule: "#d9cdb4"
  dark-paper: "#1a1418"
  dark-ink: "#eadfcb"
  dark-plum: "#b48ba6"
  dark-seal: "#d46a6a"
  dark-yarn: "#e0b04a"
  dark-sage: "#93a585"
  dark-rule: "#3a2f36"

typography:
  display-lg:
    fontFamily: Cormorant Garamond
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0
  display-md:
    fontFamily: Cormorant Garamond
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 0
  display-sm:
    fontFamily: Cormorant Garamond
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  body:
    fontFamily: Source Sans 3
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: Source Sans 3
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  numeral:
    fontFamily: Source Sans 3
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0
    fontVariantNumeric: tabular-nums
  label:
    fontFamily: Source Sans 3
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.04em
    textTransform: uppercase

rounded:
  none: 0px
  xs: 2px
  seal: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  section: 48px

components:
  header:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.paper}"
    typography: "{typography.display-md}"
    padding: "{spacing.sm} {spacing.md}"
    ornament: lace-border
  stat-table:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rowBorder: "{colors.rule}"
    rounded: "{rounded.none}"
    cellPadding: "{spacing.sm} {spacing.md}"
    rowMinHeight: 44px
  stat-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    borderColor: "{colors.rule}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  delta-up:
    textColor: "{colors.yarn}"
    typography: "{typography.numeral}"
  delta-down:
    textColor: "{colors.seal}"
    typography: "{typography.numeral}"
  badge:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "{spacing.xxs} {spacing.xs}"
  seal-button:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.seal}"
    padding: "{spacing.md}"
    minSize: 44px
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: "{spacing.sm} {spacing.md}"
    minHeight: 44px
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    borderColor: "{colors.rule}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: "{spacing.sm}"
    minHeight: 44px
  bottom-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.lg} {spacing.md}"
    shadow: "0 -8px 24px rgba(30, 26, 31, 0.18)"
  empty-state:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.display-sm}"
    padding: "{spacing.section} {spacing.md}"
    ornament: teacup
  timeline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rowBorder: "{colors.rule}"
  error-page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    padding: "{spacing.section} {spacing.md}"
    ornament: illustration
---

## Who uses this, and in what language

Members of a game alliance on server 325 — Russia, Spain, Brazil, the United States and more — on phones, in a Discord thread, often during or right after the event. Most are not native English readers; some read no English at all. Translation is a later phase (after Phase 8); **being usable without it is a requirement now.** The test is literal: a member who speaks no English opens the page and, within ten seconds, finds their alliance, sees whether might and kills went up or down and by how much, and knows when the numbers are from.

### Language-light rules

- **Numbers first, words second.** Every data row reads as `label · number · signed delta with arrow · percent`. The label is one word, the same word the game's own English UI uses (Might, Kills, Members), because the players already know those words in the game.
- **Three channels for every state**, never one: colour **and** an arrow/sign **and** a short word. Green alone, an arrow alone or English alone is not enough. Colour-blind safe by construction.
- **One legend, once.** A compact legend (arrow up/down, the freshness dot, `[TEST]`) sits under the header; nothing else explains itself in a sentence.
- **Sentences only in the margins.** The grandma voice lives in empty states, error pages, section titles and the admin area. Status is chips (`Before ✓ 12:01` · `After ✓ 16:01`), not prose. A public page has no paragraph.
- **Dates and numbers through `Intl`** with the browser's locale: `16:01` not `4:01 PM`, `3,94 B` for pt-BR, `3.94B` for en. Server time stays explicit (`16:01 server`); relative times (`4 days ago`) are secondary.
- **Universal symbols where they are truly universal**: ▲ ▼ for change, a filled dot for fresh and an outlined one for stale, a magnifier for search, ✓ ✗ for done/failed. No icons that need a culture to read (no thumbs, no wink, no skull for kills — "Kills" is already the game's word).
- **Every string in `lib/copy.ts`**, none in components, so translation later is a file, not a refactor. Keys are stable identifiers; the value is the English text.
- **Own alliance first.** OGs is highlighted and pinned at the top of the ledger; a "Jump to my alliance" control exists on long lists. Rank numbers (`#1 … #20`) are shown because they are language-free.

## Navigation and hierarchy

- Header: wordmark · event selector · search. Nothing else.
- Main page, top to bottom: status strip (before/after chips, legend) → the ledger (own alliance pinned, then by might) → nothing else. The run buttons live on `/admin`.
- Every card and row is a link to the alliance page; the alliance page is members with the same row shape; the player page is the same shape over time. **One row shape, three depths** — learn it once.
- Back is the browser's back; breadcrumbs only on alliance and player pages (`Ledger › OGs › Player`).
- No modals except the bottom sheet for the PIN; no tooltips that carry information; nothing on hover only.

## Mascot: the Granny Doctor

An original character, ours: an old lady in a plague-doctor beak mask, bonnet or kerchief, a cane in one hand and a knitting bag in the other. Dignified, a little stern, funny because she is serious. Single-colour inline SVG, at most three poses (standing with the cane for the 404, dropping a bottle for the 500, pouring tea for the empty state). Game references are allowed as **allusions in copy** — the server number, "KvK", the game's terms — never as its art, characters or assets. Comic but serious: a joke a 40-year-old officer in Russia would also get, never a meme.

## Overview

A guild ledger, kept by hand, in a plague year. The page is aged paper; the ink is near-black; the header is dark plum; a wax-seal red marks losses and warnings; mustard yarn marks gains. Craft shows in the margins — a crochet lace border on the header, a ball of yarn in one corner, a teacup where there is nothing to show — and nowhere else. **The data table stays plain**: high contrast, tabular numerals, one-pixel rules, no texture behind a number. If an ornament ever competes with a number, the ornament goes.

**Key characteristics**

- Paper, not screen: flat `{colors.paper}` canvas, `{colors.rule}` hairlines, no gradients, no glow.
- One display serif (Cormorant Garamond) for headings and the wordmark; one humanist sans (Source Sans 3) for everything else, numerals always `tabular-nums`.
- Colour means something: sign of a delta, a warning, a neutral badge. Decoration never uses the accent colours.
- Square corners (`{rounded.none}`) on tables and cards, 2 px on controls; the one circle is the wax seal.
- Mobile first: designed at 360 px, cards below 640 px, every target ≥ 44 px, nothing hover-only.
- Dark mode is the same ledger by lamplight — swapped token values, nothing redesigned.

## Colors

- **Paper** (`{colors.paper}` — #efe6d3): the page. Dark: `{colors.dark-paper}`.
- **Ink** (`{colors.ink}` — #1e1a1f): all text. Dark: `{colors.dark-ink}`.
- **Plum** (`{colors.plum}` — #3b2436): header, links, primary actions, focus rings. Dark: `{colors.dark-plum}`.
- **Seal** (`{colors.seal}` — #8c2f2f): negative deltas, errors, "stale", the seal button. Dark: `{colors.dark-seal}`.
- **Yarn** (`{colors.yarn}` — #c9962b): positive deltas, highlights. Dark: `{colors.dark-yarn}`.
- **Sage** (`{colors.sage}` — #6f7f62): neutral badges — `[TEST]`, "fallback source", "manual". Dark: `{colors.dark-sage}`.
- **Rule** (`{colors.rule}` — #d9cdb4): borders and table rules. Dark: `{colors.dark-rule}`.

Rules: deltas are coloured by sign only; a colour that carries no meaning is not used. Text contrast ≥ 4.5:1, large numerals ≥ 3:1, checked in both modes. No gradients anywhere.

## Typography

- **Cormorant Garamond** (OFL, Google Fonts via `next/font/google`, `display: swap`) — headings, the wordmark, empty-state and error-page lines. Weight 600, never below 20 px.
- **Source Sans 3** (OFL) — body, tables, controls. Numerals are `{typography.numeral}`: `font-variant-numeric: tabular-nums`, right-aligned, compact (`3.94B`, `+20.1M`) with the full value in a `title`/tap.
- Two families, no third. No italics for emphasis in headings, no all-caps display; `{typography.label}` is the only tracked, uppercase style.

| Token                     | Size | Weight | Use                                      |
| ------------------------- | ---- | ------ | ---------------------------------------- |
| `{typography.display-lg}` | 32px | 600    | Page title, error-page line              |
| `{typography.display-md}` | 24px | 600    | Section and header title                 |
| `{typography.display-sm}` | 20px | 600    | Card title, empty-state line             |
| `{typography.body}`       | 16px | 400    | Copy, buttons, inputs                    |
| `{typography.body-sm}`    | 14px | 400    | Timeline lines, help text                |
| `{typography.numeral}`    | 16px | 500    | Every number in tables and cards         |
| `{typography.label}`      | 12px | 600    | Column headers, badges, small-caps notes |

## Layout

- **Spacing**: 4 · 8 · 12 · 16 · 24 · 32 · 48 (`{spacing.xxs}` … `{spacing.section}`). Page gutter `{spacing.md}` on phones, `{spacing.lg}` above 640 px.
- **Container**: max 960 px, centred. One column on phones.
- **Breakpoints**: `< 640px` the comparison table becomes one `stat-card` per alliance; `≥ 640px` the full table. One component, two layouts. Horizontal scroll only if twenty columns truly do not fit at 1280 — try first.
- **Touch**: every interactive element ≥ 44 px; focus ring `{colors.plum}` 2 px with 2 px offset; everything reachable by keyboard.

## Elevation & Depth

| Level    | Treatment                              | Use                             |
| -------- | -------------------------------------- | ------------------------------- |
| 0 — flat | 1 px `{colors.rule}` border, no shadow | Everything                      |
| 1 — lift | `0 -8px 24px rgba(30, 26, 31, 0.18)`   | The bottom sheet (PIN, confirm) |

Depth comes from the paper/plum contrast and hairlines, never from shadows or blur.

## Shapes

| Token            | Value  | Use                          |
| ---------------- | ------ | ---------------------------- |
| `{rounded.none}` | 0      | Tables, cards, sheets, pages |
| `{rounded.xs}`   | 2px    | Inputs, badges, buttons      |
| `{rounded.seal}` | circle | The wax-seal button only     |

Paper does not have rounded corners.

## Components

The whole list. Anything else is a composition of these; a new one needs a line here first.

- **`header`** — wordmark + lace border + event selector. Plum field, paper text, sticky and compact on phones.
- **`stat-table` / `stat-card`** — one `StatTable` component: table ≥ 640 px, cards below. Rows ≥ 44 px; numerals right-aligned.
- **`delta-up` / `delta-down`** — `value · ±delta with arrow · ±%`; kills with the member-loss note when negative.
- **`status-strip`** — two chips (`Before ✓ 12:01`, `After ◐ 16:01`) and the legend; replaces every status sentence.
- **`rank`** — `#n` beside the tag on cards and rows; language-free ordering.
- **`badge`** — sage neutral chip: `[TEST]`, source, manual. Never red or yellow.
- **`seal-button`** — the wax seal: destructive or confirming actions (Run now, Rehearse now). Circle, ≥ 44 px.
- **`button-primary`** — plum, 2 px radius; one per view at most.
- **`input`** — paper field with a rule border; PIN uses `inputmode="numeric"`.
- **`bottom-sheet`** — PIN entry and confirmations on phones; the only shadow.
- **`empty-state`** — teacup illustration + one display-sm line ("Nothing recorded yet. The kettle is on.").
- **`timeline`** — `run_logs` rows: time, level, code, alliance tag, the data that matters.
- **`error-page`** — 404 "Grandma wandered off." and 500 "Something cracked.", each with one original inline SVG and one CSS keyframe loop.

Ornament budget: header lace border, one yarn corner per page, the seal buttons, empty states, error pages, favicon. Never behind numbers, inside cells, on cards, as backgrounds or dividers. Every ornament is an original single-colour inline SVG under 4 KB, `aria-hidden`. Nothing from the game.

## Motion

Only where it carries meaning or a smile: the error-page illustrations (one keyframe loop each, 2–4 s), the freshness dot while a run is live, the bottom sheet entering (200 ms ease-out). Everything stops under `prefers-reduced-motion: reduce`. No page-load animation, no parallax, no shimmer skeletons — a plain "Loading the ledger…" line.

## Voice

Short, dry, grandmotherly, English. Title "Old Grandmas — Saturday Ledger". Columns "Might", "Kills", "Members", "Gained / Lost". States: "Nothing recorded yet. The kettle is on." · "The ledger is closed for today (quota exhausted)." · "Grandma wandered off." · "Something cracked." No exclamation marks, no emoji, no "Oops", no "Awesome".

## Do's and Don'ts

### Do

- Lead with paper and ink; let plum, seal and yarn each mean one thing.
- Keep every number in `{typography.numeral}`, right-aligned, compact, full value on tap.
- Put craft in the margins: header, corner, seals, empty states, error pages.
- Design at 360 px first and screenshot 360 / 390 / 1280 in both modes.
- Change this file in the same commit as the tokens when a decision changes.
- Run the ten-second test with a real member who reads no English before calling a page done.

### Don't

- Inter, Roboto or system-ui for display; a third typeface for anything.
- Gradients, glassmorphism, blur, glow, `shadow-lg`, `rounded-2xl`, pill buttons.
- Hero sections, three-column feature grids, numbered "01 / 02 / 03" labels, italic accent words.
- Emoji or sparkles in UI copy; generic illustration packs; charts (v1 has none).
- Paragraphs on public pages; status as prose; a label longer than two words; information that exists only in a tooltip or only in a colour.
- A dark mode that is a different design; a component that exists only once and only here.

## Enforcement

- `lib/brand/tokens.css` is the only place a colour literal appears: a test greps `app/` and `lib/brand/components/` for `#[0-9a-f]{3,6}` and `rgb(` and fails on any hit.
- Fonts load from `next/font/google`; no other `@font-face`.
- Screenshots at 360 / 390 / 1280 in both modes for every page a session touches, attached to the PR.
- The `frontend-design` skill, when available, is opened with this file as the brief.
