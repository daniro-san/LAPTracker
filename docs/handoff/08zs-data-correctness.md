# 08zs — Data correctness follow-ups (#123)

## Built
Three fixes, each with a test that failed before the fix, and one D44 line for every other bullet of #123.

- **Fix 1: `v1.retry` carries the status.**
  - `lib/sources/types.ts`: `OnAttempt` is now `(attempt, status?: number | null)`. `status` is the response that caused this retry.
  - `lib/sources/v1.ts`: `request()` keeps `previous` across loop iterations and passes it; it is null on attempt 0.
  - `lib/collector.ts`: `attemptHook` writes `http_status` on the `v1.retry` line.
  - Tests:
    - `lib/sources/v1.test.ts`: the existing onAttempt test now records `[attempt, status]` and expects `[[0, null], [1, 502]]`. Its name says so.
    - `lib/collector.test.ts`, new: a fake v1 reports attempt 1 with 503, and the run writes `{ union_id, retry_n: 1, http_status: 503 }`.
  - `docs/ARCHITECTURE.md`: the orientation copy of `OnAttempt` is updated.
- **Fix 2: quota-call retries are counted.**
  - `lib/queries/admin.ts` `runTrace`: the retry map is keyed by `union_id`, with null as a key. The quota row gets the count of `v1.retry` lines with no union id (one quota call per run), and `total.retries` includes it.
  - `TraceCall.retries` is now `number`, not `number | null`; the doc comment states the new contract.
  - `app/_ui/admin/RunTrace.tsx`: the `count()` helper is removed and the retries cell renders `c.retries` (card and table).
  - `/brand`'s made-up trace (`app/(pages)/brand/ComponentsSection.tsx`) drops `retries: null` on its quota row, so that row shows `0`.
  - Test: new `lib/queries/admin.test.ts`. Two quota retries and one alliance retry give `[["quota", 2], ["alliance", 1]]` and a total of 3.
- **Fix 3: `active` is a blocked roster key.** Added to `BLOCKED_ROSTER_KEYS` (`lib/queries/blocked-keys.ts`). The fixture the blocked-keys test reads (`fixtures/v1-20261104T155902Z/alliance-67111155.json`) has `active` on all 100 members, and no read model in `lib/queries` uses `active`.
- **D44** in `docs/DECISIONS.md`: the three fixes, then one line each for N9 (amends D5), N8 (done, hh:mm caveat), hasAvatar, `calls_used`, the banner query cost, and the banner's last attempt (refers to D27 "Limits").

## Decisions
- **`status` is optional in `OnAttempt`.** The fakes in `lib/collector.test-helpers.ts` and in the deadline tests call `onAttempt?.(0)` and did not need to change. The real adapter always passes it.
- **`retries` became a plain number.** With the quota call counted, no row has a null count. The type change makes `tsc` find every place that rendered or built the old null, which is how the /brand sample was found.
- **Room for the `v1.retry` change.** `lib/collector.ts` was at the 300-line `max-lines` limit. The deadline timer's callback became `setTimeout(() => resolve(hitDeadline(run)), …)`, which is the same behaviour in one line instead of six. The retry data object takes one line of its own.

## Deviations
- **The PR depends on #148 (#120).** This branch is cut from `session/08zr-collector-robustness`, which is not merged, and both change `lib/collector.ts`, `lib/sources/v1.ts` and `lib/queries/admin.ts`. Until #148 merges, the PR diff includes #148's commits. The PR body says so.
- **PR title.** The decision comment gives none; I used `fix: data correctness follow-ups (#123)`.

## Verified
- `pnpm check` on Node 26.5.0 passed: prettier, eslint, tsc, vitest (40 files passed, 1 skipped; 192 tests passed, 1 skipped), check-drift and i18n-check. I ran it before the cherry-pick onto the merged #120 branch and again after it (see the PR body).
- Mutation pass:
  - Dropping `previous = status` in v1 fails the v1 test.
  - Logging `http_status: null` fails the collector test.
  - Giving the quota row 0 retries fails the runTrace test.
  - Removing `active` from the list does **not** fail a test (see Open issues).
- RunTrace rendering: I did not render it. The worktree has no `.env.local`, and the server validates its environment at start, so `next dev` was not run. A throwaway render test was blocked by the session's permissions. What I checked instead: after the type change, `tsc` passes. The retries cell renders `{c.retries}`, a number, in both the card and the table, and the total cell already rendered `{total.retries}` the same way.
- I confirmed N8 in code: `SideHead` heads each side in `app/_ui/EventView.tsx:53-54` and on the alliance page (`app/(pages)/events/[id]/alliances/[unionId]/page.tsx:143-144`).

## Open issues
- **The owner adds `active` to the CLAUDE.md hard-rule list** ("Roster fields x, y, online, …"). This session does not edit CLAUDE.md.
- **What the blocked-keys test covers.** It proves the detector finds every listed key in a real roster, and that no read model uses one. It cannot fail when a key is removed from the list. The decision chose this coverage; a test that pins the list's contents would be one line if the owner wants it.
- **Check the quota row on the run page after merge.** On `/admin/runs/[id]` of a real run, the quota row should show a number in Retries (usually `0`) where it showed `—`.
- `docs/handoff/08z-admin-run-trace.md:57` still says the quota retries are counted nowhere. Handoffs are history, so I left it.

## Next
Session: 08zt — tick heartbeat (#121), lane A, last
Model / effort: keep. #123 needed no raise: three small fixes and the D lines, with no surprises.
Owner must do first: nothing for #121 to start. #121 is cut from this branch while #148 and this PR are open. To merge in order: #148, then this PR, then #121.
Plan changes needed: none from this session.

<adjustments>
- `lib/collector.ts` is again exactly at `max-lines` (300 code lines). #121 should not need to touch it; if it does, it must save a line.
- `TraceCall.retries` is a `number` now. Any new /admin read that reuses `TraceCall` gets no null.
- `lib/queries/admin.ts` imports `RUN_STALE_AFTER_MS` from `lib/compute.ts` (from #120). The tick read for #121 goes in the same file next to `runningSnapshots`.
</adjustments>
