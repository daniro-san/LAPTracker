# 08zzzze — Live event progress on the event page (#307)

Closes #307.

This branch is stacked on PR #292 (`session/08zzzza-event-samples`, event samples, not yet merged). Merge #292 first; this PR's base is that branch until then.

## Built
- **Pure arithmetic** `lib/live.ts` (test `lib/live.test.ts`):
  - `standings(start, samples)`: each alliance of the Start with its might and kills change at the latest sample; most kills gained first; no change when either side is stale or the alliance was not read in the latest sample (glossary "stale", INVARIANT `freshness.no-stale-delta`, reuses `delta` from `lib/compute.ts`).
  - `serverPulse(readings, everyMs)`: kills gained per interval across the alliances, between consecutive readings of each alliance. Each interval has a state: `moved`, `still` (alliances compared, no number changed: "no update from the game"), `missing` (no reading, or nothing comparable). It also holds how many alliances were compared.
  - `busiestSpan(slots)`: the two consecutive intervals (30 minutes at the 15-minute cadence) with most kills, and their share of all kills gained; needs both intervals compared.
  - `nextReading(now, everyMin, afterAt)`: the next reading the page waits for and when to look again (that reading + 60 s; the End + 2 min), null after the End has had its time or when sampling is off.
- **Read model** `eventProgress(db, eventId, {now, everyMin})` in `lib/queries/live.ts` (test `lib/queries/live.test.ts`), exported from `lib/queries/index.ts`. One select of alliance totals (`total_power`, `total_kills`, `is_fresh`) per Start and sample reading, joined to the event row (`publicEvent`). It never reads the member arrays and never reads the End's alliance rows. It returns `live`, `readings`, `latestAt`, `next`, `standings`, `pulse`, `busiest`, `everyMin`; null when the event is not public or has no usable Start or sample.
- **UI** (mobile-first, cards below 640 px):
  - `app/_ui/LiveProgress.tsx`: `LiveStrip` ("Live · updated 12:30 · next 12:45 server time" in a plum chip with a ringed dot, plus "n readings so far"; the viewer's clock per D38), `Standings` (a `StatTable` of Kills and Might, `from → now` with the change; rows link to the alliance's event page; a "Stale" or "No data" note under the name when there is no change), `LiveSections`.
  - `app/_ui/LivePulse.tsx`: `Pulse` with HTML/CSS bars (no library), the busiest 30 minutes underlined and named in text ("Busiest 30 minutes so far: 13:45–14:15 server time · 42% of the kills"), a legend for the hollow stub ("No update from the game") and the hairline ("No reading") only when such intervals exist, and a Details disclosure (`MoreBar`, the details-bar pattern) with the table interval / kills gained / alliances.
  - `app/_ui/LiveRefresh.tsx`: client component, one `router.refresh()` at `refreshAt` (an ISO time from the server). It re-arms when the page comes back with a new time, holds no timer while `document.hidden`, refreshes once on return if the time passed, and is not rendered when the event is not live.
  - Placement: live = strip under the event title, then pulse and standings above the ledger. Finished = one "During the event" section below Movers, with "At the last reading" for the standings. Events without samples render as before.
  - `EventView.tsx` loads the progress through `loadProgress` (`app/_ui/event-page.ts`, per request, not cached, because it depends on `now`); `getEventPage` is unchanged, so the samples test that compares pages with and without samples still holds. `EventHead` was split out of `EventView` for the lint length limit.
  - `StatRow.liveUnion` (`StatTable.tsx`) and a change in `MyAllianceJump` (`MyAlliance.tsx`): the viewer's own alliance is also highlighted (`data-mine`) in the live standings.
  - `shareText` in `format.ts`: a whole-number percent in the viewer's locale.
