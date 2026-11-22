# One worklist (#585 batch 3) checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run lib/private/follow-up-week.test.ts lib/private/follow-up-rules.test.ts "app/(private)/_ui/HomeMembers.test.ts" lib/private/dictionary.test.ts --reporter=verbose`
Plan: `.specs/features/585-one-worklist/plan.md`

profile: light

12 checks in 1 slice built here (S1; S2-S6 are later PRs and get their own checks) · 0 one-way doors · 0 open, of which 0 block

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
Proof: run unit | ✓ app/(private)/_ui/HomeMembers.test.ts > the check-in line on Home and Members (issue 585) > gives Follow-up's numbers, linked to Follow-up, while its tab is on, and Members' own count while it is off

**C8** - After "Talked to them", the member is under "Noted this week" with "Officer MSH · {today}: Talked to them", the rank, and a link to their own card (`?m=<their uid>`), also after a reload, and leaves it after Undo; the group is "Worth a hello · n" (AC 2, AC 3, AC 4, AC 10)
Proof: `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`

**C9** - Home's "Members this week" shows "Follow-up: 1 to look at" (the seed's joiner) as a link to `/w/lnk/follow-up`, and never "Everyone looks fine this week." while someone is to look at (AC 6, AC 10)
Proof: `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`

**C10** - At 360 × 780 the Follow-up head shows the week, "12 to look at · everyone else is fine" and "4 others already noted this week ↓" inside the first viewport, the Noted card lists the seed's 4 noted members with officer and day, and Home and Members show "Follow-up: 12 to look at · 4 noted this week" (AC 1, AC 3, AC 6)
Proof: walk - `585-worklist/after2/followup--360-light-en-fold.png`, `after2/noted-360-light.png`, `after2/noted-360-dark.png`, `after2/home--360-light-en.png`, `after2/members--360-light-en.png` (dark and 1280 beside them); the note under a row shows in `noted-360-light.png`

**C11** - Every new key exists in EN, PT-BR and FR (AC 9)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, pt-BR and fr, and no empty value

**C12** - Before the alliance's first daily update, Home says nothing about check-ins and has no Follow-up line, even with Follow-up's numbers given (AC 8; appended after the Verifier)
Proof: run unit | ✓ app/(private)/_ui/HomeMembers.test.ts > the check-in line on Home and Members (issue 585) > says nothing about check-ins on Home before the alliance's first daily update

## Coverage

| Set (size)                        | Member -> proof                                                                         | Unproven |
| --------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| AC 3 examples (4)                 | Mon 00:05 C1 · Sun 23:59 week before C1 · Talked then Undo C1 · two records → newest C1 | -        |
| Line shapes, AC 6 (4)             | 12/4 C5 · 12/0 C5 · 0/4 C5 · 0/0 C5                                                     | -        |
| Record answers in a Noted row (4) | talked C6, C8 · break C6 · help C6 · fine C6                                            | -        |
| Readers of the counts (3)         | Follow-up C1, C8 · Home C9 · Members C7 (shared `checkInLink`, same `followUpCounts`)   | -        |
| Tab switch states (2)             | on C3, C7 · off C4, C7                                                                  | -        |

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

## Handoff

- **Settled mid-build:** none from the owner; the plan review (panel, product, adversarial) changed "Done" to "Noted", renamed "Check in" to "Worth a hello", moved the counts first and kept the Noted card on the page with nobody noted
- **Dispatched:** officer panel + product persona (before, returned), adversarial (returned); first-glance after panel (rounds 1 and 2, returned); Verifier at cb4928d5 (sent)
- **Boundary:** C1-C11 at the commit named in the handoff
- **Abandoned:** "Done this week" (panel and adversarial MUST); one wide `followedUpSince` for every reader (adversarial SHOULD: the counts read uid, action and time only)
- **Walked:** `585-worklist/after/` at 360 light and dark and 1280, EN, server clock Sat 21 Nov 16:30 ST, invented 585 seed
