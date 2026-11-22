# feat/585-follow-up-rows: Follow-up's rows have one action, the name opens the panel, "Card ›" (#585 batch 3, slice 3)

Part of #585 (F29, F14's link). Size M: a flow across Follow-up and Members. Planned with `/tlc-spec-lean` in the same feature folder as S1 and S2: `.specs/features/585-one-worklist/plan.md` ("S3 plan", criteria 14–18 and 32–34, Validation (h) to (k)), checks C25–C34 in `checks.md`, proofs in `proofs.md`.

## Built

- **One action per row.**
  - "Talked to them" is the only button on every row, Needs help rows included.
  - "Add a note" is gone. The name, now plum, semibold and underlined, opens the same panel with the four answers.
  - The name, rank and lines stay one button, so the tap target stays large.
- **"Card ›"** ("Cartão ›", "Fiche ›") replaces "Members ›".
  - It is a 44 px link named "{name}’s card" to `/w/[slug]/members?m=<uid>`, the member's card.
  - The old link went to the Members list searched by name (`?q=`), so the name no longer travels in the address.
- **A line every row of a group holds is said once.**
  - `sharedOf` in `follow-up-groups.ts` finds the plain lines (a reason, "Still to ask: …", the coins tip) that every row of a group of two or more holds.
  - The group says them under its title after "Same for all {n}:", inside `ph-no-capture`.
  - Each row shows `own` (its other lines), and its button's description names the shared lines. The panel keeps `lines` whole.
  - A Needs help mark, last week's line and an officer's note are never moved up.
- **"How this list works"** (`FollowUpHelp.tsx`, new).
  - It holds D140's "what to do" line and D104's help line, word for word.
  - Its summary says, always in sight, "Tap a name to write down what they said."
  - It is open on an officer's first visit on that browser and closed after. The server reads the cookie `lap_ws_fu_help`, so nothing moves after the page is drawn.
  - The page writes the cookie once the help was shown open, but not while the first-use cards cover the page. The open state is kept as first drawn, so a save's refresh does not close it.
- **The wide frame** (`SignedInFrame wide`, D122): from 1024 the list and the panel are side by side.
- **Needs help's line** is now "They stay here each week until someone taps their name, then “No longer needs help”."
- **Members' first group** is "Check in or Needs help", the Who column's words, with no count.
  - While the head shows Follow-up's numbers, a line under the group says "This week’s list: Follow-up ›", linked to Follow-up.
