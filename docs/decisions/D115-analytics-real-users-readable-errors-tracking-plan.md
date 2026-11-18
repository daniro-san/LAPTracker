## D115 — Analytics: real unique users, readable errors, a tracking plan, server and AI events (2026-11-17, owner, 11ag, issue #395; amends D77)

Why: the owner found the PostHog data unusable. Every page load was a new person (174 "first-time users" = 174 sessions), exception messages arrived as `[masked]`, and no event was planned against a product question. The tracking plan is `docs/analytics/tracking-plan.md`.

- **Unique users.**
  - **A page load that starts on a public page runs in PostHog's cookieless mode** (`cookieless_mode: "always"`, posthog-js 1.444.4). The browser sends the sentinel id `$posthog_cookieless`, and PostHog's servers replace it with a hash of the project, a daily salt, the visitor's IP, the user agent and the host. PostHog deletes the salt after the day, so the hash cannot be traced back and a visitor is one person per day. Nothing is stored on the device (checked: no cookie, no local or session storage).
  - **Cost: no replay on those page loads.** Cookieless mode has no session, and posthog-js refuses to record without one (`SessionRecording … cannot be used with cookieless_mode="always"`, and `$snapshot` events are dropped). Public pages are no longer recorded at 25 %. A public page is still recorded when the page load started on `/w` or `/admin` and then went to a public page (`PUBLIC_REPLAY_SAMPLE` still applies there). The mode is chosen once per page load, from the first page's area (`lib/analytics/posthog.ts`), because posthog-js cannot switch modes after `init`.
  - **The visitor's IP now reaches PostHog on event requests.** The hash needs it. `/ingest` adds `x-forwarded-for: <the visitor's IP>` (`clientIp`, D42) on `POST /e/` and `/i/v0/e/` only. Replay batches (`/s/`) and the remote config carry no IP, and cookies, referer and the user-agent header are still not forwarded. With cookieless mode on in the project, PostHog uses the IP for the hash and strips it before any transformation (no GeoIP, so the web analytics world map stays empty). The project also discards IPs (D77).
  - **The desk and the board identify the visitor by a pseudonymous id.** `lib/analytics/person.ts`: `ws_` + the first 32 hex characters of an HMAC-SHA256 of the workspace user id. The key is itself an HMAC of `CRON_SECRET` with the fixed purpose string `laptracker posthog person v1`, so no new secret is needed and this value matches no other use of the secret. The raw id never leaves the server; without `CRON_SECRET` nobody can tell whose id it is. The same person keeps the same id across days and devices. A new `CRON_SECRET` makes new ids, and PostHog then counts everyone as new once.
  - Person properties are `tier` (`officer`, or `member` on the board; an officer previewing the board is `officer`) and `workspace` (the slug), nothing else: no name, email or Discord id. `SignedInFrame` renders `AnalyticsPerson` with the id for officers, and `/w/[slug]/board` does the same for both tiers (`BoardAccess.userId`, used for nothing else). The page computes the id only when analytics is on (`analyticsKey`). Because nothing is stored on the device, identify runs again on every page load.
  - `person_profiles` is now `identified_only`: only desk and board people have profiles; public and `/admin` events stay personless.
  - **Sign-out calls `posthog.reset()`** (`SignOutButton`), so later events on that page load belong to no one.
  - Masking and replay rules on `/w` and `/admin` are unchanged (D77).
- **Readable errors.**
  - **Exception messages are scrubbed, not masked, in every area** (`scrubMessage` in `lib/analytics/sanitise.ts`). The type, the words and the stack frames' file, line and function stay. The scrubber:
    - replaces digit runs with `#`;
    - replaces emails with `[email]`;
    - cuts the query string and hash from URLs;
    - replaces anything between quotes (straight, typographic or back quotes) with `…`.
  - One exception to the quotes rule: a code path that an engine quotes after `reading`, `setting` or `evaluating` stays, e.g. `(reading 'map')` or `(evaluating 'a.b')`, because it is a property name and no person's name. `$exception_list[].value`, `$exception_values` and `$exception_message` are all scrubbed.
  - Remaining risk: a name that our code puts into a message without quotes would pass. No code does that today: our errors are codes. The D77 reason for masking whole messages ("a pattern rule misses values printed some other way") is accepted as a trade-off at the owner's request.
  - **Route context.** Every event carries `section` (the tab, from a closed list) besides `area` and `workspace`. `app/error.tsx` and `app/global-error.tsx` send the error they catch with `boundary: "page"` or `"root"`. React handles those errors, so autocapture never saw them before.
  - **Source maps** (`scripts/sourcemaps.ts`, run by `pnpm build` after `next build`):
    - With `POSTHOG_PERSONAL_API_KEY` set, `next.config.ts` turns on `productionBrowserSourceMaps`. Then `posthog-cli sourcemap process --directory .next/static --delete-after --release-name laptracker --release-version $VERCEL_GIT_COMMIT_SHA` injects chunk ids into the chunks, uploads the maps to project 741657 and deletes them. A failed upload is logged and does not fail the build; the site ships with minified stacks.
    - Without the key (local, CI, any deployment without it), no map is built and nothing is sent.
    - Either way, every `*.map` left under `.next/static` is deleted, so maps are never served.
    - The key is passed only in the CLI's environment (`POSTHOG_CLI_API_KEY`) and never printed.
    - The CLI, not `@posthog/nextjs-config`: the Next plugin wraps the same CLI and also brings `@posthog/webpack-plugin`, `@posthog/plugin-utils` and `semver`. This build uses Turbopack, not webpack, and its newest release (1.12.2) is under two weeks old. A step after the build covers Next 16's Turbopack output. The `no-external` SDK reads the chunk ids the CLI injects (`_posthogChunkIds`).
    - Not checked here: the injection and the upload need a real key, because the CLI resolves the release on PostHog first. They are checked on the first production build (owner's step 4).
  - **The real TypeErrors** on `/w/ogs/thefts`, `/w/ogs/notices/new` and `/w/ogs/calendar/caravans` (the PostHog MCP could not open project 741657, so the issues were not read):
    - The forms on those pages made their D100 request id with `crypto.randomUUID()` while rendering. Safari before 15.4 and older Android WebViews do not have it.
    - Reproduced on a local production build with `randomUUID` removed: "Add" on Thefts and the new-notice editor both fell to "Something cracked."; the calendar's entry form, used from Caravans, has the same call.
    - Fixed: `app/(private)/_ui/request-id.ts` (`newRequestId`) uses `crypto.randomUUID` when it exists and otherwise builds a v4 UUID from `crypto.getRandomValues`, which the routes' `z.uuid()` accepts. All 13 calls in `app/(private)/_ui` use it.
    - After the fix both screens render in that browser.
- **Server errors.** `recordAppError` (`lib/app-errors.ts`) also sends a `$exception` to PostHog: the error's class name, the `kind` and the route pattern. The message, stack and cause are not sent: they stay in `app_errors.detail` for `/admin/errors` (D61), because a message may be built from private data (D71).
- **Server events** (`lib/analytics/server.ts`): one `POST https://us.i.posthog.com/batch/` with the project key, the fixed distinct id `laptracker-server` (as D91), `$process_person_profile: false`, a 2 s timeout. A failure is dropped. These events are sent on production with `POSTHOG_KEY` only, as D77. No new dependency: `posthog-node` is not needed for one request.
  - `discord_command_used` with `command` (`send_to_laptracker`, `translate_for_me`, `translate_for_everyone`), sent after the response (`after`). Counts only: nothing about the message, sender or server.
- **LLM observability.** `groqChat` takes an observer (`lib/ai/groq.ts` still imports nothing from the project). Each request of a completion is reported as one `Generation`, and `lib/app-context.ts` sends them as `$ai_generation` events with one `$ai_trace_id` per completion. A generation carries:
  - `$ai_provider: "groq"`, `$ai_model`;
  - `$ai_input_tokens` and `$ai_output_tokens` from Groq's `usage`, null when Groq gave none;
  - `$ai_latency` in seconds;
  - `fallback` (the second model);
  - `$ai_is_error` and `$ai_error` (`timeout`, `busy`, `failed`).
  - Privacy mode: no `$ai_input`, `$ai_output_choices` or any text, and the Groq key never leaves the Groq request.
  - The answer waits for the send, at most 2 s more on a failure.
- **Tracking plan events** (browser, typed in `lib/analytics/events.ts`):
  - screenshots: `ws_draft_discarded`, `ws_screenshot_failed`, `ws_updates_pasted`, `ws_text_read`;
  - notices: `ws_notice_fit`, `ws_notice_ai_failed`, `ws_review_requested`, `ws_review_approved`, `ws_notice_published`;
  - roll call: `ws_roll_call_marked`;
  - `ws_thanks_shared` is typed only: the share-thanks feature (D114) is not on `dev`, and it calls the event when it merges.
  - "Paste updates" no longer sends `ws_screenshot_sent`.
- **OpenTelemetry: no, not now.** At this size (a handful of officers, one Neon database, a few route handlers and one AI provider), Vercel's function logs, `app_errors` with `/admin/errors`, and PostHog's exceptions, `$ai_generation` and page events answer what breaks and what is slow. OpenTelemetry would add an SDK, an exporter and a backend to run or pay for, and spans in every route. Revisit when a slow request cannot be explained from these, or when the app gets a second backend service.
- **New dev dependency.**

| Package      | Version | Released   | Install scripts                                                                                                                                                                                                   | Why the platform isn't enough                                                                                          |
| ------------ | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| @posthog/cli | 0.19.0  | 2026-10-28 | `postinstall` downloads the platform binary from releases.posthog.com: denied (D10, `allowBuilds: false`). The wrapper downloads the binary on its first run instead, which happens only in a build with the key. | Uploading source maps and injecting chunk ids is PostHog's own tool; there is no documented HTTP API to do it by hand. |

0.19.0 is the newest version released at least two weeks before 2026-11-17. Its one dependency, `detect-libc`, was already in the lockfile's range.

- **Owner's steps.**
  1. PostHog → project 741657 → Settings → Project → Web analytics: turn on **Enable cookieless tracking** (the cookieless server hash mode) and save. Without it PostHog ignores the cookieless events, so public pages count nothing.
  2. PostHog → your avatar → Account settings → **Personal API keys** → Create: name `laptracker-sourcemaps`, project access only 741657, scope **`error_tracking:write`** only.
  3. Vercel → laptracker → Settings → Environment Variables: `POSTHOG_PERSONAL_API_KEY` = that key, environment **Production** only, **Sensitive** on.
  4. After the next release: PostHog → Error tracking → Settings → Symbol sets lists the build's files; a new exception shows our file and function names.
- **Checks.** `pnpm check`: the scrubber, the section, the pseudonymous id, the server payloads (no text in `$ai_generation`), the Groq observer, the proxy's IP header, the source-map step with and without the key, and the request-id fallback. On a local production build with a fake project key, a preload caught every PostHog request (nothing reached PostHog) and 25 of 25 checks passed: cookieless public views with nothing stored and no replay; the officer identified as `ws_…` with only `tier` and `workspace`; sections on desk views; replay on the desk with no IP on replay batches; a thrown `TypeError("No member 'Bramble' at 512, 384")` arrived as `No member '…' at #, #` with `section: notices`; `$ai_generation` from a Translate through a Groq stub with no text; events after sign-out not the officer's; the member identified on the board; no invented roster or officer name in any event; and no page error on the desk pages in Chromium and WebKit. Builds: without the key, 0 maps; with a fake key, 55 maps built, the CLI ran in its own dry-run mode (nothing sent), and 0 maps were left.
