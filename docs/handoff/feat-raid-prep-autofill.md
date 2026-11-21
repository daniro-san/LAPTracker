# feat — Raid prep: no shield length, and the tracker's night and morning checks (D137 amendments of 2026-11-21)

## Built

- **No shield length.** A row with `shielding` 1 no longer says "8 h shield, ends by … at the latest" or "shield on, length unknown", and the tag "May end before KvK" is gone. The line above the rows is "12 not seen yet". `shieldEndsBy`, `mayEndBeforeKvk` and `RECHARGEABLE_MS` are removed from `lib/shield-check.ts`. `shield_type` is still stored.
- **The tracker marks Raid prep at two checkpoints** (`lib/raid-prep-fill.ts`, run by `lib/shield-tick.ts` after the readings and the leaders' message):
  - **Night check** (Friday's reading): ✓ Shield up for every member seen with a shield. The rest stay not set.
  - **Morning check** (Saturday's reading): ✓ for every member still seen with a shield, ✗ "No shield seen" for every member seen with none. Written once per member.
  - Each mark is the next version in `roll_call_marks`, with `by_tracker` true and no `written_by`. Nothing is deleted or cleared.
  - An officer's mark at any point blocks the tracker for that member. Away members and members with no reading get nothing.
  - The week's Raid prep is used. With none, the week's KvK Calendar roll call is made. With neither, one is added on Saturday with the request id `tracker-fill:<Saturday>`. An archived Raid prep is not filled. The roll call is made only when there is a mark to write.
  - Only while `shield_check` (the check's own targets) and the Roll call tab are on. Each workspace's fill runs on its own. A failure leaves as the code `raid_prep_fill_failed`. Nothing goes to Discord.
- **"Accept the tracker's"** runs through the same module (`trackerMarks`): ✓ only, written as the tracker's (`by_tracker`) on the officer's name, counted as checked, and still updated by the morning check. It shows only while n > 0.
- **What officers see** (EN, PT-BR, FR):
  - Each row has one short line per checkpoint that happened, in server time: "Night · 22:33 ST: shield seen", "Morning · 07:15 ST: no shield seen". "No shield seen" lines are in the attention colour.
  - "from the tracker" under each Shield mark the tracker wrote. The tracker's ✗ reads "No shield seen".
  - The notice above the rows: "5 marks came from the tracker's reading at 23:31 ST. They say “from the tracker” below.", with **Checked**. It counts the morning marks too.
  - A tap on a tracker mark makes the tapped mark the officer's own and never clears it. A Squads off the wall tap also checks the row.
  - Rows whose current mark is the tracker's ✗ open at the top. The ready message asks for the shield whenever the current mark is ✗ or not set.
- **"Add a roll call"** for Raid prep opens the week's Raid prep when one exists on another day of that week.
- **Route:** `POST /api/w/[slug]/roll-call` `{ action: "check", occasion, seen }`, counted as `ws_action` `roll_call` / `check`. `seen` is never later than now.
- **409 line:** when the tick's write wins a race, it reads "The tracker marked “Shield up” just now."
- **Analytics:** the server event `ws_roll_call_marked` `{ how: "tracker", marks }`, once per fill that wrote marks, with `workspace` and `alliance`. No name, no uid.
- **Data:** migration `0064_raid_prep_tracker_marks` (`pnpm db:generate`) adds `roll_call_marks.by_tracker` and `roll_calls.tracker_checked_at`.
- **Moved out of `lib/private`, behind re-exports, unchanged:** `lib/calendar-time.ts`, the week layout `lib/calendar-layout.ts` and the away rule `lib/member-away.ts`. The tick cannot import `lib/private` (D71's eslint fence).
- **Docs:** D137 (two amendments, the open item on `shield_type`), the tracking plan, ARCHITECTURE.

## Decisions

- **The tracker's ✗.** The owner approved the morning ✗ "No shield seen" on 2026-11-21 as an exception to "never ✗ from the tracker" (D75). It tells officers whom to remind before KvK. This is recorded in D137.
- **It replaces the persona round's MUST 1.** That fix cleared the tracker's ✓ on Saturday. The owner replaced it the same day with the two checkpoints, and it is removed.
- **The morning check is written once.** A tracker mark written after the member's morning reading counts as the morning check. Each member has one morning reading, because the morning read reads each member once.
- **Accept writes the tracker's marks** (coordinator's decision, 2026-11-21): it only applies the tracker's reading, so the morning check still updates those members. Only an officer's direct tap on ✓ / ✗ (or "the rest", its undo) counts as the officer's mark. Accept's marks carry the officer's id, count as checked, and a 409 names that officer.
- **The notice time is the fill's write time**, not the reading's. They can differ by a few minutes.
- **Checkpoint lines show server time only**, so each fits on one line at 360 px. The officer's own clock (D101) is not repeated there.
- **The tick's roll call** uses a fixed request id per week. This keeps one row against races, and a Raid prep an officer deleted is not added again.

## Deviations

- To keep the shared code path, the pure helpers moved out of `lib/private` (above). Behaviour is unchanged: the adversarial reviewer compared them byte for byte.
- "Add a roll call" for Raid prep is now one per week, not one per day. This fixes the adversarial MUST.

## Verified

- **`pnpm check`** passes after the rebase onto `origin/dev` with #563: prettier, eslint, tsc, vitest (288 files, 1,493 tests passed, 4 skipped), drift, and i18n (17 languages).
- **Tests:**
  - `lib/raid-prep-fill.test.ts` has 7 tests:
    - Friday's tick adds the Raid prep, with ✓ only for those seen;
    - nothing happens with the check off;
    - a Friday ✓ that is not seen on Saturday gets a Saturday ✗ as version 2;
    - an officer's mark blocks both checks;
    - an away member is left out of both;
    - a second run adds nothing;
    - the KvK Calendar roll call is filled instead of a second one.
  - `lib/private/raid-prep.test.ts` gains 1 test and has 2 updated:
    - both checkpoints show on a row;
    - Accept's ✓ is the tracker's, and a later morning reading updates it to ✗ while an officer's tapped ✗ stays;
    - the marks to check, a wall tap and Checked;
    - ✓ on the tracker's ✓;
    - Add on Friday opens the tracker's Saturday Raid prep.
  - `lib/shield-check.test.ts`: the length test is replaced.
  - Issue 471 suite: Alpha's fill touches only Alpha's member and roll call, and Alpha's Checked on Bravo's roll calls is refused.
- **Panel (3 subagents):**
  - **Officer and product persona.** Its result went to the orchestrator, not to me. Applied: the notice text, "Checked" ("Conferido", "Vérifié"), and FR "à vérifier". Its MUST 1 was replaced by the owner's rule.
  - **Adversarial.** Its result came to me. 1 MUST and 6 SHOULDs.
    - Fixed: one Raid prep a week on Add; `seen` clamped to now; the notice coming back on an open page; archived Raid preps skipped; the `roll_call` switch gate; a KvK moved in from another plan week; each workspace's fill isolated, with a code-only error; away rows left out of the notice time; a tap on the tracker's ✗ keeping ✗.
    - It confirmed clean: isolation, races, Checked never moving back, Home leaving tracker marks out, analytics and Discord, and the moved helpers.
  - **QA** (local Postgres 18, production build, 101 invented members) against the first version: 64 of 64 checks passed.
    - Pages at 360 and 1280, light and dark, EN and PT, plus FR at 360: no sideways scroll, targets ≥ 44 px, no length text.
    - Fill: 10–11 statements per workspace per tick, all on indexes (`player_reads` 0.1 ms, `roll_call_marks` 0.1 ms, `member_facts` 1.4 ms on invented volume).
    - Screenshots: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/autofill/qa/shots/`.
  - **QA retest** of the final flow (commit 358cbab3, a fresh DB with all 65 migrations): no MUST, no SHOULD.
    - Friday wrote 84 ✓ (85 seen, minus 1 away), and a second run wrote 0.
    - Saturday wrote 92: 87 ✓ and 5 tracker ✗. A second run wrote 0.
    - 4 officer-marked members were untouched in both checks. Still one roll call.
    - At 360, all 192 checkpoint lines per view fit on one line in EN, PT and FR.
    - ✗ rows read "No shield seen" with "from the tracker", open at the top, and their messages ask for the shield.
    - A tap on a tracker ✗ or ✓ becomes the officer's mark, and the notice drops.
    - Checked stays after a reload. A later fill's mark brings the notice back after a reload.
    - "Add" on Thursday opens the existing Raid prep, and an archived one gets 0 marks.
    - Queries: 11–12 statements per workspace per tick.
    - Screenshots: `…/scratchpad/autofill/qa/shots2/`.
    - Not tested: the notice coming back on an open page without a refresh. The seed's morning read was done, so nothing polled.
- **Privacy:** none of the 2,064 fixture names appears in the 1,077 added lines.

## Open issues

- **Follow-ups (not fixed here):**
  - The French no-break spaces before ":" in the existing Raid prep lines and the « » spacing were already wrong on dev. The new lines use a no-break space.
  - D120 undo of a deleted Raid prep checks the same day only. Undoing a Friday one after the tick added Saturday's can leave two in the week.
  - `lib/shield-read.ts` has the same gap the fill had: a query error's text can reach `app_errors`.
  - An officer's ✓ sent at version 0 just as the tick writes ✓ at version 1 is answered "ok". The mark stays the tracker's.
  - The away check reads every latest fact of the workspace (about 2,400 rows) for two fields.
  - The French bottom bar says "1 absents" (an existing plural bug, QA).
  - The notice comes back on an open page only after a refresh or a return to the tab. Nothing polls while no read is under way.
- **For the owner:**
  - An officer's direct tap on Friday stops the morning check for that member, because the officer's mark wins (as decided).
  - The notice shows the fill's time, not the reading's.

## Next

- **Model and effort:** keep.
- **What the owner must do first:**
  1. Merge.
  2. Check that `shield_check` and the Roll call tab are on for OGs.
  3. On the next Friday and Saturday, compare the morning ✗ list with what officers see in game.
- **The plan itself needs no change.**

<adjustments>
- The tracker's Raid prep marks go through `lib/raid-prep-fill.ts`: `fillRaidPrep` for the tick, `trackerMarks` for Accept. `roll_call_marks.by_tracker` tells them apart. `roll_calls.tracker_checked_at` is the "Checked" time.
- Shared pure helpers that lib/ code needs now live outside lib/private: `lib/calendar-time.ts`, `lib/calendar-layout.ts`, `lib/member-away.ts`. The re-exports in `lib/private` keep the old imports working.
- Next decision number: D148.
</adjustments>

PR: (added by the orchestrator)
