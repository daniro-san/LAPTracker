# test-e2e-flows-1 — e2e flows, batch 1: sign-out, Follow-up, member facts, a feature switch

Part of #477. Follow-ups listed in `docs/handoff/test-477-e2e-ci.md` Next and in the test audit's "E2E review › Flow shapes". Rules: `.claude/rules/tests.md` § E2E, D150 (amended 2026-11-22, PR 632).

## Built

- **`e2e/desk-flows.spec.ts`** (4 tests; 7 runs on `phone` and `wide`, because the switch test runs on `phone` only). Each test puts back what it changed and checks that on screen, except the ended session.
  - **Sign out.** Signs in with a session of its own (`signOutToken(project, repeat)`) and opens Members, where the heading, the frame and Bramblewick's line show. Taps the real Sign out button, under the automatic guard. The sign-in screen shows (region, heading, "Sign in with Discord"), with no error screen, no Members heading and none of Lantern Keep's 12 names. Opening `/w/lnk/members` again shows the same screen.
  - **Follow-up.** Moss Hollow's officer opens Follow-up. The test's own quiet member is under "Check in · n" with "Quiet for 3 days. Worth a hello." Tapping "Talked to them" shows "Saved. ‹name› is off the list until Monday." and the row leaves. After a reload the member still has no row. Put back: the Undo of that record. Then, after a reload, the row shows its reason again.
  - **Member facts.** Lantern Keep's officer opens the test's own member from Members. Info shows "Troops T10" (seeded). "Edit info" → Troops T11 → Save: the editor closes and Info shows T11, still there after a reload. History shows "Earlier values" with "Troops: T10 · ‹the seeded day›". Put back: T10 saved the same way, shown at once and after a reload. History then shows "Troops: T11 · ‹today›" too.
  - **Features (phone only).** Uses a workspace of its own per repeat (`switchWorkspaceOf`). The calendar's "Calendar views" navigation shows Week and Thefts. In Alliance settings → Features, unticking Thefts shows "Not saved yet: 1 change". Save shows "Saved." and the box stays unticked. After a reload it is still unticked. The calendar navigation then shows Week and no Thefts. Put back: Thefts turned on the same way (Saved., ticked after a reload, Thefts back in the navigation).
- **`app/(private)/_ui/SignOutButton.tsx`:** reads the logout answer to the end (`await res.json().catch(() => null)`). Left unread, Chromium never finished the request, so the privacy guard could not read the answer and failed the test as "unreadable answer". Users see no change.
- **`e2e/fixtures/seed-people.ts`** (new): the invented alliances, members, sentinels and sessions moved out of `seed.ts`, plus the rows each writing test owns per project and repeat:
  - `signOutToken`: 9 extra Lantern Keep officer sessions.
  - `idleOf` / `IDLE_UIDS`: 6 Moss Hollow members (k = 2–7) with `active` and `daily_tech` null on the last 3 end-of-day reads.
  - `factMemberOf` / `FACT_MEMBERS`: 6 Lantern Keep members (phone 1, 2, 9; wide 6, 7, 8), each with Troops T10 saved 3 days ago (`FACT_SEEDED`).
  - `switchWorkspaceOf`: one workspace per filler alliance (`irt`, `mnw`, `glw`), each with an officer and a session.
  - `WORKSPACES`: every seeded workspace with its members' names, including the fillers' (`fillerNames`).
  - `cheeseOf` now uses the shared `slotOf`.
  - `seed.ts` re-exports these (`export * from "./seed-people"`).
- **`e2e/fixtures/seed.ts`:** the rows for the above (sessions, filler workspaces, `member_facts`, quiet members in `raw_json`). New helpers `usDay` and `daysAgo`; `DAY_MS` is exported.
- **`e2e/fixtures/test.ts`:**
  - `otherMembersIn` covers every seeded workspace (`WORKSPACES`): a private answer of any of the five is checked for every other one's member names.
  - `deskFrame(page, alliance)` is shared.
  - `signIn()` takes an optional `token`.
- **`e2e/isolation.spec.ts`:** a positive control per seeded workspace. A private answer naming another workspace's member is caught; its own members are not.
- **`e2e/desk.spec.ts`, `e2e/board.spec.ts`:** use the shared `deskFrame`, `usDay` and `daysAgo` instead of local copies.
- **D150:** a dated amendment (filler workspaces, the four flows leave "Not done here", the guard on every seeded workspace, sign-out under the normal guard, the put-backs).

## Decisions

- **Moss Hollow holds the quiet members.** Lantern Keep's Home week line, top donors and "Everyone looks fine this week." are asserted by `desk.spec.ts`; quiet members there would change them.
- **Follow-up and member facts run on both widths**, each with its own member per project and repeat. The panel and the card are a sheet below 1024 px and a pane above.
- **The switch test uses a filler alliance's workspace per repeat.** With `--repeat-each=3`, repeats run in parallel, so one shared switch would race.
- **Troops instead of "came from".** "Came from" is not an editable fact: the card computes it from earlier rosters (D136, `card.origin`).
- **No Home check for Follow-up.** D140 puts no Follow-up line on Home. Home's "n people to check in with or help" counts Members' reasons, which "Talked to them" does not change.
- **Follow-up's put-back is the app's own Undo request.** The page shows Undo only until it is left, and the test reloads first to prove that the Talked was stored. The test captures the tap's own request id (`postDataJSON`) and sends `{action: "undo", target}` to the same route. It then checks on screen that the row is back.
- **The member-facts test no longer checks that History has no "Troops: T11" line.** After a put-back, T11 is an earlier value, and a later run on the same slot would see it.
- **Waiting for the refresh.** After every save that calls `router.refresh()`, the test waits for that RSC answer to finish (`savedAndRefreshed`) before it reloads or opens another page; a cut-off answer is "unreadable" to the guard.
- **Names inside isolates.** The Follow-up saved line and the editor's dialog name ("Info: ‹name›") put the name inside U+2068/U+2069; the test allows them.

