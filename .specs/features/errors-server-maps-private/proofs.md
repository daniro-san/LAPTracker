# errors-server-maps-private proofs

**HEAD**: a52c7640
**Tree**: clean
**Shell**: /bin/sh
**Result**: 18 pass, 0 fail

| Check | Proof                                                                                                            | Result |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| C1    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "uploads the server's maps after the browser's"`             | pass   |
| C2    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "without the personal key"`                                  | pass   |
| C3    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "deletes the maps even when the upload fails/times out"`     | pass   |
| C4    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "never ships a chunk the CLI was stopped while rewriting"`   | pass   |
| C5    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "gives the CLI only PATH, HOME/hands it to the CLI's enviro` | pass   |
| C6    | `pnpm exec vitest run lib/analytics/server.test.ts -t "a frame in a chunk the build injected"`                   | pass   |
| C12   | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "skips the upload but not the build"`                        | pass   |
| C7    | `pnpm exec vitest run lib/private/read-status.test.ts -t "reports the failure to error tracking"`                | pass   |
| C8    | `pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a failed save to error tracking"`      | pass   |
| C9    | `pnpm typecheck && pnpm lint`                                                                                    | pass   |
| C13   | `pnpm exec vitest run lib/private/pending-members.test.ts -t "shows the pending members as they are when the ma` | pass   |
| C14   | `pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a picture claim that cannot be let go` | pass   |
| C15   | `pnpm exec vitest run "app/(private)/api/w/[slug]/discord/route.test.ts" -t "reports a saved webhook that no lo` | pass   |
| C16   | `pnpm exec vitest run lib/private/invite.test.ts -t "still makes the Desk when the commands' registration throw` | pass   |
| C10   | `! grep -l "report(" lib/private/time-zones.ts lib/private/sign-in.ts lib/private/member-facts.ts lib/private/d` | pass   |
| C11   | `pnpm exec vitest run lib/analytics/posthog.test.ts -t "has the SDK mask a member's uid"`                        | pass   |
| Build | `pnpm typecheck`                                                                                                 | pass   |
| Build | `pnpm lint`                                                                                                      | pass   |

## Output

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "uploads the server's maps after the browser's"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
   Start at  00:21:04
   Duration  272ms (import 36%, tests 36%, worker 15%, transform 12%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "without the personal key"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
   Start at  00:21:05
   Duration  248ms (import 43%, tests 31%, worker 13%, transform 12%, environment 1%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "deletes the maps even when the upload fails/times out"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  2 passed | 5 skipped (7)
   Start at  00:21:05
   Duration  247ms (tests 49%, import 32%, worker 10%, transform 9%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "never ships a chunk the CLI was stopped while rewriting"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
   Start at  00:21:06
   Duration  268ms (import 39%, tests 36%, worker 12%, transform 12%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "gives the CLI only PATH, HOME/hands it to the CLI's enviro` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  2 passed | 5 skipped (7)
   Start at  00:21:06
   Duration  293ms (tests 47%, import 32%, worker 12%, transform 8%)
```

`pnpm exec vitest run lib/analytics/server.test.ts -t "a frame in a chunk the build injected"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)
   Start at  00:21:07
   Duration  303ms (import 69%, transform 14%, tests 12%, worker 4%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "skips the upload but not the build"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
   Start at  00:21:07
   Duration  271ms (import 42%, tests 31%, worker 15%, transform 12%, environment 1%)
```

`pnpm exec vitest run lib/private/read-status.test.ts -t "reports the failure to error tracking"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 12 skipped (13)
   Start at  00:21:08
   Duration  924ms (import 46%, tests 39%, transform 15%)
```

`pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a failed save to error tracking"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 11 skipped (12)
   Start at  00:21:09
   Duration  914ms (import 43%, tests 42%, transform 15%)
```

`pnpm typecheck && pnpm lint` - exit 0

```
$ tsc --noEmit
$ eslint .
```

`pnpm exec vitest run lib/private/pending-members.test.ts -t "shows the pending members as they are when the ma` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 7 skipped (8)
   Start at  00:21:16
   Duration  791ms (tests 51%, import 41%, transform 7%)
```

`pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a picture claim that cannot be let go` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 11 skipped (12)
   Start at  00:21:17
   Duration  842ms (import 44%, tests 43%, transform 12%)
```

`pnpm exec vitest run "app/(private)/api/w/[slug]/discord/route.test.ts" -t "reports a saved webhook that no lo` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 9 skipped (10)
   Start at  00:21:18
   Duration  868ms (tests 45%, import 44%, transform 11%)
```

`pnpm exec vitest run lib/private/invite.test.ts -t "still makes the Desk when the commands' registration throw` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 11 skipped (12)
   Start at  00:21:19
   Duration  773ms (tests 46%, import 45%, transform 8%)
```

`! grep -l "report(" lib/private/time-zones.ts lib/private/sign-in.ts lib/private/member-facts.ts lib/private/d` - exit 0

```
(no output)
```

`pnpm exec vitest run lib/analytics/posthog.test.ts -t "has the SDK mask a member's uid"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 6 skipped (7)
   Start at  00:21:20
   Duration  272ms (tests 58%, import 25%, transform 9%, worker 7%)
```
