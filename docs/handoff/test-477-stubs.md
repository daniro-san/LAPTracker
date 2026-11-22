# test/477-stubs: one stub server for the e2e suite; flows 7 (tracker key) and 4 (notice translate and publish)

Part of #477 (flows 4 and 7).

## Built

- `e2e/stub-server.mjs`: one HTTP server on 127.0.0.1 for the whole suite, started by Playwright like the other servers (`E2E_STUB_PORT`, default 3479). It answers three routes and keeps each request it answered in memory: path, Authorization header, and for a POST its body as text (`raw`) and parsed (`body`; for Groq also its answer). The specs read that list from `GET /__stub/received`.
  - `GET /v1/quota` for any key except LAP_API_KEY: the recorded fixture `fixtures/v1-20261116T105019Z/quota-before.json`.
  - `POST /groq/openai/v1/chat/completions`: each word of the text inside `<text>…</text>` written backwards, so the untranslated guard (D81) finds none of the source words.
  - `POST /discord/webhooks/<id>/<token>`: answers `{id, channel_id}`, as Discord does with `?wait=true`. A multipart post (a notice with a picture, D119) is read from its `payload_json` part.
  - A POST to those two routes that is neither JSON nor multipart with `payload_json` gets 400. The handler never throws, so one bad request cannot stop the shared stub.
  - Any other request: the stub reads the body, then closes the socket without an answer.
- `e2e/no-network.mjs`: only when `E2E_STUB_URL` is set (the e2e servers), `fetch` sends `https://api.groq.com/…` and `https://discord.com/api/webhooks/…` to the stub. Both URLs are fixed in the app code (`GROQ_CHAT_URL`, and the webhook regex in `lib/env.ts`), so the app code stays as it is. Other users of the preload (`scripts/record-fixture.test.ts`) keep `fetch` as it is.
- `e2e/env.ts`: `LAP_API_BASE_URL` now points at the stub. New invented values: `GROQ_API_KEY`, `WORKSPACE_KEYS_SECRET` (32 bytes, base64) and `WORKSPACE_DISCORD_WEBHOOKS`, which gives each filler workspace (irt, mnw, glw) a leadership channel (`NOTICE_CHANNELS`). Also new: `E2E_STUB_URL`, `STUB_PORT` and `STUB_URL`.
- `e2e/fixtures/seed.ts`: the filler workspaces' `workspace_features.switches` turn `notice_translate` on (D126: a feature that spends Groq starts off).
- `e2e/desk-key.spec.ts` (flow 7, phone only, on `switchWorkspaceOf(repeat)`):
  - The officer saves an invented `lap_` key with "Save and test" and sees "Key saved and tested.", "Key set, ends in ••••<last4>", "Working." and "Quota left: <fixture's remaining>".
  - The stub got `Authorization: Bearer <key>` on `/v1/quota`.
  - After a reload, the key is still set.
  - Remove, then a reload, shows "No key yet…" again.
  - The test reads every response body the page receives, of any type; none contains the key.
- `e2e/desk-notice.spec.ts` (flow 4, phone only, on `switchWorkspaceOf(repeat)` and its own webhook):
  - The officer writes a title and English text and taps Translate. The PT and FR tabs hold the stub's answer as a draft ("Draft from Translate, not saved").
  - The officer saves, then posts to "#<slug>-leaders" and sees "Posted to #… by Officer <TAG>", also after a reload.
  - The stub's posts to that webhook contain the title, the English text and the translation.
  - `leaksIn` (the guards' sentinel scan) finds no private roster field in the posted JSON.
- `savedAndRefreshed` moved from `e2e/desk-flows.spec.ts` to `e2e/fixtures/test.ts`, so the new specs can use it. desk-flows and `e2e/self-report.spec.ts` import it from there; self-report's own copy (`refreshedAfter`) is gone.
- `app/(private)/_ui/NoticePublish.tsx`: `send` now reads the answer body on a 2xx (see Deviations).
- `docs/decisions/D150-committed-e2e-suite-with-playwright.md`: a dated amendment (2026-11-22, issue 477, PR 712) on the stub, the routes it answers, how unknown routes and unreadable bodies fail, the new settings and the preload rewrite.

## Decisions

- Design: option A, one stub for the whole suite. It keeps every existing spec unchanged, so option B (a second app server with its own env) is not needed.
- Unknown routes fail as the old upstream did. At `127.0.0.1:9`, `fetch` refused the port before connecting: `TypeError: fetch failed`, cause "bad port", no error code. I measured three ways a server can refuse:
  - A reset socket (`resetAndDestroy`) gives cause `ECONNRESET`. `lib/data-unavailable.ts` `databaseDown` reads that code as "database down", which is not what the old upstream gave.
  - A plain close after reading the body gives `TypeError: fetch failed`, cause `UND_ERR_SOCKET`. `RequestError` (name TypeError) and `databaseDown` (false) treat it as they treated "bad port", so the stub uses this.
  - A close before the body is read gives `ECONNRESET` on a POST. That is why the stub reads the body first.
- The stub gives the site's own key (LAP_API_KEY) no answer on `/v1/quota`, so any site-key call fails as before. Only a workspace key's test gets a quota.
- Groq and the webhooks reach the stub through a `fetch` rewrite in the server preload, not through new app env variables (such as a Groq base URL). This keeps the change inside `e2e/`.
- Both flows run on the phone project only, on the repeat's own filler workspace, like the Features test. Each one writes workspace-wide state (the key, a posted notice). The seed has three filler workspaces, one per repeat, so it has none left for the wide project. The wide project reports both tests as skipped.
- The publish goes to the leaders' channel (the notice's default audience) of a plain, non-forum channel. Only the leaders' channels are configured.
- The stub's translation is the same for PT and FR. The spec reads it from the stub's record and checks that both tabs show it.

