# 11av — Desk Members and Former members as list and detail (issue 412, rollout PR 3 of D122)

## Built

- **Members and Former members use `MasterDetail`.** The page passes `wide` to `SignedInFrame`.
  - From 1024: the list on the left (7/12) and the open member on the right (5/12), sticky 8 px from the top, level with the list's search field. The open row is tinted plum 15 % with a 3 px plum bar and has `aria-current`. With nothing open, the right column says "Pick a member to see their info."
  - Below 1024: the bottom sheet, as before.
  - Everything that was in the column stays in the list column, in the same order: the read, the week, the thanks, the check-in line, the legend, the new members, the list, and "Import the old spreadsheets". Nothing follows the list and its pane on the page.
- **The open member is in the address, `?m=<uid>`** (`app/(private)/_ui/open-member.ts`: `useOpenMember`, `useWide`, `stepRow`, `shown`).
  - From 1024, a press on a row, or Enter on it, pushes `?m=`. Back goes to the member before, then to none, and stays on Members.
  - Below 1024 the address is only replaced; the sheet keeps its own history entry, as before. A shared link opens the sheet on a phone and the pane on a laptop.
  - A resize across 1024 moves the open member between the sheet and the pane.
  - The filters' address writer keeps `m`.
  - A new member's `m` is its negative uid (D106).
- **Keyboard.** Up and Down move the focus to the row before or after. From 1024 that row opens in the pane, replacing the address instead of adding a history step. The focus stays in the list. The pane's Close gives the focus back to the open row. Tab moves through the rows; Enter opens.
- **One component, two containers.** `Sheet` takes `pane`: the same title row, content and sticky bar, drawn in a framed box that scrolls on its own, with the thin scrollbar (`[data-sheet-pane]` in `globals.css`).
  - The drawn frame is on the outer box, since inside a scroller it would scroll away.
  - The pane is at most the window's height less 40 px, so at the end of the list it never loses its title.
  - In the pane, the bar's two buttons never break a label; when they do not fit side by side (PT at 1024), each takes a full row.
  - `MemberSheet`, `PendingSheet` and the former member's sheet pass `pane`. `MembersRoster.tsx` (new) holds the open member for the list and the new members, and renders the pane or the sheet.
  - The bar and the title row moved unchanged to `lib/brand/components/sheet-parts.tsx`, to keep `Sheet.tsx` under 300 lines.
- **The list on `ResponsiveTable`.**
  - Below 640: today's compact rows (`compact`: hairlines, no gaps).
  - From 640: one table per group ("To check in with or help", "Everyone else", the tails), each under its existing heading. Columns: Members (photo, rank, name, then the status, "was …", "To ask" and their time), the order's number, and Donated.
  - From 1440 (`wide`): the other two of might, kills and main squad.
  - A press anywhere on a row opens it (`onRow`); the name cell's button is the keyboard's way in.
  - The head row sticks under the search bar (`--table-head-top`, 7 rem + 1 px). The bar's own column labels now show below 640 only.
  - The number columns have set widths, so the groups line up.
  - In the table the status line wraps (`text-pretty`) instead of being cut, because a cut line widened the table at 1024.
