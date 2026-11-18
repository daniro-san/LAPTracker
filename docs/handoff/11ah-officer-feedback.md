# 11ah — Officer feedback: card frames, the copy buttons explained, Start here on the notices editor, the board's week (D116)

Closes #393; part of #293. Rules applied: D71, D75, D99, D100, D102, D105. New decision: **D116** (amends D102 and D105).

## Built
- **Drawn card** (`.drawn-card`, `app/globals.css`). The soft drawn frame (`frame-soft.svg`) in `--ink` at every width, with a 1 px ink border where the mask is not supported. It is the frame the ledger's `stat-card` wears below 640 px.
  - Desk: Home (Today and tomorrow, Members this week, To review, Recent activity), Members (the thanks, the empty state), Follow-up (each group, the thefts), Roll call (each roll call, the empty line), Calendar (each day of the agenda, each caravan, the notices list, the empty states), the screenshot review, former members, and the board's day, notice and Start here cards.
  - Public pages, where a section had a plain 1 px rule: the figure band on the alliance and player pages, "Biggest changes", the leadership cards, "Who fought", "Who carried", daily progress, and the roster history cards.
  - Rows inside a card keep their hairlines. No layout changed.
- **The copy buttons explained.** On a notice's read page, each of the three copy buttons has one line under it, always shown and tied to the button with `aria-describedby`, in EN, PT and FR. They sit in one column below 640 px and in three columns from 640 px. The button labels are unchanged.
- **Start here on the notices editor's parts.**
  - `LanguageEditorParts.tsx` holds the parts both editors draw: `LanguageTabs` with each tab's state, `DraftMark` (Accept, Undo, "Partly untranslated"), `ActionButton`, `ImproveButton` with the tone sheet, and `ActionNote`. `EditorSaveBar.tsx` holds the sticky save bar.
  - The notices editor (`NoticeLanguageField`, `NoticeActions`, `NoticeEditorParts`) now draws these parts and works as before.
  - `planTranslate` (`notice-draft.ts`) is the Translate rule both editors use.
  - Start here is rebuilt on these parts. The code is `StartHereEditor.tsx` (view), `start-here-editor-state.ts` (hook and save call) and `start-here-draft.ts` (pure model). `StartHereTranslate.tsx` is removed.
  - Start here gains Improve writing, out-of-date marks with "Update from …" and "Keep as is", the tab states, the sticky save bar with Cancel, and the bottom tabs hidden while the editor is open.
  - The page passes `t` and `viewer` to the editor instead of word lists. `starthere.save` and `starthere.saving` were removed; the editor uses the notices' Save words.
- **The members' board's week.**
  - A strip of the seven days: weekday, date, and a dot per event. Today is filled plum. A day with events is tinted and jumps to its card. Screen readers get the day and "2 events" or "Nothing planned".
  - One drawn card per day with events. Each event has a time column first: the viewer's own time large, then "your time (BRT)", then "23:00 ST".
  - New words in EN, PT and FR: `board.days`, `board.events.one/other`, `board.free`, and a new `board.times`.
- **Docs.** D116, the decision index, dated amendments to D102 and D105, and DESIGN.md (the `drawn-card` component, the "0 — card" elevation row, and the Workspace components "Language editor", "Copy with its line" and "Week strip").

## Decisions
- **Out of date on Start here without a schema change.** Each language's version is the save that last wrote it. A written language saved before the newest written language may be out of date.
  - A translation is saved together with its source, and a kept language together with the newest language, so they share one version.
  - The e2e found the first version wrong: "Keep as is" on EN made EN the newest language and marked PT. The fix is the co-save of the newest language. It is tested.
- **"Shorten to 1,000" is not offered on Start here.** Start here is read on the board and is never pasted into the game, and its parts have their own limits (4,000, 3,000 and 1,500 characters).
- **Accept and Undo on Start here are the notices' 44 px chips.** They replace D105's full-size buttons, because both editors must look the same. Recorded in the D105 amendment.
- **Cancel on Start here goes back to the members' board**, which is where officers open the editor from ("Edit Start here"). It asks first when something changed.
- **The frame colour is fixed to `--ink`, not `currentColor`.** So a card with plum or yarn text inside still has the same frame.
- **The board's help line now says "under it", not "beside them"**, because server time now sits under the viewer's own time. D105 quoted the old line, so the D105 amendment records the change.

## Deviations
- The task said "D116 if a decision is needed". A decision was needed, because the Start here out-of-date rule and the board layout both change D105.
- Owner scope addition mid-session: drawn frames on the public pages too. I framed the ledger, alliance and player pages only. The server balance, merge and flow pages are left for #412 or a later pass.
- Start here does not carry over the notices editor's device-kept unsaved text or its warning before leaving the page. Both are separate features, not shared components. Sign out still asks first.

