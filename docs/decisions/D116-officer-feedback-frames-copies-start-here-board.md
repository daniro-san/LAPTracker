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
- **Each part keeps its own room** (review of PR 414). The draft route (`POST /api/w/[slug]/notices/draft`) takes an optional `limit` on `translate` and `improve`: a positive integer no higher than the largest Start here cap (4,000), checked by zod at the boundary. Start here sends each part's own cap (4,000 glossary, 3,000 rules, 1,500 who to ask), so the model is told "Stay within 3000 characters" for the rules and not the notice board's 1,000. Notices send none and keep 1,000. The text sent is still at most 3,000 characters (`DRAFT_LIMIT`).
- **Improve writing** is new on Start here: each part of the tab in view that has text is rewritten in the chosen tone, as a draft to Accept or Undo.
- **"Shorten to 1,000"** does not apply: Start here is read on the board, not pasted into the game, and its parts have their own caps (4,000, 3,000, 1,500).
- **Out of date**, without a new column: each language's version is the save that last wrote it, so a written language saved before the newest written one "may be out of date", with "Update from …" (Translate from the newest) and "Keep as is". A translation is saved together with the language it came from; and when a language is kept or translated, every saved language that is up to date now (at the newest version) is saved with it, so they all share one version and none is marked. (Review of PR 414: saving a kept language with the newest one only left a third up-to-date language behind.) Editing one language by hand and saving it alone marks the others, as on a notice.
- Cancel goes back to the members' board, asking first when something changed. The bottom tabs are hidden while the editor is open (`data-notice-editor`), so the save bar is never under them.
- **Unsaved text kept on the device and the warning before leaving** (owner, review of PR 414), with the notices editor's own hooks: `useKept` and `useLeaveWarning` (`notice-editor-state.ts`, now shared) and `notice-keep.ts` (now over any field list). Start here keeps its nine texts as one record under `lap:notice:<slug>:start-here`, the notices' prefix, so sign-out clears it too. "This device kept text you did not save." with "Restore unsaved text" when the editor opens; Save and Cancel (after Discard) forget it. Sign out still asks first (`data-unsaved`).

**4. The members' board's week** (amends D105's "This week").

- A strip of the seven days (today first): the weekday, the date, a dot per member-marked event (three at most), today filled plum, a day with events tinted plum and a jump to its card; days with nothing planned stay quiet. Each cell is at least 45 px wide at 360 px and 64 px tall, with the full day and "2 events" / "Nothing planned" for screen readers.
- Under it, a drawn card per day with events. Each event's time is a column of its own, first: the viewer's own time large ("22:00"), "your time (BRT)" under it, then "23:00 ST". The help line now reads "Your own time comes first, with server time (ST) under it." (PT and FR to match). Before the browser knows its zone, the column shows server time alone, as before.
- Still read-only, nothing about any person, EN · PT · FR.

**Not built:** frames on the server balance, merge and flow pages; Start here counters per part. Start here records saved before this change may show a language as out of date; one tap on "Keep as is" and Save clears it, with no migration (owner, review of PR 414).

**Amendment, 2026-11-20 (issue 412).** The tabs' "Empty" now reads "Missing" ("Faltando", "Manquant") in both editors, and the tab strip moved to `LanguageTabs.tsx`, which a notice's read page uses too, with the states Reviewed and Translated (AI) on notices only (D113's amendment of the same day).
