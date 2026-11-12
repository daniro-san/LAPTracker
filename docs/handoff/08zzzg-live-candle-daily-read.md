# 08zzzg — Live candle during a daily read

Owner report, 2026-11-12. While a daily read **Retry** ran on `/admin`, the button showed "Running…", but the candle at the right of the admin nav stayed "Idle".

Cause, two parts:
1. The candle, the "A run is in progress" notice and the "buttons off" rule all read `runningSnapshots`, which reads only the `snapshots` table. A daily read (D60) lives in `daily_reads`, so neither the tick's read nor a Retry ever counted as a run.
2. The candle changes only when `RunWatch` refreshes the page: every 20 s while idle. A Retry usually takes about 10 s, so even with part 1 fixed the candle would often stay "Idle" for the whole run.

## Built
- `app/_ui/admin/words.ts`: `watchViews(running, last, daily, now, clock)`. `daily` is the newest daily read.
  - It counts as running while `running` and started less than `RUN_STALE_AFTER_MS` ago, the snapshots' rule (INVARIANT `run.stale-after-150s`). It is then listed as phase "Daily roster read" and event its date.
  - It is `latest` (the run the "finished" line names) when it started after the last snapshot.
  - `latest.phase` is now already in words, so it can say "Daily roster read".
- `app/_ui/admin/useRunWatch.ts`, `RunWatch.tsx`: they take `latest.phase` as words.
- `app/_ui/admin/RunWatch.tsx` also holds whether this tab waits on a press that runs a read:
  - `useBusy()` replaces `AdminActions`' `useState` for the action in flight. While that action is in `RUN_ACTIONS` (`before`, `after`, `manual-before`, `manual-after`, `daily-retry`, in `actions.ts`), it marks the tab as pressing.
  - `LiveNow` (client) shows `LiveIndicator` lit when the server reports a run or the tab is pressing.
- `app/_ui/admin/AdminShell.tsx`: it also reads `listDailyReads(db, 1)` and renders `LiveNow` instead of `LiveIndicator`.
- `app/(pages)/admin/page.tsx`: passes today's daily read to `watchViews`, so the notice and the buttons-off rule cover a running daily read too.
- `docs/DESIGN.md` `live-indicator`: says what counts as a run and that a press lights the candle.

## Decisions
- **Lit at the press by client state, not by an extra refresh.** A refresh during the press would let `RunWatch` see the run end and replace the press's detailed result ("API calls used: 21. Stale: 0. Failed: 0.") with its short "finished" line.
- **Every press that runs a read lights it**, not only Retry. The snapshot seals had the same delay of up to 20 s.
- **Rehearse, rename and the manual round's create/save do not light it.** They answer at once and start no read.
- **While a daily read runs, the snapshot seals are off**, with the "A run is in progress" notice, as for a snapshot run. A read lasts at most about 100 s, and the scheduled snapshots run from the tick, not these buttons.

## Deviations
- No committed test (CLAUDE.md: the task did not ask for one). Checked as below; the temporary test was deleted.

## Verified
- Temporary `watchViews` test (passed, deleted):
  - daily read `running` started 100 s ago: in `running` as "Daily roster read · Thu, Nov 12", and `latest`;
  - started 150 s ago: not in `running`;
  - `complete` and newer than the last snapshot: `latest`;
  - older than the last snapshot: `latest` is the snapshot ("Before snapshot");
  - no runs at all: `latest` is null.
- Chrome 360 px (playwright-core from the scratchpad, system Chrome) on `next dev` with the Neon preview branch and an admin session. The Before seal's `POST /api/snapshot` was held in the browser and answered 409 by the test, so nothing reached the server: no upstream call, no database write. The candle read "Idle" before the press, "Run in progress" while the request was held (1 request sent), and "Idle" after the answer. The page showed the answer as "A run is already in progress."
- `pnpm check`: prettier, eslint, typecheck, 254 tests passed (1 skipped), drift check "No schema changes", i18n "17 languages up to date".
- Not checked in a browser: a daily read `running` in the database lighting the candle from the server side. That needs a `running` row in `daily_reads` on the preview branch. The server path is the `watchViews` test above plus the unchanged poller.

## Open issues
- Before this change too: when the poller sees a pressed run as running and then as ended, the "finished" line replaces the press's detailed result. A press longer than one poll interval shows the short line in the end. Not changed here.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. Checks passed on the first full run.
Owner must do first: merge this PR into `dev`, then release a patch (Actions → Prepare release, patch → v4.2.1). #239 and #240 already shipped in v4.2.0. After the release, the candle should turn on at once on the next Retry or snapshot seal press.
Plan changes needed: none.

<adjustments>
- "Is anything running" on the admin pages is `watchViews(...).running`: snapshots plus the newest daily read. A new kind of run must be added there, not only to its own page.
- A new `/admin` button that runs a read must add its action id to `RUN_ACTIONS` in `app/_ui/admin/actions.ts`, or the candle stays off until the next poll.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/242
