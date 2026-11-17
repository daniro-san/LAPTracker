# 11y — Follow-up: the week's list, officer records, history on the member card

Closes #340; part of #293. Branch `session/11y-follow-up`, rebased on `origin/dev` at 99f46e5. Rules applied: D70, D71, D75, D80, D97, D98, D99, D100. New decision: **D104**.

## Built
- **The Follow-up tab is on.** `Frame.tsx` `PATHS.review = "/follow-up"`; no tab says "soon" any more.
- **Page** `/w/[slug]/follow-up`:
  - title, then "These are notes for you. Nothing is sent and nobody is removed from the alliance.";
  - "Week Nov 16 – 22", then "{n} to look at · everyone else is fine", or "Nobody to look at this week." (before the first daily update, also "Reasons to check in come with the first daily update.");
  - one row per member, by name: name, rank, the reasons in yarn (see "Persona panel round" for the current rows);
  - "Thefts to follow up · n": attackers in state Open or Open again, with this week's count, and "Open the thefts log".
- **Record sheet** (`FollowUpList.tsx`): the member's reasons, "What happened?" with Talked to them / On a break / Needs help / All fine, "Last day away (ST)" for a break (today or later), a note of up to 500 characters, Save. A request id per open sheet (D100). After a save the page is read again and "Saved. {name} is off this week's list." stays, even when the list is now empty.
- **Member card**: "Follow-up notes", newest first, e.g. "Talked Tue, Nov 17: Back after the weekend · Ana (R4)" (`member-card.ts`, `MemberCards.tsx`; the only Members change).
- **Code**:
  - `lib/schema-followup.ts` (`member_follow_ups`), migration `drizzle/0032_follow_up.sql`;
  - `lib/repo/member-follow-ups.ts`;
  - `lib/private/follow-up-rules.ts` (pure: `worklist`, `weekStart`, `historyLine`), `lib/private/follow-up.ts` (`followUpView`, `recordFollowUp`, `followUpsOf`), `lib/private/dictionary.followup.ts` (32 keys × EN, PT, FR);
  - route `POST /api/w/[slug]/follow-up`;
  - UI: `app/(private)/w/[slug]/follow-up/page.tsx`, `_ui/FollowUpList.tsx`, `_ui/follow-up-words.ts`.
