# One worklist (#585 batch 3) checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run lib/private/follow-up-week.test.ts lib/private/follow-up-help.test.ts lib/private/follow-up-rules.test.ts "app/(private)/_ui/follow-up-groups.test.ts" "app/(private)/_ui/CheckInLine.test.ts" "app/(private)/_ui/FollowUpWeek.test.ts" "app/(private)/_ui/MembersList.test.ts" lib/private/dictionary.test.ts lib/private/desk-activity-pages.test.ts "app/(private)/_ui/HomeMembers.test.ts" "app/(private)/_ui/HomeNext.test.ts" "app/(private)/_ui/ToReview.test.ts" --reporter=verbose`
Plan: `.specs/features/585-one-worklist/plan.md`

profile: light

42 checks in 4 slices built (S1 in PR 640: C1-C14; S2 in PR 646: C15-C24; S3 in PR 651: C25-C34; S4 in `feat/585-home-first-screen`: C35-C42; S6 in PR 643 was checked in its own handoff; S5 is a later PR and gets its own checks) · 0 one-way doors · 0 open, of which 0 block

## Checks

### S1 - Follow-up says who is left and who was noted; Home and Members say the same

**C1** - Each current member noted since Monday 00:00 ST is listed once, newest record first, with its officer, note and last day away; a record from Sunday 23:59 ST the week before and an undone record are not (AC 3)
Proof: run unit | ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > lists each member noted since Monday 00:00 ST once, newest first; last Sunday's and an undone note are not

**C2** - A member who left the alliance is in neither the Noted list nor either number (AC 5)
Proof: run unit | ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > leaves a member who left the alliance out of the noted and out of both numbers

**C3** - Home's and Members' numbers equal Follow-up's for the same data and time, from Monday 00:00 ST of today even before Monday's daily update, when the members view's week is still last week (AC 6)
Proof: run unit | ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update

**C4** - While the Follow-up tab is off, no follow-up record is read and there are no numbers (AC 7)
Proof: run unit | ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126)

**C5** - The line reads "Follow-up: 12 to look at · 4 noted this week", "Follow-up: 12 to look at", "Follow-up: nobody to look at · 4 noted this week", nothing at 0 and 0, and French singular "À suivre : 3 sur la liste · 1 noté cette semaine" (AC 6, AC 9)
Proof: run unit | ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > says Follow-up's two numbers in one line for Home and Members, nothing when both are 0

**C6** - A Noted row reads "{officer} · {day}: {answer}", a break "On a break until {last day away}", and "{day}: {answer}" with no officer (AC 4)
Proof: run unit | ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > writes a noted row with the officer and the day first, and a break with its last day away

**C7** - Home and Members link Follow-up's numbers to `/w/[slug]/follow-up` while the tab is on, and show "{n} people to check in with or help" linked to the Members group while it is off (AC 6, AC 7)
Proof: run unit | ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > gives Follow-up's numbers, linked to Follow-up, while its tab is on, and Members' own count while it is off

**C8** - After "Talked to them", the member is under "Noted this week" with "Officer MSH · {today}: Talked to them", the rank, and a link to their own card (`?m=<their uid>`), also after a reload, and leaves it after Undo; the group is "Worth a hello · n" (AC 2, AC 3, AC 4, AC 10)
Proof: `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`

