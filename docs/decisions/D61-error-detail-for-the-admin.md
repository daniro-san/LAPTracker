## D61 — Error detail for the admin: what came back, what it means, what to do (2026-11-12, owner, 08zzzi)

Why: the owner saw `✗ failed [NSE]: v1 TimeoutError` and `✗ App error on /admin: render Error` and could not tell what broke, why, or what to do. The runtime logs do not keep the cause: Vercel Hobby keeps them for about 30–60 minutes. A query from 07:00 UTC on 2026-11-12 was refused for retention, and the 14:36 UTC render error left no line at all.

- **Amends plan §12.3.** The one-line error fields stay our own words, so the run's `error`, `app_errors.message`, `daily_rosters.error`, the D27 banner rule and the grouping on `/admin/errors` are unchanged. Third-party text is now kept in separate **detail** fields, redacted, and shown only on admin pages. It never goes to a public page, an API response or a public Discord message.
- **Upstream detail** (`UpstreamDetail`, `lib/sources/types.ts`) is built in the `/v1` adapter:
  - for an HTTP error: the request path, the status, the headers `retry-after`, `content-type`, `date`, `server`, `cf-ray` and `x-request-id`, and the first 1,000 characters of the body;
  - for a call with no answer: the path, the timeout (30 s) or the network cause. These calls throw `RequestError`, which keeps the cause's name (`TimeoutError`, `TypeError`), so `describe()` and every one-line text read as before.
  - It passes through `redact()` (LAP keys, database URLs). It is stored in `run_logs.data.detail` (snapshot runs) and `daily_rosters.error_detail` (migration 0013).
- **App error detail** (`AppErrorDetail`, `lib/app-errors.ts`): name, message (500 characters), up to 12 stack frames, and the cause. It is redacted with every configured secret (`secretsOf`) and stored in `app_errors.detail` (migration 0013). The admin Discord alert adds the message's first line (160 characters): `✗ App error on /admin: render TypeError — Cannot read …`. The stack stays on `/admin/errors`.
- **What it means, what to do** (`lib/error-guide.ts`, text in `lib/copy-guide.ts`). The one-line error text is matched to an entry: timeout, network, gateway 5xx, quota 429, the quota rule, key refused 401/403, not found, other HTTP, schema, not fetched, deadline, call cap, page/route failure, unknown.
- **Where it shows:**
  - `/admin/errors`: each group has its entry and a closed **Details** (message, cause, where).
  - A daily read's page (`/admin/runs/daily/[day]`, D60): its stop reason and its failed alliances by reason, each reason with its entry, each alliance with its own **Details**.
  - The run page: a failed `v1.fetch` log line has its entry and **Details**.
  - The daily read's admin message: under each `✗ reason (n): …` line, a `↳ meaning action` line.
- **Size:** body 1,000 characters, message 500, 12 frames, a fixed header list. Rows recorded before this change have no detail and show only the one-line text.
