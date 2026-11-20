# feat-412-pr4-notice-tabs — a notice's read page in language tabs

Issue #412, rollout PR 4, the notices part. Owner: "the notices page is still bad, why isn't it in tabs".

## Built

- **Read page in tabs.** `/w/[slug]/notices/[id]` shows one language at a time in the editor's tab strip, the officer's language first. On opening, the first written language in that order is shown. The three stacked language cards and their headings are gone.
- **The shared tab strip** moved from `LanguageEditorParts.tsx` to `app/(private)/_ui/LanguageTabs.tsx`. The notices editor, the read page and Start here use it. It follows the WAI-ARIA tabs pattern: arrow keys, Home and End, `aria-selected`, `aria-controls`, and one panel labelled by its tab. Three tabs at 360 px are 109 × 56 px each.
- **What each tab shows:**
  - the text's length beside the code ("PT 433", seal when over 1,000; screen readers hear "433 of 1,000 characters");
  - one state: Missing, Out of date (yarn dot), ✓ Reviewed, Translated (AI), Written, and in the editor Draft (plum dot).
  - "Missing" replaces "Empty" in both editors.
- **Translated (AI) is stored.**
  - `notice_edits.translated` (boolean, default false; migration `drizzle/0056_notice_translated.sql`, generated).
  - `planSave` sets it when the change names Translate's source (`from`), keeps it when the same text is saved again ("Keep as is"), and clears it on a hand change.
  - `noticeDetail` returns `translated` and `savedAt`. The page passes only the language lists to the client, never the times.
- **Reviewed** is `reviewedLanguages` in `lib/private/notice-rules.ts`: a request on that language or on the whole notice, answered at or after the language's last save.
- **The panel** holds what each card held:
  - "Review waiting";
  - "Update Português" when the language may be out of date (it opens the editor at that language);
  - the text and the line over the game's limit;
  - the three copies with their lines;
  - "Ask for a review" of that language;
  - or "Not written yet.", where the panel takes the focus.
- **Actions keep their scope.** Copies and "Ask for a review" act on the tab in view. Publish to Discord, the calendar link and Delete act on the whole notice, unchanged.
- **Edit** opens the editor at the tab in view, without scrolling past the title (new `start` prop on the editor).
- **Open review requests** sit under the tab strip. "Jump to Français" opens that tab, and is left out while that tab is in view.
- **The Review section** shows only when a request was answered, and lists those. The tabs and the panel are at most the editor's width (`max-w-2xl`).
- **Docs:** dated amendments to D113 (this change) and D116 (Empty → Missing, the file move), and DESIGN.md's "Language editor" line.

## Decisions

- **Missing is a stored-free state; Translated is stored.** A text's AI origin can't be derived from `basis` (a hand catch-up and a translation can share one), so it needs the column. Notices saved before this read as Written.
- **State order:** draft, out of date, missing, reviewed, translated, written. A reviewed translation reads Reviewed.
- **In the editor, a changed text:** an accepted translation not saved yet reads Translated (AI); any other change reads Written.
- **The tab's count** follows the owner's comment on #412 ("each tab shows the language's count"). The editor keeps its counter under the text box too.
- **Persona panel, 2026-11-20** (an R4 on a 360 phone writing in PT, a product designer, product strategy) on the first shots: all three said "ship with fixes". Applied:
  - the open review requests moved under the tabs, so the tabs are on a phone's first screen;
  - "Jump to …" is hidden while that tab is in view;
  - one "Ask for a review", in the panel. The sheet still offers "the whole notice", so the Review section's second button went;
  - the panel's "Out of date" tag is now a verb, "Update Português" / "Atualizar …" / "Mettre à jour …", with a gap above it. The old override label "… may be out of date. Edit the notice" is gone, so the visible words are the button's name;
  - the neutral state words are 12 px in the text colour (was ink at 70 %);
  - checked: the editor's help line above Save is not clipped by the sticky bar at 1280 (viewport shots `check-savebar-*`).

## Deviations

- **"Mark as out of date"** was the panel's suggested wording. It was not used: the control shows only on a tab that is already out of date, and it opens the editor to update the text. The app marks a language out of date by itself, so a "Mark as …" verb would describe something the button does not do. "Update {language}" is used instead.
- **"Rook approved English" in PT and FR views** was reported as a bug. It is the recorded design: D113 names each language by its own name ("Review asked by Ana · Français"), as the 2026-11-17 persona panel chose. It is left as is; the D113 amendment says so. If the owner wants the reader's language instead, it is one map in `reviewProps`.
- **French numbers ("1120")** were reported as unformatted. They are formatted: `Intl` gives "1 120" with the narrow no-break space (U+202F), which is thin at 14 px. No change.
- **Not in this PR:** the rest of the owner's PR 4 comment, which this task did not ask for:
  - the copy toolbar as a split button;
  - `PageHead` with Edit, Publish and More;
  - the ledger spread from 1024;
  - the notices list as a grid with filters.

