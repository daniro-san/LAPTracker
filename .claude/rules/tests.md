---
paths:
  - "**/*.test.ts"
  - "e2e/**/*.ts"
---

# Tests

- Every test protects real behaviour, with realistic inputs. What counts, and the fake-test list review flags, are in CONTRIBUTING.md § Working rules, "Tests check real behaviour".
- Name tests as sentences stating the invariant: `it("marks the snapshot partial when any roster is older than 20 minutes")`.
- No live network calls. Mock `fetch`; bodies come from `fixtures/`. The only exception is the opt-in smoke test gated by `LAP_LIVE_TEST=1` (1 quota call).
- `fixtures/` is the contract with the upstream API. Tests read fixtures; they never write them. Adding a fixture is the `record-fixture` skill, a deliberate act that spends quota.
- Pure logic (lib/compute.ts, lib/budget.ts) gets property tests with fast-check where an invariant holds "for any input".
- Pass time in (`now`); don't depend on the wall clock. No sleeps.
- A test must be able to fail: assert on values, not just that a call didn't throw. One focused test per stated behaviour.
- Never weaken an assertion or skip a test to get green; if the test is wrong, say so in the handoff.
- **End-to-end tests check what the user sees (owner, 2026-11-21).** A request happening, or a status code alone, is never enough.
  - Each e2e test asserts the rendered screen: the page's heading; the key values the flow is about, checked against the seeded values (exact numbers, names, counts and dates as the page formats them), in the right element or region; and no error boundary, "Something went wrong" or empty-state text where data is expected.
  - After an action (tap, save, close), assert that the screen changed as a user would see it, and that the change survives a reload where the flow promises persistence.
  - API status checks (401, 404) are extra guards and never replace asserting what the page shows. A denied page shows the sign-in or denied screen, with none of the other alliance's data.
  - No pixel-snapshot tests by default: they are flaky across fonts and operating systems. Assert by role and text.
