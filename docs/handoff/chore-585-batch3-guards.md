# chore/585-batch3-guards: one source for Home's "waiting" count and Follow-up's group rules, a bounded Needs help read, and the missing batch 3 tests (#656)

Part of #656 (batch 3 follow-ups of #585): the "Correctness guards" and "Tests" sections. No behaviour change, no copy change, no UI change.

## Built

- **Home's "waiting in To review" count, counted once.** `WorkspacePage` (`app/(private)/w/[slug]/page.tsx`) adds drafts, notice reviews for this officer and "This is me" links once. The frame's Home tab badge, `ReviewJump` and the "To review" heading all get that number. `Home` takes it through the frame's props, and `ToReview` takes a new `waiting` prop instead of adding the three counts itself.
- **Follow-up's group rules, one source each** (`lib/private/follow-up-rules.ts`):
  - `inKvkGroup` (`kvk && !help`) is used by `groupsOf`, the head's "{n} to offer help after the KvK ↓" (`FollowUpHead`) and Insights' link (`kvkGroupOpen`).
  - `helpStands` (status Needs help, no away note running) is `worklist`'s Needs help rule. Insights' set of members under Needs help now uses it instead of its own `status === "help"` test.
- **The Needs help reads** (`lib/repo/member-follow-ups.ts`, D149):
  - `helpMarkRows` reads only each member's trailing run of Needs help `status` versions: the versions after their newest one that is not Needs help (`is distinct from '"help"'`, so a status cleared to SQL null counts).
  - It reads each member's Follow-up records by id, starting at the first "help" record whose `fact_version` is in the run (review of PR 659). No record before that one can be the mark's. Leaving those records out keeps the ones after it counting as they did: an Undo whose target is older pops nothing in the window, and in the full history it pops a record outside the window. A member with no such record has no records read; the mark then comes from the run's first version, as before.
  - The member card passes the records `followUpsOf` already loaded (`helpMarksOf`'s `loaded`), so it reads one select instead of two.
- **Tests (each one fails when its behaviour is broken; see Verified):**
  - `app/(private)/_ui/ToReview.test.ts`: Home rendered by `WorkspacePage` on PGlite (a draft and a pending claim) says 2 in the tab badge, the jump and the heading.
  - `app/(private)/_ui/follow-up-groups.test.ts`: the head's KvK jump number equals the KvK group's row count; `sharedOf` on a group with a mix of shared and own lines; the shared-lines block inside `ph-no-capture`, with each row's `aria-describedby` naming it (render of `FollowUpList`).
  - `lib/private/follow-up-rules.test.ts`: `kvkOpen` keeps out a member written about earlier in the KvK's week, before the End read, and offers help again on Monday.
  - `lib/private/desk-activity-pages.test.ts`: a roll call two officers finished stays one line at a page's end, each action once after "Show more"; a fold on a server day outside UTC splits at the server's midnight. `recentActivity` (`desk-activity.test-helpers.ts`) takes a `zone` (UTC by default) and the file's `everyPage` a page size. The roll call builders moved to the file's top so the old and new tests share them.
  - `lib/private/follow-up-help.test.ts`, 2 tests:
    - a mark set again after it was cleared is read from its new run only, and an older record's Undo changes nothing;
    - two officers press Needs help at once: the request that started first commits second and reuses the version the other wrote. Its record, stamped before that version, still counts and names its officer (review of PR 659).

## Decisions

- `inKvkGroup` and `helpStands` are small exported rules in `follow-up-rules.ts`, beside `worklist`. Insights has no `MemberRow`, so it can't call `worklist` itself, so it calls the rule `worklist` uses.
- Insights' Needs help set now leaves out a member whose away note runs. Such members are already out of Insights' help list (`awayOf`), so the link's answer is the same.
- The records bound is by id, not by `written_at` (review of PR 659, MUST). Each request stamps its record with its own start time, and `saveOne` reuses a version another officer already wrote when the value matches, so a record can be stamped before the run's first version. The id bound gives the same result as reading every record, and `member_follow_ups_workspace_uid_idx (workspace_id, uid, id)` serves it. The first build bounded by time; the review found the overlap.
- `helpMarkRows` keeps one exported entry with a `records` flag rather than two exported reads, so `lib/private/follow-up.ts` stays at 299 lines (lint limit 300).

## Deviations

- `ToReview.test.ts` now mocks `@/lib/app-context`, `@/lib/env`, `next/server` and `next/headers`, as `turned-off.test.ts` does, to render the page itself. It renders with `react-dom/static` `prerender`, as `admin/gate.test.ts` does, because the frame streams an async part.
- The S3 test uses the Worth a hello group with plain lines. The task named a group with shared and own lines; the existing S3 test already covers a shared reason beside a mark line.

## Verified

- `pnpm vitest related --run` on the 16 changed files: 33 files, 172 tests passed.
- `pnpm check`: green after one fix round. The first run failed lint: `WorkspacePage` was at 82 of 80 lines, and `lib/private/follow-up.ts` at 304 of 300. Fixes: `Home` takes the frame's props by spread, and the repo has one entry point. Final run: 332 files passed and 2 skipped; 1,740 tests passed and 4 skipped; drift fine; i18n 17 languages current.
- After the review fix (id bound): `pnpm vitest related --run` on the two changed files, 26 files and 109 tests passed; `pnpm check` green, 332 files passed and 2 skipped, 1,741 tests passed and 4 skipped.
- **Breaks.** I applied each break to the tree, ran its test file and put the file back. Every one failed:

| Break | Fails |
| --- | --- |
| "To review" heading adds drafts and reviews only | ToReview "is the same on the Home tab, in the jump and …" |
| the jump counts drafts only | same |
| the tab badge counts drafts only | same |
| the head counts every KvK hit (`i.kvk`) | follow-up-groups "counts the head's After KvK jump …" |
| `kvkOpen` without this week's records | follow-up-rules "keeps a member written about earlier in the KvK's week …" |
| a fold's `oldest` not moved to its last officer | desk-activity-pages "keeps a roll call two officers finished …" (and the 50-entry run test) |
| the fold by UTC day | desk-activity-pages "folds a roll call by the server's day …" |
| `sharedOf` with `some` instead of `every` | follow-up-groups "says once only the lines all …" (and the S3 test) |
| the shared block without `ph-no-capture` | follow-up-groups "keeps the group's shared lines out of replay …" |
| a row's `aria-describedby` without the shared id | same |
| the run bound removed (every status version read) | follow-up-help "reads a mark set again after it was cleared …" |
| the records read not bounded by the run's first record | same |
| the records bounded by time (`written_at` ≥ the run's first version) instead of by id | follow-up-help "names the officer whose Needs help started first and was saved second …" (and the cleared-then-set test, which reads no record under the id bound) |
| the run bound with `<>` instead of `is distinct from` | same (a cleared status is SQL null) |
| the card passes no records | follow-up-help "says since when and who added the mark …" |
| Insights' Needs help set left empty | follow-up-kvk "links Insights' help list …" |

## Open issues

- **Pre-existing:** the Home tab badge on every other desk page comes from `toReviewCount` (drafts and notice reviews). It leaves out the "This is me" links (D142) that Home counts. So with a claim pending, the badge reads 1 on Home and 0 on other tabs. Follow-up.
- `helpMarkRows` now runs its two selects one after the other, because the records read needs the run's start: one more round trip on Follow-up while someone is marked Needs help. The card makes one select fewer.
- The id bound's scalar subquery (the first "help" record in the run) walks one member's records through `member_follow_ups_workspace_uid_idx`, since `fact_version` is not in the index. That is per-member growth, the same that D149 accepts for the card's own history.
- From the review of PR 659, left as follow-ups:
  - `helpMarkRows`'s boolean `records` flag and `helpMarksOf`'s optional `loaded` argument serve only the member card;
  - the newest-non-help subquery in the versions read runs once per scanned `status` row.
- `.specs/features/585-one-worklist/plan.md` and `checks.md` still describe `helpMarkRows` as two parallel selects over the whole history. They are the S2 record, so they were left as they are.
- **#656 boxes:**
  - Done: the three "Correctness guards"; Tests S5 and S4; Tests S3's `ph-no-capture`, `aria-describedby` and `sharedOf` parts.
  - Remain: S3's criterion 17 (a save's refresh never closes the help, and the cookie is not written while the first-use cards cover the page). A static Vitest render can't show either one: both need a mounted client and a refresh. The S2 line was already settled by #646 and #647.
  - Not in this task: Product and UX, and Docs.
- **PostHog:** nothing to measure; no behaviour changed.
- **Guide:** no onboarding or settings flow changed.

## Next

- Make the other tabs' badge (`toReviewCount`) count the "This is me" links too, or say why it doesn't (D142).
- S3 criterion 17 as an end-to-end test in `e2e/desk-flows.spec.ts`, with a fixture that leaves `lap_ws_intro` unset for the covered case.
- The rest of #656: Product and UX (batch 4) and Docs.

Analytics plan: none. No behaviour change.

What was missing from the task prompt? That a page render in Vitest needs `prerender` (the frame streams an async part), and that `lib/private/follow-up.ts` and `WorkspacePage` were within a few lines of their lint limits.

PR: https://github.com/daniro-san/LAPTracker/pull/659
