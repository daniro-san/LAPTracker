# 11at — Desk Home on the ledger spread (issue 412, rollout PR 2 of D122)

## Built

- **Desk Home leaves the 960 px fallback.** `app/(private)/w/[slug]/page.tsx` now uses `PageHead` (the title) and `Spread` (`even`, `stickyMargin`).
  - Main column, framed cards: the tracker key card, Today and tomorrow, the notice pictures due for the cleanup (D119, when there are any), To review.
  - Margin column, `MarginNote`s: Recent activity, with "On the desk now" as its first row and its paging (D108), then Members this week.
  - The HTML order is the phone order: title, the share result (D110), main, margin.
  - From 1024 the spread is 2/3 and 1/3, behind the 2 px ink rule. From 768 to 1023 the two groups are two equal columns of cards. Below 768 there is one column of cards.
- **`SignedInFrame` and `Frame` take `wide`.** A desk page opts in to the full width (`--page-max`, 1200 px). Every other desk page keeps `legacyWidth`.
- **`HomeMembers` and `RecentActivity` are margin notes.** Their content, links, copy and ids (`home-members`, `home-activity`) are unchanged. `RecentActivity` takes the "On the desk now" line as `lead`. The thanks block, the share block, the check-in line and "Open Members" are now hairline rows.
- **Small changes to the PR 1 layout components:**
  - `PageHead` and `MarginNote` take an optional `id`, so each Home section keeps its `aria-labelledby`;
  - `MarginNote` below 1024 uses the desk cards' padding (16 × 12 px), and its head is 44 px tall only when it holds a control;
  - `Spread`'s ink rule runs the spread's full height, and with `stickyMargin` only the notes inside it stick.
- Each main card has `first:mt-0`, so the main and margin columns start at the same height.
- `docs/DESIGN.md`: the `PageHead`, `Spread` and `MarginNote` lines, and which pages use the components.
- `docs/decisions/D108`: a dated amendment for the new place of "On the desk now".

## Decisions

- No new decision. D122 and its amendment cover the layout.
- **D108 amended (2026-11-19).** "On the desk now" is the first row of the Recent activity note, not a line under the title. Its words are unchanged.
- **The margin column's order follows the persona panel: Recent activity first, then Members this week.** The task listed Members first. The R4 on a phone found "On the desk now" near the end of the page, about 1,720 px down at 360. With Recent activity first, it sits right after To review, about 250 px higher. On wide screens, the live state is at the top of the margin column.

## Deviations

- **No main action and no `MoreMenu` in Home's page head.** Home's one page action is "Send screenshots", and it is a widget, not a link: its progress, errors, results and "Pick the type" show in place inside To review. `PageHead` renders each action twice (the row from 768, and the phone row), which would make two stateful copies of it. So it stays first in To review, where D110 put the door in. Home has no secondary page action for More: the card links ("Open Calendar", "Open Members") are navigation, and More is never for navigation. `PageHead` is used with the title only.
- **Notice pictures due (D119)** were not in the task's list. The card is something to act on, so it is in the main column, between Today and tomorrow and To review, as before.
- **The key card stays first in the main column.** The task listed it after To review. When the tracker key is refused, the squad reads are paused, so the card keeps the top place it has today.
- **The phone order changes,** as the spread requires:
  - before: On the desk now, key, Today and tomorrow, Members, To review, activity;
  - after: key, Today and tomorrow, To review, activity (with On the desk now), Members.

  "Send screenshots" is about 270 px higher on a phone.

## Verified

- **`pnpm check` exits 0** on the final tree: prettier, eslint, tsc, vitest (**216 files passed, 2 skipped; 1,174 tests passed, 4 skipped**), the drift check and i18n. No test needed a rerun.
- **Local production build** on :3997, with this worktree's Postgres 18 (49 migrations from an empty database) and a seed of invented names only:
  - 3 officers, Wren on the desk now;
  - a 14-member roster read on the last three server days;
  - 2 drafts to review and 1 new member to link;
  - 4 calendar entries today and tomorrow;
  - recent activity.

  The Discord sign-in is a stand-in, and every https call is blocked. No upstream, Discord or Groq call was made. The scripts are in scratchpad `11at/`.