**C9** - Home's "Members this week" shows "Follow-up: 1 to look at" (the seed's joiner) as a link to `/w/lnk/follow-up`, and never "Everyone looks fine this week." while someone is to look at (AC 6, AC 10)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`

**C10** - At 360 × 780 the Follow-up head shows the week, "12 to look at · everyone else is fine" and "4 others already noted this week ↓" inside the first viewport, the Noted card lists the seed's 4 noted members with officer and day, and Home and Members show "Follow-up: 12 to look at · 4 noted this week" (AC 1, AC 3, AC 6)
Proof: walk - `585-worklist/after2/followup--360-light-en-fold.png`, `after2/noted-360-light.png`, `after2/noted-360-dark.png`, `after2/home--360-light-en.png`, `after2/members--360-light-en.png` (dark and 1280 beside them); the note under a row shows in `noted-360-light.png`

**C11** - Every new key exists in EN, PT-BR and FR (AC 9)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C12** - Before the alliance's first daily update, Home says nothing about check-ins and has no Follow-up line, even with Follow-up's numbers given (AC 8; appended after the Verifier)
Proof: run unit | ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > says nothing about check-ins on Home before the alliance's first daily update

**C13** - Before the alliance's first daily update, Follow-up still shows the Noted card with the Monday rule, so the head's "others already noted ↓" jump always has its card (AC 3; review of PR 640)
Proof: run unit | ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > keeps the Noted card and the Monday rule before the first daily update, so the jump has its card

**C14** - Before the alliance's first daily update, Home's and Members' counts read nothing and give no numbers (AC 8; review of PR 640)
Proof: run unit | ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers before the alliance's first daily update

### S2 - "Needs help" on the list, with since when, who and why (built in `feat/585-needs-help`)

**C15** - A member marked Needs help last week with no reason is under "Needs help" this week; a Talked this week moves them to "Noted this week" and they are back on Monday; an away note Mon 23 - Wed 25 Nov leaves them out on Tue 24 and they are back on Thu 26; once the mark is cleared they are on no list (AC 11, AC 13's effect)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > keeps a member marked Needs help on the list each week until the mark is cleared, paused by a break

**C16** - The mark says the officer, day and note of "They need help"; set in Edit info, its writer and day with no note; Ana marks, Bo marks again and undoes, still Ana with her day and note; the member card says "Since Fri, Nov 13 · added by Ana" and "“Lost the main squad, asked for help rebuilding”" under "Needs help" (AC 12, AC 25)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > says since when and who added the mark and why, from the mark that stands, on the row and the card

**C17** - Last week's newest record still counting is the row's context (Thu 12 Nov "on holiday", not Thu 5 Nov "Busy"); a record two weeks back, a Talked on Sun 23:50 ST undone Mon 00:05 ST, and the record that wrote the row's own mark give no context (AC 27)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last week's newest record as context, never one from two weeks back, one undone across Monday or the mark's own

**C18** - A Talked last week neither takes a member off this week's list nor counts as noted; Home's and Members' numbers equal Follow-up's with the Needs help member counted (3 and 0), then 2 and 1 after an "All fine" this week (AC 24, AC 28)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this week's list and Home's numbers from this week's records only, the Needs help group counted

**C19** - The mark reads "Since {day} · added by {officer}" ("Since {day}" with no officer), last week's line "Last week: {officer} · {day}: {what}" ("Last week: {day}: {what}" with no officer), each note in quotes; in French « » with no-break spaces and one before each colon (AC 12, AC 27, AC 29)
Proof: run unit | ✓ lib/private/follow-up-rules.test.ts > Follow-up's Needs help in words (#585 slice 2) > says since when and who added the mark, last week's record as context, each officer's note in quotes

**C20** - Every new key exists in EN, PT-BR and FR (AC 29)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C21** - On the seed, Home says "Follow-up: {new members + 1} to look at", its link opens Follow-up, which shows "Needs help · 1" with "They stay here each week until someone taps “No longer needs help”.", and the marked member's row with "Since {day} · added by Officer LNK", the note in quotes, "Last week: Officer LNK · {day}: Talked to them" and its note; no "Worth a hello" group (AC 24, AC 31, AC 13's line)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`

**C22** - At 360 × 780, "Needs help · 1" is the first group inside the first viewport with the row's mark, note and last week's line; the panel shows "No longer needs help" under "Why they’re on the list"; a tap says "Saved. Galen Thorne no longer needs help.", the group leaves, and stays gone after a reload; the card's header says since when, who and the note, light and dark (AC 11, AC 25, AC 13)
Proof: walk - `s2-shots/followup-360-fold.png`, `followup-360-full.png`, `followup-360-dark-full.png`, `panel-360.png`, `cleared-360.png`, `card-360-light.png`, `card-360-dark.png`, `followup-1280-after-clear.png` (invented e2e seed, Sun 22 Nov)

**C23** - A member marked Needs help who also has a reason is in the first group, "Needs help · 1", with "They stay here each week until someone taps “No longer needs help”." under its title and one row holding the mark, the note in quotes and the reason line; they are not under "Worth a hello", which holds the unmarked member alone (AC 11; Verifier findings 1 and 3)
Proof: run unit | ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > puts a member marked Needs help first, with the mark and their reasons on one row, and not under Worth a hello

**C24** - In a workspace of its own (phone, per repeat), "No longer needs help" on a seeded Needs help member is first refused after another officer saved the status ("Could not save. Try again.", the member still under "Needs help"), then a second tap with the version read again says "Saved. {name} no longer needs help.", the panel closes, the "Needs help" group is gone, and stays gone after a reload (AC 13, AC 31; review of PR 646)
Proof: `pnpm test:e2e e2e/desk-flows.spec.ts -g "No longer needs help"`

