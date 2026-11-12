# 08zzzi — Error detail for the admin (D61)

Owner request, 2026-11-12. The admin errors were too generic: `✗ failed [NSE]: v1 TimeoutError` and `✗ App error on /admin: render Error · digest …`. The owner wants to know what the problem is, why it happened, how to investigate it and what to do, with the details as the vendor's API sent them. The Vercel runtime logs cannot hold that: Hobby keeps them about 30–60 min. On 2026-11-12 a query from 07:00 UTC was refused for retention, and the 14:36 UTC render error had no log line.

## Built
- **Upstream detail at the source.**
  - `lib/sources/types.ts`: `UpstreamDetail` (path, status, headers, body, timeoutMs, cause). `UpstreamError`, `NotFoundError` and `QuotaExhaustedError` take an optional `detail`. `RequestError` is a call with no HTTP answer; it keeps the cause's name (`TimeoutError`, `TypeError`).
  - `lib/sources/v1.ts`, an HTTP error: the error carries path, status, the headers `retry-after`, `content-type`, `date`, `server`, `cf-ray` and `x-request-id`, and the body's first 1,000 characters. Before, the body was cancelled unread. All of it goes through `redact()`.
  - `lib/sources/v1.ts`, a fetch rejection: it becomes `RequestError` with path, the 30 s timeout and the cause. It is not wrapped when the caller's signal (the run deadline) aborted it. `answerError()` was split out of `request()` for the complexity limit; the retry policy is unchanged.
  - `lib/upstream-errors.ts`: `upstreamDetail(e)`.
- **Stored.**
  - `lib/collector.ts`: a failed `v1.fetch` line's data has `detail`.
  - `lib/daily-read.ts`: an error row stores `error_detail`.
  - `lib/app-errors.ts`: `appErrorDetail()` (name, message 500 characters, up to 12 stack frames, cause), redacted with `secretsOf(env)`, into `app_errors.detail`. The admin alert adds the message's first line after `—`. The console line carries the detail too.
  - Migration `drizzle/0013_clumsy_mandarin.sql`: `app_errors.detail jsonb`, `daily_rosters.error_detail jsonb`, both nullable.
  - `lib/redact.ts`: also removes `postgres://…` URLs. A driver error can quote one that is not the configured value.
- **What it means, what to do.** `lib/error-guide.ts` `guideFor(text)` is a first-match table from the one-line text to an entry. The text is in `lib/copy-guide.ts` as `copy.admin.guide`, English only (D48).
- **Shown.**
  - `app/_ui/admin/ErrorDetail.tsx`: `GuideNote`, `UpstreamDetails` and `AppErrorDetails`, inside a closed `<details>` with a 44 px summary.
  - `/admin/errors`: each group has its guide and the newest row's detail.
  - `/admin/runs` daily row: `Stopped: <reason>` with its guide, then the failed alliances grouped by error, each group with its guide and each alliance with `[TAG] · Details`.
  - `/admin/runs/[id]`: a log line with `detail` shows its guide and details. The log moved into a `RunLog` component for the 80-line limit.
- **Discord.** The daily read message has `↳ meaning action` under each `✗ reason (n): …` line (`copy.discord.admin.dailyWhy`).
- **Queries.** `listErrorGroups` returns the newest row's `detail`. `listDailyReads` problems carry `error` and `errorDetail`. `lib/queries/daily-runs.ts` re-exports `UpstreamDetail`, because `app/` cannot import `lib/sources`.
- **Tests (committed; `.claude/rules/collector.md` requires them for `lib/sources/**` and `lib/collector.ts`):**
  - `v1.test.ts`: two new tests. One checks the final 504 error's path, status, kept headers, and redacted body start, at most 1,000 characters. The other checks a timeout as `RequestError` named `TimeoutError` with path, 30 s and cause.
  - `collector.test.ts`: the `v1.fetch` test also checks the failure's `detail`.
- **Docs:** D61, its index entry, the README Discord table and "Where to look", and DESIGN.md (`admin-section`).

