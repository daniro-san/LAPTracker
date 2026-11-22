# 585-one-worklist proofs

**HEAD**: e35b25ee
**Tree**: clean
**Shell**: /bin/sh
**Result**: 16 pass, 0 fail

| Check | Proof                                                                                                            | Result        |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| C1    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C2    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C3    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C4    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C5    | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > says Follow-up's two num` | pass          |
| C6    | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > writes a noted row with ` | pass          |
| C7    | `run unit / ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > gives` | pass          |
| C8    | `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`                                            | pass          |
| C9    | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                    | pass          |
| C10   | `walk - 585-worklist/after2/followup--360-light-en-fold.png, after2/noted-360-light.png, after2/noted-360-dark.` | pass (Walked) |
| C11   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, ` | pass          |
| C12   | `run unit / ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > says ` | pass          |
| C13   | `run unit / ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > keeps the` | pass          |
| C14   | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| Build | `pnpm typecheck`                                                                                                 | pass          |
| Build | `pnpm lint`                                                                                                      | pass          |

## Output

`Run unit` - exit 0

```
 ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > says Follow-up's two numbers in one line for Home and Members, nothing when both are 0 1ms
 ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > writes a noted row with the officer and the day first, and a break with its last day away 0ms
 ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > keeps the Noted card and the Monday rule before the first daily update, so the jump has its card 5ms
 ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > gives Follow-up's numbers, linked to Follow-up, while its tab is on, and Members' own count while it is off 1ms
 ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > says nothing about check-ins on Home before the alliance's first daily update 4ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > lists each member noted since Monday 00:00 ST once, newest first; last Sunday's and an undone note are not 280ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > leaves a member who left the alliance out of the noted and out of both numbers 41ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update 40ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126) 31ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers before the alliance's first daily update 30ms

 Test Files  5 passed (5)
      Tests  21 passed (21)
   Start at  05:30:36
   Duration  1.09s (import 55%, transform 24%, tests 21%)
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [wide] › e2e/desk-flows.spec.ts:75:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (1.1s)
  ✓  2 [phone] › e2e/desk-flows.spec.ts:75:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (1.1s)

  2 passed (9.2s)
$ playwright test e2e/desk-flows.spec.ts -g 'Follow-up: Talked to them'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3481". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"` - exit 0

```
Running 2 tests using 2 workers

  ✓  2 [phone] › e2e/desk.spec.ts:54:1 › Home shows the alliance, its activity and its week line (440ms)
  ✓  1 [wide] › e2e/desk.spec.ts:54:1 › Home shows the alliance, its activity and its week line (459ms)

  2 passed (7.5s)
$ playwright test e2e/desk.spec.ts -g 'Home shows the alliance'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3481". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```