- **Words:** in `dictionary.followup.ts`, 5 new keys and 3 dropped (`followup.record`, `followup.inMembers`, `followup.inMembersAria`). The Needs help line changed in `dictionary.followup-help.ts`. `list.heading` changed and 2 keys were added in the three `dictionary.members*.ts`. All in EN, PT-BR and FR.
- **Docs:**
  - Amendments dated 2026-11-22 to D104 (row, card link, shared line, Needs help line, help moved, frame), D140 (the "what to do" line moved), D98 (the group's heading) and D73 (the cookie).
  - A "Changed" line in the tracking plan.
  - The plan's S3 section; S2's criteria renumbered back to 24–31 (see Deviations); a correction in Validation (b).
- **Tests:**
  - `follow-up-groups.test.ts`: one new test, and the Needs help line updated.
  - `FollowUpWeek.test.ts`: one new test.
  - `MembersList.test.ts`: new, one test.
  - `replay-masking.test.ts`: the new prop.
  - `e2e/desk-flows.spec.ts` (the Follow-up flow) and `e2e/desk.spec.ts` (Home's Needs help line, Members' group).

## Decisions

- **Needs help rows keep "Talked to them"; "No longer needs help" stays in the panel.** 4 of 6 officers, product and designer chose this: clearing a mark has no Undo and belongs beside its context. A stray tap on the row would clear it.
- **Only plain lines are said once.** Designer MUST: two Needs help members marked the same day by the same officer would share the mark line, and moving it up would separate it from its note.
- **The help opens on the first visit, decided on the server.** The task's wording, 5 of 6 officers and product chose the first visit. Designer MUST: never open it after the page has drawn. The designer's own pick was always closed; the cookie meets both.
- **The tap cue moved into the summary after the build test.** With one button per row, 5 of 6 officers did not find how to write a note (round 1: 1 right, 4 wrong). With the cue in sight it was 4 right, 2 wrong.
- **"Card ›", not "Profile ›".** 3 of 6 officers preferred "Profile". Product and designer chose "Card": "card" is the app's word, and "profile" reads as something the member sees. PT keeps "Cartão" because the card's own PT words say "cartão" (`card.tabs`). The designer and 2 officers preferred "Ficha".
- **Members' line follows the head's Follow-up numbers**, not the tab switch alone. That is the case where the two numbers met. Before the first daily update the head says nothing about check-ins (criterion 8). It also kept `MembersPage` within the lint function-length limit.
- **Approval:** the standing approval ("go with what you and the personas recommend", owner, 2026-11-21). Product, designer and adversarial approved with changes. There is no one-way door: no migration, nothing deleted, no route or contract change, no privacy widening. The cookie is a preference with no identifier.

## Deviations

- **Only the name is in the link style.** The S1 handoff said "the name and reasons styled as the link". The designer's MUST: underlining five lines would be hard to read. The whole block is still the button.
- **Criterion numbers.** Prettier had renumbered S2's criteria 24–31 back to 14–21, a second time after PR 646's fix, so S2 and S3/S4 shared numbers. A sentence now separates S2's two lists, and S3's extra criteria (32–34) sit in a list of their own. Every number 1–34 now appears once.
- **"Tap a name …"** was planned as a third line inside the help. The build's first-glance test moved it into the always-visible summary, in shorter words.

## Verified

- **Unit, related:** `pnpm vitest related --run` on the 15 changed source files: 66 files, 327 tests passed.
- **`pnpm check`: green** (329 test files passed, 2 skipped; 1,723 tests passed, 4 skipped; drift fine; i18n 17 languages current).
  - Two fix rounds before that: `MembersPage` was over the 80-line limit by one line (solved with the decision above), then Prettier on `e2e/desk-flows.spec.ts`.
- **E2E, local production build** (own Postgres on 127.0.0.1:54393 from `scripts/db-local.mjs`, app on 3493, bridge on 54394, `E2E_DATABASE_URL`/`E2E_APP_PORT`/`E2E_BRIDGE_PORT` set):
  - the whole suite: 47 passed, 3 skipped (by design);
  - after the tap-cue change, `desk-flows.spec.ts` and `desk.spec.ts` again: 17 passed, 3 skipped.
  - Postgres stopped afterwards.
- **Breaks.** Each was applied to the committed tree, its test run, and the file put back:

| Break | Fails |
| --- | --- |
| `sharedOf` returns nothing | `follow-up-groups.test.ts` "says a line every row … holds once …" |
| the help always open | `FollowUpWeek.test.ts` "holds the owner's two lines …" |
| Members' Follow-up line shown with no Follow-up numbers | `MembersList.test.ts` |

- **First-glance test at 360 × 780.** Question: "Who do I need to check in with this week, and what do I do for each?" The six officer personas were AI personas on invented data. The shots are in the session scratchpad, `s3-shots/before/`, `after/` and `after2/`.

| Screen | Right | Partial | Wrong | Can't tell |
| --- | --- | --- | --- | --- |
| Lantern Keep, before | 0 | 4 | 1 | 1 |
| Moss Hollow, before | 4 | 2 | 0 | 0 |
| Lantern Keep, after (round 1) | 3 | 2 | 1 | 0 |
| Moss Hollow, after (round 1) | 6 | 0 | 0 | 0 |
| Both, after (round 2, the tap cue) | 3 | 3 | 0 | 0 |
| "How would you write down what Galen said?" round 1 / round 2 | 1 / 4 | 1 / 0 | 4 / 2 | 0 / 0 |

  - Round 1's wrong answer counted S1's "1 other already noted this week ↓" as one of the "2 to look at" (see Open issues).
  - At 360 × 780, Lantern Keep's first screen now reaches Nyla's name under "New · 1" (before: "New · 1" was below the fold).
- **Walked:** 360 light and dark, 1280 light and dark, the first visit and a return visit, and Members (`s3-shots/after2/`). Not walked: 1024 with the rail, a long-word language, WebKit.

## Open issues

- **2 of 6 officers still did not find how to write a note** (round 2). The war lead taps "Talked to them" expecting a note box; the Ukrainian officer opens "Card ›". The remaining fix the designer named is "Add a note" back on the row, which criterion 14 rules out. Owner's call. Measure first (Next).
- **S1's jump line read as part of the count.** One officer read "1 other already noted this week ↓" as one of "2 to look at" (UA, round 1). This is S1's line; the S1 handoff already lists "{m} more already noted" as an option.
- **S2's "Last week: … Talked to them" right above the "Talked to them" button** reads as "already done" (2 of 6 in the plan review and in both rounds after). A sentence form ("Last week, Tomas talked to them (Fri, Nov 13)") needs its own copy test, and it changes S2's checks C17 and C19.
- **Wording the panel flagged, kept as the owner or D140 wrote it:** "Nothing is sent for you" (3 of 6 read "for you" as "to you"); "Nothing is sent" twice when the help is open; "Talked to them" read as a status (3 of 6).
- **Members, reported by the panel:** the "Missing info 8" chip reads as a second to-do list (3 of 6). "Check in" on Members differs from Follow-up's "Worth a hello" (2 of 6).
- **Not tested end to end:** the help's cookie is not written while the first-use cards cover the page. The e2e fixture sets `lap_ws_intro`, so only the code holds this.
- **The Noted card's plum name opens the card, while the list's plum name opens the panel** (designer COULD): the same look leads to two places.
- **PostHog:** no access here. Click autocapture is off on `/w` and query strings are dropped, so neither link's clicks can be counted. See Next for what to measure.
- **Guide:** no onboarding or settings flow changed. Follow-up's look changed, so the next guide refresh should retake its Follow-up shot.

## Next

- **S4** (in parallel in another session, on Home): Follow-up's two numbers in Home's main column, fold the roll-call lines, the screenshot upload out of "To review", a finished event in one line. Its criteria should take numbers from 35 on. 19–21 are its own, and 32–34 are now S3's.
- **S5:** "After KvK, offer help · n" from `insights-kvk.ts` `help`, with Insights linking to it.
- **Follow-ups from this slice:**
  - measure, read-only, per workspace and week, no names, before and after this release:
    - the share of records that are not "Talked" (in the panel only now);
    - the share of records with a note;
    - `ws_message_copied` `where=follow_up` per record.

    A drop in either share means the name tap is missed. Then decide on "Add a note" or a row cue.
  - S1's jump-line words, and S2's last-week line as a sentence, each with its own copy test;
  - a line after "Talked to them" on a Needs help row saying the mark stays (3 of 6);
  - Members' "Missing info" chip and "Check in" vs "Worth a hello" wording;
  - the mark-age measure D104's S2 amendment ties to "after S3": it can run now.
- **Plan change:** none to `docs/IMPLEMENTATION_PLAN.md`; the slices are in `.specs/features/585-one-worklist/plan.md`.

Analytics plan: no new event, no change to an event. A dated "Changed" line in `docs/analytics/tracking-plan.md` covers three changes: "Add a note" gone, "Members ›" (`?q=`) now "Card ›" (`?m=`), and Members' heading and its Follow-up link. It also says how to read Members page views after Follow-up, and which database shares to watch. Nothing removed; no PostHog insight or Endpoint reads these.

What was missing from the task prompt? Three things:
- Prettier renumbers ordered lists, which is how S2's 24–31 became 14–21 twice.
- "Open on a first visit" needs a cookie, which D73 lists.
- Without "Add a note" an officer may not find the panel: the task fixed one visible action without saying what shows the way in.

PR: https://github.com/daniro-san/LAPTracker/pull/651
