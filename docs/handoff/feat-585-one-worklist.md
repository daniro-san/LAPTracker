# feat/585-one-worklist: Follow-up says who is left and who was already noted (#585 batch 3, slice 1)

Part of #585 (F3, F14, F15, F21, F29). Size L, planned with `/tlc-spec-lean`: `.specs/features/585-one-worklist/plan.md` (checks in `checks.md`). Six slices; only slice 1 (S1) is built here.

## Built

- **Follow-up's head** leads with the week and its two numbers: "Week Nov 16 – 22", "12 to look at · everyone else is fine" (the owner's words, now semibold) and "4 others already noted this week ↓", a 44 px jump to the new card. D140's "what to do" line and D104's help line follow.
- **"Check in · n" is "Worth a hello · n"** ("Vale um oi", "Un petit mot"). Under "12 to look at", "Check in · 1" was read as the answer by three of six officers.
- **"Noted this week · n"**, after the to-do groups and before the thefts, shown once the alliance has a daily update.
  - It holds one row per current member with a record still counting since Monday 00:00 ST, newest first.
  - Each row has the name as a link to the member's card (`/w/[slug]/members?m=<uid>`), the rank, "Tomas · Thu, Nov 19: Talked to them" ("On a break until Wed, Nov 25" for a break), and the note on its own line.
  - Everything in the list is inside `ph-no-capture`.
  - With nobody noted, the card says "Nobody noted yet this week."
  - The Monday rule moved under its title, so it stays on the page.
- **Home and Members** show "Follow-up: 12 to look at · 4 noted this week" as a link to Follow-up.
  - The numbers come from `followUpCounts`: the same `worklist`, tips, members view and week start (Monday 00:00 ST of today) as Follow-up. It reads only uid, action and time.
  - While the Follow-up tab is off (D126), nothing is read and the old line and link stay.
  - The rendering is shared: `checkInLink` and `CheckInLine` in `HomeMembers.tsx`.
- **Code:**
  - `lib/private/follow-up.ts`: `weekLists`, `followUpCounts`, `WeekCounts`, and `done` on `FollowUpView`.
  - `lib/private/follow-up-rules.ts`: `doneThisWeek`, `weekCountLine`, `notedLine`.
  - `lib/repo/member-follow-ups.ts`: `notedSince`, with note, until and the officer's desk name, for the Follow-up page only. `followedUpSince` is unchanged.
  - Home's margin column moved to `app/(private)/_ui/HomeMargin.tsx` (a pure move, so the page stays under the lint size limits).
- **Words:** 12 new keys in `dictionary.followup.ts` (EN, PT-BR, FR) and the group title in all three.
- **Docs:**
  - Dated amendments to D104 (the head, the group title, the Noted card, the reads, Home and Members' rule) and D140 (head order, group names).
  - A dated "Changed" line in the tracking plan.
  - The `needsAWord` comment says when Home and Members use it.
- **Tests:**
  - `lib/private/follow-up-week.test.ts` (new, PGlite, 4 tests).
  - 2 tests in `lib/private/follow-up-rules.test.ts`.
  - `app/(private)/_ui/HomeMembers.test.ts` (new, 1 test).
  - `e2e/desk-flows.spec.ts`: the Follow-up flow checks the Noted row and its card link, after a reload, and its absence after Undo.
  - `e2e/desk.spec.ts`: Home checks the Follow-up link.

## Decisions

- **"Noted", not "Done".** Panel MUST and adversarial MUST: "done" read as "closed" or "quit", and a "Needs help" row listed as done reads as dismissed (D75).
- **"4 others already noted"** (round 1 had "4 already noted"). One ESL officer read "12 to look at · 4 already noted" as "8 left".
- **The officer and day lead each row, with "·" separators.** This answers "did someone already talk to them?" first, and the commas slowed the ESL readers.
- **A break reads "On a break until {last day away}"**, not the sheet's "Back on {day}", which clashed with the card's "back on Monday".
- **Order:** newest first. No count per officer, now or later (D75).
- **Two reads.** The counts read uid, action and time only; the note and the officer are read for Follow-up's card alone (adversarial SHOULD, D104's "the list reads only uid and time").
- **Approval:** the standing approval (both reviews approve with changes, no one-way door).

## Deviations

