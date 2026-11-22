# test-477 — committed e2e tests (Playwright) for critical flows and multi-alliance isolation, run in CI

Issue #477, owner-approved 2026-11-21. Decision: D150.

## Built

- **Runner:** `@playwright/test` 1.65.0 (exact, dev dependency, released 2026-11-05, no install scripts). `pnpm test:e2e` = `playwright test`.
- **`playwright.config.ts`:** two projects, `phone` (390 × 844, touch) and `wide` (1280 × 800), Chromium. Two web servers: the db:local bridge (`scripts/db-local-bridge.mjs`, port 54377) and `next build && next start` on 127.0.0.1:3477, reached as `http://localhost:3477`. `E2E_NO_BUILD=1` skips the build. The server's fetch cache (`.next/cache/fetch-cache`) is emptied before `next start`. Traces and screenshots are kept on failure.
- **`e2e/env.ts`:** ports, `E2E_DATABASE_URL` (default `postgres://lap:lap@127.0.0.1:54320/lap_e2e`), and the server's settings: every key of `.env.example` set (empty when unused), so `.env.local` never reaches the e2e server; upstream, Discord and PostHog at `127.0.0.1:9`.
- **`e2e/global-setup.ts`:** drops and recreates the e2e database (local host and a name containing `e2e` only), migrates through `scripts/db-local.mjs migrate`, loads the seed with `psql`, empties the outbound log. **`e2e/global-teardown.ts`** fails the run if the outbound log names any host.
- **`e2e/no-network.mjs`:** `--import`ed into `next start`; refuses every DNS lookup but `localhost` and logs the host.
- **`e2e/fixtures/seed.ts`:** the invented seed, dated from the run day in server time: Lantern Keep (`lnk`, 12 names, one leaver and one joiner in the last event) and Moss Hollow (`msh`, 8 names) with a workspace each, three filler alliances, 14 daily rosters, yesterday's ranks board and tracked set, two past Saturday events, Raid prep on the next Saturday on or after today (4 Shield marks, 2 wall-only), this week's cheese entry, an officer's and a member's session per workspace. Per-alliance sentinels for x, y, last_online_at (on a 29 February), joined_at, and an `.invalid` avatar host. The global setup exports the seeding moment as `E2E_NOW`; the specs date from it (`seededAt()`).
- **`e2e/fixtures/test.ts`:** the suite's `test`: per test, a browser guard (any request to another host is aborted and fails the test) and a privacy scan of every HTML, JSON and RSC answer (`leaksIn`, D71's allowances); `signIn()` adds the `__Host-lap_ws.<slug>` cookie; `hydrated()` waits for the page's scripts before a tap.
- **Specs (16 tests, 36 runs across the two projects):**
  - `public.spec.ts`: home ledger, alliance list, player page, event ledger with the member-change mark and its split; no sideways scroll.
  - `desk.spec.ts`: Home; Members card open and close, still closed 1.5 s later with no "Loading…" and no `?m=` (#573); Roll call mark kept after reload, then cleared so the test can repeat; Raid prep "To mark 7" and "4 of 11 marked" (#590 F1).
  - `board.spec.ts`: Me page for the member with an approved link, own data only; a member's session sent from the desk to the board.
  - `isolation.spec.ts` (phone only): each workspace's officer and member, with the token in its own cookie, in the other workspace's cookie name and in the pre-D131 cookie, get `401 signed_out` from the other workspace's member card, activity, read status and roll call write, and, with each of the three cookies in the browser, only the sign-in screen on 5 desk and board pages; a's member gets `401` from a's own desk APIs; a's officer gets `404` for b's member card and `400 not_member` marking b's member through a's own workspace; a sweep of 8 public pages, 9 desk pages and APIs and 2 board pages for leaks and blocked JSON keys; the positive control that a's own member card does carry a's coordinate and "Feb 29".
- **CI:** `.github/workflows/e2e.yml`, its own workflow (the `check` job and `ci.yml` are unchanged): `pull_request` with a path filter on what the app runs, and `workflow_dispatch`; Postgres 18.6 service container (digest-pinned, password auth); pnpm store cache (setup-node) and Playwright browser cache keyed by its version; `playwright install --with-deps --only-shell chromium`; `next build` as its own step, then `E2E_NO_BUILD=1 pnpm test:e2e`; report and traces uploaded on failure for 7 days. No secrets.
- **Docs:** D150 and its index line, CONTRIBUTING ("End-to-end tests", the scripts table, the CI bullet). `eslint.config.mjs`: `e2e/**/*.mjs` gets the Node globals; `test-results/` and `playwright-report/` are ignored by eslint and git.

## Decisions

- **Sessions as rows plus a cookie**, as the QA sessions did; no Discord stub. The cookie is added with `domain` + `path` + `secure`, because Playwright drops Secure from a cookie given an http `url`, and a `__Host-` cookie without Secure is refused.
- **`localhost`, not `127.0.0.1`,** as the base URL: browsers keep Secure cookies on `localhost` over http, and `next start` checks a write's Origin against `localhost`.
- **Cross-workspace pages answer 200 with the sign-in screen**, not 401/404 (D99: a page sends a signed-out visitor to sign in). The tests assert the sign-in button and that no name of the other alliance or its members is in the HTML. APIs answer 401.
- **D71 in the privacy scan:** the own desk may carry its own alliance's `joined_at` (the Members "Copy for spreadsheet" row in the page payload carries every member's joined date; D71 keeps only x, y, online and last_online_at out of copies), and only the officer's member card API may carry its own map position and last online. Everything else, and anything of the other alliance, fails.
- **Every flow at both widths** (390 and 1280), not only one at 1280: the suite takes about 10 s of test time locally, and the card is a sheet below 1024 and a pane above it, both worth covering. Isolation runs once (`phone`).
- **Writes kept apart:** the only write is the roll call mark; each project marks its own member on the cheese roll call, and the first mark's insert is `onConflictDoNothing`, so two workers can mark at once.
- **Path filter instead of every PR:** a PR that changes only docs or workflows other than `e2e.yml` starts no job (Actions minutes).