- **Copy:** 15 keys in the `ledger` block of `lib/copy.ts` (`live`, `liveUpdate`, `liveReadings`, `liveStandings`, `liveStandingsDone`, `liveDuring`, `liveStandingsHelp`, `livePulse`, `livePulseHelp`, `liveBusiest`, `liveBusiestDone`, `liveNoUpdate`, `liveNoReading`, `liveInterval`, `liveKillsGained`), translated into 16 languages with the translate-copy skill (3 translators at a time), stamped; glossaries gained rows.
- **Seed:** `scripts/seed-samples.ts`, called from `scripts/seed.ts` for the latest seed event (Saturday 2026-10-31, Start 12:00Z, End 16:00Z): 15 samples (12:15Z–15:45Z). Heavy fighting 14:15Z–15:00Z (12:15–13:00 server); about 3.5 B of might lost across the 20 alliances; kills move in steps and each alliance updates every 10 to 13 minutes (so an interval holds 0, 1 or 2 updates); might moves at every reading for most members; the last sample has one stale alliance and one failed. Deterministic (`noise` is now exported from `seed-data.ts`).
- **Screenshots** in `docs/screenshots/`: `08zzzze-live-360.png` (Chrome, light), `08zzzze-live-390-webkit-dark.png`, `08zzzze-finished-360.png`, `08zzzze-live-768.png`.

## Decisions
- **No `eventSamples` for the page** (coordinator review, 2026-11-16): its rosters are about 63 KB per reading, about 1.6 MB per view for 26 readings, and the page refreshes once per slot per viewer. `eventProgress` reads alliance totals only. `eventSamples` is unchanged and still the read model for member-level charts.
- **Cumulative since Start for the standings; the busiest span is two intervals** (coordinator review): the game updates an alliance's numbers every 10 to 13 minutes (measured 2026-11-16), so a 15-minute interval holds 0, 1 or 2 updates and a single interval's bar can alternate high and low without any change in play. An interval where no compared alliance changed is a hollow stub with the words "No update from the game" (legend and Details table), not a bar of 0. An interval with no reading is a hairline with "No reading".
- **An alliance's change is read at the latest sample only.** If that sample has no usable row for it (failed) or is stale, it shows no change and a word ("No data", "○ Stale"); an older fresh sample is not substituted.
- **A sample counts only if it has at least one usable alliance and is not `running`.** A missing reading makes its interval `missing`; a gap longer than one interval gives one `missing` interval per slot.
- **Live means:** the Start's snapshot is not `running`, the End has no row at all (a running End counts as run), and now is before the End plus 2 minutes. After that the strip and the refresh stop even if the End never came.
- **Next reading:** the slot holding `now` still counts for its first 60 seconds (its sample is expected 60 s after the slot), so a viewer who opens the page at 12:30:10 is told "next 12:30" and refreshes at 12:31:00, not at 12:46. This differs from the issue's "next slot + 1 minute" only in that first minute. A slot at or after the End's own slot has no sample, so the next reading is the End, and the refresh is at the End + 2 minutes.
- **Placement above the ledger while live**, because the ledger shows only Start figures until the End; below Movers when finished, because the End's ledger is then the main story.
- **"Readings so far" is the number of samples** (the Start is not counted).
- **The strip and sections need at least one usable sample.** In the first 15 minutes after the Start the page looks as before.
- **Hardening in `serverPulse`:** `everyMs <= 0` returns no intervals, so a past event stays readable when `SAMPLE_EVERY_MIN` is later set to 0 (the pulse is then empty and the standings still show).
- **Seed:** the plain seed now samples its latest event, so the preview and local runs show the finished variant. The live variant is made locally (below), not by a seed flag.

## Deviations
- **"Who fought" becomes "so far" until the End** (issue text): not done in the first pass, because the page had no `WhoFought.tsx` on this branch then. Done in "Review fixes (2026-11-16)" below.
- **"Next slot + 60 s"** is refined as described in Decisions.
- **Busiest "15 minutes" in the task is "30 minutes"** and the not-updated interval is shown as such, as the coordinator's message required.
- **Extra edits outside the new files:** `StatTable.tsx` (`liveUnion`), `MyAlliance.tsx` (highlight in the live list), `format.ts` (`shareText`), `scripts/seed-data.ts` (`export` on `noise`), `app/_ui/EventView.tsx`, `app/_ui/event-page.ts`.
- **`pnpm check` ran with vitest limited to 4 workers.** See Verified.

