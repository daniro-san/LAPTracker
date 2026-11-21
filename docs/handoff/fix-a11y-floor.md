# fix/a11y-floor — #585 phase 2, batch 2: the accessibility floor

Findings F4, F5, F6, F16, F18, F27 and F48 of the #585 review, on the desk, the members' board, Me and /admin.

## Built

- **F4, the contrast floor.** Muted text is never lighter than `text-ink/70` (5.72:1 on paper, 7.22:1 in dark). `ink/55`, `ink/60` and `ink/65` are gone from text: the nav's "soon" items, zero-count chips, `NoData`, "none", "not written yet", member-card fine print, the footer, the invite steps and the public alliances count. Disabled controls keep their dimming. Placeholders are the field's text at 70 % (`::placeholder` in `app/globals.css`; it was the preflight's 50 %, 3.16:1).
- **F4, visible labels.** A visible label sits above each search field: Members, Former members, the roll call and Raid prep search, the Elixir team search, the time-zone sheet and the /admin "sign out users" sheet. The Raid prep message box is labelled by its heading. A placeholder that only repeated the label was removed. The Members hint ("Name (no emoji needed)") and the time-zone hint stay as hints. On Members the sticky block grew by one line, so the page has `scroll-padding-top: 11rem` (`data-members-sticky`), and a focused row never hides under it (WCAG 2.4.11).
- **F4, the yarn token.** Light `--yarn` is now #6c4e0d (it was #75540f). "Needs help" on the open Members row (plum 15 % tint) was 4.24:1 and is now 4.71:1. The value is 6.19:1 on paper. Dark yarn is unchanged.
- **F5 and F6, an event's state in words.** `app/(private)/_ui/Ended.tsx` wraps an event's title and writes its state the way "· Today" is written:
  - "· Started" in plum from the start time.
  - "· Ended" in ink/75 once the event is surely over, with the title at regular weight and ink/75.
  - `endOf` (`lib/private/calendar-words.ts`) gives the end: an Elixir window ends 30 minutes after its start, and any other entry at the end of its server day, because entries have only a start time.
  - It is used in four places: desk Home ("Today and tomorrow"), the Calendar week, the members' board and Me ("Where you're needed"). Home and Calendar faded those rows with `opacity-60` before, live Edit and Delete included.
  - Out-of-month days in the month grid are ink/70 in a dashed frame instead of faded.
  - Left-out rows in screenshot review have a dashed frame instead of a fade.
- **F6, Me's wording.** A mark reads "Raid prep, Sat, Nov 21 · your mark: “Shield up”" (PT "sua marca", FR "votre marque"). Before it read "Raid prep, Sat, Nov 21: Shield up", which sounded like an order. Me takes each line's time from the roll call's calendar entry; a line with no time counts as its whole day. Caravan seats work the same way. The queries are the same two, each with one more column.
- **F16, wrapping.**
  - Members: names and status reasons wrap instead of ending in "…" (`MemberListRow.tsx`), and the photo sits at the top of a tall row.
  - Bottom tabs: a tab is never narrower than its longest word (`minmax(min-content, 1fr)`). "Acompanhar" fitted at 360 and was cut at 320; it now fits at both.
- **F18, 14 px values.** These were 12 px and are now 14 px:
  - On Me: the week bars and the averages.
  - On the member card: the last-7-days values, and in the squads the seen line, the change line, the hero names and rarity, level and honor. The seen line breaks only at its " · " separators.
  - On the board: the time column, which was 13 px.

  The week rows' labels are semibold, so they still stand above their 14 px averages. Labels stay at 12 px: weekday heads, tags, "Empty slot" and chart axes.
- **F27, navigation.** Settings and Start here mark no tab as current. `SignedInFrame` takes `current={null}`.
- **F27, /admin.** The /admin nav has `aria-current="page"`, shown as bold with a 3 px plum bar and no text underline. `AdminShell` takes `section`; run detail pages mark Runs.
- **F27, label in name.**
  - The EN/PT/FR buttons are named "PT, Português".
  - The board's and the thanks share's language tabs show the code in their name.
  - Each Follow-up row's name is its visible text (name and reasons). Its hint, "Opens the reasons, a message to send and how it went.", is the description.
  - Month-grid day links carry the day in words and the entries they show. A variant-less Cheese Trap or Elixir label no longer prints "null". That bug predates this branch, but un-hiding the labels made screen readers read it.
- **F48.** The board's week strip has a legend under it: "Each dot is one event planned that day, up to three. Choose a day to go to its events." The strip moved to `BoardStrip.tsx` so `BoardSections.tsx` stays under 300 lines. An empty hero star is an outline at ink/70 (5.7:1); it was a filled ink/20 star (1.5:1).
- **Docs.**
  - DESIGN.md: the yarn value and its history; a new paragraph, "The muted-text floor", under Colors; the Rarity size; the Week strip legend.
  - D116: an amendment for the strip legend, "Started"/"Ended" and the board time size.
  - D142: an amendment for the Me wording and "Started"/"Ended".

## Decisions

- **"Started", then "Ended".** The brief asked for an "Ended" tag. Entries carry only a start time, so "Ended" from the start would call a running KvK over at 12:10 (a panel MUST). The state is "Started" from the start, and "Ended" after a known end or the end of the day. A KvK reads "Started" for the rest of its day, which is true but less precise than an end time would be.
- **The state is written like "· Today", not as a `Tag`.** The designer's MUST: as a sage tag, "Ended" looked like "Every week" and "For members", and past entries no longer stood back. The fade is replaced by a muted title (ink/75, still 4.5:1 or more), and buttons stay full colour.
- **"· your mark: …" on Me, not "an officer marked you".** The panel found that naming an officer turns a record into a person's judgement, and that past tense reads oddly on a future event. The roll call's own word ("mark") is tense-neutral.
- **Floor at ink/70, not 65.** ink/65 passes (4.91:1), but DESIGN.md already names ink/70 for notes and metadata, and the task suggested it. One floor is simpler to keep.
- **No new token for muted text.** The fix is at the utility level. A floor paragraph in DESIGN.md, the `::placeholder` rule and one darker yarn value cover every failure that was measured.
- **Labels above, not inline.** A label beside the field would take the input's width at 360 px. Members gets scroll padding for its taller sticky block.
- **Sizes.** 14 px (`body-sm`) is the readable minimum the type scale has for values. The type table allows 12–14 px for notes; labels stay 12 px.

## Deviations

- `BoardStrip.tsx` is a new file. `BoardSections.tsx` passed the 300-line lint limit with the legend in it, so the strip moved out unchanged.
- On the board page, `<Week {...{ t, language, today, now }} {...view} />` spreads the view, to keep `BoardPage` under the 80-line limit.
- The public alliances page count and the site footer moved from ink/60 and ink/65 to ink/70. They are outside the four areas, but the floor is site-wide.
- `cellLabel`'s "null" was fixed although it is pre-existing: this branch made screen readers read it.
- The branch is rebased on `origin/dev` after #590 (batch 1) merged. #590's sticky roll-call search row is about 20 px taller with its visible label, so its `scroll-padding-top` went from 4.5rem to 5.75rem (`app/globals.css`). The squads test's "16 h ago" pattern allows the new no-wrap span.

## Verified

- `pnpm check` passed on the rebased branch: prettier, eslint, tsc, vitest (296 files, 1,533 tests), drift and i18n (17 languages up to date). One PGlite test (`roster-stays`) timed out once under load and passed alone and on the next full run.
- Ran a local production build with `db:local` and the #585 kit's invented seed (about 100 members, sealed invented key and webhooks, no upstream or Discord call). Before is `origin/dev` b509ad32 and after is this branch, on the same seed. There were 127 runs over 17 pages: 360 and 1280 px, light and dark, EN; 360 px light and dark, PT; and 200 % zoom (640 × 400 CSS px) in EN and PT. Admin is EN only.

  | | Before | After |
  |---|---|---|
  | axe `color-contrast` nodes | 76 | 0 |
  | axe `label-content-name-mismatch` nodes | 460 | 0 |
  | Manual contrast failures (opacity on ancestors and placeholders, which axe misses) | 331 nodes, 131 distinct texts | 0 |
  | Text cut at 360 px, EN and PT | 72 | 0 |
  | Visible fields without a visible label | 6 kinds on 6 pages | 0 |
  | Sideways scroll, including at 200 % | 0 | 0 |
  | Text under 14 px at 360 px, light, EN: Me, card overview, card squads, board | 103, 46, 66, 22 | 32, 22, 17, 8 |
  | Members, focus stops hidden under the sticky block on Shift+Tab (of 60), at 360×780 / 640×400 | 9 / 13 (panel probe, on b070475e) | 0 / 0, and 0 at 320×400 |

  Per page, before → after (all runs):
  - Calendar: axe 30 → 0 contrast and 88 → 0 label-in-name nodes.
  - Members: axe 30 → 0 contrast nodes.
  - Follow-up: 120 → 0 label-in-name nodes.
  - Every desk and board page: the EN/PT/FR switch caused 24 → 0 label-in-name nodes on each.
- The text still under 14 px is labels: weekday heads, tags, "Empty slot" and chart axes.
- **Panel, three subagents.** All three results came back to me directly.
  - **Accessibility reviewer, Discord upkeep officer and product strategy.**
    - MUST 1: "Ended" from the start time misleads during an event. Fixed: "Started", then "Ended".
    - MUST 2: focus was hidden under the Members sticky block. Fixed with the scroll padding.
    - SHOULDs done: the Me mark wording, and the month grid's "null".
    - COULDs done: the state text is now 14 px, not 12; the legend says "Choose a day" (75 % of board views are at 1024 px or wider).
    - The rest is under Open issues.
  - **Visual designer and officer-architect.**
    - MUST 1: past entries no longer stood back, and "Ended" looked like a property tag. Fixed: written like "· Today", with the title muted.
    - MUST 2: the squad seen line broke inside "3 days ago". Fixed: it breaks only at " · ".
    - SHOULDs done: dashed out-of-month cells, top-aligned photos, semibold week labels.
    - COULDs done: "Empty slot" line height, no double underline on /admin, the gap after the legend, the stale DESIGN.md lines.
    - Verdict: the floor and the 14 px values look consistent in light and dark, and tags never look like buttons.
  - **QA.**
    - Pass, no MUST. 238 runs over 18 screens: 360, 768 and 1280 px, light and dark, EN and PT, and 200 %.
    - axe: 0 contrast and 0 label-in-name. Text cut at 360: 0 (92 before, its wider set). No sideways scroll anywhere.
    - Behaviour checks: all passed. Console: only the seed's missing hero images (404).
    - Its SHOULD-1 ("null") is fixed. Its SHOULD-2 (month-grid labels cut at 1280) predates this branch.
  - I re-ran my measurement after the panel fixes and again after the rebase (`measure-after3`, `measure-after4`): still 0 on every row of the table above. The Shift+Tab focus probe finds 0 of 60 stops hidden on Raid prep (360×780 and 640×400) and on Members (360×780, 640×400, 320×400).
- **PostHog, the three-way check** (project 741657, read-only, last 30 days). Pageviews:
  - Home 127, Members 95, Calendar 64, Notices 59, /admin 55, Roll call 44, board 20, Follow-up 17, Settings 9, Start here 2, Me 1.
  - On phones (under 640 px): 53 % of Home views, 63 % of Members and 56 % of Calendar.
  - Board views at 1024 px or wider: 75 %.
  - Events: `ws_language_switched` 10, `ws_filter_used` 13.

  The product persona kept all three changes in use:
  - The state words replace a fade that took live buttons below 3:1.
  - Visible labels cost one line per field.
  - Wrapped rows show the reason an officer acts on.

  None of them ranks people or adds a consequence.
- Screenshots: before and after full pages are in `scratchpad/a11y/measure-before/`, `measure-after2/`, `measure-after3/` and `measure-after4/`. The panel's are in `scratchpad/a11y/look/`, `panel-look/` and `qa/run-full/`. I read my own shots of Home, Members, the card, Calendar, the board and Me at 360, in EN and PT, light and dark.
- The diff names no member of the fixture roster: a script compared the 307 roster names against it.

## Open issues

- **A KvK reads "Started" until the end of its day.** It does not switch to "Ended" when it is over (about 14:00 ST), because an entry has no end time. A duration per kind (KvK until the After read) or per entry would make it exact. This is for the owner.
- **Owner call, Me.** A "no" mark ("your mark: “No shield”") is listed under "Where you're needed", also after the event. Before the event the officer persona wants the next step said ("put your shield up"); after it, the product persona suggests not repeating a "no" on the member's own page. Me had 1 view in 30 days.
- **320 px.** A long one-word name breaks inside the word ("xX_DarkPetal_ / Xx"; "Quillbro / ok"), because two number columns share its line. The 360 px criterion is met. Moving Might and Donated under the name below 360 px is a layout change for batch 6. The member card's tabs cut "Esquadrõe / s" at 320 px (pre-existing). The PT Members hint is cut at 320 ("Nome (sem precisar de em…"); a shorter hint, "Nome, sem emoji", would fit.
- **Still 12 px or cut.** The Calendar month grid's entry text is cut with "…" at 768 and 1280 (pre-existing; F17 redesigns the grid in batch 7). Raid prep's tile words are batch 1's area. In the 360 lineup, "Honor 1" wraps to its own line, so neighbouring stars sit at different heights (pre-existing).
- **The PT header** at 360 px takes about 190 px: the title on two lines, then the account line, then "Configurações da aliança · Sair" on its own row. Nothing is cut. The header layout is F37 (batch 6).
- **Follow-up.** "Talked to them" and "Add a note" repeat on every row with no name in their accessible name. The rows don't look tappable to sighted officers. Both are pre-existing.
- **Font sizes are in px** (F50, batch 9). A larger default font setting does not scale the desk.
- **Seed artifacts seen by the panel.** Elixir "Team : 12/20" with an empty team letter, /admin "3869 of 1,000", and the hero pictures (404).
- **#590 and this branch.** Resolved in the rebase (see Deviations). Raid prep's new tiles were measured again: 0 axe findings, 0 hidden focus stops.

## Next

- Model/effort: keep.
- Owner first: decide the two calls above (an end time for KvK; "no" marks on Me). There is no migration and no environment change.
- Plan change: none. Batches run from issue 585; `docs/SESSION_PLAYBOOK.md` has no prompt for them.

<adjustments>
- New rule for every batch: muted text is ink/70 or darker, and nothing is faded with `opacity` except disabled controls (DESIGN.md "The muted-text floor"). An event's state uses `Ended.tsx` ("· Started" / "· Ended"); a set-aside row uses a word or a dashed frame.
- `endOf(kind, day, minute, zone)` in `lib/private/calendar-words.ts` is the one place that knows when an entry is over. A per-kind duration belongs there.
- `SignedInFrame current={null}` marks no tab. Use it for any page outside the five destinations.
- `AdminShell` needs `section`. Batches 5 and 8 (/admin first screen, /admin structure) should keep `aria-current` on the nav when they add sections.
- Search fields have a visible label above them. A taller sticky block needs a matching `scroll-padding-top` (Members: `data-members-sticky`, 11rem).
- Light yarn is #6c4e0d. Check any new yarn-on-tint text against the 15 % plum tint (4.71:1).
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/597
