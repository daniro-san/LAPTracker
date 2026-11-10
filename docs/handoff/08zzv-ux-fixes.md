# 08zzv: UX fixes (#174) and H2 (#173)

Applies the accepted findings of `docs/handoff/08zzu-ux-review.md` (B1, S1 to S10) and brand-review H2 option (a), with the owner's decisions of 2026-11-10. Notes N1 to N11 are not in this session.

## Built

- **H2.** Alegreya 400 is the display face in every language. `lib/brand/fonts.ts` loads it with the latin, latin-ext, cyrillic, cyrillic-ext, vietnamese and greek subsets, `display: swap`, variable `--font-alegreya`. `--font-display` in `lib/brand/tokens.css` is `var(--font-alegreya), "Hiragino Mincho ProN", "Songti SC", "Noto Serif CJK SC", "Noto Serif Thai", Georgia, serif`. `font-synthesis-weight: none` is kept. The Discord picture (`lib/event-image.tsx`) and the link preview (`app/opengraph-image.tsx`) read `lib/brand/fonts/Alegreya-Regular.ttf` with the family name "Alegreya". Young Serif files are removed. DESIGN.md (front matter, Overview, Typography, page-title row), D48 Fonts bullet, D58 Fonts bullet and `lib/copy-brand.ts` (face name, role, scale specs) changed. The `/brand` page reads the names from `copy-brand`; no class name was hard-coded.
- **B1.** "Grandma noticed ↓" jump link on the capture-window line of the event page, built like "Across events ↓" (44 px, left out when no Movers list has an item). It reuses `copy.ledger.movers`, so there is no new string. The anchor is `MOVERS_ID` (`app/_ui/mover-lists.ts`), set on the Movers section.
- **S1.** The stale and failed counts sit on the time chip's line (`StatusChips`); "Next update at …" is `NextUpdate`, rendered under the ledger above Movers; the legend's ≈ item is the word "Rounded" (all pages that show the legend).
- **S2.** `MoreBar` (with `inline`, used by `StatTable` only) is a grid item of the row: a fifth fixed column (6.75 rem) at ≥ 640 px, the second cell of the last metric's line below 640 px; the open panel spans the row. Done with `display: contents` on `details` and `details::details-content` under `@supports selector(::details-content)` (`.stat-more` in `app/globals.css`); a browser without it keeps the old full-width line.
- **S3.** The strip shows `○ n stale` and `✗ n failed`, each only when non-zero. A card whose After failed keeps its Before figures and shows `10:00 server time` where the change would be (`StatMetric.at`).
- **S4.** `Pictures.tsx` is a client component; `Picture` swaps to `NoPhoto` or `NoBadge` on `onError`, and on mount if the image already failed (ref check).
- **S5.** The compare members view shows the first 20 by Might and "Show all (n)" (`app/_ui/ShowFirst.tsx`, `copy.members.showAll`).
- **S6.** Each Details summary has `, [TAG] Name` as screen-reader text, from the row's `lead`.
- **S7.** `/admin` quota from an earlier UTC day shows its value, a muted "Not read today" and "Last read after the run of {date}"; no OK or Low. Run rows say "n left after this run".
- **S8.** `targetEvent(now, cfg, nearestDone)` in `lib/schedule.ts` (next to `currentEvent`); `scheduledEventDone` in `lib/repo/events.ts`; used by `loadAdminPage` (`lib/queries/admin-page.ts`) and `app/api/snapshot/route.ts`. The section is headed "Target event" and names "Sat, 07/11 · 3 days ago · Before not taken, After not taken" (or "both snapshots done"); the `renameLater` line shows only while its date is ahead. The "Before only after its due time" guard is unchanged.
- **S9.** `requestServerClock` reads the `date` cookie; `Clock.stamp` follows the chosen order and keeps the year; the admin gear shows Dates (D38 has a dated amendment line). A generated event name shows as its date (`eventWord`, the next-run note) or without its ISO date (the target heading).
- **S10.** `/admin/runs`: state chip first, then `○ [TAG] stale` / `✗ [TAG] failed`. The run page has an "Alliances that did not update" section, one line per alliance. `runProblems` (`lib/queries/run-problems.ts`) selects union id, tag, name, `is_fresh` and `error is not null`; no roster key.
- DESIGN.md: Navigation and hierarchy, `status-strip`, `legend`, `stat-table`, `alliance-badge`, `avatar`, `event-compare`, `status-fact`.
- Tests: `lib/schedule.test.ts` (3 target cases), `lib/queries/admin.test.ts` (`runProblems` on PGlite), `Status.test.ts` (counts apart; `NextUpdate`), `format.test.ts` (admin stamp order). Translations: `status.failedRows` (new) and `legend.rounded` (shortened) in 17 languages, written directly and stamped, as 08zzt did for its strings.
- Screenshots: `docs/screenshots/08zzv-*` (22 files, 1.8 MB).