## Decisions
- **One-line texts unchanged.** `describe()` still gives `TimeoutError`, `http 504`, …, so the D27 banner rule, the Discord grouping and `/admin/errors` grouping work as before. Third-party text lives only in the new detail fields (plan §12.3 amended by D61).
- **Rendered as text.** The vendor body is rendered as text in a `<pre>`, never as HTML.
- **Discord gets only one line of an app error's message.** The stack stays on `/admin`.
- **The guide does not claim "network" for unknown errors.** Only `TypeError` and `AbortError` (what `fetch` throws for a network failure) match it; anything else is "No explanation for this error yet".
- **Snapshot alliance rows (`alliance_snapshots.error`) get no detail column.** The run page's `v1.fetch` lines carry it, one per call.

## Deviations
- `docs/IMPLEMENTATION_PLAN.md` §12.3 still says the DB error fields never hold third-party messages. Not edited (CLAUDE.md); D61 amends it; see Next.
- Besides the committed tests, the rest was checked with temporary tests, deleted (see Verified).
- An edit to `v1.test.ts` was lost when the session restarted; I wrote the two tests again and checked them as below.

## Verified
- Mutation check on the two new `v1` tests: removing `redact()` from the HTTP detail and dropping `timeoutMs` from the no-answer detail fails both (2 failed / 18 passed). Restored, 20 passed.
- Temporary tests (3 passed, deleted):
  - `guideFor` on 17 texts maps each to the expected entry: `v1 RangeError` maps to "no explanation".
  - `appErrorDetail` drops the PIN, the LAP key and a `postgres://user:pw@…` URL. Found and fixed: a message of several lines opened the stack with its second line; the stack now keeps only `at …` frames.
  - `recordAppError` stores `message = "render TypeError"` and the detail, and posts `✗ App error on /admin: render TypeError — connect failed [redacted] … · digest 123 · /admin/errors`.
  - A daily read with a `RequestError` timeout and a 504 stores each `error_detail` (null for the read alliance). Its message has a `↳` line under each reason.
- A local Postgres (D47: `.pglocal`, bridge, preload; the `DATABASE_URL` override was set on the process, `.env.local` unchanged):
  - migrations 0000–0013 applied with `psql`;
  - seed `--with-states`;
  - then inserted: a failed daily read for 2026-11-12 (deadline, NSE timeout, URSA 504 with the Cloudflare HTML), an app error with detail, and a failed `v1.fetch` line with a 503 detail on run 9.
- Chrome 360 px on `next dev` against it, admin session, every `<details>` opened:
  - `/admin/runs?show=daily`, `/admin/errors` and `/admin/runs/9` render guide and details, with no horizontal overflow.
  - `/admin` shows the Retry card with "deadline".
  - Retry was not pressed: the local app uses the real API key.
- `pnpm check`: prettier, eslint, typecheck, 256 tests passed (1 skipped), drift check "No schema changes", i18n "17 languages up to date".
- No upstream call was made. Nothing was written to Neon (preview or production).

## Open issues
- Rows recorded before this change have no detail and show only their one-line text.
- The 14:36 UTC "render Error" of 2026-11-12 is still unexplained. The next such error will carry its message and stack.
- A press with a stale PIN in `sessionStorage` keeps re-sending it on 401 (reported in chat on 2026-11-12, not changed here).

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. The rework was lint limits (complexity 12, 80-line functions) and one stack-slicing bug the temporary test caught.
Owner must do first: merge this PR into `dev`, then release (minor: new columns and pages). The release build runs `db:migrate`, which adds the two nullable columns. If production is still pinned to the rolled-back v4.2.0, promote the new deployment.
Plan changes needed: `docs/IMPLEMENTATION_PLAN.md` §12.3 (the "error fields … not from err.message" line) should point to D61: one-line fields stay ours; redacted third-party detail is kept in admin-only detail fields.

<adjustments>
- Errors from the `/v1` adapter carry `detail: UpstreamDetail`. A new adapter or call site should attach the same, and read it with `upstreamDetail(e)`.
- `guideFor` keys on the one-line error text. A new error text needs a row in `RULES` (`lib/error-guide.ts`) and an entry in `lib/copy-guide.ts`, or it shows "No explanation for this error yet".
- `app/` reads `UpstreamDetail` from `lib/queries/daily-runs.ts`, not from `lib/sources` (import zone).
</adjustments>