- **Docs**: D104, the decisions index, ARCHITECTURE (the Follow-up modules), GLOSSARY ("follow-up").
- **Tests**: `lib/private/follow-up.test.ts` (3, PGlite: who is on the list and a record taking them off with the history row; a break written as the away fact, refused when another officer's note is newer; a repeated request stored once, a non-member and a past day refused), `lib/private/follow-up-rules.test.ts` (2: resolved only for the game week; the history line), `app/(private)/api/w/[slug]/follow-up/route.test.ts` (2: 401 and 400; 409 with the newer version and its words).

## Decisions
- **D104.** In short:
  - the list reuses the Members rules (`whoOf`'s "checkin", `factsToAsk`), so no new or donation reason;
  - every record is an append-only `member_follow_ups` row; On a break writes the `away` fact (from today to the day chosen, the note as "What they said") and Needs help the `status` fact, through `saveFacts` with the version the page saw;
  - any record takes the member off the list until the end of that game week; a signal that still holds brings them back next week.
- **Onboarding facts**: all of Members' "Missing info" (main squad, troops, AD Tech, time zone, languages; owner, 2026-11-17). A new member on a break is not asked.
- **The 409** shows the newer value in one line and the next Save sends the newer version ("Save again to replace it"), as the roll call's one-tap rule does, instead of a Keep theirs / Use mine box.
- **Pending members (D106) stay off the list** even with onboarding facts missing: they head the Members tab already, and a follow-up row keyed by game uid would not move with D106's fact move. Matched, they join the list as new members if a fact is still missing. A record is refused for anyone not in the newest roster (`saveFacts` now also takes former and pending uids). Added after the rebase on 99f46e5.
- **"{n} to look at"** counts members only; thefts have their own heading and count.
- **The key list of the sheet's words** lives in `follow-up-words.ts`, not the client component: a constant exported from a `"use client"` file reaches a server component as a client reference (the first e2e run returned 500 on `FOLLOW_UP_KEYS.map`).

## Deviations
- **"See in Members"** opens the Members list searched by the name, not the card itself: the list has no address that opens a card, and the task kept Members changes to the history line.
- **The history line's shape** is "Talked Tue, Nov 17: note · officer" (the card's date format with the weekday), not "Talked 16 Nov: …".

## Verified
- **`pnpm check` exits 0**: prettier, eslint, tsc; vitest **162 files passed, 2 skipped; 849 tests passed, 4 skipped**; drift gate fine; i18n "17 languages up to date". After the rebase on 99f46e5 (migration regenerated as `0031_follow_up`): `pnpm check` exits 0, **166 files passed, 2 skipped; 862 tests passed, 4 skipped**. The e2e below ran before the rebase.
- **Local e2e, 48 of 48 checks**, on a production build (`next build` + `next start` on :3947) with local Postgres on 54947 (31 migrations), the bridge on 54948 and a Discord stand-in on 54949 (Ana and Wren, R4). Invented 40-member roster, four daily updates (Fri 13 – Mon 16 Nov): four members idle (Check in), one idle on a break, three new (two with facts missing), three attackers (open, open again, resolved). No upstream, Groq or real Discord call; no `/api/quota`. Checks:
  - the tab is a live link and the open one; the help line, week range and "6 to look at · everyone else is fine";
  - the list by name holds the four Check in and the two new with facts missing; the break and the complete new member are left out; the evidence is the Members wording; no donation reason;
  - thefts: the open and the open-again attacker, not the resolved one, and the link to the log;
  - "Talked to them" with a note: one row (talked, note, officer), the member leaves, "5 to look at", the saved line; the Members card shows "Talked Tue, Nov 17: Back after the weekend · Ana (R4)";
  - On a break until Nov 25: the away fact v1 with from, until and the note; Wren's stale break for another member shows "Another officer changed this just now: Nov 17 – Nov 22. Save again to replace it."; the second Save writes v2;
  - PT ("Conversamos em ter., 17 de nov.: …") and FR ("Tout va bien, mar. 17 nov. · …"): saved line, member leaves, card line in that language;
  - Needs help writes the status fact; the saved line stays with "Nobody to look at this week."; thefts stay;
  - list, sheet (EN, PT, FR) and card at 360: no sideways scroll, every target ≥ 44 px, fields at 16 px;
  - POST without a session: 401 `signed_out`; the server log holds no note or member name; `app_errors` empty for the run.
- **Privacy grep**: every added line of the diff against the 101 names of 3+ letters in the OGs fixture roster: 0 found. The e2e roster's names were checked against it too.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11y-shots/`: `list-*` and `sheet-*` at `{360,1280}-{light,dark}-{en,pt}` and `360-light-fr`; `after-talked`, `card` (EN, PT, FR), `stale`, `last-saved`, `empty` at 360 light/dark and 1280. iPhone WebKit was not run (no WebKit build in this session's Playwright).
- **Designer look**: the list reads top to bottom on a phone (help line, week, count, rows with one button and one link); the sheet's four answers fit two per line in PT at 360; the card puts the notes right under the status. One fix came from it: the saved line now stays when the last member leaves.

