# 08zb — Admin UX pass

Issue #91 (visual hierarchy and live status) and, at the owner's request during the mock review, #106 (rename any public event). Cut from `origin/dev` after #108 and #114 were merged. Branch `session/08zb-admin-ux-pass`.

## Built
- **Phase 1:**
  - Audit of `/admin`, `/admin/runs`, `/admin/runs/[id]` and `/admin/errors` at 360 and 1280 px, light and dark.
  - Two mock rounds, built as a temporary page with the real components and deleted before commit. Round 1 was approved with changes; round 2 was approved.
  - The live-indicator drawing, approved with a change.
  - The owner's three answers are under Decisions.
- `app/_ui/admin/parts.tsx`:
  - `AdminSection`: a flat 1 px frame with a title row, an optional chip or note, a help line and the body.
  - `Fact`: label, value with state chip, note.
  - `StateChip`: a run state in the `status-strip` tones.
  - `CostTag`: what an action spends.
  - `LiveIndicator`: the candle and its word, `role="status"`.
- `lib/brand/components/LiveCandle.tsx`: the chamberstick drawing (`icon_live` in `docs/brand/drawing/examples/ornaments.py`, registered in `build.py`). It has two animated parts. The motion is in `app/globals.css` (`live-flame`, `live-glow`, `.live-on` / `.live-off`) and stops under reduced motion.
- `app/_ui/admin/RunWatch.tsx`: the admin area's one poller. It wraps every admin page from `AdminShell` and passes the "finished" line to `/admin` through context.
  - `useRunWatch` itself is unchanged; it moved out of `AdminActions`.
  - `AdminShell` reads the running snapshots and the newest run, and shows the candle at the right of the admin nav.
- `/admin`, four sections:
  - **Status**: quota OK / Low · under 900 / Unknown (`QUOTA_WARN_BELOW`), what runs now, the next scheduled run with its event name, and the last result with its state chip, a link to the run, and the last 10 durations.
  - **Run something now**:
    - the current event by name, with Rename (free) or a line saying when it can be renamed
    - the three seals, each with a `CostTag`
    - the manual round: its card's phase chips, its seals with costs, and "Start a manual round" (free)
  - **Last rehearsal**: the verdict chip on the title row, and the checks with their marks (`app/_ui/admin/Rehearsal.tsx`).
  - **Schedule**: with a "Read-only" chip.
- Sub-pages:
  - `/admin/runs`: framed cards below 640 px and ruled rows above; each row is titled by its event's name (a rehearsal as `[rehearsal]` and its time) and has a state chip and the deadline chip.
  - `/admin/runs/[id]`: a framed summary (event · phase, state chip, event / started / finished / duration / API calls, the deadline chip), then the Upstream calls table (`RunTrace`, now an `AdminSection`), then the Log.
  - `/admin/errors`: the same frame, with the count as a seal chip.
- Item 7, round phases:
  - `latestManualEvent` returns each phase's `startedAt`, `finishedAt` and `error`.
  - `roundView` (`app/_ui/admin/words.ts`) puts them in words: "Not started: press Before", "Running since {time}", "Done {time}", "Partly done {time}", "Failed: {reason}".
  - After creating a round: "Round created. Nothing has run yet: press Before."
- #106:
  - `renameEvent` (was `renameManualEvent`, `lib/repo/events.ts`) and `POST /api/manual-event/rename` rename any public event.
  - `scheduledEvent` (`lib/queries/admin.ts`) finds the current event's row.
  - `renameEvent` action and the Rename form in `AdminActions`.
  - Two route tests in `app/api/manual-event/route.test.ts`: a Saturday event renamed before its Before ran, shown by `listEvents` and `GET /api/events`; a rehearsal refused with 404. The existing test still covers the manual-round rule and the name rules.
