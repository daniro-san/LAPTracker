# feat/585-needs-help: members marked Needs help stay on Follow-up, with since when, who and why (#585 batch 3, slice 2)

Part of #585 (F14). Size M: a rule change across Follow-up, Home, Members and the member card, with amendments to D104 and D80. Planned with `/tlc-spec-lean` in the same feature folder as S1: `.specs/features/585-one-worklist/plan.md` ("S2 plan" and the "### S2" criteria), checks C15–C23 in `checks.md`, the Verifier's S2 section in `verification.md`.

## Built

- **"Needs help · n", Follow-up's first group.**
  - It holds every current member whose `status` fact is Needs help, not on a break and not noted this week, whatever their reasons (`worklist` gains `help`).
  - Before this slice, such a member came back on Monday only while a reason still held, and then under "Worth a hello" with a bare tag. A member whose activity was normal again was on no list.
  - The row's reasons, facts to ask and coins tip stay as lines. The "Needs help" tag is gone.
- **Each row says since when, who and why.**
  - "Since Fri, Nov 13 · added by Ana", then the officer's note in quotes. Notes are clamped to two lines on the row and shown whole in the panel.
  - The mark is the trailing run of `help` versions of the `status` fact (`helpMark`, pure). The newest live `help` record that wrote a version in that run gives who, when and the note. With no such record, the run's first version gives its writer and time, with no note.
  - Reads: `helpMarkRows` (new, `lib/repo/member-follow-ups.ts`) does two selects filtered by `workspace_id`, for Needs help members only, beside `gameLanguages`.
- **How a mark ends.**
  - "No longer needs help" in the member's panel (under "Why they're on the list") saves `status` as cleared through the existing facts route, with the version the page saw.
  - Then the panel closes, the list is read again and the line says "Saved. {name} no longer needs help."
  - On a refusal it says "Could not save. Try again." and reads the list again.
  - A line under the group title says how a member leaves it. An away note pauses the mark. "All fine" clears nothing.
- **Last week as context.** Any row whose member has a record still counting from last game week shows "Last week: Tomas · Thu, Nov 12: Talked to them" and the quoted note.
  - The line is left out when that record is the one that wrote the row's own mark.
  - `followUpView` reads `notedSince` from last Monday in one query. Only this week's rows reach `weekLists`, so the list, Noted and Home's numbers are unchanged. `lastWeekOf` runs `liveRecords` over the whole window, so an Undo on Monday cancels Sunday's record.
- **Home and Members** count the group through `followUpCounts`, with nothing new read.
- **The member card's header** says the same under "Needs help" (`statusMark`, on every tab, `ph-no-capture`).
- **History (F14), checked.** History lists Follow-up records and earlier fact values. A Needs help mark from "They need help" is listed ("Needs help, …: note · Ana"). A mark set in Edit info is the newest version with no record, so it is not history. Nothing was broken; the header line is the fix.
- **Words:** 8 keys in `lib/private/dictionary.followup-help.ts` (EN, PT-BR, FR), spread into the three desk dictionaries. FR uses « » with no-break spaces, and "indiqué par", never "signalé".
- **Docs:**
  - Dated amendments to D104 (the group, the row, how it ends, last week, reads, Home) and D80 (Needs help on Follow-up, the card, the card during a break).
  - A "Changed" line in the tracking plan.
  - A glossary row "Needs help (mark)".
  - The plan and the checks.
- **Moves for size and tests** (pure moves):
  - `quietDayLine` to `member-card-parts.ts`;
  - the History tab panel to `MemberCardTabs.tsx`;
  - the page's grouping (`groupsOf`, `linesOf`, `rowOf`) to `app/(private)/_ui/follow-up-groups.ts`, so it can be tested.
- **Seed:** Lantern Keep's k=5 (`NEEDS_HELP`) is written as `recordFollowUp` writes it. The `status` fact v1 and its `help` record with `fact_version` 1 share one officer and moment, on the Friday of the week before last. A Talked follows on last week's Friday.
- **Tests:**
  - `lib/private/follow-up-help.test.ts` (new, PGlite, 4 tests);
  - 1 test in `follow-up-rules.test.ts`;
  - `app/(private)/_ui/follow-up-groups.test.ts` (new, 1 test);
  - `e2e/desk.spec.ts`: Home's number counts the member, and its link opens Follow-up with the "Needs help · 1" row, the officer, days, both notes and the hint.

