# 08zzzzn — Server fight clock and the compare page's server pulse (issue #284, part 1)

## Built
- `lib/fight-clock.ts`: pure arithmetic. `eventClock` turns `serverPulse` intervals into slots on the server clock (kills, share of the event's kills, state `moved` / `still` / `missing`, `minute` on the server clock) plus the busiest rolling 30 minutes. `clockColumns` (the union of two or more events' minutes), `bothCover` (the minutes two events share), `offReason` (why an unsampled event is off).
- `lib/queries/fight-clock.ts`: `sampledEventIds` (the one notion of "sampled"), `eventPulses` (slots per event; unsampled events come back as `sampled: false`, `clock: null`), `getFightClock` (public scheduled events, newest first, each sampled or off with its reason).
- `lib/queries/live.ts`: `readingsOf(rows)` is now exported and used by `eventProgressOf`. `lib/schedule.ts`: `serverMinuteOfDay`.
- `app/_ui/event-page.ts`: `progressRowsOf(eventId, done)` (rows through the event cache, `progress-done` or `progress`), used by `loadProgress` and by the new loaders `loadFightClock`, `loadComparePulses`.
- Page `/events/fight-clock` (`app/(pages)/events/fight-clock/page.tsx`). Components `app/_ui/PulseStrip.tsx` (strip, Details table, `busiestText`) and `app/_ui/ComparePulse.tsx`. A "Server pulse" section on the compare page, list view only.
- Links: first item of the header's Events list (every page) and a link under the pulse in the event page's "During the event" section.
- Seed: the two latest seed events are sampled (the older one with a different shape); the oldest is a disabled row. 15 new copy keys in `lib/copy-live.ts`, 17 languages translated and stamped.
- Decision `docs/decisions/D86-the-server-fight-clock-on-the-samples.md`; two glossary rows (sampled event, server fight clock).
- Screenshots at 360 px, light and dark: `docs/screenshots/08zzzzn-fight-clock-*.png` (sampled rows and the disabled row), `08zzzzn-compare-sampled-*.png`, `08zzzzn-compare-disabled-*.png`.

## Decisions
- "Sampled" is a separate query, not a `samples` count on `listEvents`. `listEvents` runs on every page for the header, and only these views need it.
- Slots are bucketed by position: the last interval ends on the last sample's slot and earlier ones are one cadence apart. The first interval, from the off-grid Start, is the slot that holds the Start.
- A loss of kills in a slot counts 0, so it never lowers the total that shares divide by. A `still` slot has no share (it is shown as "No update from the game", never as 0).
- The busiest span needs 4 compared slots, as on the event page. A `still` slot counts 0 inside a pair.
- Bar heights are scaled against the tallest share on the page, so rows and A/B are read against each other.
- Four reasons for a disabled row: `since` (older than the first sampled event, with its date), `next` (none sampled yet), `waiting` (no End yet and within a day of its time), `missed` (newer than the first sampled event, no readings). `waiting` and `missed` go beyond the owner's two examples; assumption: an event still to come must not say "they start with the event of <its own date>".
- Fight clock rows are scheduled events only (a manual round has no schedule). Compare accepts any two public events.
- Events are read one after another on a cold cache, one connection at a time.

## Deviations
- The slots end at the last sample. The End's alliance rows are not read by `progressRows`, so the last quarter hour before the End (15:45 to 16:00) is not drawn, as on the event page. Adding it means reading the End's totals in `progressRows` and changing its cached shape.
- A window of more than 24 columns would fall under about 14 px per cell at 360 px. A 4-hour event gives 15 to 16 columns (20 px each). The window picker is where a long window gets handled.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest (99 files), drift gate and `i18n: 17 languages up to date with English` all green.
- Tests: `lib/fight-clock.test.ts` (property: shares sum to 1 when kills were gained; busiest span within bounds), `lib/queries/fight-clock.test.ts` (PGlite: unsampled event listed unsampled with no slots and its rows not read; stale/failed samples do not make an event sampled; slots on the server clock; busiest 30 minutes; still and missing slots; done/live cache keys; reasons; a manual round left out), `lib/schedule.test.ts`, `SiteHeader.test.ts`. One mutation (dropping the `is_fresh` condition) failed the sampled test.
- Local look on `dev:local` with the seed at 360 px, light and dark: no horizontal scroll on the three pages; the fight clock shows two sampled rows and one disabled row; compare shows both states.

## Open issues
- Pre-existing: `eventProgressOf` and the new views call `serverPulse`, whose first interval is from the Start's finish time. If the Start finishes after the first sample's slot, that interval is negative or zero-length. Not touched.
- Not checked: 390/412, tablet and 1024/1280 widths, and the Discord picture (this page has none).
- `sampledEventIds` is not cached; it is one distinct select per view.
- Release note: on the first sampled KvK (2026-11-21) nothing needs to be changed; the page and the compare section turn on by themselves once an event has a usable sample.

