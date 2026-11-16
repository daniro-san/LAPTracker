# 11e — Members tab and the officers' first-use shell

Closes #296. Part 2 of #312 (the first-use shell and the how-to page; the format of the first-use steps waits for a persona review). Rules applied: D71, D72, D75, D70, D56, D22, D76.

## Built
- **`/w/[slug]/members`** (`app/(private)/w/[slug]/members/page.tsx`): `requireWorkspace` first inside `withPageDb`, then `membersView`. A refused visitor goes to the 404, the silent Discord re-authorisation, `no-access?why=blocked` or the sign-in.
  - Header lines: "From the game, read each night just before the server resets. Last read: <day> <hh:mm> server time." and the week shown, Monday to Sunday.
  - **Thanks first**: "Thank you this week", top 3 donors (week total) and top 3 most active (weekly activity). New members are left out. The section is hidden when both lists are empty.
  - Two help lines: what Check in means (nothing is sent, the app removes nobody), and "— means no data … It never counts against anyone."
  - Then a name search, the filter chips **All · New · Check in · Missing info · R4 and R5**, the count ("9 of 101 members"), **Copy for spreadsheet**, and one card per member: one column below 640 px, two columns from 640 px.
- **The card** (`app/(private)/_ui/MemberCard.tsx`), a native `<details>`, so it works without JavaScript and nothing is hover-only:
  - The summary shows:
    - the name (`translate="no"`), a "New" tag, and the rank as the game shows it ("R4 · Goddess", using D56's `roleOf`);
    - Sanctuary, Might (compact), the week's donations (compact) and the activity;
    - "first seen <date>" for a new member;
    - the status: **Fine**, or **Check in** with each reason and its evidence;
    - "No data: …" when something is missing;
    - "Details ▾", whose screen-reader name is "Details, <name>".
  - The details show:
    - donations per server day, Mon … Sun, as exact numbers: "—" for no data, blank for a day not read yet, and the week's exact total;
    - the activity this week and the day's honor (`daily_honor`);
    - Joined (`joined_at`), Seen since (first daily roster that lists the member), Last online (`last_online_at`) and the map position (`x`, `y`).
  - `online` is not shown (D71: hidden while the API leaves it empty). `avatar_url` is never selected.
- **The list** (`app/(private)/_ui/MembersList.tsx`, client):
  - Search folds case and accents.
  - The filters act on server-made flags.
  - A filtered-out card is `hidden`, so an open card stays open.
  - Copy puts the header and the line of every card shown on the clipboard. The lines are made on the server.
- **The read** (`lib/private/members.ts`, `membersView(db, access, now)`): every read is filtered by `access.unionId`.
  - Rows come from the newest end-of-day read with `raw_json`.
  - Check-in reasons, each with its evidence:
    - **offline proxy**: `idleRun`;
    - **might unchanged**: D70's `mightUnchanged(db, unionId).unchanged`, reused as is;
    - **no kills gained in KvK**: the newest public scheduled event in the last 7 days whose Start and End rows are fresh and not failed, for members whose kills are known on both sides and did not rise.
- **Pure arithmetic** (`lib/private/member-week.ts`): `gameWeek`, `weekDonations`, `weekTotal`, `idleRun`, `isNewMember`, `missingOf`, `topOf`.
- **Copy for spreadsheet** (`lib/private/members-sheet.ts`): 17 columns: Name, Rank, Might, Sanctuary, the 7 days, Week total, Activity this week, Day's honor, Joined, Seen since, Status (with the reasons).
  - Numbers are plain integers, and a cell with no data is empty, as in the member-history copy.
  - A name that starts with `= + − @` gets a leading apostrophe.
  - Left out: map position, online, last online, the photo (D71).
- **Table reads** (`lib/repo/workspace-rosters.ts`):
  - `endOfDayReads`: usable daily rosters with `raw_json`, members projected in SQL to the 13 keys the tab uses, so `avatar_url` and `frame_url` never leave the database;
  - `firstSeenDays`: `unnest(member_uids)`, min `read_day` per uid;
  - `scheduledEventKills`.
- **Tabs**: Home and Members are links (`/w/<slug>`, `/w/<slug>/members`), and the open one has `aria-current="page"`. Roll call, Calendar and Follow-up stay "Soon". The shell moved into `SignedInFrame` (`Frame.tsx`), which both pages use. Home's placeholder now says the Members tab is ready and links to it.
- **First-use shell** (issue #312 part 2, coordinator's instruction of this session: shell only, format pending):
  - The steps are data: `lib/private/first-use.ts` `FIRST_USE_STEPS`. Each step has a title, paragraphs, an optional visual slot (`"sources"`, `"how-to"`) and an optional coach-mark target (`[data-tour="members-tab"]`, `[data-tour="language"]`, both present in the shell).
  - There are four steps:
    1. what this is;
    2. where the numbers come from (from the game / from a photo / typed by an officer);
    3. what to do each week;
    4. how to switch language, with the link to the how-to page.
  - `FirstUse.tsx` shows them as plain cards in the existing `Sheet`:
    - it opens by itself while the `lap_ws_intro` cookie is absent (one year, per browser, no migration);
    - Skip on steps 1–3, Back and Next, then Start on step 4;
    - Escape closes it;
    - the "?" in the header reopens it on every signed-in screen.
- **How-to page** `/w/[slug]/how-to`: the page the leadership pins in Discord. It shows:
  - the address (from the request's host, so production shows `https://laptracker-inky.vercel.app/w/ogs`);
  - signing in with Discord;
  - adding the page to the home screen on iPhone (Safari) and Android (Chrome);
  - an "Open the Officers' Desk" button.

  It reads nothing, so it opens before sign-in. It is linked from the sign-in page and from step 4.
- **Words**: 97 new keys (28 → 125 per language) in en, pt-BR and fr, and `home.next` rewritten, French with a no-break space before `: ? !` and inside « ». The dictionary reached 472 lines (the limit is 300), so pt-BR and fr moved to `lib/private/dictionary.pt-BR.ts` and `dictionary.fr.ts`. The parity test is unchanged and passes.
- `docs/ARCHITECTURE.md`: the new `lib/private` modules and `lib/repo/workspace-rosters.ts`.
- Tests:
  - `lib/private/member-week.test.ts` (3 tests);
  - `lib/private/members.test.ts` (PGlite, 3 tests);
  - `lib/private/members-sheet.test.ts` (1 test).

## Decisions
- **Game week = Monday to Sunday, server days.** Weekly activity resets on Monday (D75: "ignoring the Monday reset"), and prototype v5 says "A week here runs from Monday to Sunday, like the game's". The copywriter's older `help.week` (Tuesday to Monday) was not used.
- **The week shown is the game week of the newest end-of-day read.** On Monday before 23:37 server time that is last week, complete, which is when officers do the weekly check. After Monday's read it moves to the new week. Days after the newest read are blank ("not read yet"), not "—".
- **An end-of-day read** is a usable daily roster (fresh, no error, not empty) that has `raw_json`. Rosters from before D72 have none and are used only for "first seen" and D70.
- **Offline proxy: 2 days, i.e. 3 consecutive end-of-day reads** in which `active` and `daily_tech` did not change.
  - On a Monday the activity is compared with 0 (the reset).
  - A null on either side, or a server day without a read, ends the run (missing data never counts).
  - This is the conservative reading of "unchanged across 2 consecutive end-of-day reads", chosen to approximate D75's "offline for more than 2 days". One read pair (1 day) would also fit the words. It is one constant, `IDLE_STEPS` in `member-week.ts`.
  - Evidence text: "activity 87 and donations 0 unchanged for 2 days (3 end-of-day reads in a row)".
- **New member**: first seen in the alliance after its oldest usable daily roster, and less than 14 days (D70's `NEW_MEMBER_DAYS`) before the newest read.
  - A member already in the oldest roster predates the records and is not new. Otherwise, in the first two weeks of records, everyone would be new.
  - New members are left out of the thanks (a comparison). The reasons still apply to them, because none of the three is a comparison; D70's own 14-day rule still keeps them out of "might unchanged".
- **KvK reason (D75 c) is built**, because dev has #271's data: per-member kills in each event's Start and End rosters.
  - "KvK" = the newest public **scheduled** event (`manual = false`) of the last 7 days. The Saturday scheduled event is the Kingdom War (#271 measured "KvK 2026-11-14" on it).
  - Unknown kills on either side never count.
  - The reason does not say "no away note": away notes do not exist until #297/#298.
- **Rank** reads "R4 · <title>" with the game's titles (D56's `roleOf`): "R4 · Goddess" for Overseer, "R4 · God of War" for Militarist.
- **Numbers**: compact on the card and in the thanks (the site's rule); exact in the opened details (the site's "exact on tap") and in the copy.
- **Map position is shown** in the details: D71 lists `x` and `y` for the workspace. The scrubbed fixtures make it "X 0 · Y 0" in the screenshots.
- **The how-to is an in-app page, not a docs file.** The issue asks for a one-page how-to per language that the leadership pins in Discord. A docs file would break CLAUDE.md's "English only in docs". The workspace's UI copy is trilingual by D71, so `/w/<slug>/how-to` serves each reader in their language, and one pinned link serves all three.
- **"Seen" for the first-use steps is a cookie** (`lap_ws_intro=1`, one year, not HttpOnly, no data in it), as the brief preferred. It is per browser, not per officer.
- `raw_json` is projected in SQL (`jsonb_build_object` over the 13 keys), so `lib/private` never holds `avatar_url`. The test checks that the view's JSON has no "avatar".

## Deviations
- **No "Low donations" filter** (#296 lists it). D75 and the owner: donations are never punitive. Not built, and no median or "typical week" is shown.
- **No "Away" filter** (#296 lists it). Away notes arrive with #297 (`member_facts`); the filter waits for them.
- The issue's "missing data" filter uses the copywriter's label "Missing info" ("Faltam dados", "Infos manquantes").
- **Statuses**: only the computed Fine and Check in. On a break and Needs help are officer-set and arrive with #297.
- **A name search** was added. It is in the approved prototype v5, not in #296's list.
- **Thanks**: top donors and most active only. D75's "most improved" and event MVPs are not built; event results do not exist yet.
- **First-use**: on the coordinator's instruction, a data-driven shell with plain cards, no visual polish and no motion. The format (static cards, cards with motion, coach marks, per-tab tips, or a mix) is pending a persona review.
- **An expired session on `/members`** re-authorises silently and lands on `/w/<slug>` (Home), not back on Members. The login route has no return path.
- Copy for spreadsheet leaves a no-data cell empty, as `rosterTsv` does, rather than writing "—". `SUM` in a spreadsheet then skips it without a text value.

## Verified
- `pnpm check` green after merging `origin/dev` (df42b74 → 75174b4: #323, #324, #319):
  - prettier, eslint, tsc;
  - vitest: 88 files passed, 2 skipped; 461 tests passed, 4 skipped;
  - drift gate: "Everything's fine";
  - i18n: 17 languages up to date.
  - Before the merge: 77 files, 372 tests passed.
- New tests (one per behaviour):
  - **week sum on a synthetic week**: Sunday of the week before is not counted; a null day and a day with no read are `null`; days after the newest read are `"later"`; total 650 of 100 + 250 + 300; no known day gives `null`;
  - **offline proxy**: 3 unchanged reads across Monday's reset give `{ days: 3, activity: 0, donated: 0 }`. No reason when the member was active on Monday, when Monday's activity is unknown, after only one unchanged day, or across a missing day;
  - **new members** and thanks: the rule's three cases; a new member and a zero value are left out of the thanks;
  - **two tenants, a player who moved (D71)**:
    - player 900 donates in OGs on Monday and Tuesday; OGs sees 500 and 600;
    - after the move, OGs no longer lists them;
    - NSE sees `[—, —, 700, 800, later, later, later]`, total 1,500, seen since Wednesday, New;
    - the view's JSON has no "avatar";
  - **KvK**: kills 100 → 100 gives the reason with the event's time; a gain, or an unknown Start, gives none;
  - **might**: 16 daily reads with the same might give D70's "might unchanged for 15 days"; growing might gives none;
  - **copy**: the exact 17 headers and cells; the formula-safe name; the map position (4321, 8765) and the last-online date are absent.
- The roster-field fence test caught a literal `"active"` in the page; it was renamed to `activity`. The token test reads `#3xx` in `app/` comments as a hex colour, so comments say "issue 312".
- **Local e2e**:
  - Setup:
    - `pnpm db:local:start` (port 54327) and the bridge (54328);
    - a worktree-only `.env.local`: random secrets that were never printed, upstream base URLs pointed at a dead local port, `DISCORD_API_BASE_URL` at the stub;
    - 11c's Discord stub on 54377;
    - Playwright-core with system Chrome on `http://localhost`. No upstream call and no Discord call.
  - The seed (`scratchpad/11e/seed.mjs`):
    - the OGs workspace;
    - 17 OGs daily rosters built from the scrubbed fixture `fixtures/v1-20261116T105019Z/alliance-67111155.json`: 8 without `raw_json` (10-30 … 11-06) and 9 end-of-day reads (11-07 … 11-15);
    - a Saturday 2026-11-14 event with Start and End rosters.
    - The week's counters (`daily_tech`, `active`, might growth, kills gained) are synthetic and deterministic, so that every state shows. Three members first appear on 11-10; two stop moving from Friday 13; two keep the same might; six gain no kills.
  - The run, against a production build (`next build` + `next start`) of the merged tree, passed all 35 checks:
    - signed out, `/w/ogs/members` showed the sign-in;
    - the first-use steps opened by themselves after sign-in, each said "n of 4", and Start closed them and set `lap_ws_intro=1`;
    - after a reload they stayed closed; "?" opened them again, and Skip closed them;
    - the Members tab link carried `aria-current="page"`, and Home was a link;
    - no sideways scroll at 360, 640 and 1280 px, in light and dark;
    - every control in main, the header and the tabs measured at least 44 × 44 px at 360 px;
    - none of "flagged", "warned", "violation" or "to remove" appeared in the page;
    - the thanks came before the list;
    - Copy for spreadsheet with "R4 and R5" on gave a header and 9 lines of 17 columns, with no map position, last online or photo;
    - the how-to page opened signed out and showed the address.
  - Counts with the seed:
    - All 101;
    - New 3;
    - Check in 10: 6 with no kills gained, 2 with might unchanged for 16 days, and 2 with "activity 87 and donations 0 unchanged for 2 days (3 end-of-day reads in a row)" and the same for activity 69;
    - Missing info 32;
    - R4 and R5: 9.
  - Seed members whose `active` was null in the fixture were left out of the offline proxy, as the rule says. The seed was changed once to pick two members with a known activity.
  - Screenshots in `<scratchpad>/11e-shots/` (not committed):
    - members at 360, 640 and 1280 px, light and dark;
    - an opened Check-in card, the New filter;
    - PT and FR at 360 px, full page;
    - first-use steps 1–4 at 360 px light, step 2 dark, step 1 at 1280 px, PT and FR;
    - the how-to page in en, pt-BR and fr.
- **Production build timing** (local database, 101 members, machine load average 30–40, five loads after sign-in):
  - first byte 53–69 ms; page loaded in 119–156 ms (one later run 202–440 ms);
  - `cache-control: private, no-store`;
  - the HTML is 1,112,453 bytes: 60,343 gzip, about 36,500 brotli (see Open issues).
  - Under `next dev` with the same load, the same page took 5–30 s.
- **done_when** ("the week's donation totals match the in-game Donation → Weekly ranking for ≥ 90 % of members") is **not measurable before the release**. The end-of-day reads that keep `daily_tech` (D72) are not in production. No stored data holds per-member `daily_tech` for the week of pictures 22–25, and the production history API returns only uid, name, power and kills. So the OCR text of pictures 22–25 (29 members, ranks 71–100) has nothing to be compared with. The measurement after the release is under Next.

## Open issues
1. **The first-use format is pending the persona review** (static cards, motion, coach-mark tour, per-tab tips, or a mix). The steps are data, and the two `data-tour` targets exist. Only `FirstUse.tsx` changes with the format.
2. **The KvK reason may list many members.** On KvK 2026-11-14, #271 measured that 54 % of OGs' members gained kills. With the same data, about 46 of 101 members would carry "no kills gained in Kingdom War". Support and farm players are among them, and nobody can be marked away until #298. The owner may want it shown only with an away-note check (#298), or with a minimum.
3. **Away notes do not exist yet.** D75 leaves away members out of comparisons and says "no away note" in the reasons; both wait for `member_facts` (#297, #298).
4. **The week's total misses each day's donations between the 23:37 read and the 00:00 reset** (D72's accepted cost). Exact equality with the game's weekly ranking can fail for members who donate in those 23 minutes. See Next for how to measure.
5. **The unit of `daily_tech`** ("tech points donated today") is assumed equal to the weekly ranking's "Contribution". Both are multiples of 50, and the daily maximum (6,100) times 7 is about the weekly maximum (36,850). The first comparison confirms or refutes it.
6. **`daily_honor`**'s meaning is not documented (the brief: "max 1,000, a cap?"). It is shown as "Day's honor" from the newest read.
7. **Expired session → Home.** The silent re-authorisation returns to `/w/<slug>`, not to the page that asked for it. A `return` parameter on the login route would fix it.
8. **The first-use cookie is per browser**: an officer on a second phone sees the steps again.
9. **Search** matches the name as typed, without case or accents. #297's `nameKey()` (emoji, decorations, confusables) would make "no emoji needed" true for decorated names.
10. **Page weight.** The Members HTML is 1.1 MB raw for 101 members (60 KB gzip, 37 KB brotli). Most of it is the 101 cards, sent twice: as HTML and again in the RSC payload, because they are children of the client list. If phones on slow networks feel it, the cards could render closed, with the details fetched on open. Not changed here.
11. **`next dev` is slow on this page under load**: 5–30 s at a load average of 30–58. The production build answers in about 60 ms, and the two main queries take 0.10–0.29 s in psql under the same load, so this is the dev server's cost.

## Next
Session: #297 (11f) — Workspace: one-time import of the OGs spreadsheets with name to player-id matching, `member_facts`, and the all-IANA time-zone picker.
Model / effort: keep — no signal. This session's scope fit one pass. The only rework was mechanical: two lint limits (the 300-line file limit split the dictionary; complexity 12 split the page's refusal) and two fence tests.
Owner must do first:
1. Release `dev` to production, so the end-of-day reads (D72) start keeping `daily_tech` and `active`. The Members tab is empty ("No end-of-day read yet") until the first 23:37 read after the release.
2. For #296's done_when: after the first full game week of end-of-day reads (Monday to Sunday), take the in-game Donation → Weekly pictures on Sunday between 23:37 and 23:59 server time. Compare each member's week total on `/w/ogs/members` (opened details, exact) with the picture. A member matches when the totals are equal, or when the tab's total is lower only by donations made after 23:37.
3. Decide open issue 2: keep the KvK reason as is, or show it only once away notes exist.

Plan changes needed: none. The workspace track lives in issues #293–#321, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- `member_facts` (#297) plugs into the Members tab at four places:
  1. `MemberRow` and `rowOf` in `lib/private/members.ts`;
  2. `filtersOf` in `app/(private)/w/[slug]/members/page.tsx`, for the "Away" filter: the copywriter's `members.filter.away` is "Away" / "Ausentes" / "Absents";
  3. the card and `statusText`, for the officer-set statuses: prototype keys `status.break` "On a break" / "Em pausa" / "En pause" and `status.help` "Needs help" / "Precisa de ajuda" / "Besoin d'aide";
  4. `sheetRow` and `sheetHeader`, for new spreadsheet columns. `members-sheet.test.ts` fixes the 17 columns; update it on purpose.
- D75 work that waits for away dates:
  - leave away members out of `topOf` (thanks);
  - add "no away note" to `reason.idle` and `reason.kvk` in all three dictionaries;
  - skip the KvK reason for a member away on the event's day.
- `nameKey()` can replace the Members search's `fold` in `app/(private)/_ui/MembersList.tsx`.
- Two-tenant test pattern: `signedIn(slug)` and `endOfDay(unionId, day, members)` in `lib/private/members.test.ts` make a real session and a D72 roster with `raw_json`.
- Fences met in this session:
  - `lib/private/roster-fields.test.ts` refuses the literals `"x"`, `"y"` and `"active"` anywhere in `app/`: name things `activity`, `mapX`;
  - `lib/brand/tokens.test.ts` refuses `#` and 3–6 hex digits in `app/`, comments included: write "issue 312", not the hash form.
- The workspace dictionary is now three files: `dictionary.ts` (en, types, cookies), `dictionary.pt-BR.ts` and `dictionary.fr.ts`. `dictionary.ts` is 190 lines of the 300 allowed (125 English keys); a further split by screen may be needed.
- No migration was added; dev ends at 0019.
- Table reads for the workspace's roster data are in `lib/repo/workspace-rosters.ts`, which takes a union id; `lib/private` passes `access.unionId`.
</adjustments>

<adjustments for="Session #312 (first-use format)">
- The shell is in place: `lib/private/first-use.ts` (`FIRST_USE_STEPS`: title, body keys, `visual`, `target`), `app/(private)/_ui/FirstUse.tsx`, the `lap_ws_intro` cookie, the "?" in the header, and the `intro.*` keys in all three languages.
- Coach-mark targets exist: `[data-tour="members-tab"]` on the tab link and `[data-tour="language"]` on the switch.
- The how-to page is done: `/w/<slug>/how-to`. Done_when "one officer per language finishes the cards on a phone" is still open.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/329
