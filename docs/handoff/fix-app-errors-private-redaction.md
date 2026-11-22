# fix/app-errors-private-redaction — one private-field redactor on every error's way out

Owner rule (2026-11-21), and its scope extension the same day: replace private roster values in error text with `…` before the text goes anywhere, send server errors to PostHog Error Tracking with their message and frames, report errors our code catches as handled, and keep `app_errors` 30 days as a fallback.

## Built

- **`redactPrivate(text)`** (`lib/redact.ts`). It replaces the value of every private roster field a text names with `…`. Keys: `BLOCKED_ROSTER_KEYS` in snake_case and camelCase, in any letter case. Shapes:
  - JSON and escaped JSON;
  - `key=value` and `key: value`, including dotted paths, but not SQL `$n` placeholders;
  - a Zod issue's `input` or `received` when its path ends in a private key, also in escaped JSON and in union issues;
  - Postgres' `Key (…)=(…)`: only the private column's value;
  - any URL on the photo host or a subdomain of it, found by the host's text. `PHOTO_HOST` moved from `lib/sources/shared.ts` to `lib/queries/blocked-keys.ts`.

  It also turns Drizzle's `\nparams: …` (the row's values, unquoted) into `params: …`. `redact()` additionally masks object values under a private key.
- **Where it runs:**
  - `redact()` passes every string through it. That covers `app_errors.detail` (message, frames, cause), `run_logs.data` and the logger's `console.error`, and the `/v1` upstream detail.
  - `appErrorDetail` redacts up to 2,000 characters, then cuts to 500. Before, it cut first, so a value or Zod issue cut in half could slip past.
  - `appErrorMessage` (the admin alert's builder) applies it again.
  - The browser's `scrubMessage` cuts the message to 2,000 characters, then applies it first.
- **Server `$exception`** (`lib/report-error.ts` `sendException`, `lib/analytics/server.ts`):
  - It carries `$exception_list[0]` with `type`, `value` and `mechanism.handled`.
  - `value` is the message after `redact()` and `scrubMessage`.
  - `stacktrace` is `raw` with `node:javascript` frames, outermost first. The frames come from the 12 redacted frames that `app_errors` keeps.
  - `$exception_level: "error"`.
  - It keeps `kind`, `route`, `workspace` and `alliance`, and adds `section`, read from the route pattern.
- **`reportError(ctx, { route, kind, error })`.** It sends a handled `$exception` after the response, with no row and no alert. It is called from:
  - the tick's daily jobs (workspace purge, raw-body clear, the new purge) and the notice-picture cleanup;
  - `run.crashed` and `snapshot.finalise_failed`;
  - the run message's `notify.detail_failed` and `notify.turnout_failed`;
  - `pushLater`'s `push.failed`.
- **`handled` on `recordAppError`.** `withContext`'s 500, the squads tick and the share route pass `handled: true`. `onRequestError` defaults to `false`.
- **Retention.** `purgeOldAppErrors` deletes rows older than 30 days. It runs in the tick's daily jobs, after the day's first read. The 500-row cap stays.
- **Docs:**
  - the CLAUDE.md roster-fields sentence;
  - a dated amendment to D115 (the rule, the payload, handled errors, retention, the plan to retire `app_errors`) and to D61;
  - the tracking plan's server `$exception` row;
  - the ARCHITECTURE.md dependency rule.
- **Tests:**
  - `lib/redact.test.ts`:
    - every shape;
    - what must stay (`max: 3`, `daily_read`, `= $1`);
    - params, escaped and union Zod issues, and object keys;
    - 100 kB of adversarial text in under 50 ms each;
  - `lib/app-errors.test.ts`:
    - stored, alerted and PostHog payload redacted, with the other text intact and no name in PostHog;
    - a real Drizzle failure, whose parameters reach none of the three;
    - a handled error is sent once;
    - the 30-day purge;
    - a source-scan guard;
  - `lib/analytics/sanitise.test.ts`: the redactor in `scrubMessage`, and its speed on long input;
  - `lib/notify.test.ts`: the alert line;
  - `lib/analytics/server.test.ts`: the payload shape, updated.

## Decisions

- **One choke point is `redact()`, not a call at each site.** Every existing consumer of `redact()` (app errors, run_logs, upstream detail) gets the private-field rule for free. The source-scan test fails if `scrubString`, `scrubMessage`, `appErrorDetail`, `appErrorMessage`, `recordAppError`, `reportError` or `sendException` stop calling it.
- **Message for PostHog = `scrubMessage(redacted message)`.** This is the browser's rule: digits become `#`, and quoted text, emails and query strings go. Server and browser messages read alike, and Error Tracking groups them stably. `app_errors.detail` keeps the redacted but unscrubbed text for the owner.
- **No posthog-node.** It is not installed, and `@posthog/core` is only a transitive dependency of posthog-js. The payload is built by hand with the fields core's node parser produces. No new dependency.
- **Handled errors go to PostHog only.** They write no `app_errors` row and send no alert. This keeps the user path free of new awaits, as the extension asked.
- **Not reported:**
  - collector and daily-read upstream failures (run outcomes, in `run_logs`);
  - Discord send failures (HTTP statuses);
  - Groq failures (`$ai_generation` has `$ai_is_error`);
  - catches that turn an expected failure into a result.
- **`route` for handled errors outside a request** is the module (`lib/run.ts`, `lib/run-notify.ts`, `lib/push.ts`) or `/api/tick`. `kind` is the log line's code.

## Deviations

- Server source maps are not uploaded: `scripts/sourcemaps.ts` handles `.next/static` only. Server frames therefore arrive with built file names and lines, so Error Tracking groups them but cannot map them to source.

## Verified

- `pnpm check` exits 0 after the PR #598 review fixes: prettier, eslint, tsc, vitest (296 files passed and 2 skipped; 1,545 tests passed and 4 skipped), drift (no schema change, no migration) and i18n (17 languages up to date).
- PR #598 review (`/pr-review`), every item fixed:
  - MUST, frames: officer text in a query's `params:` (for example "at 8pm in the hall") passed the old `startsWith("at ")` filter. The stack is now read only after the message, and only real V8 frame shapes are kept. The Drizzle test uses that input; with the old filter it fails.
  - Quadratic regexes: the escaped-string value excludes backslashes, and `ZOD_PATH`/`ZOD_ECHO` start only at a run's first backslash and read at most 500 characters of path. 100 kB backslash runs and unclosed `"path":[` inputs are in the test, which asserts outputs.
  - Wall-clock bounds and the 20 ms sleep are gone. The linearity tests assert outputs; the handled-error test asserts synchronously, since a send outside a request posts before its first await.
  - The source scan strips comments and matches the calls (`= redact(`, `message: redactPrivate(`, `message: scrubMessage(`).
  - A tick-route test shows the day's first read deleting the 31-day-old `app_errors` row and keeping the 29-day-old one.
  - `.claude/rules/private.md` (now on dev, PR #594) says what CLAUDE.md says.
  - `appErrorDetail`, `sendException` and `reportError` moved to `lib/report-error.ts`, which imports neither `lib/notify*` nor `lib/discord-*`. `lib/push` (and through it `lib/private`) no longer reaches `lib/notify`. ARCHITECTURE.md lists the module and its edges.
- Purge measured on the test PGlite with 600 inserts, kept at 500 by the cap: an Index Scan on `app_errors_at_idx`, 239 rows deleted in 0.36 ms, 257 shared buffer hits. The plan is bounded by the 500-row cap.
- Zod 4.6.7's real `error.message` shapes were checked (`"path": [...]`, `"input"` only with `reportInput`). The test uses a real `ZodError` as the cause.
- Adversarial review (one subagent; its result was relayed by the orchestrator), all addressed:
  - MUST: Drizzle's `params:` sent user text and names to PostHog's `value`. Fixed: the params are cut everywhere (row, alert, PostHog, run_logs), and a real Drizzle failure is tested.
  - MUST: the photo-URL regex was quadratic: 15 s at 100 kB in the browser. Fixed: it is replaced by a host search, `scrubMessage` cuts to 2,000 characters first, and quoted values are bounded to 500 characters. Tested at under 50 ms for 100 kB.
  - SHOULD, fixed: object keys in `redact()`; Zod issues in escaped JSON and in unions.
  - NITs, applied: any-case keys; `daily_` limited to the real fields; `$n` placeholders kept.
  - Double-reporting: clean. Payload shape and frames: correct.

## Open issues

- Follow-up (separate PR, after about 3 weeks of comparing PostHog Error Tracking with `/admin/errors`): remove `app_errors`, `/admin/errors`, `purgeOldAppErrors` and the admin alert, and move the alert to a PostHog alert.
- Follow-up: PostHog Logs and APM / OpenTelemetry (declined by D115 at this size; the orchestrator opens an issue).
- Follow-up: upload server source maps so server frames resolve.
- `lib/private` catches (`w.import.discord_failed`, `w.pending.match_failed`, `w.read_status.failed`) are not reported. They could now use `reportError` from `lib/report-error.ts`, which imports no `lib/notify`. Not done here: what those errors carry should get a D71 look first.
- `instrumentation.ts` `register()` prints the env validation message with `console.error`. It names env variables only, not roster data, so it is left as it is.
- Follow-up (review): Next.js prints a request error to Vercel's runtime log itself, unredacted, apart from `onRequestError`. Our code does not control that line.
- Follow-up (review): `httpDetail` in `lib/sources/v1.ts` cuts the upstream body to 1,000 characters before `redact()`, so a value cut at the edge can slip past. `appErrorDetail` now does the opposite (redact, then cut).
- Known limit: a bare name in our own error text (not quoted, not a parameter) still reaches PostHog, as on the browser side (D115's scrubber keeps bare words). A Postgres cause that quotes a value (`invalid input syntax …: "…"`) is kept in `app_errors.detail.cause` for the owner, and is not sent to PostHog (PostHog gets no cause).

## Next

- Model/effort: keep.
- Owner first: merge and release. Then watch PostHog → Error tracking for server issues with messages and frames, and compare against `/admin/errors` for about 3 weeks.
- Plan change: none.

<adjustments>
- Error text leaves the code through `redact()` (`lib/redact.ts`), which now also runs `redactPrivate`. New sinks for error text should call `redact()` or `redactPrivate`, never write raw text.
- Server errors that are caught and carried on from go through `reportError` (PostHog only, `handled: true`). Thrown errors reach `recordAppError` once, through `withContext` or `onRequestError`.
- `app_errors` holds at most 500 rows and 30 days. Its retirement PR deletes `purgeOldAppErrors` and its call in `lib/tick.ts` with it.
</adjustments>

PR: (added by the orchestrator)