## Next
Session: the window picker for the compare page's server pulse (second part of #284), then the officer-only views.
Model / effort: keep. No signal of difficulty in this build; the picker is URL state plus server figures, as `/events/compare` already is.
Owner must do first: nothing before the first sampled KvK (2026-11-21); the picker is easier to judge with two sampled events, so build it after that event's samples exist, or on the seed.
Plan changes needed: none (the issue holds the picker's design; this repo's plan has no section for it).

<adjustments>
- Prompt sketch, window picker: "Add a From/To window to the compare page's server pulse (issue #284 comments: shortcuts, From and To selects with `.drawn-field`, two taps on the strip). State in the URL (`?from=&to=`, server-clock minutes), figures on the server (D68). Call `loadComparePulses(a, aDone, b, bDone)` (`app/_ui/event-page.ts`), take `bothCover(a.clock, b.clock)` (`lib/fight-clock.ts`) for the slots to offer, and cut each `EventClock.slots` to the window with a new pure function in `lib/fight-clock.ts` that recomputes `share` and `busiest` over the window (`eventClock` already shows how). Reuse `PulseStrip` and `PulseDetails` with the cut clocks and `clockColumns`. Both events unsampled or one unsampled: the section stays disabled as today (`ComparePulse`); the picker is not shown. Do not read rows again: they come through the event cache."
- Prompt sketch, officer-only views (our kills against our might per slot; members by slot): "Under `lib/private`, after `requireWorkspace`, for the workspace's own alliance only. Start from `readingsOf(await progressRowsOf(id, done))` (`lib/queries/live.ts`, `app/_ui/event-page.ts`: the Start and the samples as readings with alliance totals) for the totals per alliance per slot. Per-slot kills and might for one alliance are `delta` of consecutive readings of that alliance, as `serverPulse` does for all alliances; build that per-alliance aggregation next to `serverPulse` and test it with the same fixtures. Members by slot need the members' arrays: `eventSamples(db, id)` (rosters on), aggregated in SQL or in a cached, per-alliance read, never shipped to a page whole. Gate with `sampledEventIds` (an unsampled event is disabled with `offReason`'s words)."
- Fixtures and seed: `scripts/seed-samples.ts` takes an event index (1 or 2); `scripts/seed.ts` samples every event from index 1.
- `lib/copy-live.ts` is the place for new public copy; it is spread into `ledger`.
</adjustments>

## UX review (2026-11-16)
Measured on the local seed (two sampled events, one older unsampled), Chrome at 360, 390, 412, 600, 768, 810, 820, 1024, 1180 and 1280, light and dark; WebKit at 390 (dark) and 820 (light); German and Russian at 360.
- `document.documentElement.scrollWidth` equals the viewport width on the fight clock, compare (sampled and disabled) and event pages at every width above.
- Fight clock strip: 15 columns, 19.5 px each at 360, 21.5 at 390, 22.9 at 412, 35 to 58 px from 600 up. Hour labels, the outline and the 6 % minimum bar are legible at 360. The seed has no "no update" slot, so the dashed stub was checked in the code only.
- Tap targets on the fight clock page: every link and button is at least 44 px (the row link has `min-h-11`; Details is 44 px). On the compare page, the `<select>` fields measure 44 px in WebKit (`.drawn-field`). The alliance name links on the compare and event pages measure 24 to 25 px high; they are older code, not this PR.
- Contrast of the disabled row's reason text (ink at 70 % on the page): 5.7:1 light, 7.2:1 dark.
- No truncation and no clipping in German or Russian at 360 (the Russian title wraps to two lines).
- Fixed:
  - Compare page, disabled state: the reason said "Event B has no readings" without saying which event B is. It now reads "Event B (Oct 17) has no ...", with the same date format as the A/B labels. `comparePulseOffA` and `comparePulseOffB` take `{when}`; 17 languages updated and stamped (the translator subagents work in the main checkout, so the 34 strings were edited by hand in this worktree: the existing wording plus `({when})` after the event designator).
  - Fight clock page: a sampled row did not look like a link. The row now shows "During the event ›" under the date (existing copy, previously screen-reader only).
- Left:
  - The lead paragraph is four lines at 360 (five in Russian), so the first chart starts at about 620 px of the first screen. Shortening it needs a copy change in 17 languages; left as is.
  - The disabled reason on the compare page does not say when the section turns on; the fight clock rows do ("they start with the event of ..."). Adding it needs the first sampled event's date in `ComparePulse`.
  - Alliance name links at 24 to 25 px on the compare and event pages (older code).
- Screenshots: the six `08zzzzn-*-360.png` files are replaced; `08zzzzn-fight-clock-light-390.png` (Chrome) and `08zzzzn-fight-clock-light-820.png` (WebKit) are new.
- Merge of origin/dev (#338) resolved: stamps and glossaries kept from both sides, `pnpm check` green after it.

https://github.com/daniro-san/LAPTracker/pull/343
