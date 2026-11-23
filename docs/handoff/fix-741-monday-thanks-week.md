# fix-741-monday-thanks-week

## Built
- `membersView` (lib/private/members.ts) builds both thanks lists from the reads up to the Sunday of the thanks week (`thanksWeek(today)`, D114). On a Monday the newest read is the new week's, so the "donors" list (`weekDonations` over the thanks week) and the "activity" list (`weekQuestPoints`) now show last week's totals. Tuesday to Sunday nothing changes.
- Two tests in lib/private/members.test.ts, one per list: a Monday read shows last week's figures. Without the fix the donors test sees the new week's donations (member 2 first) and the activity test sees the new week's points.

## Decisions
- Filtered the reads by the thanks week's Sunday instead of branching on Monday, so the same code covers every weekday.
- The coordinator asked to fix `thanks.donors` in this PR too; the issue named only activity.
- The member rows' `weekTotal` (Members table, sheet) still use the newest read's week; only the thanks lists changed.

## Deviations
- Donors fix and its test are beyond the issue text, added at the coordinator's request.

## Verified
- `pnpm vitest related --run lib/private/members.ts lib/private/members.test.ts`: 33 files, 170 tests passed.
- `pnpm check`: passed.

## Open issues
- None.

## Next
- None.

What was missing from the task prompt? The donors list had the same bug; the issue named only activity.

PR: (added by the orchestrator)
