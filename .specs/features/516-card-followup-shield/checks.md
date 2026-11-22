# Member card: Follow-up action and message to send (#516) checks

Build: `pnpm typecheck`; `pnpm lint`
Run unit: `pnpm vitest run lib/private/card-follow-up.test.ts "app/(private)/_ui/card-follow-up-state.test.ts" lib/private/ready-message.test.ts "app/(private)/api/w/[slug]/follow-up/route.test.ts" "app/(private)/api/w/[slug]/cross-workspace-reads.test.ts" "app/(private)/api/w/[slug]/member-session.test.ts" lib/analytics/events.test.ts --reporter=verbose`
Plan: `.specs/features/516-card-followup-shield/plan.md`

profile: light

13 checks in 1 slice built here (S1; S2 waits for the owner and gets its own checks) · 0 one-way doors in S1 · 1 open, of which 1 blocks S2 only

## Checks

### S1 - Follow-up on the card

**C1** - The week line names this week's newest record from Monday 00:00 ST, with its note on its own line; a record at Sunday 23:59 ST is last week's; a later record wins, and its Undo gives the earlier one back (AC 1; Verifier F1, F2)
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > says this week's newest note from Monday 00:00 ST, never one from Sunday 23:59 ST

**C2** - "This week: no follow-up note yet." only for a member on the week's list; a member off it with nothing noted gets no line (AC 2)
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > gives a member off the week's list with nothing noted no week line, and a plain hello (D75)
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > says this week's newest note from Monday 00:00 ST, never one from Sunday 23:59 ST

**C3** - "Talked to them" records through Follow-up's route, shows "Saved." with Undo, is off while that line shows, and the card read again names the record; it is kept after a reload; the saved line says "Off the Follow-up list until Monday" only for a member who was on it (AC 3; Verifier F4)
Proof: run unit | ✓ app/(private)/_ui/card-follow-up-state.test.ts > the member card's Talked and Undo (issue 516) > says off the Follow-up list until Monday only for a member who was on it
Proof: walk - `e2e/desk.spec.ts` "Members: a card opens from the list …" on phone and wide (9 of 9 desk flows passed, 2026-11-22, local cluster on its own port); broken on purpose (no re-read after Talked) it fails at the week line

**C4** - Undo goes through Follow-up's undo with the tap's request id and `from` `card`; a 409 says "Could not undo: the notes changed since.", reads the card again and frees Talked; an Undo that failed, got no answer or was signed out keeps Undo and keeps Talked off, with "Could not undo. Try again." (AC 4; review of PR 633)
Proof: run unit | ✓ app/(private)/api/w/[slug]/follow-up/route.test.ts > POST /api/w/[slug]/follow-up (issue 340) > counts a Talked and its Undo from a member card apart from the Follow-up tab (issue 516)
Proof: run unit | ✓ app/(private)/_ui/card-follow-up-state.test.ts > the member card's Talked and Undo (issue 516) > keeps Undo and Talked off after an Undo that failed, got no answer or was signed out

