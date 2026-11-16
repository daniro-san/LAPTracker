# 11e — Members tab and the officers' first-use cards

Closes #296. Part 2 of #312: the first-use cards, in the format the persona panel chose (recorded on #312), and the how-to page. Rules applied: D71, D72, D75, D70, D56, D22, D76, D78. Revised after the review of PR #329: code review items A1–A10, the UX review's should-fix list B1–B12, and the cheap suggestions.

## Built
- **`/w/[slug]/members`** (`app/(private)/w/[slug]/members/page.tsx`):
  - `requireWorkspace` runs first, inside `withPageDb`, then `membersView`.
  - A refused visitor goes through `refuse(slug, reason)` (`app/(private)/_ui/refuse.ts`, shared with `/w/[slug]`): a 404, the silent Discord re-authorisation, or `no-access?why=blocked`. A visitor who is signed out goes to the sign-in.
  - Header:
    - "From the game, read each night just before the server resets." with a **"from the game" source badge** (`SourceBadge.tsx`);
    - "Last read: <day> <hh:mm> server time";
    - "Week: <Mon> – <Sun>".
    - No date ends a sentence, so PT and FR never print "nov..".
  - **Thanks first**: "Thank you this week", the top 3 donors (week total) and the top 3 most active (weekly activity), one name per line with the number on the right. New members are left out. The section is hidden when both lists are empty.
  - **"N people to check in with"**: a link to `?f=checkin`, in the singular or plural form (`Intl.PluralRules`). It reads "Everyone looks fine this week." when nobody has a reason.
  - **One short legend line** ("Check in shows what we saw. — means no data.") and a **"More"** that unfolds three lines:
    - what Check in means: "You decide what to do; nothing is sent or changed by itself.";
    - "— means no data. It is left out of every count.";
    - the Monday-to-Sunday week.
  - **The filters and the search run on the server**:
    - a GET form with `?q=` (accents and case folded) and a Search button;
    - the chips are links with `?f=`: **All · New · Check in · Missing info · R4 and R5**, each with its count ("Check in 4"). They wrap into rows, with no hidden overflow, and the open one has `aria-current`.
  - Then the count ("9 of 101 members"), **Copy for spreadsheet** (the members shown, made on the server), and the cards: one column below 640 px, two from 640 px. **In every filter, Check in cards come first**, then R5 … R1, then might.