## Decisions

- **Font source.** google/fonts `ofl/alegreya` ships only `Alegreya[wght].ttf` (variable); no static file exists there or in the upstream repo. `Alegreya-Regular.ttf` is that file instanced at wght 400 with fontTools `varLib.instancer` (267 KB, no `fvar`, family "Alegreya"). Licence: `Alegreya-OFL.txt`, copied from the same directory (SIL OFL 1.1, copyright 2011 The Alegreya Project Authors).
- **S4 fallback: `onError` in a client component.** Chrome draws the broken-image icon for an `<img alt="">` that failed; CSS cannot hide it. The ref check covers an image that failed before hydration.
- **S3 fallback: Before figures with their time, not `—`.** The card still answers "how big were they" and the time says it is not the After. The time repeats on each of the three metrics (once per figure) so it sits next to the number it qualifies.
- **S2 mechanism.** `display: contents` on `details` rather than moving the control out of the `<details>` or making the whole row a client component: no JavaScript, the native toggle and keyboard behaviour stay.
- **S8.** "Complete" means both phases have a `complete` snapshot (a `partial` one still makes the event the target). Only the nearest event's state is read; the "next" event is the one after it.
- **Count string name.** The brief called it `status.failed`; that key is taken (the phase word "failed"), so the count is `status.failedRows`.
- **B1.** The jump row has `-mb-2` so its 44 px target overlaps the legend's top margin. Without it the Russian first card was at 485 px (target 480).

## Deviations

