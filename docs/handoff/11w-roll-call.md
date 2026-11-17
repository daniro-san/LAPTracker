# 11w — Roll call: marks per occasion, "the rest" per kind, away dates, Elixir Scramble teams

Closes #298; part of #293. Branch `session/11w-roll-call`, rebased on `origin/dev` at a89492d. Rules applied: D71, D75, D76, D80, D98, D99, D100. New decision: **D103** (amends D80).

## Built
- **The Roll call tab is on.** `Frame.tsx` `PATHS.mark = "/roll-call"`; the bottom bar no longer says "soon" for it.
- **Week page** `/w/[slug]/roll-call` (`?week=` as on the Calendar):
  - one card per occasion of the week, by day and time;
  - the Calendar's KvK ("KvK shield"), Undead Siege and each Elixir Scramble team, plus roll calls added by hand;
  - each card has the day, ST and the officer's own time, the counts ("Shield up 1 · No shield 1 · No problem seen 55 · Not set 0 · Away 3"), "Team A: 19/20" for an Elixir team, and links "Pick the team ›" and "Roll call ›";
  - "Add a roll call" (KvK shield, Undead Siege or Plunders on a day) and a Calendar link.
- **Marking page** `/w/[slug]/roll-call/mark?entry=&week=` (Calendar) or `?id=` (added by hand):
  - progress ("0 of 57 marked"), the kind's legend, a sticky search, then compact rows: the name and a ✓ / ✗ pair of 48 px `chip()` toggles. The pressed one is filled; the mark is also written under the name as a `Tag`;
  - the same button again clears;
  - the order is fixed when the page opens: not set first, then marked, by name. Away members are listed last under "Away, left out · n" with their last day or "On a break";
  - a sticky bar above the tabs: "n not set" and the kind's "the rest" button. After it: "55 marked “No problem seen”." with Undo;
  - a stale tap (another officer marked since) shows "Ana (R4) marked “Shield up” just now. That is shown now; tap again to change it." and the row takes their mark;
  - "Someone is away" opens the away dates sheet.
- **Away dates sheet** (`AwaySheet.tsx`): pick a member (name-key search, `searchRoster`), then "First day away (ST)", "Last day away (ST)", "What they said (optional)". Save writes the member's `away` fact through the facts route with the version the officer saw. A 409 shows the newer note with "Keep theirs" / "Use mine". "Not away" clears an existing note.
- **Team page** `/w/[slug]/roll-call/team?entry=&week=` (Elixir Scramble only): the counter "Team A: 6/20", "Add the first n suggested", a search, the team first, then the suggestions (daytime for them at the window, then no time zone, then night; active this week; main squad might), then members on the other team ("On Team A", not pickable). Each row says why: "12:00 for them · daytime · Active this week · Main squad 11.9M". A two-link step nav "Team · Roll call".
- **Calendar**: KvK, Undead Siege and Elixir Scramble entries link to their roll call; Elixir also to "Pick the team ›" (`CalendarAgenda.tsx`).
- **Facts editor**: "First day away" next to "Last day away" (`FactFields.tsx`, `facts-form.ts`).
- **Code**:
  - `lib/schema-rollcall.ts` (`roll_calls`, `roll_call_marks`, `roll_call_team`), migration `drizzle/0029_roll_call.sql`;
  - `lib/repo/roll-call.ts`;
  - `lib/private/roll-call.ts` (occasions and writes), `roll-call-view.ts` (page reads), `roll-call-rules.ts` (pure), `roll-call-words.ts`, `dictionary.rollcall*.ts` (98 keys per language under `roll.*` after the review round), two `calendar.*` keys;
  - `fact-fields.ts`: `AwayNote.from`, `awayUntil` honours it, `awayOn` (break or a running away note); `caravans.ts` uses `awayOn`; `member-facts.ts` accepts `from` (not after `until`);
  - route `POST /api/w/[slug]/roll-call`: `add` (request id, D100), `mark`, `rest`, `undo`, `team`;
  - UI: `AddRollCall.tsx`, `RollCallHead.tsx`, `RollCallMarks.tsx`, `use-marks.ts`, `AwaySheet.tsx`, `TeamPicker.tsx`, `roll-call-data.ts`, `roll-call-page.ts`, `roll-call-client.ts`.