### S3 - Follow-up's rows: one action, the name as the way in, the card one tap away (built in `feat/585-follow-up-rows`)

**C25** - In a group of two or more, a plain line every row holds is said once under the title after "Same for all {n}:" and left off the rows (two Needs help rows share their quiet reason, three Worth a hello rows show only their name); the mark line stays on each Needs help row; New rows with different facts to ask keep their own; a group of one keeps its line; the panel's lines stay whole (AC 15)
Proof: run unit | ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > says a line every row of a group holds once under its title, never a mark, and keeps each row's own

**C26** - The Needs help group says "They stay here each week until someone taps their name, then “No longer needs help”." (AC 14)
Proof: run unit | ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > puts a member marked Needs help first, with the mark and their reasons on one row, and not under Worth a hello

**C27** - "How this list works" holds D140's line and D104's help line word for word, open when its cookie is absent and closed when it is there, its summary saying "Tap a name to write down what they said." before the label (AC 17)
Proof: run unit | ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > holds the owner's two lines word for word in How this list works, open on the first visit only, the tap cue always in sight

**C28** - Members' first group is titled "Check in or Needs help" with no count; "This week’s list: Follow-up ›" links to Follow-up while the head shows Follow-up's numbers, and neither the line nor any Follow-up link shows otherwise (AC 18)
Proof: run unit | ✓ app/(private)/_ui/MembersList.test.ts > the Members list's first group (issue 585 S3) > says its status words with no count, and points at Follow-up only while that tab is on

**C29** - On Moss Hollow (phone and wide), the quiet member's row has two buttons (the name and "Talked to them"), no "Add a note", and "Card ›" named "{name}’s card" linking to `/w/msh/members?m=<their uid>`, whose tap opens that member's card; the quiet reason shows on the group; "How this list works" is open on the first visit and closed after a reload, its summary still saying "Tap a name to write down what they said."; the Talked, Noted and Undo flow of C8 still holds (AC 14, AC 15, AC 17, AC 34)
Proof: `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`

**C30** - Home's link opens Follow-up, whose "Needs help · 1" says the new line (AC 14, AC 34)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`

**C31** - Members (Lantern Keep) shows the "Check in or Needs help" region with "This week’s list: Follow-up ›" linking to `/w/lnk/follow-up` (AC 18, AC 34)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Members: a card opens"`