- **Chips.** "R4 and R5" and "Missing info" are one row that scrolls inside itself. The search bar stays inside the list's column from 1024, and follows the page margins (16 / 24) below.
- **Page head.** `PageHead` holds the title and two actions: "Paste updates" (main) and "Add a new member". On a phone: "Paste updates" and "More ▾" with "Add a new member". Both open sheets held once on the page (`PageActions.tsx`: `ActionButton`, `usePageAction`), because `PageHead` draws each action twice. In the More list a framed button is a plain row, and the list has the sheet's lift.
- **Former members.** The same pane, `?m=`, arrow keys and tint. Its rows stay a list, not a table (see Deviations).
- **Words:** "Pick a member to see their info." (`members.pick`) and "More" (`desk.more`), in EN, PT-BR and FR.
- **Docs.**
  - `docs/DESIGN.md`: master-detail as built, tables and their sticky head, `MasterDetail`, `ResponsiveTable`, `MoreMenu`, the 15 % tint, the elevation table and the rollout status.
  - Dated amendments to D106 ("Add a new member" moved to the page head) and D109 ("Paste updates" is the head's main action).

## Decisions

- No new decision. D122 and its amendment cover this. D106 and D109 are amended for the moved buttons.
- **The open-row tint is 15 %, not 10 %.** The persona panel found 10 % read taupe in light mode, close to the hover tint. The navigation already uses 15 % for the same reason (11aq).
- **The table head is sticky from 640, not from 1024.** The column labels used to stick inside the search bar at every width. The table now carries them from 640, so they keep sticking there.
- **Arrow keys open the row the focus lands on, from 1024 only.** Below 1024 the open member is a modal sheet, so moving the focus must not open one. Tab does not open rows: each open reads the card from the server.

## Deviations

- **"Send a screenshot" is not a page-head action.** It is a widget whose progress, errors and results show in place (11at). It stays under the head, above the Members / Former members switch.
- **"Add a new member" moved** from under the new members to the page head (More on a phone). It is the page's second action, and the phone row needed one for "More". D106 is amended.
- **No previous/next control in the pane.** The panel asked for one if it was cheap. The arrow keys already step through the list's order, and a ‹ › in the pane would need the list's visible order passed to the pane.
- **Former members keeps list rows, not a `ResponsiveTable`.** Its rows are made of preformatted lines ("Might 14.2M · Kills 152K", the duel week, a summary). Those have no column values to put under a head.
- **No extra columns for roll calls or last talk.** D122 names them for 1440, but the list's data has neither. The rollout plan says layout only, no new reads.
- **"Main squad" still reads "— · T11" when only the tier is known.** This is the documented format of `squadText`, unchanged here (see Open issues).
- No new tests. The task did not ask for them. The behaviour is covered by the e2e below.

## Verified

- **`pnpm check` exits 0** on the final tree: prettier, eslint, tsc, vitest (**216 files passed, 2 skipped; 1,174 tests passed, 4 skipped**), the drift check and i18n.
- **Local production build** on :3998:
  - Database: this worktree's Postgres 18, 49 migrations.
  - Seed, invented names only: 36 members read on three server days; three former members (one with a note); one new member waiting; facts; Bramble with 4 squads and 12 heroes from an invented catalog.
  - Stand-ins: the Discord sign-in, and the hero pictures on 127.0.0.1. Every https call is blocked. No upstream, Discord or Groq call was made.
  - The scripts are in scratchpad `11av/`.
- **e2e, 49 of 49 checks pass** (`11av/e2e.mjs`):
  - pane, URL and history at 1280: click and Enter open the pane; a click on a number cell opens that row; back goes to the member before, then to none, on Members;
  - keyboard at 1280: Up and Down move the focus and open the row; Tab moves along the rows; Close puts the focus back on the row and clears `?m=`;
  - sticky parts at 1280: the search bar sticks at 0, a head row sticks right under it (bar 113 px), and the pane stays in view while the list scrolls;
  - the pane's actions: Edit info opens the editor; "Paste what they told you" shows "Read from a screenshot"; "Paste updates" and "Add a new member" open their sheets;
  - new members: one opens in the pane with Remove and Link (`m=-1`), and a filter keeps `?m=`;
  - the 4 squads (12 hero pictures) show in the pane;
  - widths: three columns at 1024, five at 1440;
  - phones (360): a `?m=` link opens the sheet; back closes it and clears `?m=`; a tap opens and Close closes the sheet; "More" holds "Add a new member"; the chips stay one row;
  - a resize from 1280 to 800 and back moves the member between the pane and the sheet;
  - Former members: pane, `?m=` with `view=former`, ArrowDown opens the next one, back closes;
  - no request left the machine.
- **Shots:** 80 before and 80 after, of the list, Bramble open (4 squads), Former members, and a former member open. Widths 360 / 768 / 1024 / 1280 / 1440, light and dark, EN and PT-BR.
  - Folders: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11av-shots/before/` and `.../after/`, each with a `metrics.json`.
  - `after/` also has the `check-*` viewport shots: the list scrolled with the pane open, the editor over the pane, a new member in the pane, and the phone's More menu.
- **No page scrolls sideways**, before or after (0 of 80 each).
- **Page height (px), list view, before → after.** The open view has the same heights. Former members: 900 / 1,021 at every width, before and after.

  | Width | EN            | PT-BR         |
  | ----- | ------------- | ------------- |
  | 360   | 2,945 → 2,893 | 3,067 → 3,015 |
  | 768   | 2,850 → 2,896 | 2,850 → 2,896 |
  | 1024  | 2,850 → 2,957 | 2,850 → 2,957 |
  | 1280  | 2,798 → 2,852 | 2,798 → 2,913 |
  | 1440  | 2,798 → 2,913 | 2,798 → 2,913 |

  - At 360 the page is 52 px shorter: "Paste updates" and "More" share one row.
  - From 768 it is 46–115 px taller (2–4 %), because of:
    - a head row on each group's table;
    - status lines that wrap in the 7/12 column (at 1024 and 1440 the column is about 500 and 660 px wide).
  - The list of 25 rows sets the height. The gain from 1024 is that a member opens beside the list instead of over it.
  - Main content width: 936 at 1024, 1,056 at 1280, 1,200 at 1440 (was 936 / 960 / 960).
- **Persona panel** on the after shots (product designer, R4 on a 360 phone in PT, R5 on a laptop, officer on a tablet): all four accept with changes. Fixed:
  - must-fix: the pane's bar broke "Colar o que a pessoa disse" onto two lines at 1024 (now a row each, labels whole);
  - must-fix: the open row in the plain lists (Former members, New members) had no padding and a greyer tint (now 8 px padding, the table's tint, no hover layer);
  - nice-to-have: one word alone on a status line's second line (`text-pretty`);
  - nice-to-have: the open tint reading taupe (15 %);
  - nice-to-have: the pane 8 px lower than the search bar when scrolled (now level with the field);
  - nice-to-have: the More list reading like a page button (now a plain row with the sheet's lift).
  - Not done: previous/next in the pane, and "— · T11" (see Deviations and Open issues).
- **Privacy:** none of the 2,064 fixture player names is in the diff's 871 added lines. The shots use invented names only.

## Open issues

- **"— · T11"** in Main squad when only the tier is known. This is the documented `squadText` format (`member-list-data.ts`), also used by the squad order and the copy. Showing "T11" alone would change copy outside this PR.
- **"Activity 0" alone on a line** in the pane's figures at 1024. These are the card's own nowrap facts, the same as on a phone.
- **Previous / next in the pane** (persona panel). The arrow keys do this for keyboards; a mouse user goes back to the list.
- At 1024 the pane is about 360 px wide, the same as the phone sheet. The card's 7-day donations grid is tight but fits.
- **Focus after More:** when an action is chosen from the phone's More menu and its sheet closes, the focus goes back to the closed menu's row, which is hidden. The page does not jump. Pre-existing in `MoreMenu`'s design; this is its first use with a sheet.

## Next

- Model/effort: keep the plan's level for rollout PR 4 (Calendar and Notices).
  - Reason: this PR took one build round plus one panel round. PR 4 starts with a mock for the panel, as 11ap planned.
- What the owner must do first: merge. There is no migration and no environment change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; this work runs from issue 412.

<adjustments>
- Follow-up (rollout PR 5) gets master-detail from `useOpenMember` and `Sheet`'s `pane`:
  - keep the open state where the detail is rendered (`MembersRoster`'s pattern);
  - pass `pane` to the sheet;
  - put the list and everything else of the page in `MasterDetail`'s `list`, so nothing follows the grid.
- Page-head actions that open a sheet use `ActionButton` and `usePageAction` (`PageActions.tsx`) inside a `PageActions` provider. A widget with its own visible state still cannot be an action.
- `ResponsiveTable` now has `onRow`, `compact`, a column `width`, and a head that sticks under `--table-head-top`. A page with its own sticky bar sets that variable to the bar's height.
- From 1024, a sticky element beside a list has to fit in the window less its top offset and the page's 20 px bottom padding, or the end of the list pushes it up.
- Seed for Members shots: scratchpad `11av/seed.mjs` (36 members, three former, one new, four squads), with `hero-stub.mjs` for hero pictures.
</adjustments>

PR: (added by the orchestrator)
