# 11p — Notices editor: language tabs, one action row, a tone sheet

Issue #363. The owner tested the notices editor on his phone. He did not like the three text boxes stacked one under another, "Improve writing" sitting apart from Translate, or the row of tone chips. Rules applied: D81 (drafts the officer reviews), D75, D77, D71. Branch `session/11p-notices-editor` from `origin/dev` (55fe16f).

## Built
- **Order on the screen**, top to bottom: title, language tabs, the text of the open tab, Translate and Improve writing, "Show to members" and "Ends on", then the save bar. The form is at most 672 px wide on a large screen.
- **Language tabs** (`NoticeLanguageField.tsx`):
  - One tablist, EN · PT · FR, in the officer's language order. Each tab is a third of the width and 56 px tall: the code, plus one state word under it. The states are "Empty", "Written", "● Draft" (plum) and "● Out of date" (yarn).
  - It follows the WAI-ARIA tabs pattern: `role=tablist/tab/tabpanel`, `aria-selected`, roving `tabIndex`, and arrow keys, Home and End with automatic activation. It reuses `tabAfter` from `app/_ui/Movers.tsx`, which is now exported.
  - Screen readers hear each tab's full language name.
  - **One text area** (`#notice-text`) for the open tab, which grows with its text. Switching tabs keeps every language's text, because all of it lives in the draft state.
  - **In the open tab:**
    - "This version may be out of date" with "Update from …" and "Keep as is" (unchanged);
    - for a draft, one line, "Draft from Translate, not saved" or "Draft from Improve writing, not saved", then **Accept** (plum, framed) and **Undo**, then "Partly untranslated, please check." when the draft is partly untranslated;
    - the text box, tinted with a plum border while it holds a draft;
    - under the box, the over-limit line and the counter on one row.
  - Opening the editor from an "Out of date" tag opens that language's tab and scrolls to the tabs.
- **One action row** (`NoticeActions.tsx`, new):
  - Two equal two-line buttons side by side, 160 × 56 px at 360. Their size does not change when "Working…" replaces the name.
  - **Translate**: its second line says where the text goes, "to PT and FR".
    - On an empty tab, or a tab that holds a draft from Translate, it reads "from EN" and fills only that tab.
    - The source is, in this order: the text that tab was translated from, the last tab the officer typed in, then the first written language (`translatePlan`).
  - **Improve writing**: its second line reads "Choose a tone ▾" at first, then "Tone: Warmer ▾".
    - It opens the app's bottom sheet ("Improve writing", "You get a draft to check. Nothing is saved until you press Save.") with the six tones in their existing words, each 44 px tall. The last tone used is marked (`aria-pressed`, ✓).
    - Tapping a tone closes the sheet and asks for the draft. Cancel, Escape or a tap on the backdrop closes the sheet.
  - Under the buttons:
    - why they are off ("not set up", "too long", tied by `aria-describedby`);
    - otherwise the last Translate or Improve error (`role=alert`), shown only on the tab the request was made from (`askTab`), even when the answer comes after a tab switch;
    - otherwise "Text already in the other languages becomes a draft you can undo." when Translate would replace text.
- **State** (`notice-editor-state.ts`):
  - the open tab, and the last language typed in;
  - AI errors (`aiMessage`) kept apart from save errors (the save bar shows only the save errors);
  - `busy` is now `"translate" | "improve" | "save" | null`;
  - `accept`.
- **Pure logic** (`notice-draft.ts`): `accept`, `discard` (Undo, moved out of the hook), `tabState`, `draftKind`, `translatePlan`, `askTab`.
- **Save bar:** "n drafts to check" is now an `aria-live=polite` line that is always in the page (`sr-only` while there are no drafts; only its text changes), so a screen reader hears that Translate filled the other tabs. The bar is otherwise unchanged: pinned, with the safe-area padding.
- **Words** (`dictionary.notices.ts`), in EN, PT-BR and FR:
  - 12 new keys: `notices.languages`, `notices.tab.empty/written`, `notices.translate`, `notices.translate.to/from`, `notices.tone.choose/current/help`, `notices.draft.translate/improve`, `notices.accept`;
  - removed, because they are now unused: `notices.translateTo`, `notices.draft`;
  - French has U+00A0 in "Ton : {tone}".
- **D81** amended: the "Review before save" bullet now describes the tab marks and Accept/Undo, and "What is sent" names the Translate button and the tone sheet.
- **Tests** (`notice-draft.test.ts`, 3 new, 6 in the file):
  - the tab states, Accept keeping the text and the translation's source, Undo, and "Keep as is" clearing out of date;
  - `translatePlan` from the open tab, into an empty tab from the last language typed in or the first written one, a re-translate of a Translate draft from its own source, and null when nothing is written;
  - `askTab`: the error of a Translate to two languages belongs to its source tab, of a one-tab Translate to that tab, of Improve writing to its language.