## Verified

- **`pnpm check` exits 0** (prettier, eslint, tsc, vitest, drift, i18n): 240 test files passed, 2 skipped; 1,297 tests passed, 4 skipped; i18n: 17 languages up to date.
- **New tests**, one per behaviour:
  - `notice-rules.test.ts`: a saved translation stays translated when kept as is and not after a hand change; `reviewedLanguages` for a language request and a whole-notice request;
  - `notice-draft.test.ts`: the editor's saved states (reviewed, translated, missing; a hand change gives written). The existing tab-state calls moved to the new signature; an accepted unsaved translation now reads translated;
  - `NoticeScreen.test.ts`: one panel, the reader's language first and selected, the panel labelled by its tab, the PT state words;
  - the notices route test: a save with `from` stores `translated = true`, a hand save false;
  - `StartHereEditor.test.ts` expects "Missing".
- **Local e2e on a production build, 25 of 25 checks pass.**
  - Setup: `next build` and `next start` on :3988, local Postgres 18 with 54 migrations (run before the rebase onto #505, #506 and #508; the migration was renumbered from 0053 to 0056 after it, and `pnpm check` runs every migration on PGlite), an invented seed (workspace OGs; officers Ana, Wren and Rook; notices "Alliance Duel this week" and "Caravan times"), and a Discord sign-in stand-in. Every https call is blocked, so no Groq, Discord or upstream call was made.
  - Checked:
    - tab order and selection; every tab ≥ 44 px at 360; no sideways scroll;
    - the states on both notices, and the seal count on FR (1,120);
    - arrow keys, Home and End move the focus;
    - the copy buttons copy the visible tab (read from the clipboard), before and after a switch;
    - "Ask for a review" opens with the tab's language chosen; one such button on the page;
    - the requests sit under the tabs; "Jump to Português" opens PT and is then left out;
    - Publish is still offered;
    - Edit opens at the tab in view with scrollY 0; the editor shows the same states, and a hand change turns Reviewed into Written;
    - "Update Português" opens the editor at PT; no sideways scroll in the editor at 360.
  - Scripts: scratchpad `412p4/` (`e2e.mjs`, `seed.mjs`, `savebar.mjs`, `start.sh`).
- **Shots:** 78, after the panel fixes: read1, read2 and edit1 at 360 / 640 / 768 / 1024 / 1280 / 1440, light and dark, EN and PT, plus FR light at 360 and 1280, and two viewport shots of the save bar.
  - Folder: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/412p4-shots/`, with `metrics.json`.
  - No page scrolls sideways (0 of 78).
  - At 360 the tabs are on the first screen, under the Edit button.
- **Privacy:** none of the 327 fixture roster names is in the branch's added lines. The seed and the shots use invented names only.

## Open issues

- In a full-page capture, the editor's sticky save bar shows mid-page at 1280. That is the capture, not the page: the viewport shots show it at the window's foot. The bar is unchanged in this PR.
- "Review waiting" in the panel and the open request just above it say the same thing on the request's tab. They could be merged in the toolbar PR.
- The Reviewed state counts only the 20 newest answered requests that `noticeReviews` reads (D113's limit). On a notice with more, an older approval may not show.

## Next

- Model/effort: keep. The rest of rollout PR 4 is layout on known components.
- What the owner must do first: nothing. The migration adds one column with a default, so no backfill is needed.
- Plan change: none.

<adjustments>
- Rollout PR 4's remaining notices work, from the owner's #412 comment:
  - the copy toolbar (split button or segmented control) inside the tab panel of `NoticeScreen.tsx`'s `LanguagePanel`;
  - `PageHead` with Edit, Publish to Discord and More (Delete);
  - the ledger spread from 1024, with review status, publish history, picture and Calendar links in the margin;
  - the notices list grid with filters.
- The tab strip is done and shared (`LanguageTabs.tsx`). Do not rebuild it.
- The read page's panel is already capped at `max-w-2xl`. The spread's main column should drop that cap when it lands.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/510
