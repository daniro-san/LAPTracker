# feat/516-card-followup-shield: the Follow-up action and a message to send on the member card

Part of #516. Size M, planned with `/tlc-spec-lean`: `.specs/features/516-card-followup-shield/plan.md` (checks in `checks.md`, proofs in `proofs.md`, the Verifier's report in `verification.md`). Slice 1 is built. Slice 2, the Raid Shield line, is not built: it waits for the owner (see Open issues).

## Built

- **The week line** on the card's Overview, after the reasons (`lib/private/card-follow-up.ts`, `app/(private)/_ui/CardFollowUp.tsx`):
  - "This week: Talked Thu, Nov 19 · Ana", with the note on its own line, for a member with a record still counting since Monday 00:00 ST;
  - "This week: no follow-up note yet." for a member on the week's Follow-up list with nothing noted;
  - no line for a member who is off the list and has nothing noted (D75);
  - inside `ph-no-capture`.
- **"Talked to them"** (44 px chip) records a Talked through Follow-up's route (`from: "card"`, `onList`, a request id per tap).
  - It shows "Saved. Off the Follow-up list until Monday." for a member who was on the list, else "Saved.", with a 44 px Undo.
  - Talked stays off while that line shows.
  - The card is read again (`MemberSheet`'s attempt, a local re-read), so the week line names the record.
  - Undo withdraws that tap's record. A 409 says "Could not undo: the notes changed since." and reads the card again.
- **"Message to send ▾"** (44 px chip, `aria-expanded`) opens Follow-up's message block (`Message`, now taking `message`, `words` and `where`).
  - The message comes from the member's work item, with this week's records not counted, so it does not change after a Talked.
  - The language is the recorded languages first, then the game's from the alliance's own reads, then the officer's.
  - One builder (`inputOf`, `readyTexts` in `ready-message.ts`) now serves both the card and Follow-up's page.
  - The block's words travel in the card JSON (`followUp.words`), because the Members page has no Follow-up words.
- **Analytics.**
  - `ws_action` `follow_up` carries `from` (`follow_up`, `card`) and `on_list` (`DeskPlace`, `lib/analytics/server.ts`; `counted` takes it). The route defaults to `follow_up` and `true`.
  - New browser event `ws_message_copied` (`where` `card` | `follow_up`, `to` `game` | `discord`), sent from both places' copies.
  - The tracking plan is updated: the desk action row, the event row, a "Hellos" insight and a dated "Changed" line.
- **Words** in `dictionary.card.ts` (EN, PT-BR, FR): seven `card.followup.*` keys.
- **Decisions**: D136 gets a dated amendment (the block), D140 one line ("Copy a hello" built as "Message to send"). D137 is not touched.

## Decisions

- **Week:** the game week from Monday 00:00 ST, `weekStart`, the same as Follow-up's list.
- **Who gets a week line:** a member with a record this week, or a member on the list. Coordinator, 2026-11-22: "the week line only for members on the week's list, with no line for others (D75)". A member talked to this week has left the list, but their line still answers the question.
- **Message after Talked:** the work item's message is kept (the coordinator delegated the choice). It is built with this week's records not counted, so copying after tapping Talked gives the same text.
- **Words** (from the persona panel's MUSTs, applied by the coordinator): "Message to send ▾" (it was "Copy a hello", but that button did not copy); "This week: …" with no stacked colons; the saved lines.
- **Talked on the card for any current member**, whether on the list or not. The route already took any current member.
- **The shield line is split out** as slice 2 (coordinator, 2026-11-22), after the adversarial review found a one-way door.

## Deviations

- The issue's "Copy a hello" became "Message to send ▾". "map seen HH:MM" is not built (slice 2).
- The plan first said Home's activity does not list follow-ups. It does ("… talked to …"), so the card's Talked shows there like any follow-up. The plan was corrected, and the Home e2e still passes: it checks only the officer's name.
- First-glance screenshots used a scratch Node preload that moved the `next start` server's clock to Saturday 2026-11-21 10:40 ST, plus a scratch Playwright config and spec. None of this is committed. The data is the e2e seed's (invented).

## Verified

- `pnpm check`: green. 313 test files passed, 2 skipped; 1,664 tests passed, 4 skipped; drift fine; i18n 17 languages current.
- `pnpm test:e2e e2e/desk.spec.ts` (phone and wide, local cluster on its own ports): 9 of 9 passed. The card flow now taps Talked, sees "Saved." and Undo, sees the week line, opens "Message to send" (`aria-expanded`, the heading, "Copy for game mail"), and after a reload opens the card again on Overview and still sees the week line.
- The full e2e suite (phone and wide): 42 passed, 1 skipped, 0 failed.
- The tlc-spec-lean gate:
  - `validate_checks.py --execute`: 0 errors.
  - `check_proofs.py`: 23 pass, 0 fail at `2a2192ad`.
  - The Verifier (an independent sub-agent) found no behaviour bug. Its FAIL was for test gaps F1–F6. F1, F2, F3 and F5 were closed in `2a2192ad` (the newest record wins and its Undo gives the earlier one back; the plain hello in the officer's language; the e2e asserts the chips, both copies and the second tap).
  - **`validate_verification.py` stays red on purpose** for F4 and F6, which were accepted, not fixed:
    - F4, the exact "Saved." against "Saved. Off the Follow-up list until Monday." in the e2e: both projects tap the same seeded member, so which line shows depends on which project saved first.
    - F6, a test that a copy sends `ws_message_copied`: the repo has no browser component harness, and e2e runs send no analytics.
- **Tests and their breaks.** Each test was run with the code broken on purpose and failed, then the code was restored with `git checkout`:

| Test                                                                                                                       | Break                                                                  | Result             |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------ |
| `card-follow-up.test.ts` "says this week's newest note from Monday 00:00 ST, never one from Sunday 23:59 ST"               | `r.at >= start` → `r.at > start`                                       | fails              |
| `card-follow-up.test.ts` "gives a member off the week's list with nothing noted no week line (D75)"                        | "no follow-up note yet" for everyone                                   | fails              |
| `card-follow-up.test.ts` "offers Follow-up's own message in the member's game language, the same after a Talked (D140)"    | the work item counts this week's records                               | fails              |
| `card-follow-up.test.ts` "shows none of it while the alliance turned the Follow-up tab off (D126)"                         | the `follow_up` switch ignored                                         | fails              |
| `follow-up/route.test.ts` "counts a Talked and its Undo from a member card apart from the Follow-up tab (issue 516)"        | `from` always `follow_up`                                              | fails              |
| `follow-up/route.test.ts` "answers 400 for a bad action, …" (new case `from: "list"`)                                      | `from: z.string()`                                                     | fails              |
| `cross-workspace-reads.test.ts` "give Alpha's member card Alpha's own follow-up and message only, never Bravo's (issue 516)" | `gameLanguages` without its alliance filter                            | fails (D140's too) |
| `e2e/desk.spec.ts` card flow                                                                                               | no card re-read after Talked                                           | fails at the week line |
| `card-follow-up.test.ts` week line test, after the Verifier (newest wins)                                                  | `records.find` → `records.findLast`                                    | fails              |
| `card-follow-up.test.ts` off-list test, after the Verifier (plain hello, officer's language)                               | the fallback language `?? at.language` → `?? "fr"`                     | fails              |

- **First-glance test**, 360 × 780, five personas, Q1 "Did this member get a hello this week?":
  - Before (`before-card-360-light-fold.png`): 0 of 5 right; 2 confident wrong answers ("nobody's said hello"); 3 "can't tell".
  - After, on three screens: a typical card light, the same card dark, and a new member with "no follow-up note yet". 14 of 15 right, 0 wrong, 1 "can't tell": the ESL officer on the new member, who did not link "follow-up note" to "Talked".
  - Worst case at 360 × 780 (linked member with "Remove link" and a two-line note): the week line, the note and both buttons end at about 485 px, inside the first viewport.
  - Screenshots are in the scratchpad: `516/shots/`.

## Open issues

- **Slice 2, the Raid Shield line, waits for the owner.** The plan's S2 lists the one-way door (D137's Privacy rule says the reading is "read only by `lib/private/raid-prep.ts` … and by the tick"), the contradiction with D136's owner rule ("squads and shields always show when the tracker saw them, on the server's clock and the viewer's", against the panel's "only until KvK, server time"), and the decisions it needs: the officers' mark leads, away members get no line, `ph-no-capture`, and the issue 471 suite.
- Follow-ups from the after panel (SHOULDs, not built):
  - One word for the record: "no follow-up note yet" against the button "Talked" cost a "can't tell". "no talk recorded yet" would match.
  - "Talked to them" looks the same when a talk is already recorded, so it can be tapped twice (a second record; harmless, append-only). Consider a recorded state.
  - Two personas read "Message to send" as "the app sends it". "Message to copy" would say that nothing leaves the app.
  - A new member's days before joining show the No-data circle and read as missed days. The No-data circle beside "Main squad" was read as a shield marker in the before test (coordinator: a follow-up).
  - Grey secondary text (ink/70–75) is low-contrast for older eyes.
- Found by the adversarial review, existing: Raid prep's tiles (`RaidPrepRow.tsx`) have no `ph-no-capture` on the shield lines; Follow-up's list says "Read the list again" on a refused Undo (right there, but its 409 wording could match the card's).
- The Verifier's F4 and F6 (above) as test follow-ups: a per-project member for the saved-line e2e, and a browser harness for `ws_message_copied`.
- Product persona's idea: a nudge after a copy ("Sent it? Tap Talked to them."), once `ws_message_copied` → Talked is measured.
- PostHog: no access in this build. After release, query (read-only):
  - `ws_action` `follow_up` / `record` weekly by `coalesce(properties.from, 'follow_up')` and `on_list`, 4 weeks before and after;
  - the undo rate per `from`;
  - `$pageview` unique users with `section = 'follow-up'` before and after;
  - `ws_message_copied` by `where` and `to`;
  - the funnel `ws_message_copied` → `ws_action` `follow_up` / `record` within 1 hour.
- The new-alliance guide: no workspace onboarding or settings flow changed, so no new screenshots are needed.

## Next

- Model and effort: keep. One M feature with two reviews and a split held to plan.
- The owner first: answer slice 2's question (see the summary in the PR body). The coordinator files the decision issue.
- Plan change: none to `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- The card's Follow-up block exists: `cardFollowUp` (lib/private/card-follow-up.ts) and `CardFollowUp.tsx`. A later History tab or shield line goes beside it, not in the sheet's bar (it holds two buttons).
- `Message` (FollowUpPanelParts.tsx) takes `message`, `words` and `where`; its words are `MESSAGE_KEYS` in card-follow-up.ts.
- `counted(…, place?)` takes optional `{from, on_list}`: only `follow_up` uses it.
- To screenshot a raid-time state locally, the e2e build can be started with a Node preload that moves `Date` (scratch only). A `class extends Date` preload failed under `next start` with "Date.parse is not a function"; a function wrapper that copies `now`, `parse` and `UTC` works.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/633