- **Docs**: D103, the D80 amendment, the decisions index, ARCHITECTURE (the Roll call modules), GLOSSARY (roll call, mark, away dates), DESIGN ("Mark pair" under Workspace components).
- **Tests**:
  - `lib/private/roll-call-rules.test.ts` (5): D75 (no mark and a cleared mark count only as not set; away apart), "the rest" per kind and the clearing tap, the fixed order, the away skip by first and last day and by break, the team suggestion order;
  - `lib/private/roll-call.test.ts` (4, PGlite): the 409 with the newer mark and who, the same mark twice not a conflict, a non-member refused; "the rest" fills only not set and skips the away, undo clears only what nobody changed; Elixir team cap at 20, one team per member a week, its roll call asks only the team, its rest is "no"; a repeated add (same request id, or same kind and day) opens the first.

## Decisions
- **D103** records the model and rules. In short:
  - an occasion is a Calendar entry's week, or one added by hand. A Calendar roll call is stored with its first write, so reading a page writes nothing;
  - marks are append-only with a version per member, as member facts (D80): the unique version lets one of two writes in;
  - "the rest" per kind: shield "No problem seen" (`assumed`, counted apart), Elixir "did not join", Undead Siege and plunders "took part";
  - away dates are the existing `away` fact plus `from`; no new table.
- **Request ids** (D100): the add sheet sends one; a second add of the same kind and day also opens the first, so two officers do not make two "Plunders, Wed".
- **One hand-added roll call per kind and day** (review round): a partial unique index on (workspace, kind, day) over the rows with a request id. Calendar roll calls never carry one, so a Calendar delete that sets `entry_id` to null cannot collide with it.
- **The 409 on a mark keeps theirs and asks for a second tap** instead of a Keep theirs / Use mine box: a row is one tap, and the line says who and when.
- **New pages navigate with a full load after "Add a roll call"**: a client `router.push` was undone when the sheet gave its history entry back on unmount (found in the e2e). The notice editor already does the same.

## Deviations
- **Event-result and Elixir-team screenshot hooks (D96) stay "coming soon"**, as the task allowed when they do not fit:
  - Elixir teams: owner, 2026-11-16, the roster is visible only on Friday and teams are marked in the app;
  - Undead Siege result: the mail holds only the alliance's waves and level, nothing per member to mark;
  - damage event (Cheese Trap): not one of #298's occasions, and its result (phase, damage, MVP) is not a mark.
- **Plunders has no Calendar kind**, so it exists only as a hand-added roll call.
- **A roll call lists the alliance's current roster** (newest roster of any kind). A member who left after the occasion drops off it; their marks stay stored.

## Verified
- **`pnpm check` exits 0** on the branch rebased on a89492d: prettier, eslint, tsc; vitest **157 files passed, 2 skipped; 829 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". Before the rebase: 149 files, 784 tests.
- **Local e2e, 54 of 54 checks**, on a production build (`next build` + `next start` on :3927) of the rebased tree with the two review fixes. Local Postgres on 54927 with all 30 migrations, the bridge on 54928, a Discord stand-in on 54929 (Ana and Wren, R4), an invented 60-member roster with weekly activity, time zones, main squad, a break and an away note, and this week's caravan, KvK, Undead Siege and Elixir A/B. No upstream, Groq or real Discord call; no `/api/quota`. Checks:
  - the tab is a link and the open one; the week lists the four Calendar occasions; an untouched card says only "Not set";
  - the Calendar links "Roll call ›" and "Pick the team ›"; a KvK entry with a notice (D102) shows "Roll call ›" and "Notice: …" together;
  - opening a roll call writes nothing; ✓ stores `yes` v1; ✓ again stores null v2; rows keep their order; the mark buttons are 48 × 48;
  - Wren's stale ✗ shows "Ana (R4) marked “Shield up” just now…", the row takes Ana's mark, nothing of Wren's is stored; a raw stale POST answers 409 `stale` with `private, no-store`; without a session 401 `signed_out`;
  - away dates for the caravan's first suggestion, Nov 20–25: stored with `from`; the member moves to "Away, left out" with "until Wed, Nov 25"; the other rows keep their order; the next week's caravan suggestions skip them, this week's (before Nov 20) still suggest them;
  - "the rest" writes `assumed` for exactly the not-set count, none for the away; Undo clears them;
  - Team A: fill to 20, one off, Team B shows them as "On Team A"; Team A's roll call lists its team only;
  - adding plunders twice for one day opens the same roll call;
  - week, mark, away sheet and team at 360: no sideways scroll, every target ≥ 44 px, fields at 16 px;
  - the server log holds no member name or note; `app_errors` stays empty.
