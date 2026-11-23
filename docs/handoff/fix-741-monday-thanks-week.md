# fix-741-monday-thanks-week

## Built
- `membersView` (lib/private/members.ts) passes `weekQuestPoints` only the reads up to the Sunday of the thanks week (`thanksWeek(today)`, D114). On a Monday the newest read is the new week's, so the thanks "activity" list now shows last week's total. Tuesday to Sunday nothing changes.
- One test in lib/private/members.test.ts: a Monday read shows last week's quest points. It failed before the fix.

## Decisions
- Filtered the reads by the thanks week's Sunday instead of branching on Monday, so the same code covers every weekday.

## Deviations
- None.

## Verified
- `pnpm vitest related --run lib/private/members.ts lib/private/members.test.ts`: 33 files, 169 tests passed.
- `pnpm check`: passed.

## Open issues
- `thanks.donors` still uses `m.weekTotal`, the donations of the newest read's week, so on a Monday it also shows the new week. D114 says the list uses the thanks week. Not in the issue, left as is.

## Next
- Fix `thanks.donors` on a Monday the same way (follow-up issue).

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
