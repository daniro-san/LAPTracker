# fix 473: the public pages' bugs and small wins from the persona review

## Built

Bugs:
- **B1, ledger at 640–1023 px.** The rows of `StatTable` (the ledger, a member list, Across events) and the player's Across events share their tracks:
  - the lead column is at least 10rem;
  - a figure column is at least `--fig-min` (0 below 768 px, 6.75rem from 768 px, `app/globals.css`).
  - `Delta` writes the change and its percent as two unbroken pieces, with the `*` kept with the last one. When a column is too narrow for both, the percent goes on the next line instead of running into the next column.
- **B2 and B3, names.** `.name-fit` (`app/globals.css`) makes a name wrap between words only; a word too long for its line ends in "…". It is on the name only (not on time lines or "was …" lines) in:
  - ledger rows, the alliances list, Standing over time, Movers;
  - players search, leadership cards, member flow, balance rows;
  - compare cards and member history.
  
  Page titles (`h1`) still break, so the full name is always on the page. The leadership card's link is a block flex box, so a long leader name wraps or ends in "…" inside the card.
- **B4, a Start and an End on two days.** Across events (alliance and player) shows the day on both times when they fall on different days of the viewer's clock (`onTwoDays`, `hhmmOn` in `app/_ui/format.ts`): "Oct 18, 01:30 server time", "since Oct 17, 10:00".
- **B5.** Light `--yarn` #805c12 → #75540f. Its contrast is 5.58:1 on paper, 4.68:1 on the leader's plum/10 row tint (was 4.10:1), 4.92:1 on the officer's sage/10 tint and 4.54:1 on a yarn/15 tint.
- **B6.** `/img/avatar/[uid]` serves the drawn `NoPhoto` picture for a missing or unfetchable photo:
  - an SVG built from the same paths (`NO_PHOTO_PATHS`);
  - ink at 45 %, light or dark by `prefers-color-scheme`;
  - status 200, `max-age=300`.

  A malformed uid is still a bodyless 404.

Small improvements:
- **Member history.** Each card head counts who joined, left and changed name ("+3 joined · −2 left · 1 renamed", or "No member changes."). `memberHistoryIndex` diffs the page's rosters for this.
- **Players search** (`lib/queries/player-search.ts`, split from `players.ts` for size):
  - might and level on each card;
  - "Results: n" above the list, or "First 50. Type more of the name to narrow it.";
  - order: an exact name, then a name that starts with the text, then the most recently seen, then the shortest name;
  - `CardGrid` (`list` prop added) from 768 px;
  - a hint under the empty field.
- **Member flow.** Each alliance named links to `/alliances/<id>/history`: the matrix row and column heads, and on a phone the row titles, the destinations, and a first line in each open row.
- **Fight clock.** The header's Events list shows the fight clock only once an event has a usable 15-minute sample. `sharedEvents` carries `sampled`, and the compare page's header now reads `sharedEvents` too.
- **Compare:**
  - the difference line shows the plain difference, then "1.1× the first" when both changes went the same way and the multiple is within 0.1–10×;
  - the help line says so;
  - below 640 px B sits under A, each select full width.
- **Standing over time:**
  - ▲/▼ and yarn/seal on each growth;
  - "By might, [OGs] OldGrandmas went from #6 on Oct 23 to #4 on Oct 30.", or "stayed #1 from … to …" when the rank did not move;
  - "Its might changed +x% since Oct 23.";
  - a no-break space after the tag;
  - the "My alliance" tint is yarn/5 (was /15).
- **Player page:**
  - the might chart's highest reading's date on its own line under the chart, in HTML (`PeakDate`);
  - "Typical [OGs] member: +4.1%";
  - "in OGs" under the rank in Across events.
- **Ledger "since last event".** A "since last event (Oct 24)" line under each figure when Might or Members changed by 25 % or more since the previous chain event. For Members it also needs at least 5 people. The data comes from `previousEventTotals` (`lib/queries/events.ts`), inside the shared `event-page` entry, and `withSinceLast` in `app/_ui/event-rows.ts`.
- **Header.** The new `--masthead` token keeps the header deep plum in dark mode: #3b2436 in light and #55344e in dark, with wax-paper text (11.35:1 and 8.5:1).
- **Keyboard focus:**
  - a 2 px plum ring 5 px outside every control in the soft drawn frame (3 px and wax paper on the header);
  - a plum ring on filled buttons;
  - room for the ring in the members sort-chip scroller;
  - the skip link padded 16 px.
