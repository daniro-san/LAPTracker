# 11w — Roll call: marks per occasion, "the rest" per kind, away dates, Elixir Scramble teams

Closes #298; part of #293. Branch `session/11w-roll-call`, rebased on `origin/dev` at b6cd331. Rules applied: D71, D75, D76, D80, D98, D99, D100. New decision: **D103** (amends D80).

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
  - `lib/schema-rollcall.ts` (`roll_calls`, `roll_call_marks`, `roll_call_team`), migration `drizzle/0028_roll_call.sql`;
  - `lib/repo/roll-call.ts`;
  - `lib/private/roll-call.ts` (occasions and writes), `roll-call-view.ts` (page reads), `roll-call-rules.ts` (pure), `roll-call-words.ts`, `dictionary.rollcall*.ts` (89 keys per language under `roll.*`), two `calendar.*` keys;
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
- **No unique index on (kind, day) for hand-added roll calls**: deleting a Calendar entry sets its roll calls' `entry_id` to null, and such an index would then make the Calendar delete fail.
- **The 409 on a mark keeps theirs and asks for a second tap** instead of a Keep theirs / Use mine box: a row is one tap, and the line says who and when.
- **New pages navigate with a full load after "Add a roll call"**: a client `router.push` was undone when the sheet gave its history entry back on unmount (found in the e2e). The notice editor already does the same.

## Deviations
- **Event-result and Elixir-team screenshot hooks (D96) stay "coming soon"**, as the task allowed when they do not fit:
  - Elixir teams: owner, 2026-11-16, the roster is visible only on Friday and teams are marked in the app;
  - Undead Siege result: the mail holds only the alliance's waves and level, nothing per member to mark;
  - damage event (Cheese Trap): not one of #298's occasions, and its result (phase, damage, MVP) is not a mark.