**C5** - "Message to send ▾" carries `aria-expanded` and opens Follow-up's block: the heading, the chips, the two copies (AC 5)
Proof: walk - `e2e/desk.spec.ts` card flow asserts `aria-expanded="true"`, "A message you can send", the English chip pressed (no language known: the officer's), "Copy for game mail" and "Copy for Discord", then a second tap: `aria-expanded="false"` and the heading hidden (Verifier F5; 9 of 9 desk flows and 42 of 42 suite flows passed after it); `after-message-open-360.png`

**C6** - The card's message is Follow-up's for the member, in the member's game language, and does not change after a Talked; a member with no language known and nothing to say gets the plain hello in the officer's language (AC 6; Verifier F3)
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > offers Follow-up's own message in the member's game language, the same after a Talked (D140)
Proof: run unit | ✓ lib/private/ready-message.test.ts > the ready message (D140) > takes the recorded language first, then the game's; none when neither is written
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > gives a member off the week's list with nothing noted no week line, and a plain hello (D75)
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > writes the message in the language officers recorded, over the game's (D140)

**C7** - With the Follow-up tab off the card carries no Follow-up block (AC 7)
Proof: run unit | ✓ lib/private/card-follow-up.test.ts > the member card's Follow-up block (issue 516) > shows none of it while the alliance turned the Follow-up tab off (D126)

**C8** - A failed Talked says Follow-up's "Could not save. Try again."; signed out shows the signed-out line (AC 8)
Proof: walk - `card-follow-up-state.ts` `afterTalked`: no answer or another status → `failed` (`followup.failed`), 401 → `signed_out`, which `CardFollowUp.tsx` draws as `RefusalLine` with `SIGNED_OUT`

**C9** - Alpha's card never shows Bravo's record, note or game language for the same player (AC 9)
Proof: run unit | ✓ app/(private)/api/w/[slug]/cross-workspace-reads.test.ts > the desk's pages given Bravo's ids, for Alpha's officer (issue 471) > give Alpha's member card Alpha's own follow-up and message only, never Bravo's (issue 516)
Proof: run unit | ✓ app/(private)/api/w/[slug]/cross-workspace-reads.test.ts > the desk's pages given Bravo's ids, for Alpha's officer (issue 471) > find no draft, roll call, garrison plan or member card of Bravo's

**C10** - `ws_action` `follow_up` carries `from` and `on_list`; another `from` is refused 400; `ws_message_copied` is in the code's list and the plan (AC 10)
Proof: run unit | ✓ app/(private)/api/w/[slug]/follow-up/route.test.ts > POST /api/w/[slug]/follow-up (issue 340) > counts a Talked and its Undo from a member card apart from the Follow-up tab (issue 516)
Proof: run unit | ✓ app/(private)/api/w/[slug]/follow-up/route.test.ts > POST /api/w/[slug]/follow-up (issue 340) > answers 400 for a bad action, a note over 500 characters or an extra key
Proof: run unit | ✓ lib/analytics/events.test.ts > the tracking plan (D115) > lists every browser event, every server event and every desk feature and action

**C11** - The week line is in `ph-no-capture`; every new string exists in EN, PT-BR and FR; the new controls are 44 px (AC 11)
Proof: walk - `CardFollowUp.tsx` wraps the week line and note in `ph-no-capture`; `dictionary.card.ts` holds the eight `card.followup.*` keys in all three (`pnpm typecheck` fails on a missing one, `CardWords`); both buttons are `chip()` (`min-h-11`)

**C12** - Worst case at 360 × 780: the week line and both buttons in the first viewport (AC 12)
Proof: walk - `after-worst-linked-360-fold.png` (linked member, two-line note: buttons end at about 485 px), `after-worst-new-360-fold.png` (new member, a status line)

**C13** - Both routes the card uses refuse no session, a member's session and another workspace's officer with 401 `signed_out` (Surface; D105, D142)
Proof: run unit | ✓ app/(private)/api/w/[slug]/member-session.test.ts > a member's session on the officers' API (D105) > follow-up/route.ts refuses no session, a member's and another workspace's alike
Proof: run unit | ✓ app/(private)/api/w/[slug]/member-session.test.ts > a member's session on the officers' API (D105) > members/[uid]/route.ts refuses no session, a member's and another workspace's alike

## Coverage

| Set (size)                                                        | Member -> proof                                                                  | Unproven |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| week boundary, AC 1 (3 examples)                                  | Sunday 23:59 ST C1 · Monday 00:00 ST C1 · Thursday (e2e: today) C3               | -        |
| week line cases, AC 1-2 (3)                                       | record this week C1 · on the list, none C1 · off the list, none C2               | -        |
| message language, AC 6 (3 examples)                               | game `pt` C6 · recorded over game C6 · none known, so the officer's C6           | -        |
| `POST /api/w/[slug]/follow-up` statuses this change exercises (4) | 200 C10 · 400 C10 · 401 C13 · 409 C4                                             | -        |
| `GET /api/w/[slug]/members/[uid]` statuses (3)                    | 200 C3 · 401 C13 · 404 C9                                                        | -        |
| analytics properties (4)                                          | `from` card C10 · `from` follow_up C10 · `on_list` C10 · `ws_message_copied` C10 | -        |

## Swept

- validation: C10 (strict schemas; `from` only `card`)
- failure modes: C8, C4 (409)
- idempotency: existing - INVARIANT `follow-up.request-once` (a request id per tap, D100)
- authorization: existing - `requireWorkspace` refuses a member's session (`refuse("member")`), route 401; C9 for another workspace
- concurrency: C4 (another officer's record since: undo 409); Talked off while "Saved." shows
- data lifecycle: C3 (kept after a reload)
- dependency failure: C8
- state transitions: C3, C4
- observability: C10; nothing logged (`privately`)

## Handoff

- **Settled mid-build:** coordinator, 2026-11-22: apply the panel's MUSTs and SHOULDs; then split: build S1, write S2 up as waiting for the owner; the week line only for members on the list (or followed up this week); decide the message after Talked (kept: the work item's).
- **Dispatched:** persona panel (before + plan) - returned; adversarial reviewer - returned; first-glance panel after (Q1) at `6e0414f2` - returned (14 right, 0 wrong, 1 can't tell); Verifier at `6e0414f2` (proofs.md 22 pass) - returned FAIL on test gaps only (F1-F6, no behaviour bug); F1, F2, F3, F5 closed in `e7d7945d`, F4 and F6 accepted with reasons in `verification.md`.
- **Boundary:** C1-C12 at the feature commit.
- **Abandoned:** the shield line (S2) after the adversarial review found a one-way door; a server clock shift preload for screenshots (scratch only, not committed).
- **Walked:** Members → open "Fennick Lowe" (invented) → Overview: the week line and note, "Talked to them", "Message to send ▾" opened; the linked member and the new member for the worst case; the desk e2e card flow taps Talked, sees "Saved." and Undo, the week line, reloads and finds it again.