- **Privacy grep**: every added line of the diff against the 127 member names of the OGs fixture roster: 0 found.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11w-shots/`: `week`, `mark-kvk`, `mark-undead`, `away-sheet`, `team-b`, `mark-elixir`, `add-sheet` at `{360,1280}-{light,dark}-{en,pt}`; `week`, `mark-kvk`, `team-b` at `360-light-fr`; `iphone-*-390-light-en.png` (WebKit, iPhone 14) with `measures-all.json`.
- **Designer review of the screenshots**, two fixes made:
  1. An Elixir team nobody is on printed "Joined 0 · Did not join 0 · Not set 0" under "Team B: 0/20". The counts are now left out until the team has someone.
  2. The team picker mixed "On Team A" rows into the suggestions. They now come last, so the pickable ones read first.

## Review round (PR 381)
Four reviews (security and performance, quality and regression, architecture and requirements, a designer pass) and the owner's answers of 2026-11-17. D103 and the D80 amendment record the rules.
- **Owner answers:**
  - Plunders are when the alliance plunders caravans or Black Ops. The label stays; the add sheet shows "Plunders: when we plunder caravans or Black Ops." (EN, PT, FR); plunders have no "the rest" (`REST.plunder = null`, the route answers `invalid`).
  - Undead Siege keeps "took part".
  - Elixir Scramble registration: the card and the picker say "Registration closes Wednesday (ST)" until Wednesday of the Scramble's game week, "Registration closed" from Thursday 00:00 ST (`registrationOpen`). Team edits are not blocked.
- **Correctness and concurrency:**
  - C1: an away note saved without a first day gets the server day of the save (the facts route passes SERVER_TZ to `saveFacts`; the away sheet opens a new note on today). An older note without `from` runs from the day its version was saved, and On a break from the day it was set (`Fact.at`, `awayOn(facts, day, zone)`), so past roll calls and caravans do not change.
  - C2: `setTeam` (now `lib/private/roll-call-team.ts`) takes `pg_advisory_xact_lock` on a hash of the workspace and the week before reading the other team.
  - C3: `setTeam` de-duplicates its uids.
  - C4: orphan Elixir calls (`entry_id` null) are left out of `otherTeams` and of the picker's "other" map.
  - C5: a roll call whose occurrence was skipped, moved out of the week or deleted stays on the week with the added ones, with its marks.
  - C6: the partial unique index, with `findAdded` as the fallback; the migration is still one `0029_roll_call`, regenerated.
  - C7: `TeamPicker` derives picks from the page's rows plus its own in-flight changes, so a read again shows other officers' picks.
- **Validation:** day and week through `isDay`; ids capped at 2,147,483,647; the away `from` and `until` through `isDay` (an impossible date is a 400, not a 500); the facts editor marks a first day after the last as invalid with "The first day must be on or before the last day."
- **Regressions:** the facts editor compares an away note field by field (a missing `from` read as none), so an untouched note is not saved again; the card reads "Nov 20 – Nov 25" with a first day and "until Nov 25" without (`facts.awayRange`).
- **Performance:** a tap runs `openOccasion` and the one-uid membership check in parallel (`isMember`; an Elixir team checks the one uid with `teamHas`); taking members off a team is one `delete … where uid in (…)`.
- **Design:**
  - The bar: "57 not set · 3 away, left out" over a full-width "Mark the other 57 as took part" (side by side from 640 px); "All marked" alone when nothing is left; "57 marked as took part · Undo" for 10 seconds; then "Undo the rest" stays by the counts while any of those marks is unchanged (`RollCallRest.tsx`).
  - The mark page intro is one line ("✓ Took part · ✗ Not this time. Tap ✓ or ✗. Tap again to clear."); why not set never counts, the order, and the shield's "no problem seen" are under "How this works".
  - The team picker: the counter and "Add the first n suggested" stay at the top; at 20 the Pick buttons are off and "Team is full" shows; rows are grouped under "Daytime for them", "No time zone recorded", "Night for them" and "On the other team", each with one short reason ("Daytime · 12:00 for them · Active · Squad 11.9M"); the explainer reads "Best picks first: awake at game time, then active this week, then strongest."
  - Counts lead with "2 of 58 marked", each count kept whole; the week intro reads "Mark who took part. A blank mark never counts against anyone."; the week arrows are 28 px in a 48 px box (Calendar and Roll call share the bar); "What they said" is a three-line textarea; names are isolated in the away sheet's title and in the mark buttons' names.
  - The dark-mode sage tag (`#93a585` on `#1a1418`) is about 6.9:1, above 4.5:1 at 12 px: no change.
