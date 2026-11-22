# One worklist (#585 batch 3) checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run lib/private/follow-up-week.test.ts lib/private/follow-up-help.test.ts lib/private/follow-up-rules.test.ts "app/(private)/_ui/follow-up-groups.test.ts" "app/(private)/_ui/CheckInLine.test.ts" "app/(private)/_ui/FollowUpWeek.test.ts" lib/private/dictionary.test.ts --reporter=verbose`
Plan: `.specs/features/585-one-worklist/plan.md`

profile: light

23 checks in 2 slices built (S1 in PR 640: C1-C14; S2 in `feat/585-needs-help`: C15-C23; S3-S6 are later PRs and get their own checks) · 0 one-way doors · 1 open (S2 failure modes: the panel's refusal branch, accepted), of which 0 block

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

**C15** - A member marked Needs help last week with no reason is under "Needs help" this week; a Talked this week moves them to "Noted this week" and they are back on Monday; an away note Mon 23 - Wed 25 Nov leaves them out on Tue 24 and they are back on Thu 26; once the mark is cleared they are on no list (AC 11, AC 30's effect)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > keeps a member marked Needs help on the list each week until the mark is cleared, paused by a break

**C16** - The mark says the officer, day and note of "They need help"; set in Edit info, its writer and day with no note; Ana marks, Bo marks again and undoes, still Ana with her day and note; the member card says "Since Fri, Nov 13 · added by Ana" and "“Lost the main squad, asked for help rebuilding”" under "Needs help" (AC 24, AC 12)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > says since when and who added the mark and why, from the mark that stands, on the row and the card

**C17** - Last week's newest record still counting is the row's context (Thu 12 Nov "on holiday", not Thu 5 Nov "Busy"); a record two weeks back, a Talked on Sun 23:50 ST undone Mon 00:05 ST, and the record that wrote the row's own mark give no context (AC 13)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last week's newest record as context, never one from two weeks back, one undone across Monday or the mark's own

**C18** - A Talked last week neither takes a member off this week's list nor counts as noted; Home's and Members' numbers equal Follow-up's with the Needs help member counted (3 and 0), then 2 and 1 after an "All fine" this week (AC 25, AC 31)
Proof: run unit | ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this week's list and Home's numbers from this week's records only, the Needs help group counted

**C19** - The mark reads "Since {day} · added by {officer}" ("Since {day}" with no officer), last week's line "Last week: {officer} · {day}: {what}" ("Last week: {day}: {what}" with no officer), each note in quotes; in French « » with no-break spaces and one before each colon (AC 24, AC 13, AC 27)
Proof: run unit | ✓ lib/private/follow-up-rules.test.ts > Follow-up's Needs help in words (#585 slice 2) > says since when and who added the mark, last week's record as context, each officer's note in quotes

**C20** - Every new key exists in EN, PT-BR and FR (AC 27)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C21** - On the seed, Home says "Follow-up: {new members + 1} to look at", its link opens Follow-up, which shows "Needs help · 1" with "They stay here each week until someone taps “No longer needs help”.", and the marked member's row with "Since {day} · added by Officer LNK", the note in quotes, "Last week: Officer LNK · {day}: Talked to them" and its note; no "Worth a hello" group (AC 25, AC 29, AC 30's line)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`

**C22** - At 360 × 780, "Needs help · 1" is the first group inside the first viewport with the row's mark, note and last week's line; the panel shows "No longer needs help" under "Why they’re on the list"; a tap says "Saved. Galen Thorne no longer needs help.", the group leaves, and stays gone after a reload; the card's header says since when, who and the note, light and dark (AC 11, AC 12, AC 30)
Proof: walk - `s2-shots/followup-360-fold.png`, `followup-360-full.png`, `followup-360-dark-full.png`, `panel-360.png`, `cleared-360.png`, `card-360-light.png`, `card-360-dark.png`, `followup-1280-after-clear.png` (invented e2e seed, Sun 22 Nov)

**C23** - A member marked Needs help who also has a reason is in the first group, "Needs help · 1", with "They stay here each week until someone taps “No longer needs help”." under its title and one row holding the mark, the note in quotes and the reason line; they are not under "Worth a hello", which holds the unmarked member alone (AC 11; Verifier findings 1 and 3)
Proof: run unit | ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > puts a member marked Needs help first, with the mark and their reasons on one row, and not under Worth a hello

## Coverage

| Set (size)                        | Member -> proof                                                                              | Unproven |
| --------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| AC 3 examples (4)                 | Mon 00:05 C1 · Sun 23:59 week before C1 · Talked then Undo C1 · two records → newest C1      | -        |
| Line shapes, AC 6 (4)             | 12/4 C5 · 12/0 C5 · 0/4 C5 · 0/0 C5                                                          | -        |
| Record answers in a Noted row (4) | talked C6, C8 · break C6 · help C6 · fine C6                                                 | -        |
| Readers of the counts (3)         | Follow-up C1, C8 · Home C9 · Members C7 (shared `checkInLink`, same `followUpCounts`)        | -        |
| Tab switch states (2)             | on C3, C7 · off C4, C7                                                                       | -        |
| S2: the group's states (4)        | marked, no reason C15 · noted this week C15, C18 · paused by a break C15 · cleared C15       | -        |
| S2: where the mark comes from (3) | "They need help" with a note C16 · Edit info C16 · Undo of a repeated mark C16               | -        |
| S2: last week's context (4)       | newest of last week C17 · two weeks back C17 · undone across Monday C17 · the mark's own C17 | -        |
| S2: readers of the mark (2)       | Follow-up row C16, C21 · card header C16, C22                                                | -        |

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
- failure modes: Unresolved - the panel's refusal branch (409 or failure: "Could not save. Try again.", the list read again) has no test; the 409 itself is the facts route's, tested in its route test; the success path is walk C22 (Verifier finding 2, accepted)
- idempotency: existing - a second clear with the same version is refused by D80's version check; nothing else is written
- authorization: existing - the facts route and every read require the workspace session; `helpMarkRows` filters both selects by `workspace_id` (C16 reads one workspace's rows)
- concurrency: existing - another officer's status change meanwhile is refused (409, D80), and the list is read again
- data lifecycle: C15 (mark, noted, break, cleared), C17 (week boundary, Undo across Monday)
- dependency failure: n/a - no outside call
- state transitions: C15 (needs help → noted → needs help → paused → needs help → cleared)
- observability: n/a - no log; marks and notes are inside `ph-no-capture` on the row, the panel and the card (walk C22)

## Handoff

- **Settled mid-build:** none from the owner; the plan review (panel, product, adversarial) changed "Done" to "Noted", renamed "Check in" to "Worth a hello", moved the counts first and kept the Noted card on the page with nobody noted
- **Dispatched:** officer panel + product persona (before, returned), adversarial (returned); first-glance after panel (rounds 1 and 2, returned); Verifier at cb4928d5 (returned: FAIL on 5 proof gaps, closed in c9a1b963, one accepted); S2 (2026-11-22): officer panel with first-glance test, product strategy, adversarial (plan review, returned: all approve with changes, plan Validation (e) to (g)); S2 Verifier at aa610160 (returned: FAIL on 4 proof gaps, no code bug; 3 closed with C23 and C19, 1 accepted)
- **Boundary:** C1-C11 at the commit named in the handoff
- **Abandoned:** "Done this week" (panel and adversarial MUST); one wide `followedUpSince` for every reader (adversarial SHOULD: the counts read uid, action and time only)
- **Walked:** `585-worklist/after/` at 360 light and dark and 1280, EN, server clock Sat 21 Nov 16:30 ST, invented 585 seed
