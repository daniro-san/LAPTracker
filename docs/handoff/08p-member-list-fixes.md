# 08p — Member list: Before-only roster and member capacity

## Built
- `app/_ui/member-views.ts`: `canCompare(before, after)` is true only when both rosters are non-empty. `memberViews` diffs only then; with one roster it returns that roster as the current roster (status `""`, no joined/left, no earlier figures). Both rosters present: unchanged.
- `app/_ui/MembersExplorer.tsx`: new props `compared` and `capacity`. Without `compared` the `± Might` / `± Kills` sort chips are hidden, the `—` change line under each figure is dropped, and the rank has no movement mark. Might, Kills, Level and A–Z sorts, the name search and the might range still work.
- `StatMetric.noChange` (`StatTable.tsx`) and an optional `move` on `Rank` (`Num.tsx`) carry the above.
- `MemberCount` (exported from `MembersExplorer.tsx`) renders `Members 97 / 100`, or `Members 97` when capacity is null, plus ` · 12 shown` only while a name or might filter is on. `97` is the current roster size (members not marked Left), not the rows listed.
- `alliance_snapshots.capacity` (nullable integer, migration `drizzle/0007_brainy_kitty_pryde.sql`). `/v1` `capacity` is parsed as optional in `lib/sources/shared.ts`, copied by `lib/collector-rows.ts`, stored through the existing spread in `lib/repo/alliance-snapshots.ts`, and read by `getAllianceDetail` (`AllianceRow.capacity`). The alliance page passes `after.capacity ?? before.capacity ?? null`.
- `lib/copy.ts`: `members.shown`. `docs/DESIGN.md` (`member-filter`) and `docs/DECISIONS.md` (D32) updated.
- Tests: `member-views.test.ts` (Before-only has no left/joined; both rosters unchanged), new `MembersExplorer.test.ts` (capacity shown / plain count; `shown` only with a filter), `v1.test.ts` (capacity read, null when absent).

## Decisions
- Reading of "no After": an empty roster on either side, not only a missing After row. This also covers an After row that failed (no members stored). A missing Before with an After present shows the After roster the same way.
- Capacity is stored in its own column, not read from `raw_json` (`trimRaw` may drop it and queries never select `raw_json`).
- Internal-source rows get `capacity` null (its body has no such field); the page then shows the plain count.
- No new component: `MemberCount` is the old count line, so the branding book (`/brand`) has nothing to add; `docs/DESIGN.md` records the variant.

## Deviations
- None from the brief. The brief mentioned "joined/left filters"; the page has no such filter chips, only the `±` sort chips, so those are what is hidden.

## Verified
- `pnpm check` on Node 26.5.0: prettier, eslint, tsc, 140 tests pass (1 skipped as before). No upstream calls.
- Audit of other one-sided readers, no change needed: summary band (`totalsMetric` falls back to the Before figure and shows `—` as delta, as for any single snapshot); event page rows (`metricsFor` via `computeDelta`, `—` when one side is missing; `rosterChanges` only counts alliances present in both snapshots); `getAllianceDetail` (returns both sides, nulls when absent); `sightingsOf` / player pages (`eventRow` uses the Before as reference when there is no After and only builds `inEvent` when both exist).
- Not seen in a browser at any width, 360 px included: no database with a Before-only event is available in this session. The layout change is the removal of one line per figure and of the rank mark, plus a longer count line.

## Open issues
- Migration 0007 must be applied to Neon before the deployed code runs (the page selects `capacity`).
- Rows stored before this migration have null capacity; the first run after deploy fills it (Before on Saturday). The page shows the plain count until then.
- Summary band on a Before-only event still shows `—` under each total (existing behavior for one snapshot); left as is.
- After a failed/stale After with a non-empty roster the list still shows Joined/Left without change figures (unchanged from before).

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change does not touch run timing or quota.
Owner must do first: merge this PR into `dev` and apply migration 0007 to the production database (with 0006 if not yet applied).
Plan change: none.
<adjustments>
- Session 9 step 3: the rehearsal also stores `capacity` per alliance; compare it with `member_count` and note any alliance where `members.length` differs from `member_count`.
- After the Before run, open a manual or Saturday alliance page: the list should show all members with no Left marks and `Members n / 100`.
</adjustments>


https://github.com/daniro-san/LAPTracker/pull/96
