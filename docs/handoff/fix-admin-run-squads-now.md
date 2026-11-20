# fix — /admin "Run the squads read now" (D117, amendment 2026-11-19b; part of issue 472)

## Built
- `POST /api/admin/squads-read` (`?union=<id>` for one workspace, none for all). PIN only, through `authorize`. It answers 202 with the day and the workspaces' slugs. The batches then run in `after()`, through `squadsBatch` → `runSquadsBatch` with `force`, on their own connection. `maxDuration` is 300 s. One batch follows another while members are left and another whole 100 s batch would end by 240 s. A batch that made no call ends the press.
- `runSquadsBatch(deps, db, { force, unionId })`. `force` changes only how the day is picked: `squadsBatchDay` → `forcedSquadsDay` (`lib/squads.ts`). Everything else is the tick's code: the claim, `once-per-member`, the 120-call cap, the reserve, D124's keys, one retry, no `fresh`, the 100 s deadline.
- `quotaDayRead` and `inEventWindow` (`lib/schedule.ts`). A press uses the row of the daily read whose `DAILY_ROSTER_AT` falls on the current UTC day. That is the same row the nightly batches use, so the cursor, the retry list and the cap are shared.
- Refusals are 409 and start nothing: `event_window`, `quota_reset` (a batch would cross 00:00 UTC), `daily_read_pending`, `no_target`.
- Every `run_logs` line of a press carries `forced: true`. The marking is done in the logger's sink, so the code paths stay the same. Lines hold counts only.
- /admin has a "Squads read" section after Workspaces (`SquadsCard.tsx`, `lib/queries/squads-progress.ts`). Each workspace shows its state, "Read N of M · R waiting to retry · F failed · quota left Q", and "Last batch …". The section lists the workspaces the read takes (D126 squads switch on, plus a usable key, from the key's status without opening it) and any workspace with a row today. It also has a button per workspace and one for all.
- `startQuota` moved from `lib/squads-read.ts` to `lib/squads-call.ts` unchanged, to keep the file under the 300-line lint limit.
- Tests:
  - `app/api/admin/squads-read/route.test.ts` (4): PIN; the read after the answer, on the quota day's row, logged as forced; batches within the budget; the refusals for the event window and the quota reset.
  - `lib/squads-read-press.test.ts` (3): goes on from the night's cursor and never runs in the event window; the cap; the reserve.
  - `lib/queries/squads-progress.test.ts` (1).

## Decisions
- No separate limit on presses. The previous draft had "3 presses an hour" in `auth_attempts`. I removed it, because the other /admin buttons rely on the PIN's limiter only, and the claim, the day's cap and the reserve already bound what presses can spend.
- "Runs batches within `maxDuration`" is read as "one batch after another, in one `after()`". `maxDuration` is 300 s, as for `/api/tick`. A 101-member roster at about 1.4 s a call needs about 140 s, which is two batches, so one press should finish a day.
- The "Squads read" section sits after Workspaces and before Discord.

## Deviations
- The task said to rebase onto `origin/dev` with #452 in it. #452 was already in the base (af093e30, merged as #470). `origin/dev` then moved to be0c4e32 (D126, #463) while I worked, and I rebased onto that. The D126 switch is what "workspaces that have squads on" means, so `squadsOn` on /admin checks it.

## Verified
- `pnpm check` passes: prettier, eslint, tsc, vitest with 1216 tests passed and 4 skipped across 228 files, the schema drift check (no schema change, no migration), and i18n (17 languages up to date).
- No upstream call was made. All tests use stubbed `fetchPlayer`/`fetchQuota`, and nothing called `/api/quota`.
- None of the 307 fixture names appear in the added lines.
- Not run: an e2e on a local production build with screenshots. A real press calls the tracker, and the page render is covered only by the typecheck and the query test. /admin is English only (D48).

## Open issues
- On `LAP_API_KEY`, a press starts from the last quota number the row (or the daily read) saved. That number can be hours old. At most one call can land before the first answer gives the real `quota.remaining`. The safety margin of 100 covers calls made in between. This is recorded in the D117 amendment as a known limit.
- What one press leaves (cut by the 240 s budget) takes another press. The tick does not continue a forced run outside the nightly window.

## Next
- Model/effort: keep.
- What the owner must do first: merge, then on /admin press "Run the squads read now" for OGs after the night's daily read and before 22:00 server time, outside the KvK's Before/After window. Reload after about 4 minutes and check "Read N of M", the retries waiting, and `/admin/runs/daily/[day]` for `squads.batch` lines with `forced: true`.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Issue 472's daily queue can reuse `squadsBatchDay`/`forcedSquadsDay`, `quotaDayRead` and the press loop in `squadsBatch`. A queue that reads outside the nightly window must use the quota day's row (`quotaDayRead`), or a member is read twice in one UTC day.
- `squadsProgress` already gives the counts a desk status bar (issue 478) would need: reached, members, retrying, failed, batch running, last batch.
</adjustments>

PR: (added by the orchestrator)
