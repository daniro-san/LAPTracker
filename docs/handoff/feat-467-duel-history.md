# feat-467-duel-history

## Built

- `lib/private/duel-history.ts`: reads the workspace's saved Alliance Duel week totals (`alliance_duel_points`, `day = 'week'`) for the last 8 game weeks, and works out a member's weeks, the member's average, the alliance's weekly average and "most improved".
- `lib/repo/import.ts`: `duelWeekTotals`, one query filtered by `workspace_id`.
- Member card, Overview tab: "Alliance Duel by week" (`MemberDuelWeeks.tsx`, `member-card-parts.ts` `duelCard`). One HTML bar per week with the date and the number beside it (D68). A week with nothing saved shows the NoData mark and no bar. Under the rows: the member's average and the alliance's weekly average, each with the number of weeks it rests on.
- Members page thanks box: a "Most improved in Alliance Duel" group, names in alphabetical order, no numbers (`MembersThanks.tsx`, `members.ts` `thanks.improved`).
- EN, PT-BR and FR strings in `dictionary.card.ts` and `dictionary.members*.ts`.
- One test file, `lib/private/duel-history.test.ts`, four behaviours plus one empty case: weeks with a "no data" gap, average over data weeks only, alliance average, most improved in alphabetical order, another workspace's rows never read.

## Decisions

- No migration, no new D-number. The work follows D75 and D136 as written.
- Week points are the `week` row of each saved week. A week with only daily rows saved counts as no data for that member.
- Alliance weekly average: the mean, over weeks that have data, of the sum of the current members' week points that week.
- Most improved: a member whose points in the newest saved week are 10 % or more above their own previous saved week (`IMPROVED_BY`). Members on a break are left out (same list as the other thanks). A member missing either week is left out, not counted.
- `thanks.improved` is read only where the week's progress is read (`membersView` called with `history`), so the card route and the list do not pay for the extra query.
- The weeks shown are 8 (`DUEL_WEEKS`), the current game week last. The card's read covers the workspace's rows for those weeks, restricted to the current roster for the alliance average.

## Deviations

- The "most improved" group is on the Members page thanks box only. It is not in Home's thanks, not in the "Share the thanks" sheet and not in the shared post: those take deeds from a fixed list (`squad`, `ad`, `steady`) that feeds the writing help, the post template and its validation, so adding a deed there is a larger change than the issue states.
- `HomeMembers.test.ts` and `CheckInLine.test.ts` literals got `improved: []` because the thanks type gained a field.

## Verified

- `pnpm vitest related --run` over the changed files: 65 files, 388 tests, all passed.
- `pnpm check`: prettier, eslint, tsc, vitest, drift and i18n checks passed. Two lint rules (complexity, function length) made me move the card's duel words into `cardDuelWeeks`.
- Not checked in a browser: the layout (grid of 6.5 rem date, bar, 4.5 rem number) is meant for 360 px but was not viewed.

## Open issues

- The current game week's total is partial while the week is running, so it lowers the member's and the alliance's average until the week closes, and can keep "most improved" empty early in the week. Excluding an unfinished week is a follow-up if the owner wants it.
- A partial picture (top rows only) lowers the alliance total of that week. The average says how many weeks it rests on, not how many members.

## Next

- Add the "most improved" group to Home's thanks and to the share sheet (needs a new deed in `thanks.ts` `draftInput`, `thanks-post.ts` and `ai/thanks-writing`).
- Designer-persona review at 360 / 640 / 1280 and dark mode before the owner (memory: UX review before the owner).
- Decide whether the unfinished current week should count in the averages.

What was missing from the task prompt? Which week row to use when only daily pictures are saved, and what "improved" means in numbers.

PR: (added by the orchestrator)
