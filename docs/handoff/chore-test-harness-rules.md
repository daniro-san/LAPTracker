# chore: harness — which test, time, mocks and e2e specifics (test audit, batch 3)

## Built

- **.claude/rules/tests.md**:
  - six sub-bullets under the existing end-to-end rule:
    - expected values come from the seed module's exports and the instant it seeded at;
    - a sweep first asserts it got the real page;
    - locators by role and name, scoped to a row or card, with no `.first()` over a weekday-ordered list;
    - no `waitForTimeout`;
    - writes use rows no other test reads, or run on one project;
    - a test that ends a session or changes a workspace switch uses its own session or workspace.
  - `## Which test`: a table that maps each layer to a kind of test (unit, PGlite, PGlite plus a real `Request`, Playwright).
  - `## Time`: the old "Pass time in (`now`)… No sleeps." bullet moved here and was extended:
    - the test clock (`T0`, `clock.now`), never `new Date()` or `Date.now()`;
    - one fixed UTC instant with the server time in a comment;
    - the real times the code uses;
    - `vi.useFakeTimers({ now })`, and `vi.waitFor` instead of `setTimeout`.
  - `## Mocks and assertions`:
    - mock only what leaves the process, plus the Next.js runtime that Vitest does not have;
    - `noQueryDb`;
    - never mock `lib/queries` or `lib/repo` away;
    - no asserts on constant values;
    - counts only as scan guards;
    - a positive control for privacy detectors;
    - new `/api/w/[slug]` routes go into `FIXTURES` in `member-session.test.ts`.
  - `paths:` already matched `e2e/**/*.ts`, so it was not changed.
- **REVIEW.md § Tests**:
  - the first item now names "a privacy detector or scan with no positive control" (this merges the proposal's fourth item);
  - three new items: e2e asserts rendered values from the seed and the changed screen (and after a reload where the flow promises persistence); no wall clock, `waitForTimeout` or real `setTimeout` in a test body, and PGlite opened once per file; a new `/api/w/[slug]` route passes the walker with a `FIXTURES` entry.
- **CONTRIBUTING.md § Working rules, "Tests check real behaviour"**:
  - the pointer sentence now says tests.md also covers "which kind of test fits which code";
  - one sub-bullet: a change to a desk flow or to a public page's numbers updates its e2e assertion in the same PR, marked "(orchestrator recommendation, 2026-11-21; owner to confirm)".

## Decisions

- Every name was checked against origin/dev:
  - `openTestDb`, `truncateAll` and `noQueryDb` are in `lib/db.test-helpers.ts`;
  - `testContext` is in `lib/app-context.test-helpers.ts`;
  - `T0` and `clock.now` are in `lib/collector.test-helpers.ts`;
  - `FIXTURES` and `EXCLUDED` are in `app/(private)/api/w/[slug]/member-session.test.ts`.
- Times were checked against the code:
  - the test server zone is `Etc/GMT+2` (UTC−2), so `2026-11-21T01:31:00Z` is Friday 23:31 ST;
  - the Friday shield read starts at 23:30 ST (`NIGHT_MINUTE`), the morning read at 10:00–11:00 ST, and KvK at 12:00 ST;
  - the daily read is at 23:30 (`DAILY_ROSTER_AT`).
- The mock rule also allows the Next.js runtime modules. Tests on dev mock `next/server` (`after`), `next/headers`, `next/navigation` and `next/cache`, which Vitest does not provide. A rule that allowed only `fetch` and OCR would conflict with 20+ existing tests.
- "Never mock `lib/queries` or `lib/repo`" allows wrapping the real function. `app/api/snapshot/route.test.ts` wraps the real `insertRunLog` to delay it, and `lib/samples.test.ts` spies on the real `dueSample`; neither replaces the real code.
- `EXCLUDED` is allowed only for a route that a decision makes a non-officer route (D105, D142). This matches the three routes excluded today and the reasons in their comment.

## Deviations

- PR #600 (e2e) is not on origin/dev: there is no `e2e/` folder and no D150. So the e2e lines say "the seed module's exports" and "the instant it seeded at", not `e2e/fixtures/seed.ts`, `calendarOf` or `seededAt`, and they cite no D150. Once #600 merges, those names can be added. In the #600 worktree they exist as `calendarOf` and `seededAt` in `e2e/fixtures/seed.ts`.
- Dropped from the proposal:
  - the naming line (`(D137)` in test names, and the e2e `test("<Screen>: …")` shape): the task did not list it;
  - "15-minute samples", "the 23:52 retry" and "the Sunday/Monday thanks" from the time shapes: the task's list does not include them;
  - `proxy.ts` headers in the Playwright row: the audit's own batch 1 also adds a Vitest `proxy.test.ts`, so tying them to Playwright alone would contradict it;
  - "Don't assert that a mock received what the test gave it": it is already on CONTRIBUTING's fake-test list;
  - "puts the row back with an on-screen check" in the e2e write rule: the task did not list it;
  - the quota-route walker in the REVIEW item: no such walker exists on dev (audit batch 2 adds `app/api/quota-gate.test.ts`);
  - the proposal's CONTRIBUTING e2e sub-bullet: PR #601 already added an equivalent line.
- REVIEW's separate "privacy detector has a positive control" item was merged into the existing first item instead of being added a second time.

## Verified

- `pnpm check`: exit 0. Prettier, ESLint and tsc are clean. Vitest: 297 files passed and 2 skipped, 1552 tests passed and 4 skipped. Drift and i18n checks pass.
- Self-review for contradictions across CLAUDE.md, CONTRIBUTING, REVIEW, `.claude/rules/tests.md` and docs/DESIGN.md. One was fixed: the REVIEW e2e item had asked for a reload after every action, and now asks for one only where the flow promises persistence, as tests.md does. No other conflict was found. DESIGN.md has no test-method rules beyond the colour-literal grep.

## Open issues

- The e2e "update in the same PR" line needs the owner's confirmation. It concerns when tests change, which CONTRIBUTING assigns to CLAUDE.md. It sits next to "When a test breaks because the app's behaviour changed on purpose, change the test with it", so it does not conflict with CLAUDE.md's "commit tests only where the task asks".
- Existing tests that break the new rules are not changed here (audit batch 5): 13 `new Date()`/`Date.now()` and 6 `setTimeout` uses in `*.test.ts`, and `lib/run-notify-turnout.test.ts` mocks `./queries` away.
- After #600 merges, the e2e lines can name `e2e/fixtures/seed.ts`, `calendarOf(seededAt())` and D150.

## Next

The audit's next batch (4, e2e values and flake fixes) builds on #600. It applies the e2e lines above.

https://github.com/daniro-san/LAPTracker/pull/605
