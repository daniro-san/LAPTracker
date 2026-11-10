# 08zzu — UX review (read-only, #174)

Persona: senior UI/UX designer, as issue #174 asks. Method and format follow `docs/handoff/07c-ui-review.md`; the capture method is the one in `docs/handoff/08zzs-brand-review.md`. No code changed. The brand review's settled items (palette, dark mode as a token swap, the three families and the hierarchy, the ornament budget, the Granny Doctor's role, drawn frames, the Discord picture) are not reopened. The brand fixes in flight on `session/08zzt-brand-fixes` (the "Event Ledger" wordmark at 360 px, the header seal, the "not yet" mark replacing `○`, "Back to the ledger", the dark wax colours) are not reported; where a finding touches one, it says so.

## Reviewed state

- Code: `dev` at `02b3198` ("docs(spike): alliance member history (#197) (#203)"), branch `session/08zzu-ux-review` cut from it.
- Where the review ran: a local production build (`pnpm build`) with the main checkout's `.env.local` (Neon preview branch, seed events of Oct 17, 24 and 31), served on port 3175. Reads only: no upstream API call, no `/api/quota`, no run, rehearse, record-again or manual-round button, no "Go ahead", no Discord message. Loading pages with photos does fetch `/img/avatar/*` and `/img/badge/*`, as every page view does (D22).
- Tooling: playwright-core 1.58.2 driving Google Chrome, axe-core 4.14.0, both in the session scratchpad. Each capture is a fresh browser context with `Network.clearBrowserCookies`, the width set by `Emulation.setDeviceMetricsOverride` (360 or 1280), the scheme by `Emulation.setEmulatedMedia`, languages by the `lang` cookie. axe was injected with `page.evaluate(axeSource)`.
- Admin: unlocked four times in total, every time with the correct local PIN read through `node --env-file=.env.local` (`process.env.EDIT_PIN`), never printed or written to a file. No wrong attempt.
- Screenshots, `docs/screenshots/08zzu-*.png`, 44 files, about 7 MB. Full pages are 1×, capped at 3,000 px; first screens, crops and mockups are 2×.
  - Full pages, 360 light: `home`, `event1`, `alliance`, `player`, `players`, `search`, `search-empty`, `compare`, `compare-alliance`, `notfound`. 360 dark: `home`. 1280 light: `home`, `alliance`, `player`, `compare`. 1280 dark: `home`.
  - First screens at 360 × 740: `home-first-screen`, `home-ru-first-screen`, `home-first-screen-mine` (after ticking "My alliance"), `alliance-first-screen`, `compare-first-screen`.
  - Open controls: `selector-360-light`, `settings-360-light`.
  - Crops: `detail-event1-strip-360-light`, `detail-event1-failed-row-360-light`, `search-broken-photo-360-light`.
  - Admin: `admin-gate-360-light`, `admin-{admin,runs,run,errors}-{360,1280}-light`, `admin-admin-360-dark`.
  - Mockups (scratch DOM and CSS changes made in the browser on the real page, then captured; none is code in the repo; a dashed seal outline marks what changed): `mock-home-top-360-light`, `mock-home-top-360-light-ru`, `mock-ledger-details-column-1280-light`, `mock-card-details-inline-360-light`, `mock-settings-360-light`, `mock-search-photo-fallback-360-light`, `mock-admin-status-360-light`, `mock-admin-runs-360-light`.

## Journeys

What each journey costs today, measured at 360 × 740 (a common phone screen) unless stated.

| Journey | Today | Where it breaks |
| --- | --- | --- |
| Player: find my alliance | OGs' card at 736 px on `/` (the bottom edge of the first screen); "My alliance" jump link at 521 px once ticked | Fine for #2; S1 for anyone further down |
| Player: see what changed this event | the changes are on each card; the ranked view ("Grandma noticed") starts at 4,968 px, under 20 cards (2,628 px at 1280) | B1 |
| Officer: who in my alliance gained or lost | alliance page Movers at 664 px, member list at 1,047 px | Fine |
| Anyone: find a player | header magnifier → `/players` → type → results; 50 results for "a", 2 broken photos | S4 |
| Officer: this event against the last | `/events/compare?a=2&b=3`; first card at 629 px; members view 20,068 px with no limit | S5 |
| Owner: before a Saturday | `/admin` Status: next run Sat 14/11; quota "779 · Low" from Oct 31; "Run something now" points at Sat 07/11 | S7, S8, S9 |
| Owner: after a Saturday | `/admin/runs` → run page: "partly done", no word on which alliance | S10 |

