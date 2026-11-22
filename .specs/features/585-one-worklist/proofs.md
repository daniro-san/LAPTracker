# 585-one-worklist proofs

**HEAD**: f420a368 (S3; S1 and S2 rows from fff3a937)
**Tree**: clean
**Shell**: /bin/sh
**Result**: 36 pass, 0 fail

| Check | Proof                                                                                                             | Result        |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| C1    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member`  | pass          |
| C2    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member`  | pass          |
| C3    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member`  | pass          |
| C4    | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member`  | pass          |
| C5    | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > says Follow-up's two num`  | pass          |
| C6    | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's week in words (#585) > writes a noted row with `  | pass          |
| C7    | `run unit / ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > gives`  | pass          |
| C8    | `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`                                             | pass          |
| C9    | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                     | pass          |
| C10   | `walk - 585-worklist/after2/followup--360-light-en-fold.png, after2/noted-360-light.png, after2/noted-360-dark.`  | pass (Walked) |
| C11   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, `  | pass          |
| C12   | `run unit / ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > says `  | pass          |
| C13   | `run unit / ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > keeps the`  | pass          |
| C14   | `run unit / ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Member`  | pass          |
| C15   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > keeps a member`  | pass          |
| C16   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > says since whe`  | pass          |
| C17   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last wee`  | pass          |
| C18   | `run unit / ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this wee`  | pass          |
| C19   | `run unit / ✓ lib/private/follow-up-rules.test.ts > Follow-up's Needs help in words (#585 slice 2) > says since`  | pass          |
| C20   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, `  | pass          |
| C21   | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                     | pass          |
| C22   | `walk - s2-shots/followup-360-fold.png, followup-360-full.png, followup-360-dark-full.png, panel-360.png, clear`  | pass (Walked) |
| C23   | `run unit / ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > puts a memb`  | pass          |
| C24   | `pnpm test:e2e e2e/desk-flows.spec.ts -g "No longer needs help"`                                                  | pass          |
| C25   | `run unit / ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > says a l`     | pass          |
| C26   | `run unit / ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > puts a m`     | pass          |
| C27   | `run unit / ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > holds the`  | pass          |
| C28   | `run unit / ✓ app/(private)/_ui/MembersList.test.ts > the Members list's first group (issue 585 S3) > says its s` | pass          |
| C29   | `pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"`                                             | pass          |
| C30   | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"`                                                     | pass          |
| C31   | `pnpm test:e2e e2e/desk.spec.ts -g "Members: a card opens"`                                                       | pass          |
| C32   | `run unit / ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > has the same keys in en, `  | pass          |
| C33   | `walk - s3-shots/after2/followup-a-phone-light-fold.png, followup-b-phone-dark-full.png; s3-shots/after/…`        | pass (Walked) |
| C34   | `grep -c "2026-11-22 (issue 585 batch 3, slice 3\|2026-11-22, issue 585 S3" docs/decisions/D104… D140… D98… D73…` | pass (1 each) |
| Build | `pnpm typecheck`                                                                                                  | pass          |
| Build | `pnpm lint`                                                                                                       | pass          |

## Output

`Run unit` - exit 0

```
 ✓ app/(private)/_ui/CheckInLine.test.ts > the check-in line on Home and Members (issue 585) > says nothing about check-ins on Home before the alliance's first daily update 12ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > lists each member noted since Monday 00:00 ST once, newest first; last Sunday's and an undone note are not 2138ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > leaves a member who left the alliance out of the noted and out of both numbers 283ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > keeps a member marked Needs help on the list each week until the mark is cleared, paused by a break 2176ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > gives Home and Members Follow-up's own numbers from Monday 00:00 ST, before Monday's daily update 185ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > says since when and who added the mark and why, from the mark that stands, on the row and the card 301ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers while the alliance turned the Follow-up tab off (D126) 181ms
 ✓ lib/private/follow-up-week.test.ts > who was noted this week, and the two numbers Home and Members show (#585) > reads nothing and gives no numbers before the alliance's first daily update 252ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > shows last week's newest record as context, never one from two weeks back, one undone across Monday or the mark's own 293ms
 ✓ lib/private/follow-up-help.test.ts > Follow-up's Needs help group (#585 slice 2) > takes this week's list and Home's numbers from this week's records only, the Needs help group counted 224ms

 Test Files  7 passed (7)
      Tests  27 passed (27)
   Start at  07:01:11
   Duration  5.79s (import 40%, tests 36%, transform 24%)
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "Follow-up: Talked to them"` - exit 0

