# feat-461 — the member card: header, four tabs, last 7 days, the squads lineup, where a member came from

Issue 461. Decision D136 (amends D109, D117, D127). Branch `feat/member-card-tabs` from `origin/dev` at `3de1c6cd`.

## Built

- **Header, the same on every tab** (`app/(private)/_ui/MemberCards.tsx`):
  - the status only for Check in, Needs help, On a break or New. "Fine" and "No data: donations on 1 day" are no longer headlines on the card;
  - the stat strip: Might · Main squad · Kills · Sanctuary;
  - "their time now 05:57" and language tags;
  - "Came from [TAG] Name · joined us Fri, Nov 13" and "Before that: …", or "Came from: not known".
- **Tabs** Overview · Info · Squads · History (`MemberCardTabs.tsx`): the WAI-ARIA tabs pattern, four across at 360 px, each 44 px tall. The last tab picked is kept in `localStorage` (`ws.cardTab`).
- **Overview**:
  - the Follow-up reasons with their evidence;
  - "Last 7 days" (`lib/private/member-days.ts`, `MemberLastDays.tsx`): daily quest points, Alliance Help coins (max 1,000) and donations as HTML bars (D68), with the number under each bar, the no-data mark or "none", and "Average 589 · 4 days";
  - "Might +1.26M since Fri, Nov 13";
  - this week's Alliance Duel when one was saved.
- **Info**:
  - "Still to ask: …";
  - the facts in two columns from 768, with "Updated …" only after "Show when each was updated";
  - Seen since, Joined and Last online while the API sends them, and Map position behind a "Show map position" button (44 px), hidden by default.
- **Squads** (`MemberSquads.tsx`, `lib/private/member-squads.ts`):
  - "3 squads seen · last Thu, Nov 19";
  - per squad, "seen … 22:32 ST · 00:32 your time (+1 d) · 8 h ago";
  - the game's lineup in slot order (0 top centre, 1 middle right, 2 middle left, 3 centre, 4 bottom right) with the picture in its rarity frame, rarity, level, stars, and "Honor N" when it is above 0;
  - 5 slots always, a dashed "Empty slot" for a missing hero, and "1 slot empty" on the squad's line;
  - below 360 px, and for screen readers at every width, a list in slot order;
  - no troop counts.
- **History**: the follow-up notes, and "Earlier values" (every version of each fact before the newest, newest first).
- **Where a member came from** (`lib/private/member-origin.ts`, `lib/queries/roster-stays.ts`): the usable daily rosters of every alliance we read (alliance id and day only), plus the member's own `player_history` rows for `access.unionId`. The most recent alliance comes first. "joined us" is the first day with us after the last day elsewhere. Nothing is guessed.
- **Words**: `lib/private/dictionary.card.ts`, spread through `dictionary.squads.ts`, in EN, PT-BR and FR.
- **Removed words** that only the old card used: `members.don.head`, `members.don.later`, `members.meta.don` and `members.meta.act`, in all three languages.
- **Docs**: D136, a README line, amendments on D109, D117 and D127, and "Card tabs" in `docs/DESIGN.md`.

## Decisions

- D136. Next free number: dev had D134, and the agent on #478 takes D135. No open PR uses D136 (checked with `gh pr list` on 2026-11-20).
- "Last 7 days" means the 7 server days up to the newest end-of-day read, not the game week.
- Coin bars are drawn against 1,000. Quest-point and donation bars are drawn against the row's own highest day, because the number under each bar gives the amount.
- An average counts only the days with a number. "none" days and days with no read never lower it, and the day count is shown beside it.
- "Remembered per officer" is read as "per officer's browser" (`localStorage`, like the clock choice). There is no server-side setting.
- When a squad has fewer than 5 heroes, the empty slots are the last ones. The API sends only the heroes it has, so the real gap cannot be placed.
- The orchestrator decided the panel's three open points (2026-11-20): "Troops" stays (the troop tier fact the owner asks for, not a count); "none" stays beside the no-data mark; map position goes behind "Show map position".
- "Honor N" shows only above 0 (persona panel). Each sighting's age is plain muted text (persona panel). The owner said the age of a sighting matters.

## Deviations

- **Not built, waiting on #460 (open):** the Overview's #460 action, "Copy a hello" in the sticky bar, and the ready message beside "Still to ask".
- **Not built, no reader yet:** History has no roll call marks or thanks. Neither has a per-member read today.
- **Shields:** the card shows no shield data, so "map seen HH:MM" has nowhere to go here. `player_reads.map_updated_at` is not read by this change.
- **Screenshots:** 768 and 1024 (asked for by the issue and the preamble) were not taken. The orchestrator asked for 360, 640 and 1280.

