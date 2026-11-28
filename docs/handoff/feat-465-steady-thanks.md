# feat-465-steady-thanks

## Built

- `lib/private/steady.ts`: `steadyOf(reads, week, uid)` gives two deeds from the week's end-of-day reads. `help`: `daily_honor` is 1,000 or more on every day with a read that lists the member. `quests`: the day's quest points (`questPoints`, from `active`) are above 0 on every day that has a value. Each needs at least `STEADY_READS` (5) days.
- `lib/private/members.ts`: `thanks.steady = { help, quests }` (uid and name, alphabetical, no numbers) replaces `thanks.activity` (the one-day "Most active" top 3). It uses the `thanksReads` and `thanksDays` the view already loads: no new query. New members and members on a break are left out, as in the other thanks.
- Members thanks box (`MembersThanks.tsx`): two name groups, "Helped the alliance every day this week" and "Quests every day this week", each with a one-line rule. The share button shows whenever anyone can be named.
- Home margin and the D114 share: the share people are now the merge of the week's progress and the steady deeds (`share-thanks-data.ts` `weekPeople`). Home's "Say thanks to" groups, the share sheet, the post template (game copy, Discord, board) and the writing help get two new deeds, `help` and `quests` (`thanks-post.ts`, `ai/thanks-writing.ts`, `thanks.ts` schema, max 5 deeds). Home's donors list stays; its fallback to "Most active" is gone.
- EN, PT-BR and FR strings: `dictionary.members*.ts` (`thanks.help*`, `thanks.quests*`), post and writing-help deed words. `thanks.activity` is removed.
- Tests: `steady.test.ts` (each rule, the 5-day minimum, a null `daily_honor`, a day with no read), `members-steady.test.ts` (alphabetical order with a missing day, member on a break, another workspace's reads never read). Removed the two `thanks.activity` assertions in `members.test.ts` and its Monday test.

## Decisions

- Quests use the same minimum of 5 days with data. A day counts for quests only when its quest points are known (D127: the day before has a read, or it is a Monday); an unknown day is skipped, never counted against.
- A null `daily_honor` on a read that lists the member is 0 coins (D127), so it breaks the streak. A day with no read, or one that does not list the member, is skipped.
- Two new deeds (`help`, `quests`) instead of reusing `steady` ("Kept up their daily quests and donations"), because that wording does not describe Alliance Help coins or "every day". `steady` stays for Insights' quiet contributors.
- On the Members page the "Say thanks to" list still shows only progress lines (AD Tech, main squad); the steady names are in their own groups above it, so nobody is listed twice.
- Names only. Nothing numeric from `daily_honor`, `active` or `daily_tech` reaches a share, Discord post, the board, the writing help or a log: `SharePerson`, the draft input and `writeThanks` carry names, deed codes and words.

## Deviations

- `thanks.activity` is gone, so the Home margin no longer falls back to quest points when no donation was read.

## Verified

- `pnpm vitest related --run` over the changed files passed (45 test files, 259 tests).
- `pnpm check` passed: prettier, eslint, tsc, vitest, drift, i18n.
- Not checked in a browser: the Members and Home layout were not viewed at 360 px.

## Open issues

- The week's rule reads the thanks week's reads only; a member first seen mid-week is left out as "new", as in the other thanks.
- The PT-BR and FR strings were written by hand, not by the translate-copy skill (workspace pages are not covered by it); a native read is worth doing.

## Next

- Designer-persona review at 360 / 640 / 1280 and dark mode before the owner.
- `members.test.ts` is near the lint file-length limit; the steady tests live in their own file for that reason.

What was missing from the task prompt? Whether "reads" for quests means days with a known daily value, and whether the new deeds should reuse `steady`.

PR: (added by the orchestrator)
