# 585-one-worklist proofs

**HEAD**: a1168d40
**Tree**: clean
**Shell**: /bin/sh
**Result**: 25 pass, 0 fail

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
| C15   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > keeps a member` | pass          |
| C16   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > says since whe` | pass          |
| C17   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last wee` | pass          |
| C18   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this wee` | pass          |
| C19   | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's Needs help in words (#585 slice 2) > says since` | pass          |
| C20   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, ` | pass          |
| C21   | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                    | pass          |
| C22   | `walk - s2-shots/followup-360-fold.png, followup-360-full.png, followup-360-dark-full.png, panel-360.png, clear` | pass (Walked) |
| C23   | `run unit / ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > puts a memb` | pass          |
| Build | `pnpm typecheck`                                                                                                 | pass          |
| Build | `pnpm lint`                                                                                                      | pass          |

## Output

`Run unit` - exit 0

```
 ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > says nothing about check-ins on Home before the alliance's first daily update 7ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > keeps a member marked Needs help on the list each week until the mark is cleared, paused by a break 398ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > lists each member noted since Monday 00:00 ST once, newest first; last Sunday's and an undone note are not 392ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > says since when and who added the mark and why, from the mark that stands, on the row and the card 65ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last week's newest record as context, never one from two weeks back, one undone across Monday or the mark's own 48ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > leaves a member who left the alliance out of the noted and out of both numbers 50ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update 42ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126) 32ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers before the alliance's first daily update 32ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this week's list and Home's numbers from this week's records only, the Needs help group counted 50ms

 Test Files  7 passed (7)
      Tests  27 passed (27)
   Start at  06:32:55
   Duration  1.60s (import 52%, transform 27%, tests 21%)
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [phone] › e2e/desk-flows.spec.ts:75:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (934ms)
  ✓  2 [wide] › e2e/desk-flows.spec.ts:75:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (969ms)

  2 passed (3.9s)
$ playwright test e2e/desk-flows.spec.ts -g 'Follow-up: Talked to them'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3491". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"` - exit 0

```
Running 2 tests using 2 workers

  ✓  2 [phone] › e2e/desk.spec.ts:56:1 › Home shows the alliance, its activity and its week line (702ms)
  ✓  1 [wide] › e2e/desk.spec.ts:56:1 › Home shows the alliance, its activity and its week line (724ms)

  2 passed (3.5s)
$ playwright test e2e/desk.spec.ts -g 'Home shows the alliance'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3491". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```
