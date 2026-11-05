---
version: 1
name: Old Grandmas — Event Ledger
description: The design contract for every UI session of LAPTracker. A guild ledger kept by someone's grandmother in a plague year — paper, ink, a wax seal, a half-finished scarf on the chair. A serious tool with a wink; the numbers are the point, the craft lives in the margins.

colors:
  paper: "#efe6d3"
  ink: "#1e1a1f"
  plum: "#3b2436"
  seal: "#8c2f2f"
  yarn: "#805c12"
  sage: "#586750"
  rule: "#d9cdb4"
  dark-paper: "#1a1418"
  dark-ink: "#eadfcb"
  dark-plum: "#b48ba6"
  dark-seal: "#d46a6a"
  dark-yarn: "#e0b04a"
  dark-sage: "#93a585"
  dark-rule: "#3a2f36"

typography:
  display-xl:
    fontFamily: Young Serif
    fontSize: 48px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: 0
  display-lg:
    fontFamily: Young Serif
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: 0
  display-md:
    fontFamily: Alegreya Sans
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0
  display-sm:
    fontFamily: Alegreya Sans
    fontSize: 20px
    fontWeight: 700
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
    ornament: hatched-shading
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.plum}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: "{spacing.sm} {spacing.md}"
    minHeight: 44px
    ornament: drawn-frame
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
    typography: "{typography.display-xl}"
    padding: "{spacing.section} {spacing.md}"
    ornament: illustration
---

## Who uses this, and in what language

Members of a game alliance on server 325 — Russia, Spain, Brazil, the United States and more — on phones, in a Discord thread, often during or right after the event. Most are not native English readers; some read no English at all. Translation is a later phase (after Phase 8); **being usable without it is a requirement now.** The test is literal: a member who speaks no English opens the page and, within ten seconds, finds their alliance, sees whether might and kills went up or down and by how much, and knows when the numbers are from.

### Language-light rules