## Blockers

**B1. "What changed this event" is 4,968 px down the phone page, under all 20 cards, with no way to get there but scrolling.** The event page renders the ledger first and Movers ("Grandma noticed") after it (`app/_ui/EventView.tsx:193-205`); the heading measures at y = 4,968 px of a 5,789 px page at 360, and 2,628 of 3,155 at 1280. On the alliance page the same section sits above the member list at 664 px (`app/(pages)/events/[id]/alliances/[unionId]/page.tsx:311-312`), so the two pages answer the same question in opposite places. A member who opens the Discord link to see who gained and lost the most scrolls past 20 cards of 209 px each. The alliance page already solved the same problem for "Across events" with a jump link in the title row (DESIGN.md Navigation, issue #51). Proposal: a "Grandma noticed ↓" jump link on the event page's top block (mockup `08zzu-mock-home-top-360-light.png`, placed on the capture-window line; `-ru` shows it in Russian), plus S2's density change, which moves the heading from 2,628 to 1,668 px at 1280 (measured in `08zzu-mock-ledger-details-column-1280-light.png`). Moving Movers above the ledger is the other option; it would amend D53's "under the ledger" and push the first card further down, so this review proposes the link. Evidence: `08zzu-home-360-light.png` (cap at 3,000 px, Movers not reached), `08zzu-home-1280-light.png` (bottom), `08zzu-alliance-360-light.png`.

## Should-fix

**S1. On a phone the top block takes 70–76 % of the first screen before the first number.** The first card starts at 521 px in English and 565 px in Russian and Portuguese at 360 × 740: title band, date, Compare and Exact numbers, then the status strip on three rows (chip 32 px, `○ 1 stale` 20 px, Next update 32 px, 41 px in ru and pt-BR where it wraps; strip 100–109 px, `app/_ui/Status.tsx:103-120`), the capture window (20 px), and the legend on three to four lines, one of which is the sentence "≈ Rounded: tick Exact numbers for the full figure" (`lib/copy.ts:140`). Only the first card's top shows (`08zzu-home-first-screen-360-light.png`, `08zzu-home-ru-first-screen-360-light.png`). Proposal (`08zzu-mock-home-top-360-light.png`, `-ru`): the stale count on the time chip's line; "Next update at …" moved under the ledger, where the next question ("when does this change") is asked; the legend's ≈ item reduced to its word ("Rounded"; the Exact numbers toggle is beside it already). Measured in the mock: first card at 477 px in both languages (−44 px en, −88 px ru) with the B1 link added. The brand fix's 360 px wordmark goes into the header bar, not this block, so it does not change these numbers; re-measure after it lands. This is the "status strip at 360" item handed over by 08zzs.

**S2. Every ledger row spends a line on the Details control.** `MoreBar` is `col-span-full` (`app/_ui/StatTable.tsx:115`), so at 1280 each row is two lines: the numbers, then a lone "Details ▾" at the right (average row 111 px; the 20 rows fill 2,200 px). At 360 the control takes its own row under Members (average card 209 px). Proposal: at ≥ 640 px, Details as a fifth column on the row's line (`08zzu-mock-ledger-details-column-1280-light.png`: row 62 px, page 3,155 → 2,195 px, Movers 2,628 → 1,668 px); below 640 px, the control on the Members line, the shortest one (`08zzu-mock-card-details-inline-360-light.png`: card 209 → 179 px, page 5,789 → 5,219 px). An open panel still spans the full row. The same component draws the alliance page members and history rows, so they shrink with it.

**S3. A failed row is counted as "stale", and its card shows Before figures with no time.** On `/events/1` the status strip reads `○ 1 stale` while the one bad row is IMPA, marked `✗ Failed` (`08zzu-detail-event1-strip-360-light.png`, `08zzu-detail-event1-failed-row-360-light.png`). The count takes every row whose worst state is not fresh (`app/_ui/EventView.tsx:180`) and prints it with the stale word and mark (`app/_ui/Status.tsx:108-114`, `lib/copy.ts:115`). The same card shows Might 2.39B, Kills 15.0M, Members 88 with `—` beside each: those are the 10:00 figures, and nothing on the card says so (Details does). Proposal: count stale and failed apart (`○ n stale`, `✗ n failed`, each only when non-zero), and on a failed-After card show the values with their time, as the history rows do (`10:00 server`), or `—`. 07c S8 (the `#—` rank, sorted last) is fixed; this is what is left of it. The "not yet" mark change in flight (08zzt) does not touch the `○` stale mark.

**S4. A photo that fails to load shows the browser's broken-image icon.** `/players?q=a`: 2 of 73 images; the compare members view: 1 of 72 (counted after scrolling every lazy image in). `/img/avatar/[uid]` answers a bodyless 404 when the upstream photo cannot be fetched (D22), and `PlayerAvatar` renders the `<img>` whenever `hasAvatar` is true (`app/_ui/Pictures.tsx:61-70`), with no `onError` fallback. Evidence: `08zzu-search-broken-photo-360-light.png`. Proposal: on error, swap to the drawn `NoPhoto` the component already uses for "no photo" (`08zzu-mock-search-photo-fallback-360-light.png`); the same for `AllianceBadge`. Needs a client component or a CSS-only fallback (an `<object>` or the frame's background); the fix session picks one.

