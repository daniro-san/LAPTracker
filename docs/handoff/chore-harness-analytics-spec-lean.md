# chore: harness — analytics plan on every change, when to run /tlc-spec-lean, tests check real behaviour

## Built

- **CONTRIBUTING.md § Working rules**, three new bullets:
  - "When to run `/tlc-spec-lean`":
    - sizes: M has six objective triggers; L needs more than one PR, as judged when planning, or adds a new top-level desk tab or public page family; L wins over M.
    - chat requests follow the same rule: the orchestrator or build agent sizes them and records the size in the PR.
    - one bug-fix rule: a fix that restores intended behaviour is S unless it has an M trigger, most often a migration or a new decision.
    - "Not sized (n/a)": docs, harness, copy-only, dependency bumps. An M trigger or a one-way door always wins over that list and over the bug-fix rule.
    - plan review: the product-strategy persona and an adversarial reviewer. The owner's standing approval is recorded once, verbatim (owner, 2026-11-21: "go with what you and the personas recommend"), with the exact `**Approved**` line to write. A one-way door or the `decision` label needs the owner's own reply on that plan.
  - "Analytics plan, every change": add / change / remove / PostHog side, with the D145 Endpoints `lap_board_reach` and `lap_alliance_usage` named and PostHog-side changes going to `ownerTodo` in `lib/patch-notes.ts`.
  - "Tests check real behaviour (owner, 2026-11-21)": the one place for what a test must protect and for the fake-test list. A fast-check property test of a pure invariant is allowed. It points to CLAUDE.md for when tests are added and to `.claude/rules/tests.md` for naming, fixtures, time and mocks.
- **CONTRIBUTING.md § Issues and pull requests** (line 58): the same bug-fix rule as § Working rules, and a pointer to the sizes.
- **.claude/rules/tests.md**:
  - its first bullet (added by the orchestrator) now points to CONTRIBUTING for the fake-test list instead of repeating it;
  - new rule "End-to-end tests check what the user sees (owner, 2026-11-21)": heading, seeded values as the page formats them, no error or empty state; the screen after each action and after a reload; status checks only as extra guards; no pixel snapshots;
  - `paths:` now also matches `e2e/**/*.ts`, so the rule loads for e2e specs. No `e2e/` folder exists yet on this branch or on dev.
- **CONTRIBUTING.md § Working rules**, test bullet: one line for e2e tests that points to `.claude/rules/tests.md`. There is no "End-to-end tests" paragraph on dev yet.
- **.github/pull_request_template.md**: an "Analytics plan" section (Added / Changed / Removed, or "No change" and why). A "Size" gate: S / M / L, or n/a (docs, harness, copy-only, dependency bump); M and L link the spec-lean plan and both verdicts.
- **.github/ISSUE_TEMPLATE/feature.yml, improvement.yml**: an optional field "What will we want to measure after release?". Each size option has one line of definition, matching CONTRIBUTING.
- **.github/ISSUE_TEMPLATE/bug.yml**: S (restores intended behaviour) and M (has an M trigger, most often a migration or a new decision). L was dropped, matching CONTRIBUTING's bug-fix rule.
- **docs/DESIGN.md § Validation**: "Measure before building", for M and L work and for S work that adds a desk feature or action.
- **REVIEW.md** has four new items:
  - a PR sized S or n/a has no M trigger in its diff;
  - the PR's Analytics plan section matches the diff;
  - new or changed tests protect a named behaviour and are not on CONTRIBUTING's fake-test list;
  - the section heading now says "analytics".
- **docs/analytics/tracking-plan.md**: the intro names the new two-way check, against the code's event lists. "## Changed in D115" became "## Changed", with one line saying entries are dated, newest last.
- **lib/analytics/events.test.ts**: new test "names in its Event columns no event that is gone from the code's event lists".
  - It reads every plan table with an `Event` header column and collects the backticked names in that column, by section heading.
  - It requires one known event in each of the five sections that hold such a table.
  - It fails on any name that is not in `ANALYTICS_EVENTS`, the server events or posthog-js's own `$pageview`, `$opt_in` and `$cookieless_mode`.
  - The server event list is now one `SERVER_EVENTS` constant, shared with the existing one-way test. tsc checks that it equals `keyof ServerEvents`.

## Decisions

- Event names come only from the `Event` column of the plan's tables, not from prose or the insight bullets. Prose also puts properties and features in backticks, so a whole-page scan would need a word filter.
- The test checks the code's event lists, not the call sites. The docs say "event lists" to match. Checking call sites would mean scanning source for string literals.
- The bug form keeps only S and M. A bug fix that needs more than one PR is rare, and CONTRIBUTING's bug-fix rule names only M.
- The "Changed" heading was renamed so the rule "a dated line in the plan's Changed section" points at a section that exists by that name.
- The PR template gained a Size gate. Without it, the rule "records the size in the PR" had no place in the PR.

## Deviations

- The coordinator added the "Tests check real behaviour" item during the session (owner, 2026-11-21), and later the line in `.claude/rules/tests.md`. The coordinator added the end-to-end rule (owner, 2026-11-21) in the review round.
- The `/pr-review` round on PR 601 added: the recorded standing approval and its `**Approved**` line, one bug-fix rule, the precedence of M triggers and one-way doors, an objective L, n/a sizing, a scoped "Measure before building", one fake-test list, an S-sizing review item, and a per-section guard in the test.

## Verified

- `pnpm check`: exit 0. Prettier, ESLint and tsc are clean. Vitest: 297 files passed and 2 skipped, 1535 tests passed and 4 skipped. Drift and i18n checks pass.
- Negative checks on the new test, each reverted afterwards:
  - adding `ws_gone` to the `ws_text_read` row failed with `expected [ 'ws_gone' ] to deeply equal []`;
  - renaming "## Members' board" failed the per-section guard for that heading.
- The standing-approval `**Approved**` line was checked against the skill's scripts on a throwaway feature in the scratchpad, built from the skill's own fixtures and deleted afterwards:
  - with the line: `validate_plan.py` exit 0, `validate_checks.py` exit 0;
  - without any Approved line, `validate_checks.py` exit 1: "plan.md has no `**Approved**` … line";
  - `validate_verification.py` uses the same `plan_approved` regex (`lean_config.py`).
- Stale plan rows: none. Every name in the plan's Event columns exists in the code's event lists today, so no rows were removed.
- Self-review for contradictions across CLAUDE.md, CONTRIBUTING, REVIEW, DESIGN, tests.md, the forms and the PR template: none left after the fixes above.
- Not verified: how the forms render on GitHub. They render only from `main`, so they show after the next release.

## Open issues

- The issue form and PR template changes show on GitHub only after a release reaches `main`.
- The new test cannot tell whether an event in `ServerEvents` or `ANALYTICS_EVENTS` is still sent somewhere. It checks the lists, not the call sites.
- No existing tests were reviewed for fake tests, as asked. None were noticed in `lib/analytics/events.test.ts`.

What was missing from the task prompt? The exact text of the owner's standing approval, which the skill's `**Approved**` line needs, and whether a bug fix can be L.

## Next

- Follow-up: once a few M plans have used the standing-approval line, check that `.specs/` plans carry it with both verdict links.
- Follow-up: re-check the size definitions after the first L plan, because "more than one PR, as judged when planning" is a judgment call.
- No other follow-ups.

https://github.com/daniro-san/LAPTracker/pull/601
