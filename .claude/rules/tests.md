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
- A test must be able to fail: assert on values, not just that a call didn't throw. One focused test per stated behaviour.
- Never weaken an assertion or skip a test to get green; if the test is wrong, say so in the handoff.
- **End-to-end tests check what the user sees (owner, 2026-11-21).** A request happening, or a status code alone, is never enough.
  - Each e2e test asserts the rendered screen: the page's heading; the key values the flow is about, checked against the seeded values (exact numbers, names, counts and dates as the page formats them), in the right element or region; and no error boundary, "Something went wrong" or empty-state text where data is expected.
  - After an action (tap, save, close), assert that the screen changed as a user would see it, and that the change survives a reload where the flow promises persistence.
  - API status checks (401, 404) are extra guards and never replace asserting what the page shows. A denied page shows the sign-in or denied screen, with none of the other alliance's data.
  - No pixel-snapshot tests by default: they are flaky across fonts and operating systems. Assert by role and text.
  - Expected values are computed from the seed module's exports, and dates from the instant it seeded at; never typed in as literals.
  - A sweep over many pages first asserts it got the real page (the alliance's name, no sign-in screen) before it checks that data is absent.
  - Find elements by role and name, scoped to their row or card. No `.first()` over a list whose order depends on the weekday.
  - No `waitForTimeout`: wait on a locator, `expect.poll` or `page.clock`.
  - A test that writes uses rows no other test reads (one set per project), or runs on one project only.
  - A test that ends a session or changes a workspace switch uses its own seeded session or workspace.

## Which test

| Code                                                   | Test                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Pure rules, parsers, formatters                        | Unit; fast-check where an invariant holds "for any input"                                               |
| `lib/repo`, `lib/queries`, `lib/private`               | PGlite: `openTestDb()` once per file in `beforeAll`, `truncateAll(db)` in `beforeEach`                  |
| Route handlers                                         | PGlite and a real `Request` to the exported handler, `getAppContext` mocked to return `testContext(db)` |
| Flows, isolation between workspaces, what a page shows | Playwright end-to-end                                                                                   |

## Time

- Pass time in (`now`); don't depend on the wall clock. Rows, sessions and tokens use the test's clock (`T0`, `clock.now`), never `new Date()` or `Date.now()`.
- One fixed instant per test, in UTC, with the server time in a comment (tests run the server at UTC−2): `new Date("2026-11-21T01:31:00Z") // Fri 23:31 ST`. Use the times the code depends on: Saturday 12:00 ST KvK; Before 10:00 and After 14:00 ST; the Friday 23:30 ST and Saturday morning shield reads; the 23:30 ST daily read; Monday 00:00 ST; the 00:00 UTC quota reset.
- Timers: `vi.useFakeTimers({ now })`. To wait for fire-and-forget work, use `vi.waitFor`; no `setTimeout` or other sleep in a test.

## Mocks and assertions

- Mock only what leaves the process (`fetch`, the OCR worker) and the Next.js runtime Vitest lacks (`after`, `next/headers`, `next/navigation`, `next/cache`). A test that must not touch the database passes `noQueryDb`.
- Never mock `lib/queries` or `lib/repo` away; they run on PGlite. Wrapping the real function to delay or fail it on purpose is fine.
- Don't assert a constant's value; assert the behaviour at its edge (just under, at and just over the limit).
- A count is only a guard that a scan found its inputs (`toBeGreaterThan(0)`), never the assertion itself.
- A privacy detector or scan has a positive control: a case it must catch.
- A new route under `app/(private)/api/w/[slug]` gets its `FIXTURES` entry in `member-session.test.ts`. `EXCLUDED` is only for a route a decision makes a non-officer route (D105, D142).
