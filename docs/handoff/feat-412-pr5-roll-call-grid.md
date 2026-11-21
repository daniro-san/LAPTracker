# feat-412-pr5-roll-call-grid — the roll call as a grid, marked members folded

Issue #412, rollout PR 5 (Roll call). Owner: "a grid instead of rows in the roll call, or paging", and the owner's 2026-11-19 comment on #412 for PR 5.

## Built

- **Tiles instead of rows** (`RollCallMarks.tsx`, `RaidPrepRow.tsx`, the new `RollCallGrid.tsx`).
  - Each member is a hairline tile with three parts: the name, the mark in words ("Not set" while there is none), and the ✓ / ✗ pair.
  - "Not set" keeps every tile the same height, so a mark never pushes the next row down.
  - Buttons are 44 px tall and half the tile wide (about 68 × 44 at 360).
  - A tile with every part marked has a 4 % ink tint.
  - Columns: two at 360, three from 640, four from 1024. Raid prep's tiles (two pairs, the tracker line, the message) are one, two and three across.
  - Tiles are top-aligned, so a conflict note grows only its own tile.
- **To mark first, then "Marked (n)".**
  - The page opens on the "To mark" chip, showing the tiles not set in D103's order.
  - Under them, "Marked (n) ▾" is closed. It is a 44 px heading button with `aria-expanded`, and it holds everyone who was marked when the page opened.
  - Opened, it shows 40 tiles at a time, then "Show n more".
  - Away members stay apart at the end, as before.
- **Filter chips:** "To mark n · ✓ n · ✗ n · All n", with live counts, in one row that scrolls sideways when needed.
  - ✓ means every part is ✓ or "no problem seen".
  - ✗ means any part is ✗.
  - "To mark" means any part is not set. On Raid prep that is either of its two marks.
  - Not set is never counted under ✗.
  - Screen readers hear the ✓ and ✗ chips by the kind's words ("Took part: 49"). Raid prep uses "49 marked ✓".
- **Nothing moves under the thumb.**
  - The sections are taken when the page opens, and again on every chip tap (the chip already chosen too).
  - A mark, "the rest", Accept and Undo never re-sort. A tile marked meanwhile stays where it is until the next chip tap.
  - When nobody is left to mark, "Nobody left to mark." shows above those tiles.
- **Search** covers every member, folded ones included. The chips hide while the search box holds text.
- **"All marked"** shows beside "58 of 58 marked" at the top. When nothing is left, the sticky bar goes. The result line with Undo after "the rest" is unchanged.
- **Kept as they were:**
  - one POST per tap, with the version the officer saw;
  - the 409 conflict line;
  - "the rest" and its Undo, and "Undo the rest";
  - Accept the tracker's;
  - the message;
  - away dates;
  - D100 request ids on adds (`AddRollCall` was not touched).
- **Persona fixes** (see Decisions):
  - The legend line is now the summary of "How this works".
  - Raid prep's two tracker explanations moved inside "How this works". The tracker card keeps its read lines and Accept.
  - Raid prep's bar reads "Shield: 61 not set · 16 not seen yet, left out", so its numbers match the button ("Mark the other 45").
  - Raid prep's pair labels wrap instead of being cut off. Both pairs share a subgrid, so their buttons stay level.
  - The sticky bar has a 4 px paper shadow below 768, so rows no longer show between it and the tabs.
- **Words**, in EN, PT-BR and FR:
  - new: `roll.grid.*` (9 keys) and `roll.prep.notSeenLeft`;
  - reworded: `roll.order`, which now names the Marked fold. No decision quotes it.
- **Pure rules** in `app/(private)/_ui/roll-call-grid.ts` (`matches`, `gridCounts`, `takeSnap`, `sections`), with `roll-call-grid.test.ts` (3 tests).
- **Docs:**
  - D103 has a dated amendment (2026-11-20).
  - The "Mark pair" entry in DESIGN.md now describes tiles, chips, the fold and the 44 px pair.

## Decisions