- **Shots:** 20 before and 20 after, at 360 / 768 / 1024 / 1280 / 1440, light and dark, EN and PT-BR. They are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11at-shots/before/` and `.../after/`, each folder with a `metrics.json`.
- **Page height (px), before → after.** No width scrolls sideways, before or after.

  | Width | EN           | PT-BR        |
  | ----- | ------------ | ------------ |
  | 360   | 2,062 → 2,115 | 2,218 → 2,271 |
  | 768   | 1,869 → 1,307 | 1,893 → 1,352 |
  | 1024  | 1,849 → 1,243 | 1,849 → 1,267 |
  | 1280  | 1,849 → 1,243 | 1,849 → 1,267 |
  | 1440  | 1,849 → 1,243 | 1,849 → 1,243 |

  - From 768 up, the page is 29 to 33 % shorter.
  - At 360 it is 53 px taller (+2.6 %). The two margin notes have a ruled head and hairline rows, and "On the desk now" is a row inside a card. A first build was 99 px taller; tightening the note's padding and head took off 46 px.
  - Main content width: 1056 px at 1280 and 1200 px at 1440. Before, it was 960 at both.
- **Behaviour on the build, 11 of 11 checks:**
  - all six Home sections are labelled by their old ids;
  - "Show more" reads the next lines in the margin note (8 → 10) and "Show less" goes back;
  - at 1280 the margin notes stick (the head's top goes from 161 to 16 px while the page scrolls 400 px);
  - the phone order is title, key, next, To review, activity, members;
  - "On the desk now · Wren" shows.
- **Persona panel** on the after shots (product designer, R4 on a 360 phone in PT, R5 on a laptop, officer on a tablet): all four accept, with no must-fix. Three nice-to-haves were fixed:
  - uneven gap between margin notes (73 px), now 32 px above each head;
  - the ink rule stopped halfway down, now full height with only the notes sticking;
  - "On the desk now" was near the end on a phone, now with Recent activity first.
- **Privacy:** the diff's added lines hold none of the 2,049 fixture player names. The shots use invented names only.

## Open issues

- **A sticky margin taller than the window.** If an officer opens several "Show more" pages, the margin notes can grow taller than the window but stay shorter than the main column. Their lower part then shows only near the end of the page. This does not happen at the seed's size. If it shows up, `Spread` could drop the stick once the notes are taller than the window.
- At 1024 the margin column is about 262 px wide. Some activity lines leave one word on their second line. The panel found this readable.
- Pre-existing, seen by the panel: at 360 the bar's title "Mesa dos oficiais" takes two lines.

## Next

- Model/effort: keep the plan's "raise one" for rollout PR 3 (Members, master-detail).
  - Reason: Home took three build rounds with a single list on each side. Members adds `?m=`, the sheet's content as a pane, and `ResponsiveTable`.
- What the owner must do first: merge. There is no migration and no environment change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; this work runs from issue 412.

<adjustments>
- A desk page moves onto the layout by passing `wide` to `SignedInFrame`. Nothing else in the frame changes.
- `PageHead` renders each action node twice (the row from 768, and the phone row). An action must therefore be stateless (a link or a plain button). A client widget with its own state cannot be an action: Home's "Send screenshots" stays in its card for this reason.
- A section that moves into a `MarginNote` keeps its label by passing `id`. A card component that becomes a note drops its own `drawn-card` and margins, and its blocks become direct children, which the note splits with hairlines.
- Main-column cards that carry `mt-4` need `first:mt-0`, so both columns start level.
- `Spread`'s rule now runs full height, and `stickyMargin` sticks an inner wrapper. A page does not need to do anything for this.
</adjustments>

PR: (added by the orchestrator)
