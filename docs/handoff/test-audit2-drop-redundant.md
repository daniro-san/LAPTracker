# test/audit2-drop-redundant

Part of #592 (test audit 2, batch 1).

## Built
- Deleted the two source-text guards in `lib/app-errors.test.ts`. The handled-error test ("sends a handled error to PostHog once, with no row and no alert") now sends an error with roster values and checks the PostHog payload against `LEAKS`.
- Deleted three migration replays: the `thefts_kind` test in `lib/private/thefts.test.ts`, `lib/private/member-roles-migration.test.ts`, `lib/repo/workspace-features-migration.test.ts`. Migrations 0027, 0034 and 0057 are on main.
- Deleted "shows only the entries marked for members" in `app/(private)/_ui/BoardSections.test.ts`.
- Deleted `e2e/isolation.spec.ts` "a's member gets signed_out from a's own desk API".
- `MembersList.test.ts` keeps only the tab-off half (D126).
- New `lib/html.test-helpers.ts` with `textOf(html)` (tags to spaces, entities decoded, spaces collapsed). No helper of that name existed.
- `HomeMembers`, `HomeNext`, `FollowUpWeek` and `ComparePulse` tests assert text through `textOf`. Attributes stay only where they are the behaviour (`href`, `id`, `<details open`). The `flex-col` asserts are gone. `ComparePulse` asserts the strip's help sentence and the "A · " label are absent.
- `.claude/rules/tests.md`: rule line for data-migration tests.

## Decisions
- Replacements:
  - source-text guards: the behavioural tests "stores, alerts and sends to PostHog an error with its private roster values replaced (D115, 2026-11-21)" and "keeps a failed query's parameters ... out of the row, the alert and PostHog", and "sends a handled error to PostHog once" (now with the `LEAKS` loop). The `@ts-expect-error` typecheck guard in the same describe stays.
  - `thefts_kind`, member roles, workspace features migrations: no test replaces them. Those migrations have run on production; `openTestDb()` still applies every migration to each PGlite test.
  - BoardSections duplicate: `lib/private/board.test.ts` "shows only what officers marked for members, from today, with nothing about any person" (it adds a leadership entry and asserts it is absent).
  - e2e 401 test: `app/(private)/api/w/[slug]/member-session.test.ts` "refuses no session, a member's and another workspace's alike" (every route under /api/w/[slug] must give 401 signed_out to a member).
- "Narrow BoardSections to a jump only on days with events": I deleted the duplicate only and left the other two tests in the file (viewer's clock, zone offsets). They are not in the audit's delete list.
- The dictionary text of `FollowUpWeek` assertions is still English literals. The dictionary-built expectations are audit PR 3.

## Deviations
- Skipped: `FollowUpWeek.test.ts` duplicate of `desk-flows.spec.ts:107-138`. The audit says delete it after #669.
- Every other item still existed and applied.

## Verified
- Each changed test fails when its rule is broken, one break each, then reverted:
  - app-errors handled and recorded tests: removed `redact` in `appErrorDetail` and `scrubMessage` in `sendException` (3 tests fail). Removing only one of the two does not fail them, as the other still scrubs.
  - MembersList: showed the Follow-up pointer with the tab off (fails).
  - HomeNext: dropped the title from the over line (fails).
  - HomeMembers: shortened the Follow-up count sentence (fails).
  - ComparePulse: drew strips when only one side is off (fails).
  - FollowUpWeek: changed the Monday rule's text (fails).
- `pnpm vitest related --run <changed>`: 8 files, 29 tests pass.
- `pnpm check`: passes. Vitest 1867 passed, 4 skipped (before: 1873 passed). The removed e2e test is not counted.

## Open issues
- None.

## Next
- Audit PR 2 (e2e shared writes), PR 3 (copy from the dictionary with `say`/`textOf`), and `FollowUpWeek` duplicate delete after #669.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
