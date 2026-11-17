# 11t — Panel batch D: copy, round 2

Basis: `scratchpad/panel/copywriter.md` (CW-1 to CW-20 and "Strings to cut entirely") and the orchestrator's answers of 2026-11-17. Branch `chore/panel-d-copy` from `origin/dev` (9eed7c6, with batches A, B and C).

## Built
- **Workspace** (EN, pt-BR and fr together):
  - Members: the lead, the legend ("— means no data."), the legend link ("What the labels mean"), the check-in help, the list heading ("To check in with or help"), and the check-in reason ("no new donations or activity for {n} days"). Cut: `list.headingLead`, `members.weekHelp`, and the second sentence of `list.lowFirst`.
  - Names: "Missing info" (chip and help), "Donated" (column), "Member info", "Edit info" and "Info: {name}" (EN), "Top this week", and "Show the tips" (help panel).
  - Screenshots: "screenshot" everywhere in EN (PT "print", FR "capture"), the Discord replies included. `src.photo` is now "from a screenshot".
  - To review: `shots.lead` shows only when the queue has items. `shots.nothingCounts` is cut on Home and on the draft page. The draft page says what Save does (`shots.where.check`), keeps one line about deletion (`shots.draft.kept`), and shows "Read from {n} screenshots." only for 2 or more.
  - Errors with a next step: `shots.readFailed` and `shots.lost.*`, `shots.map`, `noaccess.blocked`, both copy errors, and `calendar.form.notInAlliance`.
  - Calendar: `calendar.kvk` cut, the form label "Event", and the member picker's empty lines.
  - Thefts: `thefts.lead` names the other alliances' players. The times note lost "The week starts Monday."
  - PT: one product name, "Mesa dos oficiais" ("a mesa"), in the Discord replies too. Draft types agree in gender ("Doação diária"). Save and copy errors use one wording each. "Não achamos" is gone.
  - FR:
    - `members.checkinCount` is now "{n} membre(s) à contacter ou à aider", which fixes the grammar of "à qui prendre des nouvelles".
    - The chip is "À contacter".
    - Might is "le Might" in the workspace too, as the public FR glossary has it.
    - Save and copy errors use one wording each.
- **Public** (24 keys, all 17 languages via translate-copy, then stamped):
  - Headings and links: `ledger.movers` is "Biggest changes in this event", and `ledger.toTop` is "Back to top".
  - Kill share vs might share: `ledger.carriedHelp` and `ledger.carriedRatioHelp` are rewritten. `ledger.carriedShown` is removed from `en`, from all 17 languages and from the page.
  - `ledger.topShareHelp` and `ledger.liveDone` are rewritten ("table", not "ledger").
  - Simulators: `merge.lead`, `flow.lead`, `flow.small` and `balance.builderHelp` lost their repeated disclaimers.
  - The once-a-day read is called "daily update" (keys in `standing.*`, `balance.*`, `flow.*` and `history.*`).
  - Errors: `search.noMatch`, `history.copyFailed` and `errors.server.body` each say what to do next.
- **Discord, public message:** `manual` no longer has "Taken by hand.".
- **PT public glossary:** "Members" stays English only as the column label and in `± Members`. Every other sentence and title says "membros". 12 PT strings were fixed by hand. "daily update" is now a glossary row.
- **Code:**
  - `shots.kindScope` is split into one label per kind and tab (`shots.kindScope.<kind>.<scope>`), used by `kindLabel` and `SendScreenshots`.
  - `shots.draft.pages` has one form.
  - `reasonText` fills only `{n}`.
- **Docs:** DESIGN.md's quoted strings now follow the new copy: the movers title and jump link, "Back to top ↑", the 500 body and the search-empty line.
- **Tests:** expected strings only, in `lib/notify.test.ts`, `lib/notify-event-message.test.ts`, `lib/private/discord-interaction.test.ts` and `lib/private/members-sheet.test.ts`.

## Decisions
- **Officers' Desk, PT "Mesa dos oficiais":** the orchestrator's choice, which overrides CW-4 ("Painel"). Short references say "the desk" / "a mesa" / "le bureau".
- **One word for the end-of-day read: "daily update"** (PT "atualização diária", FR "mise à jour quotidienne"). It is used in the workspace, on the public pages and in the Discord replies. /admin keeps the glossary terms ("daily read", "snapshot"), as CW-15 suggests. Code and docs keep "end-of-day read" and "daily read".
- **The Members heading says what it holds,** "To check in with or help", rather than repeating the count line. The count link sits right above it.
- **"Grandma noticed" becomes "Biggest changes in this event"** (orchestrator). The drawn magnifier stays; there is no Grandma kicker.
- **Kept, per the orchestrator:** "Nothing recorded yet. The kettle is on." on the public empty state, and "Simulation, not a plan" (D84) word for word in every language.
- **The 500 body** is now "Something broke on our side. Try again in a minute." This follows CW-12 and the rule that every error says what to do next.
- **The check-in reason drops the activity and donation values and the read count** (CW-2). The member sheet still shows the week's activity and donations day by day.
- **Translator fixes by hand:**
  - fr: `liveDone` kept "registre"; four no-break spaces were missing; the copy error.
  - pt-BR: `topShareHelp`, `history.lead`, and "Might" in capitals.
  - sv: `carriedRatioHelp` kept "÷".
  - zh-CN: the movers heading ended in 的.
  - ja: `search.noMatch` kept "台帳".
  - ko: the movers heading lacked 의.