- **404 titles.** An unknown player, event, alliance-in-event, alliance history or comparison sets the not-found `<title>` (`notFoundTitle` in `app/_ui/locale.ts`).
- **City names.** "São Paulo", "Bogotá" and 18 more accented city names in the settings' "Your time" (CLDR's English names, a table in `ViewerSettings.tsx`).
- **Copy and docs.**
  - New and changed strings are in 17 languages, in two translate-copy rounds; the pt-BR and it "renamed" counts use "Label: n".
  - Amendment lines in D21, D22, D57, D60, D86, D90 and D143.
  - DESIGN.md: yarn, the header, the focus ring, `.name-fit` and the legend line.

Tests:
- avatar placeholder and 404;
- search order with might and level;
- history counts;
- the two-day times;
- `withSinceLast`;
- `changeDifference`;
- the fight clock link with and without samples;
- the median wording.

## Decisions

- **The 25 % trigger for "since last event"** applies to Might or Members, and for Members also needs at least 5 people (D75: 2 of 8 leaving does not light up a public row). The line then shows under all three figures, Kills too, for context.
- **The ratio on compare** shows only when both changes went the same way and the multiple is within 0.1–10×. Outside that it says nothing usable, for example "750,000×".
- **`--fig-min` 6.75rem from 768 px, lead at least 10rem.** These came from measuring three options at 640/700/768/1024 in en, fr and pt-BR, compact and exact.
  - 7.5rem kept every compact change on one line but left names 80 px wide at 768.
  - `min-content` per row misaligned the rows and squeezed names to 0, which the panel caught.
  - With 6.75rem, the widest compact changes put their percent on a second line at 768.
- **The avatar placeholder follows `prefers-color-scheme`, not the site's theme cookie.** An `<img>` cannot read the cookie. QA checked in Chrome: it follows the page's colour scheme there.
- **"Typical" for the median member.** The persona review asked for "Typical [OGs] member"; the glossaries' median rows were updated to match.
- **The header in dark** is #55344e, not the light #3b2436. The designer asked for the bar and its lace to part from the dark paper; the lace is decorative.
- **No new decision number.** Every change fits an amendment line in the decision it touches.

## Deviations

- **Member flow on a phone.** Each open row starts with its own alliance as a link. The summary (the row's title) stays the toggle, because a link inside a `<summary>` would fight the tap.
- **The players search is ordered** and shown in a `CardGrid`, which D122 keeps for unordered items. The issue asked for the grid; the order reads row by row.
- **`memberHistoryIndex` reads the page's rosters with their member lists** to count them, where it read heads only (D60's "heads only"). The first page is shared (D143), so a repeat view costs nothing; an older page reads per view.

## Verified

- **Setup:**
  - local production builds of `origin/dev` (BEFORE, :3561) and this branch (AFTER, :3562);
  - local Postgres 18 with the perf-538 invented seed (4 events, 24,240 `daily_rosters` rows);
  - edits on top for the cases: a long leader name, a one-word 26-letter alliance name, event 1's End read on the next server day, one alliance falling from 67 to 2 members since the previous event;
  - stored photo URLs pointed at an unreachable host, so no request left the machine;
  - no upstream, Discord, PostHog or `/api/quota` calls.
- **Screenshots:** 156 per build, at 360/768/1280 × light/dark × en/pt-BR, in `scratchpad/473/shots/before` and `.../after`, plus `.../detail` and the panel's folders `scratchpad/473/panel-*`.
- **Capture metrics** (`metrics.json`):
  - axe colour-contrast: BEFORE 4 pages with 10 nodes at 4.1:1 (yarn on the leader tint), AFTER 0;
  - QA's axe run (10 pages, 360 and 1280, light and dark, every `<details>` open, "My alliance" set): 0 violations AFTER;
  - horizontal overflow: 0 at 360/768/1280 on both builds;
  - `/img/avatar` 404s: BEFORE on every players-search and player view, AFTER none;
  - 404 titles: BEFORE "Event Ledger", AFTER "Grandma wandered off. · Event Ledger" in every language.
- **Ledger widths** (`pw/widths-473.mjs`, en/fr/pt-BR, compact and exact):

  | Width | First AFTER (panel): narrowest name, overflow | Final: narrowest name, overflow |
  | --- | --- | --- |
  | 640 | 0–3 px, 6–8 px | 83 px, 0 |
  | 700 | about 43 px | 110 px, 0 |
  | 768 | 80 px | 116 px, 0 |
  | 1024 | — | 128 px, 0 |

  BEFORE, names wrapped and stayed readable, but changes ran into the next column (B1). In the final build every row's columns line up, in compact and exact numbers alike.