## Verified
- **`pnpm check` exits 0 after rebasing on #407.** Prettier, eslint, tsc, and vitest **188 files passed, 2 skipped; 999 tests passed, 4 skipped**. The drift gate passes, and i18n reports "17 languages up to date".
- **New tests** (5):
  - `app/(private)/_ui/NoticeScreen.test.ts`: the three copy lines render in EN, and in FR with the French number format; each line is tied to its button.
  - `app/(private)/_ui/StartHereEditor.test.ts`, 3 tests:
    - the shared tabs render as `sh-tab-en`, `sh-tab-pt-BR` and `sh-tab-fr` with the states Written, Out of date and Empty, along with Translate ("to PT and FR") and Improve writing;
    - Translate fills drafts, Accept keeps one, Undo restores the other, and the source is saved with the translation;
    - "Keep as is" saves the language with the newest one.
  - `app/(private)/_ui/BoardSections.test.ts` (PGlite): the week shows member-marked entries only, the strip has 7 days with links on the 2 days that have events, and 23:00 ST reads 22:00 on a São Paulo clock. Its workspace setup is in `lib/private/board.test-helpers.ts`, because UI tests may not import `lib/repo`.
- **Local e2e: 35 of 35 checks pass.**
  - Setup: production build (`next start` on :3977), own local Postgres on :55237 with 39 migrations, the bridge, and stand-ins for Discord sign-in and Groq. No upstream, Groq or Discord call.
  - Start here:
    - tabs Empty, then Written after typing;
    - Translate "to PT and FR" turns PT and FR into drafts, with each part translated on its own;
    - Accept and Undo work;
    - Save works, and nothing is out of date after a reload;
    - a PT-only save marks EN out of date, with "Update from Português" and "Keep as is";
    - "Keep as is" followed by Save clears the mark;
    - Improve writing (Warmer) makes a draft, and Undo removes it;
    - no target is under 44 px.
  - Copy lines: shown in EN, PT and FR, with 9 described buttons on the notice.
  - Board as a member, in EN, PT and FR:
    - member entries only: no leadership call, no KvK note, no caravan coach;
    - own time before ST ("22:00 | sua hora (BRT) | 23:00 ST");
    - a 7-day strip with 3 linked days;
    - no target under 44 px;
    - PT reads the saved PT Start here.
- **Screenshot pass.** 62 full-page shots before and 67 after, with no sideways scroll on any page. Pages: ledger, alliance, player, Home, Members, Follow-up, Roll call, Calendar, a notice, Start here and the board, at 360 and 1280 in light and dark (EN). The board, Home and the notice are also in PT and FR. The after shots also include the Start here draft and out-of-date states and the copy lines. All are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ah-shots/before/` and `…/after/` (not committed).
- **Designer pass.**
  - The frames make each block stand apart in light and dark.
  - The board's time column wrapped "(GMT-\n3)" at 360. I fixed it by keeping the zone name on one line and widening the column to 6 rem.
  - The strip fits 7 cells of at least 45 px at 360 in PT and FR.
- **Privacy grep.** 1,555 added lines checked against the 101 names of the OGs fixture roster. The one hit is a substring of the identifier "wroteIn", a false positive.

## Open issues
- Start here records saved before this change may show a language as out of date: for example, EN saved alone and PT saved later as its translation. One tap on "Keep as is" followed by Save clears it.
- The server balance, merge and flow pages still use plain 1 px rules on their cards.
- PT's "Sejam gentis" e2e text is test data in the local database only.

## Next
- Model/effort: keep. Four items plus a scope addition fit one sitting with the e2e.
- What the owner must do first: review and merge. No migration or setting is needed.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- New section cards use `drawn-card`, not `border border-rule`. A card never sits inside a card; rows inside keep hairlines.
- A new language editor should draw `LanguageTabs`, `DraftMark`, `ActionButton`, `ImproveButton`, `ActionNote` (`LanguageEditorParts.tsx`) and `SaveBar` (`EditorSaveBar.tsx`), and use `planTranslate` for Translate.
- Start here's out-of-date rule lives in `start-here-draft.ts` (`staleSaved`, `shChanges`). Any other writer to `start_here` must save a translation together with its source, or it will mark languages out of date.
- A UI test that needs a workspace and sessions should use a `lib/private/*.test-helpers.ts` helper (for example `board.test-helpers.ts`). UI tests may not import `lib/repo`.
</adjustments>

<adjustments for="#412">
- The drawn card is only a border swap. Cards keep their old spacing, apart from list groups that became cards (Follow-up, Roll call, Calendar days, which gained `px-4`). The tails reach 3 px outside, so keep at least 12 px between cards.
</adjustments>

PR: (added by the orchestrator)
