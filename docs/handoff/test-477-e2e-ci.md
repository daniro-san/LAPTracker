# test-477 — committed e2e tests (Playwright) for critical flows and multi-alliance isolation, run in CI

Issue #477, owner-approved 2026-11-21. Decision: D150. This PR is part of #477; the deferred flows are in Next.

## Built

- **Runner:** `@playwright/test` 1.65.0 (exact, dev dependency, released 2026-11-05, no install scripts). `pnpm test:e2e` = `playwright test`.
- **`playwright.config.ts`:**
  - projects `phone` (360 × 780, touch) and `wide` (1280 × 800) on Chromium; `iphone` (iPhone 15 profile, WebKit, 360 px, desk spec only) when `E2E_WEBKIT=1`;
  - two web servers: the db:local bridge (port 54377) and `next build && next start` on 127.0.0.1:3477, reached as `http://localhost:3477`; `E2E_NO_BUILD=1` (exactly `1`) skips the build; the fetch cache is emptied before `next start`;
  - the runner (not the workers) deletes `e2e-outbound.log` before the servers start;
  - `retries: 0`; traces and screenshots on failure.
- **`e2e/env.ts`:** ports, `E2E_DATABASE_URL` (default `postgres://lap:lap@127.0.0.1:54320/lap_e2e`), the outbound log path, and the server's settings: every key of `.env.example` the app reads, empty when unused; upstream, Discord and PostHog at `127.0.0.1:9`.
- **`e2e/global-setup.ts`:** first the name check (contains `e2e`) and `scripts/db-local.mjs check` (local host for every reader of the URL, no `host`/`hostaddr`/`service` parameter, bridge listening); then drop, create, migrate, seed. It sets `E2E_NOW`. It no longer touches the outbound log.
- **`e2e/no-network.mjs`:** in `next start`, refuses every name lookup but localhost and every socket to a non-loopback IP address (`net.Socket.prototype.connect`), and appends each host to `e2e-outbound.log`, making the file on the first refusal. **`e2e/global-teardown.ts`** fails the run if the file holds a host.
- **`e2e/fixtures/seed.ts`:** the invented seed (see D150): two workspaces, three filler alliances, 14 daily rosters, yesterday's board and tracked set, two past events with one leaver and one joiner, Raid prep on the next Saturday on or after today, this week's cheese entry, officer and member sessions. Sentinels for x, y, last_online_at (29 February), joined_at and the photo host.
- **`e2e/fixtures/test.ts`:** the suite's `test`. Per test: the browser guard; the privacy scan of every HTML, JSON and RSC answer (sentinels after a comma or a JSON escape too, the private fields' names as keys, the other workspace's member names; an unreadable answer fails, a redirect is skipped). `signIn()` takes an optional cookie name (forged cookies). `hydrated()` waits for the page's scripts.
- **Specs (28 tests; 39 runs on `phone` and `wide`, 44 with `iphone`; the Raid prep mark runs on `phone` only).** Every test asserts the rendered screen: the heading, the flow's key values in their row, card or region, computed from the seed's rows (`eventTotals`, `memberChange`, `endOf`, `rosterOf`, `boardOf`, `weekLine`, `DAILY`) and written with `compactLarge`, no error screen; after an action, the screen changes, survives a reload or shows on the page the flow names, and is put back with an on-screen check. See the table in the PR body and D150 "What a test checks".
  - `public.spec.ts` (4): the ledger on `/` and `/events/2` (rank, End might and kills, ▼/▲ with percentages, members joined/left), the alliance list (rank, might, kills), a player page (might, kills, level, "As of"), the member-change split (4 lines), no sideways scroll.
  - `desk.spec.ts` (5): Home (D146 week line, top donors, the officer's activity); Members (count, rank and might per line, the joiner's "first seen", no leaver; card might, kills, 7-day averages, yesterday's bar, might change; map position hidden until "Show map position"; closed after 1.5 s of page time and after a reload); Roll call (list counts, mark at once, after reload, in the list, then cleared the same way); Raid prep counts (#590 F1); Raid prep Shield mark (phone only, its own week).
  - `board.spec.ts` (2): the Me page (Raid prep mark, linked name, own might and kills with their change, this and last week's averages, no other name, `no-store`); a member sent from the desk to the board (heading, the next 7 days from today).
  - `isolation.spec.ts` (17, phone only): cross-workspace APIs with three cookie names → 401; cross-workspace pages with three cookie names, officer and member → the sign-in screen (heading, words, button) and none of b's tag, name, members or mights; a member on its own desk APIs → 401; b's member through a's workspace → 404 / `400 not_member`, then a's Raid prep shows its own roster and no b names; three sweeps that first prove the real page (not the sign-in heading; a marker name) and `Cache-Control: private, no-store` on `/w` and `/api/w`; positive controls on real answers (card x, y, "Feb 29"; Members joined year) and on synthetic ones (`online` as a key; sentinels after a comma).
- **Seed:** nine weekly cheese entries (`cheeseOf(project, repeat)`, Lv.1–9) and three later Raid prep weeks (`raidOf(repeat)`), so a test that writes never shares a row with another run; the expected-value helpers above.
- **Fixtures:** `sees()` (rendered text, any white space, any case), `big()` (`compactLarge`), `noError()` (the titles in `lib/copy-errors.ts`), `hydrated(locator)` (React's props key on the element); the global setup refuses to start within 10 minutes of 02:00 UTC.
- **CI (`.github/workflows/e2e.yml`):** `pull_request` into `dev` only; a `changes` step (`git diff --no-renames`, also in `ci.yml`) that skips install, build and tests when no app path changed; WebKit on every run that is not a pull request; the release dispatch from `release-prepare.yml` (`gh workflow run e2e.yml --ref dev`, after `ci`) and a daily cron at 03:17 UTC checking out `dev`; caches restored only on pull requests (`actions/cache/restore`) and saved only from the other runs (`actions/cache/save`, keyed by run id, both browsers installed, `.next/cache` saved right after the build); `concurrency` per ref; Postgres 18.6 service container; report, traces and the outbound log uploaded on failure.
- **Docs:** D150 and its index line; CONTRIBUTING ("End-to-end tests", the scripts table, the CI bullet). `.gitignore` and `eslint.config.mjs` ignore `test-results/`, `playwright-report/`; `.gitignore` also `e2e-outbound.log`.

## Decisions

- **Sessions as rows plus a cookie**, as the QA sessions did; no Discord stub. The cookie is added with `domain` + `path` + `secure`, because Playwright drops Secure from a cookie given an http `url`.
- **`localhost`, not `127.0.0.1`,** as the base URL: browsers keep Secure cookies on `localhost` over http, and `next start` checks a write's Origin against `localhost`.
- **Cross-workspace pages answer 200 with the sign-in screen**, not 401/404 (D99: a page sends a signed-out visitor to sign in). The tests assert the sign-in button and that no name of the other alliance or its members is in the HTML. APIs answer 401.
- **D71 in the privacy scan:** the own desk may carry its own `joined_at` (the Members "Copy for spreadsheet" row carries every member's joined date; D71 keeps only x, y, online and last_online_at out of copies); only the officer's member card API may carry its own map position, online and last online.
- **`online` has no sentinel value:** the upstream sends a boolean, and the seed keeps it one. Its key is checked on every answer instead, in JSON and in the escaped RSC payload. `x` and `y` keys are not checked (SVG props use them); their six-digit sentinels are.
- **The lookbehind is `(?<!(?<!\\)[\w.])`,** not the review's suggested `(?<![\w.]|\d,)`: the suggestion still misses the second value of `[713579,713580]`, and a plain `(?<![\w.])` missed the joined date after the `\t` of the tab-separated copy row (the new positive control failed on it). A digit-comma before a sentinel cannot come from a formatted number in this seed: every seeded might and kills figure is a multiple of 1,000.
- **The server guard refuses sockets to non-loopback IP addresses** by wrapping `net.Socket.prototype.connect`, which `net.connect`, `tls.connect`, `http`, `https`, `fetch` and WebSocket all use. Checked under Node 26.5.0 with 10 attempts (fetch by IP over http and https, fetch by name, `http.get`, `https.get`, `net.connect` two ways, `tls.connect`, `new Socket().connect`, WebSocket by IP): all refused and logged; a loopback socket still connects.
- **Owner decisions (persona panel, 2026-11-21), recorded in D150:** e2e is a required check with a `changes` gate; a flake that blocks a PR removes the required check until fixed, `retries: 0`; a daily run on `dev`; WebKit only in the daily run, moved to every PR if a WebKit-only bug reaches production.
- **The seed stays SQL text,** not `lib/schema` inserts (review finding on `seed.ts`): with e2e a required check, a renamed column now fails a required job. Stated in D150; not rewritten here.
- **Rendered text, not text content:** `sees()` matches `innerText`, because the ledger keeps the exact figure of every compact number in the DOM for "Exact numbers" (`267M267,000,000`); a user sees `267M`.
- **The sweep's "not the sign-in screen" check is its `<h1>Sign in</h1>`,** not the words "Sign in with Discord": every page's payload carries the sign-in copy in its dictionary, which made the first version fail on real pages.
- **The cross-workspace mark now targets a's Raid prep of this week** (read only), not a cheese roll call another test marks, so its on-screen check ("4 of 11 marked", no b names) cannot race.
- **Home's activity check is weaker on purpose:** other tests' marks land in the same feed, so it checks only that the newest line is the officer's; the week line carries the computed values.
- **Two "Members this week" and "Recent activity" regions at 1280** (main and rail): the tests take the first.


## Deviations

- **The phone project is 360 px** (was 390), per CLAUDE.md "designed at 360"; the brief said 390.
- **The daily schedule does not run yet:** GitHub reads a schedule from the default branch, so it starts after the next release copies the workflow to `main`.
- **The issue's other flows** are not in this PR (Next).

## Verified

- **CI, first run on PR #600 (before this change):** 132 s in all; `next build` 51 s, the tests 37 s. About 2.2 Actions minutes per PR that changes app code. With the `changes` gate, a docs-only PR runs the service container, checkout and diff only (not measured; under a minute).
- **Local, this round** (Apple silicon, Node 26.5.0, Postgres 18, Playwright Chromium headless shell and WebKit 2388):
  - `pnpm test:e2e` after deleting `.next` (cold build): 38 passed, 1 skipped, 34 s wall;
  - `E2E_WEBKIT=1 pnpm test:e2e` (build warm): 42 passed, 2 skipped, 22 s; without a build: 14 s;
  - `E2E_WEBKIT=1 E2E_NO_BUILD=1 pnpm test:e2e --repeat-each=3`: 126 passed, 6 skipped, 0 failed, 67 s;
  - what the rendered-screen round caught and fixed in the tests: the member list's figures sit outside the row's button at 1280 (a table); the roll call POST was cut off by a reload before it finished (now waited for); the Home activity feed is shared with the writing tests; two same-named regions at 1280.
- **WebKit:** the desk flows pass on the iPhone 15 profile at 360 px; WebKit sends the Secure `__Host-` cookie to `http://localhost`.
- **`leaksIn` probes:** `[713579,713580]` → `a.x`, `a.y`; `a,2088-02-29` → `a.last_online_at`; `name,2086-05-21` and `…\t2086-05-21\t…` → `a.joined_at`; `{"online":true}` and `\"online\":false` → `online (as a key)`; `joinedAt`, `avatarUrl` keys caught; `x713579`, `12713579`, `a2088b`, "Online now" not flagged; on the own card, `online` and a's x are allowed, on the board they are not.
- **Earlier panel (first version):** QA ran 3 stable runs and caught 3 deliberate app breaks (Raid prep wall mark, x in the spreadsheet copy, the `other_workspace` refusal removed); the adversarial review's two MUSTs were fixed then. Details are in the PR's first commits.
- `pnpm check` passes.

## Open issues

- **Cross-workspace coverage is 3 GET routes and 1 POST** of 38 `/api/w/[slug]` route files, and the data export (D71's export rule) is not swept.
- **Server midnight:** the global setup refuses to start within 10 minutes of 02:00 UTC, so a run (under a minute of tests) does not cross the server's day change; a run that starts at 01:49 UTC and is very slow still could.
- **The "Feb 29" pattern** could match a real date on pages from late February to April 2028 (and 2032); if a run then fails on "last_online_at (as printed)" with no leak, pick another sentinel date in `e2e/fixtures/seed.ts`.
- **`.next/cache` gains are not measured:** the Turbopack production build keeps little in it; the first runs after this change show whether the cache step pays for itself.

## Next

Follow-ups for #477 (later PRs):

- new flows: sign-out (its own seeded session), Follow-up, Calendar add/delete/Undo, notices (save, translate stub, publish), member facts, a feature switch (its own workspace or phone only), the export ZIP sweep (D71's export rule), compare, the live event page, viewer settings;
- the other 34 `/api/w/[slug]` routes in the cross-workspace sweep, table-driven over the route files;
- a realistic seed of about 95 invented members in Lantern Keep;
- unit tests for `proxy.ts` (the `no-store` header is now checked end to end only);
- the owner adds `e2e` to the `dev` ruleset; on the next release, check that the dispatched `e2e` run (with WebKit) passes on `dev`, and later that the cron starts once the workflow is on `main`.

What was missing from the task prompt? Whether the phone width is 390 (the brief) or 360 (CLAUDE.md); the review settled it as 360. Also which roster rows the "Recent activity" check may rely on while other tests write.

https://github.com/daniro-san/LAPTracker/pull/600
