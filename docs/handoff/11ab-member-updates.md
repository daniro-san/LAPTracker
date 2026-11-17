# 11ab — Member updates (issue 347, D109)

The owner's correction of 2026-11-16 applies: no weekly round, so there is no "not updated in 7 days" list, no progress counter and no "asked" marks. The owner's addition of 2026-11-17 is included: "Read from a screenshot".

## Built
- **The trend on the card** (`lib/private/fact-trend.ts`, `lib/private/member-card.ts`, `app/(private)/_ui/MemberCards.tsx`). Main squad and AD Tech show the value, the change since the version before, and the day the value was saved, for example "10.2M (+400K since Tue, Nov 10)" with "Updated Mon, Nov 16" under it, and "74% (was 69%)". The version before is read from the append-only `member_facts` table with a new repo read, `factHistory` (`lib/repo/member-facts.ts`). The date is small plain text, never a warning.
- **AD Tech at 100 % is complete.** `AD_COMPLETE` moved to `fact-fields.ts`, and the import hook now imports it. The card shows "100% (complete)". "Missing info" (`factsToAsk`) already left out any AD Tech that has a value, so nothing changed there; the e2e checks it. The 11k rule is reused: in a member-update draft, the AD Tech row of a member already at 100 % starts dropped and is not written again.
- **Chat screenshots for registered members.** Checked, no change: a member-update draft already proposes the next version (before → after) and saves it "from a message". The existing test in `import.test.ts` covers this, and the new `paste-updates.test.ts` covers it too.
- **Paste updates** (Members, under the legend, `app/(private)/_ui/PasteUpdates.tsx`). It takes one member per line, in any order. `nameAndValues` (`onboarding-parse.ts`) splits a line into the name and the rest, and D80's parser reads the rest. The lines go to the existing `POST /api/w/[slug]/shots` with the type Member update, so they become a member-update draft. The officer lands on the existing draft review: before → after per row, member pickers, "New member" for an unknown name (D106), Save. The member-update reader (`import-photo-hooks.ts`) reads a page with no chat sender line as pasted lines. The per-card paste is unchanged.
- **Read from a screenshot** (`app/(private)/_ui/ReadScreenshot.tsx`). The button sits beside the paste box in Edit info, in Add a new member (the same editor) and in Paste updates (several pictures). It reuses `POST /api/w/[slug]/shots/read` and the desk's `toPng` (status bar dropped, 1080 px). The status-bar constants moved to the pure `lib/screenshot/status-bar.ts`, and `prepare.ts` re-exports them. The route now allows one read at a time per officer; a second read while one is running gets 429 `busy`. In the editor the text is read at once ("Found 2 values…"). In Paste updates the text is appended to the box.
- **Progress in the thanks.** Members shows a "Progress this week" list under Top donors and Most active. Home shows the same as one line. The Home change is small and stays out of the activity section (#335 is building that section).
- Words in EN, PT-BR and FR are in `dictionary.members*.ts`. The editor's word list gains `shot.*`, and a new `updatesWords` holds the sheet's words.

## Decisions
- D109 (new). Its main points:
  - "Notably" means main squad saved this week at least 5 % above the newest value saved before the game week began.
  - AD Tech counts as reached when it is saved at 100 % this week and the version before it was below 100. A first value of 100 is not thanked, because there is nothing to compare it with.
  - Members on a break are left out of the thanks; new members are not.
  - The list is in name order and is not a ranking.
- Paste updates makes a draft, not an inline review, so the officer reviews it on the existing review screen. The busy button follows D100's desk rule. Drafts have no request id.
- A guard against a second concurrent read is per server instance (an in-memory set).

## Deviations
- After the draft exists, Paste updates opens it with a full page load (`window.location.assign`). With `router.push` the open sheet's history entry undid the soft navigation (found in the e2e).
- The change on the card is compact: "+400K", not "+0.4M" as in the issue's example. D78 formats numbers this way everywhere.

## Verified
- `pnpm check`: prettier, eslint, tsc, the drift gate and i18n ("17 languages up to date") pass. Vitest: 173 files and 917 tests passed. Three tests in other areas timed out under load: `app/api/tick/route.test.ts`, `member-roles-migration.test.ts` and `thefts.test.ts` (the migration tests). Run again on their own, all passed (24 tests). After the last change, prettier, eslint, tsc and the 8 affected test files (52 tests) were run again and pass.
- New tests:
  - `lib/private/fact-trend.test.ts` (3): the card's value, change and date; AD Tech complete with no earlier version; the week's progress (5 % threshold, AD 90 → 100 this week only, name order).
  - `lib/private/paste-updates.test.ts` (1): lines in any order become a matched draft, and the save appends version 2 for a registered member.
  - `onboarding-parse.test.ts` (+1): name splitting.
  - `app/(private)/api/w/[slug]/shots/read/route.test.ts` (1): an officer gets the lines; a member gets 401; a second read during the first gets 429 `busy`; no draft or picture is stored.
  - `app/(private)/_ui/screenshot-upload.test.ts` (1): a picture's text in the paste box fills main squad and AD Tech.
  - The read route already had its `member-session.test.ts` entry.
- Local e2e on a production build (:3957), with the local DB, the Discord stand-in and an invented 40-member roster: **63 of 64 checks pass in Chrome**, and the one failure was WebKit. A separate WebKit run with an iPhone 14 profile passed **3 of 3**: `accept="image/*"` with no `capture`, the picker opens with several pictures allowed, and the page does not scroll sideways. What the e2e covered:
  - the thanks, the card trend, complete, Missing info and the Home line;
  - Paste updates → review (10,200,000 → 10,600,000, the 100 % row dropped) → Save → the card shows "10.6M (+400K since Mon, Nov 16)", "78% (was 74%)" and "Updated Tue, Nov 17";
  - Read from a screenshot with the real local OCR on a generated chat picture: Edit info filled 11,100,000 and 80; Add a new member has the button; in PT, Paste updates made a draft from the picture.
  - No sideways scroll, targets of 44 px or more, and fields at 16 px.
- Privacy grep of my diff against the 101 names of the OGs fixture: 0 hits, after replacing one name from the issue in a code comment.
- Screenshots (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ab-shots/`: `members-{360,1280}-{light,dark}-{en,pt}`, `members-360-light-fr`, `card-*`, `card-trend-*`, `card-after-paste-*`, `paste-updates-*`, `paste-review-*`, `edit-info-screenshot-*`, `home-*` and `iphone-paste-updates-390-light-en`. Designer pass: nothing overflows. At 360 the two paste buttons in the editor stack.

## Open issues
- The draft review of a pasted draft says "from a screenshot" and "Screenshots are not kept" in its header. That wording is correct for pictures but not for typed lines. Changing it needs a draft source other than `desk`, which needs a migration.
- The read guard is per instance. Two Vercel instances could each read one picture for the same officer at the same time.
- The card's change is shown on members' cards only. Pending and former members get the "Updated" date but no change, because their cards do not read the history.

## Next
- Model/effort: keep. The scope fit one sitting, including the owner's added item.
- What the owner must do first: merge after review. No migration and no environment change.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- `factHistory(db, workspaceId, fields, uid?)` returns every version of the named fact fields. Use it for any "before" view; do not add another history read.
- A member-update draft can come from typed lines (a page with no chat sender line). A future change to `memberUpdate.read` must keep both shapes.
- `POST /api/w/[slug]/shots/read` answers 429 `busy` when the same officer already has a read running. A new caller must handle that code.
- The phone status-bar constants live in `lib/screenshot/status-bar.ts`. Browser code imports them from there, not from `prepare.ts`.
</adjustments>

PR: (added by the orchestrator)