## Deviations

- One app change: `NoticePublish.tsx` read nothing from a 2xx answer. Chromium never finishes loading a response body the page leaves unread. `response.text()` in the guards then hangs, or fails as "unreadable answer" after a reload, so flow 4 could not pass the guards. `send` now reads the JSON, as `TrackerKeyForm` and `calendar-send` already do. Users see no difference.
- `savedAndRefreshed` was moved to `fixtures/test.ts`, not copied into the new specs (one helper, three users).
- Count with the new specs, on dev with the calendar PR (#709): 74 passed, 6 skipped. Dev alone was 72 passed, 4 skipped. The +2 passed are the new phone tests. The +2 skipped are their wide runs. The 4 earlier skips are unchanged.

## Verified

- Own cluster and ports: Postgres 18 with password auth at `127.0.0.1:54531/lap_e2e_stubs`, app 3531, bridge 54541, https 3532, stub 3533. The Neon driver sends the password before the server asks, so a trust-auth cluster fails ("invalid frontend message type 112").
- `pnpm exec playwright test e2e/desk-key.spec.ts e2e/desk-notice.spec.ts --repeat-each 3`: 6 passed (phone), 6 skipped (wide).
- Full e2e suite, three times: 72 passed and 6 skipped each time, and no `e2e-outbound.log`.
  - First run: on the build before the lint fixes.
  - Second run: fresh build of the final tree.
  - Third run: the same build again.
- Mutation proofs, each with its own build, each reverted afterwards:
  - `tracker-key/route.ts` answers `{ state, key: input.key }` on a save. desk-key fails at "answers to the browser that carry the key" with `http://localhost:3531/api/w/irt/tracker-key`.
  - `postMessages` returns all messages sent without calling `fetch`. The page still shows "Posted to #irt-leaders…". desk-notice fails at `expect(posted.length).toBeGreaterThan(0)` (received 0).
  - The posted content gets `\nAt 713579` (Lantern Keep's map x sentinel). desk-notice fails at "private roster fields in the post" with `["a.x"]`.
- `pnpm vitest related --run` on the changed files: 5 passed. `pnpm check`: exit 0 (352 files passed, 2 skipped). It needed two fix rounds: prettier on desk-key.spec.ts, then ESLint `no-undef` for `URL` and `Request` in the `.mjs` files.
- After PR 712's review, on the branch rebased onto dev (with the calendar PR):
  - The stub, run alone and probed: a JSON post and a multipart post with a picture each get 200, and their `payload_json` is recorded. A text body and a broken Groq body each get 400. An unknown route still gets `UND_ERR_SOCKET`, and the stub keeps answering.
  - `pnpm vitest run scripts/record-fixture.test.ts`: 1 passed (it preloads no-network.mjs without `E2E_STUB_URL`).
  - Fresh build, then desk-key, desk-notice and self-report: 3 passed, 3 skipped (wide). The same three again after the last stub edit: 3 passed.
  - Full e2e suite once: 74 passed, 6 skipped, no `e2e-outbound.log`.
  - `pnpm check`: exit 0 (353 files passed, 2 skipped), after one fix round (ESLint `no-undef` for `Buffer` in the stub).

## Open issues

- Other desk writes also leave a 2xx body unread: `ShareThanksEdit.tsx`, `theft-client.ts` and `NoticeReviews.tsx` (`if (res.ok) return "ok"`). An e2e flow through any of them will hit the same "unreadable answer" in the guards. I did not change them.
- With `WORKSPACE_KEYS_SECRET` set, every e2e Home now shows the "Add your tracker key" card, and Alliance settings shows the key form and the Discord webhook form, not the "off" lines. No existing spec asserts either. The KeyCard's "Open the tracker's API page" link now points at the stub's `/account`, which nobody requests.
- The stub's in-memory list grows for the whole run. That is fine at this suite's size.

## Next

- The calendar PR (#709) is merged. With this PR, #477's three missing flows (3, 4 and 7) are covered and the issue can close.
- Follow-up: read the answer body in the three components listed under Open issues, before e2e flows cover them.

What was missing from the task prompt? That the AI features start off for a new workspace (D126), so the seed had to turn Translate on. Also that an answer the page never reads cannot be scanned by the guards in Chromium.

PR: (added by the orchestrator)