- **Panel** (three subagents, at most three at once; reports in `scratchpad/473/panel-*`):
  - **Designer/UX: block, 2 MUST.** Names vanished in the ledger at 640–767 px. The player's Across events card broke mid-word in PT at 360 px. Both are fixed and re-measured.
  - **Player, R4 and product: approve with changes, 1 MUST.** "since then" pointed at the newest day after the sentence was reordered; fixed.
  - **QA: approve with changes, 3 MUST.** The B1 grid, `.name-fit` cutting the B4 time line, and the focus ring clipped by the sort-chip scroller. All three are fixed and re-checked: the pressed "Might" chip shows a 2 px plum ring at 5 px, at 360 light and 1280 dark.
  - **SHOULDs applied:**
    - from the persona panel: search order (exact match, then length), "First 50. Type more…", "stayed", "since last event", Members ≥ 5, the plural form in pt-BR and it;
    - from the designer: the dark lace, the ratio label;
    - from QA: the ring on filled buttons, the ratio bound.
  - **Not applied:** the designer's "since line only under the figure that crossed". All three figures stay, as context. Kills matched the in-event change in the invented data only because the seed reads each Start equal to the previous End.
- **After the fixes:** `pnpm check` passes (283 test files, 1467 tests). The final AFTER recapture (156 shots) has 0 overflow and 0 axe issues.
- **B4 in the viewer's own zone.** QA set `tz=Asia/Tokyo` and got "Oct 18, 12:30 your time · since Oct 17, 21:00".
- **Focus ring contrast:** plum on paper 11.35:1, plum on dark paper 6.21:1, wax paper on the masthead 11.35:1.
- **B6 inputs:** unknown, 0 and 00000001 give 200 SVG with `nosniff` and CSP `default-src 'none'`. 12x, -1, 1.5, 1e5, a space, 400 digits and 2^53+1 give a bodyless 404.
- **Shared reads (D143):** every changed read still goes through `sharedRead`, and no new invalidation is needed (QA). No private roster field is in any new field.

## Data checks

- **Uneven daily-update times on the history page** (D72):
  - A card's time is the upstream roster's own `updated_at` (`lib/sources/shared.ts:106` → `source_updated_at`), not the time of our read.
  - D72 moved the read from 06:00 to 23:30 on 2026-11-16, so cards change from about 06:00 to about 23:30 there.
  - The 12:50 (Nov 16) and 14:22 (Nov 12) cards are reads outside the schedule, either a hand Retry (D67) or a details lookup (D133), or the upstream's own refresh time. Production's `daily_reads` for those days would tell; this session has no access to it.
  - The code works as D72 describes. If the owner wants the card to say when we read it, that needs a new column.
- **`[TEST]` in the legend:**
  - The rehearsal marker has been `[rehearsal]` since PR #35 (`copy.discord.test`), and no public page shows a marker.
  - Only D21's text and DESIGN.md's legend line still said `[TEST]`; both now say what the code does.
  - Nothing in code needed renaming.

## Open issues

- **Exact numbers at 640–700 px.** An exact Might ("4,251,123,456") is wider than a figure column there, so it can touch the next column. Before this PR it overlapped as well. The D122 width PRs (7 and 8) are the place to give the table more room or switch to cards below 768 px.
- **The peak-date label** never rendered with the invented data, because the highest reading was at an end. It sits on its own line, kept 2.5rem inside the chart. Check it with real data.
- **Panel FOLLOW-UPs, not done:**
  - "You: +3.6%…" on another player's page should name the player;
  - the flow links could carry `?show=left|joined` and the days;
  - the player search card could align the photo to the top and put "seen" on its own line;
  - the own alliance's name in Standing could wrap instead of ending in "…";
  - the placeholder SVG should be checked in Safari.
- **Product recommendations** (panel):
  - a neutral "What changed since last event" card on the alliance page, reusing `previousEventTotals`;
  - an alliance-level Discord recap picture;
  - a "Find me" shortcut to the viewer's own player page.

## Next

- Model/effort: keep. These were UI fixes on existing patterns.
- Owner first: nothing. No env, Vercel or Discord change.
- Plan change: none.

<adjustments>
- Issue 473 is done. Its B1–B6 and its small-improvement list need no later work, apart from the follow-ups above.
- `--fig-min` (app/globals.css) and the 10rem lead in `StatTable` are the knobs for the ledger's column widths; the D122 width PRs should start from them.
- `.name-fit` is the one class for a name in a row or a card; new rows should use it rather than `break-words`.
- `previousEventTotals` (lib/queries/events.ts) is in the shared `event-page` entry and can feed a "since last event" card without a new read.
</adjustments>

PR: (added by the orchestrator)
