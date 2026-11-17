# 11af — Member card actions in the sheet's bar, thin scrollbars

## Built
- **Member card bar.** "Edit info" (main) and "Paste what they told you" (second) moved from the end of `Facts` (`app/(private)/_ui/MemberCards.tsx`) into the Sheet's sticky bottom bar. They stay in view while the content scrolls.
  - `Facts` no longer holds the editor's mode. The sheet that shows it holds `mode` (`FactsMode`) and passes `mode` and `onEditorClose` down. `factsActions(words, open)` builds the bar's `primary` and `secondary`. The FactsEditor opens as before, as a sheet over the sheet.
  - Member sheet (`MemberSheet.tsx`): the bar appears once the card is read. While loading, and on "Could not load" or signed out, there is no bar.
  - New member sheet (`PendingMembers.tsx`): the bar holds Edit info and Paste. "Link to a member" and Remove stay in the content, because the bar holds two buttons. "Link to a member" changed from primary to secondary, so the sheet has one main action.
  - Former member sheet (`FormerMembers.tsx`): the bar holds Edit info and Paste.
  - "Edit info" stays on one line (`whitespace-nowrap` in its label). At 360 px a long second label wraps to two lines instead ("Colar o que a pessoa disse", "Coller ce qu’on vous a dit").
- **Scrollbars** (`app/globals.css`): `html` and `dialog` get `scrollbar-width: thin` and `scrollbar-color: color-mix(--ink 35%, transparent) transparent`. For Safari, `::-webkit-scrollbar` is 8 px wide with the same thumb on a transparent track. `--ink` changes with the theme, so the same rule works in light and dark. Scrollbars are never hidden.
- `docs/DESIGN.md` "Workspace components" → Sheet frame: says which sheets now have a bar, and records the scrollbar choice.

## Decisions
- Pending sheet: Link and Remove stay in the content, not in the bar. A bar with four buttons does not fit at 360 px. "Edit info" is the main action, as asked.
- The scrollbar applies to the page (`html`) and to every sheet (`dialog`), not to other scrollers such as wide tables. Those inherit the colour from `html` but keep their default width.
- The thumb is `--ink` at 35 %, not `--rule`. `--rule` on paper is about 1.3:1, too faint for a desktop user to see that the sheet scrolls.

## Deviations
- "Link to a member" in the new-member sheet is now `button-secondary`, not primary (see Built).
- None of the D106/D107 wording changed. The decisions describe what the sheets hold, not where, so they need no amendment.

## Verified
- `pnpm check` exits 0. Vitest: 182 files passed, 2 skipped; 961 tests passed, 4 skipped. Drift: "Everything's fine". i18n: 17 languages up to date.
- **Local e2e, 120 of 120 checks.** Setup:
  - production build (`next build` + `next start` on :3983);
  - `db:local` on 57183 with 38 migrations, the bridge on 57184;
  - 11x's invented roster (three nightly reads, four leavers), one invented new member "Tobiah", one officer session cookie;
  - no upstream, Discord or Groq call; no `/api/quota`.
- Combinations: member, new member and former member sheets at 360 and 1280, light and dark, in EN. All three again at 360 light in PT-BR and FR.
- Checks on the member card:
  - the bar holds Edit info, then Paste, both ≥ 44 px (48 px);
  - the content scrolls, and the bar is in view at the top and after scrolling to the end;
  - no Edit/Paste is left in the content;
  - nothing scrolls sideways (page and sheet);
  - the computed `scrollbar-width` is `thin` on the page and the sheet, and the thumb is ink at 0.35 on a transparent track;
  - Edit info opens the editor, and its last text field, when focused, sits 35 px above the editor's bar (`revealFocused`);
  - Paste opens the editor with the paste box;
  - Escape returns to the card.
- Checks on the new-member and former-member sheets: the bar holds the two actions, Link and Remove are in the content (new member), nothing scrolls sideways, and the bar buttons open the editor.
- Design pass: the first run showed "Editar dados" wrapping to two lines beside the long PT second label. Fixed with `whitespace-nowrap` (see Built), rebuilt, and 120 of 120 again.
- Screenshots (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11af-shots/`:
  - `member-{top,end,edit,paste}-<width>-<scheme>-<lang>`;
  - `pending-…`;
  - `former-…`.
- Not run: iPhone WebKit. Headless Chrome screenshots draw no scrollbar, so the thin bar was checked through computed style, not by eye.

## Open issues
- At 360 px in EN the second button ("Paste what they told you") is wider than the main one. DESIGN.md says the main action is widest. Changing that needs a shorter label or stacked buttons, which is an owner call.
- In the new-member sheet, the bar's buttons and Link/Remove are four buttons close together. If officers mix them up, an option is to move Link and Remove under a "More" line.

## Next
- Model/effort: keep. A small UI change that fit one sitting with the e2e.
- What the owner must do first: nothing beyond merging. No migration, no new setting.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A sheet that shows member facts must hold the editor's mode itself and pass `mode` and `onEditorClose` to `Facts`, with `{...factsActions(editor.words, setMode)}` on its `Sheet`. `Facts` has no buttons of its own any more.
- Thin scrollbars are global for `html` and `dialog` (`app/globals.css`). A new scroller inside a page inherits the colour only.
</adjustments>

PR: (added by the orchestrator)
