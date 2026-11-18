## D116 — Officer feedback round: drawn card frames, the copy buttons explained, Start here on the notices editor's parts, a week strip on the members' board (2026-11-17, owner, 11ah, issue 393; amends D102, D105)

Why: officers on the desk's first days said the Home cards were hard to scan next to the public ledger's drawn frames ("it takes so long to concentrate on data"), did not see the difference between the three copy buttons on a notice, and found the Start here editor laid out differently from the notices editor. The owner asked for a nicer members' board and, during the session, for the drawn frames on the public pages too.

**1. The drawn card (`drawn-card`, `app/globals.css`).**

- A section card wears the soft drawn frame (`public/brand/frame-soft.svg`, the frame the ledger's `stat-card` wears below 640 px) at every width. The frame is always `--ink`, whatever the text colour inside, so it reads the same in light and dark (ink on paper: far above 3:1 in both). Without `-webkit-mask-box-image` (Firefox) a plain 1 px `--ink` border stands in.
- Hierarchy: the card is the ink frame; rows inside keep their `--rule` hairlines; buttons keep their plum frames; tags have none.
- Desk: Home (Today and tomorrow, Members this week, To review, Recent activity), Members (the thanks, the empty state), Follow-up (each group, the thefts), Roll call (each roll call and the empty line), Calendar (each day of the agenda, each caravan, the notices list and its empty state, the thefts' empty state), the screenshot review, former members, and the board's day, notice and Start here cards.
- Public pages, where a section had a plain 1 px rule: the alliance and player pages' figure band, "Biggest changes", the leadership cards, "Who fought" and "Who carried", the player's daily progress card and the alliance history's roster cards. The ledger's `stat-card`s were already framed and are unchanged; the server balance and merge pages are not in this round.
- No layout changed: only the border became the frame (and a few cards gained padding where a list became a card). The responsive layout overhaul is #412.

**2. The three copy buttons say what they copy** (amends D102). Under each button on a notice's read page, always shown, one line in the officer's language, tied to the button with `aria-describedby`:

- "Copy for game notice": "Cut to 1,000 characters, the game's limit." (the limit in the officer's number format);
- "Copy for game mail": "The whole text, never cut.";
- "Copy for Discord": "Title in bold, formatted for Discord. Pings no one."

PT and FR to match. The button labels do not change. The three sit in one column below 640 px and side by side from 640 px.

**3. Start here is built on the notices editor's parts** (amends D105's editor). `app/(private)/_ui/LanguageEditorParts.tsx` holds what both editors draw: the language tabs with their state (Empty, Written, Draft, Out of date), the draft's mark with Accept and Undo (44 px chips, as in the notices editor; D105's full-size Accept and Undo are replaced), the two-line Translate and Improve writing buttons, Improve writing's sheet of tones, the line under the buttons (why they are off, the last error, "other languages become drafts"), and the sticky save bar (drafts left to check, the last outcome, Save and Cancel, which asks first). Each editor keeps its own state and save.

- Start here's data model and its per-language version check are unchanged (`start_here`, 409 on a stale language).
- **Translate** follows the notices' rule (`planTranslate` in `notice-draft.ts`): from a tab with text into the other two, or into an empty tab from the language it came from or last written in. Each part with text is one request.
- **Improve writing** is new on Start here: each part of the tab in view that has text is rewritten in the chosen tone, as a draft to Accept or Undo.
- **"Shorten to 1,000"** does not apply: Start here is read on the board, not pasted into the game, and its parts have their own caps (4,000, 3,000, 1,500).
- **Out of date**, without a new column: each language's version is the save that last wrote it, so a written language saved before the newest written one "may be out of date", with "Update from …" (Translate from the newest) and "Keep as is". A translation is saved together with the language it came from, and a kept language together with the newest one, so they share one version and neither is marked. Editing one language by hand and saving it alone marks the others, as on a notice.
- Cancel goes back to the members' board, asking first when something changed. The bottom tabs are hidden while the editor is open (`data-notice-editor`), so the save bar is never under them.
- Not carried over: the notices' unsaved text kept on the device and the warning before leaving the page; Sign out still asks first (`data-unsaved`).

**4. The members' board's week** (amends D105's "This week").

- A strip of the seven days (today first): the weekday, the date, a dot per member-marked event (three at most), today filled plum, a day with events tinted plum and a jump to its card; days with nothing planned stay quiet. Each cell is at least 45 px wide at 360 px and 64 px tall, with the full day and "2 events" / "Nothing planned" for screen readers.
- Under it, a drawn card per day with events. Each event's time is a column of its own, first: the viewer's own time large ("22:00"), "your time (BRT)" under it, then "23:00 ST". The help line now reads "Your own time comes first, with server time (ST) under it." (PT and FR to match). Before the browser knows its zone, the column shows server time alone, as before.
- Still read-only, nothing about any person, EN · PT · FR.

**Not built:** frames on the server balance, merge and flow pages; Start here counters per part; the device-kept draft for Start here.
