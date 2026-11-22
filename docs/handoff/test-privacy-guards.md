# test — privacy guards and quota gates (test audit batches 1 and 2, issue 592)

Vitest tests for gaps G1, G2, G5, G6, G8 and G9 of the 2026-11-21 test audit. No app code changed, and no bug was found. The e2e header and marker checks are in PR #600 and are not part of this branch.

## Built
- `proxy.test.ts` (4 tests). `proxy()` is called with a real `NextRequest`, and the test reads the `NextResponse` headers.
  - G1: `/w`, `/w/lnk`, `/w/lnk/members`, `/w/lnk/board/me` and `/api/w/lnk/members/101` carry `Cache-Control: private, no-store` (D71). `/`, `/players`, `/players/101`, `/events/2`, `/api/events` and `/img/avatar/101` carry no `Cache-Control` from the proxy.
  - G2 (D11): two requests for the same page get different nonces. `script-src` has the same nonce that the page's scripts receive, which is the `x-nonce` request header and reaches the test as `x-middleware-request-x-nonce`; this is checked on a public page and on a `/w` page. `/api/...`, `/api/w/...` and `/img/...` get `default-src 'none'; frame-ancestors 'none'` and no nonce (D11 for `/api`, D22 for `/img`).
- `app/(private)/api/w/[slug]/members/[uid]/route.test.ts` (4 tests, G5). Uses PGlite, a real `Request` with the officer's session cookie, and `seedRoster`, whose `raw_json` has `x`, `y`, `online`, `last_online_at` and `avatar_url`.
  - An officer gets their own alliance's member 101. The response has the right uid and name, and the map position as words, `X 98765 · Y 54321`; D71 and D136 allow it on the card.
  - No key anywhere in the JSON is `avatar_url`, `avatarUrl`, `x`, `y`, `online`, `last_online_at` or `lastOnlineAt`, and the photo's host does not appear in the body.
  - Another alliance's uid, 202, gets `404 {code: "not_member"}`.
  - The route itself answers `private, no-store` (`NO_STORE`), so this is tested at the route as well as in G1.
- `app/(private)/_ui/replay-masking.test.ts` (2 tests, G6, issue 549 and D142). A small helper, `recorded()`, removes every `ph-no-capture` element and its children from the server-rendered HTML. What is left is what session replay records.
  - The Members list (`MembersList`, rendered whole, so both the cards below 640 and the table from 640 are included). The week's donations (`6.54K`, shown twice) and the status line (`No daily quests on Wed, Nov 18`) are in the page but not in the recorded HTML. The name and might stay in the recorded HTML.
  - The Me page's week (`MeWeek` with `weekCard` from invented reads). The daily values, bar heights and last week's average are in the page but not in the recorded HTML. The section heading stays.
- `app/api/quota-gate.test.ts` (1 guard + 7 cases, G8). Reads every `app/api/**/route.ts` for the functions that reach the /v1 quota (`ctx.v1`, `fetchQuota`/`fetchAlliance`/`fetchPlayer`, `executeSnapshot`, `runSnapshot`, `runTick`, `runDailyRead`, `retryDailyRead`, `runSquadsBatch`, `squadsBatch`, `scheduleSquadsBatch`, `quotaReport`, `lookupAlliance`).
  - Guard: every matching file is in `GATED` or `EXCLUDED`, and every `GATED` entry still matches.
  - `GATED`: `admin/squads-read`, `daily-read/retry`, `quota`, `quota/check`, `snapshot`, `squads-read`, `tick`. Each is called with no secret and no PIN. Then the work queued with `after` is run. Each answers 401 or 403, and a proxy over `ctx.v1` counts zero calls to any method.
  - `EXCLUDED`: `alliances/[unionId]/details` ("Get today's details", D133). It is public on purpose, behind the same-origin check, an IP limit and a daily cap, and it has its own route test.
- `app/api/squads-read/route.test.ts` (1 test, G9). With the cron secret on Wednesday 22:30 ST, before the day's 23:30 read, the route answers 204 over `noQueryDb`, so it makes no query (D141).

### Deliberate breaks (each made the named test fail, then was restored with `git checkout`)

