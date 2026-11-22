# Review checklist

Read by `/code-review` and by `/pr-review` (through `.claude/pr-review.md`) on every change that touches `lib/` or `app/`, including `lib/private` and `app/(private)`. Review against the issue the PR closes, docs/decisions/ and docs/IMPLEMENTATION_PLAN.md, not against taste. Check correctness, privacy and regressions first. Skip findings about style only (formatting, naming taste, comment wording): prettier and eslint own those. Report only findings that affect correctness, privacy, the quota guarantees or stated requirements, as: file:line, what the plan or decision requires, what the code does, severity (blocker / should-fix / note), a one- or two-sentence fix. Put everything else under Notes.

## Freshness and deltas (plan §3.7)

- [ ] Can a snapshot be marked `complete` with any row whose `source_updated_at` is older than 20 min? Trace the `/v1` path, the internal fallback path and a re-run.
- [ ] Can a delta ever be displayed when either side is stale, or between a roster number and a board number?
- [ ] Does the AFTER run ever use a different alliance list than the event's copy (`events.alliance_ids`)?

## Quota and bounded work (plan §3.4, §4, Phase 6 "Logging guarantees")

- [ ] Is `MAX_UPSTREAM_CALLS` counted on every upstream call, retries and quota checks included?
- [ ] Does a run abort on `429` and retry only `502/503/504` (max 3)?
- [ ] Can the exception cap be bypassed by aggregated events?
- [ ] Is the run lock race-safe for one scheduler plus one human (a conditional update or unique constraint; read-then-write is not acceptable)?

## Source boundary (plan §3.5)

- [ ] Does any code path call the internal refresh endpoint, or send Origin/Referer/cookie headers to the site?
- [ ] Is `lib/sources/internal.ts` used for anything beyond the ranks board and the `live: true` roster fallback?

## Logger (plan Phase 6)

- [ ] Can a logger failure (DB down) abort or delay a run? Can the logger ever call itself?
- [ ] Does every `data` object pass through `lib/redact.ts`? Do log lines carry ids, counts and codes only, no names?

## Secrets (plan §12.2)

- [ ] Any place a key, PIN or secret could reach logs, the public webhook, a response body or git?
- [ ] `CRON_SECRET` and `EDIT_PIN` compared with `timingSafeEqual`; PIN failures rate-limited in Postgres; the global lockout never blocks the cron secret.

## Blocked roster keys (plan §12.1)

- [ ] No query in `lib/queries`, route, page, `run_logs` line or Discord message reads or returns `BLOCKED_ROSTER_KEYS` (`x`, `y`, `online`, `last_online_at`, `joined_at`, `daily_honor`, `daily_tech`, `avatar_url`, `active`; the list in `lib/queries/blocked-keys.ts` is the source of truth). They live only in `raw_json`; the exceptions are `lib/private`, for its own alliance's workspace (D71, D142), and D76: `daily_tech`, `daily_honor` and `active` as alliance aggregates on public pages and per member on `/admin` for the own alliance. A key leaves `BLOCKED_ROSTER_KEYS` only in a change that serves it on purpose and says so (D76).
- [ ] `lib/queries/blocked-keys.test.ts` still scans every read-model file, and the route test for `GET /api/events/[id]` runs `findBlockedKeys` on the real response body.
- [ ] Player pages expose only name, uid, alliance tag, power, kills, lv and event dates.

## Workspace privacy (D71, D75, D142; checklist in `.claude/rules/private.md`)

- [ ] `lib/private` is imported only where the `import-x/no-restricted-paths` zones in `eslint.config.mjs` allow (`app/(private)`, and `lib/push-tick.ts` → `push-roll-calls.ts` for counts only, D148).
- [ ] Every page or handler under `app/(private)/w/[slug]` and `app/(private)/api/w/[slug]` that returns a blocked key calls `requireWorkspace` first. The one member exception is D142: the member's own `daily_tech`, `daily_honor` and `active`, only on their own page `/w/[slug]/board/me`, behind `requireBoard` and an approved player link, rendered per request with `Cache-Control: private, no-store`.
- [ ] Every read is filtered to the workspace's own alliance (or the member's own uid); no query can return another alliance's or another member's private rows.
- [ ] No blocked key reaches a log line, `run_logs`, `app_errors`, a Discord message, an AI or translation request, an analytics event or property, or a shared cache (D143 caches hold public reads only; desk and private data never enter them). Analytics events and properties carry no member names (D115).
- [ ] Copies and exports leave out `x`, `y`, `online` and `last_online_at`. `avatar_url` is never returned at all.
- [ ] Session replay: text under `/w` and `/admin` is masked by the layout's `ph-mask`; per-member values such as bars also need `ph-no-capture` (issue 549, D142).
- [ ] Every route behind `requireWorkspace` answers a request without a usable session with `401 signed_out` (D99); errors are codes only.

## Performance, copy, analytics and people (CONTRIBUTING.md § Working rules, DESIGN.md § Validation)

- [ ] Does the change make the night read, Raid prep, member cards right after a read, or the status bar while a read runs any staler? Does a read of a table that grows forever take a window or an index (D149)?
- [ ] A cut or changed user-facing string that a decision quotes carries a dated amendment to that decision.
- [ ] Nothing ranks people, counts missing data against anyone, or acts on its own (D75).
- [ ] A PR sized S or n/a has no M trigger in its diff (CONTRIBUTING.md § Working rules, "When to run `/tlc-spec-lean`"): no new route or page, migration, new decision, private-field flow change, new external call or quota use, or flow across two or more screens.
- [ ] The PR's Analytics plan section matches the diff: every event or property added, changed or removed in the code is listed there and in `docs/analytics/tracking-plan.md`.

## Tests

- [ ] Tests that assert the wrong thing or pass vacuously (e.g. a privacy detector or scan with no positive control, a mock that makes the assertion trivially true).
- [ ] A change to `lib/compute.ts`, `lib/collector.ts`, `lib/budget.ts` or `lib/sources/*` ships with a test.
- [ ] Every new or changed test protects a named user flow, user action or stated rule, and none is on the fake-test list in CONTRIBUTING.md § Working rules, "Tests check real behaviour".
- [ ] E2E: a new or changed test asserts rendered values computed from the seed and, after an action, the changed screen, and again after a reload where the flow promises persistence; a status code or a request wait alone does not pass.
- [ ] No `new Date()`, `Date.now()`, `waitForTimeout` or real `setTimeout` in a test body; PGlite is opened once per file (`.claude/rules/tests.md`).
- [ ] A new route under `app/(private)/api/w/[slug]` passes `member-session.test.ts` with a `FIXTURES` entry, not an `EXCLUDED` one.

## Specs (`.specs/`, see `.specs/README.md`)

- [ ] A new or changed `Run`, `Proof` or `Build:` line in a `checks.md` runs only a `pnpm` command, a script in this repo or a local test. Flag anything else (network calls, reading `.env*`, writes outside the repo, deletes) as a blocker: `tlc-spec-lean`'s scripts run these lines through a shell.
- [ ] Nothing under `.specs/` holds a real name, a private roster field, real player data, a secret or a webhook.
