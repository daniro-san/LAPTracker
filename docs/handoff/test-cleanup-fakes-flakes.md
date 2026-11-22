# test: fake and weak tests out, order-dependent and wall-clock tests fixed (test audit, batch 5)

## Built

Fake and weak tests (audit table rows 1–21). Each change was checked against the code at origin/dev 7154fa5d. "Break" is the deliberate code change that makes the test fail; each was undone after the run.

| # | file: test | Action | Reason | Break that proves it |
|---|---|---|---|---|
| 1 | `lib/run-notify-turnout.test.ts`: all 3 tests | rewritten | F1: `./queries` and `./event-image` were mocked, and the test asserted that `eventImage` got the lists the mock returned. Now PGlite with a seeded Start and End, the real queries and the real picture; it asserts the public message text. | Flag check removed in `endTurnout`: "has no turnout line while the war-turnout flag is off (D91)" fails. `g > 0` → `g >= 0` in `killsTurnout`: the other 2 tests fail. |
| 2 | `lib/sources/v1-options.test.ts`: "uses a call's own timeout and retry count…" | rewritten as 2 tests | F1: it asserted the `AbortSignal.timeout` spy got the 12,000 the test passed. Now a fetch that hangs until aborted ends at the call's own 50 ms. | `timeoutMs: TIMEOUT_MS` (ignore the option): the timeout test fails at 10 s. `maxRetries: MAX_RETRIES`: the retry test fails. |
| 3 | `lib/private/notice-rules.test.ts`: "counts what a reader sees…" | fixed (line deleted, renamed) | F5: `NOTICE_LIMIT === 1000`. The 1,000 edge stays covered by `notice-formats.test.ts`. | `NOTICE_LIMIT = 1001`: `notice-formats.test.ts` "never splits an emoji at the cut" fails. |
| 4 | `lib/private/roll-call-rules.test.ts`: "fills the rest per kind…" | rewritten ("offers each kind's rest button…") | F5/F4: the `REST` table. Raid's rest had no other test, so it now asserts the rest button each kind shows (`restWords`). | `raid: "no"` in `REST`: fails. |
| 5 | `lib/private/roll-call-rules.test.ts`: "offers Raid Shield, Undead Siege and Cheese Trap by hand…" | deleted | F5: the `ADDED_KINDS` constant. Covered by `roll-call/route.test.ts` "refuses a new plunder" and "adds a Cheese Trap by hand". | `"plunder"` added to `ADDED_KINDS`: "refuses a new plunder (2026-11-17)" fails. |
| 6 | `lib/private/calendar.test.ts`: "…theme_exists…" (last line) | fixed (line deleted) | F5: `DUEL_DAYS[0]`, `DUEL_DAYS[6]`, a fixed game table. No other test reads it. | none (constant only) |
| 7 | `lib/private/members.test.ts`: "finds who gained no kills…" | fixed (line deleted) | F5: `KVK_REASON_ON === false`. The same test's `reasons` equal to `[]` already holds the switch's effect. | `KVK_REASON_ON = true`: the test fails. |
| 8 | `lib/ai/groq.test.ts`: "sends the key, the first model, temperature 0.2…" | fixed | F5: `TEMPERATURE === 0.2`. The request body is now checked against the literal 0.2 (D81). | `TEMPERATURE = 0.3`: fails. |
| 9 | `lib/lookup.test.ts`: "makes one read for two presses…" | fixed (line deleted) | F5: arithmetic on two constants. The options sent (`maxRetries: 0`, the 10 s timeout) stay checked; row 2 proves the adapter honours them. | none for the deleted line |
| 10 | `lib/collector-sample.test.ts`: "closes a sample partial at 25 s…" | fixed (line deleted) | F5: compared two deadline constants. | none (constant only) |
| 11 | `lib/sources/v1.test.ts`: "parses every recorded /v1 body…" | fixed | F5: `files.length === 27` → `> 0`, the scan guard. | none (guard) |
| 12 | `next.config.test.ts`: "ship the OCR…" | fixed | F5: `readers` length 3 → `> 0`, the scan guard. | none (guard) |
| 13 | `lib/copy.test.ts`: "blank mode keeps length…" | fixed (line deleted) | F5: `copy.ledger.might === "Might"`. | none (constant only) |
| 14 | `scripts/seed.test.ts`: both tests | deleted (file) | Low value: it checks `--with-states`, a dev-only flag of `pnpm db:seed` for local screens. No visitor, officer or member flow uses it; the e2e suite has its own seed (`e2e/fixtures/seed.ts`). It also asserted on the wall clock. No other test covers the flag. | — |
| 15 | `lib/quota-report.test.ts`: both tests | fixed | Cost and W: PGlite opened in `beforeEach`; `posts[0]?.content` could be another post or none. Now `beforeAll` + `truncateAll`, and each test first asserts exactly one admin post. | `might: true` (ignore the 7-read rule): "leaves the line out while the alliance has fewer than 7 daily reads" fails. |
| 16 | `app/api/tick/route.test.ts`: "answers by 115 s…" | rewritten (assertions added) | W: it asserted only status 200. It now also asserts the answer's phase and status and that the snapshot row is closed (partial: the 116 s used is past the run's deadline too). | `Promise.race([notified])` (no cap) in `notifyWithinCap`: fails at 10 s. |
| 17 | `lib/ai/groq.test.ts`: "carry the do-not-translate list…", "send a weekly Duel notice…" (renamed from "translate weekdays, headings…"), "put a term's own name…"; `notices/draft/route.test.ts`: "gives Translate the board's room…" | fixed | F2: prompt style phrases ("Brazilian Portuguese", "no-break space", the five weekday/heading rules, "Words already written…", "do not translate word for word", "No machine-translated…"). Kept: the limit, the data-only rule, the do-not-translate list, "never add blame". | none (assertions removed) |
| 18 | `thanks/draft/route.test.ts`: "refuses while turned off or past the cap…" | fixed | W: `asked.length >= 3`. Now the exact three languages, each asked once; the one given back was already `used === [2]`. | `WRITING_LANGUAGES` with `"fr"` twice: fails (the old `>= 3` passed). |
| 19 | `app/_ui/format.test.ts`: "reads 4,29B in pt-BR…" (renamed) | fixed | F4: pt-BR, 999,950 and 60.1M repeat `lib/compact.test.ts`. Kept: ja, zh-CN and 999 (`compact`'s own under-1000 branch). | none (duplicates removed) |
| 20 | `activity`, `follow-up`, `pending`, `roll-call` `route.test.ts`: the tests named with 401 | fixed (401 lines and the unused `signedIn` options removed, renamed) | F4: `member-session.test.ts` walks all four routes with no session. | Session check disabled in `activity/route.ts`: `member-session.test.ts` "activity/route.ts refuses no session…" fails. |
| 21 | `app/(pages)/admin/gate.test.ts`: "%s renders the shell with no children…" | rewritten ("%s shows the PIN card, not the page…") | F2: it asserted the React element type. Now the page is rendered with `react-dom/static` `prerender`; it asserts the PIN field's label and Unlock, no Log out, and `openDb` not called. | `<PinGate …/>` → `null`: 5 cases fail. `session === "valid"` → `!==`: 5 cases fail. |

PR #605's handoff list:
- Wall clock in a test body (14):
  - `lib/flags.test.ts:45`, `:66`: a fresh module per test (`vi.resetModules`) at one fixed instant, `NOW + i * 31_000`. Break: `FAILED_S * 2000` fails 2 tests.
  - `lib/web-push.test.ts:96`, `app/(private)/_ui/screenshot-upload.test.ts:17`: a fixed instant.
  - `lib/collector.test.ts:288`, `:308`, `lib/collector-sample.test.ts:50`: `deps.now` reads the fake timers' clock (`vi.getMockedSystemTime()`), started at T0. The existing `durationMs` assertions prove it moves.
  - `app/(pages)/admin/gate.test.ts:98` and `app/(private)/w/[slug]/turned-off.test.ts:80`: the token or session is made at T0. Both pages read `new Date()` themselves, so the tests fake `Date` at T0 (`toFake: ["Date"]`).
  - `app/(private)/api/w/[slug]/cross-workspace.test.ts:78`: `seen` is `SEED_AT`, the context's clock.
  - `app/api/admin/invites/route.test.ts:65`, `:93`, `:95`: T0.
  - `scripts/seed.test.ts:33`: file deleted (row 14).
- Real `setTimeout` (6):
  - `lib/lookup.test.ts:109`: the first read is held on a promise until the second press has answered, then released. Break: in-flight reads not counted against the reserve: fails.
  - `lib/private/desk-action.test.ts:30`: the refusal is sent first, then `vi.waitFor` the success's call, then exactly one call. Break: `counted` sends for a refusal too: fails.
  - `lib/analytics/posthog.test.ts:57`: `vi.waitFor` for a recording; for "never recorded", `vi.dynamicImportSettled()`. Break: cookieless loads record: "with no answer…" fails.
  - `cross-workspace.test.ts:171`, `:218`, `:236`: `vi.waitFor` on the events. At `:171`, to prove that nothing was sent, one write of Alpha's own is made after the refusals and its event is awaited; `two.posts` must then hold that one post only. The `counted` break above also fails this test.
- `lib/queries/roster-stays.test.ts:25`: PGlite now opens in `beforeAll`.
- `lib/run-notify-turnout.test.ts` mocking `./queries`: removed (row 1).
- The other mocks outside the allowed list:
  - `./event-image` in `run-notify-turnout.test.ts`: removed (row 1).
  - `./locale` in `app/_ui/AcrossEvents.test.ts`: replaced by a `next/headers` mock (an allowed seam) with an English `accept-language`, so the real language choice runs.
  - Kept, with the reason:
    - `./event-image` in `lib/samples.test.ts`, `lib/samples-hardening.test.ts`, `app/_ui/event-page.test.ts`: the real picture is dropped after 3 s, so under load two runs of one event would give different messages. The renderer has its own test (`lib/event-image.test.ts`).
    - `@/lib/private/import-read` in `shots/read/route.test.ts` and `w/[slug]/share/route.test.ts`: `readUpload` is the OCR worker's boundary; the tests hold or fail it on purpose.
    - `@/lib/collector` in `app/api/snapshot/route.test.ts`: it wraps the real `runSnapshot` to crash it on purpose; the rules allow that.
    - `react` in `app/_ui/admin/useRunWatch.test.ts`: the suite has no DOM renderer to run a hook's effects; adding one is a new dependency.

Order-dependent tests (task 2). Reproduced on origin/dev with `pnpm vitest run --sequence.shuffle --sequence.seed=<n>`: seeds 2–6 failed, seed 1 passed. The shared state:
- `lib/app-errors.test.ts` (3 tests): `lib/app-errors.ts` keeps `lastInsertAt`, the one-row-a-second limiter, on the module. The tests had moved each clock later (`+24 h`, `+48 h`, `+72 h`) to get past the previous test's insert. Shuffled, a test with an earlier clock ran after a later one and its insert was skipped. Fix: `vi.resetModules()` and a fresh `import("./app-errors")` in `beforeEach`; the clock offsets were removed.
- `lib/queries/players.test.ts` (the blocked-key test): the seed was in `beforeAll`, and the third test added a "Banana" member that `searchPlayers("nana")` then also found. Fix: `truncateAll` and the seed in `beforeEach`.
- `lib/private/features.test.ts` (once): `feature_defaults` (D134) is a site-wide table that `truncateAll` did not empty, so "a changed default moves every workspace…" left `thefts: false` for the next test. Fix: `truncateAll` (`lib/db.test-helpers.ts`) now also empties `feature_defaults` and `allowance_pauses`; the file's own `delete(allowancePauses)` is gone. `notice-picture.test.ts` also writes `feature_defaults`.
- Also found: `lib/analytics/posthog.test.ts` "with no answer…" failed on seeds 2 and 3. The stand-in SDK's consent records outlived each test, so an earlier "granted" opted the next load in. Fix: the records are cleared in `beforeEach`.

## Decisions

- `scripts/seed.test.ts` is deleted (task 3). It checks a dev-only flag of `pnpm db:seed`. No visitor, officer or member relies on it, the e2e seed is separate, and it took 1.6 s alone (5–15 s in full runs, per the audit). A broken `--with-states` shows the first time a developer runs it.
- Row 2: fake timers do not drive `AbortSignal.timeout` in Node 26. A probe that advanced fake timers by 12,001 ms left the signal not aborted. The test uses a 50 ms timeout that the code itself sets, not a sleep in the test.
- Row 4: the raid's rest mark had no other test, so it was replaced rather than deleted. Rows 6, 10 and 13 assert only constants, so nothing replaces them.
- Row 16: the audit's "`clock.now - start ≤ 115 s`" cannot hold: the test moves the clock 116 s on purpose. The run's closed row and its answer are asserted instead.
- Row 21 and `turned-off.test.ts`: the pages read `new Date()` themselves. The tests fake `Date` at T0 rather than change the pages.
- The `max-lines` limit (300, comments not counted) on `app/api/tick/route.test.ts` was met by writing the row check in two lines.

## Deviations

- Row 9: the audit's suggestion was a fake-timer test that a press answers within 20 s. It is not feasible, because the timeout lives in the real `/v1` adapter, which the lookup tests replace with `fakeV1`, and fake timers do not drive `AbortSignal.timeout`. Only the constant line was deleted.
- Row 2 became two tests (retry count, timeout), one per stated behaviour.
- `posthog.test.ts` was not in task 2's list; it failed in the same shuffled runs and is fixed the same way.

## Verified

- Break runs: every row in the tables above that names a break was run; each failing test is named there. All break changes were undone; `git status` shows only test files and `lib/db.test-helpers.ts`.
- `pnpm check`: exit 0. Prettier and ESLint are clean, and tsc passes. Vitest: 305 files passed and 2 skipped, 1594 tests passed and 4 skipped. "No schema changes, nothing to migrate". "i18n: 17 languages up to date with English".
- Full suite, default order, 3 runs: 1594 passed | 4 skipped each; 46.82 s, 47.76 s, 47.18 s.
- Full suite, shuffled (`--sequence.shuffle --sequence.seed=<n>`), 8 runs, all 1594 passed | 4 skipped:

| Seed | Duration |
|---|---|
| 2 | 47.77 s |
| 3 | 47.53 s |
| 4 | 47.71 s |
| 5 | 49.14 s |
| 6 | 63.11 s |
| 17 | 84.31 s |
| 42 | 51.01 s |
| 9001 | 49.01 s |

  Seeds 2–6 had failed on origin/dev. The 63 s and 84 s runs were slow because other sessions were loading the machine.
- Before, on origin/dev: 306 files passed and 2 skipped (308); 1596 tests passed and 4 skipped (1600); 49.91 s. After: 305 files passed and 2 skipped (307); 1594 tests passed and 4 skipped (1598); 46.8–47.8 s. Net −2 tests: `seed.test.ts` −2, `ADDED_KINDS` −1, `v1-options` +1.

## Open issues

- Pre-existing, not changed: `AdminShell`'s `Unlocked`, `adminSession()` and the `/w/[slug]` pages read `new Date()` instead of the context's clock, so their tests must fake `Date`. A follow-up could pass `ctx.now()` through.
- `.claude/rules/tests.md`'s mock list does not name the four kept mocks above (`./event-image`, `import-read`'s `readUpload`, the `react` hook stand-in; the `@/lib/collector` wrap is already allowed). The owner may add them with their reasons, or ask for them to go.
- The other e2e and gap items of the audit (batches 4, 6–8) are untouched.

## Next

- Audit batch 6 (route and page gaps): Raid prep and Calendar route tests, the `/w/[slug]` pages walker, `ph-no-capture` render checks.
- Model/effort: keep. This batch's work was mechanical once each claim was checked against the code.
- The owner must do nothing first. The plan needs no change.

<adjustments>
- `truncateAll` now empties `feature_defaults` and `allowance_pauses`; a test that writes D134 defaults needs no cleanup of its own.
- `react-dom/static` `prerender` renders async server components in Vitest (`gate.test.ts`, `AcrossEvents.test.ts`); a page render check needs no new dependency. A client component in the tree that calls `useRouter` needs `next/navigation`'s `useRouter` mocked.
- `/w/[slug]` pages read `new Date()`: a page test that signs in at T0 must use `vi.useFakeTimers({ toFake: ["Date"], now: T0 })`, as `turned-off.test.ts` does.
- To prove that fire-and-forget work sent nothing, send one counted action after the refusals and `vi.waitFor` its event, then assert it is the only one (`cross-workspace.test.ts`, `desk-action.test.ts`).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/622