## Decisions
- **One title.** The notice has one title for all three languages (11i), so the title stays above the tabs and does not follow them.
- **A fourth tab state, "Out of date".** With stacked boxes, the "may be out of date" line was visible without opening anything. With tabs it would have been hidden, so the tab shows it.
- **Accept is new.** The brief asks for "accepting or discarding a draft"; before, only Undo existed. Accept removes the draft mark and the partly-untranslated mark, and keeps the text and the translation's source, so the save still links it to its source (D81's out-of-date rule).
- **Translate fills an empty tab ("from EN").** Otherwise an empty tab would show a dead button. It reuses the existing single-language translate (`translate(from, [to])`), as "Update from …" does.
- **The tone picker is a bottom sheet, not a native `<select>`.** With a select, the request would go on `change`. Chrome on desktop fires `change` on every arrow key in a closed select, which would send a Groq request per key. A select also cannot ask for the same tone twice. The sheet is the app's `Sheet`, which is modal on phones and a centred card from 640 px.
- **Language codes on the tabs, full names for screen readers.** At 360, three tabs of 109 px fit "PT" plus "Desatualizado", but not "Português" plus a state word.
- **The removed copy** ("Read it and fix anything before saving.", "Translate to {list}") had no use left. The draft line and Accept carry the meaning.

## Deviations
- **Groq was stubbed differently from 11i.** The brief says to see 11i for how Translate was stubbed, but 11i's e2e used the real Groq key; only its "no key" run had no Groq. Here the Groq URL is a constant (`lib/ai/groq.ts`), so I did not change code. A Node preload (`--import groq-stub.mjs`) wraps `globalThis.fetch` inside `next start` and answers `api.groq.com` with invented text after 700 ms. The real draft route, prompts, the untranslated check and the logging all ran. A text containing `ZZFAIL` got a 500 from both models, and the route answered 502.
- `tabAfter` in `app/_ui/Movers.tsx` became an export, so that the arrow-key logic exists once.

