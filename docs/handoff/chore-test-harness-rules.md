# chore: harness — which test, time, mocks and e2e specifics (test audit, batch 3)

## Built

- **.claude/rules/tests.md**:
  - seven sub-bullets under the existing end-to-end rule:
    - expected values come from the exports of `e2e/fixtures/seed.ts` (D150);
    - dates come from the seed's clock (`seededAt()`, `calendarOf(seededAt())`), never a bare `Date.now()` or `new Date()`; a request value the test never asserts on (the `before=` cursor of a denied `/activity` call) may use `Date.now()`; `page.clock` moves the page's time;
    - a sweep first asserts it got the real page;
    - locators by role and name, scoped to a row or card; no `.first()` over a list whose order the app computes (by date, weekday or activity); the row is selected by its name or title;
    - no `waitForTimeout`;
    - writes use rows no other test reads, or run on one project;
    - a test that ends a session or changes a workspace switch uses its own session or workspace.
  - `## Which test`: a table that maps each layer to a kind of test (unit, PGlite, PGlite plus a real `Request` with `getAppContext` returning `testContext(db).ctx`, Playwright).
  - `## Time (Vitest)`: the old "Pass time in (`now`)… No sleeps." bullet moved here and was extended:
    - the test clock (`T0`, `clock.now`), never `new Date()` or `Date.now()`;
    - one fixed UTC instant with the server time in a comment;
    - the real times the code uses;
    - `vi.useFakeTimers({ now })`, and `vi.waitFor` instead of `setTimeout`.
    - A line says e2e tests follow the seed-clock rule instead.
  - `## Mocks and assertions`:
    - mock only what leaves the process (`fetch`, `tesseract.js`, PostHog's browser modules) and the runtime seams (`getAppContext`, `@/lib/env`, `@/lib/flags`, the Next.js modules Vitest lacks);
    - `noQueryDb`;
    - never mock `lib/queries` or `lib/repo` away;
    - no asserts on constant values;
    - counts only as scan guards;
    - a positive control for privacy detectors;
    - new `/api/w/[slug]` routes go into `FIXTURES` in `member-session.test.ts`; `EXCLUDED` only with a reason next to the entry (a decision, or the route's own auth).
  - `paths:` already matched `e2e/**/*.ts`, so it was not changed.
- **REVIEW.md § Tests**:
  - the first item now names "a privacy detector or scan with no positive control" (this merges the proposal's fourth item);
  - three new items:
    - e2e asserts rendered values from `e2e/fixtures/seed.ts` and the changed screen (and the screen after a reload where the flow promises persistence);
    - Vitest: no wall clock or real `setTimeout`, PGlite opened once per file; e2e: no `waitForTimeout`, dates from `seededAt()` / `calendarOf`;
    - a new `/api/w/[slug]` route passes the walker with a `FIXTURES` entry; an `EXCLUDED` entry needs its reason next to it.
- **CONTRIBUTING.md § Working rules, "Tests check real behaviour"**:
  - the pointer sentence now says tests.md also covers "which kind of test fits which code";
  - one sub-bullet, "Recommended, pending the owner's confirmation (2026-11-21)": a PR whose task changes a desk flow or a public page's numbers updates that flow's e2e assertion in the same PR, as with any test the change breaks, and adds no tests beyond what CLAUDE.md allows.

## Decisions

- Every name was checked against the code at 841df240:
  - `openTestDb`, `truncateAll` and `noQueryDb` are in `lib/db.test-helpers.ts`;
  - `testContext` is in `lib/app-context.test-helpers.ts`, and route tests use its `.ctx`;
  - `T0` and `clock.now` are in `lib/collector.test-helpers.ts`;
  - `FIXTURES` and `EXCLUDED` are in `app/(private)/api/w/[slug]/member-session.test.ts`;
  - `seededAt` and `calendarOf` are in `e2e/fixtures/seed.ts`, and `page.clock` is used in `e2e/desk.spec.ts`.
- Times were checked against the code:
  - the test server zone is `Etc/GMT+2` (UTC−2), so `2026-11-21T01:31:00Z` is Friday 23:31 ST;
  - the Friday shield read starts at 23:30 ST (`NIGHT_MINUTE`), the morning read at 10:00–11:00 ST, and KvK at 12:00 ST;
  - the daily read is at 23:30 (`DAILY_ROSTER_AT`).
- The mock allow-list is the boundary the suite already follows. A grep of `vi.mock` targets gives `@/lib/app-context` 53, `next/server` 9, `next/navigation` 7, `next/cache` 5, `@/lib/env` 3, `next/headers` 2, `tesseract.js` 2, `@/lib/flags` 1, and three `posthog-js` modules 1 each. The rest are listed under Open issues.
- "Never mock `lib/queries` or `lib/repo`" allows wrapping the real function. `app/api/snapshot/route.test.ts` wraps the real `insertRunLog` to delay it, and `lib/samples.test.ts` spies on the real `dueSample`; neither replaces the real code.
- The three `Date.now()` uses in `e2e/isolation.spec.ts` (lines 97, 154, 209) are the `before=` cursor of `/activity` calls that must be denied. The test never asserts on that value, so the rule allows it and they are not violations. `e2e/global-setup.ts:25` (`new Date()`) is where the seed's clock starts (`E2E_NOW`), so it is not a test body.
- `EXCLUDED` follows what the walker does today. `login` is excluded because of the route's own auth (every sign-in starts there with no session), `logout` and `me` because of D105 and D142. Each reason is written in the comment above the set.

## Deviations

- The first version said "the seed module's exports" because #600 was not on dev yet. After the coordinator rebased onto dev with #600 merged, the e2e lines name `e2e/fixtures/seed.ts`, `seededAt()`, `calendarOf` and D150.
- Dropped from the proposal:
  - the naming line (`(D137)` in test names, and the e2e `test("<Screen>: …")` shape): the task did not list it;
  - "15-minute samples", "the 23:52 retry" and "the Sunday/Monday thanks" from the time shapes: the task's list does not include them;
  - `proxy.ts` headers in the Playwright row: the audit's own batch 1 also adds a Vitest `proxy.test.ts`, so tying them to Playwright alone would contradict it;
  - "Don't assert that a mock received what the test gave it": it is already on CONTRIBUTING's fake-test list;
  - "puts the row back with an on-screen check" in the e2e write rule: the task did not list it;
  - the quota-route walker in the REVIEW item: no such walker exists on dev (audit batch 2 adds `app/api/quota-gate.test.ts`);
  - the proposal's CONTRIBUTING e2e sub-bullet: PR #601 already added an equivalent line.
- REVIEW's separate "privacy detector has a positive control" item was merged into the existing first item instead of being added a second time.
- Review round on PR 605 (/pr-review, "Approve with comments"). Changes:
  - `testContext(db).ctx` in the table;
  - the mock allow-list now covers the runtime seams;
  - § Time is scoped to Vitest, with an e2e seed-clock line;
  - the `EXCLUDED` rule matches the walker;
  - the e2e helpers are named;
  - the `.first()` rule is objective;
  - the CONTRIBUTING line is reworded so it does not conflict with CLAUDE.md owning when tests are added;
  - REVIEW is aligned with all of the above.

## Verified

- `pnpm check`: exit 0. Prettier, ESLint and tsc are clean. Vitest: 297 files passed and 2 skipped, 1552 tests passed and 4 skipped. Drift and i18n checks pass.
- Self-review for contradictions across CLAUDE.md, CONTRIBUTING, REVIEW, `.claude/rules/tests.md` and docs/DESIGN.md:
  - the REVIEW e2e item now asks for a reload only where the flow promises persistence, as tests.md does;
  - REVIEW's time item now uses the same Vitest / e2e split as tests.md;
  - the CONTRIBUTING e2e line now applies only to a task that already changes the flow, so it does not conflict with CLAUDE.md;
  - DESIGN.md has no rules on how to test beyond the colour-literal grep.

## Open issues

- The CONTRIBUTING e2e "same PR" line is a recommendation until the owner confirms it.
- Existing tests that break the new rules are not changed here (follow-ups, audit batch 5):
  - wall clock in a Vitest test body (14):
    - `lib/flags.test.ts:45`, `:66` (`Date.now()` under fake timers);
    - `lib/web-push.test.ts:96`;
    - `lib/collector.test.ts:288`, `:308`;
    - `lib/collector-sample.test.ts:50`;
    - `app/(pages)/admin/gate.test.ts:98`;
    - `app/(private)/api/w/[slug]/cross-workspace.test.ts:78`;
    - `app/(private)/_ui/screenshot-upload.test.ts:17`;
    - `app/(private)/w/[slug]/turned-off.test.ts:80`;
    - `app/api/admin/invites/route.test.ts:65`, `:93`, `:95`;
    - `scripts/seed.test.ts:33`.
  - the e2e `Date.now()` uses in `e2e/isolation.spec.ts:97,154,209` are allowed by the rule (see Decisions), so they are not on this list.
  - PGlite opened inside an `it`: `lib/queries/roster-stays.test.ts:25`.
  - real `setTimeout` (6):
    - `lib/lookup.test.ts:109`;
    - `lib/private/desk-action.test.ts:30`;
    - `lib/analytics/posthog.test.ts:57`;
    - `app/(private)/api/w/[slug]/cross-workspace.test.ts:171`, `:218`, `:236`.
  - `lib/queries` mocked away: `lib/run-notify-turnout.test.ts:9` (`./queries`).
  - other mocks outside the allow-list, to review in the same batch:
    - `./event-image` / `@/lib/event-image` in `lib/samples.test.ts`, `lib/samples-hardening.test.ts`, `lib/run-notify-turnout.test.ts` and `app/_ui/event-page.test.ts`;
    - `@/lib/private/import-read` in `shots/read/route.test.ts` and `share/route.test.ts`;
    - `@/lib/collector` in `app/api/snapshot/route.test.ts`;
    - `./locale` in `app/_ui/AcrossEvents.test.ts`;
    - `react` in `app/_ui/admin/useRunWatch.test.ts`.

What was missing from the task prompt? Whether runtime seams such as `@/lib/env`, `@/lib/flags` and `getAppContext` count as allowed mocks, and that the time rules had to be split between Vitest and the e2e seed clock.

## Next

- Audit batch 4 (e2e values and flake fixes) applies the e2e lines above.
- Audit batch 5 (fake cleanup) takes the list under Open issues.

https://github.com/daniro-san/LAPTracker/pull/605