## Deviations

- **No nightly run on `dev`** (the issue's proposal): the brief asks for `pull_request` only, and the owner is measuring Actions minutes (2026-11-19).
- **No WebKit project.** Its browser and its apt libraries add an estimated 1–2 minutes per run, and it could not be checked here (the download for 1.65 was not finished in time). Follow-up below.
- **The issue's other flows** (sign-in and sign-out, Calendar add/delete/Undo, notices with translate and publish stubs, feature switches, tracker key, export ZIP) are not in this first suite; the brief named a smaller set.

## Verified

- **Local**, Apple silicon, Node 26.5.0, a Postgres 18 cluster on 127.0.0.1:55477, Playwright's Chromium headless shell:
  - final suite with a build: 36 passed in 42 s wall (the build was warm; a cold `next build` took 74 s);
  - `--repeat-each=3` without a build: 108 passed in 53 s;
  - test phase alone: 10–20 s with 3 workers.
- **The guards fail a test**, checked with a throwaway spec (deleted): a navigation to `https://example.com` failed with "requests that left this machine: example.com"; an answer carrying `713579` failed with "a.x in …/robots.txt". Probed `leaksIn` directly: `713,579`, `713 579`, `2088`, `Mon, Feb 29`, `29 de fev.` are caught; `x713579`, `12713579`, `a2088b` are not; a's own card may carry a's coordinate but not b's.
- **`e2e/no-network.mjs`** under Node 26: `fetch`, `https.get` and `new WebSocket` to outside hosts failed with ENOTFOUND and were logged; `127.0.0.1:9` needs no lookup.
- **The privacy scan found one real path on its first run:** the Members page payload carries every member's `joined_at` in the "Copy for spreadsheet" row. D71 allows it (copies leave out only x, y, online and last_online_at), so it is an allowance in `allowedAt`, not a fix.
- **QA panel** (one agent): runs 1–3 passed 31/31 (with build 16 s, then 12 s and 10 s); `--repeat-each=3` gave 89 passed, 4 failed: the roll call test could not run twice on one seed (fixed: it clears its mark at the end; the repeat now passes 108/108). Three app mutations, each rebuilt and reverted (`git diff -- app lib` empty after):
  - a wall-only mark counted as marked in `RaidPrepMarks.tsx` → "Raid prep: To mark" failed on both projects (`To mark 7` not found);
  - `mapX` added to the Members spreadsheet row in `lib/private/members-sheet.ts` → the Members test failed ("a.x in …/w/lnk/members") and the desk sweep failed;
  - the `other_workspace` refusal removed from `lib/private/access.ts` → the cross-workspace API tests failed (200 instead of 401). QA noted that the page test did not catch it for a member's forged cookie name (fixed: the page tests now run with all three cookie names).
- **Adversarial review panel** (one agent), every MUST fixed:
  - MUST: the temporary `channel: "chrome"` line in the config (already removed before the review finished);
  - MUST: Raid prep on this week's Saturday fails the Me page test on Sundays (the page lists roll calls from today on) → Raid prep now sits on the next Saturday on or after today;
  - SHOULD, fixed: dates printed without a year (last online is now 29 February, matched as printed), coordinates with separators, camelCase JSON keys, a member's session on its own desk APIs, forged cookie names on pages, the specs' dates taken from the seeding moment (`E2E_NOW`), the roll call test repeatable, `next build` as its own CI step, path filter additions (`postcss.config.mjs`, `tsconfig.json`, `pnpm-workspace.yaml`, `.nvmrc`), word boundaries in the patterns, the teardown after a failed setup, `psql --version` in CI;
  - SHOULD, not done (Open issues): the other 34 `/api/w/[slug]` routes and the data export in the sweeps; the midnight edge of the server's own clock;
  - NICE, noted: `waitForTimeout(1500)` is the #573 negative wait on purpose; `networkidle` is the hydration signal; an external IP address needs no lookup and is not seen by the server guard (none is configured); `next build` downloads Google Fonts (now in D150).
- No invented name in the e2e files matches a name in `fixtures/` (only short tag substrings such as "TEST").
- `pnpm check` passes (see the final report).

## Open issues

- **WebKit at 390 px** for the member card (#573 was measured in both engines; Safari's history limit is WebKit-only): add a `phone-webkit` project for `desk.spec.ts` once the first CI runs show the time it costs. Check first that WebKit sends the Secure `__Host-` cookie to `http://localhost`.
- **CI runtime is estimated, not measured:** about 5–7 minutes (setup and `pnpm install` about 1 min, `playwright install --with-deps` about 1–1.5 min with apt every run, `next build` about 2–3 min on a 4-core runner, tests about 0.5–1 min). That is 5–7 Actions minutes per PR that changes app code, none for docs-only PRs. The first PR run gives the real number.
- **The e2e job is not a required check.** A required check with a path filter would block docs-only PRs; making it required needs a skip job that reports the same name.
- **Cross-workspace coverage is 3 GET routes and 1 POST** of 38 `/api/w/[slug]` route files, and the data export (D71's export rule) is not swept. A table-driven test over every route file is the next step.
- **Server midnight:** the specs date from the seeding moment, but the server's own "today" moves if a run crosses 02:00 UTC (server midnight); the test phase is under a minute, so it is rare.
- **The "Feb 29" pattern** could match a real date on pages in late February to April 2028 (and 2032); if a run then fails on "last_online_at (as printed)" with no leak, pick another sentinel date in `e2e/fixtures/seed.ts`.

## Next

- Model/effort: keep.
- What the owner must do first: nothing. After the merge, look at the first `e2e` run in Actions for its time.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A desk change can now be checked with `pnpm test:e2e` (cluster running, `pnpm exec playwright install chromium` once). Add a flow to `e2e/` with the `test` from `e2e/fixtures/test.ts`, which already fails on outbound requests and on private roster fields.
- A new private page that shows a roster field must be added to `allowedAt` in `e2e/fixtures/test.ts` with the D71 reason, or the scan fails it.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/600