- The `.stat-more` layout needs `::details-content` (Chrome 131, Safari 18.4, Firefox 143); older browsers keep the previous full-width Details line.
- The brief asked for a new public string for B1; none was needed (`ledger.movers` is the link's word).
- Other `MoreBar` users (`PlayerAcrossEvents`, `EventCompare`) keep the full-row control; their `lead` is null, so they have no row name in the summary (S6 applies to the `StatTable` rows only).
- One commit for items B1 to S10 (they share `EventView`, `StatTable`, `Status`, DESIGN.md and the dictionaries); H2 is its own commit.
- `lib/queries/admin.ts` was at the 300-line lint limit, so `runProblems`, `scheduledEvent` and the page loader moved to `run-problems.ts` and `admin-page.ts`.

## Verified

`pnpm check` green (prettier, eslint, tsc, vitest 241 passed, drift, i18n 17 languages). Production build served on port 3176 with the main checkout's env file (copied, deleted afterwards, never printed). Reads only: no upstream call, no `/api/quota`, no run, rehearse, record-again or manual-round button, no "Go ahead", no Discord message. Admin unlocked twice with the local PIN (no wrong attempt, none printed). Server stopped by port.

| Target | Before | Now |
| --- | --- | --- |
| First card top, `/` at 360 × 740, en (target ≤ 480) | 521 | 437 |
| Same, ru | 565 | 477 |
| Row height at 1280 on `/` (target about 62) | 111 | 61 to 62 (average 63) |
| Card height at 360 (target about 179) | 209 | 173 / 190 / 195, average 179 |
| `/` page height at 1280 | 3,155 | 2,243 |
| `/` page height at 360 | 5,789 | 5,153 (en), 5,210 (ru) |
| Movers heading y at 1280 | 2,628 | 1,716 |
| Movers heading y at 360 | 4,968 | 4,332 |
| Jump link | none | 130 × 44 px (en), 143 × 44 (ru) |
| `scrollWidth - innerWidth` at 360 and 1280 | 0 | 0 |

- **Fonts** (`CSS.getPlatformFontsForNode` on `main h1`, `/` and `/no-such-page`): en Alegreya (25, 20 glyphs); ru Alegreya (26, 21); vi Alegreya (24, 14); ja Hiragino Mincho ProN (11 and 16) with Alegreya for the 3 Latin glyphs on `/`. Screenshots `08zzv-h2-{en,ru,vi,ja}-{home,404}-360-light.png`.
- **S3 on `/events/1`:** strip reads `Last updated at Oct 17, 14:01 server time` and `✗ 1 failed`; the IMPA card reads Might 2.39B, Kills 15.0M, Members 88, each with `10:00 server time`, and `✗ Failed`.
- **S4:** `/players?q=a` has 71 images in the page (73 before), 0 broken after scrolling every one in; the compare members view 19 of 20 (1 fell back), 0 broken.
- **S5:** `/events/compare?a=2&b=3&alliance=67111155` shows 20 cards and "Show all (100)"; page 4,857 px at 360 (20,068 before); after the click 100 cards.
- **S6:** accessible names of the first three Details on `/` (Playwright `ariaSnapshot`): "Details , [NSE] Natural Selection", "Details , [OGs] OldGrandmas", "Details , [TmS] TheMightySpartans" (the space before the comma is how Chrome joins the screen-reader-only span). The open panel is 888 px wide in a 912 px row (row 61 to 224 px).
- **S7 to S10 on `/admin` and `/admin/runs` (date cookie `dd/mm`):** quota "779 of 1,000", "Not read today", "Last read after the run of Sat, 31/10/2026, 14:01 server time"; run rows "21 calls · 779 left after this run"; the target heading "Saturday Event", then "Sat, 07/11 · 3 days ago · Before not taken, After not taken" (the seed has no row for 11/07, so the nearest event is not complete); run 6 shows `partly done` first, then `○ [TEST] stale`; the run page lists "○ [TEST] Test-Tickles · stale: the game's data was old"; the gear shows Theme and Dates.
- Not verified: Safari and Firefox (the `::details-content` rule), Android, screen-reader speech, the target rule against a real Tuesday-after-complete state (covered by the unit test; the seed has no complete event for the current week), the rendered Discord picture with Alegreya (the font name and file are in the renderer; no picture was drawn).

## Open issues

- On the failed IMPA card at 360 the Members line wraps `10:00 server time` onto two lines beside the `✗ Failed` mark and the Details control.
- `PlayerAcrossEvents` and `EventCompare` Details controls still have no row name for screen readers and keep the full-row line.
- Run pages list stale and failed alliances from the rows; `lib/collector.ts` still logs no code for a stale row.
- `docs/screenshots` is about 97 MB in total; this session added 1.8 MB.
- Follow-ups from 08zzt still open: Discord webhook names, README and GLOSSARY still say "LAPTracker".

## Next

Session: 08zzw-ux-notes, the UX review's notes N2, N3, N4, N5, N7, N8, N9, N10, N11 (accepted by the owner; N1 is resolved, N6 is rejected). `docs/SESSION_PLAYBOOK.md` has no entry for it.

Model / effort: keep (opus · medium). This session's items were layout and copy in about 25 files and needed one rebuild loop each for two defects (an anchor constant imported from a client module, and the Russian first card 5 px over); the notes are smaller (one-line key, copy and keyboard changes), so there is no reason to raise it.

Owner must do first: merge this PR into `dev`.

Plan changes needed: `docs/IMPLEMENTATION_PLAN.md` §3.1, the target event rule: "Run something now" and `/api/snapshot` act on the nearest scheduled event until both its snapshots are complete, then on the next one (`targetEvent`, `lib/schedule.ts`). Not edited here.

<adjustments>
- Files this session changed that the notes will touch: `app/_ui/Movers.tsx` (N3, N4: its section now has `id={MOVERS_ID}` and `scroll-mt-20`; the id constant is in `mover-lists.ts`, not in the client file), `app/_ui/SiteFooter.tsx` was not touched (N9), `app/(pages)/events/compare/page.tsx` (N8: the members list is now inside `ShowFirst`), `app/_ui/ViewerSettings.tsx` (N2: Dates now render for the admin gear too; Times and Language stay public-only), `app/(pages)/players/[uid]/page.tsx` and `app/_ui/PlayerAcrossEvents.tsx` (N5: unchanged here; their Details controls are not inline), `app/_ui/EventView.tsx` (N7, N10: the top block is now `TopStatus`; the jump link row is a sibling of the legend).
- N7 (skip link): the first card's Tab distance fell because the jump link now precedes the legend; re-count the stops before designing the skip link. Each ledger row still has two stops (name link, Details).
- N10 ("My alliance" jump link): the first screen has less room than before; the first card is at 437 px (en), 477 px (ru) without it, and the link adds about 44 px.
- N2: the gear now has Theme and Dates on `/admin` (two groups) and Language, Theme, Times, Dates on public pages; its height at 360 on public pages is unchanged.
- `Clock.stamp` now follows the `date` cookie and keeps the year (`app/_ui/format.ts`, `orderedDay` has a `"full"` form); any note that prints a date on admin gets the chosen order for free.
- New public string `status.failedRows`; `legend.rounded` is one word. A note that adds public strings needs the translate-copy skill again (the todo list is empty now).
</adjustments>


https://github.com/daniro-san/LAPTracker/pull/211
