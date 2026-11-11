# 08zzzd — player row pick

Issue 234. Branched from `origin/fix/08zzx-compare-player-review` (PR 229, still open when this session started).

## Built

- `lib/compute.ts`: `pickRosterRow(newestFirst, usable)` holds the shared rule. Of one player's roster rows in one snapshot, it takes the row of a usable alliance read, else the newest. `pickRosterRows(rows, usable)` applies that rule once per uid and snapshot (event and phase), keeping first-seen order.
- `lib/queries/compare-player.ts`: `phasesOf` now calls `pickRosterRow`. Before, it had the same logic inline. Its behavior is unchanged.
- `lib/queries/players.ts`: `sightingsOf` now orders by alliance row id, newest first, inside one snapshot. It keeps one row per uid and snapshot through `pickRosterRows`. `playerHistory` (current, rows, names, alliance stays) and `searchPlayers` read that one row.
- `lib/queries/compare.test.ts`: added one PGlite test. A player is in a fresh roster of alliance 2 and in a stale read of alliance 1 in the same snapshot, and the stale row is stored last. The test checks that `comparePlayer` and `playerHistory` both return alliance 2: the change, the current figures and the event row.

## Decisions

- The rule sits in `lib/compute.ts`, which holds pure functions and already has the freshness predicate. `lib/queries/players.ts` was at the ESLint 300-line limit. The grouping is in `pickRosterRows` in compute.ts, and players.ts ends at exactly 300 counted lines.
- On the player page, "usable" is `isFresh` alone. A failed alliance row is written by `errorRow` (lib/collector-rows.ts) with `is_fresh = false` and no roster rows, so a roster row under a failed read cannot be fresh. Selecting `error` as an extra column would have pushed players.ts over the line limit. The compare page keeps `compare.usable` (fresh and not failed). On stored data the two predicates give the same answer.
- The snapshot key is (event id, phase). The `snapshots_event_phase_unique` constraint makes that pair unique, so no snapshot id column was added to the select.
- The test is in `compare.test.ts` because it compares both pages and that file already has the two-phase `seedEvent` helper. It is dated 2026-10-03, before every other seeded event, so the default-picker test is unaffected.

## Deviations

None from the plan.

## Verified

- `pnpm vitest run lib/queries/compare.test.ts lib/queries/players.test.ts`: `Test Files 2 passed (2)`, `Tests 8 passed (8)`.
- The new test can fail. With `lib/queries/players.ts` reverted to the base version, `pnpm vitest run lib/queries/compare.test.ts` returned `× shows the fresh alliance's row over a newer stale read of the old one, on both pages`, `- "unionId": 2, + "unionId": 1`, `Tests 1 failed | 4 passed (5)`. The test passed again after the change was restored.
- `pnpm check` (prettier, eslint, tsc, vitest, drift, i18n): `Test Files 55 passed | 1 skipped (56)`, `Tests 254 passed | 1 skipped (255)`, `No schema changes, nothing to migrate`, `i18n: 17 languages up to date with English`.
- Not run: the app in a browser. The change is in the read model only, and the PGlite test covers it.

## Open issues

- `pickRosterRow` / `pickRosterRows` have no fast-check property test in `lib/compute.test.ts`. The issue asked for one PGlite test only. A property test could be added as a follow-up.
- This session did not check whether other queries that read one player's member rows across alliances (for example `lib/queries/member-history.ts` and `lib/queries/movers.ts`) can meet the same two-rows case.
- This PR is based on PR 229 and must be merged after it.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. The change touched four files and the new test failed without the fix and passed with it on the first run.
Owner must do first: merge PR 229, then this PR, into `dev` (`Closes #234` closes the issue).
Plan changes needed: none.

<adjustments>
- One shared rule for two roster rows of one player in one snapshot: `pickRosterRow` / `pickRosterRows` in `lib/compute.ts`. New queries that read a player's roster rows should use these functions and not pick rows again on their own.
- `sightingsOf` in `lib/queries/players.ts` now returns at most one row per uid and snapshot. players.ts is at 300 counted lines (the ESLint `max-lines` limit), so new player-page code has to go in another file.
</adjustments>