```
Running 2 tests using 2 workers

  ✓  2 [phone] › e2e/desk-flows.spec.ts:77:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (3.4s)
  ✓  1 [wide] › e2e/desk-flows.spec.ts:77:1 › Follow-up: Talked to them takes a quiet member off the list, after a reload too (3.3s)

  2 passed (12.9s)
$ playwright test e2e/desk-flows.spec.ts -g 'Follow-up: Talked to them'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3491". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance"` - exit 0

```
Running 2 tests using 2 workers

  ✓  1 [wide] › e2e/desk.spec.ts:56:1 › Home shows the alliance, its activity and its week line (2.0s)
  ✓  2 [phone] › e2e/desk.spec.ts:56:1 › Home shows the alliance, its activity and its week line (2.1s)

  2 passed (10.4s)
$ playwright test e2e/desk.spec.ts -g 'Home shows the alliance'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3491". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

`pnpm test:e2e e2e/desk-flows.spec.ts -g "No longer needs help"` - exit 0

```
Running 2 tests using 2 workers

  -  2 [wide] › e2e/desk-flows.spec.ts:136:1 › Follow-up: No longer needs help takes a member off Needs help, after a refusal and a reload too
  ✓  1 [phone] › e2e/desk-flows.spec.ts:136:1 › Follow-up: No longer needs help takes a member off Needs help, after a refusal and a reload too (2.3s)

  1 skipped
  1 passed (10.4s)
$ playwright test e2e/desk-flows.spec.ts -g 'No longer needs help'
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3491". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
```

S3, at f420a368:

`Run unit` (now with `app/(private)/_ui/MembersList.test.ts`) - exit 0: 8 test files, 30 tests passed.

`pnpm test:e2e` (the whole suite, production build, own Postgres on 127.0.0.1:54393, app on 3493) - exit 0: 47 passed, 3 skipped (by design); after the tap cue, `e2e/desk-flows.spec.ts` and `e2e/desk.spec.ts` again: 17 passed, 3 skipped.

C34 - exit 0: D104 1, D140 1, D98 1, D73 1.

S5, at the branch `feat/585-after-kvk-help` (server clock Sun 22 Nov, so the KvK week branch of C50 and C51 ran):

| Check | Proof                                                                                                    | Result        |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------- |
| C43   | `run unit / ✓ lib/private/follow-up-kvk.test.ts > … > lists the KvK's heavy hits from its night read …`  | pass          |
| C44   | `run unit / ✓ lib/private/follow-up-kvk.test.ts > … > takes a member someone wrote about after the KvK…` | pass          |
| C45   | `run unit / ✓ app/(private)/_ui/follow-up-groups.test.ts > … > offers help after the KvK in the second…` | pass          |
| C46   | `run unit / ✓ app/(private)/_ui/FollowUpWeek.test.ts > … > jumps from the head to After KvK, offer help` | pass          |
| C47   | `run unit / ✓ lib/private/follow-up-kvk.test.ts > … > links Insights' help list to the group only …`     | pass          |
| C48   | `run unit / ✓ lib/private/dictionary.test.ts > … > has the same keys in en, pt-BR and fr …`              | pass          |
| C49   | `grep -c "2026-11-22 (issue 585 batch 3, slice 5" … D104 … D139 … D140`                                  | pass (1 each) |
| C50   | `pnpm test:e2e e2e/desk-kvk.spec.ts`                                                                     | pass          |
| C51   | `pnpm test:e2e e2e/desk.spec.ts -g "Home shows the alliance\|Members: a card opens"`                     | pass          |
| C52   | `walk - s5-shots/followup-360-dark-fold.png, followup-360-light-fold.png, …`                             | pass (Walked) |

`Run unit` (now with `lib/private/follow-up-kvk.test.ts`) - exit 0: 9 test files, 35 tests passed.

`pnpm test:e2e` (the whole suite, production build, own Postgres on 127.0.0.1:54395, app on 3495) - exit 0: 49 passed, 3 skipped (by design); then `e2e/desk-kvk.spec.ts`, `e2e/desk.spec.ts` and `e2e/desk-flows.spec.ts` with `--repeat-each=3`: 57 passed, 9 skipped, 0 failed.

`pnpm check` - exit 0: 330 test files passed (2 skipped), 1728 tests.