- **Tests:** `roll-call-rules.test.ts` 8 (adds the away rule not reaching the past, the registration boundary, `tallyParts`), `roll-call.test.ts` 6 (adds the week lock with two officers at once, de-duplicated uids, two adds at once, plunders' rest refused, a deleted entry's roll call kept, a note saved today leaving a past roll call alone), `member-facts.test.ts` +1 (away `from` saved, round trip, the order and impossible-date refines), and `app/(private)/api/w/[slug]/roll-call/route.test.ts` 3 (403 for non-JSON and another origin, 401 `signed_out`, 400 `bad_request` and `not_member`, 404 `not_found`, the 409 body with mark, version and who). An existing facts test compares the fact with `toMatchObject`, since a fact now carries `at`.
- **Verified:**
  - `pnpm check` exits 0: vitest **158 files passed, 2 skipped; 838 tests passed, 4 skipped**; drift gate fine; i18n up to date.
  - Local e2e **56 of 56** on a production build of this round (fresh database with the regenerated migration): the counts lead and registration line on the week, the Calendar's links beside the notice, the one-line intro and "How this works", marks and the 409, a new away note opening on today and the taller "What they said", the bar's count and button, the line after it with Undo, "All marked" and "Undo the rest" 10 seconds later, the grouped team rows, "Team is full" with the Pick buttons off, another officer's pick showing after the page reads again, Team B's "On Team A" rows last, "Mark the other 19 as did not join", the plunders hint and no "the rest" for plunders, an impossible day answered 400.
  - The iPhone pass found the counts line overflowing on the week page in WebKit (the separator sat inside each no-break unit); the separator now sits between them. Retaken in `11w-shots/` with the suffix `-r2`: `week`, `mark-kvk`, `mark-undead`, `team-b`, `team-b-top`, `add-sheet` at `360-{light,dark}-{en,pt}`, and `iphone-*-390-light-en-r2.png`, with `measures-all-r2.json`: no sideways scroll, no field under 16 px; the only small "targets" flagged are the add sheet's radio inputs inside 44 px labels.

## Open issues
1. **A Calendar entry moved to another week after its roll call started** keeps its plan week's key; it shows in the added group on its stored day.
2. **The held KvK reason** (`KVK_REASON_ON`, 11e/11f) can now read away dates by day (`awayOn`); not switched on here.
3. **Plunders' game name** is not known; the copy says "Plunders" / "Saques" / "Pillages" (owner: keep).
4. **Clearing or editing an away note later** changes what a past roll call shows for that member (the newest version is read, not the one in force that day). Reading the version in force by date would need the note's history by day.
5. **The concurrency test runs on PGlite**, a single connection, so it shows one team per member under two calls at once but not the lock under real parallel connections.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — the model, the three pages and the e2e fit one pass; the review round was a list of specific fixes, done in one pass.
Owner must do first: release dev, then on a phone mark one KvK shield and pick one Elixir Scramble team.
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Away by day: `awayOn(facts, day, zone)` in `lib/private/fact-fields.ts` (an away note running that day, or On a break, neither before it was saved; `zone` is SERVER_TZ). Use it wherever a member should be left out on a day (the KvK reason, a Follow-up list).
- Marks for a Follow-up list: `newestMarks(db, callIds)` in `lib/repo/roll-call.ts`; `assumed` ("no problem seen") is not a ✓ and must be left out of any follow-up, and no mark is "not set", never a ✗ (D75).
- Calendar occasions: `FROM_CALENDAR` in `lib/private/roll-call-rules.ts` maps kvk/undead/elixir to roll call kinds; a new Calendar kind with a roll call is one line there.
- Elixir teams: `roll_call_team` per (roll call, uid), changed only through `setTeam` in `lib/private/roll-call-team.ts` (one lock per workspace and week).
- Migration: `0029_roll_call`, on top of dev's `0028_notice_publishes_and_calendar_link`.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/381