- **Undead Siege's and the plunders' "the rest" is "took part"**: the owner named only the shield and Elixir. This follows the prototype. Say if it should be "no problem seen" too.
- **Plunders has no Calendar kind**, so it exists only as a hand-added roll call. "Plunders" is translated ("Saques", "Pillages"); the game's own word is not known.
- **No registration deadline or countdown** on Elixir Scramble: Wednesday or Thursday is still unconfirmed (11h's open item).
- **A roll call lists the alliance's current roster** (newest roster of any kind). A member who left after the occasion drops off it; their marks stay stored.

## Verified
- **`pnpm check` exits 0** on the branch rebased on b6cd331: prettier, eslint, tsc; vitest **152 files passed, 2 skipped; 791 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". Before the rebase: 149 files, 784 tests.
- **Local e2e, 53 of 53 checks**, on a production build (`next build` + `next start` on :3927) of the rebased tree with the two review fixes. Local Postgres on 54927 with all 29 migrations, the bridge on 54928, a Discord stand-in on 54929 (Ana and Wren, R4), an invented 60-member roster with weekly activity, time zones, main squad, a break and an away note, and this week's caravan, KvK, Undead Siege and Elixir A/B. No upstream, Groq or real Discord call; no `/api/quota`. Checks:
  - the tab is a link and the open one; the week lists the four Calendar occasions; an untouched card says only "Not set";
  - the Calendar links "Roll call ›" and "Pick the team ›";
  - opening a roll call writes nothing; ✓ stores `yes` v1; ✓ again stores null v2; rows keep their order; the mark buttons are 48 × 48;
  - Wren's stale ✗ shows "Ana (R4) marked “Shield up” just now…", the row takes Ana's mark, nothing of Wren's is stored; a raw stale POST answers 409 `stale` with `private, no-store`; without a session 401 `signed_out`;
  - away dates for the caravan's first suggestion, Nov 20–25: stored with `from`; the member moves to "Away, left out" with "until Wed, Nov 25"; the other rows keep their order; the next week's caravan suggestions skip them, this week's (before Nov 20) still suggest them;
  - "No problem seen for the rest" writes `assumed` for exactly the not-set count, none for the away; Undo clears them; the card reads "Shield up 1 · No shield 1 · No problem seen 55 · Not set 0 · Away 3";
  - Team A: 0/20, the away member not offered, rows say why; "Add the first 20 suggested" → 20/20 and 20 rows stored; one off → 19/20; Team B shows them as "On Team A";
  - Team A's roll call lists its 19 only; one ✓, then "The rest did not join" → 18 `no`;
  - "Add a roll call" → Plunders, Wed: opens it with "The rest took part"; adding it again opens the same id;
  - week, mark, away sheet and team at 360: no sideways scroll, every target ≥ 44 px, fields at 16 px;
  - the server log holds no member name or note; `app_errors` stays empty.
- **Privacy grep**: every added line of the diff against the 127 member names of the OGs fixture roster: 0 found.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11w-shots/`: `week`, `mark-kvk`, `mark-undead`, `away-sheet`, `team-b`, `mark-elixir`, `add-sheet` at `{360,1280}-{light,dark}-{en,pt}`; `week`, `mark-kvk`, `team-b` at `360-light-fr`; `iphone-*-390-light-en.png` (WebKit, iPhone 14) with `measures-all.json`.
- **Designer review of the screenshots**, two fixes made:
  1. An Elixir team nobody is on printed "Joined 0 · Did not join 0 · Not set 0" under "Team B: 0/20". The counts are now left out until the team has someone.
  2. The team picker mixed "On Team A" rows into the suggestions. They now come last, so the pickable ones read first.
  Left as is: the marking page's three lines of legend before the list (they say what ✓ and ✗ mean and that not set never counts); full-page captures show the fixed tab bar mid-picture (a capture effect).

## Open issues
1. **Registration deadline**: add it to Elixir Scramble once the owner confirms Wednesday or Thursday.
2. **"The rest" for Undead Siege and plunders** is "took part" (see Deviations).
3. **Two officers adding one member to Team A and Team B at the same moment** can both succeed: each team locks only its own row. Rare; a lock on the week would close it.
4. **A Calendar entry moved to another week after its roll call started**: the roll call keeps its plan week's key and its stored day when the entry is no longer laid out in that week.
5. **The held KvK reason** (`KVK_REASON_ON`, 11e/11f) can now read away dates by day (`awayOn`); not switched on here.
6. **Plunders' game name** is not known; the copy says "Plunders" / "Saques" / "Pillages".
7. **No route test** for `/api/w/[slug]/roll-call`, as for the other private routes; the e2e covers its 401 and 409.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — the model, the three pages and the e2e fit one pass. The rework came from the restart (scratchpad lost, rebase on dev's `0027_thefts_kind`) and one real navigation bug found by the e2e.
Owner must do first: release dev, then on a phone mark one KvK shield and pick one Elixir Scramble team. Answer: the registration day (Wednesday or Thursday), and whether Undead Siege and plunders' "the rest" should be "took part".
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Away by day: `awayOn(facts, day)` in `lib/private/fact-fields.ts` (a break, or an away note with `from` ≤ day ≤ `until`). Use it wherever a member should be left out on a day (the KvK reason, a Follow-up list).
- Marks for a Follow-up list: `newestMarks(db, callIds)` in `lib/repo/roll-call.ts`; `assumed` ("no problem seen") is not a ✓ and must be left out of any follow-up, and no mark is "not set", never a ✗ (D75).
- Calendar occasions: `FROM_CALENDAR` in `lib/private/roll-call-rules.ts` maps kvk/undead/elixir to roll call kinds; a new Calendar kind with a roll call is one line there.
- Elixir teams: `roll_call_team` per (roll call, uid); a team's roll call is keyed by its Calendar entry and plan week.
- Migration: `0028_roll_call`, on top of dev's `0027_thefts_kind`.
</adjustments>

PR: (added by the orchestrator)
