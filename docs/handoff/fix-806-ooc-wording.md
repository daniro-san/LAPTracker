# fix/806-ooc-wording — KvK-only outputs skip Origin of Chaos (#806)

## Built

- **`lib/schedule.ts`:**
  - `isKvkDay(day)`: true for a server day outside the cycle's Origin of Chaos weeks.
  - `nextKvk(now, cfg)`: the first KvK whose After is still ahead, passing over an Origin of Chaos week.
  - `eventsAround` and `nextKvk` share a new `thisWeekOf`.
- **KvK recap (D159 post 5):** `postPeriod` (`lib/post-catalog.ts`) returns null for the `event`-weekday post on an Origin of Chaos day. Nothing is read, sent or settled on 2026-12-05. Because the clock decides, `postsMayBeDue` is false for it too.
- **Member page recovery line (D142):**
  - `mightBeforeEvent` → `mightBeforeEvents` (`lib/repo/me.ts`) returns every Start that read the member in the 30 days, newest first. That is about 5 rows; the old version returned one.
  - `meView` (`lib/private/me.ts`) keeps the newest one on a KvK day. "Before KvK (date)" now always names a KvK.
- **Member page kills thanks line (#805, rebased onto it):** `ownEventReads` takes a `keep` test, and `meView` passes the same KvK test (`isKvk`). It skips any event the test rejects, as it already skipped events with a stale Start or End. So "Thanks for the … kills you gained in KvK" thanks for the newest KvK even when a newer Origin of Chaos gained kills. With only an Origin of Chaos in the 30 days, there is no line.
- **Insights' KvK cost and recovery, and Follow-up's "After KvK, offer help":** `kvkOf` (`lib/private/insights-kvk.ts`) drops non-KvK events before anything else. Both outputs go through it. `readsFrom` compares against the KvKs only.
- **/admin KvK opponent form (D152):**
  - `KvkCard` and `POST /api/admin/kvk-opponent` use `nextKvk`.
  - `kvkTimes` (`lib/queries/admin-kvk.ts`) keeps the KvKs among the 4 scheduled events before it. The route answers 404 `not_a_kvk` for an Origin of Chaos.
  - `adminKvk` takes the schedule config.
- **Tests** (one per behavior):
  - `lib/schedule.test.ts`: `isKvkDay` and `nextKvk` around 2026-12-05.
  - `lib/private/catalog-posts-kvk.test.ts`: no recap on an Origin of Chaos Saturday, nothing settled.
  - `lib/private/me-recovery.test.ts` (new, PGlite): the recovery line uses the KvK of 11-28 (90%), not the Origin of Chaos Start of 12-05, which would give 45%. The thanks line says 700K for the KvK of 11-28, not 300K for the newer Origin of Chaos.
  - `lib/private/insights-kvk.test.ts`: `kvkOf` leaves out an Origin of Chaos.
  - `lib/queries/admin-kvk.test.ts`: `kvkTimes` drops an Origin of Chaos.
- **Docs:** dated amendments to D160 (the rule), D159 (post 5), D152 (the form) and D142 (the member page's two lines).

## Decisions

- **Skip, do not rename.** Every output here is about KvK by design:
  - the recap's title, thanks and "Kills gained" come from the War turnout;
  - the recovery line says "before KvK", and the Insights card is "KvK cost and recovery";
  - the opponent form is for a KvK opponent.

  D159 already says the recap posts "at most once per KvK" and the card says "After each KvK". The issue's own note says the recap should run only after a KvK. Naming Origin of Chaos in these outputs would need new copy in 3 languages, and the product meaning (does Origin of Chaos cost might, or have an opponent?) is unknown. So none of the outputs needed new strings, and none were added.
- **Event kind comes from the schedule, not the stored name.** `isKvkDay` reads the cycle constants, the same source `eventOn` uses. An owner rename (D39) does not change an event's kind, and no new column or query is needed. Weeks before 2026-11-14 count as KvK weeks, as `eventOn` treats them. 2026-11-07 (owner answer 8: an Origin of Chaos) still counts as a KvK; it falls out of every 30-day window by 2026-12-07.
- **Opponent form: the KvKs among the 4 scheduled events before the next KvK**, so it shows 3 past KvKs when one of the 4 was an Origin of Chaos, instead of fetching more rows.
- **Insights and Follow-up included.** They were not in the issue's list, but they pick recent scheduled events and say "KvK", which is the issue's bug class. The fix is one filter in `kvkOf`.

## Deviations

- PR #805 was still open when this branch was cut. It merged during the work, so the branch was rebased onto origin/dev, the `lib/private/me.ts` conflict was resolved by keeping both reads, and the thanks line was covered too.

## Verified

- After the rebase onto origin/dev (with #805): `pnpm vitest related --run` on the changed files: 223 of 224 files passed. The failure was `lib/squads-read-press.test.ts` "keeps the day's cap", which passed alone and in `pnpm check`, so it looks like a timing flake under load. It is not touched by this change.
- `pnpm check`: exit 0. Vitest `Test Files 397 passed | 2 skipped`, `Tests 2151 passed | 4 skipped`; drift "Everything's fine"; i18n "17 languages up to date with English".
- Not run: `next build`, a live tick, /admin in a browser. No upstream calls.

## Open issues

1. **Raid prep, the Raid Shield check and the Shield-up reminder (post 2)** assume a raid the night before a KvK every Saturday: `lib/shield-check.ts` (`raidOf`, `kvkStart` 12:00 ST), the tick's weekly Raid prep roll call (`weekRaidPrep`), and the Friday shield reads. Whether there is a raid before an Origin of Chaos Saturday is a game question. Changed nothing; owner question below. The Shield-up reminder's text does not say "KvK". The Raid prep "Next step … before KvK starts at 12:00 ST" line only shows when a Raid prep roll call exists.
2. **Garrison flows** (`calendar/garrison`, Undead Siege) do not read the scheduled event. Nothing to change.
3. Other `nextEvent` users (`lib/run.ts` Friday message, `lib/squads.ts`, `lib/tick.ts`, `EventView` next update, /admin status) use the event's own name and times. They are correct for Origin of Chaos.

## Next

- Follow-ups:
  - Owner question: on an Origin of Chaos weekend, is there a raid at the Friday reset? If not, the Shield check's Friday/Saturday reads, the weekly Raid prep roll call and post 2 should skip Origin of Chaos weeks too, with the same `isKvkDay` test.
  - #175 (schedules from /admin): `isKvkDay` should read the stored schedule's kind once it exists.

What was missing from the task prompt? Whether Origin of Chaos has a raid the night before, and whether it costs might, which decides whether Raid prep and a recovery line should cover it. Assumed: only KvK outputs change.

PR: (added by the orchestrator)