## Review round (PR 387)
Owner answers of 2026-11-17 and the review's fixes; D104's amendment records the rules.
- **Missing info**: the list uses `factsToAsk` as it is (five facts), not three.
- **Resolved for the game week**: kept (owner). The week starts at Monday 00:00 server time (`weekStart`, `zonedInstant`), not on a UTC day.
- **Saved line**: the name goes through `isolate()`.
- **Read size**: `followedUpSince` reads only uid and time of this week's records; `listMemberFollowUps` now needs a uid and serves the card only.
- **Needs help comes back**: `worklist` takes a member with a reason who is Check in or Needs help, not on a break (`needsAWord`). The page labels that line "Needs help: …".
- **Tests**: `follow-up-rules.test.ts` 2 (the week boundary: Mon 01:00Z is Sun 23:00 ST, the week before; the history line); `follow-up.test.ts` 6 (adds: Needs help back next week while the signal holds, at a later `now`; a member whose signal clears leaves with nothing recorded; the card's follow-ups newest first); route test 2 (400 for a bad action, a 501-character note and an extra key; 500 characters accepted).
- **Verified**:
  - `pnpm check` exits 0: **166 files passed, 2 skipped; 865 tests passed, 4 skipped**.
  - Short local e2e on the changed paths, **12 of 12**, on a fresh production build, with the database recreated (32 migrations) and the same invented roster:
    - a new member with main squad, AD Tech and time zone recorded is now listed for "Troops, Languages" (7 to look at);
    - the saved line is "Saved. ⁨Bramble⁩ is off this week’s list." (isolated name);
    - the member leaves and one row is stored; the card line reads "Talked Tue, Nov 17: … · Ana (R4)";
    - the PT line reads "Novo · falta perguntar: Tropas, Idiomas";
    - no sideways scroll at 360; no note or name in the server log; `app_errors` empty.
  - Screenshots `r2-list-360-light-{en,pt}.png`.

## Persona panel round
An R4 officer, a product designer and a copywriter looked at the screenshots. D104's second amendment records each change and quotes the old strings.
- **Monday rule and Undo**:
  - the line "People you note leave the list until Sunday. If the reason is still there, they’re back on Monday." sits under the week;
  - the saved line reads "Saved. {name} is off the list until Monday." with a 44 px Undo;
  - Undo appends a `withdrawn` record (`undoFollowUp`, `liveRecords`, `resolvedBy`) and puts a break's or Needs help's fact back to the version before, as a new version, unless another officer changed it since;
  - `member_follow_ups` gains `withdrawn` and `fact_version`. The migration was regenerated (now `0032_follow_up`, see below).
- **Rows**:
  - one-tap "Talked to them" (its own request id, no note), "Add a note" (PT "Anotar", FR "Noter") and "Members ›", all 44 px and on one line, in EN, PT and FR at 360;
  - grouped under "Check in · n" and "New · n", alphabetical in each;
  - the warm reason lines are Follow-up-only keys; the Members keys are unchanged;
  - "n things still to ask" on the row, the full list in the sheet;
  - a "Needs help" tag.
- **Sheet** (`FollowUpSheet.tsx`, split from the list for size):
  - no answer chosen at first, Save off until one is;
  - an equal 2 × 2 grid;
  - "They need help";
  - "Back on (server time)" only for On a break, with "Back on Wed, Nov 25" and the hint under it (the last day stored is the day before);
  - the 409 line names the officer, in amber, with the card's date format (`factWriter`).
- **Thefts**:
  - "Thefts by other alliances · n";
  - the jump line "2 thefts to follow ↓";
  - each attacker links to `#attacker-<key>` in the log. `TheftCards.tsx` gains that `id` on each attacker; it is the only change outside Follow-up and the member card.
- **Kept as the owner wrote them (issue 340)**: the help line, "Nobody to look at this week." (now normal weight) and "{n} to look at · everyone else is fine". The panel's alternatives are in D104 for the owner.
- **Tests**: `follow-up.test.ts` +1 (Undo: back on the list, two rows kept, the card shows neither, the away fact back to empty as v2, a second Undo answers `not_found`). The route test's 409 line now names the officer.
- **Verified**:
  - `pnpm check` exits 0.
  - Local e2e **59 of 59** on a production build, with a fresh seed for each language, 360 px, EN, PT and FR:
    - warm lines and two headings;
    - row actions on one line;
    - every target ≥ 44 px, no sideways scroll;
    - the sheet: nothing chosen, Save off, no date until On a break, 4 equal widths, Save on after a choice;
    - one tap stores one talked row with no note; Undo is 44 px; Undo brings the member back and appends `withdrawn`;
    - everyone noted gives the empty state;
    - no names in the server log; `app_errors` empty.
  - The designer look found the thefts rows losing the space before "·" (a flex link); fixed.
  - Shots: `11y-shots/r3-{list,sheet,sheet-break,after-save,empty}-360-{en,pt,fr}.png`.
  - Another agent's worktree held this session's earlier ports (3947, 54947–54949), so this run used 3967, 54957, 54958 and 54969. Only my own processes were stopped.

## Rebase on b075de8 (#386, the members' board)
- The migration was regenerated as `0032_follow_up` after #386's `0031_members_board`.
- The follow-up route has a fixture in #386's route walk (`member-session.test.ts`), and my tests make officer sessions (`createSession(…, "officer")`).
- Both branches added a spread to `lib/private/dictionary.ts`, which came to 301 lines; the English `profile.*` keys moved to `lib/private/dictionary.profile.ts` (the D88 pattern: blocks spread in from modules). The pt-BR and fr dictionaries are unchanged.
- `pnpm check` exits 0: **170 files passed, 2 skipped; 893 tests passed, 4 skipped**. The e2e above ran before this rebase.

## Open issues
1. **"Members ›"** opens the Members list searched by the name, not the card directly; an address that opens a member's sheet would need a Members change.
2. **A record resolves the member for the whole game week**, whatever the signal; a new signal later the same week does not bring them back until Monday.
3. **The KvK reason** stays held (`KVK_REASON_ON`); when it is turned on it appears here too.
4. **Home** does not show the Follow-up count yet.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — the list, the sheet, the route and the e2e fit one pass.
Owner must do first: release dev, then on a phone open Follow-up, note "Talked to them" for one member and check the line on their card.
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Follow-up records: `listMemberFollowUps(db, workspaceId, uid)` in `lib/repo/member-follow-ups.ts` (one member, newest first, with the officer's desk name); `followedUpSince(db, workspaceId, weekStart(today, zone))` gives the uids followed up this game week (for a Home count).
- A constant exported from a `"use client"` module cannot be read in a server component (it arrives as a client reference); put shared key lists in a plain module.
- Migration: `0032_follow_up`, on top of dev's `0031_members_board` (b075de8).
</adjustments>

PR: (added by the orchestrator)
