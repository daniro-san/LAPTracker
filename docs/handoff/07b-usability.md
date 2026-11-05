# 07b — Usability and language-light pass

## Built
- `lib/copy.ts` — every user-facing string under stable keys (`site`, `ledger`, `time`, `status`, `fresh`, `legend`, `members`, `search`, `errors`, `empty`, `admin`, `brand`); `fill()` for `{placeholders}`; `blankCopy()` / `blankDictionary()` and the dev-only switch `NEXT_PUBLIC_BLANK_COPY=1`.
- `lib/copy-brand.ts` (the former `copy.brand`, ≈ 220 lines) and `lib/copy-admin.ts` (every admin string), re-exported as `copy.brand` / `copy.admin`; one import path.
- `lib/copy.test.ts` — parses every `.tsx` under `app/` with the TypeScript compiler API and fails on an element's text (JSX text and `{"…"}` children joined, so `Showing {n} of {m} members` counts as one sentence) or a string prop of more than two words; skips `className`, `href`, `key`, `id`, `type`, `name`, `inputMode`. Plus one test for blank mode and one for the game terms it keeps.
- `lib/compute.ts` — `rankBy` (competition ranking, highest first, nulls unranked) and `rankDelta` (positive = up, null without both ranks); one test each in `lib/compute.test.ts`.
- `lib/queries/ranks.ts` — `eventRanks(db, eventId)` (ledger rank by might and kills per snapshot) and `historyRanks(db)` (per event, over every alliance's reference row). `lib/queries/events.ts` serves `serverRank`; `allianceHistory` adds `ledger`; `playerHistory` / `searchPlayers` sightings add `rank` (in-alliance might and kills rank, a correlated count over the same alliance snapshot); `getEventPage` adds `ranks`; `lib/queries/admin.ts` adds `quotaRemainingAfter` to `listRuns` and `latestQuota()`.
- `app/_ui/locale.ts` (`pickLocale`, `requestLocale`, `requestClock` from `Accept-Language` and `SERVER_TZ`), `app/_ui/LocaleProvider.tsx` (client context), `app/layout.tsx` wraps the page in it.
- `app/_ui/format.ts` — `Intl` number formats per locale (cached), `percentText`, `allianceLabel` (`[TAG] Name`), `rowAnchor`, `joinedText` / `leftText` / `membersLostText` / `changeText`, `makeClock` (day, weekday, long date, `16:01 server`); `utcStamp` kept for admin.
- `app/_ui/Num.tsx` — client; `Num`, `Delta` (zero shows `= 0`), `RankMove` (`▲k` / `▼k` / `=` / `—`), `Rank` (`#n` + move).
- `app/_ui/StatTable.tsx` — one row shape: `rank`, picture, `[TAG] Name` / name / date in Alegreya Sans, hairline under the title row, metric lines `LABEL · value · change`, `from → value` instead of "Before event:", a framed "Details ▾" control, `anchor` id and the `data-mine` tint; `LABEL` exported.
- `app/_ui/Status.tsx` — status chips from copy with `Intl` dates in server time (no error lines, no "partly done" sentence), `FreshDots` (● Fresh / ○ Stale / ✗ Failed / – No data), `FreshnessDetail` (Before / After with mark and time), `Legend`, `BeforeMark`.
- `app/_ui/DetailLines.tsx` (`DetailLine`, `RankLine`), `app/_ui/Breadcrumbs.tsx`, `app/_ui/MyAlliance.tsx` (`MyAllianceToggle`, `MyAllianceJump`; `localStorage` key `lap.myAlliance`, try/catch).
- `app/_ui/EventView.tsx` — title band "Server 325 · Saturday Ledger" + byline under the header, the event's long date, status chips, legend, my-alliance jump, cards by ledger rank, Details panel (ranks might / kills / server before → after, values before → after with the kills member-loss note, freshness, name history), "Game board" section without its sentence.
- `app/_ui/event-rows.ts` — order by current ledger rank by might; Might, Kills, Members; rank pairs; members note only when people both joined and left; kills note moved to Details.
- `app/_ui/SiteHeader.tsx` — magnifier + "Players" (search), selector dates via the request's clock (passed in; the header stays synchronous because `error.tsx` is a client component).
- Alliance page — breadcrumbs `Ledger · Sat, Oct 31 › [TAG] Name`, title on its own line (no mid-word break), Exact numbers + My alliance toggles below it, legend, name timeline, ranked totals card with Details, members with in-alliance rank, Across events with ledger rank movement and a Details panel (might, kills, server rank).
- `app/_ui/MembersExplorer.tsx`, `app/_ui/member-views.ts` — copy, in-alliance might rank before → after, `n / total`.
- `app/_ui/AcrossEvents.tsx`, `app/_ui/PlayerAcrossEvents.tsx` — rank and movement event over event, `Name: Old → New`, `B` mark (explained by the legend, no tooltip), "since Oct 24" for the second change, Details with ranks (and freshness for players).
- Player page — breadcrumbs `Ledger › [badge][TAG] Name › Player`, legend, Names / Alliances timelines with `[TAG] Name` and dates.
- Search page — copy, `[TAG] Name · SEEN Oct 31`, `was X` for an earlier-name match, no hint sentence.
- `app/_ui/EmptyEvents.tsx` — the extra sentence removed.
- Admin pages and components — strings to `copy.admin`; "Data requests" section on `/admin` (requests left after the newest run) and `N requests left` on each run in `/admin/runs`.
- Docs: `docs/DESIGN.md` (status-strip wording, `Intl` and server-time rule, the text hierarchy table in "Typography", components `legend`, `rank`, `breadcrumbs`, `my-alliance`, the simple card + Details), `docs/DECISIONS.md` D23, `docs/GLOSSARY.md` (ledger rank, server rank, rank movement, copy / blank dictionary), `.env.example` (`NEXT_PUBLIC_BLANK_COPY`).
- Screenshots: `docs/screenshots/07b-{main,alliance,player,search}-{360,390,1280}-{light,dark}.png` (24, cut at 3,000 px tall); blank baseline `07b-blank-{main,alliance,player}-390-NN.png` (final) and `07b-blank-r1-*` (before the persona fixes), 390 px tiles of 1,300 px.

## Decisions
- **Server time everywhere public**, with the word "server"; the status chips moved from UTC to server time so the page has one clock (DESIGN.md "Server time stays explicit"; the owner dropped the UTC twin). `/admin` stays UTC.
- **The `Start 12:00` line is gone** from the main page: all three personas in round 1 took it for the time of the numbers. The event is always 12:00 server time (GLOSSARY "event"); the long date heading stays.
- **Title band on the main page only.** Alliance and player pages start with breadcrumbs whose root is "Ledger"; repeating the band there would push the data below the fold at 360 px.
- **"Search in the header"** is the magnifier + "Players" link to `/players`; a search field does not fit the 360 px header.
- **Main order = current ledger rank by might** (after snapshot, else before); ties by tag. Rank movement and every rank pair show only when both snapshots of that alliance are fresh and not failed (same rule as deltas); players' rank moves only within one alliance.
- **Details panel carries kills rank and server rank** (before → after); the card shows the might rank only. The owner asked for a simple card first.
- **Compact numbers are the locale's own** (`3,94 bi` pt-BR, `4,37 млрд` ru, `4370 M` es); DESIGN.md's `3,94 B` example is updated.
- **Copy keeps symbols out**: signs, arrows and `#` live in components, so blank mode keeps them visible (round 1 showed `−{n} left` blanking to `░2`).
- **React keys never come from copy** (blank mode exposed duplicate keys: every five-letter label blanks to `░░░░░`); metric, column, legend and detail lines use positions.
- **Screenshots clear cookies first**: the CDP Chrome on port 9333 carried a `theme=dark` cookie, so some earlier "light" captures (e.g. `07-photos-main-360-light.png`) are dark.
- **Persona agents** were general-purpose sonnet subagents in fresh context, told to use only `Read` on the 12 tiles; the Agent tool cannot remove tools, so "no repo access" is by instruction. The tiles sat in the session scratchpad under neutral names (`page1-ledger-part1.png` …), outside the repo.

## Deviations
- **Blank mode keeps the four game terms readable** (Might, Kills, Members, Level). Round 1: all three personas told the rows apart only by magnitude and one guessed. DESIGN.md chooses these labels because members read them in the game's own English UI daily, so blanking them tested something the real page does not rely on. This changes the plan's test ("every value replaced"), not the page; 7c should judge whether it is fair. Everything else in copy is blanked.
- **Kills member-loss note moved from the card to Details** (plan Phase 5: "a negative kills delta is annotated with the member loss" on the card). Round 2: all three personas read `· −2 Members` on the Kills row as a kills figure. It now sits beside Kills before → after in Details.
- **Members note (`+3 joined · −1 left`) only when people both joined and left**; with one side only, the members change already says it.
- **Status strip**: the task's "Before/After chips" are replaced by the owner's "Last updated / Next update" chips (adjustments block).
- **Admin strings moved too** (the grep test covers all of `app/`); admin got a quota section, not a redesign.
- Search results still have no badge or photo (the query returns neither; not asked).

## Verified
- `pnpm check` → prettier clean, eslint clean, `tsc --noEmit` clean, `Test Files 22 passed | 1 skipped (23)`, `Tests 82 passed | 1 skipped (83)`.
- `pnpm build` → compiled; all routes listed (`/`, `/events/[id]`, `/events/[id]/alliances/[unionId]`, `/players`, `/players/[uid]`, `/admin*`, `/brand`, …).
- `lib/copy.test.ts` fails when a file with `<p title="Tap for more">Showing {n} of members</p>` is planted under `app/`: it reports both `Showing   of members` and `Tap for more`; file removed, green again.
- `next dev` against the Neon preview branch (`.env.local` linked): `/`, `/events/3`, `/events/3/alliances/67110992`, `/players/339985801541`, `/players/340243734853`, `/players?q=so`, `/players?q=zzzzqq`, `/admin`, `/admin/runs`, `/brand` → 200; `/nope` → 404. `/` contains no "requests left" and no "UTC)". After unlocking with the PIN from `.env.local` (not printed): `/admin` shows "Requests left today after the last run: 779", `/admin/runs` shows "779 requests left".
- `Accept-Language` → first compact number, second, the date heading:
  - `en-US` → `4.37B`, `85.8M`, `Saturday, October 31`
  - `pt-BR` → `4,37 bi`, `85,8 mi`, `sábado, 31 de outubro`
  - `ru-RU` → `4,37 млрд`, `85,8 млн`, `суббота, 31 октября`
  - `es-ES` → `4370 M`, `85,8 M`, `sábado, 31 de octubre`
  - `xx-garbage;q=1, de;q=0.5` → `4,37 Mrd.`, `85,8 Mio.`, `Samstag, 31. Oktober`
- Screenshots over CDP (exact viewport, `prefers-color-scheme` emulated, cookies cleared): `scrollWidth` equals the viewport on all 24 (360, 390, 1280). Full heights at 360: main 5,465 px, alliance 18,706 px, player 1,493 px, search 3,502 px. No console errors or warnings in blank mode after the key fix.
- Blank mode: `/` HTML has `░` runs and no English except data, symbols and the four game terms; in normal mode `/` has 0 `░`.

### Audit against the language-light rules (before this session → now)
- Main: H1 was the DB event name (`Seed Saturday Event 2026-10-31`) → ledger title + byline, `Intl` long date. Event line "Event starts Sat 2026-10-31 12:00 server (14:00 UTC) · Data requests left today: 779" → removed (quota on `/admin`). Chip "Last updated: partly done at Oct 31 16:01 UTC" → same words from copy, `Oct 31, 14:01 server`. Paragraph "Some alliances could not be refreshed…" and per-phase error lines → removed (row marks ○ Stale; errors on `/admin/runs`). Order by `before.total_power`, no ranks → ledger rank with movement. "Data up to date" / "Out-of-date data in the after snapshot" → ● Fresh / ○ Stale. "About this data ▾" (muted text) → framed "Details ▾". "0 joined, 2 left", "2 members left" → `+n joined · −n left` (both only) and `−2 Members` in Details. "Leaderboard numbers (for comparison only)" + sentence → "Game board". `toLocaleString("en-US")` → `Intl` per request. No legend → one legend.
- Alliance: "← Back to Oct 31 event" → breadcrumbs. Title broke mid-word at 360 px ("TheWa / ckyOnes") → full-width title, breaks between words only. "Before event: 3.61B" lines → `3.61B →` before the value. "Search members by name", "Min might, e.g. 50M", "Sort by …", "Showing 100 of 100 members" → `Member name`, `Min might`, option labels, `MEMBERS 100 / 100`. "History across events" + paragraph → "Across events". `B` explained only in an `abbr` tooltip → legend entry. "Server rank" column with no movement → server rank `#a → #b` with movement in Details.
- Player: "← Find a player" → breadcrumbs. Paragraph → removed. "Since previous event:" → `since Oct 24`. "name: was X, now Y" → `Name: X → Y`. `B` tooltip → legend.
- Search: "Find a player", "Type part of a name. Earlier names match too.", "(earlier name: X)", "last seen", "Showing the first 50 matches. Type more…" → `Players`, removed, `was X`, `SEEN`, `First 50`.
- Header: "Players" text link → magnifier + Players. Wordmark unchanged.

### Persona test (blank dictionary, 390 px)
Expected answers: NSE kills `▲ +1.71M (+2.8%)`; URSA lost the most members (`−2`); the numbers are from Saturday Oct 31, last updated 14:01 server.

| Round | What changed before it | Dmitri (RU) | Lucía (ES) | Rafael (BR) |
| ----- | ---------------------- | ----------- | ---------- | ----------- |
| 1 | — | kills ✓ (fairly sure), members ✓, time ✗ (12:00) | kills ✓ (guess), members ✓, time ✗ (12:00) | kills ✓ (guess), members ✓, time ✗ (12:00) |
| 2 | game terms kept in blank mode; Start line removed; board time inside its panel; members note only for both; `−2 Members` kills note; `from →` instead of "Before" | ✓ ✓ ✓ | ✓ ✓ ✓ | ✓ ✓ ✓ |
| 3 | kills note moved to Details | ✓ ✓ ✓ | ✓ ✓ ✓ | ✓ ✓ ✓ |
| 4 (Dmitri only) | player card's second change labelled `since Oct 24` | ✓ ✓ ✓ | — | — |

Remaining hesitations, not on a data row's meaning: the red "partly done" chip reads as a warning in every round (it is the seed's real state: TEST is stale), and the time zone is unclear because "server" is blanked; the legend's words are blank; on the player card Dmitri guessed (correctly) that the first change is "during the event". See Open issues.

