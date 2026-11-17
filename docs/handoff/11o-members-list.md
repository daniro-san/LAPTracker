# 11o — Members list for 100+ members: filters, orders, frames, Server time / My time

Closes #337. Rules applied: D75, D71, D76, D80, D52, D22, D65, D66, D68 (no charts here). New decision: D98.

## Built
- **The list** (`app/(private)/_ui/MembersList.tsx`, `MembersListParts.tsx`, `MemberListRow.tsx`, `members-list-state.ts`). This is variant A.
  - **Rows:**
    - the photo in its game frame through the public `PlayerAvatar` (`/img/avatar/[uid]`, `/img/frame/[id]`), in a fixed 51 px box;
    - the rank code ("R4") and the name;
    - one number, which follows the order: might, kills, or "48.2M · T10" for main squad;
    - the week's donations.
  - **The second line** appears only when it has something to say. It runs under the numbers, up to two lines. It holds:
    - the status with its evidence;
    - "To ask: …" while Info to ask is on;
    - "14:05 their time", or "20:00 their time at 18:00 ST" while a time filter is on.
  - **The default order:**
    - "Check in and Needs help" comes first, with "What we saw, for a friendly word. Nothing is sent.";
    - its rows count toward the first 25 (review of PR #360);
    - "Everyone else" follows.
  - **Paging:** 25 rows, then "Show 25 more · n left" with "Showing n of total". Focus moves to the first new row. After the last row: "That's everyone."
  - **Sticky block, 113 px at 360 in EN, PT and FR:**
    - the search;
    - "Filters" ("Filters · n" in plum while sheet filters are on);
    - the chips "R4 and R5" and "Info to ask", with counts; a chip at 0 has a dashed border;
    - the column labels.
  - **Count line:** "n of 100 members · Daytime at 18:00 ST · Portuguese · Order: …", then "Clear filters" and "Copy for spreadsheet". Copy takes the shown members in the shown order.
  - **"Not shown: n with no time zone · See who"**, and the same for languages. See who lists exactly those members (`ask=timeZone`, `ask=languages`) and clears that filter.
  - **Empty states:**
    - "No one matches “q”." with Clear search;
    - "No one matches “q” with these filters." with Search everyone;
    - `members.empty` with Clear filters.
- **Filter and order sheet** (`MembersFilters.tsx`):
  - Order: six radios. Main squad is disabled when nobody has one, and says "known for n of total".
  - Who: chips with counts (Everyone, Check in, Needs help, On a break, New).
  - Time: first a native hour select, "At (ST)", reading "18:00 ST" (or "17:00 your time (18:00 ST)" with My time first); then Any time, "Daytime for them · n" and "Night for them · n" at that hour. A help line says "Daytime is 08:00 to 23:00 on their own clock." and "Time zone known for n of total."
  - Language: a native select of the languages someone has, named by `Intl.DisplayNames` in the officer's language, with counts. Before anyone has one: "No languages recorded yet…".
  - Clear filters, and "Show n".
- **Pure functions** (`lib/private/members-list.ts`, browser-safe):
  - `ASK_FACTS` (main squad, troops, AD Tech, time zone, languages) and `factsToAsk`;
  - `whoOf`, `listMember`;
  - `clockAt` (memoised: a zone's minute when the server clock reads hh:00), `isDaytime` (`DAY_FROM` 08:00, `DAY_TO` 23:00);
  - `keepMembers` (with `noZone`), `facetCounts` (each count with every other filter and the search applied, plus 24 counts each for daytime and night);
  - `orderMembers` (`ranked`, `noValue`, `onBreak`), `languagesIn`;
  - `pickQuery` (the address, with old `?f=` links mapped), `pickOrder`, `queryString`, `sheetFilters`.
  - The old `MEMBER_FILTERS`, `filtersOf`, `filterCounts` and `FilterChip.tsx` are removed.
- **State:**
  - The address holds `q`, `r4`, `ask`, `who`, `day`/`night`, `lang` and `order` (`replaceState`). It is written again after a sheet's history entry is taken off.
  - Only the order is remembered: `localStorage` `ws.members.order`, inside try/catch.
- **A member's sheet** (`MemberSheet.tsx`):
  - a native `<dialog>` (the shared `Sheet`, now with an opt-in `backdropCloses`);
  - its header is the large avatar in its frame, the name and the full rank;
  - the card (`MemberCard` in `MemberCards.tsx`: status, numbers including Kills, day cells, details, facts, Edit facts and Paste) is read from **`GET /api/w/[slug]/members/[uid]`** when the sheet opens. That route runs `requireWorkspace`, answers 404 for a uid outside the workspace's alliance, sends `private, no-store` and logs nothing;
  - it reads the card again after the page refreshes (a facts save);
  - Loading, and a failure with Try again.
  - The old `<details>` cards are gone.
- **Sheets and back** (`sheet-history.ts`): opening a sheet pushes one history entry at the same address. The phone's back button closes the sheet. Close, Escape or the backdrop take the entry off again. The list behind keeps its scroll and depth.
- **Data:**
  - `RosterMember.kills` comes from raw_json `kills`. Before the first end-of-day read it comes from the newest roster's `member_kills`.
  - `MemberRow.kills`.
  - Photos, frames and past names: see "Review round" below (`withListExtras`, `photosOf`).
- **Words:**
  - `lib/private/dictionary.members.ts`, `.pt-BR.ts` and `.fr.ts` hold 70 keys per language under `list.*` and `clock.*`. French uses U+00A0 before `:` and `;` and inside « ».
  - Five keys are removed (`members.filter.all|new|checkin|missing`, `members.search.go`).
  - The calendar legend now reads "The other time is your own" (PT "A outra hora é a sua", FR "L'autre heure est la vôtre").
- **Server time / My time** (`YourTime.tsx`):
  - `useClockChoice`, `setClockChoice` (`localStorage` `ws.clock`, inside try/catch; Server time is the default).
  - `TimePair` and `Times` put the chosen clock first; both times always stay on screen.
  - The calendar week, the caravans and the thefts log use them.
  - The switch is "Times: Server time (ST) first / My time first" in the settings sheet (`ProfileSheet.tsx`).
- **Analytics:** `MemberFilter` is now r4, ask, who, daytime, night, language, order_rank, order_might, order_might_asc, order_kills, order_kills_asc and order_squad. No hour, language or text is sent.
- **Docs:** D98, the decisions index, the `members-list.ts` line in `docs/ARCHITECTURE.md`.
- **Tests:** `lib/private/members-list.test.ts` has 7 tests, replacing the 1 it had:
  - Info to ask, including a cleared fact and an empty language list;
  - daytime and night by zone (Paris, São Paulo, Kolkata's half hour), with no time zone counted;
  - filters together, and each count equal to the list it gives;
  - the orders both ways with the "—" and break groups;
  - rank order with the break group;
  - Who;
  - `pickQuery`.
  - Fixtures in `members.test.ts`, `members-sheet.test.ts`, `member-week.test.ts` and `events.test.ts` are updated for the new fields and names.

## Decisions
- **D98** records the shape, filters, orders, state, the details route, kills and the clock switch.
- **"Daytime" is 08:00–22:59 on the member's clock**, and night is the rest, as the owner answered on 2026-11-17. The offset is computed for the server day the page was made on, so a daylight-saving change later that day is not reflected.
- **"—" and On a break groups exist in every order**, the default included. In rank order, "—" means no rank in the read.
- **Search uses `fold`**, as the brief says: accents and case, over current and past names. "zofie" finds Žofie. "lukasz" does not find Łukasz, because `fold` does not change ł (see Open issues).
- **The clock switch reorders, it does not hide.** Times typed in forms stay in ST, and the "Last read" line stays in server time.
- **Copy for spreadsheet keeps its columns** and copies all members kept, in the shown order, not only the rows paged in.

## Deviations
- **No status marks (icons).** Variant A drew a mark per status. The row prints the status word and its evidence instead, in the status tone. Fine has no line.
- **One column at 1280**, not two. The column labels sit in the sticky block and would not line up over two columns.
- **The thanks box is the shipped one**, laid out in two columns with its intro line.

## Verified
- **`pnpm check` exits 0** on the tree merged with dev at f1f7853 (#357, #358): prettier, eslint, tsc; vitest **134 files passed, 2 skipped; 680 tests passed, 4 skipped**; drift gate "Everything's fine"; i18n "17 languages up to date". Before the merge: 133 files, 677 tests.
- **Local e2e, 78 of 78 checks passed**, run twice: on the branch build and again on the merged build.
  - **Setup.** A production build (`next build` + `next start` on :3187). The local Postgres runs on 54417 with its bridge on 54418, migrated through `0025`. The Discord stub runs on 54419 with Ana (R4). Playwright-core drives system Chrome, with Ana's browser in `America/Sao_Paulo`.
  - **Frames.** `LAP_SITE_BASE_URL` points at a local stand-in on 54416 that serves generated ring PNGs, so no call reaches the real site.
  - **Seed.** Invented: 100 members over 16 end-of-day reads (Nov 1–16) of an invented roster, 256 facts, 70 frames, 2 calendar entries. No upstream call, no real Discord call, no `/api/quota`.
  - **Checks:**
    - the heading comes first, with 6 members (5 Check in, 1 Needs help) and its friendly line;
    - 25 rows, then "Show 25 more · 69 left", which adds 25 and moves focus to row 25;
    - images only from `/img/frame/…` and `/img/…`; the page HTML has no `phs-image`, `avatar_url`, `mapX`, `mapY`, `lastOnlineAt` or `last_online_at`;
    - search: "LAETI" finds Laëtitia only, "zofie" finds Žofie, "xyzq" shows the no-match line;
    - R4 and R5: 9; the address holds `r4=1`; Info to ask's count equals the list it gives with R4 on; rows show "To ask:"; a reload keeps both chips; Clear filters shows 100;
    - the Filters sheet adds a history entry. Needs help keeps 1. "18:00 ST · 33" equals the 33 kept. "Filters · 1". Daytime 33 + night 17 + "Not shown" 50 = 100. Language lists 8 languages with counts;
    - back closes the sheet and the address still holds `night=18`. "Night at 18:00 ST" and "their time at 18:00 ST" are shown. See who turns on `ask=1` and drops the time;
    - Might, low to high: the first 10 values go up. "No might in the read · 1" and "On a break · 2" come at the end. The count line names the order;
    - the order is remembered after reopening the tab, and the filters are not. Kills puts "No kills in the read · 2" at the end. Main squad shows "…M · T…";
    - a row opens a sheet that calls the members route once and shows the card with Edit facts. The facts editor opens over it. Back closes a member's sheet, the page stays on Members and the list keeps its depth. A uid outside the alliance gets 404 `private, no-store`;
    - rows show "hh:mm their time";
    - the calendar shows "18:00 ST · 17:00 your time" by default. My time first shows "17:00 your time · 18:00 ST", and this survives a reload. The hour picker shows "17:00 your time (18:00 ST)";
    - EN, PT and FR at 360 and 1280: no sideways scroll; the two chips stay on one line; the sticky block is 113 px at 360; every target in main and in the sheet is at least 44 px at 360;
    - the server log holds no member name, there is no `app_errors` row, and frames came only from the stand-in.
  - The first run failed 6 chip-line checks: the locator also matched the header's language group, and the harness was fixed. Another run failed because a stale `next-server` kept the port after a rebuild; it was restarted.
- **Privacy grep:** every added line of the diff checked against the 100 member names in the OGs fixture roster (`fixtures/v1-20261116T105019Z/alliance-67111155.json`, names of 4+ characters, case folded): **0 found**.
- **Screenshots** (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11o-shots/`. Each of these is at `{360,1280}-{light,dark}-{en,pt-BR}`:
  - `list-top-…` and `list-…` (the heading block);
  - `list-filtered-…` (daytime at 18:00 + Info to ask);
  - `filters-…` and `filters-end-…`;
  - `member-…`;
  - `switch-…` (the settings sheet with My time first);
  - `switch-calendar-mine-…`.
  - Also `*-check.png` from the e2e run.

## Open issues
1. **`fold` does not fold ł, ø, đ, ß, æ, œ, þ**, so "lukasz" does not find "Łukasz". The variants study found the same gap in `nameKey` (`lib/screenshot/name-key.ts`). One letter table would fix both.
2. **A member with no stored event roster row has no photo or frame on the list**, as on the public pages: `photoColumns` reads the frame through the member's newest `member_snapshots` row. A recruit who joined after the last event shows the drawn placeholder until the next event read.
3. **The members route reads the whole Members view** (about 6 queries, no photo read) for one card. Its time on Neon has not been measured.
4. **Info to ask will hold almost everyone in production**: languages are 0/101 until officers fill them (owner's choice). Locally it was 86/100.
5. **Real photos were not seen locally**: `/img/avatar` fetches only the photo host, so the seed has no photos and rows show the drawn placeholder. Frames were checked with the local stand-in only.
6. **Copy for spreadsheet carries no facts, kills or local time** (a follow-up from the filters study).
7. **Thanks follow-ups** from the study: "Top kills in Saturday's KvK" and "Most might gained this week".
8. **The history entry a sheet adds** was tested in desktop Chrome with Next 16's router only, not on a real Android phone.

## Next
Session: the next workspace issue the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The work fit one pass. The rework came from the lint limits (function and file size) and one layout fix found in the screenshots (the second line, the column labels).
Owner must do first: release dev, then open Members on a phone. Check that the back button closes a member's sheet on Android, and that "Info to ask" makes sense with languages counted.
Plan changes needed: none. The workspace track lives in issues, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- List filters and counts: `lib/private/members-list.ts` is browser-safe. `keepMembers`, `facetCounts` and `orderMembers` work on any `ListMember[]`; a roll-call list (#298) can reuse them.
- "Who is up at hh ST": `clockAt(today, SERVER_TZ)(zone, hour)` and `isDaytime` give a member's clock at a server hour. The Elixir windows (09:00, 18:00, 23:00 ST) can count on them.
- Sheets with a back button: `useHistorySheet` (`app/(private)/_ui/sheet-history.ts`), and `Sheet`'s `backdropCloses`.
- Time display: use `Times` or `TimePair` from `YourTime.tsx`, never a fixed "ST · your time" order, so the officer's "My time first" applies.
- A member's card on demand: `GET /api/w/[slug]/members/[uid]` returns `{ card: CardData }`.
- Kills: `MemberRow.kills` is lifetime kills from the newest read.
- Photos for a list of uids: `photosOf(db, uids)` in `lib/queries/photo.ts`; for the Members rows with past names, `withListExtras(db, access, members)`.
- Words: `list.*` and `clock.*` are in `dictionary.members*.ts`. `dictionary.ts` is now about 287 lines.
</adjustments>

## Review round (PR #360, /pr-review and the designer's review)
- **Fixed, code:**
  1. Before the first end-of-day read, Who shows "—" for Check in, Needs help and New (`early` passed to the list).
  2. The page counts Check in with `whoOf`.
  3. `membersView` reads no photos. The list page has its own read, `withListExtras` (photos and frames through `photosOf`, which reuses `photoColumns`; past names through `namesSeen`). The card's words moved to `lib/private/member-card.ts` (with `fact-text.ts`), and `memberCard` is the card route's only call; the route imports nothing from `_ui` and runs no photo query.
  4. `findPhotos` is gone from `lib/repo`.
  5. The search is folded once per call, and each member's names once (a WeakMap per row). The sheet's counts (`sheetCounts`: Who, 48 hours, languages) are made only while the Filters sheet is open; the chips' counts (`chipCounts`) stay live.
  6. The Check in / Needs help rows count toward "Show more"'s 25.
  7. Past names are searched, and a row found by one says "was …".
  8. Tests:
     - the address round trip (`queryString` ↔ `pickQuery`, default order left out);
     - past names;
     - the language "Not shown" count and its "See who";
     - `listRow` (R1–R5, `squadText`, no status line while fine) in `app/(private)/_ui/member-list-data.test.ts`;
     - kills null stays null, and photos, frames and past names with and without, in `lib/private/members-list-read.test.ts` (PGlite). It has its own file because `members.test.ts` would pass the 300-line limit.
  9. One `chipClass`. `langName` is no longer exported, and `Intl.DisplayNames` is kept per language. `members.details`, `members.detailsOf` and `calendar.yours` are out of `LIST_KEYS`, and the first two are out of the dictionaries.
- **Fixed, UX:**
  - 10. "See who" sets "time zone not recorded" (`ask=timeZone`). The pill reads "No time zone · n".
  - 11. The time filter puts the hour first ("At (ST)", options "18:00 ST" or "17:00 your time (18:00 ST)"). The radios read "Daytime for them · n" and "Night for them · n". "Any time" has no number. The help line is "Daytime is 08:00 to 23:00 on their own clock."
  - 12. The status evidence is one line. "was …", "To ask: …" and "hh:mm their time" have their own line, never cut.
  - 13. The Language filter counts members with no languages: "Not shown: n with no languages recorded · See who" (`ask=languages`).
  - 14. The count line names R4 and R5, Info to ask (or its kind), Who, the time, the language and the order.
  - 15. A low-first order shows "Lowest first, to see who may need help growing. Not a ranking.", and Copy then takes the shown members in rank order.
  - 16. The switch reads "My time first (this phone: {zone}, {hh:mm} now)" with "Changes which time comes first in Calendar and the hour picker."
  - 17. The member sheet shows "their time now 22:33" under the time zone.
  - 18. The column labels are 13 px: "Might" and "Week". Screen readers hear "Donated this week".
  - 19. The empty state reads "No one matches these filters." (EN, PT, FR).
- **Left as is, as asked:**
  - no route test for `members/[uid]` (no private route has one);
  - the UID regex copied from the facts route (pre-existing).
- **Verified:**
  - `pnpm check` exits 0: vitest **136 files passed, 2 skipped; 687 tests passed, 4 skipped**; drift gate fine; i18n up to date.
  - The local e2e on a production build of this round passed **91 of 91 checks**. It covers every check from the first round, with these added:
    - the first page is 25 rows with the heading's included;
    - a past name ("pemberly") finds the member and the row says "was Pemberly";
    - the count line names both chips, and names Who;
    - the hour options read "18:00 ST";
    - "Daytime for them · n" equals the list it gives, and "Any time" has no number;
    - See who gives exactly the members with no time zone, with the pill "No time zone · n";
    - the language "Not shown" line and its See who;
    - the low-first line;
    - the switch label with "America/Sao Paulo" and its help line;
    - "their time now" in the sheet;
    - the plain empty state.
  - The seed gained an invented rename ("Pemberly", Nov 1–5) and an invented test event roster, so frames show through `photoColumns`.
  - The "—" Who counts before the first end-of-day read were not run end to end: the Discord stub serves only the OGs guild. The code path is the `early` flag.
- **Screenshots** in the same folder, with the `-v2` suffix, at 360 in light and dark, EN and PT:
  - `list-top-…`, `list-…`, `list-filtered-…`;
  - `filters-…`, `filters-end-…`;
  - `member-…`;
  - `switch-…`, `switch-calendar-mine-…`.

PR: https://github.com/daniro-san/LAPTracker/pull/360
