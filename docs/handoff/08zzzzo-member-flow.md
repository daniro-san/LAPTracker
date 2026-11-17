# 08zzzzo — Member flow between tracked alliances (issue #275)

## Built
- `lib/flow.ts`: pure arithmetic. `placeMembers` (uid to alliance for one day), `buildFlow` (counts per source and destination), `visibleCells`, `summarise`, `activityOrder`, and the constant `FLOW_MIN = 5`.
- `lib/flow.test.ts`: examples and property tests (a row adds up to the alliance's start members, a column to its end members; every cell left after hiding is at least 5).
- `lib/queries/flow.ts` and `lib/queries/flow.test.ts`: `flowPage(db, now, period, tracked)` and `defaultPeriod`. PGlite tests.
- `app/(pages)/alliances/flow/page.tsx`, `app/_ui/FlowPicker.tsx`, `app/_ui/FlowView.tsx`: the public page `/alliances/flow?from=&to=`.
- `lib/copy-flow.ts` (spread into `en.flow` in `lib/copy.ts`) and the 17 translations in `lib/i18n/*.ts` with stamps and glossary rows.
- Links: `app/_ui/AllianceLinks.tsx` (alliance page title row) and the merge page; the flow page links back to the merge simulator.
- `scripts/seed-daily.ts`: members move between alliances from the fourth daily read of the second week on, so the matrix has real shapes locally.
- `docs/decisions/D89-member-flow-between-tracked-alliances.md` and its line in `docs/decisions/README.md`.
- Screenshots `docs/screenshots/08zzzzo-flow-{360-light,360-dark,640-light,1280-light}.png`.

## Decisions
- A member's alliance on a day is the alliance whose usable daily roster (D60 `dailyFit`) of that day lists the uid. In two rosters on one day: the roster with the later `source_updated_at`, then the lower union id.
- Event rosters do not count; daily reads only.
- Only alliances with a usable read on both days are counted; others are named under the matrix, and their members count as outside on both days.
- Rows are the counted alliances plus "New"; columns are the counted alliances plus "Left". "Changed alliance" means two different counted alliances; arrivals and leavers are a second line.
- The default period is the newest read and the latest read on or before 7 days earlier, else the oldest read. The selects list the days with a usable read from the last 90 days (`FLOW_DAYS`).
- Cells and destinations under 5 are not shown; the hidden remainder per row is not shown either. The diagonal ("Stayed") follows the same threshold.
- No exact-numbers toggle on the page: counts are small whole numbers.
- Rows on the table are ordered by moves in plus out, not by size.

## Deviations
- The spec lists the columns "outside the 20" and "new to the 20". New members have no source alliance, so "new" is a row and "left" is a column (see Decisions).
- The orchestrator pushes; this branch has local commits only.

## Verified
- `pnpm exec vitest run lib/flow.test.ts lib/queries/flow.test.ts`: 14 passed.
- `pnpm typecheck`: clean. `pnpm exec eslint app lib scripts`: clean.
- `pnpm exec tsx scripts/i18n-check.ts`: 17 languages up to date with English.
- Local run on a local Postgres with the seed: `/alliances/flow` returned 200; at 360, 390-class and 640 and 1280 px there was no horizontal page scroll; selects, summaries and the button measured 44 px.
- Seed result Oct 23 to Oct 30: 15 changed alliance, largest move 6, 5 came from outside, 5 left; the 3-member move is hidden.

## Open issues
- A day with a usable read for only a few alliances still appears in the selects; the page names the alliances that are not counted, but a flow between such a day and a full one is mostly "New" and "Left".
- A member who moves into an alliance that is not counted shows as "Left"; the page says which alliances are not counted.
- The phone list has one row per alliance (20 rows). Rows with only a "Stayed" figure still expand.
- Pre-existing: `pnpm db:local:seed` and `dev:local` use the bridge port 54321 by default; a bridge from another worktree on that port sends the seed to that worktree's database (it refused here because that database already had events). Set `DB_LOCAL_BRIDGE_PORT` in `.env.local` per worktree.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after Session 10.
Model / effort: keep. The work was routine.
Owner must do first: nothing. Confirm the threshold of 5 and the reading of "changed alliance" in D89.
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md` or `docs/SESSION_PLAYBOOK.md`.

<adjustments>
- The alliance page's links live in `app/_ui/AllianceLinks.tsx`; add any new one there.
- `flowPage` returns counts of at least `FLOW_MIN` only; a follow-up that needs more must add its own read and its own privacy decision.
- `dayDate` and `FLOW_PATH` are exported from `app/_ui/FlowPicker.tsx`.
</adjustments>

## UX review (2026-11-16)
Measured, Chrome at 360, 390, 412, 600, 768, 810, 820, 1024, 1180, 1280 in light and dark; WebKit at 390 dark and 820; German and Russian at 360; one alliance renamed to a 29-character name locally.
- Page scroll width equalled the viewport at every width. The two selects measured 44 px in Chrome and WebKit. No tap target under 44 px except the skip link (hidden until focus). The sticky first column held in WebKit at 820. German and Russian wrapped with no clipping; the long name wrapped in the phone row.
- Fixed: at 768-820 px the matrix box scrolls (893 px in 720-772) and the "Left" column, the only place leavers show, sat off screen. "Left" is now sticky at the right edge.
- Fixed: on a phone 17 of 20 rows held only "Stayed" and the 3 rows with moves were buried. Rows with a visible move now come first and are open; the rest are one plain line (no chevron).
- Fixed: the "moves under 5 are hidden" line sat after the 20-row list on a phone. It is now under the sentence, before the table or list.
- Left: the matrix is mostly empty cells (a hidden move and no move look the same); that is the rule in D89, and the sentence says it. Not changed.
- Left: "New" is the last phone row; it opens only when it has a visible move. Kept, for the same order as the table.
- No copy was changed, so no translations changed.

https://github.com/daniro-san/LAPTracker/pull/349