## Verified

- `pnpm check` passes: Prettier, ESLint, tsc, Vitest (1,334 tests in 253 files, 4 skipped), drift and i18n.
- **New tests**, about one per behaviour:
  - `lib/private/member-days.test.ts` (2): the 7 days with numbers, "none" and no data; averages, the coins scale and might since.
  - `lib/private/member-origin.test.ts` (2): order, the move day and the join day, with nothing made up; both sources read from PGlite.
- `lib/private/member-card.test.ts` (1): map position is out of the shown details, behind its button. The "Show map position" button came after the e2e below; the e2e's Info check saw the map row shown by default and was not re-run, so the button itself is checked by this test and `pnpm check` only.
- **Updated**: `app/(private)/_ui/MemberSquads.test.ts` (6): slot order, 5 slots, Honor only above 0, the server clock and the age, the list for screen readers, and no troop field.
- **Workspace suites**: `lib/private`, `app/(private)` and `lib/queries` all pass (138 files, 713 tests, before the panel fixes).
- **Local production build** (`next build` + `next start`, local Postgres 18 with all 58 migrations), invented data:
  - an OGs workspace with 12 invented members and 7 end-of-day reads;
  - a member with "none" days and a day missing from a read;
  - 3 squads, one with 4 heroes;
  - another alliance's rosters, a history row and fact versions;
  - a stubbed signed-in session, and hero pictures answered in the browser.
- **The e2e passes 70 of 70 checks**, among them:
  - the header's origin lines and stat strip;
  - four 44 px tabs;
  - each panel's content;
  - "3 squads seen", and no "of 4";
  - both clocks and the age;
  - "1 slot empty", "Honor 42" and no "Honor 0";
  - no troop field;
  - dates on demand;
  - the tab remembered after a reload;
  - no `avatar_url`, `online`, `last_online_at` or troops in the card's JSON;
  - no sideways scroll at 320, 360, 640 and 1280, light and dark, EN, PT and FR;
  - the list instead of the lineup at 320 px.
- **Screenshots** are in the scratchpad's `461-shots/` (360, 640 and 1280, light and dark, Overview and Squads; 360 in PT and FR, Overview, Squads and Info; 320 Squads).
- **Persona panel** (an R4, a regular member's point of view, product strategy), on the screenshots plus six plain `/v1/players` reads of real members: no `fresh`, 1 s apart, seen locally and deleted afterwards. All three accepted with changes. Applied: "Honor N" only above 0, each sighting's age, and "their time now" shown once.
- Facts from those six reads:
  - history rows covered only 6–13 days, and named only our alliance for all six;
  - squad numbers have gaps (1 and 4; 1 and 3);
  - sightings ran from 2 to 64 h old;
  - about 75 of 85 hero slots had Honor 0.
- **No calls**: no upstream call apart from those six reads, and no Discord or PostHog call. The local server's API and site URLs pointed at a closed local port.
- No name from the OGs fixture roster appears in the added lines.

## Open issues

- **Data limit**: history rows reach back only about 40 rows (6–13 days). So "Came from" mostly rests on our daily rosters of other alliances. With D133's wider set, those reach further.
- **Performance, follow-up**: `rosterSightings` filters `daily_rosters` with `uid = any(member_uids)` and no index on the array. That is fine at today's size (about 20–40 alliances a day). Watch it as D133 adds alliances. A GIN index would fix it.
- **Members list, follow-up**: the list still sorts by Might with a Donated column. The member persona read that as a ranking. Not in this issue.

## Next

- Model/effort: keep.
- **Owner first**: build #460 ("Copy a hello", the ready message), which plugs into the Overview and the sticky bar.
- Plan change: none.

<adjustments>
- #460: the card's Overview already lists the reasons (`statusLines`) and Info has "Still to ask" (`toAskLine` in `lib/private/member-card-parts.ts`). Add the ready message and the "Copy a hello" action there. The sheet's bar holds two buttons (`factsActions`), so a third action needs a bar change or a place in Overview.
- #474 / Raid prep: show `map_updated_at` as "map seen HH:MM ST · your time" with the same two-clock code as the squads line (`Seen` in `MemberSquads.tsx` uses `clockIn`). Each sighting's age has a helper (`ageOf`).
- Insights / Me: the lineup (`MemberSquads`) and the last-7-days bars (`MemberLastDays`) are self-contained and take server-made words.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/514