| Test | Break in app code | Failure |
|---|---|---|
| G1 no-store | `proxy.ts` regex `^\/w(\/\|$)` (dropped `api\/`) | `/api/w/lnk/members/101: expected null to be 'private, no-store'` |
| G1 no-store | `proxy.ts` sets no-store on every response (`if (true)`) | `/: expected 'private, no-store' to be null` |
| G2 two nonces | `const nonce = btoa("lantern-keep-fixed-nonce")` | the two nonces were equal |
| G2 script-src nonce | `x-nonce` set to a second `randomUUID()` | the CSP nonce differed from the page's |
| G2 deny-all | regex `(?:api\|ingest)` (dropped `img`) | `/img/avatar/101` got the page CSP |
| G5 own card | route reads `Number(uid) + 1` | `expected 404 to be 200` (both 200 tests) |
| G5 no avatar | route answers `{ ...card, avatarUrl: "https://avatar.example.test/a.png" }` | `expected [ 'avatarUrl' ] to deeply equal []` |
| G5 other alliance | `memberCard` falls back to `view.members[0]` when the uid is not found | `[200, { card: { uid: 101 … } }]` instead of `[404, not_member]` |
| G5 no-store | route answers `Response.json({ card })` without `NO_STORE` | `expected null to be 'private, no-store'` |
| G6 Members list | `ph-no-capture` removed from the table's donations cell (`MembersList.tsx`) | recorded HTML contains `6.54K` |
| G6 Members list | `ph-no-capture` removed from the card row's donations (`MemberListRow.tsx`) | recorded HTML contains `6.54K` |
| G6 Members list | `ph-no-capture` removed from the status line (`MemberListRow.tsx`) | recorded HTML contains `No daily quests on Wed, Nov 18` |
| G6 Me page | `ph-no-capture` removed from the week's `<div>` (`MeSections.tsx`) | recorded HTML contains `height:` |
| G8 gate | `/api/quota` auth check removed | `expected [ 401, 403 ] to include 200` |
| G8 gate | `/api/quota/check` auth check removed | `… to include 200` |
| G8 gate | `/api/daily-read/retry` auth check removed | `… to include 409` |
| G8 zero /v1 | `/api/quota` calls `ctx.v1.fetchQuota()` before `authorize` (still 401) | `expected [ 'fetchQuota' ] to deeply equal []` |
| G8 guard | a new `app/api/zz-probe/route.ts` using `ctx.v1` (deleted afterwards) | `expected [ 'zz-probe/route.ts' ] to deeply equal []` |
| G9 | `/api/squads-read` skips its `squadsMayRun` gate | `expected 500 to be 204` (the query threw) |

## Decisions
- G1 and G2 are unit tests of `proxy()`, not of Next's matcher. The `config.matcher` exclusions (`_next/static`, prefetch headers) are not exercised here.
- The deny-all CSP test covers `/api` and `/img`, as D11 and D22 state. D77 states the same for `/ingest`, but the brief listed only `/api` and `/img`, so `/ingest` is not covered (see Open issues).
- G5's private-key check is a check on keys. D71 allows the card to show the map position and last online as formatted words, so the test does not ban those values; it bans the raw keys and the photo URL.
- G8 counts calls on every method of `ctx.v1` through a `Proxy`. `fakeV1().calls` counts only `fetchAlliance`. Every quota path goes through `ctx.v1`, including the workspace keys (D124), which pass the key as an argument.
- G8 asserts 401 or 403, as the brief asked. Today every gated route answers 401 `unauthorized`. The failure count is cleared before each case, so the IP limit's 429 never shows up.

## Deviations
- G5's 404 for another alliance's uid overlaps with `cross-workspace.test.ts`, which sends Bravo's uid 202 to this route and expects a 4xx that is not an early refusal. The new test asserts the exact `404 not_member`. Both were kept because the brief asked for it on this route.
- The two G6 tests are in one new file, `replay-masking.test.ts`, so they share the `recorded()` helper. The UI test cannot import `lib/repo` (lint zone, D71), so `OwnDay` is derived from `weekCard`'s parameter type.

## Verified
- `pnpm check` passes: prettier, eslint, tsc, vitest, the schema drift check (no schema change) and i18n (17 languages up to date).
- Full `vitest run` after that: 302 files passed, 2 skipped; 1571 tests passed, 4 skipped. That is 19 new test cases.
- One extra full run showed `1 failed | 1570 passed`. Four other full runs, including the one inside `pnpm check`, passed, and the failure did not come back, so I could not name the test. All the new files passed in every run and on their own.
- Each new test failed against a deliberately broken build (table above). The app code was restored each time, and `git status` shows only the new test files and this handoff.
- No upstream, Discord or PostHog call was made; all are stubs. Only invented names and values are used.

## Open issues
- One full-suite run had one failing test that did not reproduce in four more runs. It may be one of the load-sensitive tests the audit lists (PGlite timeouts, `setTimeout(0)` flushes). Follow-up: run the suite with `--reporter=verbose` in CI when it happens again, to get the name.
- `/ingest` deny-all CSP (D77) has no test. It would be one more path in the G2 deny-all test.
- The proxy's trailing-slash redirect (`/w/lnk/` → 308) returns before the no-store line, so the redirect carries no `Cache-Control`. It carries only a `Location` and no workspace data, so this is not a leak. Noted only.

## Next
- Model/effort: keep.
- What the owner must do first: merge, after PR #600 if the orchestrator prefers the e2e header checks to land first. The two PRs touch different files.
- Plan change: none (the test-audit batches have no prompt in `docs/SESSION_PLAYBOOK.md`).
- Analytics plan: no change. Tests only, no event added, changed or removed.

<adjustments>
- Batch 6 of the audit ("`ph-no-capture` render checks") is done for the Members list and the Me page. `recorded()` in `app/(private)/_ui/replay-masking.test.ts` can check other private views.
- A new quota route under `app/api` must be added to `GATED` (or to `EXCLUDED` with its reason) in `app/api/quota-gate.test.ts`, or the guard fails.
- The audit's harness proposal ("a quota-spending route under `app/api` passes its walker test") can now point at `app/api/quota-gate.test.ts`.
</adjustments>

PR: (added by the orchestrator)