- Copy: `lib/copy-admin.ts` gained `live`, `status`, `run.event`/`rename*`/`free`, `manual.phaseState`, `rehearsal.verdict`, `runs.*Label`, `errors.count`. Costs now read "≈ 21 calls". The unused `quota` block was removed. The rehearsal's "✓ Pass" / "✗ Fail" stay, since the Discord message uses them.
- Docs and brand:
  - `docs/DESIGN.md`: `admin-section`, `status-fact`, `cost-tag`, `live-indicator`, `round-phase`; `timeline` updated; the candle in Motion and in the ornament budget.
  - `/brand` Components: admin section, live indicator on and off, cost tags, round phase states.
  - `/brand` Drawing: the chamberstick, animated.
  - `docs/DECISIONS.md` D37 (#91) and D39 (#106).
- Screenshots at 360 px: `docs/screenshots/08zb-admin-360-light.png`, `08zb-admin-360-dark.png`, `08zb-runs-360-light.png`, `08zb-runs-360-dark.png`.

## Decisions
- **Owner, 2026-11-05 (mock review):**
  - Round 1 was approved "with changes". The owner said it did not account for the whole admin, with the new things such as changing the title of every run. I read that as #106, and the owner then chose "build #106 inside #91's PR".
  - The candle: "loved it". The owner asked for small motion on the ticks or a swaying flame, so the flame sways and the ticks flicker.
  - The poller may move into `AdminShell`: moved, not duplicated.
- **#106 open point**: a scheduled event can be renamed whenever its row exists (from a day before its Before), before any snapshot included. The approved mock showed Rename on the coming event. Manual rounds keep D28 (only after a snapshot); rehearsals are refused. The route keeps its D28 path. Details are in D39.
- No "slow" or other new threshold. Quota "Low" is the existing `QUOTA_WARN_BELOW` (900).
- A rehearsal keeps its system name, which can't be renamed, so it is shown as `[rehearsal]` and its time, as before.
- Group titles inside sections use `display-sm` instead of the off-scale `text-lg`.

## Deviations
- #106 is in this PR, by the owner's choice; #91 alone said "no new admin features".
- `AdminShell` reads the running snapshots and the newest run, so `/admin` reads them twice per render (the shell for the candle and poller, the page for the notice and Status). Small reads; not merged into one query.

## Verified
- `pnpm check` after rebasing on #115: prettier, eslint, tsc, 163 tests passed (1 skipped), drift check clean. The admin pages use #115's `requestServerClock` (/admin stays in server time).
- Throwaway stack: local Postgres 18 on a scratchpad data directory through a WebSocket bridge, `next dev` under `env -i`, no real API key, upstream unroutable, no webhooks, made-up PIN in a scratchpad file. Migrations up to 0010 applied as SQL; seed plus hand-made rows for runs, logs, a manual round, app errors and the coming Saturday's row.
- Playwright and system Chrome: `/admin`, `/admin/runs`, `/admin/runs/6`, `/admin/errors` and `/brand` at 360 and 1280 px, light and dark. Overflow 0 and axe 0 violations on all 20.
- Live candle, by script:
  - With a `running` snapshot inserted by SQL, `/admin/runs` and `/admin` show "Run in progress" with `animation-name: live-flame`.
  - After the row was updated to `complete`, both flipped to "Idle" on their own within 3.4–3.6 s (4 s poll). `/admin` then showed "Before snapshot of Manual round 2026-11-05: done."
  - With `reducedMotion: "reduce"`: no animation, ticks fully shown. The first try failed: `.live-on [data-anim]` outranked the reset, and the selector was added to the reduced-motion block.
- Rename: on `/admin` at 360 px, Rename → "KvK 12-11" → Save name with the test PIN. The row was renamed in the database, the group shows the new name, and the notice says "Renamed."
- Not checked: the PIN sheet path for a first rename in a fresh tab (the session already had the PIN), a real production run, the dev preview.

## Open issues
- A rehearsal's title in `/admin/runs` repeats its date (`[rehearsal] Fri, 10/30/2026, 14:30 …` above the same date line).
- At 360 px the candle sits on its own line under the nav links (the three links fill the row); at ≥ 640 px it is on the nav row.
- Discord messages already sent keep an event's old name after a rename (D39); the next edit of that message uses the new one.
- Copy-derived React keys outside `/brand` (from 08za) are unchanged.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This PR adds no upstream call and no timing logic.
Owner must do first: merge this PR into `dev` (no migration). Before the dry run, name the coming Saturday on `/admin` if wanted: its row exists from Friday 10:00 server time.
Plan changes needed: none.

<adjustments>
- Session 9 step 1: while the rehearsal runs, the admin nav's candle reads "Run in progress" on every admin page and flips to "Idle" when a phase ends. The Status section's "Running now" and "Last result" show the same without opening the runs list.
- Session 9 step 2: each run's duration, calls and state are on `/admin/runs`. Per-call seconds, HTTP status and retries are on `/admin/runs/<id>` (08z).
- Saturday events can now be renamed (D39). If the owner renames the event under test, `GET /api/events` and the selector show the new name; Discord messages already posted keep the old one.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/117