The reports, verbatim:

### Round 1 — officer in Russia (Dmitri)
**Task 1: NSE kills change**
- Answer: +1.71M (+2.8%), from the second line of the [NSE] Natural Selection card (61.8M ▲ +1.71M (+2.8%)).
- Time: about 25 s.
- Hesitation: every row label is ░░░, so I could not read which line is kills. The top line (4.37B, +85.8M) looks like alliance might because it is billions. The second line (61.8M) could be kills or something else. My clue was the usual order in these games (might, kills, members) and that the third line is a small number like 98, which fits members.
- Confidence: fairly sure.

**Task 2: Alliance that lost the most members**
- Answer: [URSA] Ursus Invictus (#4). Its third line is "▼ −2 (−2.1%) · −2". Every other card shows "= 0" in that line.
- Time: about 40 s, scrolling all 22 cards.
- Hesitation: I assumed the third line is members, because it holds numbers like 93, 98 and 100, and I assumed a red ▼ means a loss. The extra "· −2 ░░░░" text on URSA's line is unreadable. The #4 card is also cut at the screen edge, so I had to scroll carefully. I did not see any other card with a red arrow.
- Confidence: fairly sure.

**Task 3: When the numbers are from**
- Answer: Saturday, October 31, 12:00. This is the large bold heading with "12:00" under it.
- Time: about 10 s.
- Hesitation: two other timestamps compete with it.
  - The red-bordered box near the top says "Oct 31, 14:01", and I can't read the words around it.
  - The box at the bottom says "Oct 30, 22:00".
  - I guessed the big heading is the event date because it is largest and the Discord post came right after the Saturday event. The red border looks like a warning, so I did not trust that box. I can't tell whether 14:01 is when the data was fetched or something is out of date. I also don't know which timezone any of these use.
- Confidence: guessing, between the heading and the 14:01 box.

**Notes (in character)**
1. All labels are unreadable. The row meaning is only inferable from number size and order, so I'm not certain which line is kills.
2. Three different times (12:00, 14:01, 22:00) with no readable explanation. I don't know which is "the data time".
3. Cards show many arrows and "=" signs. They help, but the small gray figures on the player cards (e.g. 96.5M) I couldn't interpret at all.

### Round 1 — casual member in Spain (Lucía)
I read all 5 parts of page 1 and all 5 parts of page 2. I skipped page 3 because the tasks were answerable from page 1.

**Task 1: NSE kills change**
- Answer: I picked +1.71M (+2.8%), the second line of the [NSE] card. It is a guess. The first line is +85.8M (+2.0%).
- Time: about 20 seconds.
- Hesitation: every label in the NSE card is ░░░, so I can't tell which line is kills. The card has three lines, a big number with a change, a smaller number with a change, and a plain number (98). I guessed the first line (4.37B) is something huge like total power. I picked the second line (61.8M) because it seemed the more likely "kills" number, with no real clue.
- Confidence: guessing.

**Task 2: Which alliance lost the most members?**
- Answer: [URSA] Ursus Invictus, #4. Its third line reads 93 ▼−2 (−2.1%) · −2.
- Time: about 25 seconds.
- Hesitation: I assumed the third line is member count. Its numbers (47 to 100) look like alliance sizes, and every other card shows "= 0" there. URSA is the only card with a red down arrow on that line. I scrolled through all 22 cards and found no other. URSA's second line also has a red −1.03M (−3.4%) · −2, so I wasn't sure which line the −2 belongs to. I didn't look at the second part of the URSA row text.
- Confidence: fairly sure.

**Task 3: When are these numbers from?**
- Answer: Saturday, October 31, 12:00. It is the bold heading near the top, with "12:00" on the small line under it.
- Time: about 15 seconds.
- Hesitation: three dates compete. The red-bordered box under the button says "Oct 31, 14:01". The box at the very bottom says "Oct 30, 22:00". The top-bar pill says "Sat, Oct 31". I assumed the heading is the event and the red box is a warning, maybe about a later update. I can't tell whether 14:01 or 22:00 is the real time of the numbers.
- Confidence: fairly sure about the day, guessing about the time.

**Notes, in character**
1. The numbers have no readable labels, so I can't tell power, kills or members apart. I could only use position and the arrows.
2. The red box with the wavy icon and "Oct 31, 14:01" looks like a warning. I don't know if the data is old or wrong.
3. Each card has a dropdown button and a dot with ░░░ text. I didn't dare tap them, since they might hide the answer.

### Round 1 — player in Brazil on a slow phone (Rafael)
REPORT (Rafael)

Task 1: NSE kills change
- Answer: I picked the second row of the NSE card: "+1.71M (+2.8%)" (61.8M now). The first row is "+85.8M (+2.0%)" (4.37B).
- Time: about 30 s. I found NSE fast because it is the first card, but I stood there trying to work out which row is which.
- Hesitation: all three row labels on the left are ░ blocks. I had no word telling me which row is kills. I guessed. The first row is a huge number (4.37B), which looks like power or score. The second is smaller, so I guessed kills. The third row is a number up to 100, so it looks like a count or percent, not kills.
- Confidence: guessing.

Task 2: Which alliance lost the most members
- Answer: [URSA] Ursus Invictus, "−2" (93, ▼ −2 (−2.1%)).
- Time: about 25 s. I scrolled the whole list looking for red ▼ arrows. Only URSA, card #4 (bottom of part 1), has red in the third row. All others show "= 0".
- Hesitation: I assumed the third row is people or members because it is under 100 and URSA's drop is small. The legend at the top has the ▲ ▼ symbols, which helped me trust red = down, but I could not read what the third row measures.
- Confidence: fairly sure (about the third row's meaning, not about the red arrows).

Task 3: When are the numbers from
- Answer: unsure. Candidates: "Saturday, October 31" (big title) with "12:00" under it. A red-bordered box near the top says "Oct 31, 14:01". At the very bottom there is a box with "Oct 30, 22:00". My answer is Saturday, Oct 31, 12:00.
- Time: about 15 s.
- Hesitation: three different times appear, with no readable words next to them. The day is clear (the title, and "Sat, Oct 31" in the top bar). The time is not clear. I chose 12:00 because it sits right under the day title. The red box looks like a warning, so I did not trust it. The bottom box looks like a footer note.
- Confidence: guessing for the time, sure for the day.

Notes:
1. Row labels on every card are unreadable, so I can't tell power, kills and members apart. Small pictures or icons next to each row would help.
2. Three dates and times at once (12:00, a red box with 14:01, a bottom box with Oct 30, 22:00) made me doubt which one is "the" time.
3. Tapping the alliance and player pages was easy because of the pictures and names. The player page looks like the alliance page, so I felt lost.

### Round 2 — officer in Russia (Dmitri)
Dmitri's report (read only page1 ledger parts 1-5 and page2 parts 1-3; pages 3 not needed).

Task 1: NSE kills change.
- Answer: ▲ +1.71M (+2.8%). Kills now 61.8M. This is the second line on the first card, [NSE] Natural Selection, #1.
- Time: about 10 s.
- Hesitation: little. The word KILLS is visible, and the amber triangle with a plus sign reads as "up". I was briefly unsure whether +1.71M is a change or a new total. The percentage in brackets and the triangle made me decide it is a change.
- Confidence: sure.

Task 2: Which alliance lost the most members?
- Answer: [URSA] Ursus Invictus, ▼ −2 (−2.1%), 93 MEMBERS. It is the only card with a red down-triangle on the MEMBERS row. Every other card shows "= 0", and TEST shows a dash.
- Time: about 35-45 s. I scrolled all 22 cards looking at the third row of each one.
- Hesitation: the third row of every card (MEMBERS) is where I looked. The red colour and the down triangle stood out. In the URSA card, the KILLS row also has "· −2 Members" after the percentage, which made me wonder whether kills fell by 2. The red kills number, −1.03M, is separate, so I treated it as extra information. I could not tell why that text is there. The TEST card (#10) has dashes and a hollow circle in its footer, so I could not tell whether it is missing data or no change.
- Confidence: fairly sure.

Task 3: When are these numbers from?
- Answer: Oct 31, 14:01. It is in the red-bordered box under the top button, to the right of some ░ text. The heading above says "Saturday, October 31". The header dropdown also says "Sat, Oct 31".
- Time: about 10 s.
- Hesitation: I cannot read the red box, so I do not know if 14:01 is when the data was taken, when it was updated, or a warning about old data. A red border looks like a warning. There is no time zone shown, so I do not know whether 14:01 is my time. The heading and the red box both give the date, so I took Saturday 14:01 as the answer.
- Confidence: fairly sure.

Notes:
1. The red-bordered box looks like an error. I could not tell if it is a warning or just a timestamp.
2. The "· −2 Members" text on the URSA kills row looks like it belongs to kills. I would have expected it to be shown only on the MEMBERS row.
3. Each card ends with a ░ line and a dropdown button. I do not know what they do. The dashes on #10 are unclear, and so is the hollow circle versus the filled dot next to the ░ text.

### Round 2 — casual member in Spain (Lucía)
I only needed page 1 for all three tasks. I opened page 2 part 1 and 2 and page 3 part 1, and skipped the other parts.

**Task 1: NSE kills change**
- Answer: ▲ +1.71M (+2.8%). This is the second row of the first card, "[NSE] Natural Selection".
- Time: about 8 seconds.
- Hesitation: none, because KILLS is visible in English. The first row (MIGHT) shows +85.8M, so I had to be sure I read the KILLS row and not that one. The orange up-arrow told me it went up.
- Confidence: sure.

**Task 2: Alliance that lost the most members**
- Answer: [URSA] Ursus Invictus, MEMBERS 93, ▼ −2 (−2.1%). It is card #4.
- Time: about 25 seconds.
- Hesitation: I scrolled through all 22 cards looking at the MEMBERS row. Almost every card shows "= 0", and only #4 has a red down-arrow. I couldn't read any label for "= 0", so I guessed it means no change, because the arrow is gray or neutral and the number is 0. Also on #4, the KILLS row has a strange extra bit, "· −2 Members". It confused me that the KILLS row mentions members. I assumed the MEMBERS row was the real one because that word sits next to its own number.
- Confidence: fairly sure. I didn't check every card closely, and card #10 [TEST] has dashes instead of numbers.

**Task 3: When the numbers are from**
- Answer: Saturday, October 31, with the time 14:01 (the red-bordered box says "Oct 31, 14:01"). The top button says "Sat, Oct 31", and the big heading says "Saturday, October 31".
- Time: about 10 seconds.
- Hesitation: the red-bordered box near the top has unreadable text, so I couldn't tell whether 14:01 is when the numbers were taken or when something went wrong. Red usually means a warning. I took it as the time because it's the only clock time on the page. Also, I don't know the time zone.
- Confidence: fairly sure on the day, and guessing on whether 14:01 is the time of these numbers.

**Notes**
1. The red box with the time looks like an error. I wasn't sure it was something I should trust, so I nearly ignored it.
2. Every card has a gray unreadable button at the bottom right and a dot with unreadable text on the left, and I couldn't tell what they do. A filled dot and an empty dot also appear, and I don't know what they mean.
3. "−2 Members" appearing inside the KILLS row on card #4 is confusing, because that is not where I'd look for members.

### Round 2 — player in Brazil on a slow phone (Rafael)
Rafael's report. I only used page 1. The tasks were all answerable there, so I did not scroll through pages 2 and 3. I glanced at page 2 and it only showed one alliance's player list, which I don't need.

**Task 1: NSE kills change**
- Answer: NSE is the first card. Its KILLS row reads 61.8M ▲ +1.71M (+2.8%). So up 1.71M, or +2.8%.
- Time: about 8 seconds.
- Hesitation: none about where to look. NSE is #1 at the top and the KILLS word is visible. I wasn't sure whether the gold ▲ means up, but the + sign confirms it. The MIGHT row above has a similar-looking +85.8M, so I read the label carefully.
- Confidence: sure.

**Task 2: Alliance that lost the most members**
- Answer: [URSA] Ursus Invictus, #4, MEMBERS 93 ▼ −2 (−2.1%).
- Time: about 25 seconds. I scanned every card's MEMBERS row, 22 cards over 4 screens.
- Hesitation: nearly every card says "= 0", and only URSA has a red ▼ −2. The red colour made it stand out, so I guessed that was the loss. The #4 card's KILLS row also has "· −2 Members" in red, which confused me. I thought it was a second thing, but it matched the −2. I didn't compare against the whole list, because I assumed an unchanged row means no change. #10 [TEST] shows dashes instead of numbers. I assumed it has no data.
- Confidence: fairly sure.

**Task 3: When the numbers are from**
- Answer: the big heading says "Saturday, October 31". The red-bordered box near the top has "Oct 31, 14:01" at its right end. The header button also says "Sat, Oct 31". So Saturday, Oct 31, 14:01.
- Time: about 10 seconds.
- Hesitation: I can't read the words in the red box, so I don't know if 14:01 is when the data was taken, when it was last updated, or a warning. It is red, which made me worry something is wrong. I guessed it is the time because it sits next to the date. I don't know the time zone.
- Confidence: fairly sure on the day, guessing that 14:01 is the data time.

**Notes**
1. The red box with "Oct 31, 14:01" looks like an error. I couldn't tell if it was good or bad.
2. The thin legend line (▲ ▼ = # ● ○) is unreadable text. The symbols alone do not tell me what ● and ○ mean, and the dotted line under each card is unclear.
3. The member-loss info appears twice on card #4, in two different places. One place would be clearer.

### Round 3 — officer in Russia (Dmitri)
**Report from Dmitri**

I read all 12 images, top to bottom.

**1. NSE kills change**
- Answer: **+1.71M (+2.8%)**, with a gold up-triangle. NSE kills now: 61.8M.
- Time: about 8 seconds. NSE is the first card, and the row labelled KILLS is the second line of the card.
- Hesitation: very little. KILLS is one of the four words I recognise, and the triangle with a plus is the same as the game's own delta. I did not know whether the +1.71M is "since last week" or "since yesterday". The words next to it are blocks, so I read it as the change.
- Confidence: sure.

**2. Alliance that lost the most members**
- Answer: **[URSA] Ursus Invictus, -2 members (-2.1%)**. It is card #4, with a red down-triangle on the MEMBERS line.
- Time: about 25 seconds. I scrolled all 22 cards to check.
- Hesitation: every other card shows "= 0" next to MEMBERS, and #10 [TEST] shows a dash. URSA is the only red one, so it was easy to spot. I guessed that red down means a loss, as in the game. The "= 0" next to the member count is not self-evident. I took "=" as "no change".
- Confidence: fairly sure. A different member loss could be hidden in the "= 0" rows, but I saw none.

**3. When the numbers are from**
- Answer: **Saturday, October 31, 14:01**. The big heading says "Saturday, October 31". The box with the red border near the top says "Oct 31, 14:01".
- Time: about 10 seconds.
- Hesitation: I do not know what the red box is. Red looks like a warning. The block text in it is long, so it may say the data is stale or old. I used the date and time in it as the answer because it was the only time on the page. I cannot tell the time zone. The top button "Sat, Oct 31" is another date, and I took it to be a date picker.
- Confidence: fairly sure on the day. For 14:01 I am fairly sure, but guessing on what the box means.

**Notes**
- The red-bordered box looks like an error, so a person might not trust the numbers. A calm style would be better if it only states the time.
- The tiny legend row of symbols (up, down, =, #, filled dot, empty dot) has only blocks as labels. I had to work it out from the cards. The dots under each card are not clear to me. The empty dot appears only on [TEST].
- On the alliance page, the second numbers under MIGHT and KILLS (for example "+2.95M (+4.4%)") are not explained. I do not know why two changes are shown for one row.

### Round 3 — casual member in Spain (Lucía)
I used page 1 for all three tasks. I opened page 2 and the top of page 3 but didn't need them. I didn't open page2-alliance-part4/5 or page3-player-part2.

**Task 1: NSE kills change**
- Answer: +1.71M (+2.8%). It's in the first card, "[NSE] Natural Selection", on the row labelled KILLS: 61.8M, then an orange up-triangle and "+1.71M (+2.8%)".
- Time: about 8 seconds.
- Hesitation: I wasn't sure the row was the change and not a total. The KILLS label is readable, and the small orange triangle with a plus and percent looks like "went up". The MIGHT row right above has the same layout, so I checked I was on KILLS and not MIGHT.
- Confidence: sure.

**Task 2: Which alliance lost the most members**
- Answer: [URSA] Ursus Invictus, which shows "▼ −2 (−2.1%)" on the MEMBERS row.
- Time: about 25 seconds. I scrolled through all 22 cards looking at the MEMBERS row.
- Hesitation: Every other card says "= 0" next to MEMBERS, so the red down-triangle with −2 on card #4 stood out. I guessed red and down means a loss, because red appeared on the MIGHT and KILLS rows when numbers fell. I didn't compare the percentages. I never saw another red MEMBERS row, but I skimmed fast. Card #10 [TEST] has dashes instead of numbers, and I assumed that means no data.
- Confidence: fairly sure.

**Task 3: When the numbers are from**
- Answer: Saturday, October 31, around 14:01. The heading says "Saturday, October 31". The top button says "Sat, Oct 31", and a red-bordered box under the heading ends with "Oct 31, 14:01".
- Time: about 10 seconds.
- Hesitation: I wasn't sure what the red-bordered box meant. It has a red warning-style icon and the date and time, but all its other words are unreadable. It might be a warning, so I wasn't sure 14:01 is when the data was taken and not a problem time. I trusted "Saturday, October 31" for the day. I took 14:01 as the time because it's the only time on the page.
- Confidence: fairly sure on the day, guessing on the time.

**Notes**
1. The red-bordered box near the top is the most confusing part. Red usually means something is wrong, and I can't tell what it says about the time.
2. The coloured triangles (up in orange, down in red) are easy to follow. I couldn't read the legend row of small symbols under that box, so I only worked out the meaning from context.
3. Each card has an unreadable dropdown button at the bottom. I didn't know whether it opens the alliance, or something else, so I tapped nothing. I'd guess tapping the alliance name is the way in.

### Round 3 — player in Brazil on a slow phone (Rafael)
Rafael's report. I read page 1 parts 1-5, page 2 parts 1-2 and page 3 part 1. The answers were all on page 1, so I stopped there.

**Task 1: NSE kills change**
- Answer: ▲ +1.71M (+2.8%). This is the second row (KILLS) of the first card, #1 [NSE] Natural Selection. KILLS is one of the four words I know.
- Time: about 10 s.
- Hesitation: almost none. The card is first on the page and the KILLS row is easy to find. The number beside the triangle is yellow, so I took it as "went up". I'm not sure whether 61.8M or +1.71M is the "change", but the plus sign and triangle made me pick +1.71M.
- Confidence: fairly sure.

**Task 2: Alliance that lost the most members**
- Answer: [URSA] Ursus Invictus, #4: MEMBERS 93 ▼ −2 (−2.1%).
- Time: about 35-40 s. I had to scroll through all 22 cards looking at the MEMBERS rows.
- Hesitation: every other card shows "= 0" in the MEMBERS row. Only URSA has a red ▼ −2, and the MIGHT and KILLS rows on that card are red as well. I'm guessing red ▼ means loss from the colour and arrow. [TEST] shows "—" with no number, which I read as "no data", not as a loss. I never opened page 2 to check.
- Confidence: fairly sure.

**Task 3: When the numbers are from**
- Answer: "Oct 31, 14:01", in the red-bordered box near the top. The big heading says "Saturday, October 31", and the top bar has "Sat, Oct 31".
- Time: about 10 s.
- Hesitation: I don't know what the red box says. The date and time are the only readable part, so I guessed it's the time of the numbers. The red colour also looks like a warning, so it may mean "old data" or "problem". The heading's date is clear, but it has no time. I'm not sure whether 14:01 belongs to the Saturday data or is when the page was updated.
- Confidence: guessing between "Saturday Oct 31, 14:01" and "Saturday only". I'd say Saturday Oct 31 at 14:01.

**Notes**
1. The red box looks like an error. With the words hidden I can't tell whether it's a warning or just the time. Put the date and time in a neutral colour.
2. The row legend with ▲ ▼ = # ● ○ is all unreadable text. Each symbol is explained only in words I can't read. "= 0" under MEMBERS is not obvious.
3. Each card has a big empty-looking dropdown button and a dotted line with a ● at the bottom. I can't tell what they are, and they take a lot of screen on a small phone. I had to scroll past them 22 times.

### Round 4 — officer in Russia (Dmitri), re-run after the player-page fix
DMITRI'S REPORT

TASK 1: NSE kills change
- Answer: ▲ +1.71M (+2.8%). Kills now 61.8M. The first card, #1 [NSE] Natural Selection, KILLS row.
- Time: about 10 s. The tag is in the first card and the numbers are right there.
- Hesitation: none on which row. I know KILLS and the arrow is gold/up. I read the +1.71M as the change and the % as relative growth. That is standard in stat tables.
- Confidence: sure.

TASK 2: Alliance that lost the most members
- Answer: [URSA] Ursus Invictus, ▼ −2 (−2.1%), 93 MEMBERS. Every other card shows "= 0". The only one with a red down arrow is card #4.
- Time: about 25 s. I scrolled through 22 cards looking at the MEMBERS rows.
- Hesitation: I had to scan every card. I did not see a sorted or summary view. I trust that the red ▼ marks a loss, because the legend row at the top has the same symbols, though I can't read their words. #10 [TEST] shows dashes instead of numbers. I guessed it has no comparison data.
- Confidence: fairly sure. A summary on top would have made me sure.

TASK 3: When are the numbers from
- Answer: I see "Saturday, October 31" as a big heading and "Oct 31, 14:01" in the red-bordered strip under it. I'd say Saturday, Oct 31, 14:01.
- Time: about 15 s.
- Hesitation: The red strip is all ░, so I can't read what it says. It could mean "data updated at 14:01", "warning, outdated", or "event ends at 14:01". The red colour makes it look like a warning. The time zone is not clear (Moscow time? server time?). The date in the header selector "Sat, Oct 31" matches the heading. Clue used: the date and time sit together, so I assumed the 14:01 belongs to the data.
- Confidence: guessing on the time (fairly sure on the day).

PAGE 3 QUESTION: the two changes under MIGHT and KILLS
- Each card (e.g. Oct 31) has a main line like 69.1M → 70.5M ▲ +1.40M (+2.0%). I read this as: previous value → current value, then the change in absolute and in percent. That is the change for the week or event.
- Under it there is a small second line: ░░░ Oct 24 ▲ +2.95M (+4.4%). I understand it as a comparison with the date Oct 24, the earlier event. The big number is higher (+2.95M vs +1.40M), so I think it is the change since Oct 24, maybe cumulative.
- But the card is for Oct 31 and the first row already compares to something, so I am not sure what the first change compares to. Maybe the first is the change during the event and the second is the change since the previous Saturday.
- Confidence: guessing. The clue was the "Oct 24" label next to the second line, and the second line being larger.

NOTES
1. The two changes on the player cards. I can't tell what each is measured against. The "Oct 24" label helps only for the second.
2. The red strip on top of the ledger. It is the only red block, and I can't tell if it is a warning. It holds the time, which I needed.
3. LEVEL shows "= 0" like MEMBERS. Fine, but the "= " symbol and the legend row of symbols have no words I can read. Also, the small "B" badge in the legend is unclear.

## Open issues
- **The red status chip reads as a warning** (all four rounds; personas then distrust the 14:01 time). It is red because the seed's latest event is `partial` (TEST is stale), which DESIGN.md's chip tones make seal. A neutral chip for the time with a separate state mark would fix it; that is a design change for 7c/7d, not made here.
- **Player card, first change** (in-event, `69.1M → 70.5M ▲ +1.40M`): understood but guessed in round 4. No language-free marker for "during this event" was found within DESIGN.md's components.
- **The legend explains each symbol only in words**, which the blank dictionary hides; the personas inferred ▲ ▼ = from the cards. ● / ○ stayed unclear to two of them.
- **Blank mode keeps four game terms** (see Deviations); 7c should decide whether that is fair to the test.
- `/brand` builds some React keys from copy text (`LogoSection` `t.dos[i]`, `parts.tsx` `line`), so blank mode logs duplicate-key warnings there. No persona test covers `/brand`; not changed.
- Numbers format on the client too (`Num` is a client component reading the locale from context). Node's and the browser's ICU could differ for some locale; the number spans have `suppressHydrationWarning`.
- Search results have no badge or photo; `searchPlayers` does not return `badgeId` / `hasAvatar`.
- Light-mode yarn text on paper stays at 2.15:1 (#25), visible on every `▲` delta in the light screenshots.
- DESIGN.md "Typography" table still lists weight 600 for the display steps (pre-existing, 07e noted it); the new hierarchy table beside it uses the loaded weights.
- The seed has 22 alliances (fixtures hold 22 rosters), so ranks run to #22; the config tracks 20.
- Each `next dev` creates `AGENTS.md` in the worktree; deleted, not committed.
- **Branch:** `dev` on GitHub was rewritten while this session ran (same trees and messages, new SHAs: `e0f8613` → `9c9e153`), so the first push (`session/07b-usability`, `bac478d`) has no history in common with `dev`. The two commits were rebased onto the new `dev` (tree unchanged, `b05a2d8`); the force-push was refused by the session's permission check, so the PR is from `session/07b-usability-dev`. `session/07b-usability` on the remote is stale and can be deleted.

## Next
Session: 7c — UI review (read-only, adversarial)
Model / effort: keep (fable · xhigh, plan mode) — no signal against it; the review is measurement-heavy (axe, contrast, Lighthouse, blank-dictionary tasks), which this session did not do.
Owner must do first: delete the stale remote branch `session/07b-usability` (see Open issues); merge this PR into `dev` so the `dev` staging URL shows 7b; paste that URL into the 7c prompt. Nothing to seed: the preview branch already holds the seed this session used.
Plan changes needed: Phase 5 (main-page card bullet): the kills member-loss note now sits in the card's Details panel, not on the card (persona round 2). Phase 5f: the blank dictionary keeps the game's own four terms readable (Might, Kills, Members, Level). Phase 5 "Routes" header bullet: status chips are "Last updated / Next update" in server time and quota is on `/admin` (owner, 2026-11-05). Do not edit the plan here.

<adjustments>
- Blank-dictionary mode: start `next dev` with `NEXT_PUBLIC_BLANK_COPY=1` (it is inlined at build/dev start, so restart the server to switch; it does nothing in a production build). Only one `next dev` can run per worktree (shared `.next`), so switch modes by restarting. The four game terms stay readable on purpose (D23).
- `next dev` in a worktree needs a real `node_modules` (`pnpm install --frozen-lockfile`): Turbopack cannot resolve `next` through a symlinked `node_modules`. `.env.local` symlinked from the main checkout works, and env validation passed with it.
- Screenshots: clear cookies before each capture (`Network.clearBrowserCookies`) — the long-running CDP Chrome on port 9333 keeps a `theme=dark` cookie, which turns "light" captures dark. Split `name=path` on the first `=` only (`/players?q=so`).
- Expected persona answers on the seed: NSE kills `▲ +1.71M (+2.8%)`; URSA lost the most members (`93 ▼ −2 (−2.1%)`, the only negative members change); data last updated `Oct 31, 14:01 server` (status `partial` because TEST (67116075) is stale in the after snapshot).
- Ranks on the seed's latest event (event 3): ledger might #1 NSE … #22 TRM; every might rank is unchanged before → after (`=`), TEST shows `—` (stale). Server rank comes from `alliance_snapshots.server_rank`.
- Copy: `lib/copy.ts` (+ `copy-brand.ts`, `copy-admin.ts`); the grep test is `lib/copy.test.ts`. Locale: `app/_ui/locale.ts` (`pickLocale`), verified outputs for en, pt-BR, ru, es and a malformed header are in Verified above.
- Known 7b leftovers worth measuring rather than re-finding: the red partial chip, the player card's in-event change, the legend's word-only explanations, `/brand` copy-keyed React keys.
- The `07b-blank-r1-*` tiles are the before state of the persona fixes; `07b-blank-*` are the baseline after them.
</adjustments>

<adjustments for="Session 7d">
- If 7c asks for a neutral time chip: the chip tone comes from `CHIP[status].tone` in `app/_ui/Status.tsx`; `Chip` is `lib/brand/components/Chip.tsx`. DESIGN.md's `status-strip` line defines the tones, so change it in the same commit.
- Any new string goes to `lib/copy.ts` (or its sibling module), never with a sign or arrow in the value; React keys must not come from copy values (blank mode duplicates them).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/31
