# fix/e2e-day-change-wait

## Built
- `e2e/global-setup.ts`: near the server's day change (02:00 UTC, UTC−2), the setup waits until 10 minutes after it, then seeds with the time after the wait. It used to throw. `waitForDayChange(nowMs)` returns the wait.
- `e2e/global-setup.test.ts`: two tests, a run away from 02:00 UTC starts at once; one at 01:58:20 UTC waits until 02:10 UTC.
- `.github/workflows/e2e.yml`: `timeout-minutes` 15 → 35 to fit the wait (at most 20).
- D150: dated amendment.

## Decisions
- Wait instead of fail: `e2e` is a required check, and the first refusal blocked a docs-only PR (#607) at 01:58 UTC. D150's own rule removes a required check that fails at random; a clock-based refusal is one.

## Deviations
None.

## Verified
- `pnpm check`: exit 0, 1,559 tests passed.
- The new test failed when the wait was forced to 0, then passed after restoring it.
- The workflow's wait path runs only near 02:00 UTC; it is not exercised by this PR's CI run unless it lands in that window.

## Open issues
None.

## What was missing from the task prompt?
Nothing; found from #607's failed run.

## Next
Keep the e2e required check; no change to the plan.

PR: (added by the orchestrator)
