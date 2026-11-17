# 11x2 — New members and former members: the owner's four answers

Part of #293. Follows PR #385 (D106, D107). Branch `fix/member-lifecycle-owner-answers`, on `origin/dev` at 99f46e5. Rules applied: D71, D75, D99, D100. Dated amendments (2026-11-17) to D106 and D107.

## Built
1. **A name already in the alliance.**
   - "Add a new member": when the typed name has a current member's name key (newest roster), the sheet says "<name> is already in the alliance. Open them instead?" with "Open" (`/w/<slug>/members?q=<name>`) and "Add anyway". Save is off until the officer answers. "Add anyway" holds for that name key.
   - The import's "New member" row: same check. The line reads "… Pick them instead?" with "Pick them" (puts that member in the row; with several members of that name it goes back to the picker) and "Add anyway". The draft's Save explains: "Row #n: that name is already in the alliance. Pick them, or tap Add anyway."
   - Rule: `sameName` in `lib/private/roster-search.ts` (browser-safe). The import's state check: `takenBy` in `DraftRowCard.tsx`.
2. **To match.** `toMatch(pending, rosterAt)` in `lib/private/pending-members.ts`: open pending members added at or before the newest roster's read time, after matching ran. Computed on read only.
   - Home now runs `reconcilePending` before its reads, as Members does, and shows "<n> new members to match" in "To review", linking to `/w/<slug>/members#to-match`.
   - Members: at the top of "New members", a box with that line, a one-line reason and each one with "Link to a member" (opens the picker directly). Their tag reads "To match".
3. **Former members' Alliance Duel points.** `newestDuelWeeks` in `lib/repo/import.ts` reads the newest saved week per former uid. The row and the sheet show "Alliance Duel, week of <Monday>: <week total> · Mon … · Tue …" with the member card's formatter (`duelText`, now exported and taking the duel map).
4. **Delete keeps the record.** Migration `drizzle/0031_pending_members_dismissed.sql`: `pending_members.dismissed_at`. The one-open-per-name-key index now also skips dismissed rows. Delete sets `dismissed_at`; facts and points stay. "Open" now means neither matched nor dismissed. Members lists dismissed ones under "Dismissed (<n>)", a closed `details` below "Add a new member", read-only, each with the day it was dismissed and its facts on one line. Adding the same name key again (by hand or from the import) reopens the newest dismissed record (`reopenDismissed`): new name as typed, new add time, the add's request id.
- **Words:** 19 new keys in en, pt-BR, fr in `lib/private/dictionary.lifecycle.ts`. Changed `pending.deleteAsk` ("Delete <name> from the list? The info added here is kept under Dismissed."); recorded in the D106 amendment.
- **Docs:** amendments to D106 and D107, ARCHITECTURE (pending-members line), GLOSSARY ("to match", "dismissed").
- **Tests (one per behavior):**
  - `lib/private/roster-search.test.ts`: the name warning rule (`sameName`).
  - `lib/private/pending-members.test.ts`: "To match" after tonight's read, and after a newer read for one added later.
  - `lib/private/former-members.test.ts`: the newest Duel week of a former member; the key list now includes `duel`.
  - `app/(private)/api/w/[slug]/pending/route.test.ts`: the delete test is rewritten. Delete keeps the row (dismissed), its fact and its points, a second delete answers 404, and re-adding reopens the same uid.

## Decisions
- **Where dismissed members are readable:** a closed "Dismissed (n)" group in the Members tab's pending section. It is read-only, and its facts show on one line. To edit them, the officer adds the name again, which reopens the record. Dismissed facts are not writable (`mayHaveFacts` checks for an open pending member).
- **Save waits for an answer** on a taken name, in both places. "Add anyway" is remembered per name key, so typing another matching name asks again.
- **Import "Open" is "Pick them".** Leaving a draft would lose the officer's row fixes, so the import's action picks the member for the row instead of linking away.
- **Home runs the match too.** Without it, Home would count a pending member that the next Members read would match. Running the match on Home also partly covers 11x open issue 2: the match no longer waits for an officer to open Members.
- **Reopen resets `created_at`** to the new add. A re-added member waits for the next roster read, as a new add does.

## Deviations
- None from the four answers. The import's action is labeled "Pick them" instead of "Open" (see Decisions).

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc. Vitest: 163 files passed, 2 skipped; 858 tests passed, 4 skipped. Drift: "Everything's fine". i18n: "17 languages up to date".
- **Local e2e, 87 of 87 checks**, the same run in EN and PT-BR. Setup:
  - production build (`next build` + `next start` on :3947) of this branch;
  - `db:local` on 54947 with all 32 migrations, the bridge on 54948, the Discord stand-in on 54949;
  - 11x's invented 41-member roster (three end-of-day reads, four leavers).
  - No upstream, Groq or Discord call; no `/api/quota`.

  Checks:
  - Home shows "1 new member to match" (PT "1 membro novo para ligar") linking to `#to-match`;
  - the Members box lists the one To match with "Link to a member", which opens the picker; the one added after the read stays in the waiting list;
  - typing "maelis" shows the line, Open's address is `?q=Maelis`, and Save stays off; "Add anyway" turns it on, and the answered key does not ask again;
  - delete keeps the row (dismissed) and its note; "Dismissed (1)" shows the note; re-adding returns the same uid with the record reopened;
  - the former row and sheet show "Alliance Duel, week of Mon, Nov 9: — · Mon 2.40M · Tue 3.10M" (the older week's total is not shown);
  - the import row shows "Pick them instead?", Save's reason line appears, and "Pick them" puts Maelis's uid in the row;
  - at 360: no sideways scroll, every target ≥ 44 px, fields at 16 px on Home, Members, the add sheet, Dismissed, Former members and the import row;
  - the server log holds no member name or note; `app_errors` is empty.
- **Privacy:** invented names only. The former-member read still takes only uid, name, might and kills from rosters; the Duel points come from the officers' own saves.
- **Screenshots** (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11x2-shots/`: `home-to-match`, `members-to-match`, `add-name-taken`, `delete-ask`, `dismissed`, `former-duel`, `former-sheet` and `import-name-taken`, each at `360-light-{en,pt}`. A design pass found that the Dismissed summary had no open/closed marker. It now keeps the default marker.

## Open issues
1. The import's "New member" for a member update sends version 0. If the reused pending member (open or reopened) already has that fact, the save conflicts. This existed for open pending members before this change; reopening makes it more likely.
2. Only 360 light EN/PT screenshots were taken, as the task asked. 1280, dark and WebKit were not re-run for these screens.
3. A former member whose newest saved week has only daily values shows "—" for the week total, as the member card does.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The four answers and the e2e fit one pass.
Owner must do first: merge, release dev, then on a phone delete a new member, open "Dismissed" and add the name again.
Plan changes needed: none. The workspace track lives in issues.

<adjustments>
- Open pending member = `matched_uid is null and dismissed_at is null`. Any new read of `pending_members` must use `open()` / `dismissed()` in `lib/repo/pending-members.ts`.
- Migration `0031_pending_members_dismissed` collides by number with #386 (`0031_members_board`) and #387 (`0031_follow_up`); renumber at merge.
- `toMatch(pending, rosterAt)` is the one rule for "To match"; Home and Members both use the newest roster's read time from `membersView`.
</adjustments>

PR: (added by the orchestrator)