**S5. The compare page's members view lists every member, unpaged.** `/events/compare?a=2&b=3&alliance=67111155` is 20,068 px at 360 and 8,660 px at 1280 for 100 members (`app/(pages)/events/compare/page.tsx:110`), with no name field, sort or "Show all", where the alliance page shows 20 and a "Show all (n)" button (`app/_ui/MembersExplorer.tsx`, DESIGN.md `member-filter`). Evidence: `08zzu-compare-alliance-360-light.png` (capped at 3,000 px). Proposal: the first 20 by Might and "Show all (n)", the alliance page's behaviour; a name field only if the owner wants the full explorer there.

**S6. Twenty "Details" controls with the same name.** The summary's accessible name is "Details ▾" (`app/_ui/StatTable.tsx:116-128`); a screen-reader user tabbing the ledger hears "Details" after every alliance name, 20 times on `/` and up to 100 on the alliance page's "Show all", with nothing tying it to the row except order. Measured by focusing the first summary: name "Details ▾". axe does not flag it. Proposal: `sr-only` row name inside the summary ("Details, [NSE] Natural Selection"), from the row's `lead`.

**S7. `/admin` calls a ten-day-old quota reading "today" and marks it Low.** Status reads "API calls left today · 779 of 1,000 · Low · under 900 · After the last run, Sat, 10/31/2026, 14:01" on Tue 10/11 (`app/(pages)/admin/page.tsx:62-90`, `lib/copy-admin.ts:27`, `:32`). The quota resets every UTC day (GLOSSARY), so on the Friday before a Saturday the owner sees a seal "Low" that says nothing about that day. `/admin/runs` repeats it on every old run: "API calls: 21 · 779 left today" (`lib/copy-admin.ts:215`). Proposal (`08zzu-mock-admin-status-360-light.png`): when the reading is from an earlier UTC day, say when it is from and drop the chip (muted "Not read today"); on run rows, "779 left after this run".

**S8. On a weekday "Run something now" acts on the nearest Saturday, which can be the past one, and the page does not say so.** On Tue 10/11 the section's "Current event" is "Saturday Event 2026-11-07 · Sat, 11/07/2026, 12:00 server time" and its line reads "It can be renamed from Fri, 11/06/2026, 10:00 server time, when the scheduler sets it up" (a future-tense sentence with a past date, `lib/copy-admin.ts:78`), while Status, 700 px above, says the next run is Sat 11/14. `currentEvent` is the event nearest to now (`lib/schedule.ts:116`; the route uses it, `app/api/snapshot/route.ts:31`), so from Wednesday the target flips to 11/14. The only time guard is "not before Before" (`lib/run.ts:107`), so a Before press on Tuesday would record Tuesday's numbers as the 11/07 Before if that phase is missing. Pressing was not tried (session rule). Proposal (annotated in `08zzu-mock-admin-status-360-light.png`): name the target with its state and age ("Sat 07/11 · 3 days ago · both snapshots done") and, when it is past and complete, say so beside the seals; the `renameLater` line only while the date is ahead. Whether the target should be the next event instead is a plan question (§3.1), not a copy one.

