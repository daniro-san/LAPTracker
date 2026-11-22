# 585-one-worklist proofs

**HEAD**: 24ad4ffc
**Tree**: clean
**Shell**: /bin/sh
**Result**: 34 pass, 0 fail

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
| C24   | `pnpm test:e2e e2e/desk-flows.spec.ts -g "No longer needs help"`                                                 | pass          |
| C35   | `run unit / ✓ app/(private)/_ui/HomeMembers.test.ts > Home's Follow-up card (issue 585 slice 4) > says Follow-u` | pass          |
| C36   | `run unit / ✓ lib/private/desk-activity-pages.test.ts > recent activity pages > folds a roll call finished by s` | pass          |
| C37   | `run unit / ✓ app/(private)/_ui/HomeNext.test.ts > Home's Today and tomorrow (issue 585 slice 4) > shows an ent` | pass          |
| C38   | `run unit / ✓ app/(private)/_ui/ToReview.test.ts > a claim an officer can check on Home (issue 585) > says on H` | pass          |
| C39   | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                    | pass          |
| C40   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, ` | pass          |
| C41   | `grep -q "Amendment 2026-11-22 (issue 585 batch 3, slice S4" docs/decisions/D104-follow-up-weekly-worklist.md &` | pass          |
| C42   | `walk - 585-s4/shots/home-phone-light-fold.png, home-phone-dark-full.png, home-wide-light-fold.png (e2e seed, S` | pass (Walked) |
| Build | `pnpm typecheck`                                                                                                 | pass          |
| Build | `pnpm lint`                                                                                                      | pass          |

## Output

`Run unit` - exit 0

```
 ✓ app/(private)/_ui/ToReview.test.ts > a claim an officer can check on Home (issue 585) > offers Not them instead of Reject, on Home and on the card 43ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last week's newest record as context, never one from two weeks back, one undone across Monday or the mark's own 77ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this week's list and Home's numbers from this week's records only, the Needs help group counted 54ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update 63ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126) 34ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers before the alliance's first daily update 35ms
 ✓ lib/private/desk-activity-pages.test.ts > recent activity pages > pages two sources together when only one fills its read 93ms
 ✓ lib/private/desk-activity-pages.test.ts > recent activity pages > never folds two posts in a row into one line 38ms
 ✓ lib/private/desk-activity-pages.test.ts > recent activity pages > folds a roll call finished by several officers into one line naming each once (issue 585) 54ms
 ✓ lib/private/desk-activity-pages.test.ts > recent activity pages > shows a run longer than one read as two lines on two pages, each action once 46ms

 Test Files  11 passed (11)
      Tests  39 passed (39)
   Start at  07:55:33
   Duration  1.81s (import 46%, tests 36%, transform 18%)
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [phone] › e2e/desk-flows.spec.ts:77:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (1.0s)
  ✓  2 [wide] › e2e/desk-flows.spec.ts:77:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (1.0s)

  2 passed (4.0s)
$ playwright test e2e/desk-flows.spec.ts -g 'Follow-up: Talked to them'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3497". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [phone] › e2e/desk.spec.ts:56:1 › Home shows the alliance, its activity and its week line (654ms)
  ✓  2 [wide] › e2e/desk.spec.ts:56:1 › Home shows the alliance, its activity and its week line (661ms)

  2 passed (3.3s)
$ playwright test e2e/desk.spec.ts -g 'Home shows the alliance'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3497". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "No longer needs help"` - exit 0

```
Running 2 tests using 2 workers

  -  2 [wide] › e2e/desk-flows.spec.ts:136:1 › Follow-up: No longer needs help takes a member off Needs help, after a refusal and a reload too
  ✓  1 [phone] › e2e/desk-flows.spec.ts:136:1 › Follow-up: No longer needs help takes a member off Needs help, after a refusal and a reload too (921ms)

  1 skipped
  1 passed (3.6s)
$ playwright test e2e/desk-flows.spec.ts -g 'No longer needs help'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3497". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`grep -q "Amendment 2026-11-22 (issue 585 batch 3, slice S4" docs/decisions/D104-follow-up-weekly-worklist.md &` - exit 0

```
(no output)
```