- **The card**: `member-card-data.ts` makes each card's words on the server: every number and date, in the officer's language. `MemberCards.tsx` (client) lays them out, so the card markup is sent once. Each card is a native `<details>`; nothing is hover-only.
  - The summary shows:
    - the name and the rank as the game shows it ("R4 · Goddess", D56's `roleOf`), both `translate="no"`;
    - Sanctuary, Might, Donations and Activity, each as one unbroken item that wraps whole. Compact numbers use D78's shared formatter: "64.4M", "64,4M".
    - **one status**, in this order of precedence:
      - **Check in** (yarn) with each reason and its evidence;
      - **New** with "first seen <date>";
      - **No data: …** listing what is missing;
      - **Fine** (muted, no colour).

      So "Fine" and "No data" never appear together.
    - "Details ▾", whose screen-reader name is "Details, <name>".
  - The details are drawn only when the card is opened:
    - the donations per server day, Mon … Sun, as exact numbers. Each cell holds three lines: weekday, day, value. "—" is no data and a blank cell is not read yet. The cells are equal in height in every language;
    - the week's exact total, the activity, and the day's honor (`daily_honor`);
    - Seen since and the map position (`x`, `y`);
    - Joined (`joined_at`) and Last online (`last_online_at`), only while at least one member has a value. The game has sent both as null for everyone since 2026-11-16.
  - `online` is not shown (D71: hidden while the API leaves it empty). `avatar_url` is never selected.
- **The read** (`lib/private/members.ts`, `membersView(db, access, now)`): every read is filtered by `access.unionId`.
  - The rows come from the newest end-of-day read with `raw_json`.
  - Check-in reasons:
    - **offline proxy**: `idleRun`, at 2 full days (3 end-of-day reads);
    - **might unchanged**: D70's `mightUnchanged(db, unionId).unchanged`.
  - **The KvK reason is held** (`KVK_REASON_ON = false` in `member-week.ts`). The read (`scheduledEventKills`), `killsGained` and their test stay; `membersView` neither reads the event nor adds the reason until away notes exist (#297/#298).
- **Pure modules**:
  - `lib/private/member-week.ts`: `gameWeek`, `weekDonations`, `weekTotal`, `idleRun`, `isNewMember` (`NEW_MEMBER_DAYS` imported from D70's module), `missingOf`, `topOf`, the one `DAY_MS`;
  - `lib/private/members-list.ts`: `MEMBER_FILTERS`, `filtersOf`, `pickFilter`, `keepMembers`, `filterCounts`, `fold`;
  - `lib/private/members-sheet.ts`: `statusOf`, `statusText`, `missingText`, `reasonText`, `plural`, one `dayLabel` for the card and the sheet header, `sheetHeader`, `sheetRow`.
- **Copy for spreadsheet**: 17 columns: Name, Rank, Might, Sanctuary, the 7 days, Week total, Activity this week, Day's honor, Joined, Seen since, Status (with the reasons).
  - Numbers are plain integers; a cell with no data is empty, as in the member-history copy.
  - A name that starts with `= + − @` gets a leading apostrophe.
  - **Joined is the server day** (SERVER_TZ, `serverDay`), as on the card.
  - Left out: map position, online, last online, the photo (D71).
- **Table reads** (`lib/repo/workspace-rosters.ts`):
  - `endOfDayReads`: members projected in SQL to the 13 keys the tab uses. **A member without a numeric uid is dropped**, not read as member 0;
  - `firstSeenDays`: its comment notes the growth, one roster per day;
  - `scheduledEventKills`.
- **Cookies** (`lib/private/cookies.ts`): `WORKSPACE_LANG_COOKIE` and `WORKSPACE_INTRO_COOKIE`. No client component imports the dictionary module any more; `LanguageSwitch`, `FirstUse` and `first-use.ts` take only its types.
- **Copy button** (`CopyButton.tsx`, client): used by Members and the how-to page. Its 2.5 s timer is kept in a ref, cleared before a new one and on unmount.
- **Tabs**: Home and Members are links, and the open one has `aria-current="page"`. Roll call, Calendar and Follow-up are faded and say "soon" under the label. PT's Follow-up is now **"Acompanhar"**. `SignedInFrame` (`Frame.tsx`) is the signed-in shell for both pages. Home's placeholder links to Members.
- **First-use cards** (issue #312 part 2, the persona panel's format A, trimmed): three static cards. They are data, in `FIRST_USE_STEPS` (`lib/private/first-use.ts`): a title, paragraphs, and an optional visual (`"only"`, `"sources"`).
  1. **"Welcome to the Officers' Desk"**: the leadership's own place, filled in from the game, which replaces the spreadsheets. It carries an **"R4 · R5 only"** badge.
  2. **"Where the numbers come from"**: the three source labels, drawn as the badges the Members page shows, and "— means no data, and it is left out of every count."
  3. **"Each week"**: open Members, start with the thanks, look at Check in. "You decide what to do; nothing is sent by itself." It ends with "Tap EN · PT · FR to switch. Tap ? to see this again."

  `FirstUse.tsx`:
  - **The first visit** shows the blocking sheet (`Sheet`), one card at a time, while the `lap_ws_intro` cookie is absent. Skip (cards 1–2), Start (card 3) and Escape all close it and set the cookie. Back and Next move between cards.
  - **"?"** opens the same three cards together in a **bottom sheet that does not block the page**:
    - it is a `role="dialog"` with `aria-modal="false"`, no backdrop, at most 55 % of the screen high, and scrolls;
    - **Replay** walks the cards again from card 1, and Close or Escape closes it;
    - the page behind stays usable: the language switch works and the sheet follows the language.
  - Every control is at least 44 px tall (`min-h-11` and padding).
  - No motion, no coach marks, no per-tab tips. The panel dropped them, and they are not built.
- **How-to page** `/w/[slug]/how-to` (reads nothing, opens before sign-in). It has three steps:
  1. open the address: a tap-to-open link, a **Copy the address** button, and "Open it in Safari or Chrome, not inside Discord.";
  2. sign in with Discord, then **"Can't get in? Ask an R5 on Discord."**;
  3. add it to the home screen. **On iPhone**: the Share icon (a square with an arrow pointing up), then the item with a + in a square. **On Android**: ⋮, then the item with a phone and an arrow. The steps name the icons, not the menu items, because the localized menu names are unverified.

  Then an "Open the Officers' Desk" button. The address comes from the request's Host and `x-forwarded-proto`. The login route builds Discord's redirect address from the same headers (`new URL(request.url).origin`).
- **Words**:
  - 115 new keys (28 → 143 per language) in en, pt-BR and fr;
  - `home.next` and `tab.review` (pt) rewritten;
  - plural forms (`.one` / `.other`) for the might and offline reasons, missing donation days and the check-in count;
  - French has a no-break space before `: ? !` and inside « ».
  - pt-BR and fr are in `dictionary.pt-BR.ts` and `dictionary.fr.ts`; `dictionary.ts` holds en and the types.
- **D75**: the offline proxy now reads "unchanged over 2 full days, i.e. across 3 consecutive end-of-day reads", with the amendment noted.
- `docs/ARCHITECTURE.md`: the new `lib/private` modules and `lib/repo/workspace-rosters.ts`.
- Tests:
  - `member-week.test.ts`: 4 tests;
  - `members.test.ts` (PGlite): 5 tests;
  - `members-sheet.test.ts`: 3 tests;
  - `members-list.test.ts`: 1 test.

## Decisions
- **Game week = Monday to Sunday, server days.** Weekly activity resets on Monday (D75: "ignoring the Monday reset"), and prototype v5 says "A week here runs from Monday to Sunday, like the game's".
- **The week shown is the game week of the newest end-of-day read.** On Monday before 23:37 server time that is last week, complete, which is when officers do the weekly check. Days after the newest read are blank ("not read yet"), not "—".
- **An end-of-day read** is a usable daily roster (fresh, no error, not empty) with `raw_json`. Rosters from before D72 count only for "first seen" and D70.
- **Offline proxy: 2 full days = 3 consecutive end-of-day reads** with `active` and `daily_tech` unchanged (`IDLE_STEPS = 2`), the owner's "offline for more than 2 days". D75 now says so.
  - On a Monday the activity is compared with 0.
  - A null, or a day without a read, ends the run.
  - Evidence: "activity 87 and donations 0 unchanged for 2 days (3 end-of-day reads in a row)".
- **New member**: first seen after the alliance's oldest usable daily roster, and less than D70's `NEW_MEMBER_DAYS` (14, imported) before the newest read. A member in the oldest roster predates the records.
  - New members are left out of the thanks.
  - The reasons still apply to them, because neither is a comparison; D70 keeps them out of "might unchanged".
- **One status per card**: Check in, else New, else No data, else Fine. "No data" names the missing fields and the days without donations. It explains the "—" in the card and why the member is in "Missing info".
- **Check in first in every list.** It is one stable order, so the cards do not move between filters.
- **Server-side filters and search** (`?f=`, `?q=`), as the review recommended. They work without JavaScript, and "N people to check in with" is a plain link. The counts on the chips ignore the search.
- **Card markup sent once.** In the App Router, everything a server component renders appears twice in the response: as HTML and again in the inlined RSC payload. Server-rendered cards would therefore still ship twice. Instead:
  - the server sends each card's words as data;
  - a client list renders the summary, which appears in the HTML only;
  - the client list draws the details only when a card is opened.
- **Numbers**: compact on the card and in the thanks, with D78's shared formatter (`app/_ui/format.ts` `compact`). D78 puts no space before the unit, so PT shows "64,4M" and "25,7K". Exact numbers appear in the opened details and in the copy.
- **Rank** reads "R4 · <title>" with the game's titles: "R4 · Goddess" for Overseer, "R4 · God of War" for Militarist.
- **Map position is shown** in the details (D71 lists `x`, `y`). The scrubbed fixtures make it "X 0 · Y 0" in the screenshots.
- **The how-to is an in-app page, not a docs file.** Docs are English-only by CLAUDE.md, while the workspace copy is trilingual by D71. One pinned link serves each reader in their language.
- **"Seen" for the first-use steps is a cookie** (`lap_ws_intro=1`, one year, per browser).
- `raw_json` is projected in SQL, so `lib/private` never holds `avatar_url`.

## Deviations
- **The KvK "no kills gained" reason is held.** D75 asks for "zero kills in a KvK with no away note recorded", and away notes do not exist until #297/#298. With KvK 2026-11-14's figures (#271: 54 % of OGs gained kills), about 46 of 101 members would get Check in. The code and its test stay behind `KVK_REASON_ON`; switch it on together with the away-note check.
- **No "Low donations" filter** (#296 lists it). D75 and the owner say donations are never punitive. No median or "typical week" is shown either.
- **No "Away" filter** (#296 lists it). It waits for away notes (#297, `member_facts`).
- The issue's "missing data" filter uses the copywriter's label "Missing info".
- **Statuses**: computed only. Check in and Fine are D75's; New and No data are display states. On a break and Needs help are officer-set and arrive with #297.
- **A name search** was added. It is in the approved prototype v5.
- **Thanks**: top donors and most active only. "Most improved" and event MVPs are not built.
- **First-use**: three cards instead of the four the issue lists: the persona panel folded the language card into card 3's last line. The setup steps (address, sign-in, home screen) live on the how-to page, not in the cards.
- **Analytics events are not wired.** PR #332 (PostHog, D77) was still open: `ws_first_use_done`, `ws_first_use_skipped`, `ws_copy_spreadsheet` and `ws_filter_used` are left for the coordinator to wire after both merge. The places are listed under Next.
- **An expired session on `/members`** re-authorises and lands on Home; the login route has no return path.
- Copy for spreadsheet leaves no-data cells empty (as `rosterTsv` does), not "—".
- **D78 has no space before the unit**, so PT and FR show "25,3K", not the "25,3 K" in the UX review's example. The review asked for the shared formatter, and this is its output.
- A card's details need JavaScript (they are drawn on open). The summary, the filters, the search and the copy text are server-made.

## Verified
- **lv = Sanctuary**: on 2026-11-16 the OGs sheet's Sanctuary column equalled the API `lv` for 30 members. For the other 50 the API was 1–2 levels higher, never lower, because the sheet was stale (orchestrator's sheet analysis).
- **`pnpm check` green** after merging `origin/dev` at d9c2cc3 (D78):
  - prettier, eslint, tsc;
  - vitest: **90 files passed, 2 skipped; 471 tests passed, 4 skipped**;
  - drift gate: "Everything's fine";
  - i18n: 17 languages up to date.
  - Earlier rounds: 77 files and 372 tests passed before the first merge; 88 files and 461 tests passed after it.
- Tests, one per behaviour:
  - **week sum** on a synthetic week: the previous Sunday is not counted; a null day and a day without a read are `null`; later days are `"later"`; the total is 650;
  - **offline proxy**: 3 unchanged reads across Monday's reset give `{ days: 3 }`. There is no reason when the member was active on Monday, when Monday's value is unknown, after one day, or across a missing day;
  - **`missingOf`**: nothing missing; null might, Sanctuary and activity with two days without donations give all four fields and 2 days;
  - **new members and the thanks**;
  - **two tenants, a player who moved (D71)**: OGs sees days 1–2 only, NSE sees days 3–4 only, and the view holds no "avatar";
  - **KvK, held**: `scheduledEventKills` finds Saturday's event; `killsGained` gives 0, 50 and unknown for the three members; `KVK_REASON_ON` is false and `membersView` gives no reason;
  - **might unchanged**: 16 daily reads give D70's "15 days";
  - **a member without a uid** (missing, or null) is left out instead of becoming member 0;
  - **R4 title**: "R4 · Overseer" reads "R4 · Goddess", "R4 · Diplomat" stays, a bare R4 reads "R4", R5 reads "R5", and no rank is null;
  - **the R4 and R5 filter** keeps 105 and 104, and neither 103 nor a member without a rank;
  - **copy**: the 17 headers and cells, the formula-safe name, no map position or last-online date;
  - **Joined in the copy**: 01:30 UTC on the 10th is the server day 2026-11-09;
  - **the idle reason text**: "activity 87 and donations 0 unchanged for 2 days (3 end-of-day reads in a row)".
- **Local e2e** against a production build (`next build` + `next start`) of this tree. Setup:
  - the local database (54327) and its bridge (54328);
  - a worktree-only `.env.local`: random secrets, never printed; upstream pointed at a dead local port;
  - 11c's Discord stub (54377);
  - Playwright-core and system Chrome on `http://localhost`;
  - no upstream call and no Discord call.

  The seed (`scratchpad/11e/seed.mjs`) builds 17 OGs daily rosters from the scrubbed fixture `fixtures/v1-20261116T105019Z/alliance-67111155.json`: 8 without `raw_json` and 9 end-of-day reads. It also adds a Saturday event, and synthetic week counters so that every state shows.

  **All 66 checks passed**:
  - sign-in and the first-use cards:
    - signed out, `/members` shows the sign-in;
    - each of the 3 cards says "n of 3" and the panel's words: "R4 · R5 only"; the source badge and "— means no data"; "nothing is sent by itself" and the EN · PT · FR / ? line;
    - every control on each card is at least 44 × 44 px;
    - Start sets the cookie, the cards stay closed after a reload, and Escape on a first visit closes them and sets the cookie;
    - "?" shows the three cards in one sheet with `aria-modal="false"` and no open modal dialog;
    - with that sheet open, the header's language switch works and the sheet turns Portuguese;
    - Replay starts at "1 of 3", and Skip closes;
    - in PT and FR, no card has "..";
  - the three faded tabs say "soon"; Members has `aria-current`;
  - layout:
    - no sideways scroll at 360, 640 and 1280 px, in light and dark, and in PT and FR;
    - every control in main, the header and the tabs is at least 44 px at 360 px;
  - words:
    - none of "flagged", "warned", "violation", "to remove", "never removes" or "never counts";
    - the source badge is present;
    - no ".." in EN, PT or FR, and no "1 days";
    - PT and FR show "M" and "K" (D78);
  - order and status:
    - the thanks come before the list;
    - the chips carry counts and wrap with nothing hidden;
    - no card shows Fine and No data together;
    - the first card in All is a Check in card;
  - links and forms:
    - the check-in line opens `?f=checkin`;
    - every chip opens its filter;
    - the search form finds "ladyli" (1 of 101);
  - copy: with R4 and R5 on, it holds a header and 9 lines of 17 columns, with no map position, online or photo;
  - card details: not drawn before opening; the 7 day cells have one height in EN, PT and FR;
  - how-to page:
    - the address as a link, a Copy button, and "not inside Discord";
    - "Can't get in? Ask an R5 on Discord.";
    - the three steps with iPhone and Android, naming the Share icon and ⋮, and not "Add to Home Screen";
    - every control at least 44 px.

  Counts with the seed:
  - All 101 · New 3 · Check in 4 · Missing info 32 · R4 and R5 9;
  - Check in 4: 2 with might unchanged for 16 days, and 2 with activity and donations unchanged for 2 days. The KvK reason is held.
- **Page size**, Members with All on, signed in, production build:
  - **raw HTML 347,883 bytes** (before: 1,112,453): gzip 39,892 (before 60,343), brotli 27,681–27,719 (before about 36,500);
  - `cache-control: private, no-store`;
  - first byte 35–62 ms and load 125–199 ms at a machine load average of about 20. A run at a load of 45–50 gave first bytes of 233–1,003 ms for the same page, so the spread follows the machine's load.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11e-shots/v2/`:
  - members at 360, 640 and 1280 px, light and dark;
  - an opened Check in card, light and dark;
  - PT and FR at 360 px, with full-page captures;
  - first-use cards 1–3 at 360 px in EN, PT and FR, card 2 in dark, card 1 at 1280 px;
  - the "?" sheet at 360 px light and dark, at 1280 px, and in PT and FR;
  - the how-to page in en, pt-BR and fr.
- **done_when** ("the week's donation totals match the in-game Donation → Weekly ranking for ≥ 90 % of members") **cannot be measured before the release**:
  - The end-of-day reads that keep `daily_tech` (D72) are not in production.
  - No stored data holds per-member `daily_tech` for the week of pictures 22–25, and the production history API returns only uid, name, power and kills.
  - So the OCR text of pictures 22–25 has nothing to be compared with. How to measure after the release is under Next.

## Open issues
1. **Per-tab one-line tips** (the panel's format D) come with Calendar (#300) and Notices (#304), not before. #312's done_when, "one officer per language finishes the cards on a phone without asking anyone", is for the owner to check after the release.
2. **Away notes** (#297, #298) unlock three things:
   - the held KvK reason (switch `KVK_REASON_ON`);
   - "no away note" in the reasons;
   - leaving away members out of the thanks.
3. **The week's total misses the donations made between the 23:37 read and the 00:00 reset** (D72's accepted cost).
4. **The unit of `daily_tech`** is assumed equal to the weekly ranking's "Contribution". Both are multiples of 50; the first comparison confirms or refutes it.
5. **`daily_honor`**'s meaning is not documented; it is shown as "Day's honor".
6. **An expired session lands on Home**, not on the page that asked for it.
7. **The first-use cookie is per browser.**
8. **Search** folds case and accents only. #297's `nameKey()` would cover emoji, decorations and confusables.
9. **`firstSeenDays` reads every roster of the alliance** on each request, about 100 uids per day of history. Bound it or keep the result if it shows in timings.
10. **Not built (UX review nice-to-haves):**
    - denser one-line cards;
    - 3 columns or a table at 1280 px;
    - a thanks row that is not volume-based (might gained, event results).
11. **`next dev` is slow on this page under load** (5–30 s); the production build is not.
12. **The how-to address** shows `laptracker-inky.vercel.app` in production only if Vercel passes that Host, as the sign-in's redirect address already requires. It has not been checked on a deployment: Vercel previews are SSO-only, and nothing is deployed from this branch.

## Next
Session: #297 (11f) — Workspace: one-time import of the OGs spreadsheets with name to player-id matching, `member_facts`, and the all-IANA time-zone picker.
Model / effort: keep — no signal. The review round was mechanical; the one design change (server-side filters, cards as data) fit one pass.
Owner must do first:
1. Release `dev` to production, so the end-of-day reads (D72) start keeping `daily_tech` and `active`. The Members tab reads "No end-of-day read yet" until the first 23:37 read after the release.
2. For #296's done_when:
   - after the first full game week of end-of-day reads (Monday to Sunday), take the in-game Donation → Weekly pictures on Sunday between 23:37 and 23:59 server time;
   - compare each member's week total on `/w/ogs/members` (opened details, exact) with the picture;
   - a member matches when the totals are equal, or when the tab's total is lower only by donations made after 23:37.
3. Decide when the held KvK reason comes back: with the away-note check of #298, or with a minimum.
4. After the release, check #312's done_when: one officer per language finishes the cards on a phone.

Plan changes needed: none. The workspace track lives in issues #293–#321, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- `member_facts` (#297) plugs into the Members tab at four places:
  1. `MemberRow` and `rowOf` in `lib/private/members.ts`;
  2. `MEMBER_FILTERS` and `filtersOf` in `lib/private/members-list.ts`, for the "Away" filter. The copywriter's `members.filter.away` is "Away" / "Ausentes" / "Absents". The chips, counts and links follow by themselves;
  3. `statusOf` and `statusText` in `lib/private/members-sheet.ts`, for the officer-set statuses. The prototype keys are `status.break` ("On a break" / "Em pausa" / "En pause") and `status.help` ("Needs help" / "Precisa de ajuda" / "Besoin d'aide"). The card's tone map is in `MemberCards.tsx`;
  4. `sheetRow` and `sheetHeader`, for new spreadsheet columns. `members-sheet.test.ts` fixes the 17 columns.
- D75 work that waits for away dates:
  - turn on `KVK_REASON_ON` in `lib/private/member-week.ts`, with a check that the member has no away note on the event's day;
  - add "no away note" to `reason.idle.*` and `reason.kvk` in all three dictionaries;
  - leave away members out of `topOf`.
- `nameKey()` can replace `fold` in `lib/private/members-list.ts` (the server-side search).
- Card words are made on the server in `app/(private)/_ui/member-card-data.ts`. A new card line belongs there, with its dictionary keys, and `MemberCards.tsx` only lays it out. Keep numbers and dates out of the client, to avoid hydration differences between Node's and Chrome's `Intl`.
- Counted phrases use `plural(t, key, n, f)` with `.one` / `.other` keys.
- Two-tenant test pattern: `signedIn(slug)` and `endOfDay(unionId, day, members, extra)` in `lib/private/members.test.ts`.
- Fences:
  - `lib/private/roster-fields.test.ts` refuses the literals `"x"`, `"y"` and `"active"` anywhere in `app/`;
  - `lib/brand/tokens.test.ts` refuses `#` followed by 3–6 hex digits in `app/` comments: write "issue 312".
- The cookie names are in `lib/private/cookies.ts`. Client components import only types from the dictionary module.
- `dictionary.ts` is 200 lines of the 300 allowed (143 English keys).
- No migration was added; dev ends at 0019.
- Analytics (after PR #332, D77, merges): the four events go in these places:
  - `ws_first_use_done` and `ws_first_use_skipped`: in `Cards` in `app/(private)/_ui/FirstUse.tsx`. Start calls `onClose` from the last card; Skip and Escape call it from the others.
  - `ws_copy_spreadsheet`: in `CopyButton.tsx`, on success, from the Members page only (the how-to page uses the same button).
  - `ws_filter_used`: the chips are server links (`?f=`), so log it where the page reads `pickFilter(search.f)` or from a click on the chip.
</adjustments>

<adjustments for="Session #300 and Session #304 (per-tab tips)">
- The persona panel (#312) chose one-line per-tab tips for Calendar and Notices only, shipped with those tabs. Add them as data beside `FIRST_USE_STEPS` (`lib/private/first-use.ts`), and add a line to the "?" sheet in `FirstUse.tsx`. There are no coach marks: the panel dropped them.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/329
