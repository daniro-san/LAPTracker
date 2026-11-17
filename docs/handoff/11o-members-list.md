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
    - it is never paged;
    - "Everyone else" follows.
  - **Paging:** 25 rows, then "Show 25 more · n left" with "Showing n of total". Focus moves to the first new row. After the last row: "That's everyone."
  - **Sticky block, 113 px at 360 in EN, PT and FR:**
    - the search;
    - "Filters" ("Filters · n" in plum while sheet filters are on);
    - the chips "R4 and R5" and "Info to ask", with counts; a chip at 0 has a dashed border;
    - the column labels.
  - **Count line:** "n of 100 members · Daytime at 18:00 ST · Portuguese · Order: …", then "Clear filters" and "Copy for spreadsheet". Copy takes the shown members in the shown order.
  - **"Not shown: n with no time zone · See who".** See who turns on Info to ask and clears the time filter.
  - **Empty states:**
    - "No one matches “q”." with Clear search;
    - "No one matches “q” with these filters." with Search everyone;
    - `members.empty` with Clear filters.
- **Filter and order sheet** (`MembersFilters.tsx`):
  - Order: six radios. Main squad is disabled when nobody has one, and says "known for n of total".
  - Who: chips with counts (Everyone, Check in, Needs help, On a break, New).
  - Time: Any time, Daytime for them at, Night for them at, each with its count at the chosen hour. A native hour select reads "18:00 ST · 33", or "17:00 your time (18:00 ST) · 33" with My time first. A help line says "Daytime is 08:00–22:59 on their own clock; night is the rest." and "Time zone known for n of total."
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
  - `MemberRow.kills` and `MemberRow.photo`.
  - `findPhotos(db, uids)` in `lib/repo/alliance-snapshots.ts` returns, per uid, whether the newest member row has a photo (a boolean) and the current frame from `player_frames`. No URL leaves the function.
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
- **Search uses `fold`**, as the brief says: accents and case. "zofie" finds Žofie. "lukasz" does not find Łukasz, because `fold` does not change ł (see Open issues).
- **The clock switch reorders, it does not hide.** Times typed in forms stay in ST, and the "Last read" line stays in server time.
- **Copy for spreadsheet keeps its columns** and copies all members kept, in the shown order, not only the rows paged in.

## Deviations
- **No status marks (icons).** Variant A drew a mark per status. The row prints the status word and its evidence instead, in the status tone. Fine has no line.
- **One column at 1280**, not two. The column labels sit in the sticky block and would not line up over two columns.
- **Past names are not searched.** The issue asked for it; the brief named `fold` over the loaded rows. `namesSeen` in `lib/repo/workspace-any-roster.ts` already returns them.
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
2. **Past names are not in the search** (see Deviations).
3. **The members route reads the whole Members view** (about 6 queries) for one card. Its time on Neon has not been measured.
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
- Photos for a list of uids: `findPhotos(db, uids)`.
- Words: `list.*` and `clock.*` are in `dictionary.members*.ts`. `dictionary.ts` is now about 287 lines.
</adjustments>

PR: (added by the orchestrator)
