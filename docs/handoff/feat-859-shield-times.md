# feat/859-shield-times — officers choose when the Raid Shield reads run (issue 859)

## Built

- `lib/shield-check.ts`: `ShieldTimes`, `DEFAULT_TIMES` (23:30, 10:00, after-reset on at 02:30 ST), `timesOf(row)`, `snapToTick`, `timeRanges` (night `DAILY_ROSTER_AT`–23:45, morning 10:00–11:00, after-reset 00:15–10:15 ST, every 15 min), `timeChoices` (the ranges minus times whose window meets an event's), `timesRefusal` (`event_window` / `reads_overlap` over the next four weeks), `resetSpanOpen` (Saturday 00:15–10:45 ST). `shieldPassAt`, `passWindows`, `resetWindow`, `resetReadDue` and `raidOf` take the alliance's times; their defaults give today's windows.
- `lib/schedule.ts`: `eventsAround` exported (used by the event check).
- Storage: `shield_settings` gets `night_minute` (default 1410), `reset_read` (default true), `reset_minute` (default 150), with range checks. Migration `drizzle/0091_shield_times.sql`, additive only.
- Schedulers: `passesAt` (night and morning) uses each target's times; Friday's burst reads only the alliances whose night time has come (`SquadsRun.unionIds` in `lib/squads-read.ts`); `shieldReset` picks the alliances whose after-reset time is due now and skips those with it off, then claims and reads as before; `tick-gate.ts` opens Saturday 00:15–10:45 ST only while some alliance moved its after-reset time (`resetMovedFrom`, wake-cache fact `shield-reset-default`).
- Readers on the alliance's times: `shield-post.ts`, `push-uses.ts`, `raid-prep-fill.ts`, `private/raid-prep.ts` (no after-reset readings while it is off), `card-shield.ts`, `shield-status.ts`, `insights.ts`/`insights-shield.ts`, `kvk-map.ts`.
- `POST /api/w/[slug]/raid-prep`: body `{nightMinute, morningMinute, resetRead, resetMinute, discord, language}`; times snap to the next tick; 400 `out_of_range`, 409 `event_window` / `reads_overlap`; a save forgets the wake cache.
- Card (`RaidPrepSettings.tsx`): night, after-reset switch and time, morning selects (only `timeChoices`), the tracker-call line (`switches.callsWeekly`, 3 or 2 reads × members), the trade-off line, the two refusal messages. Raid prep's "Night check: Friday from {night} ST" now shows the alliance's time. Copy EN, PT-BR, FR.
- Tests (one per behaviour): defaults unchanged and a later night time moving the read and its window (`lib/shield-check.test.ts`); ticks snap and event overlap refused (`raid-prep/route.test.ts`); after-reset off → no read (`lib/shield-reset.test.ts`); the estimate shown (`_ui/RaidPrepSettings.test.ts`). Existing fixtures updated for the new body and row fields.
- D137 amendment 2026-11-28c.

## Decisions

- Storage is three columns on `shield_settings`, so a migration. There is no workspace settings JSON for this; the card's settings already live in that table with typed columns and checks.
- The morning range stays 10:00–11:00 ST (the owner's range in D137), so `morning_minute` and its check are unchanged.
- An event window, for this check, counts from its Before or its event's start, whichever is later, until its After's due window closes. With the plain Before-to-After rule the KvK window (10:00–14:45 ST) refuses every morning time, including the default.
- The after-reset window is 45 minutes from its time and its ticks are the two from its time, as the 02:30 default was. The after-reset check must end before the morning check starts (`reads_overlap`).
- The card's estimate counts every read (3 or 2 × members), like the Features card's per-feature line; it does not subtract the squads read.

## Deviations

- Night times start at `DAILY_ROSTER_AT` (23:30 ST), not at 20:00 ST as the issue says. The night read is the day's squads read, whose queue the 23:30 roster read makes; earlier, the tick waits for the roster read anyway (22:00–23:30 ST), and before 22:00 ST `quotaDayRead` gives Thursday and Friday's UTC quota day. So the officers' choice today is 23:30 or 23:45 ST. An earlier night read needs its own queue and quota-day rules: a decision for the owner.

## Verified

- `pnpm vitest related --run <changed files>`: 2 files failed first (a partial settings fixture in `shield-post.test.ts`, an expired session in the new route test); fixed; then green.
- `pnpm check`: exit 0, 420 test files, 2301 tests passed, drift and i18n checks fine.
- Not run: the card in a browser at 360/640/1280 px.

## Open issues

- With the squads read also on, the normal squads batch at the 23:37 tick can read some members before a 23:45 night time; those readings fall in the night window (from 23:15) and count as the night's. Pre-existing behaviour of the default too.
- Insights applies today's times to past weeks.
- Insights' help text still says "Friday from 23:30 ST (readings from 23:00 to 00:00 ST count)"; the Shield-up reminder post (catalog post 2) still runs 3 h before 23:30 ST; the Features card's estimate still counts three reads with the after-reset check off.

## Next

- Owner: apply migration 0091 with the release (additive; safe before or after the deploy).
- Owner decision: whether the night read should be offered before the roster read (20:00–23:15 ST). That needs a night read with its own queue on Friday's UTC quota day.
- Follow-ups: Insights help text and the Shield-up reminder on the alliance's night time; the Features card estimate with the after-reset check off; a designer-persona pass on the card at 360 px.

What was missing from the task prompt? That the night read is the squads read and cannot start before the 23:30 roster read, that the KvK event window covers the default morning check, and that the shield settings are a typed table, not a settings JSON.

PR: (added by the orchestrator)
