# 11ay — Desk UX pass: the sticky margin, Calendar, roll call bar, board clamp, no-data marker (issue 412)

## Built

- **The sticky margin column fits the window (the owner's bug).** On Home from 1024, "Show more" three times made the margin 4,441 px tall at 1280 (window 800) and the page 4,653 px, with an empty main column below its cards.
  - `Spread` with `stickyMargin` now wraps the notes in `MarginPane` (`lib/brand/components/layout/MarginPane.tsx`, new). From 1024 it is at most the window's height less 48 px, scrolls on its own and uses the desk's thin scrollbar (`[data-margin-pane]` joins the scrollbar rule in `app/globals.css`). It has a stable gutter, 4 px inside it so focus rings are not cut, and a bottom scroll padding.
  - While its notes overflow, the pane is a region in the tab order, named by its notes' heads (`marginLabelledBy`; Home passes `home-activity home-members`). Arrow keys and Page Down scroll it. When everything fits, and below 1024, it is a plain box with no tab stop.
  - Recent activity's "Show more" / "Show less" row sticks to the pane's foot from 1024 (`ActivityFeed.tsx`), so the buttons stay in view while the lines run past.
  - "Show more" used to drop the keyboard focus to the page: the button is disabled while it reads, which blurs it. The focus now goes back to "Show more" (or to "Show less" after the last page), without scrolling, so the new lines stay where the officer reads.
  - Below 1024 nothing changes.
- **"On the desk now" shows only when another officer is there** (owner). The "Just you." row is gone, with its words in EN, PT and FR (`desk.alone`). D108 is amended.
- **Calendar** (owner, two items):
  - It opens at the top; the scroll to today on load is removed. Only an address naming a day (`#d-<day>`) or an Undo line scrolls.
  - The head row (`CalendarHead.tsx`, new) holds the title, a "Today ↓" chip (PT "Hoje", FR "Aujourd’hui"; only while the week shown holds today) and "Add an event". "Today ↓" is a link to today's day card that also moves the focus to its heading (`tabIndex=-1`).
  - Every entry in a day card has a quiet 44 px "Delete" under its Edit, named "Delete: <title>" (PT "Apagar: …", FR "Supprimer : …"). It reuses `DeleteArea`:
    - a one-off uses the shared `DeleteButton` (`className` and `ariaLabel` props added);
    - a weekly entry asks the edit sheet's own choices (skip the week of <date> / end it from this week on, which deletes the whole entry from its first week) in a sheet of its own, "Keep it" first and focused.
    - "Event deleted." with Undo shows in that day's card, as after a delete from the sheet.
  - An entry's notice link and its "Open the link" now sit in one wrapping row with a gap. The panel saw them run together as "…where to standOpen the link".
- **Roll call bar.** Since the D122 foundation (#437) the bottom tabs exist only below 768, but the bar kept its 60 px lift at every width, so from 768 it floated over the list.
  - It sits above the tabs below 768 and at the window's foot from 768, with safe-area padding.
  - It spans the content width (`-mx-4 sm:-mx-6`) on solid paper, with a 2 px ink rule on top, above the rows (`z-10`).
  - At the end of the list the last row is above the bar.
- **Members' board** (owner):
  - Notice bodies and each Start here part are cut to 6 lines with a fade (`Clamped` in `BoardParts.tsx`). "Read more" / "Show less" (PT "Ler mais" / "Mostrar menos", FR "Lire la suite" / "Afficher moins") open it in place. The button is 44 px, has `aria-expanded` and `aria-controls`, and line breaks are kept.
  - A size watch decides whether a text is long. A short text never shows the button or the fade, and a language tab decides again.
  - The officer's preview strip is edge to edge below 1024, as before. From 1024 its edges are the content column's (it overshot by 24 px each side).
- **No-data marker** (owner). `NoData` (`app/(private)/_ui/NoData.tsx`, new) is a muted dotted circle about 2 ch wide, with a hidden "No data" for screen readers and a `title`. `withNoData` draws each standalone "—" the server writes ("— · T11" reads ○ · T11).
  - Used in: the Members list (table cells and phone rows), the member card (facts line, game numbers, donation days, details) and Former members.
  - Home's margin and the squads show no "—" today, so nothing changed there.
  - Members' legend summary is now "What the labels mean" alone. Inside it, the marker with "No data yet. Missing data never counts against anyone." (`members.nodataHelp`, EN/PT/FR). `members.legend` ("— means no data.") is removed.
  - The first-use card says "A dotted circle means no data yet. …" (`intro.2.more`).
- **Copy renames** (owner):
  - **Usual hours.** "Daytime for them" is now "Within their usual hours" (PT "No horário comum deles", FR "Dans leurs heures habituelles"). "Night for them" is now "Late night for them" (PT "Madrugada pra eles", FR "Nuit pour eux").
    - The help line is "Usual hours are 08:00 to 23:00 on their own clock; it’s a guess from their time zone."
    - Team rows read "22:00 their time · within 08–23" and "02:00 their time · late night".
    - The count line reads "Usual hours at 18:00 ST" and "Late night at 18:00 ST".
    - The analytics value stays `daytime`.
  - **Raid Shield.** The roll call kind "KvK shield" is now "Raid Shield" (PT "Escudo de raid", FR "Bouclier de raid"). Home's activity lines and the spreadsheet copy read it from `roll.kind.shield`. The stored kind stays `shield`; "Shield up" and "No shield" are unchanged. The glossary, code comments and one activity test are updated.
- **Docs.**
  - `docs/DESIGN.md`: `Spread` / `MarginPane`, the scrollbar line, the roll call bar and a `NoData` entry.
  - Dated amendments to D98 (usual hours), D103 (Raid Shield, the team picker's words), D108 ("On the desk now" hidden when alone) and D123 (Calendar opens at the top, "Today ↓", Delete beside Edit).

## Decisions

- No new decision. Amendments: D98, D103, D108, D123, all dated 2026-11-19.
- **The margin column scrolls, not Recent activity alone.** The owner offered two ways. I chose the pane because:
  - it fixes every sticky margin, not one note; the 11at handoff's open issue was about the whole column;
  - it behaves like the member pane officers already use on Members (window height, own scroll, same scrollbar);
  - Members this week stays reachable inside the same box;
  - with the feed's buttons stuck to the pane's foot and the focus kept on them, a capped feed has no remaining advantage.
- **The Calendar change is recorded in D123.** There is no separate Calendar decision, and D123 is the one that said "The Calendar opens at today".

## Deviations

- **Delete sits under Edit, not beside it.** At 360 in FR, "Modifier" and "Supprimer" side by side would leave the entry's text about 120 px. Stacked, the text keeps ≥ 180 px (e2e: no sideways scroll).
- **A weekly entry's card button says "Delete", not "Skip or delete"**, so it fits under Edit. The sheet it opens asks the skip / end choices.
- **The words the owner did not give** for the count line and the late-night row are my reading: "Usual hours at {time} ST", "Late night at {time} ST", "{time} their time · late night" (PT and FR alike).
- **Calendar's head row lives in `CalendarAgenda`** (the page passes the title, and the views, week bar and month as children). "Add an event" opens the agenda's own sheet. Calendar is not on `PageHead` yet (later rollout PR).
- **Not fixed: the import page's sticky bar** (`SheetImport.tsx`) has the same bug as the roll call bar, sitting 5 rem up from 768. Its bar shows only after a spreadsheet is pasted, which this run could not reach, so I left it unchanged.
- No new unit tests (the task asked for none). One test expectation changed for the Raid Shield rename.

## Verified

- **`pnpm check` exits 0**: prettier, eslint, tsc, vitest (**220 files passed, 2 skipped; 1,185 tests passed, 4 skipped**), the drift check and i18n.
- **Local production build** on :3996:
  - Database: this worktree's Postgres 18, 50 migrations.
  - Stand-ins: the Discord sign-in and the tracker's hero pictures. Every https call is blocked; no upstream, Discord or Groq call was made.
  - Seeds (scratchpad `uxp/`), invented names only:
    - `seed-full.mjs`: 36 members, 3 former, 2 new; 138 feed actions; 29 calendar entries; 3 caravans with picks; a garrison plan; 15 notices; 27 thefts; 15 follow-ups; 5 roll calls; Start here in 3 languages;
    - `seed-empty.mjs`: the roster only.
- **e2e `uxp/e2e.mjs`: 79 of 79 pass in EN and 79 of 79 in PT-BR.** It covers:
  - **Home:**
    - at 1024 / 1280 / 1440 after three "Show more": the pane fits the window (752 px in an 800 px window), scrolls on its own, and keeps "Show more" in view and focused;
    - the page stays at 1,742 px;
    - the pane is a named region in the tab order; arrows and Page Down scroll it and not the page; focusing its last link scrolls it into view; "Show less" puts the focus on "Show more";
    - at 360: no pane, no tab stop;
    - "On the desk now · Wren" shows.
  - **Calendar:**
    - at 360 / 768 / 1280 it opens at scrollY 0 with "Add an event" in view;
    - "Today ↓" is 44 px, scrolls to today and focuses its heading, and `#d-<day>` still scrolls;
    - at 360, Edit and Delete are 44 px and Delete is named with the title;
    - one-off delete: "Keep it" is focused; "Event deleted." with Undo shows in view in the day card, and Undo brings the entry back;
    - weekly delete: the sheet asks Keep / Skip the week / End it, and "Keep it" closes it;
    - D123's flow from the edit sheet, for the last entry of the week at 1280: the Undo line scrolls into view.
  - **Roll call** at 360 / 768 / 1060 / 1280:
    - the bar's bottom is at the window's foot from 768, and 60 px up (above the tabs) at 360;
    - it spans the content edges, with a solid background and a 2 px rule;
    - at the end, the last row is above the bar.
  - **Board** at 360 / 1190 / 1280:
    - "Read more" is there and the text is cut to 6 lines (144 px at 24 px lines);
    - `aria-expanded` is false and the button is 44 px; it opens in place, then reads "Show less";
    - the strip is edge to edge at 360, and on the content column at 1190 and 1280 (139–1051 = content 139–1051).
  - **Members** at 360 and 1280:
    - 17 markers and no bare "—";
    - the legend summary is "What the labels mean" alone;
    - `?m=` opens Bramble in the pane.
  - No request left the machine.
- **Before → after numbers (full seed, window 800 px tall):**

  | Check | Before | After |
  | --- | --- | --- |
  | Home page height after 3 × Show more, at 1024 / 1280 / 1440 | 5,157 / 4,653 / 4,269 | 1,742 / 1,742 / 1,742 |
  | Home margin height, same | 4,945 / 4,441 / 4,057 | 752 / 752 / 752 |
  | Calendar scroll on load, at 360 / 768 / 1024 / 1280 | 2,077 / 2,392 / 2,372 / 2,246 | 0 / 0 / 0 / 0 |
  | Roll call bar bottom at 1060 | 740 (60 px up, over the rows) | 800 (window's foot) |

- **Shots**, all in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/ux-pass-shots/`:
  - `before/full/`, `before/empty/`, `after/full/`, `after/empty/`: 16 screens (14 empty) × 360 / 768 / 1024 / 1280 / 1440 × light and dark, EN, full page, plus Calendar as it opens; 170 / 121 / 170 / 150 files.
    - `before/empty/` stopped early: the app process exited during that run, so it has no metrics file and is missing some dark and wide shots.
    - The other folders each have their `metrics-*.json`.
  - `before/checks/` and `after/checks/`: Home after three "Show more" (1024 / 1280 / 1440), roll call mid and end (360 / 768 / 1060 / 1280), board top (360 / 1190 / 1280) and Calendar as it opens (360 / 1280), in light and dark; `after/checks/` in EN and PT-BR;
  - `after/e2e/`: viewport shots of each fixed item, in EN and PT-BR (Calendar delete question, weekly sheet and Undo line; board clamped and open; members legend; member open).
  - No page scrolls sideways: 0 of 160 before (full), 0 of 160 after (full), 0 of 140 after (empty).
  - Calendar's scroll on load is 0 at all five widths after, in both seeds.
  - Empty Home, with Ana alone on the desk, has no "On the desk now" row (`after/empty/home-*`).
- **Persona panel** on the before shots: a product designer, an R4 on a 360 phone, an R5 on a laptop, an officer on a tablet.
  - The first slicing of the tall shots was wrong (`sips` cropped from the middle), so each reviewer re-checked on correct slices (`panel2/before/<persona>/`).
  - Their findings are in the table below.
  - The full-page `member-open` shots did not open a member (the click missed), so the open member was checked through `?m=` in the e2e (`after/e2e/member-open-1280-*.png`).
- **Privacy:** none of the 2,064 fixture player names is in the diff's added lines. The shots use invented names only.

### Panel findings

| # | Screen | Finding | Panel | Status |
| --- | --- | --- | --- | --- |
| 1 | Home ≥ 1024 | Recent activity grows without limit in the sticky margin | owner | fixed |
| 2 | Calendar | Opens mid-page; "Add an event" not found | owner | fixed |
| 3 | Calendar | Notice link and "Open the link" run together | all four, must-fix | fixed |
| 4 | Roll call mark ≥ 768 | "All marked" bar floats mid-list, cuts ✓/✗ | owner | fixed |
| 5 | Board | Long notice fills the page; preview strip offset at ≥ 1024 | owner | fixed |
| 6 | Home | "Show more" drops the keyboard focus | e2e | fixed |
| 7 | Settings, Start here | The nav highlights Home on Settings and Calendar on Start here | designer must-fix, others later | later: both are set on purpose (`current="home"` / `"days"`); a nav change for the owner |
| 8 | All pages ≥ 1280 | The header's width jumps between laid-out (1,200 px) and legacy (960 px) pages | designer must-fix, R5 later | later: ends as the D122 rollout moves each page to `wide` |
| 9 | Notice view | "No Discord channel is set up" beside "Posted to Discord by Wren", Publish off | R4, tablet must-fix | later: seen with a post and no channel in the environment, which happens when a channel is removed after posting |
| 10 | Members | "No data: donations on 1 day" on almost every row; "Missing info 38 of 38" | R4 must-fix | later: the seed has three reads only; check whether a day before a member's first read should count |
| 11 | Follow-up vs Home/Members | "Check in · 8" vs "9 people"; a member marked Needs help is missing on Follow-up | R5 must-fix | later: not investigated |
| 12 | Import | Sticky bar 5 rem up from 768 (same cause as #4) | code read | later: not reachable in this run |
| 13 | Home | "To review 4" but 5 rows (the new-member line is not counted) | R4 | later |
| 14 | Members | List starts ~1,100 px down; status line cut at 360; list column narrower at 1024 than at 768; three counters; "— · T11" | R4, R5, tablet, designer | later |
| 15 | Former members | Title says "Members"; "Pick a member" shows with an empty list | R5, tablet | later |
| 16 | Across pages | Three switcher styles (a selected segment looks like a primary button); titles that differ from tabs (Caravans titled "Calendar"); the create action in a different place per page (Roll call's at the bottom); four back-link styles; framed vs bare empty states | designer, tablet | later (rollout PRs 4–6) |
| 17 | Calendar | Past entries dim their Edit and Delete; empty week shows the month grid plus 7 "Nothing planned."; month cells cut at 768 | all | later |
| 18 | Several | Text links under 44 px: Caravans "Remove" beside "Change", Thefts "Details ▾", "Roll call ›", "Members ›", back links | R4, tablet | later |
| 19 | Roll call mark | ~800 px between a name and its ✓/✗ at ≥ 1280; selected ✓ low contrast in dark; "Not this time" in green | R5, tablet, designer | later |
| 20 | Garrison | ~7,400 px at 360; spare squads all open; "Save enemy might" beside "saved as soon as you make it" | all | later |
| 21 | Notices | No filter or archive, ended mixed with live; ragged grid; editor shows "Ask for a review" 4 times; "Ends on" as dd/mm/yyyy | all | later |
| 22 | Start here | EN tab "Out of date · Translate again?" while Translate is unavailable | R4, R5, tablet | later |
| 23 | Thefts | Empty state's two big buttons with no hint; "Server not known" on every card | R4, R5 | later |
| 24 | Board | Start here is last; "Take down" in the preview; "GMT-3" vs the desk's "UTC−2"; own time first vs ST first on the desk | R4, designer | later |
| 25 | Settings | Two filled buttons ("Save and test", "Download our data") | designer | later |
| 26 | Dark mode | Meta tags ("Every week", "For members") low contrast | designer | later |
| 27 | Primary buttons at 360 | The hatched shadow strip reads as jagged | R4 | later (brand) |

## Open issues

- Findings 7 to 27 above, with their evidence in `panel2/before/<persona>/` (file names in the panel tables, scratchpad `uxp/`).
- `shots.mjs`'s `member-open` click does not open a member; use `?m=<uid>` next time.
- The Calendar's Delete under Edit is dimmed with the rest of a past entry, like Edit (finding 17).

## Next

- Model/effort: keep the plan's level for rollout PR 4 (Calendar and Notices).
  - Reason: this PR was one build round plus three fix rounds, all found by the e2e. The panel's must-fixes outside the owner's list are layout-system questions that PR 4–6 answer anyway.
- What the owner must do first:
  - merge;
  - answer finding 7 (which nav item Settings and Start here light) and finding 9 (what the notice view says when the channel was removed after a post).
  - There is no migration and no environment change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; this work runs from issue 412.

<adjustments>
- `Spread`'s `stickyMargin` now renders `MarginPane`. A page that sticks its margin passes `marginLabelledBy` with its notes' head ids. A note with a sticky foot uses `lg:sticky lg:bottom-0 bg-paper`, as Recent activity does.
- Calendar's head row is `CalendarHead.tsx` inside `CalendarAgenda` (`head` + children). Rollout PR 4 can move it onto `PageHead`, but "Add an event" opens the agenda's sheet, so it needs `PageActions` / `ActionButton` as Members does.
- `DeleteArea` takes `inCard`. A weekly entry asks its choices in a `Sheet role="alertdialog"` from a card, and inline in the edit sheet.
- A sticky bottom bar must use `bottom-[tabs]` below 768 only and `md:bottom-0` from 768 (the tabs are a rail there). `SheetImport.tsx` still needs this.
- `withNoData(text, label)` draws "—" wherever a server string holds it. New lists of member values should use it, not a bare "—".
- Seeds for the next pass: scratchpad `uxp/seed-full.mjs` and `uxp/seed-empty.mjs`; `uxp/slice.mjs` slices tall shots for a panel; `uxp/e2e.mjs` covers this PR's fixes.
</adjustments>

PR: (added by the orchestrator)
