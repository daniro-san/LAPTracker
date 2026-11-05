# 08m — /admin live status and shared components

PR #82 (08k) was merged with its first commit only; its second commit (the UX pass) is carried here, cherry-picked. The audit and the local validation of that pass are in `docs/handoff/08k-admin-layout.md` on this branch's history (commit "admin UX pass"); summary: order by purpose, clearer quota and rehearsal blocks, four-line runs list, result message with the right mark.

## Built
- **Live status.** `runningSnapshots(db, now)` in `lib/queries/admin.ts` (status `running`, started under 10 minutes ago: a crashed row never locks the page). `/admin` shows a notice at the top of the run area: "A run is in progress", the phase, the event (a manual round by its name, a rehearsal tagged, a real event by its time), the start time, and "closes by itself within about 100 seconds". While it shows, `useRunWatch` calls `router.refresh()` every 4 s; when the run ends it says how it ended ("✓ Before snapshot of …: done"). An idle page does not poll, so a run the tick starts shows after a reload.
- **Controls off.** Every seal and the manual-round controls are disabled while a run is in progress; the notice is the reason.
- **Next scheduled run** under the intro: the next due phase and its time, from `currentEvent` / `nextEvent` (no schema).
- **Design system** (all in `lib/brand/components/`, documented in `docs/DESIGN.md` `Components`, shown on `/brand`): `CheckField` (row and chip variants), `RadioField`, `Notice` (ok, busy, fail, info), `FactList`, `Sheet` (modal and gate). No new token.
- **Split of admin files** (lint limits): `actions.ts` (button data and request builders), `outcome.tsx` (words for answers, running notice, result notice), `useRunWatch.ts`.

## Decisions
- `Sheet` replaces `app/_ui/admin/sheet.ts` (deleted); `ConfirmSheet` and `PinSheet` use it. The create form stays inline under its button (the owner's earlier choice), so it does not use `Sheet`.
- Components that now use the new ones: `CheckField`: round options (Discord), `ExactToggle`, `MyAllianceToggle` (chip). `RadioField`: round options (visibility). `Notice`: the run notice and the press result (the mark picks the tone). `FactList`: the round summary and the schedule. `Sheet`: `ConfirmSheet`, `PinSheet`.
- Left as is on purpose: the `/admin` PIN field and the round name field use `.drawn-field` directly (the brand's field class, no wrapper needed); the "Change options" `<details>` (the `Disclosure` component is a close-on-outside-tap menu, which would close the form while typing); section headings repeat the type classes (typography tokens, not a component); the `/brand` page's own `<select>` specimen.
- Polling is a client `router.refresh()` every 4 s only while something runs: the page reads through `lib/queries` and the admin cookie as before, no new route.

## Deviations
- None beyond the above. The server's claim per event and phase is unchanged.

## Verified
- `pnpm check`: 125 tests pass (1 skipped as before). Two new tests: `lib/queries/running.test.ts` (a live run is listed; a finished one and one abandoned for over 10 minutes are not), `app/_ui/admin/AdminActions.test.ts` (renders the notice and all four buttons disabled while running, none when idle). Under heavy machine load (load average 27) three PGlite files timed out once on their 10 s `beforeAll`; they pass on rerun.
- Browser, throwaway stack as in 08k (local Postgres on its own data directory, dev server on an `env -i` environment: no API key, unroutable upstream, no webhooks, made-up PIN kept only in a scratchpad file, owner's `.env.local` unused), Playwright with system Chrome at 360 px and 1280 px: with no running row, buttons enabled and no notice; after inserting a `running` snapshot row by SQL and reloading, the notice shows (phase, event, start time, the 100 s note), the three seals, the round controls and the round seals are all disabled (7 of 7); after updating the row to `complete` by SQL, the page dropped the notice on its own within the poll interval and showed "After snapshot of Renamed d1280: done."; no overflow at either width.
- Not seen: the real /admin with real data, a run really started by the tick, dark mode, the new components on `/brand` in a browser (they type-check and render in tests only), the 10-minute stale cut-off in a browser.
- Upstream API calls made: 0.

## Open issues
- A run the tick starts appears only after a reload (idle pages do not poll).
- If a collector crashed leaving a `running` row, the page treats it as live for 10 minutes, then ignores it; nothing closes the row.
- The 4 s poll and the 10 minute cut-off are constants in `useRunWatch.ts` and `lib/queries/admin.ts`.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — nothing here changes the numbers it measures.
Owner must do first: merge this PR into `dev`; open `/admin` and `/brand` once in a browser.
Plan change: none.
<adjustments>
- During the rehearsal the Rehearse seal and the other buttons are disabled with a "A run is in progress" notice; the notice appears after a reload if the tick started the phase.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/86
