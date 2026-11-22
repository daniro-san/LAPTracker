# test/477-calendar-key: e2e Calendar add, delete and Undo; tracker key flow blocked

Part of #477 (flows 3 and 7).

## Built

- `e2e/desk-calendar.spec.ts` (flow 3), phone and wide. On Moss Hollow's desk, an officer opens the Calendar on the entry's week. They add an "Other event" with its own title at 20:00 ST and see it in the day's card ("20:00 ST", no "Nothing planned."). They delete it from the card, answer Delete and see "Event deleted.", with the day empty. They tap Undo and see the entry back. After a reload, it is still there. At the end, the test deletes the entry again through the card, reloads and sees "Nothing planned.".
- Seed helper `calendarAddOf(now, project, repeat)` in `e2e/fixtures/seed.ts`: a title of its own ("Bear hunt drill <project> <repeat>") on a Monday of its own, 5 to 13 weeks after the seed's week. `slotOf` in `seed-people.ts` is now exported for it.
- `app/(private)/api/w/[slug]/calendar/route.test.ts`: one PGlite route test. An officer's add shows in the week as `calendarDays` reads it. The whole-entry delete answers `{ ok: true, deleted: true }` and takes the entry out. The same officer's Undo answers `{ ok: true }` and puts it back.

## Decisions

- Flow 3 writes on workspace b (Moss Hollow), weeks ahead. Workspace a's calendar weeks 1 to 3 hold the Raid prep marks, and the isolation sweep reads a's calendar. No spec reads b's calendar.
- The entry is not marked for members, so the members' board does not show it.
- The day card is found by its level-2 heading, the long date as the page writes it ("Monday, January 11", from the seed's `shown`).

## Deviations

- Flow 7 (tracker key save and test) is not built. The e2e setup has no tracker stub server:
  - `e2e/env.ts` points `LAP_API_BASE_URL` at `http://127.0.0.1:9`, where nothing answers;
  - `WORKSPACE_KEYS_SECRET` is empty, so `saveTrackerKey` answers `off` (503 `keys_off`) before any call, and Alliance settings shows the "off" state with no form;
  - `e2e/fixtures/` holds no stub servers.

  As the task said, I stopped and report it instead of calling anything real.

## Verified

- `pnpm vitest run app/(private)/api/w/[slug]/calendar/route.test.ts`: 1 passed.
- `pnpm exec playwright test e2e/desk-calendar.spec.ts`: 2 passed (phone, wide).
- Full e2e suite once, on my own cluster and ports (`E2E_DATABASE_URL=postgres://lap:lap@127.0.0.1:54487/lap_e2e_477`, app 3587, bridge 54497, https 3588), with a build: 72 passed, 4 skipped.
- `pnpm vitest related --run` on the changed files: 4 passed. `pnpm check`: exit 0 (352 files passed, 2 skipped).
- Mutation proofs, each reverted afterwards. `lib/private/calendar-delete.ts` was changed to `if (request.undo) return "ok";`, an Undo that answers ok and restores nothing:
  - the route test fails on the last `titles()` check (`[]` instead of `["Bear hunt drill"]`);
  - after a rebuild, the e2e spec fails at the check right after Undo (`expect(title).toBeVisible()`, line 65: element not found).

## Open issues

- Flow 7 needs a tracker stub before it can be written. A local HTTP server answering `/v1/quota` would do. `LAP_API_BASE_URL` would point at it, with an invented `WORKSPACE_KEYS_SECRET` in `SERVER_ENV`. Today every spec relies on the upstream not answering. Pointing the shared server at a stub changes that for the whole suite, so it is the owner's or orchestrator's call: a stub for all specs, or a second server for one spec.

## Next

- Flow 7, after the stub decision above: save a key in Alliance settings, run its test against the stub, scan every response body with `page.on("response")` for the key, and prove it by a mutation that echoes the key in the answer.
- Flow 4 (notice write, translate, publish against stubs) needs the same kind of stub (Groq, Discord).

What was missing from the task prompt? Whether to build a tracker stub server and change the shared e2e server env when none exists. The task said to report it, so I did not build one.

PR: (added by the orchestrator)
