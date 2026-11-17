# 11j — Thefts log for same-server Secret Operations thefts

Issue #321. Decision: D97 (new). Rules applied: D71, D74, D75, D52, D77. Base: `origin/dev` at 61eb192, then merged with `origin/dev` at c538169 before the migration was generated.

## Built
- **Schema** (`lib/schema-thefts.ts`, migration `drizzle/0021_thefts.sql`, journal idx 21, chained to 0020). `drizzle.config.ts` lists both schema files.
  - `thefts`: `workspace_id`, `at` (null when the time was not read), `attacker_key`, `attacker_uid`, `attacker_name`, `attacker_tag` ("" when not known), `stolen` (`quest_rewards` or null for unreadable), `victim_uid`, `victim_name`, `source` (`photo` / `typed`), `note`, `created_by`, `created_at`.
  - `theft_follow_ups`: one row per change (`state` open / talked / resolved, `note`, `changed_by`, `changed_at`); the newest row per attacker is its state.
- **Public read model** `lib/queries/server-players.ts`: `serverPlayers(db)`, uid, name and tag of every member of each tracked alliance's newest usable daily roster (member-history arrays only, never `raw_json`).
- **`lib/repo/thefts.ts`**: insert, list, delete (inside one workspace), `hasAttacker`, insert and list follow-up changes (with the officer's shown name, D87).
- **`lib/private`**:
  - `theft-groups.ts` (pure): `attackerKeyOf` (`uid:<uid>` or `name:<name key>`), `groupThefts` (by attacker tag, any case, then by attacker; this week, in total, last time; known victims with counts inside each attacker; busiest first), `followUpOf` (newest change, else open; a later theft opens it again).
  - `thefts.ts`: `findAttackers` (other tracked alliances only, exact name first, then prefix, at most 8; a leading `[TAG]` is ignored), `theftsView` (the game week Monday 00:00 to Monday 00:00 server time, groups, the own roster for the victim picker), `addTheft`, `removeTheft`, `setFollowUp`.
  - `thefts-import.ts`: **the save hook** `saveSecretOpsDraft(db, access, draft, clock)` and `reportInstant` (the year for `MM-DD HH:MM`).
  - `dictionary.thefts.ts`: 54 keys under `thefts.*` in en, pt-BR and fr, spread into the three dictionaries.
- **Route** `app/(private)/api/w/[slug]/thefts/route.ts`: `GET ?q=` (attacker search); `POST` `{action:"add"|"remove"|"follow"}` (same origin, JSON, zod). Answers `{ ok: true }`, `{ players }` or a code; `private, no-store`; nothing logged.
- **Page** `/w/[slug]/thefts` (`app/(private)/w/[slug]/thefts/page.tsx`): access check first, then the log. The Calendar tab is passed as current (the log belongs to it); until 11h lands that tab is "soon", so no tab is highlighted.
  - `TheftsBoard.tsx`: "Add a theft", the empty state, the list.
  - `TheftCards.tsx`: one section per attacker alliance (`[TAG]`, counts), one `<details>` card per attacker (name, state badge, counts). Opened: "Taken from: Seesky 1 · Commerage 1", the follow-up (who set it and when, the last note, "A new theft after “Resolved”.", three radios, a note, Save), and each entry (server time and the viewer's clock, the member, what was taken, the source badge, the note, Remove in two taps).
  - `TheftForm.tsx` and `TheftFormFields.tsx`: the bottom sheet. Attacker: search via the route (250 ms after typing stops), or "Use “…” as typed" with an optional tag. Member: D74's `matchName` first, then the roster search, at most 6. Day and time in server time, default now, with "… your time" under them. What was taken: Quest rewards / Unreadable. Note. Save / Cancel.
  - `theft-data.ts`: card words and server times made on the server. `theft-client.ts`: the POST call, `useViewerZone` (the browser zone after hydration only), `viewerClock`.
- **Home** gets a card linking the log, marked to go when the Calendar sub-nav links it.
- `lib/schedule.ts`: `serverInstant(day, hhmm, cfg)`.
- Docs: D97 and its index line, `docs/ARCHITECTURE.md` (the new modules), `docs/GLOSSARY.md` ("theft").
- Tests: `lib/private/theft-groups.test.ts` (2), `lib/private/thefts.test.ts` (3, PGlite).

## Decisions
- **D97** holds the model: the attacker key, public reads for the search, the counts, no list of our members, the follow-up rows and reopening, the hook's rules, typed entries, game terms.
- **"What was stolen"** is the report's kind: `theft` → `quest_rewards` ("stole your quest rewards"), `null` → unreadable. The stolen items themselves are not read by the parser; an officer can write them in the note.
- **Follow-up reopening:** a theft whose time is later than the newest change shows the attacker as open, with "A new theft after “<state>”." A theft without a time does not reopen. Setting it back to open by hand is not a reopening.
- **The hook leaves out our own alliance** (its tag, or a name that matches exactly one member): a help line whose sentence was lost (`kind: null`) must not become a theft by one of our members (D75). The attacker search leaves out our own alliance too.
- **A re-sent report adds nothing:** each (attacker, member, time) is saved only as many times as the log lacks it, so the two Golgsunny thefts at 11:47 in image 54 are both kept the first time and neither the second time.
- **An attacker match needs the tag to agree:** `matchName` must find exactly one tracked player, and the read tag, when there is one, must be theirs (case-insensitive). Otherwise the name and tag stay as reviewed (`name:` key).
- **The attacker's alliance** is the tag of their newest entry, so a player shows once.
- **Times:** stored as instants; shown as "Mon, Nov 16 22:10 server time" (the Members tab's formatter style) and "Tue, Nov 17 01:10 your time" (the date only when the viewer's day differs).
- **Removal, not edit:** a wrong entry is removed and typed again. Officers "see and edit everything" (brief); a remove is the smallest edit that keeps wrong data from counting.
- **Separate words and schema files**, as 11i did for notices, so parallel sessions do not edit the same lines.

## Deviations
- **Issue #321 asks for more than the brief:** per-incident steps (reported → warned → talked → retaliated → resolved), the thief's server, a link to the attacker alliance's public page and leader, and a ready-to-paste warning message in en/pt/fr. The brief scoped a follow-up per attacker with three states; the rest is not built (D97 "Not built").
- **The save hook is defined against #299's comments,** because 11k is not on `dev`. No draft list, review screen or Discord path exists here; the screenshot path was tested at unit level only.
- **Portuguese keeps "Secret Operations" and "Quest rewards" in English** (D52: no Portuguese game text was seen). French uses the report's words.
- **`useViewerZone`** in `theft-client.ts` is the same hook 11h writes as `YourTime.tsx` (in progress, not on `dev`). Keep one when both are merged.
- **No PostHog event** (D77's list is closed).

## Verified
- **`pnpm check` exits 0** after merging `origin/dev` (c538169) and generating 0021: prettier, eslint, tsc; vitest **112 files passed, 2 skipped; 567 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". No test timed out. Before the merge: 105 files, 519 tests.
- Tests, one per behaviour:
  - **grouping counts:** 6 entries, two alliances (`VNC` and `vnc` grouped), this week 2 / total 4 and 1 / 2; per attacker 2 / 3 and 0 / 1; known victims counted inside the attacker; the entry without a time last;
  - **follow-up transitions:** open with no change; talked; resolved; a later theft reopens; a theft without a time does not; set back to open by hand is not a reopening;
  - **attacker search across alliances:** NSE's newest name (Grimmer, not Grimm) and URSA's Agrim for "grim", exact before contains, `[NSE] GREMLIN`, an emoji finds nothing, OGs' own player left out, and from NSE's workspace OGs' player is found and NSE's own are not;
  - **the save hook** on image 54's recorded OCR text plus two lines cut off at the edge (`kind: null`): 5 saved, 2 helps and 1 own member left out; Golgsunny matched to the RPD roster (`uid:41`) twice at 11:47 plus once with what was taken unknown; Stene and ANMcinalice kept by name; times 2026-11-15T13:48Z etc.; every row `photo` with the victim; saving again saves 0 (5 duplicates); a member of another alliance gives `not_in_alliance`; an entry without a name gives `attacker_missing`; a report read on 2027-01-02 puts `12-31 23:50` in 2026;
  - **workspace isolation:** OGs logs a theft; NSE's view is empty; NSE cannot remove it or set its follow-up (`not_found`); OGs cannot name NSE's member as victim (`not_in_alliance`) or its own player as attacker (`unknown_player`); a time two days ahead is `bad_time`.
- **Local e2e** on a production build (`pnpm build` + `next start` on :3157) of the merged tree, db:local on 54417 (bridge 54418), the Discord stub on 54437, playwright-core with system Chrome, browser zone Europe/Paris. Seed: OGs and NSE workspaces and one daily roster for each of the 20 tracked alliances from the committed `/v1` fixtures (uid, name, power, kills). No upstream call, no real Discord call, no `/api/quota`. **56 of 56 checks passed** (the run before the merge also 56 of 56, after fixing two date expectations in the harness):
  - Home links the log; the title; the empty state;
  - manual entry: the sheet opens on its title; "lollipop" finds `[NSE] Lollipopᴺˢᴱ`; "seesky" (our member) finds no attacker; "Tue, Nov 17 01:10 your time"; every sheet control ≥ 44 px; Save without an attacker asks for one; four thefts saved (search + matcher; last week, unreadable, a note; typed `Stene` with tag `1b8R`; `[WACK] ChaoticFyre`); a time two weeks ahead refused; the rows' keys, sources and `stolen`;
  - grouping: three sections; NSE "1 this week · 2 in total · last Mon, Nov 16 …"; 1b8R "0 this week · 1 in total" (Sunday is last week); WACK 1 / 1; only alliance tags as headings; "Taken from: Seesky 1 · Commerage 1" inside the card; server time · your time per entry; the unreadable entry and its note; the source badge; every control in an opened card ≥ 44 px;
  - follow-up: Talked (with "Set by Ana (R4), …" and the note), Resolved, both rows kept; after moving the changes 3 days back, the card shows Open and "A new theft after “Resolved”.";
  - remove asks first, then the entry and its empty group are gone;
  - route: search is `private, no-store` and leaves out our members; `/api/w/nse/thefts` with the OGs session is 401; a write with another Origin is 403; an unknown state is 400;
  - words and layout: no sideways scroll at 360 and 1280, light and dark, EN, PT and FR; no "flagged / warned / violation / shame"; PT "Roubos em Secret Operations", FR "Vols en Opération secrète", "cette semaine", "au total", U+00A0 in "Retirer cette entrée ?".
  - The server log holds only `w.sign_in` codes.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11j-shots/`: `thefts-{360,1280}-{light,dark}-{en,pt-BR}.png` (first card open), `add-360-light-en.png`, `add-360-dark-{en,pt-BR}.png` (with search results), `card-360-light-en.png`, `empty-360-light-en.png`.
- Not run: the screenshot path end to end (11k is not on `dev`); a Vercel deployment.

## Open issues
1. **11k must call the hook.** Its review screen needs a member picker (the report never names whose it is) and must pass `readAt`. Until then no photo entry can be made.
2. **One attacker, two keys:** an attacker saved by name (`name:` key) and later picked from the search (`uid:` key) shows as two attackers. Nothing merges them.
3. **Only the 20 tracked alliances are searchable.** Players of other alliances on server 325 are typed; whether a typed attacker is really from our server is not checked.
4. **An attacker whose name matches exactly one of our members** is left out by the hook (counted in `left.own`).
5. **The counts line's "last …" time is server time** but not labelled; entries say "server time".
6. **English and Portuguese report wording** is still unverified (11d open issue 5); the hook depends on the parser's `kind`.
7. **Retention** of thefts and follow-ups falls under D71's open retention question.
8. **The attacker search reads all 20 rosters** (about 1,900 names) on each request after typing stops. Not measured; fine at this size.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal. The work fit one pass; the only rework was splitting the form for the 300-line and 80-line limits.
Owner must do first:
1. Nothing to unblock. Optional: the Portuguese game words for "Secret Operations" and "quest rewards" (a screenshot of a Portuguese report), to replace the English in `lib/private/dictionary.thefts.ts`.
2. Decide whether the parts of #321 left out (per-incident steps, the thief's server, the alliance link and leader, the warning message) are wanted.
Plan changes needed: none. The workspace track lives in issues #293–#340, not in `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- The save hook for 11k: `saveSecretOpsDraft(db, access, { victimUid, readAt, entries }, { now, zone: env.SERVER_TZ })` in `lib/private/thefts-import.ts`. `entries` are `SecretOpsEntry` (D74) after review. It answers `{ saved, left: { help, own, duplicate } }`, `"not_in_alliance"` or `"attacker_missing"`. Help entries need no dropping; a `kind: null` entry is saved as unreadable unless the officer drops it.
- A member picker for the draft can reuse `memberCandidates` in `app/(private)/_ui/TheftFormFields.tsx` (matchName, then `searchRoster`); `theftsView(...).roster` or `latestRoster` gives the names.
- Calendar sub-nav (11h): add `{ id: "thefts", path: "/thefts", key: "thefts.nav" }` to `CalendarNav`'s views ("Thefts" / "Roubos" / "Vols" exist in all three languages), pass `current="thefts"` from the thefts page, and remove the Home card in `app/(private)/w/[slug]/page.tsx` (its comment marks it). The page already passes the Calendar tab as current.
- `useViewerZone` exists twice (11h's `YourTime.tsx`, this branch's `theft-client.ts`): keep one.
- Migration: this branch is `0021_thefts`. 11i also generated a 0021; whichever merges second drops its migration, its snapshot and its journal entry, merges `dev`, and runs `pnpm db:generate --name <name>`.
- `lib/schedule.ts` now has `serverInstant(day, hhmm, cfg)` (server date and time to an instant).
</adjustments>

<adjustments for="Session #340 (Follow-up tab)">
- "Thefts to follow up" are the attackers of `theftsView(db, access, clock).groups` whose `followUp.state` is not `resolved`; `followUp.reopened` marks those a new theft opened again. The changes are append-only in `theft_follow_ups` with who and when; `setFollowUp` writes one.
</adjustments>

PR: (added by the orchestrator)