## Deviations
- **Applied:** CW-1, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17 and 19 in full. CW-2 and CW-18 in part. Every row of "Strings to cut entirely".
- **CW-2, partly:** the reason is shorter, but at 360 px it is still cut off with "…" in EN and PT (`members-rows-360-*.png`). The row's reason line is `truncate` (`MemberListRow.tsx:73`). Showing it whole needs a layout change: two lines, or the reason under the name. That is not copy, so it is a follow-up.
- **CW-4:** overridden by the orchestrator. PT uses "Mesa dos oficiais", not "Painel".
- **CW-8:** `home.title`, `home.next` and `home.empty` were already changed or removed by batch C. Only `shots.lead` and `shots.nothingCounts` were left to apply.
- **CW-18, partly:** PT `sheet.rank` "Cargo" was not changed. The report rates it "later".
- **CW-20 ("later"):** only `thefts.lead` was done, on the orchestrator's instruction. Not done:
  - one name for Secret Ops;
  - an empty-theme string for `calendar.theme`;
  - splitting `calendar.suggest.how`;
  - moving `thefts.lead` above the times note.
- **Not edited:** D98's record quotes "Info to ask" and "… Not a ranking." It is a decision record of what shipped then, not an owner ruling on wording.

## Verified
- **`pnpm check` exit 0:**
  - prettier, eslint, tsc, vitest (147 files, 775 passed, 4 skipped), drift;
  - the i18n step: "17 languages up to date with English".
- **Production build:**
  - `next build`, then `next start -p 3637`.
  - Database: panel-a's local Postgres, migrated to 0026, with its invented seed.
  - Discord: the stub. Upstream: pointed at a dead port.
- **360 px, light, EN and PT:**
  - Screens: Home, Members (whole page, top, check-in rows), the notice editor (new and existing), Thefts, a Might draft, the public home, the event page (kill share), merge, flow, balance, and /admin (EN only, D48).
  - No page scrolls sideways.
  - No button, tab, summary or chip label wraps onto a second line (the script's check).
  - Close-ups: the movers jump link, the movers card, kill share, merge, flow and balance.
  - Files: `scratchpad/panel-d-shots/` (`checks.json` holds the results). Scripts: `scratchpad/panel-d/shots.mjs` and `clips.mjs`.
- **Spot-checked translations:** pt-BR, fr and es in full, the other 14 by their reports. The fixes are listed under Decisions.
- No upstream, Groq or real Discord call. All data is invented.

## Open issues
1. The check-in reason is still cut off at 360 px (see Deviations, CW-2). It needs a row layout change.
2. Most `lib/i18n/glossary/*.md` files repeat their main table 2 to 16 times (it.md has 16 copies), an old merge artifact. Stale rows remain in some copies: "Grandma noticed" and "Daily read". A clean-up would make each file one table.
3. Glossary, id: the "Defender" row still cites `ledger.carriedHelp`, which no longer mentions defenders.

## Next
Session: the next panel batch the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The batch fit one pass. Most of the time went to the 17 translator round trips (three at a time) and the local build.
Owner must do first: read Round 2 in `scratchpad/copy-pass/SAMPLE.md`, and decide whether the check-in reason may take two lines on the Members row.
Plan changes needed: none.

<adjustments>
- One name per thing:
  - "Officers' Desk" / "Mesa dos oficiais" / "Bureau des officiers"; in short, "the desk".
  - "screenshot" / "print" / "capture".
  - "daily update" for the once-a-day read in any player-facing string.
  - "Member info".
  - FR "le Might".
  - PT public sentences say "membros".
- Errors: "Could not save. Try again." and "Could not copy. Try again."; PT "Não foi possível salvar/copiar. Tente de novo."; FR "Impossible d’enregistrer/de copier. Réessayez."
- A label that combines a kind and a tab gets its own key per language (`shots.kindScope.<kind>.<scope>`). Do not compose it, because of gender agreement.
- A translate-copy round must name, in each translator's prompt, the English words that changed (for example "ledger" → "table"). Haiku translators otherwise mark such keys "unchanged".
</adjustments>

PR: not opened; the orchestrator pushes the branch and opens it.
