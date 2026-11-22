# 585-settings-admin proofs

**HEAD**: 9551d43d
**Tree**: clean
**Shell**: /bin/sh
**Result**: 42 pass, 0 fail

| Check | Proof                                                                                                            | Result        |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| C1    | `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"`                               | pass          |
| C2    | `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"`                               | pass          |
| C3    | `pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "needs a look"`                                   | pass          |
| C4    | `walk - 585-2b/shots/after/settings--360-light-{en,fr,pt-BR}-fold.png, settings--1280-light-en-fold.png; measur` | pass (Walked) |
| C5    | `pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "only what the officer changed"`                   | pass          |
| C6    | `pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "one request per change"`                          | pass          |
| C7    | `pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "stops at the first refusal"`                      | pass          |
| C8    | `walk - useLeaveWarning(dirty) in SaveRow; reload with a tick pending shows the browser's leave dialog (Playwri` | pass (Walked) |
| C9    | `walk - 585-2b/shots/after/ Raid Shield card before and after a change`                                          | pass (Walked) |
| C10   | `walk - settings--360-light-en-fold.png`                                                                         | pass (Walked) |
| C11   | `pnpm vitest run "app/(private)/_ui/discord-step.test.ts" -t "site's bot is off"`                                | pass          |
| C12   | `pnpm vitest run "app/(private)/_ui/discord-step.test.ts" -t "cannot check"`                                     | pass          |
| C13   | `walk - settings--360-light-en.png, settings--360-dark-en.png`                                                   | pass (Walked) |
| C14   | `walk - computed gap in the after shots' metrics`                                                                | pass (Walked) |
| C15   | `walk - settings-fern--360-light-en.png (no channel set: open) and settings--360-light-en.png (all set: closed)` | pass (Walked) |
| C16   | `pnpm vitest run lib/private/dictionary.test.ts -t "has the same keys"`                                          | pass          |
| C17   | `run admin / ✓ app/_ui/admin/needs-you.test.ts > Needs you (issue 585, F11) > lists what waits on the owner in ` | pass          |
| C18   | `run admin / ✓ app/_ui/admin/needs-you.test.ts > Needs you (issue 585, F11) > lists only what waits, and nothin` | pass          |
| C19   | `run admin / ✓ app/_ui/admin/needs-you.test.ts > Needs you (issue 585, F11) > calls the API calls low only from` | pass          |
| C19   | `run admin / ✓ lib/queries/admin-page.test.ts > morningQuota (issue 585) > is the daily read's first quota chec` | pass          |
| C19   | `run admin / ✓ lib/queries/admin-page.test.ts > morningQuota (issue 585) > gives no number when the day's first` | pass          |
| C19   | `run admin / ✓ lib/queries/admin-page.test.ts > morningQuota (issue 585) > takes no retry's check for the first` | pass          |
| C20   | `run admin / ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin opens with what needs the owner` | pass          |
| C21   | `run admin / ✓ app/_ui/admin/alliances-view.test.ts > setup gaps (issue 585, F12) > counts no member role, and ` | pass          |
| C22   | `run admin / ✓ lib/queries/admin-alliances.test.ts > allianceUsage (issue 485, D144) > gives the member role, t` | pass          |
| C23   | `run admin / ✓ app/_ui/admin/alliances-view.test.ts > byAttention > puts a key that cannot be used first, then ` | pass          |
| C24   | `run admin / ✓ lib/queries/admin-errors.test.ts > /admin/errors (issue 585, F34) > counts the app errors of the` | pass          |
| C24   | `run admin / ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin opens with what needs the owner` | pass          |
| C25   | `run admin / ✓ app/_ui/admin/alliances-view.test.ts > allianceChoices (F13) > keeps a workspace's own alliance ` | pass          |
| C26   | `run admin / ✓ app/_ui/admin/needs-you.test.ts > quotaState (F34) > reads today's reading as ok up to 1,000, ab` | pass          |
| C26   | `run admin / ✓ app/_ui/admin/StatusFacts.test.ts > Status's API calls fact (F34) > says how many are left and t` | pass          |
| C27   | `! grep -n "1,000 API\/of 1,000\/1,000 today\/1,000 plan" lib/copy-admin.ts lib/copy-admin-features.ts lib/copy` | pass          |
| C28   | `run admin / ✓ app/_ui/admin/needs-you.test.ts > tickLate (D45, D141) > calls the scheduler late by the watcher` | pass          |
| C28   | `run admin / ✓ app/_ui/admin/StatusFacts.test.ts > Status's Last tick fact (D45, D141) > says Late when no tick` | pass          |
| C29   | `run admin / ✓ lib/queries/admin-errors.test.ts > /admin/errors (issue 585, F34) > gives each group the workspa` | pass          |
| C29   | `run admin / ✓ lib/queries/admin-errors.test.ts > /admin/errors (issue 585, F34) > takes ?w= only as one worksp` | pass          |
| C29   | `walk - 585-admin/shots/after/admin-errors-w-ogs--360-light-fold.png ("Errors under /w/ogs only.", "Show all er` | pass (Walked) |
| C31   | `run admin / ✓ app/_ui/admin/StatusFacts.test.ts > Needs you (issue 585, F11) > says in one line that nothing n` | pass          |
| C30   | `run admin / ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin's Activity shows each workspace` | pass          |
| C30   | `run admin / ✓ lib/queries/admin-errors.test.ts > countWaitingRequests (issue 585, F11) > counts every request ` | pass          |
| Build | `pnpm typecheck`                                                                                                 | pass          |
| Build | `pnpm lint`                                                                                                      | pass          |

