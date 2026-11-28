# feat/d163-map-and-names

## Built

- D163 (`docs/decisions/D163-map-positions-presence-and-names-are-product-data.md`, indexed): on the desk, for the own alliance, `x`, `y`, `online`, `last_online_at`, `last_seen_at`, `joined_at` and member names may be read, stored, shown and exported, and a name may sit next to its map position. Public pages never show whether a player is online (owner, 2026-11-28). Other public-page uses are unchanged until the owner decides. Logs, run_logs, analytics, AI and translation stay excluded, as do redactPrivate, the avatar rule and the secrets rules.
- CLAUDE.md "Roster fields" rule and `.claude/rules/private.md` (table row and the copies/exports item) now say what D163 says. No other hard rule was changed.
- Officers' map (Insights → KvK): `eventEndPlaces` now reads each End member's name from `member_snapshots`. `kvkMapOf` gives each dot a `name`, puts the dots in name order, and gives each near/mid/far band a `names` list in name order. In the card, the plot sits inside the existing `Readout` (D158 rule 7 (a)): tapping a dot, or using the 44 px ‹ › steps (in name order), shows "Name · X x, Y y · kill band" under the plot. A line above the plot says to tap a dot. Each near/mid/far row has a "Who (n)" `<details>` (44 px summary) that lists the row's names. The map is not restyled.
- Event samples (D69): `insertSampleRow` stores each member's map place as `alliance_snapshots.member_x` / `member_y` (integer arrays in `member_uids` order, null where the read gave no place). The values come from the read the sample already makes, so there is no new upstream call. Migration `drizzle/0086_acoustic_boom_boom.sql` (two nullable columns).
- Review round (orchestrator): `last_seen_at` is in `BLOCKED_ROSTER_KEYS` and in the first sentence of CLAUDE.md's roster-fields rule, so the list, the rule and the guard agree. A sample's `x`/`y` that is not a safe integer is stored as null, so the int[] insert never fails the row. Tests: `blocked-keys.test.ts` adds a test that `last_seen_at` is blocked, and its fixture test also reads a live-roster probe, which carries `last_seen_at`. `lib/samples.test.ts` adds a test that a non-integer place is stored as null and the row is kept. The "not vacuous" checks in `lib/daily-read.test.ts` and `app/api/events/[id]/route.test.ts` now skip `last_seen_at`, because /v1's alliance roster does not send it.
- New dictionary keys in en/pt/fr: `insights.map.tap`, `.place`, `.prev`, `.next`, `.bands.who`.

## Decisions

- Samples store x/y for every sampled alliance, not only the own alliance. The collector does not know which alliances have a workspace. Before and After rows already keep every alliance's x/y in `raw_json`, so storing them for all is the smaller change. Only desk reads of the own alliance would use them.
- Dot names use a tap readout, not labels in the SVG. D68 keeps labels in HTML, and around 100 members would make SVG labels overlap at 360 px.

## Deviations

- D-number is D163, not D162: open PR #811 adds D162.

## Verified

- `pnpm vitest related --run` on the changed files: 398 files passed, 2 skipped (2159 tests).
- `pnpm check`: exit 0.
- Tests changed: `lib/private/kvk-map.test.ts`. The band test now expects names on the dots and `names` on each band. The view test "with no uid or name" became "with names", and it now checks only that the other alliance's members do not appear. `app/(private)/_ui/InsightsKvkMap.test.ts`: the old test asserting "no name or uid in the markup" (the old desk ban) was replaced. The new one checks the readout names the first dot by name with its place and band, has 4 dot targets and the Next step, and that each band lists its names, all inside ph-no-capture. New test in `lib/samples.test.ts`: a sample keeps each member's place in member order, null where the read gave none.
- Not checked in a browser at 360/640/1280. No screenshots were taken.

## Open issues

- PR #811 also adds migration `0086_fluffy_joystick` and D162. Whichever PR merges second must renumber its migration (`pnpm db:generate` after a rebase) and its journal entry.
- `lib/queries/blocked-keys.ts` was not changed: it blocks only public read models, logs, the redactor and the workspace data export's column filter (`lib/repo/workspace-data.ts` `NEVER`). No workspace table has a column with those names, so it does not block any desk use today.
- The castle-point help text still says "it is not in copies or exports". That is still true, because nothing exports it.

## Next

- Desk exports or copies with x/y/online (now allowed by D163) are not built.
- The officers' map visual redesign (separate issue, per the orchestrator).
- Owner decision on public-page use of x, y, joined_at and names.
- A desk view that reads `member_x` / `member_y` from samples (e.g. movement during a KvK) is not built.

What was missing from the task prompt? That open PR #811 already uses D162 and migration 0086.

PR: (added by the orchestrator)
