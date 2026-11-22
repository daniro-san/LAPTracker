# feat-726-check-by-hand — Raid prep: "To check by hand", each map's day and age, and the tracker stops marking

Part of #726 (Raid Shield trust). Size S for the list as asked. The persona decision (question 5) added a change to a decision (D137 amended) and removed a server event. Local branch `feat/726-check-by-hand-2`: another worktree holds `feat/726-check-by-hand`. Push it as `HEAD:feat/726-check-by-hand`.

## Built

1. **Read timing (step 1): no code change.** Read-only SELECTs on Neon `flat-dew-50243708`, counts and times only:
   - `player_reads.map_updated_at`: 299 readings of the four reads of Nov 20–22.
   - `member_squads.seen_at`: Tue Nov 17 to Sat Nov 21.

   Findings:
   - The map is scanned on a rough 6 h cycle at varying minutes: about 22:31–22:33 ST on 5 of 5 nights, and near 04:35, 10:35 and 16:35 ST. Smaller scans at other minutes cover part of the alliance.
   - Between 22:45 and 00:29 ST, one scan was seen in five nights.
   - Saturday Nov 21's squads read crossed a reset. Its 50 reads at 23:30–23:45 ST and its 49 reads at 00:00–00:15 ST saw the same maps, none newer than 22:43 ST.
   - After the reset, small scans fell between 00:29 and 02:19 ST on 4 of 5 nights. On Nov 21, 10 of 100 members had a newest map from 00:30–01:49 ST.

   Answers:
   - (a) A later night read (23:50 ST or just after 00:00 ST) shows the same maps. Unchanged.
   - (b) A third read at about 02:30 ST costs about 100 calls (Saturday's quota day from about 210 to about 310) for a map after the reset on about 1 member in 10. Not built.

   Recorded as a dated amendment to D137.
2. **"To check by hand: n"** on Raid prep's card (`TrackerBar`, `HandLine` in `RaidPrepHead.tsx`), with "Show the n ›", which puts exactly those members in the grid.
   - **Who is on the list** (`handReason`, `handCheck` in `lib/private/raid-prep.ts`): members not away who have
     - no shield on a map within 3 h of the reset,
     - no map that near, or
     - no reading.
   - An officer's own Shield mark takes a member off the list, at once on the page.
   - Each listed tile says why: "Check by hand · no shield seen", "· map over 3 h from the reset", "· no reading".
   - Listed members open first among those not set.
   - **Each map's day and age.** The tile's bracket reads "(map Fri 22:33 ST · 1 h 27 min before reset)" (`prep-data.ts`), in EN, PT-BR and FR. The weekday is in the officer's language. The age counts from the map's minute.
   - **"Nobody left to mark"** shows only after an officer has marked either part, or pressed Checked (`PrepView.looked`, plus taps on the open page). Before that the grid says "No officer has marked yet: every Shield mark so far is the tracker’s." (`RollGrid`'s new `emptyTodo`).
3. **Persona decision (step 3): suggest-only, option 2a.**
   - The tick no longer writes ✓/✗ into Raid prep (`lib/shield-tick.ts`). `fillRaidPrep` stays in `lib/raid-prep-fill.ts`, unused, for the day agreement is shown.
   - "Mark ✓ the n seen with a shield" (`toAccept`) and "the rest" ("No problem seen") leave out members on the list.
   - "How this works" lines were rewritten in EN, PT-BR and FR: `roll.prep.hint`, `roll.prep.acceptHelp`, and the new `roll.prep.hand.help`.
   - D137 amendment with the panel's result.
4. **Tests.**
   - `app/(private)/_ui/check-by-hand.test.ts` (PGlite, page rendered):
     - the list holds exactly the members it counts, and Mark ✓ leaves them out;
     - each map's day and age across midnight;
     - the same in French;
     - "Nobody left to mark" is hidden while every mark is the tracker's;
     - it shows once an officer marks.
   - `lib/raid-prep-fill.test.ts`: Friday's tick reads the alliance and writes no roll call and no mark. It replaces two tests that asserted the tick's fill.
   - E2E: `e2e/fixtures/seed-shield.ts` turns the check on for Moss Hollow, with readings for its last raid shaped like Nov 21 (invented names). `e2e/desk-drilldown.spec.ts` gets the flow "To check by hand shows exactly its members, each map with its day and age". Its values are computed from the seed.
5. **Analytics** (`docs/analytics/tracking-plan.md`):
   - `ws_drilldown_opened` on `raid_prep` gains `kind` `hand`.
   - The server's `ws_roll_call_marked` (`how` `tracker`, `marks`) is removed with the tick's fill: code, `ServerEvents`, its plan row, and a dated line under Changed.

## Decisions

- **Panel**: six officer personas described generically (R5 in her 50s from Switzerland; UK, PH, FR, US and UA officers, 20s–50s, two ESL), a data-honesty reviewer and a D75 reviewer. They saw 360 px captures of this build with the e2e seed, in EN and FR.
  - Votes: 2a 5 of 8 (officers 4–2, data-honesty reviewer); the D75 reviewer chose 2b for ✓ with no tracker ✗; nobody chose to keep today's marks.
  - The data-honesty reviewer's condition for revisiting: a raid where the map nearest the reset agrees with officers on at least 9 of 10.
- **List rule.** Read from "no shield seen, a map older than 3 h at the reset, or no reading", refined by the panel: a member stays off the list only if every map within 3 h of the reset (before or after it) saw a shield. A 22:33 "no shield" and a 00:31 "shield" leave 00:00 unknown.
- **"To check by hand"**, not "Check by hand": one ESL persona read "Check by hand: 4" as "4 checked".
- "Show the n ›" reuses the existing drilldown chip and event (`kind` `hand`), so the list's use is measurable without a new event.

## Deviations

- The branch name is `feat/726-check-by-hand-2` locally (see top).
- Beyond the S list, from the panel: the tick's fill is off; Mark ✓ and "the rest" leave out the listed members; listed members open first; the help lines were rewritten. Each is in the D137 amendment.

## Verified

- `pnpm vitest related --run <changed files>`: 209 files, 1131 tests passed.
- `pnpm check`: exit 0. 1947 passed, 4 skipped; drift and i18n clean.
- Each new PGlite test fails when broken. Tried: dropping the minute rounding in the age fails 2 tests; always showing "Nobody left to mark" fails 1. The tick test fails if the fill is called again.
- E2E on my own cluster (port 54426, database `lap_e2e`) and ports (app 3576, bridge 54476):
  - `e2e/desk-drilldown.spec.ts` on phone and wide: 8 passed;
  - the full suite: 80 passed, 8 skipped (per-project skips that were already there).
- 360 px captures in EN and FR were looked at before the panel (not committed).

## Open issues

- Tracker marks written before this change stay, with "from the tracker" and the Checked notice. Production should hold few or none: the tracker's marks shipped after the Nov 21 reads.
- The member card (`lib/private/card-shield.ts`) still says "map from 22:33 ST" with no day.
- Panel findings not built:
  - the card's answer dates the morning check by when it read, not by its maps' span ("seen at the morning check (10:01 ST)" over maps from 00:31 to 09:39);
  - "Checked" still hides the notice for old tracker marks;
  - French "the rest" for one reads "Marquer les 1 autres";
  - "Check" names four things on the page (✓, the checks, the list, Checked).

## Next

- Follow-ups for #726:
  - the member card's map day and age;
  - the answer line's map span and "before/after the reset" (spike option 2's headline);
  - French singular for "the rest";
  - agreement after each raid on Insights (spike option 5), counted from officer taps, before the tracker's fill is turned back on;
  - a shorter "How this works" (spike option 6).
- Fri 2026-11-27: the owner tests. Sat 2026-11-28: the side-by-side test. Officers' own marks are now the only marks written, so after the raid the agreement query compares them with the map nearest the reset.
- Before release: a patch-notes entry in `lib/patch-notes.ts` ("The tracker no longer marks Raid prep; To check by hand lists who to scout"). No new-alliance guide screenshots needed: not an onboarding or settings flow.

What was missing from the task prompt? Whether "a map older than 3 h at the reset" covers maps after the reset (taken as: more than 3 h either side), and that another worktree already held the branch name `feat/726-check-by-hand`.

PR: (added by the orchestrator)