## Verified
- `pnpm check`, in steps (the machine's load average was 31 to 43 from other sessions, so `vitest` at default concurrency timed out in 1 to 4 tests per run, always different ones, mostly the first test of a file that opens PGlite; `app/(pages)/admin/gate.test.ts` passes alone in 1.6 s):
  - `prettier --check .`: all matched files use Prettier code style.
  - `eslint .`: clean (after splitting `EventHead`, `LivePulse.tsx` and `readSlices` for the length and complexity limits).
  - `tsc --noEmit`: clean.
  - `vitest run --maxWorkers=4 --testTimeout=60000`: `Test Files 62 passed | 1 skipped (63)`, `Tests 297 passed | 1 skipped (298)`.
  - `scripts/check-drift.ts`: "Everything's fine".
  - `scripts/i18n-check.ts`: "i18n: 17 languages up to date with English".
- New tests (13): `lib/live.test.ts` (change since Start with a stale reading and a missing one, most kills first; pulse per interval with `moved`, `still`, `missing` and the compared-alliance count; a stale alliance left out of an interval; the busiest span and its share; none without two compared intervals; `nextReading` inside a slot, at a slot boundary, for the End's slot and after the End, and with sampling off). `lib/queries/live.test.ts` (live between Start and End with latest, next and change; not live after the End with readings kept; null without samples; stale latest sample gives no change).
- Local Postgres (D47) with the seed, dev server on `localhost`:
  - Finished event (`/events/3`): "During the event" below Movers, 15 bars, busiest 12:15–12:45 server time (the seed's heavy hour), 20 standings cards, "No data" for the failed alliance and "○ Stale" for the stale one in the last sample.
  - Live variant, made with local SQL (delete the End and its members, delete the last samples, shift every event and snapshot time by a multiple of 15 minutes so the latest sample is the current slot, mark one alliance stale): strip "Live · updated 14:45 · next 15:30 server time", "12 readings so far", pulse and standings above the ledger. With one interval copied from the previous reading and one sample deleted, the hollow stub, the hairline and the legend appear and the busiest span skips the missing intervals.
  - Refresh (Playwright fake clock, Chrome): no request after load; one RSC request after the time passed; none while the tab is hidden for 20 minutes; one on return.
  - Widths 360, 390, 412, 768 and 1024: no horizontal overflow in Chrome and WebKit. The Details control is 44 px tall in WebKit at 360. The alliance name links in the standings are 24 px tall as links, with the whole card as the tap area (`TextLink stretch`, like the ledger).
  - WebKit 390 dark and Chrome 360 light screenshots reviewed by eye.
- Not run: a live KvK (none sampled yet), a real tick writing samples into this page, Neon, Safari on a device, or the page in a language other than English in a browser (strings are checked by `i18n-check` only).

## Open issues
1. **Real numbers:** the seed's profile is invented. The first sampled KvK (2026-11-21) should be checked for how many intervals show "No update from the game" and whether 30 minutes is the right busiest span.
2. **The page has two "updated" signals while live:** the live strip (latest sample) and the existing status chip "Last updated at …" (the Start's time until the End exists). Not changed.
3. **Zero samples after the Start:** for the first 15 minutes no strip shows and no refresh runs, so a viewer who opens the page then sees the old page until they reload.
4. **A running or late End:** the page refreshes once at the End + 2 minutes. If the End is still running then, the page is not live and does not refresh again; the viewer reloads.
5. **Long page while live:** 20 alliance cards sit above the 20 ledger cards on a phone. A "Show all" list (`ShowFirst`) cannot wrap `StatTable` as it is.
6. **Pre-existing:** `pnpm db:local:seed --reset` fails on a fresh local database (`truncate … rehearsal_slots` names a table that does not exist). Run without `--reset` on an empty database. Not fixed here.
7. **Pre-existing:** the full `vitest` run is not reliable under a load average above about 20: default concurrency and a 10 s timeout fail different tests each run.
8. **"Who fought" until the End** (issue #307): done in "Review fixes (2026-11-16)" below (`memberTurnoutSoFar`).

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after this one (`08zzzza`'s handoff lists two prompt sketches: the charts and the window build). Reading both with this change in mind:

Model / effort: keep for both. This session's size matched them and the one problem it met (a heavy read, see Decisions) was caught by review, not by effort.

Owner must do first: merge PR #292, then this PR, and release both before Friday 2026-11-20 12:00 UTC (Open issue 1 of `08zzzza`: `SNAPSHOT_BEFORE=10:00`, `SNAPSHOT_AFTER=16:15`). After Saturday, compare the page with the real samples (Open issue 1 above).

Plan changes needed: none in this PR. In the charts sketch of `08zzzza`'s Next, item 1's V1 pulse and the "Busiest 15 min" line are now built (`lib/live.ts`, `app/_ui/LivePulse.tsx`) and the busiest span is 30 minutes; amend that sketch, do not edit the playbook here.

<adjustments>
- V1 pulse and the "During the event" section are done. Build V4 (heatmap) and V5 (my alliance) in that section; reuse `serverPulse`, `standings` and `Slice` from `lib/live.ts`, and read totals the way `eventProgress` does.
- Do not read `eventSamples` rosters on the event page: about 1.6 MB per view at 26 readings, and the page refreshes once per slot. Use it only where members are needed (V5 for one member, on that member's page), and select one alliance's arrays in SQL if possible.
- The game updates each alliance every 10 to 13 minutes, so a 15-minute cell holds 0, 1 or 2 updates. A heatmap of per-slot gains will look striped. Prefer cumulative lines or a 30-minute cell, and show "no update from the game" as its own state, not as 0.
- The window build must keep `nextReading` (`lib/live.ts`) and `eventProgress` working: they read the End's existence from `snapshots.phase = 'after'` and the Start from `phase = 'before'`; with windows, both move to the window's first and last samples.
</adjustments>

## UX review fixes (2026-11-16)

Branch `fix/08zzzze-live-ux`, on top of `session/08zzzze-live-event` with `session/08zzzza-event-samples` (035de41) and `origin/dev` (#318) merged. Both merges left a duplicate `shareText` in `app/_ui/format.ts` and duplicated tables in 12 `lib/i18n/glossary/*.md`; both were fixed.

- B1: `busiestSpan(slots, total)` divides by the kills gained since Start (sum of the standings' changes, `EventProgress.killsTotal`), not by the sum of the compared intervals. The share is capped at 100%. One test in `lib/live.test.ts` with a missing interval. Checked on a local database with a missing reading: 30.25 M of 72.63 M = 42%, as shown.
- S1: while live there is no "Last updated" chip (`StatusChips` `live`); the capture window shows `END after 16:30 server time` instead of `END —` (`CaptureWindow` `endDue`, key `status.endAfter`). After the End the chip is back. The "Start 12:31 · End not yet" fallback was not built: the End's due time is always known.
- S2: the strip shows from the Start: "Live · Start 15:37 · first reading 15:45 server time" and "No readings yet" (keys `ledger.liveFirst`, `ledger.liveNoReadings`). `eventProgress` returns progress for a live event with no sample (`latestAt` null, `startAt` added); the pulse and standings render only when `readings > 0`. `LiveRefresh` still arms at the next slot + 60 s (same `nextReading`).
- S3: the busiest line needs 4 compared intervals (`BUSIEST_MIN_INTERVALS` in `lib/live.ts`, applied in `lib/queries/live.ts`, so the underline also waits). Before that, while live: "Kills so far: <compact total>".
- S4: ordinary bars `bg-plum/60`: measured 3.66:1 light, 3.01:1 dark. Hairline `bg-ink/50`, not the `/45` asked for: `/45` measures 2.75:1 light; `/50` measures 3.15:1 light and 4.30:1 dark. Busiest pair stays full plum (11.35 and 6.21). Dark ordinary bars pass by 0.01.
- S5: after the End the standings help reads "Change since Start at the {time} reading. The ledger above uses the End at {end}." (key `ledger.liveDone`). When the End never ran (window passed) the standings keep the live help.
- S6: "During the event ↓" jump link beside "Grandma noticed ↓" (same classes, 44 px high), target `#live-during`; shown only when the finished event has a reading. Checked at 360: the link is 44 px high and the jump lands on the section.
- S7: `overdueSlot` in `lib/live.ts`: the current slot, when after the latest sample (or the Start), before the End's slot and more than 3 minutes old. The strip appends "(reading due 16:15)" (key `ledger.liveOverdue`). Checked with a local database 20 minutes behind: "updated 16:00 · next 16:30 server time (reading due 16:15)".
- N1: live standings show the top 5 and the viewer's own alliance with "Show all (20)": new client component `app/_ui/LiveStandings.tsx` reuses `visibleEntries` and `ShowAllButton`. `StatRow` got `mine`, so the viewer's row is marked even when it renders after `MyAllianceJump` ran.
- N2: each standings card starts with its rank "#1" (position in the full standings; "#—" for an alliance with no change).
- N3: under the busiest line, while live: "Last 15 min: 1.64M (peak 16.6M)" (key `ledger.liveLast`; the peak is the largest single interval).
- N4: the first interval starts at the Start's own time (finished time, else started time), not the scheduled one: the axis reads 12:31, as the Start does.
- N5: stub `h-2` (bars and legend), legend `text-sm`.
- Takeaway: the strip has "Kills so far: NSE +13.4M · OGs +9.11M · TmS +8.24M" (top 3 by kills gained, tag and compact signed gain; key `ledger.liveKillsSoFar`, shared with S3's total). Compact figures use 3 significant digits, so the examples read `+9.11M` and not `+9.1M`. At 360 it wraps to two lines.
- Copy: 7 new keys (`ledger.liveFirst`, `liveNoReadings`, `liveOverdue`, `liveKillsSoFar`, `liveLast`, `liveDone`, `status.endAfter`), translated to 17 languages with the translate-copy skill and stamped. `lib/copy.ts` was at the 300-line limit; `liveDone` is short enough to stay on one line.
- Verified: `pnpm check` green (335 tests passed, 1 skipped; the i18n gate says 17 languages up to date). Local database from the seed on a scratch Postgres cluster (`lt_seed`, scratch copy `lt_run`; the `lap` database was not touched). States early (Start only), few (2 readings), live, live with a gap (sample 10 copied from 9, sample 14 missing), finished, and live with a late reading. Chromium and WebKit, light and dark, at 360 and 768: no horizontal overflow in any of the 40 captures. Screenshots: `docs/screenshots/08zzzze-live-360.png`, `08zzzze-early-360.png`, `08zzzze-finished-360.png`, `08zzzze-live-768.png`, `08zzzze-live-360-webkit-dark.png` (replaces the 390 one).
- Not done / follow-ups: the strip and the capture window both show the Start time while live (S1 asked for both). An event whose End never ran after the window shows the finished layout with "Last updated" and "During the event"; not changed.

## Review fixes (2026-11-16)

Work on top of 905b43f (samples #292 final, D72 merged). Items in the order of the review.

1. `LiveRefresh` (`app/_ui/LiveRefresh.tsx`): takes `renderedAt` (the server's render time, `EventProgress.asOf`) beside `at`, waits `at − renderedAt` on the server's clock (at least 1 s), and has both in the effect dependencies. Every render re-arms; a client clock that is ahead no longer fires early and stops. A render that is already past `at` retries after 1 s, not in a tight loop. Not exercised end to end (the wait is up to 15 minutes); the logic is in the effect only.
2. `serverPulse` (`lib/live.ts`): a gap of two or more cadences, counted by rounding the gap to whole cadences, gives that many `missing` slots, the first starting at the earlier reading and the last ending at the later one. An off-grid Start (12:01) with 12:15 missing and a sample at 12:30 gives 12:01–12:16 and 12:16–12:30. A gap that rounds to one cadence is compared as before. One test.
3. `standings` (`lib/live.ts`): each alliance's change is at its newest fresh sample (`Standing.at` is that sample's time). The card says "Last updated at 16:45 server time" (existing key `status.lastUpdated`) when that reading is older than the newest one. Two existing assertions changed (stale at the newest reading now gives the older change); one test added for an alliance with no usable sample.
4. "Who fought" while live (`lib/queries/turnout.ts`): `memberTurnoutSoFar(db, eventId, startId)` compares the Start's member rows with each alliance's newest usable sample's `member_uids`/`member_kills`. It selects those arrays for one alliance row per alliance (about 20 rows), never all samples'. The list building is shared with `memberTurnout` (`turnoutLists`). `getEventPage` uses it while there is no End snapshot; with an End the behaviour is as before. `TurnoutLists.soFar` (optional) switches the title to the new key `ledger.foughtSoFar` ("War turnout so far"). The help line under it still says "at Start and at End" (only the title was to change). One test. The two handoff lines that said `WhoFought.tsx` does not exist are corrected.
5. `LiveSections`: while live the wrapper has `mb-6`, so "Show all (20)" no longer touches the first ledger card.
6. D68: copied from `origin/session/08zzzx-player-daily-progress` (#288): `docs/decisions/D68-charts-are-hand-built-inline-svg.md` byte for byte; the README line; the CLAUDE.md UI line; the two DESIGN.md lines (`line-chart` and `player-progress`). The DESIGN.md hunk and the two README/CLAUDE.md lines were taken from that branch's diff against dev; the README line sits after D67 as there. The `player-progress` line describes a component that is not on this branch; it was taken so the two branches merge without a conflict. The `LivePulse` header cites D68 and says its bars are HTML boxes, not SVG (D68's form is a line chart): a departure from D68's "what a chart is" that the owner can accept or ask to redraw.
7. `MyAlliance.tsx` is back to the dev version; `StatRow.liveUnion` and `data-live-union` are gone. `LiveStandings` marks its own rows with `StatRow.mine`.
8. `eventProgress` stays its own reader: `eventSamples(db, id, { rosters: false })` drops running snapshots, takes the Start's time from the schedule (the first interval and the strip use the Start's own time) and does not tell an End that is running or failed from none. One comment in `lib/queries/live.ts` says so; the INVARIANT comment in `lib/queries/visibility.ts` now names `eventProgress` and `memberTurnoutSoFar`.
9. `lib/queries/live.test.ts`: a live event with no sample yet (non-null, `latestAt` null, 0 readings, empty standings and pulse) and busiest null below 4 compared intervals.
10. `app/(pages)/events/[id]/page.tsx` reads `loadProgress` and `loadEventPage` in one `Promise.all` and passes `progress` to `EventView`; the home page still reads it inside `EventView` (an undefined `progress` prop means "read it here").
11. The top-3 line joins each tag and its figure with a no-break space. The chip's "(reading due 17:15)" is a block of its own under the times, so it never splits "server time".

Lint limits made three splits: `TopStatus` moved from `EventView.tsx` to `app/_ui/TopStatus.tsx`, `standingNote` and `metric` moved out of `Standings`, and `lib/copy.ts` (at its 300-line limit) lost three lines by writing `time` on one line, to fit `foughtSoFar`.

WebKit lowercase compact units: not caused by this PR. WebKit in Playwright reports `navigator.language` `en-GB` (`navigator.languages` `["en-GB"]`, Chromium `en-US`). `pickLanguage` (`app/_ui/locale.ts`) keeps the viewer's own tag for the language ("en-GB keeps `31 Oct`"), so every number goes through `Intl.NumberFormat("en-GB", { notation: "compact" })`, whose CLDR short forms are `k`, `m`, `bn` (Node 26: `60.1m`, `4.29bn`, `271k`; en-US and en-AU give `M`, `B`, `K`). It affects every page and every compact figure for a viewer whose Accept-Language is en-GB, including the ledger cards on dev. `compact()` in `app/_ui/format.ts` was not changed. Follow-up: decide whether English readers should always get `K/M/B`.

Verified: `pnpm check` green: 71 test files passed, 1 skipped; 350 tests passed, 1 skipped; i18n "17 languages up to date with English". Local scratch cluster (`lt_seed`, copy `lt_run`; dropped after): states early, live (one stale and one failed alliance in the newest reading), late, finished; Chromium and WebKit, light and dark, 360 and 768: no horizontal overflow. Screenshots replaced: `docs/screenshots/08zzzze-live-360.png`, `08zzzze-finished-360.png`, `08zzzze-early-360.png`, `08zzzze-live-360-webkit-dark.png`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://github.com/daniro-san/LAPTracker/pull/319
