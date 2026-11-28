# feat/785-origin-of-chaos-cycle — Origin of Chaos on 2026-12-05: the 4-week event cycle (#785, build 2 of #183)

Built on PR #784 (`feat/290-event-windows`), then rebased onto origin/dev 5b6fe6c9 after #784's squash-merge (no conflicts).

## Built

- **`lib/schedule.ts` `eventOn`: a dated 4-week cycle** (no database read, constants in the file):
  - week 1 starts Saturday 2026-11-14 (`CYCLE_START`);
  - weeks 1–3 return the env's weekly event, unchanged;
  - week 4 (2026-12-05, 2027-01-02, then every 4 weeks) returns "Origin of Chaos YYYY-MM-DD":
    - `eventAtUtc` 00:10 server;
    - windows 00:00–00:45 and 12:15–13:15 server;
    - `beforeAt` is window 1's Before, `afterAt` window 2's After.
  - Everything that reads the schedule takes the new event through #784's window support with no other change: `eventsToCreate` → `findOrCreateEvent` (stores both `event_windows` rows), `tickClockDue` (D141 gate per window), `eventReserve` / `squadsReserve` (squads, lookups), `opponentReserve`, the Friday check, `nextEvent` on /admin, rehearsal spacing.
- **`isGeneratedName`** also matches "Origin of Chaos YYYY-MM-DD", so /admin and the event picture treat it as a generated name, like "Saturday Event …" (D39).
- **Event pause per window.** `inEventWindow` is true inside each window (its Before until its After's due window closes), false between windows. For a one-window event the result is the same as before. Callers: squads read, /admin squads press, lookups, the alliance page's lookup state, the workspace's read status.
- **Tests** (`lib/schedule.test.ts`, "the 4-week cycle"):
  - 2026-12-05 is a two-window "Origin of Chaos 2026-12-05" with the expected UTC times; 2026-11-28 and 2026-12-12 stay "Saturday Event …" with one window;
  - the cycle repeats every 4 weeks (2027-01-02, 2027-01-30, 2027-12-04) and leaves 2026-11-07 and 2026-12-26 alone;
  - the pause is true inside each window and false in the gap.
- **Docs:** D160 amendment 2026-11-27b (cycle and per-window pause). The squads-read INVARIANT comment now says "in each of the event's windows".

## Decisions

- **Weeks before 2026-11-14 keep the env event.** Owner answer 8 says 2026-11-07 was Origin of Chaos. Applying the cycle backwards would rename past scheduled events in `currentEvent`/`targetEvent`, and 2026-11-07's stored row keeps its KvK times anyway (D21). The owner can rename that row from /admin (D39).
- **Origin of Chaos's day is the cycle's EVENT_WEEKDAY day in week 4.** With `EVENT_WEEKDAY` = 6 (production) that is the Saturday. If EVENT_WEEKDAY changed, Origin of Chaos would move with it.
- **Event pause: only around each window, not the 12-hour gap.** Panel notes:
  - *War strategist:* nothing happens in the game between 00:40 and 12:30 server that our event readings cover. The event's change comes only from each window's Before and After. A squads read or lookup in the gap does not touch those rows.
  - *R5:* a whole-span pause blocks lookups and /admin's squads press from 00:00 to about 13:30 server on Saturday. That is most of the day officers plan window 2 in. Per window, the Friday night squads queue (from 23:30 server) still pauses at 00:00, then resumes at 00:45 and finishes well before the quota reset.
  - *Engineer (quota and cost):* the quota stays safe because the reserve does not depend on the pause. `eventReserve` keeps every window's reads and samples (205 calls for 20 alliances, checked) until the last After. It still counts window 1 after window 1 is done, which errs on the safe side. D141 does not change: the pause decides nothing about when the tick opens the database. Squads batches in the gap wake Neon exactly as on any weekday.
  - *Data-honesty reviewer:* squads rows and lookups are separate tables with their own times. No event reading mixes in a gap read. The workspace status shows "paused for the event" only while a window runs, so it is true.
- **Small and safe, so implemented.** It is one function, and its result for every one-window event is unchanged.

## Deviations

- None from the task. The issue's "about 20–30 lines" is about 45 lines with comments in `lib/schedule.ts`.

## Verified

- `pnpm vitest related --run lib/schedule.ts lib/squads-read.ts lib/schedule.test.ts`: 210 files, 1151 tests passed.
- Scratch check (a temporary test, removed afterwards; production-like config UTC−2, 15-min cadence, 20 alliances):
  - `eventOnQuotaDay` at 2026-12-05 01:37Z (Fri 23:37 server, the daily read) is "Origin of Chaos 2026-12-05", and `eventReserve` is 205;
  - for 2026-11-28 it is "Saturday Event 2026-11-28", with 533;
  - `tickClockDue` is true at 2026-12-04 02:00Z (row creation), 02:00Z and 14:15Z on 12-05 (windows), and false at 08:00Z (the gap).
- The Friday daily read's reserve (`eventReadsDueToday`) reads the event's `event_windows` rows. The tick creates them from this schedule from Fri 2026-12-04 00:00 server, before the 23:30 server read.
- After the rebase onto origin/dev 5b6fe6c9: `pnpm vitest related --run lib/schedule.ts lib/squads-read.ts lib/schedule.test.ts`: 210 files, 1159 tests passed. `pnpm check`: exit 0, `Test Files 382 passed | 2 skipped`, `Tests 2072 passed | 4 skipped`, drift and i18n green.
- Before the rebase, `pnpm check`: exit 0. Prettier, eslint and tsc green; vitest `Test Files 382 passed | 2 skipped`, `Tests 2059 passed | 4 skipped`; drift "Everything's fine"; i18n "17 languages up to date with English". #784's tests pass, `lib/windows.test.ts` included.
- Not run: `next build`, a live tick (0 upstream calls).

## Open issues

1. **Deadline detail.** The Origin of Chaos row's day-ahead window opens Fri 2026-12-04 02:00 UTC (00:00 server). D141 opens the database for row creation only in that first hour, and on any later open tick (heartbeat every 3 h, the Friday check, the Shield check, the daily read). So a deploy after 02:00 UTC still creates the row at the next open tick, at the latest at window 1's Before. A deploy after 12:00 UTC is still too late only if the old build already created the KvK-shaped "Saturday Event 2026-12-05" at 10:00 server.
2. **The KvK opponent (D152)** is looked up by `nextEvent(...).eventAtUtc`. On the Friday before Origin of Chaos, /admin's opponent form would attach to the Origin of Chaos event. That is harmless while no opponent is saved, but the form could hide itself on a non-KvK event. Follow-up.
3. **2026-11-07's row** keeps the KvK name and times. The owner can rename it (D39), as the 08zzh handoff says.
4. The constants move to /admin schedules with #175.

## Next

- Merge this branch (#784 is on dev), then release before Fri 2026-12-04 02:00 UTC if possible, 12:00 UTC at the latest.
- Owner, after the release: on Fri 2026-12-04 check that /admin names "Origin of Chaos 2026-12-05" as the next event. On 2026-12-05 check `/admin/runs` for 4 phase runs and 5 samples.
- Follow-ups: Open issue 2 (opponent form on a non-KvK event); #175 (schedules from /admin).

What was missing from the task prompt? Whether the cycle also applies to weeks before 2026-11-14 (2026-11-07 was Origin of Chaos); assumed not.

PR: (added by the orchestrator)
