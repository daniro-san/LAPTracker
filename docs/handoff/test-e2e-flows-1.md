# test-e2e-flows-1 — e2e flows, batch 1: sign-out, Follow-up, member facts, a feature switch

Part of #477. Follow-ups listed in `docs/handoff/test-477-e2e-ci.md` Next and in the test audit's "E2E review › Flow shapes". Rules: `.claude/rules/tests.md` § E2E, D150.

## Built

- **`e2e/desk-flows.spec.ts`** (4 tests; 7 runs on `phone` and `wide`, because the switch test runs on `phone` only):
  - **Sign out.** Signs in with a session of its own (`signOutToken(project, repeat)`) and opens Members, where the heading, the frame and Bramblewick's line show. Taps Sign out. The sign-in screen shows (region, heading, "Sign in with Discord"), with no error screen, no Members heading and none of Lantern Keep's 12 names. Opening `/w/lnk/members` again shows the same screen.
  - **Follow-up.** Moss Hollow's officer opens Follow-up. The test's own quiet member is under "Check in · n" with "Quiet for 3 days. Worth a hello." Tapping "Talked to them" shows "Saved. ‹name› is off the list until Monday." and the row leaves. After a reload, the heading and frame show and the member has no row.
  - **Member facts.** Lantern Keep's officer opens the test's own member from Members. Info shows "Troops T10" (seeded). "Edit info" → Troops T11 → Save: the editor closes and Info shows "Troops T11". After a reload (`?m=` reopens the card), Info still shows T11. History shows "Earlier values" with "Troops: T10 · ‹the seeded day›" and no "Troops: T11" line.
  - **Features (phone only).** Uses a workspace of its own per repeat (`switchWorkspaceOf`). The calendar's "Calendar views" navigation shows Week and Thefts. In Alliance settings → Features, unticking Thefts shows "Not saved yet: 1 change". Save shows "Saved." and the box stays unticked. After a reload it is still unticked. The calendar navigation then shows Week and no Thefts. Turning it back on is checked the same way: Saved., ticked after a reload, Thefts back in the navigation.
- **`e2e/fixtures/seed-people.ts`** (new): the invented alliances, members, sentinels and sessions moved out of `seed.ts`, plus the rows each writing test owns per project and repeat:
  - `signOutToken`: 9 extra Lantern Keep officer sessions.
  - `idleOf` / `IDLE_UIDS`: 6 Moss Hollow members (k = 2–7) with `active` and `daily_tech` null on the last 3 end-of-day reads.
  - `factMemberOf` / `FACT_MEMBERS`: 6 Lantern Keep members (phone 1, 2, 9; wide 6, 7, 8), each with Troops T10 saved 3 days ago (`FACT_SEEDED`).
  - `switchWorkspaceOf`: one workspace per filler alliance (`irt`, `mnw`, `glw`), each with an officer and a session.
  - `seed.ts` imports these and re-exports them (`export * from "./seed-people"`), so no spec import changed.
- **`e2e/fixtures/seed.ts`:** the rows for the above (sessions, filler workspaces, `member_facts`, quiet members in `raw_json`).
- **`e2e/fixtures/test.ts`:** `signIn()` takes an optional `token`, for another seeded session.

## Decisions

- **Moss Hollow holds the quiet members.** Lantern Keep's Home week line, top donors and "Everyone looks fine this week." are asserted by `desk.spec.ts`; quiet members there would change them.
- **Follow-up and member facts run on both widths**, each with its own member per project and repeat. The panel and the card are a sheet below 1024 px and a pane above.
- **The switch test uses a filler alliance's workspace per repeat**, not Lantern Keep's or Moss Hollow's. With `--repeat-each=3`, repeats run in parallel, so one shared switch would race.
- **Troops instead of "came from".** "Came from" is not an editable fact: the card computes it from earlier rosters (D136, `card.origin`). Troops is a plain select, and its earlier value is written as "Troops: T10 · ‹day›".
- **No Home check for Follow-up.** D140 puts no Follow-up line on Home. Home's "n people to check in with or help" counts Members' reasons, and "Talked to them" does not change those.
- **Sign out: the test sends the logout request itself.** `SignOutButton` never reads the logout answer's body. Chromium then never finishes that request, and the privacy guard fails it as "unreadable answer". The server does end the answer: `{"ok":true}` in 61 ms through Playwright's request API. Fulfilling the page with the server's answer alone did not help, because the page still does not read it. The test now:
  - routes `/api/w/lnk/logout`;
  - sends the request with `route.fetch()`;
  - scans the server's real body with the guard's own `leaksIn`;
  - gives the page that answer with `content-type: text/plain`.
  The server still revokes the session and clears the cookie.