- **No new decision record.** The change amends D103: order, "All marked" and the bar.
- **A grid at every width.** The owner's comment said "below 768, keep the rows". The later request relayed by the orchestrator asked for a compact grid at 360, and I followed the later request. If the owner wants rows back below 768, change `COLS.one` in `RollCallGrid.tsx` to `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` and swap the tile for a one-line row.
- **Sections are a snapshot, refreshed by chip taps.** D103 says "a tap never moves a row", and the owner asked for marked members to collapse. Both hold only if the fold is taken at a chosen moment: when the page opens, and when a chip is tapped. Re-tapping the chosen chip sorts again; `roll.order` says so.
- **✓ includes "no problem seen".** The ✓ chip lists who is done, and D137 already counts "no problem seen" as done for the message.
- **Raid prep's "marked" means both marks are set.** A member with only the Shield marked stays under "To mark" until Squads off the wall is marked too.
- **Persona panel, 2026-11-20.** The three personas were an R4 marking 100 members on a 360 phone during an event, a product designer, and product strategy. **All three said "ship with fixes."** Applied:
  - Before the fix, the first screen at 360 showed one row of tiles. The legend became the summary of "How this works", which saves 44 px, and the first two rows now show.
  - Raid prep's three numbers (71 / 61 / 45) now say what each counts. The bar names the part and the not-seen members left out.
  - The tracker card's explanations moved into "How this works", so the tiles start higher on Raid prep.
  - The grid's tiles are top-aligned (a conflict note no longer stretches the tile beside it).
  - Pair labels wrap and both pairs share one subgrid ("Esquadrões fora da …" was cut off at 1280 in PT).
  - The gap between the sticky bar and the tabs is covered.
  - The "To mark 0" state shows "Nobody left to mark."
  - The chips' spoken names use the kind's words.
- **Persona findings not applied, with reasons:**
  - "'Message' looks under 44 px" (R4): the e2e measures its summary at 44 px or more. It is styled as a text link, as elsewhere.
  - "One word for To mark / not set" (product): "To mark" is the owner's chip word and "not set" is D103's count word. On Raid prep they count different things (members vs Shield marks).
  - "Drop 'Not set' inside To mark" (R4, later): it keeps every tile the same height, and it states the default (D75).

## Deviations

- **Below 768 the issue comment said rows. This PR uses tiles** (see Decisions).
- **D122 planned "the marks in two columns from 768, read down each column | the counts and 'Mark the other n', sticky" as a ledger spread.** This PR keeps the legacy 960 px width and does not use `Spread` or `wide`. The grid reads row by row, as `CardGrid` does, because a phone gallery reads that way. Columns read top to bottom would put member 51 beside member 1 on a phone.
- **The ✓ / ✗ buttons are 44 px tall, not 48.** DESIGN.md's "Mark pair" said 48 px square. A 44 × 68 px button is still a bigger target than 48 × 48, and the DESIGN.md entry is updated.
- **The "How this works" summary now holds the legend text**, so its accessible name is the whole legend followed by "How this works".

## Verified

- **`pnpm check` exits 0**: prettier, eslint, tsc, vitest (265 files passed, 2 skipped; 1,386 tests passed, 4 skipped), drift, and i18n (17 languages up to date).
- **New test:** `app/(private)/_ui/roll-call-grid.test.ts` has 3 tests:
  - "To mark" lists the not set, folds the marked, and keeps both while marking; a new snapshot folds the newly marked;
  - search looks through the folded;
  - Raid prep's two marks: "to mark" while either is not set, ✓ only when both are done, and ✗ never holds not set.
- **Local production build** (`next build`, then `next start` on :3512):
  - local Postgres 18 with all 60 migrations, and the D47 bridge;
  - OGs with 101 invented members;
  - an Undead Siege roll call with 55 marked (6 ✗), and Raid prep with 40 Shield marks and 30 wall marks;
  - invented tracker readings, and a stubbed officer session;
  - no upstream, Discord or Groq call (every outside URL points to 127.0.0.1:9).
