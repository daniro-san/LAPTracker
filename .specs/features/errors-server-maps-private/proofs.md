# errors-server-maps-private proofs

**HEAD**: 028e84cc
**Tree**: clean
**Shell**: /bin/sh
**Result**: 13 pass, 0 fail

| Check | Proof                                                                                                            | Result |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| C1    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "uploads the server's maps after the browser's"`             | pass   |
| C2    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "without the personal key"`                                  | pass   |
| C3    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "deletes the maps even when the upload fails/times out"`     | pass   |
| C4    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "never ships a chunk the CLI was stopped while rewriting"`   | pass   |
| C5    | `pnpm exec vitest run scripts/sourcemaps.test.ts -t "gives the CLI only PATH, HOME/hands it to the CLI's enviro` | pass   |
| C6    | `pnpm exec vitest run lib/analytics/server.test.ts -t "a frame in a chunk the build injected"`                   | pass   |
| C7    | `pnpm exec vitest run lib/private/read-status.test.ts -t "reports the failure to error tracking"`                | pass   |
| C8    | `pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a failed save to error tracking"`      | pass   |
| C9    | `pnpm typecheck && pnpm lint`                                                                                    | pass   |
| C10   | `! grep -l "report(" lib/private/time-zones.ts lib/private/sign-in.ts lib/private/member-facts.ts lib/private/d` | pass   |
| C11   | `pnpm exec vitest run lib/analytics/posthog.test.ts -t "has the SDK mask a member's uid"`                        | pass   |
| Build | `pnpm typecheck`                                                                                                 | pass   |
| Build | `pnpm lint`                                                                                                      | pass   |

## Output

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "uploads the server's maps after the browser's"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 5 skipped (6)
   Start at  23:55:50
   Duration  240ms (import 35%, tests 35%, transform 18%, worker 12%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "without the personal key"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 5 skipped (6)
   Start at  23:55:50
   Duration  291ms (import 42%, tests 31%, worker 14%, transform 13%, environment 1%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "deletes the maps even when the upload fails/times out"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  2 passed | 4 skipped (6)
   Start at  23:55:51
   Duration  241ms (tests 50%, import 31%, worker 10%, transform 9%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "never ships a chunk the CLI was stopped while rewriting"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 5 skipped (6)
   Start at  23:55:51
   Duration  261ms (import 38%, tests 38%, worker 13%, transform 11%)
```

`pnpm exec vitest run scripts/sourcemaps.test.ts -t "gives the CLI only PATH, HOME/hands it to the CLI's enviro` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  2 passed | 4 skipped (6)
   Start at  23:55:52
   Duration  267ms (tests 51%, import 30%, worker 10%, transform 9%)
```

`pnpm exec vitest run lib/analytics/server.test.ts -t "a frame in a chunk the build injected"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 4 skipped (5)
   Start at  23:55:52
   Duration  279ms (import 66%, transform 16%, tests 13%, worker 5%)
```

`pnpm exec vitest run lib/private/read-status.test.ts -t "reports the failure to error tracking"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 12 skipped (13)
   Start at  23:55:53
   Duration  768ms (import 47%, tests 41%, transform 12%)
```

`pnpm exec vitest run lib/private/discord-interaction.test.ts -t "reports a failed save to error tracking"` - exit 0

```
RUN  v5.1.0 /Users/danilordasilva/workspace/random/LAPTracker/.claude/worktrees/agent-aa92ba1cd13ae8d18


 Test Files  1 passed (1)
      Tests  1 passed | 10 skipped (11)
   Start at  23:55:54
   Duration  863ms (tests 44%, import 43%, transform 12%)
```

`pnpm typecheck && pnpm lint` - exit 0

```
$ tsc --noEmit
$ eslint .
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
   Start at  23:56:00
   Duration  268ms (tests 52%, import 28%, transform 11%, worker 9%)
```