**C32** - Every new key exists in EN, PT-BR and FR, and the dropped keys are gone from all three (AC 32)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C33** - At 360 × 780 (e2e seed, Sun 22 Nov), Lantern Keep's first screen holds the head, "How this list works" (closed), Galen's row with one button and "Card ›", and the "New · 1" title above the tabs; on a first visit the help is open; Moss Hollow says "Same for all 6:" once and each row is a name and one button; at 1280 the page uses the wide frame with the panel's column beside the list; dark matches; Members shows the renamed group and its link (AC 14, AC 15, AC 16, AC 17, AC 18)
Proof: walk - `s3-shots/after2/followup-a-phone-light-fold.png` (the tap cue, Nyla's name above the tabs), `followup-b-phone-dark-full.png`; `s3-shots/after/followup-a-phone-first-light-fold.png`, `followup-b-phone-light-full.png`, `followup-a-wide-light-fold.png`, `followup-a-phone-dark-full.png`, `members-b-phone-light-full.png` (before: `s3-shots/before/`)

**C34** - D104, D140, D98 and D73 each carry an amendment dated 2026-11-22 for issue 585 slice 3 (AC 33)
Proof: `grep -c "2026-11-22 (issue 585 batch 3, slice 3\|2026-11-22, issue 585 S3" docs/decisions/D104-follow-up-weekly-worklist.md docs/decisions/D140-follow-up-panel-ready-messages-and-the-coins-tip.md docs/decisions/D98-members-list-filters-orders-and-the-clock-switch.md docs/decisions/D73-workspace-sign-in-implementation-choices.md`

## Coverage

| Set (size)                        | Member -> proof                                                                              | Unproven |
| --------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| AC 3 examples (4)                 | Mon 00:05 C1 · Sun 23:59 week before C1 · Talked then Undo C1 · two records → newest C1      | -        |
| Line shapes, AC 6 (4)             | 12/4 C5 · 12/0 C5 · 0/4 C5 · 0/0 C5                                                          | -        |
| Record answers in a Noted row (4) | talked C6, C8 · break C6 · help C6 · fine C6                                                 | -        |
| Readers of the counts (3)         | Follow-up C1, C8 · Home C9 · Members C7 (shared `checkInLink`, same `followUpCounts`)        | -        |
| Tab switch states (2)             | on C3, C7 · off C4, C7                                                                       | -        |
| S2: the group's states (4)        | marked, no reason C15 · noted this week C15, C18 · paused by a break C15 · cleared C15, C24  | -        |
| S2: where the mark comes from (3) | "They need help" with a note C16 · Edit info C16 · Undo of a repeated mark C16               | -        |
| S2: last week's context (4)       | newest of last week C17 · two weeks back C17 · undone across Monday C17 · the mark's own C17 | -        |
| S2: readers of the mark (2)       | Follow-up row C16, C21 · card header C16, C22                                                | -        |
| S3: AC 15 examples (4)            | six alike → once C25 · differing facts → own C25 · group of one C25 · same mark → kept C25   | -        |
| S3: help states (3)               | first visit open C27, C29 · after closed C27, C29 · first-use cards cover it: walk only      | covered  |
| S3: Members pointer states (2)    | with Follow-up's numbers C28, C31 · without C28                                              | -        |

### S4 - Home's first screen: Follow-up's numbers near the top, the activity in one screen (built in `feat/585-home-first-screen`)

**C35** - While the Follow-up tab is on, Home's main column has a "Follow-up" card whose one link to `/w/ogs/follow-up` reads "12 members to look at this week · 4 already noted by officers" (1 and 0: "1 member to look at this week"; 0 and 4: "Nobody to look at this week · 4 already noted by officers"; FR 1 and 1: "1 membre à suivre cette semaine · 1 déjà noté par les officiers"), or "Everyone looks fine this week." with no link at 0 and 0; "Members this week" then has no Follow-up link and no "Everyone looks fine"; with the tab off (null) there is no card and the margin keeps its own line: "Everyone looks fine this week.", or "1 person to check in with or help" linked to `/w/ogs/members?order=rank#ml-heading` for a quiet member (AC 19, AC 35)
Proof: run unit | ✓ app/(private)/_ui/HomeMembers.test.ts > Home's Follow-up card (issue 585 slice 4) > says Follow-up's numbers in the main column while the tab is on, and leaves the margin's line to the tab off

**C36** - Five officers finishing one "Cheese Trap" roll call, Wren again an hour earlier, read as one line "Wren, Tomas, and 3 others finished the roll call “Cheese Trap”" that opens to the six lines, newest first; three on "Undead Siege" read "Tomas, Kira, and Rook …"; a line in between, another "Cheese Trap" roll call and the day before each start a line of their own; "Annelie and Lucien …" for two; the same words in a row stay one line, but after a fold of several officers Lucien finishing the first "Cheese Trap" again, after finishing the second, keeps a line of its own; FR "Wren, Tomas et 3 autres ont terminé l’appel « Cheese Trap »", PT "Annelie e Lucien concluíram …"; once Wren's account has no name the line stays as "Tomas, Lucien, and 2 others …" (AC 20)
Proof: run unit | ✓ lib/private/desk-activity-pages.test.ts > recent activity pages > folds a roll call finished by several officers into one line naming each once (issue 585)

**C37** - On Sat 16:30 ST, today's KvK at 12:00 ST that ended at 14:00 ST is one line "12:00 ST · KvK · Ended", still the link to its day; the Undead Siege under way since 16:00 ST keeps two lines with "· Started", and the 19:00 ST meeting keeps its time line and its title line (AC 21)
Proof: run unit | ✓ app/(private)/_ui/HomeNext.test.ts > Home's Today and tomorrow (issue 585 slice 4) > shows an entry that is over on one line, still a link to its day; one under way or to come keeps two

**C38** - A pending "This is me" claim gives "1 waiting in “To review” ↓", a link to `#to-review`; nothing waiting gives nothing (AC 39)
Proof: run unit | ✓ app/(private)/_ui/ToReview.test.ts > a claim an officer can check on Home (issue 585) > says on Home's first screen that the claim waits in To review, and nothing once none waits (slice 4)

**C39** - On the seed, Home's "Follow-up" region holds "{new members + 1} members to look at this week" (with "· 1 already noted by officers" or not, as C9 races) linked to `/w/lnk/follow-up`, above "Today and tomorrow"; "Members this week" has no "to look at" link; "To review" says "Nothing to review." and has no "Send screenshots", which is in the "Screenshots" region; no "waiting in To review" link; the link then opens Follow-up's "Needs help · 1" (AC 19, AC 21, AC 38, AC 39)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`

**C40** - Every new key exists in EN, PT-BR and FR (AC 36)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C41** - D104, D108 and D110 each end with an amendment dated 2026-11-22 for slice S4 (AC 37)
Proof: `grep -q "Amendment 2026-11-22 (issue 585 batch 3, slice S4" docs/decisions/D104-follow-up-weekly-worklist.md && grep -q "Amendment 2026-11-22 (issue 585 batch 3, slice S4" docs/decisions/D108-home-desk-presence-and-recent-activity.md && grep -q "Amendment 2026-11-22 (issue 585 batch 3, slice S4" docs/decisions/D110-screenshots-from-anywhere-and-the-android-share-target.md`

**C42** - At 360 × 780 Home's first screen shows the "Follow-up" card with its link and "Today and tomorrow" under it; the "Screenshots" card follows "To review"; light and dark, and at 1280 the card heads the main column beside "Recent activity" (AC 19, AC 21)
Proof: walk - `585-s4/shots/home-phone-light-fold.png`, `home-phone-dark-full.png`, `home-wide-light-fold.png` (e2e seed, Sun 22 Nov)

## Coverage

| Set (size)                        | Member -> proof                                                                                            | Unproven |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| AC 3 examples (4)                 | Mon 00:05 C1 · Sun 23:59 week before C1 · Talked then Undo C1 · two records → newest C1                    | -        |
| Line shapes, AC 6 (4)             | 12/4 C5 · 12/0 C5 · 0/4 C5 · 0/0 C5                                                                        | -        |
| Record answers in a Noted row (4) | talked C6, C8 · break C6 · help C6 · fine C6                                                               | -        |
| Readers of the counts (3)         | Follow-up C1, C8 · Home C9 · Members C7 (shared `checkInLink`, same `followUpCounts`)                      | -        |
| Tab switch states (2)             | on C3, C7 · off C4, C7                                                                                     | -        |
| S2: the group's states (4)        | marked, no reason C15 · noted this week C15, C18 · paused by a break C15 · cleared C15, C24                | -        |
| S2: where the mark comes from (3) | "They need help" with a note C16 · Edit info C16 · Undo of a repeated mark C16                             | -        |
| S2: last week's context (4)       | newest of last week C17 · two weeks back C17 · undone across Monday C17 · the mark's own C17               | -        |
| S2: readers of the mark (2)       | Follow-up row C16, C21 · card header C16, C22                                                              |
| S4: the card's states (5)         | 12/4 C35, C39 · 1/0 C35, C39 · 0/4 C35 · 0/0 C35 · tab off C35                                             |
| S4: the fold, AC 20 examples (7)  | five C36 · two C36 · three C36 · line between C36 · other roll call C36 · other day C36 · account gone C36 |
| S4: Today and tomorrow rows (3)   | over C37 · under way C37 · to come C37                                                                     |
| S4: "To review" jump (2)          | waiting C38 · none C38, C39                                                                                | -        |

## Swept

- validation: n/a - no input; the page reads stored records
- failure modes: existing - a failed page read shows the desk's error page as today; nothing new is written
- idempotency: existing - `follow-up.request-once` (D100) on the route, unchanged
- authorization: existing - `requireWorkspace` refuses a member session before any read (`access.ts`), and every read is filtered by `workspace_id` (C1 reads one workspace's rows; the issue 471 suite covers cross-workspace reads)
- concurrency: n/a - read only; two officers' records both show, newest first (C1)
- data lifecycle: C2 (a member who left), C1 (the week boundary, Undo)
- dependency failure: n/a - no outside call
- state transitions: C1 (noted → undone → not noted), C8 (on the list → noted → back after Undo)
- observability: n/a - no log; names and notes are inside `ph-no-capture` (walk C10)

S2 swept:

- validation: existing - "No longer needs help" posts to the facts route, whose body schema (`FACT_CHANGE`) and member check are unchanged
- failure modes: C24 - the panel's refusal (409: "Could not save. Try again.", the list read again with the newer version) and the clear after it; the 409 itself is the facts route's, tested in its route test
- idempotency: existing - a second clear with the same version is refused by D80's version check; nothing else is written
- authorization: existing - the facts route and every read require the workspace session; `helpMarkRows` filters both selects by `workspace_id` (C16 reads one workspace's rows)
- concurrency: existing - another officer's status change meanwhile is refused (409, D80), and the list is read again
- data lifecycle: C15 (mark, noted, break, cleared), C17 (week boundary, Undo across Monday)
- dependency failure: n/a - no outside call
- state transitions: C15 (needs help → noted → needs help → paused → needs help → cleared)
- observability: n/a - no log; marks and notes are inside `ph-no-capture` on the row, the panel and the card (walk C22)

S3 swept:

- validation: n/a - no input; the row and the help only change how stored lines are shown
- failure modes: existing - a failed save of "Talked to them" leaves the row and says nothing, as before; the cookie may be blocked: the help then opens on every visit (stated in `FollowUpHelp.tsx`)
- idempotency: existing - `follow-up.request-once` (D100), unchanged
- authorization: existing - `requireWorkspace` before any read; "Card ›" opens Members, which checks the session itself (`?m=` is D122's address)
- concurrency: n/a - nothing new is written to the database
- data lifecycle: C25 - a group that shrinks to one row after a save shows that row's line again
- dependency failure: n/a - no outside call
- state transitions: C27, C29 (the help: first visit open → cookie → closed); the cookie is not written while the first-use cards cover the page (code, `covered`; the e2e fixture sets `lap_ws_intro`, so no e2e)
- observability: n/a - no log; the shared lines sit inside `ph-no-capture` like the rows' (code, `FollowUpList.tsx` `Group`)

S4 swept:

- validation: n/a - no input; Home reads stored rows
- failure modes: existing - a failed read shows the desk's error page; the activity route's "Show more" failure line is unchanged
- idempotency: n/a - nothing written
- authorization: existing - `requireWorkspace` before any read on Home and `/api/w/[slug]/activity`; `followUpCounts` reads one workspace's rows (C3); the fold only joins rows that query already returned
- concurrency: n/a - read only
- data lifecycle: C36 (an officer's account without a name; the feed's two weeks unchanged)
- dependency failure: n/a - no outside call
- state transitions: C37 (an entry to come, then over, on the browser's minute after hydration)
- observability: n/a - no log; the analytics plan's dated "Changed" line covers the moved link

## Handoff

- **Settled mid-build:** none from the owner; the plan review (panel, product, adversarial) changed "Done" to "Noted", renamed "Check in" to "Worth a hello", moved the counts first and kept the Noted card on the page with nobody noted
- **Dispatched:** officer panel + product persona (before, returned), adversarial (returned); first-glance after panel (rounds 1 and 2, returned); Verifier at cb4928d5 (returned: FAIL on 5 proof gaps, closed in c9a1b963, one accepted); S2 (2026-11-22): officer panel with first-glance test, product strategy, adversarial (plan review, returned: all approve with changes, plan Validation (e) to (g)); S2 Verifier at aa610160 (returned: FAIL on 4 proof gaps, no code bug; 3 closed with C23 and C19, 1 accepted, then closed in the review of PR 646 by C24); S4 (2026-11-22): officer panel first-glance rounds 1 and 2, product strategy, designer, adversarial (plan review, returned: all approve with changes, plan Validation (h) to (k))
- **Boundary:** C1-C11 at the commit named in the handoff; S4: C35-C42 at the commit named in `docs/handoff/feat-585-home-first-screen.md`
- **Abandoned:** "Done this week" (panel and adversarial MUST); one wide `followedUpSince` for every reader (adversarial SHOULD: the counts read uid, action and time only)
- **Walked:** `585-worklist/after/` at 360 light and dark and 1280, EN, server clock Sat 21 Nov 16:30 ST, invented 585 seed
- **S3 dispatched:** officer panel with a first-glance test (before, returned), product strategy, designer, adversarial (plan review, returned: all approve with changes, plan Validation (h) to (k)); officer panel after the build (two rounds, returned: a tap cue added between them)
- **S3 walked:** `s3-shots/before/`, `after/`, `after2/` at 360 light and dark and 1280, EN, invented e2e seed, Sun 22 Nov
- **Walked:** S4: Home at 360 light and dark and 1280 on the e2e seed after the suite (`585-s4/shots/`); the four identical "finished the roll call “Raid prep”" lines in the first dark shot led to keeping the roll call's id out of the repeat rule (C36's last example). Earlier: `585-worklist/after/` at 360 light and dark and 1280, EN, server clock Sat 21 Nov 16:30 ST, invented 585 seed