- The plan first said "Done this week" and "{n} to look at in Follow-up". The plan review changed both before the build; the plan and D104 say "Noted".
- Home's margin column was moved to its own file. Not asked for, but the page was at its lint limits (`max-lines`, `max-lines-per-function`) and the new prop pushed it over.
- The plan's cost line originally said "measured". Measured: one extra indexed query per Home or Members load (`member_follow_ups_workspace_written_idx`). Not measured: transaction counts against D146's numbers (Home 48, Members 35).

## Verified

- **`pnpm check`: green.** 320 test files passed and 2 skipped; 1,686 tests passed and 4 skipped; drift fine; i18n 17 languages current. The first run failed on `lib/brand/tokens.test.ts`: "#585" in an `app/` comment matches the colour-literal guard. The comments now say "issue 585".
- **E2E:**
  - `e2e/desk-flows.spec.ts` + `e2e/desk.spec.ts` on a production build: 16 passed, 2 skipped (by design), phone and wide.
  - The Home assertion: the seed gives everyone quest points and coins at the cap, so A's list holds the joiner alone, "Follow-up: 1 to look at", with the noted part optional because the card flow's kept Talked races it.
  - The old weekday branch expected "Everyone looks fine this week.", which this rule no longer shows while someone is to look at. Changed with the behaviour.
- **Tests and the breaks that made them fail.** Each break was applied by a scratch script, its test run, and the file put back:

| Test                                                                                  | Break                                                                 | Result |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| follow-up-week "lists each member noted since Monday 00:00 ST once, newest first…"    | the oldest live record per member instead of the newest               | fails  |
| same                                                                                  | the week starts one hour before Monday 00:00 ST                       | fails  |
| follow-up-week "leaves a member who left the alliance out…"                           | a record of a non-member mapped to a member                           | fails  |
| follow-up-week "gives Home and Members Follow-up's own numbers from Monday 00:00 ST…" | counts from the members view's week (the newest read's) instead       | fails  |
| follow-up-week "reads nothing and gives no numbers while … tab off (D126)"            | the tab check removed                                                 | fails  |
| follow-up-rules "says Follow-up's two numbers in one line…"                           | the "noted" part always shown                                         | fails  |
| follow-up-rules "writes a noted row with the officer and the day first…"              | the break line falls back to the plain answer                         | fails  |
| HomeMembers "gives Follow-up's numbers … and Members' own count while it is off"      | the tab-off branch ignored                                            | fails  |
| e2e Follow-up flow                                                                    | the Noted row drops the officer's name                                | fails (phone and wide) |

  - A first break of `doneThisWeek`'s own member filter did **not** fail: `weekLists` filtered non-members a second time. The redundant filter was removed, so one rule holds it, and the test then failed when that rule was broken.
- **The Verifier** (an independent sub-agent, at cb4928d5): FAIL on proofs, no code bug. It found five gaps:
  - C11's i18n script never reads the desk dictionary;
  - the e2e card link matched any uid;
  - C9's Home line accepts two forms;
  - AC 8 had no check;
  - the row's rank and note had no test.

  Closed in c9a1b963:
  - C11 now runs `dictionary.test.ts`;
  - the e2e asserts the tapped member's uid, today's date and the rank;
  - a new C12 render test holds AC 8; it fails with the early branch removed;
  - the note line is shown in the walk.

  **Accepted, not fixed:** C9's optional "· 1 noted this week". The other project's card flow keeps a Talked on a Lantern Keep member in parallel, so 0 or 1 is right at Home's moment; C3 and C5 hold the exact numbers.

  Its own examples all passed: a record at exactly Mon 00:00:00 ST; Undo of the newer of two records; an empty week; FR singular and plural; PT 1,200.
- **The tlc-spec-lean gate:** `validate_plan` 0 errors, 1 warning (an existing-module mark in the drawing); `validate_checks --execute` 0 errors, 1 warning (C11's i18n command has no test selector; it is the repo's one i18n check).
- **First-glance test, 360 × 780.** Question: "Who do I need to check in with this week, and who has someone already talked to?" Panel: R5 40s EN, war lead 30s, diplomat early 20s FR, Discord-upkeep officer 50s US, officer early 20s UA, architect 30s CH.

| Screen                          | Before                                     | After, round 1                      | After, round 2 (words fixed) |
| ------------------------------- | ------------------------------------------ | ----------------------------------- | ---------------------------- |
| Follow-up, first screen         | 0 right, 3 wrong, 3 can't tell / half      | 4 right, 1 wrong ("8 left"), 1 can't tell | 6 right, 0 wrong       |
| Noted card (after the jump)     | did not exist                              | 6 right                             | 6 right                      |
| Home, first screen              | 0 right, 1 wrong, 5 can't tell             | 0 right, 1 wrong, 5 can't tell      | not changed in S1 (S4)       |