- **The e2e (`412p5-e2e/shots.mjs`) passes 165 of 165 checks.** It covers:
  - both roll calls at 360, 640 and 1280, light and dark, in EN, in PT at 360 and 1280, and in FR at 360. On each: status 200, no sideways scroll, every button, summary and tile at least 44 px, chip counts ("To mark 46" / "To mark 71"), "Marked (55)" / "Marked (30)", and the number of tiles;
  - opening Marked shows 40 tiles and "Show 15 more";
  - **a tap sends exactly one request (`POST /api/w/ogs/roll-call`) and nothing else**, the tile does not move, and the chip count follows (46 → 45);
  - a chip tap folds the marked tile ("Marked (56)");
  - a search finds a folded member;
  - an officer's newer mark inserted in the database comes back as "… marked “Not this time” …" on the tile (409);
  - "the rest" marks everyone and shows "All marked" by the counts and "Nobody left to mark."; Undo brings back 44 not set;
  - Raid prep: the bar reads "Shield: 61 not set · 16 not seen yet, left out" beside "Mark the other 45 as no problem seen"; the tracker notes are folded; both pairs' buttons are level; a wall tap keeps the tile and turns it "All set".
- **Columns measured:** 2 / 3 / 4 for one mark, 1 / 2 / 3 for Raid prep.
- **Page heights** (the To mark view as it opens, EN, light):

  | Page           | 360    | 640   | 1280  |
  | -------------- | ------ | ----- | ----- |
  | Undead Siege   | 3,616  | 2,711 | 2,167 |
  | Raid prep      | 18,475 | 9,976 | 6,987 |
  | Raid prep (PT) | 20,107 | —     | 7,474 |

  - The rows page was not measured before the change.
  - Raid prep stays long at 360: one tile per member, with two pairs, the tracker line and the message.
- **Shots:**
  - `412p5-shots/` (before the persona fixes), `412p5-shots-2/` and `412p5-shots-3/` (after);
  - full page, the first screen (`-top`) and Marked open (`-open`) for each width and mode;
  - `tap-360`, `conflict-360` and `rest-360`.
- **Privacy:** none of the 386 names in the fixture rosters appears in the added lines. The seed and the shots use invented names only.

## Open issues

- **The read status bar** (D135) is about 65 px on every desk page at 360. With the header, it is why the first tile starts near 550 px. That belongs to the frame, not this page.
- **At 360 in PT and FR, "the rest" bar takes three to four lines.** Raid prep's "Marcar os outros 45 como nenhum problema visto" wraps. Shorter words would need the owner's wording.
- **The tracker line wraps its times** ("· 11:40 your time" alone on a line at 1280; designer, should-fix). D137's `Times` would need `nowrap` groups. Not done here.
- **The sticky bar spans the content's gutter at 1280** (x 272–1232 against content 296–1208), as built in 11ay. The designer asked to clamp it to the content.
- **"Not this time" in sage** (11ay finding 19) is unchanged.
- **Raid prep at 360 is still one long column of tiles.** If the owner finds it too long, a later change could fold the message into the tile's header.
- **To measure after release** (product), as aggregates only and never per member:
  - time from opening a roll call to "All marked";
  - chip, search and "Show more" use;
  - "the rest" use;
  - the 409 rate.
  - If "Show more" is almost never used, the paging can go.

## Next

- **Model and effort:** keep for rollout PR 6. This PR took one build, one persona round and two fix rounds; the e2e found nothing the panel had not.
- **What the owner must do first:**
  - confirm the grid below 768. His comment said rows; this PR uses tiles at every width;
  - merge.
  - There is no migration and no environment change.
- **Plan change:** none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; this work runs from issue 412.

<adjustments>
- The roll call grid is `RollCallGrid.tsx` (`useGrid`, `RollGrid`, `tileClass`) over the pure `roll-call-grid.ts`. A new roll call kind passes its parts to `useGrid`: one mark as `[mark]`, Raid prep as `[shield, wall]`.
- `Intro` takes `more` lines for "How this works". `RestBar` takes `part` and `rest`, and names the members left out when `rest < left`.
- The mark page is still on the legacy 960 px width. Moving it to `wide` and a `Spread` (D122's "counts in the margin") is the remaining part of PR 5's plan.
- Seed and e2e: scratchpad `412p5-e2e/` (`gen.mjs`, `reset.mjs`, `shots.mjs`; `with-env.mjs` with `E2E_NODE_OPTIONS="--import <repo>/scripts/db-local-preload.mjs"` for the bridge).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/529