**S9. Admin dates are in US order and the owner cannot change it (07c S3a, 08zzs L4).** Every admin date reads `Sat, 10/31/2026, 14:01 server time` with Chrome's `en-US`. `requestServerClock` builds the clock from the request locale only (`app/_ui/locale.ts:115-117`), never from the `date` cookie, and the admin gear shows the theme only (D38). With `Accept-Language: en-GB` the same code prints `Sat, 31/10/2026` (`08zzu-mock-admin-status-360-light.png` was captured that way), so the fix is to pass the viewer's `date` choice into the admin clock (server time stays) and show the Dates group in the admin gear. Also unchanged from 07c: generated names in raw form on admin ("Saturday Event 2026-11-14 · event Sat, 11/14/2026": the date twice in two formats).

**S10. After a Saturday the owner cannot see which alliance made a run "partly done".** `/admin/runs` puts the state chip last on each card, under four lines (`app/(pages)/admin/runs/page.tsx:62`). The run page (`app/(pages)/admin/runs/[id]/page.tsx`, `getRun` in `lib/queries/admin.ts`) reads `snapshots` and `run_logs` only, not the rows' freshness, and I found no log code for a stale row in `lib/collector.ts` (only `board.failed` and `internal.fallback`), so a stale alliance (HTTP 200, old `updated_at`) appears nowhere on the run page. In the seed, Run 6 says "partly done", "No upstream call was logged", "No log lines" (`08zzu-admin-run-360-light.png`); the public page knows it is `[TEST]`. Proposal (`08zzu-mock-admin-runs-360-light.png`): the state chip first on each run card, followed by the stale and failed tags (`○ [TEST] stale`); on the run page, a line per alliance that is not fresh, from the snapshot's rows.

## Notes

