## D115 — Analytics: real unique users, readable errors, a tracking plan, server and AI events (2026-11-17, owner, 11ag, issue #395; amends D77)

Why: the owner found the PostHog data unusable. Every page load was a new person (174 "first-time users" = 174 sessions), exception messages arrived as `[masked]`, and no event was planned against a product question. The tracking plan is `docs/analytics/tracking-plan.md`.

- **Unique users.**
  - **A page load that starts on a public page is counted by PostHog's cookieless hash until the visitor allows the cookie** (`cookieless_mode: "on_reject"`, posthog-js 1.444.4; the 2026-11-18 amendment below has the question). The browser sends the sentinel id `$posthog_cookieless`, and PostHog's servers replace it with a hash of the project, a daily salt, the visitor's IP, the user agent and the host. PostHog deletes the salt after the day, so the hash cannot be traced back and a visitor is one person per day. Nothing is stored on the device (checked: no cookie, no local or session storage).
  - **No replay while cookieless.** Cookieless mode has no session, and posthog-js refuses to record without one (`$snapshot` events are dropped). A public page load is recorded in 25 % of page loads (`PUBLIC_REPLAY_SAMPLE`, D77) only after its visitor allowed the cookie, and a public page reached from a desk or `/admin` load follows the same 25 %. The mode is chosen once per page load, from the first page's area (`lib/analytics/posthog.ts`), because posthog-js cannot switch modes after `init`.
  - **The visitor's IP now reaches PostHog on event requests.** The hash needs it. A cookieless page load sends to `/ingest/c/…` (`api_host`, `COOKIELESS_PREFIX` in `lib/analytics/region.ts`), so the proxy can tell it apart: `/ingest` adds `x-forwarded-for: <the visitor's IP>` (`clientIp`, D42) on that load's `POST /e/` and `/i/v0/e/` only. Desk, board and `/admin` events, replay batches (`/s/`) and the remote config carry no IP, and cookies, referer and the user-agent header are still not forwarded. With cookieless mode on in the project, PostHog uses the IP for the hash and strips it before any transformation (no GeoIP, so the web analytics world map stays empty). The project also discards IPs (D77).
  - **The desk and the board identify the visitor by a pseudonymous id.** `lib/analytics/person.ts`: `ws_` + the first 32 hex characters of an HMAC-SHA256 of the workspace user id. The key is itself an HMAC of `CRON_SECRET` with the fixed purpose string `laptracker posthog person v1`, so no new secret is needed and this value matches no other use of the secret. The raw id never leaves the server; without `CRON_SECRET` nobody can tell whose id it is. The same person keeps the same id across days and devices. A new `CRON_SECRET` makes new ids, and PostHog then counts everyone as new once.
  - Person properties are `tier` (`officer`, or `member` on the board; an officer previewing the board is `officer`) and `workspace` (the slug), nothing else: no name, email or Discord id. `SignedInFrame` renders `AnalyticsPerson` with the id for officers, and `/w/[slug]/board` does the same for both tiers (`BoardAccess.userId`, used for nothing else). The page computes the id only when analytics is on (`analyticsKey`). Because nothing is stored on the device, identify runs again on every page load. On a cookieless page load (one that started on a public page and then reached the desk by a client-side navigation) `identify` does nothing: a lasting id there would undo the cookieless mode, so those events stay counted by the daily hash.
  - `person_profiles` is now `identified_only`: only desk and board people have profiles; public and `/admin` events stay personless.
  - **Sign-out calls `posthog.reset()`** (`SignOutButton`), so later events on that page load belong to no one.
  - Masking and replay rules on `/w` and `/admin` are unchanged (D77).
- **Readable errors.**
  - **Exception messages are scrubbed, not masked, in every area** (`scrubMessage` in `lib/analytics/sanitise.ts`). The type, the words and the stack frames' file, line and function stay. The scrubber:
    - replaces digit runs with `#`;
    - replaces emails with `[email]`;
    - cuts the query string and hash from URLs;
    - replaces anything between quotes with `…`. Each quote closes with its own kind (`"…"`, `'…'`, `` `…` ``, `‘…’`, `“…”`), and a quote with a letter or digit on its outer side is an apostrophe, not a delimiter: `can't access property "Bramble"` becomes `can't access property "…"`, and `it's 'Ana'` becomes `it's '…'`.
  - One exception to the quotes rule: after `reading`, `setting` or `evaluating`, a quoted path stays when every part of it is a built-in member from a fixed list (`map`, `length`, `filter`, `then`, `forEach`, `push`, `toString`, `includes` and the like), an index, or a one-letter minified variable: `(reading 'map')` and `(evaluating 'e.children[0].length')` stay. Anything else goes, because an object keyed by names puts a name in the engine's quotes: `(reading 'Bramble')`, `(setting 'DragonSlayer99')` and `(evaluating 'byName.Bramble')` become `'…'`. `$exception_list[].value`, `$exception_values` and `$exception_message` are all scrubbed.
  - Remaining risk: a name that our code puts into a message without quotes would pass. No code does that today: our errors are codes. The D77 reason for masking whole messages ("a pattern rule misses values printed some other way") is accepted as a trade-off at the owner's request.
  - **Route context.** Every event carries `section` (the tab, from a closed list) besides `area` and `workspace`. `app/error.tsx` and `app/global-error.tsx` send the error they catch with `boundary: "page"` or `"root"`. React handles those errors, so autocapture never saw them before.
  - **Source maps** (`scripts/sourcemaps.ts`, run by `pnpm build` after `next build`):
    - With `POSTHOG_PERSONAL_API_KEY` set, `next.config.ts` turns on `productionBrowserSourceMaps`. Then `posthog-cli sourcemap process --directory .next/static --delete-after --release-name laptracker --release-version $VERCEL_GIT_COMMIT_SHA` injects chunk ids into the chunks, uploads the maps to project 741657 and deletes them. A failed upload, or one that runs past 120 s (`UPLOAD_TIMEOUT_MS`, then the CLI is stopped), is logged and does not fail the build; the site ships with minified stacks. The CLI runs with only `PATH`, `HOME` and the `POSTHOG_CLI_*` variables: never the database URL or any other variable of the build.
    - Without the key (local, CI, any deployment without it), no map is built and nothing is sent.
    - Either way, every `*.map` left under `.next/static` is deleted, so maps are never served.
    - The key is passed only in the CLI's environment (`POSTHOG_CLI_API_KEY`) and never printed.
    - The CLI, not `@posthog/nextjs-config`: the Next plugin wraps the same CLI and also brings `@posthog/webpack-plugin`, `@posthog/plugin-utils` and `semver`. This build uses Turbopack, not webpack, and its newest release (1.12.2) is under two weeks old. A step after the build covers Next 16's Turbopack output. The `no-external` SDK reads the chunk ids the CLI injects (`_posthogChunkIds`).
    - Not checked here: the injection and the upload need a real key, because the CLI resolves the release on PostHog first. They are checked on the first production build (owner's step 4).
  - **The real TypeErrors** on `/w/ogs/thefts`, `/w/ogs/notices/new` and `/w/ogs/calendar/caravans` (the PostHog MCP could not open project 741657, so the issues were not read):
    - The forms on those pages made their D100 request id with `crypto.randomUUID()` while rendering. Safari before 15.4 and older Android WebViews do not have it.
    - Reproduced on a local production build with `randomUUID` removed: "Add" on Thefts and the new-notice editor both fell to "Something cracked."; the calendar's entry form, used from Caravans, has the same call.
    - Fixed: `app/(private)/_ui/request-id.ts` (`newRequestId`) uses `crypto.randomUUID` when it exists and otherwise builds a v4 UUID from `crypto.getRandomValues`, which the routes' `z.uuid()` accepts. All 16 calls in `app/(private)/_ui` use it, the three in the share-thanks sheet (D114) among them.
    - After the fix both screens render in that browser.
- **Server errors.** `recordAppError` (`lib/app-errors.ts`) also sends a `$exception` to PostHog: the error's class name, the `kind` and the route pattern. It is sent for every error, before the one-insert-per-second gate (which only spares the database), through `after()`, so the error path never waits for it; outside a request (instrumentation's `onRequestError` start-up, tests) it is just started. The message, stack and cause are not sent: they stay in `app_errors.detail` for `/admin/errors` (D61), because a message may be built from private data (D71).
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
  - thanks: `ws_thanks_shared` with `to`: `board` or `discord` when that share went through, `game` when the text was copied for the game (`ShareThanksEdit`, D114).
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

