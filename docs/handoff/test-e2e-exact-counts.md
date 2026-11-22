# test/e2e-exact-counts: e2e has no shared writes and asserts exact counts

Part of #592 (test audit 2, batch 2).

## Built

- Seed (`e2e/fixtures/seed-people.ts`, `seed-help.ts`): `CARD_TALKED` gives each project its own Lantern Keep member for the card's "Talked to them" (phone 6, wide 7, iphone 8), and `NOTED` is their count. Each of them has an "All fine" record by Officer LNK this week, 30 s before the seed.
- `desk.spec.ts`, card test: it taps Talked on its own member and sees the week line change from "All fine" to "Talked". It then taps the UI's Undo, sees "Undone." and the "All fine" line, and sees Talked enabled again. After the reload, the reopened card shows "All fine" and no Talked.
- Exact noted counts: Home's "3 already noted by officers" link (`desk.spec.ts`), Members' "Follow-up: n to look at · 3 noted this week" (`desk-kvk.spec.ts`, which used to accept the noted part as optional), and the drilldown (`desk-drilldown.spec.ts`). The drilldown no longer returns early when nobody is noted. It always taps through to "Noted this week · 3" and checks that each CARD_TALKED member is listed.
- `desk.spec.ts` Recent activity (the always-passing check): the feed now has to list "Officer LNK noted <this project's member> is fine". It taps "Show more" until that line shows. The loop moved to `showMoreUntil` in `e2e/fixtures/test.ts`, and the drilldown uses it too.
- Thanks nudge: on days other than Sunday and Monday, the Home test asserts the nudge is absent. `thanks.test.ts` also checks Saturday, the day before the window.
- `board.spec.ts`: on a Monday it checks "This week: no average yet". Its expected averages come from the new seed helper `questPointsOf`.
- Seed (`seed.ts` `questPointsOf`): only LINKED_MEMBER (k=3) gets varied quest points. Last week runs from sentinel −30 to sentinel +30 (Monday to Sunday), so its average is still the sentinel. This week is sentinel +20, and older days are sentinel +50.
- `isolation.spec.ts`: the cross-workspace roll-call POST now asserts the `{ code: "signed_out" }` body as well as the 401.
- `isolation.spec.ts` sweep: it adds calendar/caravans, notices, notices/new, notices/pictures, thefts, import and start-here to a's desk sweep. The desk and board sweeps also open each page in the browser. Each page must keep its own URL (no redirect) and show no `ERROR_SCREENS` text (`noError`), and its marker must be attached.

## Decisions

- Undo alone could not make the noted count exact. While a card test holds its Talked, a Home test running in parallel would count one more. So each card member is already noted by the seed. A Talked and its Undo then leave the count at `NOTED` the whole time.
- The error-screen check runs in the browser, not on the raw HTML. Every page's HTML holds "Something went wrong. Try again." as copy for its forms, so a body regex fails on every page. Also, an error inside a Suspense part answers 200 and the boundary only appears after hydration.
- The Me page's positive control (`isolation.spec.ts`, "a.active" in the Me page) still works: last week's average equals the sentinel.

## Deviations

- The thanks nudge cannot be checked on both branches in one run. The server's clock cannot be moved in e2e (`page.clock` moves only the browser's), and the server renders the nudge. Each run checks the branch for its own day, and `lib/private/thanks.test.ts` covers the rule for Saturday, Sunday, Monday and Tuesday. The board's Monday branch has the same limit.
- Left out of the sweep: calendar/garrison and roll-call/team answer 404 without an entry the seed does not have, and how-to reads nothing and shows no officer marker. Pages with an id in the path (notices/[id], shots/[id]) are left out too.
- The card test no longer checks that a Talked survives a reload. The task asked for Undo and then a reload, and a reload drops Undo from the card. It still checks that the card is read again after the save, and that the line shows the stored Talked.

## Verified

- Baseline on origin/dev: 70 passed, 4 skipped.
- Full suite on my own cluster and ports (`E2E_DATABASE_URL=…:54391/lap_e2e_exact`, app 3591, bridge 54591, https 3592), with today a Sunday:
  - run 1 (with build): 70 passed, 4 skipped;
  - run 2: 70 passed, 4 skipped;
  - run 3 with `E2E_WEBKIT=1`: 74 passed, 5 skipped.
- Mutation proofs, each reverted afterwards:
  - `followUpCounts` returns noted + 1: Home, drilldown and Members fail on the exact noted link.
  - `undoFollowUp` returns ok without writing: the card test fails on the "All fine" line after Undo (desk.spec.ts:228).
  - The Me page's last week starts on Tuesday (`-6`): board.spec fails on "Last week: Average 647 · 7 days".
  - The roll-call route's 401 answers `not_member`: isolation fails on the new body check (:127) for all four sessions.
  - `ReadStatusLine` throws (a 200 error page): every API check of a's desk sweep still passes, and the browser pass fails on `noError` ("Something cracked." shown).
  - Seed "All fine" rows written by Member LNK: the Home activity check fails.
  - No "All fine" rows: Home, drilldown, kvk and card tests fail on exact noted / "All fine".
  - Branch flipped in the spec: the nudge-absent check fails on a Sunday, and the board's "no average yet" check fails on a Sunday.
  - `appreciationDay` including Saturday: thanks.test.ts fails at :237.
- `pnpm vitest related --run` on the changed files: 12 passed. `pnpm check`: passes.

## Open issues

- `--repeat-each` with the card test: repeats of one project share its CARD_TALKED member, so two repeats running at once can race on Talked/Undo. The seed has 7 free R2+ members, too few for one per project and repeat (9). Seed v2 (audit PR 6) can give each repeat a member.
- The "status only" delete item (`a's member gets signed_out from a's own desk API`) was already gone on origin/dev.

## Next

- Seed v2 (audit PR plan item 6): about 95 members with varied values, so CARD_TALKED can also be per repeat, and garrison and team entries for the sweep.

What was missing from the task prompt? That Undo alone does not make the noted count exact while tests run in parallel, and that the raw HTML always carries the error copy.

PR: (added by the orchestrator)
