# 08c — Admin run buttons: copy and layout

## Built
- `/admin` → "Run something now": the Rehearse seal sits on its own. The Before and After seals sit in a labelled group ("Snapshots", `role="group"`), one row each: seal on the left, one-line helper on the right. Under the pair: "Costs about 21 API calls. Normally the scheduler does this for you."
- Helpers: Before "Record the numbers before the event. Use it if the scheduled run didn't happen."; After the same with "after".
- `lib/copy-admin.ts`: new `run.snapshots` block (`title`, `before`, `after`, `cost`). `run.costs` now only states the rehearsal cost; the snapshot cost moved to `run.snapshots.cost`.
- `app/_ui/admin/AdminActions.tsx`: `ACTIONS` split into `REHEARSE` and `SNAPSHOTS`; seal rendering moved into `ActionSeal` (the component hit the 80-line lint limit).

## Decisions
- Kept the existing "Before snapshot" / "After snapshot" accessible names, confirm dialogs, PIN flow and API calls unchanged. Seals stay 96 px, so touch targets are above 44 px; helpers are plain text, nothing hover-only.
- Rows (seal + text) instead of a side-by-side pair, so the helper has room at 360 px.
- The old `run.costs` line kept its rehearsal half, so that cost still shows.

## Deviations
- None. No tests asserted the old strings (`run.costs` is read only by `app/(pages)/admin/page.tsx`), so none changed and none were added.

## Verified
- `pnpm check`: prettier, eslint, tsc and vitest pass (26 files passed, 1 skipped; 101 tests passed, 1 skipped).
- Not verified: the page was not rendered in a browser at 360 px; it needs the admin PIN and a database. Upstream API calls: 0; nothing was run against production.

## Open issues
- Possible later change: one "Run now" button that picks the due phase. Not built.
- The snapshot cost line also stays in the confirm dialogs ("About 21 API calls, up to a minute"); unchanged.

## Next
Session: 9 — Dry run against production
Model / effort: keep (opus, high) — this change does not touch collection.
Owner must do first: merge this PR into `dev`; check the new `/admin` group on a phone.
Plan changes needed: none.

<adjustments>
- The Session 9 text says "tap **Rehearse now**"; the button is labelled "Rehearse" (accessible name unchanged by this PR).
- Do not trigger either snapshot by hand in Session 9; the new helpers describe them as a fallback.
</adjustments>
