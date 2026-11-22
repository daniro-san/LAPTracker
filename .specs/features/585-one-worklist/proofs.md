# 585-one-worklist proofs

**HEAD**: 0a501bf4
**Tree**: clean
**Shell**: /bin/sh
**Result**: 14 pass, 0 fail

| Check | Proof                                                                                                            | Result        |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| C1    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C2    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C3    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C4    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member` | pass          |
| C5    | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > says Follow-up's two num` | pass          |
| C6    | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > writes a noted row with ` | pass          |
| C7    | `run unit / ✓ app/(private)/_ui/HomeMembers.test.ts > the check-in line on Home and Members (issue 585) > gives` | pass          |
| C8    | `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`                                            | pass          |
| C9    | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                    | pass          |
| C10   | `walk - 585-worklist/after2/followup--360-light-en-fold.png, after2/noted-360-light.png, after2/noted-360-dark.` | pass (Walked) |
| C11   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, ` | pass          |
| C12   | `run unit / ✓ app/(private)/_ui/HomeMembers.test.ts > the check-in line on Home and Members (issue 585) > says ` | pass          |
| Build | `pnpm typecheck`                                                                                                 | pass          |
| Build | `pnpm lint`                                                                                                      | pass          |

## Output

`Run unit` - exit 0

```
 ✓ lib/private/follow-up-rules.test.ts > the Follow-up rules (issue 340, D104) > gives the coins tip on 5 days below 1,000 with data; a day with no read never counts (D140) 0ms
 ✓ lib/private/follow-up-rules.test.ts > the Follow-up rules (issue 340, D104) > gives the coins tip at exactly 5 days below 1,000 when the other 2 days have no read (D140) 0ms
 ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > says Follow-up's two numbers in one line for Home and Members, nothing when both are 0 0ms
 ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > writes a noted row with the officer and the day first, and a break with its last day away 0ms
 ✓ app/(private)/_ui/HomeMembers.test.ts > the check-in line on Home and Members (issue 585) > gives Follow-up's numbers, linked to Follow-up, while its tab is on, and Members' own count while it is off 2ms
 ✓ app/(private)/_ui/HomeMembers.test.ts > the check-in line on Home and Members (issue 585) > says nothing about check-ins on Home before the alliance's first daily update 4ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > lists each member noted since Monday 00:00 ST once, newest first; last Sunday's and an undone note are not 289ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > leaves a member who left the alliance out of the noted and out of both numbers 42ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update 41ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126) 31ms

 Test Files  4 passed (4)
      Tests  19 passed (19)
   Start at  05:05:21
   Duration  980ms (import 52%, tests 29%, transform 18%)
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [phone] › e2e/desk-flows.spec.ts:75:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (1.1s)
  ✓  2 [wide] › e2e/desk-flows.spec.ts:75:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (1.1s)

  2 passed (9.4s)
$ playwright test e2e/desk-flows.spec.ts -g 'Follow-up: Talked to them'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3481". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"` - exit 0

```
Running 2 tests using 2 workers

  ✓  2 [phone] › e2e/desk.spec.ts:53:1 › Home shows the alliance, its activity and its week line (453ms)
  ✓  1 [wide] › e2e/desk.spec.ts:53:1 › Home shows the alliance, its activity and its week line (465ms)

  2 passed (6.7s)
$ playwright test e2e/desk.spec.ts -g 'Home shows the alliance'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3481". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```