**Amendment (owner, 2026-11-18, PR #415): the analytics question on public pages, and desk adoption events.** The "Unique users" lines above were rewritten to match it (review, 2026-11-18).

- **The analytics question.** A page load that starts on a public page runs with `cookieless_mode: "on_reject"` and `opt_out_capturing_by_default: true`, and `persistence: "localStorage+cookie"`.
  - **No answer, or "No thanks":** PostHog counts the visitor by the daily hash, stores nothing, and records nothing. Events go to `/ingest/c`, so only they carry the visitor's IP.
  - **"Allow":** PostHog uses its cookie and local storage (`opt_in_capturing`, which also sends `$opt_in`), events go to `/ingest` with no IP, and the page is recorded in 25 % of page loads as D77 had it, with D77's masking.
  - The answer is kept in this browser's local storage (`lap_analytics`, `granted` or `denied`, `lib/analytics/consent.ts`) only once the visitor answers. Before that, nothing is stored. An answer given on the bar applies to the page load at once (`answerConsent` in `lib/analytics/posthog.ts`).
  - **The bar** (`app/_ui/AnalyticsConsent.tsx`): fixed to the bottom of the page, so nothing on the page moves when it appears (checked: the heading did not move). It shows on a public page until the visitor answers on this device, with "Allow" and "No thanks" of the same weight, 44 px high. The desk, the board and `/admin` never show it.
    - The footer's "Analytics choices" (`AnalyticsChoices.tsx`) opens it again.
    - Both appear only where analytics is on (production with `POSTHOG_KEY`).
  - **Copy** (`copy.consent`): EN, PT-BR and FR as asked, and the other 14 public languages too, because D48's check requires every public key in every language.
  - **Unchanged:** desk, board and `/admin` page loads (`memory` persistence, replay, no question). `identify` does nothing while a page load is cookieless (no answer or "No thanks", then a client-side visit to the desk).
- **Desk adoption** (`docs/analytics/tracking-plan.md`):
  - **`ws_action`:** every write route under `/api/w/[slug]` reports a 2xx answer through `counted` (`lib/private/desk-action.ts`) as `ws_action`, with `feature` and `action` from closed lists (`DESK_FEATURES`, `DESK_ACTIONS` in `lib/analytics/server.ts`).
    - It is sent on the officer's pseudonymous id, the same id the page identifies, so funnels can mix browser and server events. It is sent after the response (`after`).
    - A refused write is not counted. Nothing about what was written is sent.
    - Server-side because it counts writes that were stored, which a click in the browser cannot tell.
  - **`ws_board_section_viewed`** with `board_section` (`week`, `notices`, `start_here`): once per page load for each board section that comes on screen. The property is not named `section`, because `before_send` sets `section` to the tab.
  - **Thanks:** `ws_thanks_shared` now also counts "Copy for the game" (`to: game`), through `CopyButton`'s `onCopied`.
  - **The plan lists the questions and the insights and funnels to build.** `lib/analytics/events.test.ts` fails if an event, a desk feature or a desk action in the code is missing from the plan.
- **Checks (2026-11-18).**
  - `pnpm check` exits 0.
  - Local production build with a fake project key, every PostHog request kept on the machine: the consent run passes 26 of 26 checks, and the earlier run passes 26 of 26 again.
  - Screenshots of the bar at 360 and 1280, light and dark, EN and PT.

**Amendment (review, 2026-11-18, PR #415):**

- **Separate consent records.** Public page loads keep posthog-js's consent in their own record (`consent_persistence_name: "lap_ph_public_consent"`). With the default record, a "No thanks" on a public page was read by every later desk and `/admin` load, which then captured nothing.
- **`identify`** is skipped on any page load with a `cookieless_mode`, allowed or not.
- **"Analytics choices"** is not shown on `/admin`. Opening the bar from the footer moves focus to its first button.
- **`ws_action`:** `shots/read` counts as `screenshot` / `read_text`. A request replayed with the same id is counted again, because the routes cannot tell a replay apart.
- **Copy:** the bar says "no tracking cookie is stored".

**Amendment (owner, 2026-11-19, `fix/cookie-bar-copy`): shorter bar copy.** The owner found the question clumsy and asked for the short, direct wording most sites use. The bar's English is now:

- Text: "We use cookies to see how the site is used. You can say no; we'll still count visits without them."
- Buttons: "Accept" and "Decline" (were "Allow" and "No thanks"). They keep the same style, side by side, 44 px high.
- The bar's accessible name: "Cookies" (was "Analytics").
- The footer link: "Cookie settings" (was "Analytics choices").

This replaces the 2026-11-18 review line that the bar says "no tracking cookie is stored", and the bar no longer says that typed text is never recorded. Neither behaviour changed: only the wording did. PT-BR and FR are the owner's wording; the other 14 public languages say the same thing and are stamped (D48). The layout is unchanged: text above the two buttons on phones, one row from 640 px. At 360 px the bar is 118 px high in EN and PT (158 px with the old text) and 138 px in FR (178 px); at 1280 px it stays 69 px.

**Amendment (owner, 2026-11-19, issue #452, `session/11ax-analytics-alliance`): every event says which alliance it came from.** The slug was only a person property, which holds the latest value and cannot split events. Now every event from a workspace carries two plain properties: `workspace` (the slug) and `alliance` (the public tag from `config/alliances.ts`). No PostHog groups: they are a paid add-on. Neither value is personal data. Member names, uids and Discord ids are still never sent.

- **Browser.** Desk and board page loads register both as super properties (`registerWorkspace`, from `AnalyticsPerson`).
  - Sign-out unregisters them before `reset`.
  - A client-side visit off `/w/<slug>` unregisters them, and `before_send` removes both from any event off `/w/<slug>`, so public and `/admin` events never carry them.
  - A page load that started on a public page never registers them, as it never identifies, so cookieless loads are unchanged.
- **Server.**
  - `ws_action` always.
  - `$exception` when the route is under `/w/[slug]` or `/api/w/[slug]` and the slug names a workspace. `withContext` takes the slug on those routes; instrumentation reads it from the request path. The workspace is looked up after the response.
  - `$ai_generation`: `AppContext.ai` is now made for the asking workspace. Discord Translate finds the workspace by the guild id.
- **The squads read** sends no PostHog event. Its count lines in run_logs (`squads.batch`, `squads.skip`) now carry `workspace` and `alliance` too.
- `discord_command_used` carries them too when the command came from a workspace's Discord server (owner, 2026-11-19). It never carries the guild id.
- The tracking plan's test fails if a table row naming a `ws_*` event does not list `workspace` and `alliance`. The plan has a "By alliance" section with the insights to build.
- Replay batches (`$snapshot`) get no super properties from posthog-js, so they keep only `workspace` from the path. A recording is found by alliance through its session's other events.
- **Verification note for every later analytics e2e (owner, 2026-11-19).** posthog-js drops every event from a browser that looks automated. It checks `navigator.webdriver` and the user agent. An e2e must hide `navigator.webdriver` (and `navigator.userAgentData`) in an init script and use a normal browser user agent, or it catches no browser events. The 11ax check also needs a remote config with `sessionRecording.endpoint` for replay to start.
- **Checks (2026-11-19).** `pnpm check` exits 0. On a local production build with every PostHog request caught, 37 of 37 checks pass: desk, board, `ws_action`, `$ai_generation`, `$exception` from a route and from a page render, a public visit, sign-out, Discord Translate, and no invented name or Discord id in any request.

**Amendment (owner, 2026-11-21, issue #486, `feat/onboarding-analytics`): onboarding events and the setup funnel.**

- Two browser events: `ws_key_saved` (`state`, the key's state after "Save and test", D124; a refused key is not counted) and `admin_feature_changed` (`feature`, a D126 switch or `ai_cap` / `translate_cap`; `on`, on afterwards, a cap not 0). The /admin one fires only when the value changes; Reset sends the workspace's default.
- One server action: `ws_action` `workspace` / `create`, sent by `POST /api/w/invite` after "finish" made the workspace, on the new officer's pseudonymous id with `workspace` and `alliance`. It is the setup funnel's first step. Nothing new is sent: the same id and properties as every desk write.
- The way in (request, approval, invite opened and completed) cannot be one funnel with the setup. The request has no id, the approval is the owner's, a signed-out `/w` page gets a new id on every load, and nothing before the workspace carries `workspace`. The tracking plan shows it as weekly counts.
- The setup funnel is aggregated by `workspace` and uses server `ws_action` steps: browser events are lost when a tab closes, to ad blockers, and outside production. `ws_bot_installed` is no setup step, because an invite's "finish" marks the bot seen.
