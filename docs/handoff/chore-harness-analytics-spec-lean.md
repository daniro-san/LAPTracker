# chore: harness — analytics plan on every change, when to run /tlc-spec-lean, tests check real behaviour

## Built

- **CONTRIBUTING.md § Working rules**, three new bullets:
  - "When to run `/tlc-spec-lean`": objective S/M/L, the same rule for chat requests (sized by the orchestrator or build agent, size recorded in the PR), plan review by the product-strategy persona and an adversarial reviewer, the owner only for a one-way door or the `decision` label, and what the skill is not for.
  - "Analytics plan, every change": add / change / remove / PostHog side, with the D145 Endpoints `lap_board_reach` and `lap_alliance_usage` named and PostHog-side changes going to `ownerTodo` in `lib/patch-notes.ts`.
  - "Tests check real behaviour (owner, 2026-11-21)": behaviour names, realistic inputs, the list of fake tests, guard tests for a named rule, and updating a test when behaviour changes on purpose. It points to CLAUDE.md for when tests are added and to `.claude/rules/tests.md` for how to write them, without repeating either.
- **CONTRIBUTING.md § Issues and pull requests** (line 58): now says "Size S, and a bug fix that restores intended behaviour: the form is the spec; M or L: `/tlc-spec-lean` first", and points to the sizes in § Working rules.
- **.github/pull_request_template.md**: an "Analytics plan" section (Added / Changed / Removed, or "No change" and why), and a "Size" gate that asks for the spec-lean plan and both verdicts for M and L.
- **.github/ISSUE_TEMPLATE/feature.yml, improvement.yml**: an optional field "What will we want to measure after release?". The size options now carry one line of definition each.
- **.github/ISSUE_TEMPLATE/bug.yml**: the size options carry one line each (S restores intended behaviour; M and L only when the fix needs a migration, a decision, a new feature area or more than one PR).
- **docs/DESIGN.md § Validation**: "Measure before building": the product-strategy persona reviews the measure field before building, or proposes the events when the field is empty.
- **REVIEW.md**: one item that the PR's Analytics plan section matches the diff, and one item that new or changed tests protect a named behaviour (with the fake-test list). The section heading now says "analytics".
- **docs/analytics/tracking-plan.md**: the intro names the new two-way check. "## Changed in D115" became "## Changed", with one line saying entries are dated, newest last.
- **lib/analytics/events.test.ts**: new test "names in its Event columns no event the code no longer sends". It reads every plan table that has an `Event` header column and collects the backticked names in that column. It fails on any name that is not in `ANALYTICS_EVENTS`, the server events or posthog-js's own `$pageview`, `$opt_in` and `$cookieless_mode`. The server event list is now one `SERVER_EVENTS` constant, shared with the existing one-way test, and tsc checks that it equals `keyof ServerEvents`.

## Decisions

- Event names are taken only from the `Event` column of the plan's tables, not from prose or the insight bullets. Prose also mentions properties and features in backticks, so a whole-page scan would need a word filter.
- `$`-prefixed names are checked too. posthog-js's own three are allowed by name, so removing `$exception` or `$ai_generation` from `ServerEvents` fails tsc through the `SERVER_EVENTS` type check.
- The "Changed" heading was renamed so the new rule ("a dated line in the plan's Changed section") points at a section that exists by that name.
- The PR template gained a Size gate. Without it, the rule "records the size in the PR" had no place in the PR.

## Deviations

- The coordinator added the "Tests check real behaviour" item during the session (owner, 2026-11-21). It is in this PR.

## Verified

- `pnpm check`: exit 0. Prettier, ESLint and tsc are clean. Vitest: 297 files passed and 2 skipped, 1535 tests passed and 4 skipped. Drift and i18n checks pass.
- Negative check: adding `ws_gone` to the `ws_text_read` row made the new test fail with `expected [ 'ws_gone' ] to deeply equal []`. The row was then restored.
- Stale plan rows: none. Every name in the plan's Event columns exists in the code today, so no rows were removed.
- Self-review for contradictions across CLAUDE.md, CONTRIBUTING, REVIEW, DESIGN, the forms and the PR template:
  - "product persona" was changed to "product-strategy persona", which is DESIGN.md's term.
  - The Remove bullet now says "Event column", matching what the test checks.
  - No other conflicts found. "Not for: dependency bumps" and "a new dependency is a one-way door" are different cases.
- Not verified: how the forms render on GitHub. They render only from `main`, so they show after the next release.

## Open issues

- The issue form and PR template changes show on GitHub only after a release reaches `main`.
- The new test cannot tell whether `discord_command_used` or `ws_action` is still sent at run time. It checks the `ServerEvents` type, not the call sites.
- No existing tests were reviewed for fake tests, as asked. None were noticed in `lib/analytics/events.test.ts`.

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- From now on every PR fills "Analytics plan" (added / changed / removed, or "No change" and why) and the "Size" gate. M and L PRs carry the spec-lean plan with the product-strategy persona's and adversarial reviewer's verdicts.
- A PR that drops an event must drop its rows in the plan's Event columns too, or `pnpm check` fails.
- Plan entries that change what a number means go under `## Changed` in docs/analytics/tracking-plan.md, dated.
</adjustments>

PR: (added by the orchestrator)