## Verified
- **`pnpm check` exit 0** (prettier, eslint, tsc, vitest, drift, i18n): **142 files passed, 2 skipped; 720 tests passed, 4 skipped** (after the PR #369 review fixes; 719 before). The drift gate said "Everything's fine"; i18n reported 17 languages up to date.
- **Local e2e, Chrome**, on a production build (`next build`, then `next start` on :3237).
  - Setup:
    - local Postgres 18 on 54637 with all 26 migrations, and the bridge on 54638;
    - an invented workspace row and invented Discord ids;
    - a Discord stub on 54639 with two invented officers, Rook and Wren;
    - the in-process Groq stub and a fake `gsk_` key, with upstream pointed at a dead port.
  - Harness: `scratchpad/11p/e2e.mjs`. **77 of 77 checks passed**, among them:
    - one tablist, 3 tabs and one textarea; all tabs Empty; EN Written after typing;
    - ArrowRight, End and Home move the selection and the focus; the EN text is kept across tab switches; tabs are 109 × 56;
    - Translate and Improve writing side by side, 160 px each;
    - while Translate works, it reads "Working…" at the same 160 × 56 and both buttons are disabled;
    - PT and FR tabs say Draft, EN stays Written, and the save bar says "2 drafts to check";
    - PT shows "Draft from Translate, not saved". **Accept** makes it Written, keeps the text, and leaves 1 draft. On FR, **Undo** makes it Empty, then "Translate from EN" fills only FR;
    - Improve writing opens the sheet with the six tones in order, each 44 px; **Warmer** closes it, the button reads "Tone: Warmer", and EN holds the rewrite as "Draft from Improve writing". Undo restores EN, and Warmer is marked when the sheet opens again;
    - a failed Improve shows "The translator did not answer this time…" under the buttons, the buttons keep their size, and the error is not shown on another tab;
    - Cancel asks "Discard your changes?", and closing the page with unsaved text gets a `beforeunload` dialog;
    - the save bar is pinned to the bottom of the viewport;
    - Save with an end date and "Show to members" on, then the read page shows the title, all three languages, "For members" and "Until …";
    - **an existing notice**: Edit shows all tabs Written and the EN text loaded. After an EN-only save, the Out of date tag opens the editor on PT, PT and FR say Out of date, "Update from English" and "Keep as is" are there, and Keep as is makes PT Written;
    - **409**: Wren and Rook edit the title and Rook saves first. Wren's banner names Rook and shows both titles, with the tabs still under it. Keep mine, then Save, saves Wren's title;
    - 360 and 1280, light and dark, EN and PT, plus FR at 360: no sideways scroll on the editor or the tone sheet, and every target is 44 px or more.
- **WebKit, iPhone 14 context** (390 × 844, isMobile, hasTouch, DPR 3, the iPhone UA, cached WebKit 2388 as in the ios-sheets audit), light and dark. Pages checked: new notice, FR draft, tone sheet, a tone tapped, Save, existing notice. **26 of 26 passed**: no sideways scroll; the title, text and date fields at 16 px (44, 182 and 44 px tall); no target under 44 px.
- **Server log**: only codes and timings, never text, for example `{"code":"notices.translate.ok","ms":712,"retried":0,"partly":0}`. The stub counted 12 translate, 4 improve and 4 failed calls in the final run. **No real Groq, Discord or upstream call.**
- **Analytics**: `ws_notice_translated` is still sent with no properties (unchanged call; the type is `NoProperties`). No event was added.
- **Privacy**: all names, ids and texts in the tests, the e2e and the screenshots are invented: Rook, Wren, "Winter fair council", "Garden rota", "Apply today.". The diff was grepped before the commit.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11p-shots/`:
  - `a*`: new notice, working, PT draft;
  - `b*`: tone sheet, rewrite, error;
  - `c*`: before and after save;
  - `d1`: out of date;
  - `e1`: conflict;
  - `f-editor-*` and `f-tones-*`: 360 and 1280 × light and dark × EN and PT, plus FR;
  - `w-*`: WebKit 390, light and dark.
  - Full-page shots draw the sticky save bar partway down the page. Playwright stretches the viewport for them; viewport shots show the bar at the bottom.
- **Designer critique** (a senior mobile product designer, for a non-native English officer on a 360 px phone), from the screenshots:
  1. Fixed: Accept and Undo looked alike, though Accept is the usual answer. Accept now has a plum frame and bold text.
  2. Fixed: an AI error stayed under the buttons after switching to another tab, where it no longer applied. It now shows only on the tab the request was made from, also when the answer arrives after a switch (review of PR #369).
  3. Kept: two-line buttons. "Translate / to PT and FR" says where the text goes without a long label, and "Improve writing / Tone: Warmer ▾" shows the tone and that it opens a choice. Neither button changes size while working or after an error.
  4. Kept: a dot plus a word for the tab states. The colour is never the only signal, and "Draft" and "Out of date" (Desatualizado, Pas à jour) fit 109 px.
  5. Kept: the tone sheet as six full-width rows, with no explanations per tone. The words are short and literal, and a draft can always be undone.
  6. Left (see Open issues): the "Text already in the other languages becomes a draft you can undo." line shows on every edit of a notice that has all three languages. It is one more line of grey text each time.

## Open issues
1. The "becomes a draft you can undo" note shows whenever Translate would replace text, which is every edit of a full notice. It could show only the first time, or move into the Translate button's description. This is a copy and UX choice, not changed here.
2. Browser undo (Cmd/Ctrl+Z) inside the text box resets on each tab change: the box is remounted per language so that each language starts at its own height. The app's Undo for drafts is unaffected.
3. The draft box's tint in dark mode is faint. The plum border carries the mark.
4. No unit test renders the tablist or the action row. The e2e covers them; there is no component-test setup in the repo.
5. Earlier open issues from 11i still stand: the draft route has no rate limit, and the game's own character count is unknown.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The work fit one build pass. The rework came from lint limits (function size, complexity) and two harness timing bugs.
Owner must do first: release dev and open a notice on the phone. Write in one language, Translate, check each tab, Accept or Undo, and Save.
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- A tablist anywhere: `tabAfter(key, i, n)` from `app/_ui/Movers.tsx`, with the `tint-button … aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]` look. `NoticeLanguageField.tsx`'s `Tabs` is a second example with a state line per tab.
- Any "pick one option, then act" control: use a `Sheet` with buttons, not a `<select>` that acts on `change`. Desktop Chrome fires `change` per arrow key in a closed select.
- Stubbing Groq without code changes: `NODE_OPTIONS="--import ./scripts/db-local-preload.mjs --import <groq-stub.mjs>" next start`, with a fake `gsk_` key. The stub wraps `globalThis.fetch` for `https://api.groq.com/openai/v1/chat/completions`. A copy is in `scratchpad/11p/groq-stub.mjs`.
- Officer notes (#297) can reuse the draft bookkeeping (`withDrafts`, `accept`, `discard`, `draftKind`) and `NoticeActions`' two-line button pattern.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/369
