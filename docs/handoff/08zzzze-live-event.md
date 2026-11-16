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
- **"Who fought" becomes "so far" until the End** (issue text): not done. `WhoFought.tsx` does not exist on this branch (a parallel session is adding and changing it); nothing here touches it.
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
8. **"Who fought" until the End** (issue #307) is left for after the parallel session that owns `WhoFought.tsx` merges; it can read `eventProgress` standings.

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

🤖 Generated with [Claude Code](https://claude.com/claude-code)
