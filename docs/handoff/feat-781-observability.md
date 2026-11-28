# feat-781-observability: release and commit on errors, start and failure events for sign-in, share thanks and screenshot import (issue 781)

Branch `feat/781-observability` from `origin/dev` (959b8851). Code parts of issue 781 only. Nothing changed in PostHog (no alert, suppression rule or dashboard). No new decision, dependency, migration or route. No private field reaches any event.

## Built

- **Server `$exception` (`lib/report-error.ts`, `lib/analytics/server.ts`)**: gains `release` (`process.env.BUILD_VERSION`, the footer's version that `next.config.ts` inlines at build, D59: `v5.70.0` on production) and `commit` (`VERCEL_GIT_COMMIT_SHA`, Vercel's run-time system variable). `lib/env.ts` reads `VERCEL_GIT_COMMIT_SHA` as an optional, non-secret value (7-40 hex characters). The `$exception` wire properties moved into `exceptionProperties()` to keep `ownProperties` under the lint complexity limit. Nothing else in them changed.
- **Browser `$exception` (`lib/analytics/posthog.ts`)**: `before_send` adds `release` (the same `BUILD_VERSION`) to `$exception` events only. It is not a `register` super property, because on a public page load `register` would write to storage before consent.
- **Sign-in (server events, `lib/analytics/server.ts`, `lib/private/sign-in.ts`)**:
  - `ws_sign_in_started { via: workspace | chooser, silent }` from `/api/w/[slug]/login` and `/api/w/login`.
  - `ws_sign_in_failed { via, reason }` from those routes and from `/api/w/auth/callback`. `reason` comes from the closed list `SIGN_IN_FAILURES`: `rate_limited`, `bad_state`, `not_configured`, `denied`, `discord`, `none`, `not_member`, `no_role`, `board_closed`, `allowlist_expired`, `blocked`.
  - The `Step` a redirect returns carries `failure` (the reason, set where `lib/private/sign-in.ts` and `lib/private/chooser.ts` build a failure redirect) and `authorize` (set on the redirect to Discord's authorize page). `signInFailure(step)` reads a refusal's code or `failure`, never the URL: a successful landing's return path may hold `?e=denied` (PR 798 review). `refusal.why satisfies SignInFailure` makes tsc fail if `NoAccess` and `SIGN_IN_FAILURES` drift.
  - `countSignIn` sends `ws_sign_in_started` only for a step marked `authorize`: an unknown slug and `not_configured` are no start. It sends after the response (`sendLater`), with the fixed server id, no person, no slug and no workspace.
  - The invite's sign-in is left out because it has `ws_invite_opened` and `ws_invite_completed`.
- **Share thanks (browser, `lib/analytics/events.ts`, `ShareThanks.tsx`, `ShareThanksEdit.tsx`)**:
  - `ws_thanks_started` when "Share the thanks" opens.
  - `ws_thanks_failed` with one of two shapes:
    - `{ stage: draft, reason }`: the writing help gave no text. `reason` is `busy`, `signed_out`, `lost` or `failed`. A fallback to the template (`not_set_up`, `turned_off`, `cap_reached`) is not counted, because the flow goes on.
    - `{ stage: share, to: board | discord, reason }`: `reason` is `empty`, `posting`, `recent`, `not_set_up`, `signed_out`, `lost` or `failed`.
  - `ThanksFailure` is the closed list for `reason`.
- **Screenshot import (browser, `SendScreenshots.tsx`)**:
  - `ws_screenshot_started` when pictures are picked, before any is read.
  - `ws_screenshot_failed.stage` gains `too_many` and `signed_out`. A signed-out drafts request was sent nowhere before; it now counts as `signed_out`, so `drafts` keeps its meaning.
- **Tracking plan (`docs/analytics/tracking-plan.md`)**:
  - Rows for the new events.
  - `release` / `commit` on both `$exception` rows.
  - A "Sign-in drop" insight.
  - Thanks and screenshot funnels.
  - A dated "Changed" line.
- **Tests (one per behaviour)**:
  - `lib/app-errors.test.ts` "sends the route pattern, the error's class and frames, the release and the commit, and no private value (issue 781)".
  - `lib/private/sign-in.test.ts` "counts a start only on the way to Discord, and a failure's reason code, with nothing else (issue 781)" (real steps: the authorize redirect, an unknown slug, `not_configured`, a refusal; the payload is exactly `{event, via, silent|reason}` plus `$lib` and `$process_person_profile`) and "counts no failure for a sign-in whose return path holds ?e=denied (issue 781)".
  - `lib/analytics/posthog.test.ts` "put the release on an exception, and on no other event (issue 781)".
  - The new browser events' "only closed-list properties" guarantee is the existing type-level test in `lib/analytics/events.test.ts`, which now covers them. `SERVER_EVENTS` there lists the two new server events.

## Decisions

- **The route pattern, error name and stack were already sent.** `$exception` has carried them since #598 (2026-11-21): `route` is the pattern from `onRequestError`'s `context.routePath` or `withContext`'s first argument, `type` is the error name and `stacktrace` holds the redacted frames. The 29 events of 2026-11-20 named in the issue were sent before #598. The only gap left was the release.
- **`release` is `BUILD_VERSION`, not the SHA.** Production deploys only from `main`, through release merges, so `BUILD_VERSION` is the release tag there, and the same value is on both sides. `commit` (server) adds the exact deploy. No top-level `error_name` was added; it would repeat `$exception_list[0].type`.
- **Sign-in events are server events.** Before sign-in the page has no person, and the trip through Discord starts a new page load with a new random id. A browser funnel from start to end could not link them either, and server events also count when an ad blocker runs.

## Deviations

- None from the task. Not covered: the phone's share target (`/w/[slug]/share`, server-side import) sends no start or failure event; and the reason behind a drafts request that fails (`stage: drafts`) is not split.

## Verified

- `pnpm vitest related --run` on the changed files: 210 files passed, 1 skipped; 1205 tests passed, 1 skipped. After the lint fix, related to `lib/analytics/server.ts` and `ShareThanks.tsx`: 1029 tests passed.
- `pnpm check` passed: prettier, eslint, tsc, vitest, drizzle drift ("nothing to migrate"), i18n (17 languages up to date). The first run failed on two eslint complexity errors (`ShareThanks.tsx` `write`, `server.ts` `ownProperties`). Both were fixed in one round.
- PR 798 review fixes: breaking each on purpose fails its test. Reading the reason from the URL again fails "counts no failure … ?e=denied". Sending the start for every step fails "counts a start only on the way to Discord …". Both were restored.
- No upstream API call was made. Nothing was sent to PostHog: the tests use a stand-in fetch.

## Open issues

- `silent` renewals that fail at Discord come back as `denied` in `ws_sign_in_failed`, the same as a person who pressed Cancel. The callback cannot tell them apart, because the state does not carry `silent`. To separate them, the state would need a flag. The tracking plan says so on the `reason` list.
- `$feature_flag_called` exposure data (raised in the issue) is not part of this change.

## Next

- The orchestrator handles the PostHog settings from issue 781: suppressing the Brave iOS "Script error." noise, and a destination for the "Error spike per workspace" alert.
- After release, build the "Sign-in drop", thanks and screenshot funnels from the tracking plan.
- Follow-up candidates:
  - start and failure events for the phone's share target;
  - `silent` in the sign-in state;
  - feature-flag exposure events.

What was missing from the task prompt? That the route pattern, error name and stack were already on server exceptions since #598; only the release was missing.

PR: (added by the orchestrator)