## Deviations

- **One line of app code** (`SignOutButton` reads the logout answer), as the review allowed. With it, the sign-out test has no exemption from the guard.
- **Not in the WebKit project.** The `iphone` project's `testMatch` is `desk\.spec`, and the seed holds the quiet and fact members for `phone` and `wide` only. `E2E_WEBKIT=1` was run to check that the changes break nothing there.
- **`seed.ts` was split** to stay under ESLint's `max-lines` (300): the people and the slots are in `seed-people.ts`, the SQL stays in `seed.ts`.

## Verified

Local: Apple silicon, Node 26.5.0, Postgres 18 (worktree-local db:local cluster on 54320), Playwright Chromium and WebKit 2388.

- `pnpm test:e2e` (with `next build`): 46 passed, 2 skipped, 20.8 s.
- `E2E_NO_BUILD=1 pnpm test:e2e --repeat-each=3`: 138 passed, 6 skipped, 0 failed, 38.7 s.
- `E2E_NO_BUILD=1 E2E_WEBKIT=1 pnpm test:e2e`: 50 passed, 3 skipped, 48.4 s.
- Slots reused: Follow-up, member facts and Features with `--repeat-each=6 --workers=1` (repeats 3–5 reuse the slots of 0–2): 30 passed, 6 skipped. The put-backs leave each slot as seeded.
- `pnpm check`: exit 0 (prettier, eslint, tsc, Vitest 1670 passed and 4 skipped, drift, i18n).
- **Deliberate breaks.** Each was built (`next build`), run against `desk-flows.spec.ts`, then reverted. All failed on `phone` and `wide`:

| Test | Break | Fails at |
| --- | --- | --- |
| Sign out | logout route answers `{ok:true}` without ending the session or clearing the cookie | sign-in heading not visible |
| Sign out | `SignOutButton` without `router.refresh()` | the page never refreshes; times out waiting for it |
| Sign out | a sentinel planted in the logout answer (`{ok: true, planted: 713579}`) | the guard: `a.x in /api/w/lnk/logout` |
| Sign out | `SignOutButton` back to not reading the answer | the guard: `unreadable answer /api/w/lnk/logout` |
| Follow-up | route answers `{ok:true}` for "talked" without recording it | the row is still there after the tap |
| Follow-up | route answers `{ok:true}` for "undo" without undoing | the row does not come back after the put-back |
| Member facts | facts route answers `{results: []}` without saving | Info still shows "Troops T10" after Save |
| Member facts | `versionLines` returns no lines | History has no "Earlier values" heading |
| Features | `CalendarNav` always lists Thefts | Thefts link still in "Calendar views" after the switch is off (phone only) |
| Features | features route answers `{ok, on}` without storing it | the box is ticked again right after Save, because the refresh brings the stored value (phone only) |

- The name check on the filler workspaces: the new positive control in `isolation.spec.ts` passes for all five workspaces, both ways.

## Open issues

- The sign-out slots cannot be put back: an ended session does not return. A run with more than 3 repeats would reuse an ended session in repeat 4. The slots, like `cheeseOf`'s, are sized for 3 repeats.
- In the Features break, a switch that is not stored fails at once, at the check right after Save, not after the reload. The reload check is still there, for a client that keeps its own draft.

## Next

Follow-ups for #477 (later PRs):

- the remaining flows: sign-in, Calendar add/delete/Undo (a title per project), notices (save, translate stub, publish), the export ZIP sweep (D71's export rule), compare, the live event page, viewer settings;
- the other 34 `/api/w/[slug]` routes in the cross-workspace sweep;
- a realistic seed of about 95 invented members in Lantern Keep;
- unit tests for `proxy.ts`.

What was missing from the task prompt? That "came from" is computed, not an editable fact. That Follow-up's Undo is offered only until the page is left. Whether a test may change one line of app code when the guard cannot read an answer.

<adjustments>
- New writing tests take their rows from `e2e/fixtures/seed-people.ts` (`signOutToken`, `idleOf`, `factMemberOf`, `switchWorkspaceOf`, `cheeseOf`); add new slots there, and add a new workspace to `WORKSPACES` so the guard checks it.
- A tap that calls `router.refresh()` needs its RSC answer waited for before a reload (`savedAndRefreshed` in `desk-flows.spec.ts`).
- A `fetch` whose body the page never reads stays open in Chromium and fails the privacy guard as "unreadable answer"; the client must read it.
- Moss Hollow now has 6 members with no quest points or donations on the last 3 reads. Any test of Moss Hollow's Home or Members must allow for them.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/632