- **Waiting for the refresh.** After every save that calls `router.refresh()`, the test waits for that RSC answer to finish (`savedAndRefreshed`) before it reloads or opens another page. A cut-off RSC answer is otherwise "unreadable" to the guard (first run: `/w/irt/settings?_rsc=…`).
- **Names inside isolates.** The Follow-up saved line and the editor's dialog name ("Info: ‹name›") put the name inside U+2068/U+2069. The test matches them with an optional isolate around the name, as `desk.spec.ts` does.

## Deviations

- **Not in the WebKit project.** The `iphone` project's `testMatch` is `desk\.spec`, and the seed holds the quiet and fact members for `phone` and `wide` only. `E2E_WEBKIT=1` was run to check that the seed changes break nothing there.
- **`seed.ts` was split.** With the new rows it was 334 lines, over ESLint's `max-lines` of 300. The people and the slots moved to `seed-people.ts`; the SQL stayed in `seed.ts`.

## Verified

Local: Apple silicon, Node 26.5.0, Postgres 18 (worktree-local db:local cluster on 54320), Playwright Chromium and WebKit 2388.

- Baseline before the change: `pnpm test:e2e`: 38 passed, 1 skipped, 33.6 s.
- `pnpm test:e2e` (with `next build`): 45 passed, 2 skipped, 30.8 s.
- `E2E_NO_BUILD=1 pnpm test:e2e --repeat-each=3`: 135 passed, 6 skipped, 0 failed. It took 102 s; an earlier run of the same command took 34 s.
- `E2E_NO_BUILD=1 E2E_WEBKIT=1 pnpm test:e2e`: 49 passed, 3 skipped, 17.2 s.
- `e2e/desk-flows.spec.ts` alone: 7 passed, 1 skipped, 18.6 s.
- `pnpm check`: exit 0 (prettier, eslint, tsc, Vitest 1658 passed and 4 skipped, drift, i18n).
- **Deliberate breaks.** Each one was built (`next build`), run against `desk-flows.spec.ts`, then reverted with `git checkout`:

| Test | Break | Fails at |
| --- | --- | --- |
| Sign out | logout route answers `{ok:true}` without ending the session or clearing the cookie | sign-in heading not visible (phone, wide) |
| Sign out | `SignOutButton` without `router.refresh()` | the page never refreshes; times out waiting for it (phone, wide) |
| Follow-up | follow-up route answers `{ok:true}` for "talked" without recording it | the row is still there after the tap (`row` count 0) (phone, wide) |
| Member facts | facts route answers `{results: []}` without saving | Info still shows "Troops T10" after Save (phone, wide) |
| Member facts | `versionLines` returns no lines | History has no "Earlier values" heading (phone, wide) |
| Features | `CalendarNav` always lists Thefts | Thefts link still in "Calendar views" after the switch is off |
| Features | features route answers `{ok, on}` without storing it | the box is ticked again right after Save, because the refresh brings the stored value |

## Open issues

- `SignOutButton` does not read the logout answer's body, which is why the sign-out test routes the request. If the button read it (`await res.json().catch(() => null)`), the route could go. Not changed here: users see no difference.
- In the Features break, a switch that is not stored fails at once, at the check right after Save, not after the reload. The reload check is still there, for a client that keeps its own draft.

## Next

Follow-ups for #477 (later PRs):

- the remaining flows: Calendar add/delete/Undo (a title per project), notices (save, translate stub, publish), the export ZIP sweep (D71's export rule), compare, the live event page, viewer settings;
- the other 34 `/api/w/[slug]` routes in the cross-workspace sweep;
- a realistic seed of about 95 invented members in Lantern Keep;
- unit tests for `proxy.ts`.

<adjustments>
- New writing tests take their rows from `e2e/fixtures/seed-people.ts` (`signOutToken`, `idleOf`, `factMemberOf`, `switchWorkspaceOf`); add new slots there. `seed.ts` has 277 counted lines again, under the 300 limit.
- A tap that calls `router.refresh()` needs its RSC answer waited for before a reload (`savedAndRefreshed` in `desk-flows.spec.ts`).
- A `fetch` whose body the page never reads stays open in Chromium and fails the privacy guard as "unreadable answer". Check that the client reads the body before writing a test around it.
- Moss Hollow now has 6 members with no quest points or donations on the last 3 reads. Any test of Moss Hollow's Home or Members must allow for them.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/632