- **Shots** (invented 585 seed, server clock Sat 21 Nov 16:30 ST) are in the orchestrator's scratchpad, `585-worklist/before/`, `after/` and `after2/`: 360 light and dark and 1280, EN. Follow-up at 360 went from 2,814 to 3,259 px, the new card's height. The first group starts at about y 530 (was 545).

## Open issues

- **Home's first screen** still does not answer the question (5 of 6 "can't tell", 1 wrong).
  - The war lead read Home's red badge (to review) and Follow-up's lack of one as "no check-ins".
  - S4 puts Follow-up's two numbers in Home's main column. A count on the Follow-up tab is a further option for the owner.
- **Members' list group "To check in with or help"** still uses Members' status rule (`needsAWord`), so on one page the head says "Follow-up: 12 to look at" while the group lists 3. That is S3 criterion 18.
  - The panel saw a member in that group whom Follow-up lists as noted: a seed artifact. The 585 seed writes break records without the away fact the app writes.
  - A member marked Needs help with no reason left is on no Follow-up list: S2.
- **Round 2 SHOULDs, not built:**
  - "4 others" can be read as "other officers"; "4 more already noted" was proposed.
  - The card's "back on Monday" next to a break's "until Wed, Nov 25" still leaves one reader unsure when a member returns.
  - "Nothing is sent" appears twice in the head.
  - The jump links' text is about 20 px tall; their hit area is 44 px (`min-h-11`).
- **Pre-existing, reported by the adversarial review:**
  - `matchOnRead` runs on Home and Members but not on Follow-up, so on a direct visit right after a roster read a just-matched new member can differ for one page load.
  - In `early`, Follow-up can list New members while Home stays silent (kept as today).
- **PostHog:** no access in this build. Queries to run, read-only (also in the plan's Validation (b)):
  - `$pageview` on `/w/%/follow-up`, Home and Members, weekly, by width;
  - sessions going from Home or Members to Follow-up within 10 minutes, before and after;
  - `$autocapture` clicks on the new line and on `#follow-up-noted`;
  - Follow-up scroll depth at < 640 px;
  - the coordination baseline from the database (members with 2+ distinct officers' records in one game week).
- **Guide:** no workspace onboarding or settings flow changed; no new-guide screenshots needed.

## Next

- Model/effort: keep. Slice 1 with two review rounds and a mutation pass fit one session.
- What the owner must do first: nothing for S2–S4. S5 (After KvK, offer help) and S2 change who is on the list, so each gets its own plan review; neither is a one-way door.
- Plan change: none to `docs/IMPLEMENTATION_PLAN.md`; the slices are in `.specs/features/585-one-worklist/plan.md`.

<adjustments>
- S2 (next): a "Needs help · n" group on Follow-up (members an officer marked Needs help, with who, when and the note, while the mark stands; Home's and Members' numbers count it through `weekLists`); the card's "Needs help" tag says why, who and when; check the card's History tab (F14 says it is empty); a returning member shows last week's note as context. It changes the list's rule: amend D104/D80.
- S3: Follow-up rows (F29): one visible action, the name and reasons styled as the link to the panel, "Card ›" to `?m=`, a group's repeated line said once, the `wide` frame, the head's two help sentences as one in-place help; rename or repoint Members' "To check in with or help" group (two numbers on one page today).
- S4: Home's first screen: Follow-up's two numbers in the main column near the top (the only fix for Home's first glance); fold "finished the roll call" lines by roll call (15 lines in the 585 seed); the screenshot upload out of "To review"; a finished event in one line (F21).
- S5: "After KvK, offer help · n" from `insights-kvk.ts` `help` (8 names in the 585 seed), Insights linking to it.
- S6: the claim (F15): the player linked to their card, the date asked, "Not them" instead of "Reject" (`MemberLinks.tsx`).
- Reuse: `followUpCounts`/`weekLists` for any new count; `notedSince` for anything that shows notes; `checkInLink` for the line.
- The 585 seed's follow-up rows do not write the away and status facts; a seed for S2 must write them as the app does, or the Members and Follow-up lists disagree for seed reasons.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/640
