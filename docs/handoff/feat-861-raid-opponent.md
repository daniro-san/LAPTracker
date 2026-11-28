# feat/861-raid-opponent — this week's raid opponent in Raid prep (issue 861)

## Built

- `lib/raid-opponent.ts` (pure): read times (minutes after 00:00 ST of Saturday and Sunday, 00:00–02:00, 15-minute ticks, default 00:00), `raidPhaseAt` (Saturday 00:00–02:15 ST is the Start, Sunday the End), `raidReadDue` (the read's own tick only), `raidMinute`/`raidReadsAt` (a tick that meets an event's window moves to the first tick after it that week; none clear by 02:00 ST: no read), `raidSpans`, `raidTimesRefusal` (`event_window`, `reads_overlap` against the alliance's Raid Shield read windows, over the next four weeks), `raidTimeChoices`, `raidSide` (Start→End over the members in both reads with D152's `memberChange`; a missing, failed, stale or other-alliance read gives no change).
- Storage, migration `drizzle/0092_raid_opponent.sql` (additive): `raid_opponents` (one current row per workspace and raid, old rows kept with `cleared_at` for Undo), `raid_reads` (workspace, Saturday, phase, side; totals and uid/might/kills arrays; claimed before the call), and `shield_settings.raid_start_minute` / `raid_end_minute` (default 0, checks 0–120). Repo: `lib/repo/raid-opponents.ts` (null array elements read as text, as `lib/repo/kvk.ts`).
- Tick: `lib/raid-read.ts` `raidRead`, first in the tick's `after` (`lib/squads-tick.ts`), before the Raid Shield reads. Targets are `squadTargets(…, "shield_check")` plus an opponent for that raid, so the key rule is D124's: the own alliance on LAP_API_KEY only while it has no saved key, any other workspace only on its own key. Reserve and quota start reuse the after-reset check's `startRead` (now exported). Our side reuses the daily roster when the daily read stored it in the same tick. One `raid.read` run-log line per workspace, counts and a reason only.
- Gate: `lib/tick-gate.ts` `raidMayBeDue`, the #859 pattern: `raid-none:<saturday>:<phase>:<minute>` kept for every minute of the day's phase from one read; a save forgets it.
- Desk: `lib/private/raid-opponent.ts` (`raidOpponentView`, `saveRaidOpponent`: set with one `fetchAllianceByTag` on the own key, clear, Undo with no call, times), route `POST /api/w/[slug]/raid-opponent` (`set`, `clear`, `undo`, `times`), card `app/(private)/_ui/RaidOpponent.tsx` + `RaidOpponentResult.tsx` under the Raid prep marks (`roll-call/mark/page.tsx`), only while `shield_check` is on. Copy EN, PT-BR, FR in `lib/private/dictionary.raidprep-opponent.ts`.
- The Raid Shield settings save now also refuses times that meet the raid reads (`timesRefusal` takes extra spans). `recruit-check.ts`'s `siteReserveKept` exported for the opponent check on LAP_API_KEY.
- Estimate: `TRACKER_CALLS.shield_check.perWeek = 6` (4 alliance reads + up to 2 /quota calls on a workspace key); the card says "At most 6 tracker calls a week on your key."
- Analytics: `ws_action` feature `raid_opponent` (`save`, `edit`, `delete`, `undo`), tracking plan row and changelog line.
- Workspace data: both tables deleted with the workspace, not in the download (`lib/repo/workspace-data.ts`); seeds in the test helpers.
- Decision D165 (new record), amendment lines in D137 and D141, README index line.
- Tests: `lib/raid-opponent.test.ts` (event shift, refusals, missing read → no delta, card numbers), `lib/raid-read.test.ts` (reads at Sat/Sun 00:00 ST once each on the own key, moved time and no catch-up, no LAP_API_KEY for another workspace, gate), `app/(private)/api/w/[slug]/raid-opponent/route.test.ts` (set/validate/clear/Undo on the own key; `no_key` sends nothing); `member-session.test.ts` fixture; `features.test.ts` estimate +6.

## Decisions

- New record D165, not a D152 amendment: D152 is the owner's server-level KvK opponent on /admin, read on LAP_API_KEY inside the KvK reserve and shown on a public page. This one is set per workspace by officers, follows the server day, spends the alliance's own key and stays on the desk; none of D152's rules carry over except `opponentTag` and `memberChange`.
- Origin of Chaos reads 00:00–00:45 ST and is due until 01:30 ST on its Saturday, so the default 00:00 Start meets it one week in four. A read whose tick meets an event's window runs on the first tick after the window that week (Start at 01:30 ST in Origin of Chaos weeks). A time is refused with `event_window` only when no tick is clear by 02:00 ST. The event window here counts from the Before (the tick's own D160 rule), not from the event's start as the shield check's KvK exception does.
- Times range 00:00–02:00 ST of each day: the owner's "as close to the reset as possible". Times are per workspace (columns on `shield_settings`, the #859 pattern), not per raid.
- Opponent reads are by union id (`fetchAlliance`, live), the check is by tag; the stored union id survives a tag change.
- A change of opponent after the Start read is allowed; the new opponent then has no Start and the card shows it as missing.
- Undo keeps the old row (`cleared_at`) and restores it, so Undo costs no tracker call. Undo of a first set clears it.
- No "winner" wording at all (D75 allows it only when unambiguous; leaving it out is the plain reading).
- Freshness: an answer older than 20 minutes (`source_updated_at`) is stale and gives no delta.

## Deviations

- The issue lists "reads at Sat/Sun 00:00 ST, never inside an event window" together. On Origin of Chaos Saturdays both cannot hold; the Start moves to 01:30 ST that week (above).
- Estimate is 6 calls a week, not 2–4: on a workspace key each read tick spends one /quota call first (the after-reset check's reserve rule). On the own alliance's site key it is 4.

## Verified

- `pnpm vitest related --run <changed files>`: first run 3 failures (tracking plan row, purge table list, estimate numbers), then 1 (purge seed); fixed; then green.
- `pnpm check`: the first runs failed on Prettier, then on ESLint (function length and complexity in the new code, a restricted import in the route test, the seed helper's length); each fixed; final run exit 0: 423 test files, 2317 tests passed, drift and i18n checks fine. That was more than two fix rounds; each round was a different lint rule on new code, none a failing test.
- `pnpm db:generate` produced 0092; `drizzle-kit check` in `pnpm check` reports no drift.
- Not run: the card in a browser at 360/640/1280 px, dark mode, or a designer-persona review.

## Open issues

- A first raid-times save on a workspace with no `shield_settings` row inserts one with the column defaults, so Alliance settings → Raid Shield then shows the Discord summary language as English instead of the officer's language fallback.
- The data download leaves out `raid_opponents` and `raid_reads`; whether the officers' opponent history belongs in it is not decided.
- The raid End read is on Sunday's UTC quota day, but `trackerEstimate` adds the 6 calls to Saturday's peak.
- Raid reads of a past week are not re-read; a week whose Start or End tick was missed stays missing in the history for good (as asked).

## Next

- Owner: apply migration 0092 with the release (additive).
- Follow-ups: designer-persona pass on the card at 360 px and in dark mode; decide whether the opponent history goes in the data download; the language default on a raid-times-only settings row.

What was missing from the task prompt? That Origin of Chaos reads 00:00–01:30 ST on its Saturday, so "Start at Saturday 00:00 ST" and "never inside an event window" conflict one week in four, and that a workspace key's reserve check costs one /quota call per read tick.

PR: (added by the orchestrator)