## Decisions

- **A visible way out** ("No longer needs help"), not "All fine" clearing the mark. 6 of 6 officers did not find Edit info › Status: Automatic. Product strategy: "All fine" is a weekly answer (D104). It is placed in the panel, not on the row, because S3 reduces each row to one action.
- **"Since {day} · added by {officer}"**, not "Marked by …". 3 of 6 officers heard "marked" or "signalé" as flagged (D75), and 4 of 6 found a bare "· Tomas" unclear.
- **Notes in quotes, "Last week:" before last week's line.** 4 and 5 of 6 officers. A note, a computed reason and last week's context must read apart.
- **Who, when and why from the trailing run of `help` versions** (adversarial MUST). Without it, an Undo of a repeated mark names the officer who undid it and drops the first officer's note.
- **Only this week's records make the list** (adversarial MUST). Passing the two-week window to `weekLists` would take members off this week's list and break Home = Follow-up.
- **Needs help first, by name.** An officer said so; no ranking inside the group (D75).
- **Staying until cleared is deliberate.** The D104 amendment says it is revisited after S3 with the mark-age measure.
- **Approval:** the standing approval. Product strategy and adversarial both approved with changes; no one-way door (no migration, nothing deleted, nothing new written, no privacy widening).

## Deviations

- **Added beyond the S1 handoff's brief:** "No longer needs help" and the group's hint line (panel MUST, 6 of 6, and product MUST), and a moved module for the page's grouping (Verifier finding 1).
- The task said English copy goes in `lib/copy.ts`. Desk copy lives in the desk dictionary (`lib/private/dictionary.*`, EN, PT-BR and FR, D71), so the new keys are there and no public string changed (`pnpm check`'s i18n check stays current).

## Verified

- **`pnpm vitest related --run` on the changed files:** 65 files, 326 tests passed.
- **`pnpm check`: green** at the fix commit: 327 test files passed and 2 skipped; 1,715 tests passed and 4 skipped; drift fine; i18n 17 languages current. The first build took two fix rounds: Prettier on three docs, then `#585` in `app/` comments, which trips the colour-literal guard (written "issue 585" now). The Verifier fixes took one: an import order.
- **E2E, locally, on a production build** (own Postgres on 127.0.0.1:54391, app on 3491):
  - `e2e/desk.spec.ts` and `e2e/desk-flows.spec.ts`: 16 passed, 2 skipped (by design);
  - the whole suite: 46 passed, 2 skipped.
- **`check_proofs.py`:** 24 pass, 0 fail at `aa610160`. It runs again at the fix commit before the PR.
- **Breaks.** Each was applied, its tests run, and the file put back:

| Break | Fails |
| --- | --- |
| `worklist` without `help` | all 4 tests in `follow-up-help.test.ts` |
| `helpMark` ignoring Undo (no `liveRecords`) | "says since when and who…" |
| `lastWeekOf` running `liveRecords` on last week's rows only | "shows last week's newest record…" |
| the two-week window passed to `weekLists` | all 4 |
| last week's line also for the mark's own record | "shows last week's newest record…" |
| the card's `statusMark` left empty | "says since when and who…" |
| "Worth a hello" built from all items, not the rest | `follow-up-groups.test.ts` |

  A first break, "the oldest help record instead of the newest", did not fail: with the Undo it gave the same answer. It was replaced by the break above, which does fail.
- **The Verifier** (independent sub-agent, at `aa610160`) gave FAIL on proof gaps, with no code bug.
  - Closed: the grouping and group order (C23), and the no-officer "Last week:" line (C19).
  - Accepted, not fixed: the panel's refusal branch has no test. The route's 409 is tested in its route test; a browser test needs a racing second session.
  - Its five own examples all passed: cleared then set again; a break that ended yesterday; an undone last-week record; Sun 23:59:59; Mon 00:00:00.
- **Walk at 360 × 780** (e2e seed, Sun 22 Nov). The screenshots are in the orchestrator's scratchpad, `s2-shots/`: the Follow-up fold, full page light and dark, the panel, after the clear, the card light and dark, and 1280 after the clear.
  - "Needs help · 1" is the first group inside the first viewport, with the mark, both notes and last week's line.
  - The panel shows "No longer needs help". A tap gives "Saved. Galen Thorne no longer needs help.", and the group is gone after a reload.
  - The card's header says since when, who and the note.
- **Plan review: officer panel, first-glance test at 360 × 780.** The panel (R5 40s UK, war lead 30s US, diplomat early 20s FR, Discord-upkeep officer 50s PH, officer early 20s UA, architect 30s CH; AI personas on invented data) saw text wireframes. The question was "Who needs help this week, why, and has an officer already said so?"
  - Before: 0 right, 3 partial, 1 wrong, 2 can't tell.
  - After: 6 of 6 right.
  - The panel's other findings are in the plan's Validation (e).

## Open issues

- **The panel's refusal branch has no test** (Verifier finding 2, accepted).
- **Pre-existing, from the adversarial review:** Undo of a "They need help" saved over another officer's standing mark puts `status` back to empty, clearing the other officer's mark. Seen in the Verifier's notes and in this slice's first test draft. Follow-up issue.
- **The card shows "Needs help" during a break**, while Follow-up leaves the member out (`statusOf` reads the officer's status first). This is stated in the D80 amendment.
- **A former member who rejoins (D107)** or a pending member who is matched (D106) comes back under "Needs help" with the old date. That follows the rule.
- **Before the first daily update**, Follow-up lists Needs help members while Home and Members say nothing (criterion 8 kept).
- **Members' list group "To check in with or help"** (`needsAWord`) still counts Needs help members who were noted this week, so the head and the group can differ on Members. This is S3 criterion 18.
- **Release day:** every past Needs help mark whose reasons cleared appears under "Needs help" at once, and Home's number rises with it. Say so in the release's patch notes (`lib/patch-notes.ts`).
- **PostHog:** no access in this build. Measure from the database, read-only, per workspace and week, no names: members with a standing mark, the median age of the marks, and the share noted each week. Also re-run S1's count of members followed up by two officers in one week.
- **Guide:** no workspace onboarding or settings flow changed; no guide screenshots owed.

## Next

- **S3** (Follow-up rows, F29):
  - one visible action per row, with "No longer needs help" folded into it;
  - the name styled as the link to the panel, and "Card ›" to `?m=`;
  - a group's repeated line said once;
  - the `wide` frame;
  - the head's two help sentences as one in-place help (5 of 6 officers: it would bring a second "Needs help" row above the fold);
  - Members' "To check in with or help" renamed or repointed.
- **S4:** Home's first screen: Follow-up's two numbers in the main column; fold the "finished the roll call" lines; the screenshot upload out of "To review"; a finished event in one line (F21).
- **S5:** "After KvK, offer help · n" from `insights-kvk.ts` `help`, with Insights linking to it.
- **S6:** the claim (F15): the player linked to their card, the date asked, "Not them" instead of "Reject".
- **Follow-ups from this slice:**
  - the Undo bug above;
  - a "still needs help?" prompt after a few weeks, or a group collapse (3 and 2 of 6 officers), decided after the mark-age measure;
  - a ready message for a Needs help member that says nothing about the mark (kept as is; the product persona agrees).
- **Plan change:** none to `docs/IMPLEMENTATION_PLAN.md`; the slices are in `.specs/features/585-one-worklist/plan.md`.

Analytics plan: no new event, no change to an event. "No longer needs help" saves through the facts route, already counted as `ws_action` `member_facts` `save`. A dated "Changed" line says Home's and Members' "Follow-up: n to look at" now counts members marked Needs help, so it steps up on release day. Nothing removed; no PostHog insight or Endpoint reads these.

What was missing from the task prompt? Two things:
- that desk copy lives in the desk dictionary, not `lib/copy.ts`;
- that a visible way to end a mark was in scope. The panel and the product persona both made it a MUST; it was built and is listed under Deviations.

PR: (added by the orchestrator)