## Output

`Run admin` - exit 0

```
 ✓ lib/queries/admin-alliances.test.ts > allianceUsage (issue 485, D144) > gives the member role, the alliance's first roster that did not fail since the workspace was made, and whether a daily read has finished since (F12) 37ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, locked > /admin shows the PIN card, not the page, and opens no database connection 8ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, locked > /admin/runs shows the PIN card, not the page, and opens no database connection 2ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, locked > /admin/errors shows the PIN card, not the page, and opens no database connection 2ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, locked > /admin/runs/1 shows the PIN card, not the page, and opens no database connection 1ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, locked > /admin/runs/daily/2026-11-12 shows the PIN card, not the page, and opens no database connection 1ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, locked > /admin/runs/<unknown id> does not call notFound 1ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin's Activity shows each workspace's setup steps when PostHog has no totals (F12) 285ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin opens with what needs the owner, before Status, and the nav counts the last day's app errors (issue 585) 58ms
 ✓ app/(pages)/admin/gate.test.ts > /admin pages, unlocked > /admin/runs/<unknown id> still calls notFound 1ms

 Test Files  7 passed (7)
      Tests  38 passed (38)
   Start at  04:45:01
   Duration  1.66s (import 48%, tests 33%, transform 18%)
```

`pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "lists every card"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 1 skipped (2)
   Start at  04:45:03
   Duration  289ms (import 53%, transform 42%, tests 3%, worker 2%)
```

`pnpm vitest run "app/(private)/_ui/settings-index.test.ts" -t "needs a look"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 1 skipped (2)
   Start at  04:45:03
   Duration  317ms (import 54%, transform 40%, tests 3%, worker 2%)
```

`pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "only what the officer changed"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)
   Start at  04:45:04
   Duration  290ms (import 54%, transform 42%, worker 2%, tests 2%)
```

`pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "one request per change"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)
   Start at  04:45:05
   Duration  291ms (import 54%, transform 41%, tests 2%, worker 2%)
```

`pnpm vitest run "app/(private)/_ui/settings-save.test.ts" -t "stops at the first refusal"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)
   Start at  04:45:05
   Duration  312ms (import 53%, transform 41%, tests 3%, worker 2%)
```

`pnpm vitest run "app/(private)/_ui/discord-step.test.ts" -t "site's bot is off"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 1 skipped (2)
   Start at  04:45:05
   Duration  260ms (import 45%, tests 21%, worker 18%, transform 16%, environment 1%)
```

`pnpm vitest run "app/(private)/_ui/discord-step.test.ts" -t "cannot check"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 1 skipped (2)
   Start at  04:45:06
   Duration  238ms (import 47%, tests 18%, worker 18%, transform 16%, environment 1%)
```

`pnpm vitest run lib/private/dictionary.test.ts -t "has the same keys"` - exit 0

```
RUN  v5.1.0 <worktree>


 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
   Start at  04:45:06
   Duration  290ms (import 47%, transform 38%, tests 12%, worker 3%)
```

`! grep -n "1,000 API\/of 1,000\/1,000 today\/1,000 plan" lib/copy-admin.ts lib/copy-admin-features.ts lib/copy` - exit 0

```
(no output)
```
