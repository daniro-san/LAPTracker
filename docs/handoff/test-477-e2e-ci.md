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
- **Specs (16 tests; 36 runs on `phone` and `wide`, 40 with `iphone`):**
  - `public.spec.ts`: home ledger, alliance list, player page, event ledger with the member-change mark and its split; no sideways scroll at 360 and 1280.
  - `desk.spec.ts`: Home; Members card open and close, still closed 1.5 s later with no "Loading…" and no `?m=` (#573); Roll call mark kept after reload, then cleared; Raid prep "To mark 7" and "4 of 11 marked" (#590 F1).
  - `board.spec.ts`: the Me page for a member with an approved link; a member's session sent from the desk to the board.
  - `isolation.spec.ts` (phone only): cross-workspace APIs with three cookie names → 401; cross-workspace pages with three cookie names, officer and member → sign-in screen only; a member on its own desk APIs → 401; the other alliance's member through the own workspace → 404 / `400 not_member`; sweeps of 8 public pages, 9 desk pages and APIs, 2 board pages; positive controls on the officer's card (x, y, "Feb 29") and the Members page (joined year).
- **CI (`.github/workflows/e2e.yml`):** every `pull_request` (no `paths` filter), a `changes` step that diffs against the PR base and skips install, build and tests when no app path changed; daily `schedule` at 03:17 UTC checking out `dev`, with WebKit; `workflow_dispatch`; `concurrency` per ref; Postgres 18.6 service container; caches for the pnpm store, the Playwright browsers and `.next/cache`; `next build` as its own step; report, traces and the outbound log uploaded on failure. `ci.yml` is unchanged.
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

## Deviations

- **The phone project is 360 px** (was 390), per CLAUDE.md "designed at 360"; the brief said 390.
- **The daily schedule does not run yet:** GitHub reads a schedule from the default branch, so it starts after the next release copies the workflow to `main`.
- **The issue's other flows** are not in this PR (Next).

## Verified

- **CI, first run on PR #600 (before this change):** 132 s in all; `next build` 51 s, the tests 37 s. About 2.2 Actions minutes per PR that changes app code. With the `changes` gate, a docs-only PR runs the service container, checkout and diff only (not measured; under a minute).
- **Local**, Apple silicon, Node 26.5.0, Postgres 18 on 127.0.0.1:55477, Playwright Chromium headless shell and WebKit 2388:
  - `E2E_WEBKIT=1 pnpm test:e2e` (with a build): 40 passed in 21 s wall (warm build);
  - `E2E_WEBKIT=1 E2E_NO_BUILD=1 pnpm test:e2e --repeat-each=3`: 120 passed in 31 s;
  - without `E2E_WEBKIT`: 36 tests listed; no `e2e-outbound.log` written in any run.
- **WebKit:** the desk flows pass on the iPhone 15 profile at 360 px; WebKit sends the Secure `__Host-` cookie to `http://localhost`.
- **`leaksIn` probes:** `[713579,713580]` → `a.x`, `a.y`; `a,2088-02-29` → `a.last_online_at`; `name,2086-05-21` and `…\t2086-05-21\t…` → `a.joined_at`; `{"online":true}` and `\"online\":false` → `online (as a key)`; `joinedAt`, `avatarUrl` keys caught; `x713579`, `12713579`, `a2088b`, "Online now" not flagged; on the own card, `online` and a's x are allowed, on the board they are not.
- **Earlier panel (first version):** QA ran 3 stable runs and caught 3 deliberate app breaks (Raid prep wall mark, x in the spreadsheet copy, the `other_workspace` refusal removed); the adversarial review's two MUSTs were fixed then. Details are in the PR's first commits.
- `pnpm check` passes.

## Open issues

- **Cross-workspace coverage is 3 GET routes and 1 POST** of 38 `/api/w/[slug]` route files, and the data export (D71's export rule) is not swept.
- **Server midnight:** the specs date from the seeding moment, but the server's own "today" moves if a run crosses 02:00 UTC; the test phase is under a minute.
- **The "Feb 29" pattern** could match a real date on pages from late February to April 2028 (and 2032); if a run then fails on "last_online_at (as printed)" with no leak, pick another sentinel date in `e2e/fixtures/seed.ts`.
- **`.next/cache` gains are not measured:** the Turbopack production build keeps little in it; the first runs after this change show whether the cache step pays for itself.

## Next

Follow-ups for #477:

- sign-in and sign-out (officer and member, the board vs the desk);
- Calendar add, delete, then Undo;
- a notice: write, translate (stub), publish (stub webhook);
- feature switches (#450): a turned-off tab is hidden and refuses;
- the tracker key: save and test (stub), the key never in any answer;
- the export ZIP (#441): private fields absent;
- the other 34 `/api/w/[slug]` routes in the cross-workspace sweep, table-driven over the route files;
- the owner adds `e2e` to the `dev` ruleset; after the next release, check that the daily run (03:17 UTC) starts and passes with WebKit.

What was missing from the task prompt? Whether the phone width is 390 (the brief) or 360 (CLAUDE.md); the review settled it as 360.

https://github.com/daniro-san/LAPTracker/pull/600