- **N1. Alliance page length (07c N5, handed over by 08zzs): resolved.** 5,955 px at 360 (was 18,806): the member list shows 20 and "Show all (100)", "Across events ↓" jumps to 4,779 px, "Back up ↑" returns. Leadership does not render on the seed; `08zzl-*` and `08zzd-*` stay its reference.
- **N2. Settings panel density (08zzs L3).** 11 framed controls (a select and 10 radio frames), 497 px tall at 360 × 740, opens at 52 px, fits without scrolling. Dates as one native select, like Language, makes 6 frames and 441 px (`08zzu-mock-settings-360-light.png`; today `08zzu-settings-360-light.png`). The saving is 56 px; worth doing only with another change to the gear. Keyboard: 4 Tab stops (select, then one per radio group), Escape from inside closes it and returns focus to the gear.
- **N3. In Movers, `#` means two things side by side.** Alliance lines show the ledger rank (`#1`, `#3`, `#2` in that order on Oct 31), member lines the place in the list (`#1 … #5`), in two columns from 640 px (`app/_ui/Movers.tsx:27-28`, DESIGN.md `movers`). The rank move after the alliance number (`#3 =`) is the only difference. `08zzu-home-1280-light.png`, bottom.
- **N4. Movers tabs: Arrow keys work (roving tabindex, automatic activation); Home and End do not** (`app/_ui/Movers.tsx:121`). The WAI-ARIA tabs pattern lists them as optional.
- **N5. The player page names one number two ways**: "SANCTUARY 27" in the band (`app/(pages)/players/[uid]/page.tsx:89`) and "LEVEL 27" in "Across events" (`app/_ui/PlayerAcrossEvents.tsx:32`). DESIGN.md `player-summary` chose Sanctuary; the member list and Leadership say Level.
- **N6. Player breadcrumbs at 360 wrap the player's name onto its own line right above the same name as the page title** (`08zzu-player-360-light.png`).
- **N7. No skip link.** On `/` at 360 the keyboard reaches the first card at the 7th Tab and the Movers tabs at about the 47th (two stops per card, 20 cards). With B1's jump link the gap closes; a skip link would also help.
- **N8. Compare shows each event's change, never the difference between them.** The owner's question was "how much might people lost in one and in the other" (D57); the card answers it by two stacked numbers per figure and the reader subtracts. Not proposed for change; listed because it is the page's one question.
- **N9. Footer disclaimer** (08zzp, owner's decision): a four-line paragraph on every public page at 360; recorded here because DESIGN.md says a public page has no paragraph.
- **N10. "My alliance"**: ticking it on the alliance page puts a jump link at 521 px on `/` and tints the row; axe stays clean with the tint (07c S5's residue at 4.03:1 is not flagged by axe). `08zzu-home-first-screen-mine-360-light.png`.
- **N11. Running and empty states** do not exist in the seed (no event without snapshots is listed, no run is in progress), so the empty ledger, "Updating now" and the running chip were reviewed in code only (`app/_ui/Status.tsx:40-57`, `app/_ui/event-rows.ts` `emptyLine`).

## What I checked and found correct

- axe-core 4.14: zero violations on 10 public pages × 360/1280 × light/dark (40 runs) and on `/admin`, `/admin/runs`, a run page and `/admin/errors` × 360/1280 × light/dark (16 runs), plus the PIN gate.
- No horizontal scroll: `scrollWidth == innerWidth` on all 56 page loads above.
- Tap targets: zero interactive elements under 44 × 44 on every public and admin page at 360 and 1280, counting each card's stretched link by its card (the visible name link is 24 px tall; its `::after` covers the card). The event selector's options are 44 px each. 07c S9 (header brand link, breadcrumb root) is fixed.
- 07c carry-overs: S4 fixed (at 1280 a row reads "Might 4.37B …", the label `sm:sr-only`, `app/_ui/StatTable.tsx:60`); S6 fixed (`Sheet` is a real `<dialog>`; the gate is an open dialog named "Admin PIN", field 328 × 44, `lib/brand/components/Sheet.tsx`); S7 fixed (`<html lang="ru">` in Russian, per-page titles such as "[OGs] OldGrandmas · сб, 31 окт. · OG's LAP Tracker"); S8 fixed (`#— —`, sorted last); S11 fixed (badges served at 80 × 80, 7.8 KB, `app/img/resize.tsx`); S12 fixed (Joined `+` yarn, Left `−` seal, `app/_ui/MembersExplorer.tsx:42-43`; the selector and gear close on Escape with focus back on their summary and on a tap outside, `app/_ui/Disclosure.tsx`; the selector is named "Events").
- Focus: the first 14 Tab stops on `/` at 360 all draw an outline; header order is brand, Players, event selector, settings, then Compare, Exact numbers, then card name and Details per card.
- Details opens and closes with Enter and Space.
- Dark mode: same results as light everywhere (axe, overflow, targets).
- Search: empty query shows only the field; no match shows the Granny Doctor with her magnifier under the field (`08zzu-search-empty-360-light.png`); 50 results end with the limit line.
- 404: the line, the vignette and one button (`08zzu-notfound-360-light.png`); the button's wording is in flight (08zzt).

## Built

- `docs/handoff/08zzu-ux-review.md` (this file) and 44 screenshots under `docs/screenshots/08zzu-*`. Nothing else.

## Decisions

- Severity: Blocker for a journey #174 names that fails on a phone (B1); Should-fix for a measured problem a member, officer or the owner meets in normal use; Notes for the rest. There is one Blocker because nothing measured is broken (axe, overflow and targets are clean); B1 ranks there because "see what changed this event" is the page's main question and needs 4,968 px of scrolling.
- B1 proposes a jump link rather than moving Movers above the ledger: moving it would amend D53 and push the first card further down, against S1.
- Mockups are scratch DOM and CSS changes on the running pages, captured with a dashed outline on what changed; the mock scripts are in the session scratchpad, not in the repo. Where a mock could not be made faithfully in the DOM (S7's chip), the crop is annotated with a note instead.
- Admin unlocks: four, all with the correct PIN (one per browser context: two for the light and dark sweep, one that timed out waiting 2.5 s and was re-run with a wait on the page state, one for the admin mockups).
- Four full-page captures that repeated another (event 1 at 1280, alliance and compare dark at 360, search at 1280) were deleted before committing.

## Deviations

- `next start` was stopped twice by a SIGTERM from outside this session (exit 143, a minute or two after start; another session stopping its own server by name is the likely cause). The same build was then served by a 10-line programmatic Next server (`next({ dev: false })` with `http.createServer`) on the same port, under a different process name. Same build output, same `proxy.ts` (the CSP header with a nonce was checked on `/`).
- The issue lists "event" and "event-vs-event" pages; `/` and `/events/1` cover the event page, `/events/compare` and its members view cover compare.
- Leadership, the empty ledger and a running state are not in the seed and were not measured (N11).

## Verified

- `pnpm check` on this branch after the screenshots and this file were added (the branch changes no code): see the PR.
- Every number above comes from scripts run on 2026-11-10 against the local build: the sweep (overflow, axe, targets, 56 page loads), the target re-measure with stretched links, the layout probe (positions, card heights, strip heights in en, ru, de, pt-BR, ja, vi), the broken-image count, the keyboard script (selector, gear, Movers tabs, Details, Tab order), the "My alliance" flow, the event 1 card texts, the admin sweep, and the mock measurements. The scripts live in the session scratchpad.
- Not verified: the pages on Vercel (same code); Android and Windows; screen-reader output (names were read from the DOM, not heard); the confirm sheet (opening it needs a run button press, which this session may not do); what a late Before press does on the server (S8 is read from `lib/run.ts:107` and `app/api/snapshot/route.ts:31`).

## Open issues

- `next build` did not write an `AGENTS.md` this time; nothing to delete.
- The 08zzt brand fixes change the header (wordmark, seal) and the "not yet" mark; S1's first-screen numbers should be re-measured after they merge.

## Next

Session: the fix session for the accepted UX findings of #174 (next free number, `session/<NN>-ux-fixes`). `docs/SESSION_PLAYBOOK.md` has no entry for it, so the shape follows the handoff contract.

Model / effort: keep (opus · medium). The accepted items are layout and copy in about a dozen files (`EventView`, `StatTable`, `Status`, `Pictures`, the compare page, the admin page, `locale.ts`, `copy.ts`, `copy-admin.ts`), each with a mockup and a number to reach; none touches the collector or the schema except S10's run-page line, which reads rows the database already has. New public strings (the Movers jump link, the failed count) need the translate-copy skill, as 08zzo did.

Owner must do first:
1. Merge this PR into `dev`.
2. Merge the 08zzt brand fixes first: the header wordmark and the "not yet" mark change the top block S1 measures.
3. Mark each numbered line below accept or reject; for S8, say whether "Run something now" should target the next event (a plan §3.1 change) or keep the nearest one with clearer words.

Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md` unless S8 changes the target event (§3.1). `docs/DESIGN.md`, in the same commit as the fixes: Navigation and hierarchy (a jump link to Movers, B1; "Next update" under the ledger, S1), `status-strip` (stale and failed counted apart, S3), `legend` (≈ item as one word, S1), `stat-table` (Details as a column at ≥ 640 px, S2), `avatar` and `alliance-badge` (fallback on a failed load, S4), `event-compare` (members view: 20 and Show all, S5), `admin-section` / `status-fact` (quota age, S7). Not edited here.

<adjustments>
1. B1 — "Grandma noticed ↓" jump link in the event page's top block, like "Across events ↓" (#51). Accept / reject (or move Movers above the ledger instead, amending D53).
2. S1 — top block: stale count on the time chip's line, "Next update" under the ledger, legend ≈ as one word. Target: first card at ≤ 480 px at 360 × 740 in en and ru (today 521 / 565). Accept / reject.
3. S2 — Details as a fifth column at ≥ 640 px (row 111 → about 62 px) and on the Members line below 640 px (card 209 → about 179 px). Accept / reject, or one width only.
4. S3 — stale and failed counted apart in the strip; a failed-After card shows its figures' time or `—`. Accept / reject.
5. S4 — drawn placeholder when a photo or badge fails to load (no broken-image icon). Accept / reject.
6. S5 — compare members view: first 20 by Might and "Show all (n)". Accept / reject.
7. S6 — each Details summary carries the row's name for screen readers. Accept / reject.
8. S7 — quota from an earlier UTC day shows its date and no Low chip; run rows say "left after this run". Accept / reject.
9. S8 — "Run something now" names its target's date, age and state; the rename line only while the date is ahead. Owner: keep the nearest event, or target the next one (plan §3.1)?
10. S9 — admin clock uses the viewer's `date` cookie (server time kept) and the admin gear shows Dates; generated event names shown once, as a date. Accept / reject.
11. S10 — runs list: state chip first with the stale and failed tags; run page: one line per alliance that was not fresh. Accept / reject.
12. N1–N11 — notes. Take N2 (Dates as a select) only with another gear change; N3–N6 are one-line copy or key changes if wanted.
</adjustments>

<adjustments for="the #173 fix session (08zzt)">
- After the 360 px wordmark lands, re-measure the first card's top on `/` at 360 × 740 in en and ru (today 521 / 565 px); this review's S1 target (≤ 480 px) assumes the wordmark stays inside the header bar without making it taller.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/208
