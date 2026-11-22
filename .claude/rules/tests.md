---
paths:
  - "**/*.test.ts"
---

# Tests

- Every test protects real behaviour: a user flow, a user action, or a rule a decision or the plan states, with realistic inputs (server weekdays, KvK Saturday, the 23:30 ST read). Never a test written for counts or coverage. Fake tests (a mock asserted with what the test passed it, implementation snapshots, private helpers with no behaviour, duplicates) are flagged in review (CONTRIBUTING.md § Working rules, "Tests check real behaviour").
- Name tests as sentences stating the invariant: `it("marks the snapshot partial when any roster is older than 20 minutes")`.
- No live network calls. Mock `fetch`; bodies come from `fixtures/`. The only exception is the opt-in smoke test gated by `LAP_LIVE_TEST=1` (1 quota call).
- `fixtures/` is the contract with the upstream API. Tests read fixtures; they never write them. Adding a fixture is the `record-fixture` skill, a deliberate act that spends quota.
- Pure logic (lib/compute.ts, lib/budget.ts) gets property tests with fast-check where an invariant holds "for any input".
- Pass time in (`now`); don't depend on the wall clock. No sleeps.
- A test must be able to fail: assert on values, not just that a call didn't throw. One focused test per stated behaviour.
- Never weaken an assertion or skip a test to get green; if the test is wrong, say so in the handoff.