- **Numbers first, words second.** Every data row reads as `label · number · signed delta with arrow · percent`. The label is one word, the same word the game's own English UI uses (Might, Kills, Members), because the players already know those words in the game.
- **Three channels for every state**, never one: colour **and** an arrow/sign **and** a short word. Green alone, an arrow alone or English alone is not enough. Colour-blind safe by construction.
- **One legend, once.** A compact legend (arrow up/down, the stale mark, `[TEST]`) sits under the header; nothing else explains itself in a sentence.
- **A mark only when something is wrong** (Session 7d, 07c S2). Rows carry `○ Stale` or `✗ Failed` when their data is; good data carries no mark, so history rows do not repeat a word that means nothing weeks later.
- **The game's four words stay in blank mode** (D23, 07c N1): Might, Kills, Members and Level are the labels members read in the game's own English UI, so the ten-second test keeps them; every other string is blanked.
- **Sentences only in the margins.** The grandma voice lives in empty states, error pages, section titles and the admin area. Status is chips, not prose: `Last updated at Oct 31, 14:01 server` and `Next update at …` (owner, 2026-11-05: these replace the earlier `Before ✓ 12:01` · `After ✓ 16:01` chips). A public page has no paragraph.
- **Dates and numbers through `Intl`** with the request's `Accept-Language`: `16:01` not `4:01 PM`, `3,94 bi` for pt-BR, `3.94B` for en (the compact suffix is the locale's own). Every public time is server time and says so (`16:01 server`); no UTC twin (owner, 2026-11-05). Relative times (`4 days ago`) are secondary. Per-viewer time zone and date format are later work (#26, #27).
- **Universal symbols where they are truly universal**: ▲ ▼ for change, an outlined dot for stale, a magnifier for search, ✓ ✗ for done/failed. No icons that need a culture to read (no thumbs, no wink, no skull for kills — "Kills" is already the game's word).
- **Every string in `lib/copy.ts`**, none in components, so translation later is a file, not a refactor. Keys are stable identifiers; the value is the English text.
- **The ledger is for the whole server, not for OGs.** Other alliances in the top 10 will use it, so nothing is pinned: order is strictly by rank, and rank numbers (`#1 … #20`) are shown because they are language-free. A viewer may pick _their_ alliance once (tap the tag → "This is my alliance"); it is highlighted and gets a "jump to" control, remembered in `localStorage` for that browser only — a per-viewer convenience, never server state, and the page is correct without it.

## Navigation and hierarchy

- Header: wordmark · event selector · search · theme switch. Nothing else.
- Main page, top to bottom: the title "Server 325 · Event Ledger" with the byline under the header (the 360 px header has no room for it) → the event's date and start time → status strip (last updated / next update chips) → legend → the ledger, by rank, with the viewer's chosen alliance highlighted if they picked one → nothing else. The run buttons live on `/admin`.
- Every card and row is a link to the alliance page; the alliance page is members with the same row shape; the player page is the same shape over time. **One row shape, three depths** — learn it once.
- Back is the browser's back; breadcrumbs only on alliance and player pages (`Ledger › OGs › Player`).
- No modals except the bottom sheet for the PIN; no tooltips that carry information; nothing on hover only.

## Mascot: the Granny Doctor

**As shipped (owner, Session 7 review, 2026-11-04).** She is drawn in the confident-nib line style (`docs/brand/DRAWING.md`) wearing the mark's wide brim: `GrannyStanding` sits small in the footer corner of the error pages and the player page; `GrannyTea` is the empty state. She is a supporting detail, never the focus. The error pages and the empty state lead with her things instead: the yarn ball she left behind (404) and an apothecary bottle broken in two (500, "It's okay, grandma will clean it."). Earlier chunky and 2.5D chibi poses were rejected; the bonnet bust below is a character reference only.

An original character, ours: an old lady in a plague-doctor beak mask, bonnet or kerchief, a cane in one hand and a knitting bag in the other. Dignified, a little stern, funny because she is serious. A first bust of her (bonnet, ribbon bow, ruff), drawn as a candidate mark at the Session 7 mock and kept for the poses, is `docs/brand/granny-doctor-bust.svg`. Single-colour inline SVG, at most three poses (standing with the cane for the 404, dropping a bottle for the 500, pouring tea for the empty state). Game references are allowed as **allusions in copy** — the server number, "KvK", the game's terms — never as its art, characters or assets. Comic but serious: a joke a 40-year-old officer in Russia would also get, never a meme.

## Mark

The logo mark (owner's pick at the Session 7 mock, 2026-11-04): a plague doctor in profile facing left — hooked, riveted beak, goggle eye, cowl — under a wide-brimmed hat, with a ball of yarn and two knitting needles tucked into the hatband where a feather would go. `lib/brand/components/Logo.tsx`, single colour, in two cuts: `MarkLine` (the confident-nib drawing) at 96 px and up — brand sheet, link preview, 192/512 px app icons — and the solid `Mark` for the favicon only (browser tabs blur the line detail). The header (32 px) and the wax seal use `MarkLine` too, by the owner's choice.

## Overview

A guild ledger, kept by hand, in a plague year. The page is aged paper; the ink is near-black; the header is dark plum; a wax-seal red marks losses and warnings; mustard yarn marks gains. Craft shows in the margins — a crochet lace border on the header, a ball of yarn in one corner, a teacup where there is nothing to show — and nowhere else. **The data table stays plain**: high contrast, tabular numerals, one-pixel rules, no texture behind a number. If an ornament ever competes with a number, the ornament goes.

**Key characteristics**

- Paper, not screen: flat `{colors.paper}` canvas, `{colors.rule}` hairlines, no gradients, no glow.
- Young Serif for page titles, the wordmark and error lines; Alegreya Sans 700 for section and card titles; Source Sans 3 for everything else, numerals always `tabular-nums`.
- Colour means something: sign of a delta, a warning, a neutral badge. Decoration never uses the accent colours.
- Square corners (`{rounded.none}`) on tables and cards, 2 px on controls; the one circle is the wax seal.
- Mobile first: designed at 360 px, cards below 640 px, every target ≥ 44 px, nothing hover-only.
- Dark mode is the same ledger by lamplight — swapped token values, nothing redesigned. It follows the system until the viewer taps the header theme switch; that choice is kept in a `theme` cookie (per browser, never server state) so the server renders the right mode on first paint.

## Colors

- **Paper** (`{colors.paper}` — #efe6d3): the page. Dark: `{colors.dark-paper}`.
- **Ink** (`{colors.ink}` — #1e1a1f): all text. Dark: `{colors.dark-ink}`.
- **Plum** (`{colors.plum}` — #3b2436): header, links, primary actions, focus rings. Dark: `{colors.dark-plum}`.
- **Seal** (`{colors.seal}` — #8c2f2f): negative deltas, errors, "stale", the seal button. Dark: `{colors.dark-seal}`.
- **Yarn** (`{colors.yarn}` — #805c12): positive deltas, highlights. Dark: `{colors.dark-yarn}`.
- **Sage** (`{colors.sage}` — #586750): neutral badges — `[TEST]`, "fallback source", "manual". Dark: `{colors.dark-sage}`.
- **Rule** (`{colors.rule}` — #d9cdb4): borders and table rules. Dark: `{colors.dark-rule}`.

Rules: deltas are coloured by sign only; a colour that carries no meaning is not used. Text contrast ≥ 4.5:1, large numerals ≥ 3:1, checked in both modes. Light yarn and sage were darkened on 2026-11-05 (Session 7c, [issue #25](https://github.com/daniro-san/LAPTracker/issues/25)): yarn on paper 4.90:1, paper on sage 4.88:1; before that they were 2.15:1 and 3.46:1. No gradients anywhere.

## Typography

- **Young Serif** (OFL, Google Fonts via `next/font/google`, `display: swap`) — headings, the wordmark, empty-state and error-page lines. One weight (400) with solid, even strokes; synthetic bold is off (`font-synthesis-weight: none`). Never below 20 px. Chosen at the Session 7 review over Cormorant Garamond, whose hairline serifs read thin on phones.
- **Alegreya Sans 700** (OFL, `next/font/google`) — secondary display: section titles (`{typography.display-md}`), card titles and the empty-state line (`{typography.display-sm}`). A calligraphic humanist sans whose pen-like strokes sit with the drawings.
- **Source Sans 3** (OFL) — body, tables, controls. Numerals are `{typography.numeral}`: `font-variant-numeric: tabular-nums`, right-aligned, compact (`3.94B`, `+20.1M`) with the full value in a `title`/tap.
- Three families, each with one job (owner, Session 7 review): Young Serif (primary display), Alegreya Sans (secondary display), Source Sans 3 (text and numbers). No fourth. No italics for emphasis in headings, no all-caps display; `{typography.label}` is the only tracked, uppercase style.

| Token                     | Size | Weight | Use                                       |
| ------------------------- | ---- | ------ | ----------------------------------------- |
| `{typography.display-xl}` | 48px | 600    | Error-page line (the message is the page) |
| `{typography.display-lg}` | 32px | 600    | Page title                                |
| `{typography.display-md}` | 24px | 600    | Section and header title                  |
| `{typography.display-sm}` | 20px | 600    | Card title, empty-state line              |
| `{typography.body}`       | 16px | 400    | Copy, buttons, inputs                     |
| `{typography.body-sm}`    | 14px | 400    | Timeline lines, help text                 |
| `{typography.numeral}`    | 16px | 500    | Every number in tables and cards          |
| `{typography.label}`      | 12px | 600    | Column headers, badges, small-caps notes  |

**Hierarchy on a page (Session 7b, owner's review: titles, labels, values, notes and metadata must read apart).** Five levels, each with its own face, weight or colour, so they separate without words:

| Level          | Style                                                                                    | Examples                                                               |
| -------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Page title     | Young Serif, `display-lg`, ink                                                           | "Server 325 · Event Ledger", `[OGs] OldGrandmas`, a player's name      |
| Section / card | Alegreya Sans 700, `display-md` (section) or `display-sm` (card), plum when it is a link | "Saturday, October 31", "Members", `[NSE] Natural Selection` on a card |
| Label          | `{typography.label}`: 12 px, 600, uppercase, tracked, ink/70                             | MIGHT, KILLS, MEMBERS, START, column headers                           |
| Value          | Source Sans 3, 16 px, 500, tabular, ink; ranks `#n` 600                                  | `4.37B`, `#3`                                                          |
| Change         | 14 px, 500, tabular, yarn / seal / ink/70 by sign, with arrow and sign                   | `▲ +85.8M (+2.0%)`, `▼ −2 · −2 left`, `▲1`                             |
| Note, metadata | 12–14 px, 400, ink/70                                                                    | `Before 96.5M`, `Since previous ▲ …`, times, byline, breadcrumbs       |

Rules separate levels where weight and colour are not enough: a hairline (`{colors.rule}`) under a card's title row, around the legend, and above the Details panel; the drawn rule under the page title band.

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

Depth comes from the paper/plum contrast and hairlines, never from shadows or blur. The one drawn depth cue is the primary button's hatched shading: a pen-hatched block 2 px behind its solid face (`.ink-button` in `app/globals.css`), which the face slides into when pressed.

## Shapes

| Token            | Value  | Use                          |
| ---------------- | ------ | ---------------------------- |
| `{rounded.none}` | 0      | Tables, cards, sheets, pages |
| `{rounded.xs}`   | 2px    | Inputs, badges, buttons      |
| `{rounded.seal}` | circle | The wax-seal button only     |

Paper does not have rounded corners.

## Components

The whole list. Anything else is a composition of these; a new one needs a line here first.

- **`header`** — wordmark + lace border + event selector + theme switch. Plum field, paper text, sticky and compact on phones.
- **`theme-switch`** — one 44 px button in the header showing the current mode (sun / moon icon), `role="switch"`, accessible name "Dark mode". Sets `data-theme` on `<html>` and a one-year `theme` cookie (owner, 2026-11-04).
- **`stat-table` / `stat-card`** — one `StatTable` component: table ≥ 640 px, cards below. Rows ≥ 44 px; numerals right-aligned. The card is simple — rank, picture, `[TAG] Name`, then Might, Kills, Members (or Level) with their change — and the full figures open under a framed "Details ▾" control (owner, 2026-11-05). At ≥ 640 px each value keeps its label as screen-reader text.
- **`history-row`** — the player page's row per event (`PlayerAcrossEvents`, Session 7g, 07c N2): the same card and Details control, turned on its side. `#n` and the event's date on one baseline; Might, Kills and Level are columns (heads inside the card below 640 px, in the table header above); each line under them has its head on the left — the time the values are from (`14:00 server`), `since 10:00` (the change inside the event) and `since Oct 24` (the change since the previous event) — so the two changes sit in the same columns and read apart. Below 640 px the percent goes under the change. The alliance is named on the row only when the player has been in more than one; the before values are in Details (snapshot times as heads, the in-alliance rank in `Rank`).
- **`details-table`** — what "Details" opens, the same at every depth (`DetailTable` in `app/_ui/DetailLines.tsx`, Session 7d, 07c B2): one small table, a row per figure (Might, Kills, Members, then Ranking — the game's server rank), the two moments as column heads — the snapshot times (`Server time` in the corner, `10:00`, `→ 14:00`, with `○`/`✗` beside a side that is stale or failed) or, on an alliance's history rows, the two events' dates — then `Change` (no percent: the card has it) and `Rank`, the ledger rank `#n` with its move (owner, 2026-11-05: heads in words, "Ranking" for the server row). Tabular, right-aligned; notes in seal under the change.
- **`delta-up` / `delta-down`** — `value · ±delta with arrow · ±%`; kills with the member-loss note when negative.
- **`status-strip`** — two `Chip`s (`lib/brand/components/Chip.tsx`: the soft drawn frame in the tone colour — ink once a run has finished, whatever its state, plum running, muted not yet — with the icon): `Last updated at <date, time> server` (`Last update failed at …` when the run failed) and `Next update at <date, time> server` — this event's next snapshot while one is ahead, else the next on the schedule, so a past event's page still says when numbers next change (owner, 2026-11-05); replaces every status sentence. The Discord public message uses the same chip as its title. When rows are stale or failed, a separate seal `○ n stale` sits between them; the time chip itself is never red (Session 7d, 07c B1: a red chip made readers distrust the one time the page gives). Quota and run errors are on `/admin`, never here.
- **`legend`** — one line under the page title (`Legend` in `app/_ui/Status.tsx`): ▲ Up, ▼ Down, = Same, # Rank, ○ Stale, ≈ Rounded (compact numbers round to three digits, 4,495,958 shows as 4.50M; the item points at the Exact numbers toggle). Nothing else explains a symbol. History rows show the time their figures are from (`Sat, Oct 31  10:00 server`) instead of a `B` box (Session 7d, 07c S1).
- **`rank`** — `#n` before the picture on every card and row, with its movement `▲k` / `▼k` / `=` / `—` (`Rank` in `app/_ui/Num.tsx`, `compute.rankDelta`); the Details table shows the might and kills rank and the server rank `#a → #b`. An alliance the after snapshot could not rank reads `#—` and sorts after the ranked ones; its earlier rank stays in Details (07c S8).
- **`alliance-summary`** — the alliance page's totals as one band under the legend, not a card that repeats the page title (Session 7f, owner 2026-11-05): three columns Might · Kills · Members, each label, value, change; under them `RANK #n` with its move, the stale mark and the same "Details ▾" `details-table`. `Summary` in the alliance page.
- **`member-filter`** — the alliance page's member controls (`app/_ui/MembersExplorer.tsx`, rules in `app/_ui/member-views.ts`; Session 7f): a name search; sort chips `Might · ± Might · Kills · ± Kills · Level · A–Z` (tap a chip to sort by it, highest first; tap it again to flip; the active chip is plum-filled with `↓`/`↑`; one scrolling row below 640 px); one might range with two thumbs whose stops are the roster's own values (`.range-pair` in `app/globals.css`), its span shown above it; and a framed `✕` chip per active filter that clears it, plus "Clear all". The list shows the first 20 members in the current order and a "Show all (n)" button. The count line reads `Members 97 / 100`: members in the alliance now over the capacity the API reports (`alliance_snapshots.capacity`; without one, only the count), plus ` · 12 shown` only while a name or might filter is on. While only one roster exists (the After has not run, or failed) the list is that roster: no Joined / Left, no change line under the figures, no `±` sort chips, rank without a movement mark (`StatMetric.noChange`, `Rank` without `move`).
- **`breadcrumbs`** — alliance and player pages only: `Ledger · Sat, Oct 31 › [TAG] Name › Player` (`app/_ui/Breadcrumbs.tsx`); each crumb ≥ 44 px tall.
- **`my-alliance`** — "My alliance": a framed checkbox beside "Exact numbers" at the right of the alliance page's title row (Session 7f), and on the main page a jump link to that row, which is tinted yarn (`app/_ui/MyAlliance.tsx`, `localStorage` only).
- **`alliance-badge`** — the alliance's own emblem (one of the game's ten presets, served by `/img/badge/[id]`) at 28 px beside the tag on rows and cards, 40 px beside the alliance page title. Without one: the drawn crocheted banner (`NoBadge`). `AllianceBadge` in `app/_ui/Pictures.tsx` (owner, 2026-11-05; DECISIONS D22).
- **`avatar`** — the player's photo (served by `/img/avatar/[uid]`) in the soft drawn frame, square, 32 px on member rows and 56 px beside the player page title. Without one: the Granny Doctor in profile (`NoPhoto`). `PlayerAvatar` in `app/_ui/Pictures.tsx`. Photos and badges are content, not ornament, so they may sit on rows and cards; their placeholders go wherever they would.
- **`badge`** — sage neutral chip: `[TEST]`, source, manual. Never red or yellow.
- **`wax`** — one hand-drawn wax seal in three tones (`Wax`, `WaxedMark`): `seal` red for confirm/destructive, `paper` ivory for the header logo (the inverse of the plum bar, so it holds contrast in both themes), `yarn` gold spare. Each tone carries its own ink colour for what is pressed into it.
- **`seal-button`** — the wax seal: destructive or confirming actions (`/admin`: Rehearse, Before snapshot, After snapshot). Circle, ≥ 44 px.
- **`button-primary`** — plum, 2 px radius, hatched shading behind it (`.ink-button`); one per view at most. The face stays solid so the label keeps its contrast; on press it sinks the 2 px onto the hatching. `Button` / `buttonClass("primary")` in `lib/brand/components/Button.tsx`.
- **`button-secondary`** — paper face, plum label, inside the drawn frame (a two-stroke pen box, `public/brand/frame.svg` as a nine-slice mask; a plain 1 px border where the browser lacks `-webkit-mask-box-image`). `Button variant="secondary"` / `buttonClass("secondary")`.
- **`input`** — paper field inside the soft drawn frame (`.drawn-field`, also on `<select>` with a drawn arrow); PIN uses `inputmode="numeric"`. Checkboxes are `.drawn-check` (use `check-field`, never a bare `<input type="checkbox">`): a framed box that fills with the stitched check. Frame, check and arrow are token data URIs in `tokens.css` (form controls take no pseudo-elements).
- **`check-field`** — `CheckField` (`lib/brand/components/CheckField.tsx`): a `.drawn-check` box, a label and an optional one-line help saying what ticking it changes. Variants: `row` (forms; ≥ 44 px, box 22 px, help under the label, `disabled` dims it and the help says why) and `chip` (compact framed toggle beside a page title; `ExactToggle`, `MyAllianceToggle`). Extra props go to the `<input>` (`checked`, `onChange`, `disabled`, `id`). Use it for any on/off setting.
- **`radio-field`** — `RadioField` (`lib/brand/components/RadioField.tsx`): one option of an exclusive choice, in the soft drawn frame with the label and a one-line help; the radio is native with the plum accent (24 px, the whole frame is the ≥ 44 px target). Use inside a `<fieldset>` with a `<legend>` and one `name`. Use instead of a select when there are three options or fewer, so each can say what it does.
- **`notice`** — `Notice` (`lib/brand/components/Notice.tsx`): a short message in the soft drawn frame, `role="status"`. Tones: `ok` (ink, stitched check), `busy` (plum, hourglass), `fail` (seal, dropped stitch), `info` (ink, no icon, for neutral facts such as "Not due until …"). The words always say the state too. Use for the outcome of a press and for what is running; not for validation under a field.
- **`fact-list`** — `FactList` (`lib/brand/components/FactList.tsx`): label and value pairs, one per ruled line; the label is small and muted (144 px column, 192 px at ≥ 640 px), the value reads at body size and wraps. For a summary of settings or state (`/admin`'s schedule and round). Numbers that need columns are `stat-table`.
- **`exact-toggle`** — "Exact numbers": a compact framed toggle at the right of the page's title row on every page (`app/_ui/ExactToggle.tsx`; owner, 2026-11-05: the same place on every screen).
- **`drawn-rule`** — a pen hairline that swells and thins (`<hr class="drawn-rule">`, `public/brand/rule.svg`) for section dividers and the footer top; the data table keeps plain 1 px rules.
- **`bottom-sheet`** — PIN entry and confirmations on phones; the only shadow. `Sheet` (`lib/brand/components/Sheet.tsx`) is the one component: a real `<dialog>`, modal when an action asks (focus moves in and returns, a child marked `data-initial-focus` gets it first, Escape calls `onCancel`), and at ≥ 640 px a centred card; with `gate` it stays open in the page flow as a card under the heading (the `/admin` PIN gate). `role="alertdialog"` for a question. `ConfirmSheet` and `PinSheet` are built on it (Session 7d, 07c S3, S6).
- **`empty-state`** — the Granny Doctor with her tea (line drawing) + one display-sm line ("Nothing recorded yet. The kettle is on.").
- **`search-pending`** — while a player search runs longer than 300 ms, the results give way to the Granny Doctor bent over the open ledger with her magnifier (`GrannyLedger`) + one display-sm line ("Grandma is leafing through the ledger…") in a `role="status"` region; header, title and field stay (`PlayerSearch` in `app/_ui/PlayerSearch.tsx`, Session 7h). A quicker answer swaps the results with no drawing.
- **`timeline`** — `run_logs` rows: time, level, code, alliance tag, the data that matters.
- **`error-page`** — 404 "Grandma wandered off." and 500 "Something cracked.": the line set large is the page; the Granny Doctor is a small detail beside it (owner, Session 7), one original inline SVG and one CSS keyframe loop each.

Ornament budget: header lace border, one footer corner per page (the yarn ball, or the Granny Doctor on the error and player pages), the seal buttons, the primary button's hatching, empty states, the search's pending state, error pages, favicon. All of it is drawn in one hand: `docs/brand/DRAWING.md`. Never behind numbers, inside cells, on cards, as backgrounds or dividers. Every ornament is an original single-colour inline SVG under 4 KB (4,096 bytes as rendered into the page), `aria-hidden`. Nothing from the game.

## Motion

Only where it carries meaning or a smile: the error-page illustrations (one keyframe loop each, 2–4 s), the search's pending magnifier (one 3 s loop, shown only after 300 ms of waiting), the freshness dot while a run is live, the bottom sheet entering (200 ms ease-out). Everything stops under `prefers-reduced-motion: reduce`. No page-load animation, no parallax, no shimmer skeletons; a wait elsewhere is a plain "Loading the ledger…" line.

## Voice

Short, dry, grandmotherly, English. The ledger belongs to the server and is _kept_ by the Old Grandmas — that is the branding's place: title "Server 325 · Event Ledger", byline "kept by the Old Grandmas" in the header and footer, the mascot in the margins. Another alliance reading it should feel invited, not visiting. Columns "Might", "Kills", "Members", "Gained / Lost". States: "Nothing recorded yet. The kettle is on." · "The ledger is closed for today (quota exhausted)." · "Grandma wandered off." · "Something cracked." No exclamation marks, no emoji, no "Oops", no "Awesome".

## Do's and Don'ts

### Do

- Lead with paper and ink; let plum, seal and yarn each mean one thing.
- Keep every number in `{typography.numeral}`, right-aligned, compact, full value on tap.
- Put craft in the margins: header, corner, seals, empty states, error pages.
- Design at 360 px first and screenshot 360 / 390 / 1280 in both modes.
- Change this file in the same commit as the tokens when a decision changes.
- Run the ten-second test with a real member who reads no English before calling a page done.

### Don't

- Inter, Roboto or system-ui for display; a fourth typeface for anything.
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
