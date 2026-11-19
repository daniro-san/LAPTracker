# 11ax — Every PostHog event says which alliance it came from (issue 452)

## Built

- **One helper for the two values**: `eventWorkspace({ slug, unionId })` in `lib/analytics/server.ts` returns `{ workspace: slug, alliance: tag }`. The tag comes from `config/alliances.ts`, and is null only if the alliance has left that list. No PostHog groups.
- **Browser** (`lib/analytics/events.ts`, `posthog.ts`, `sanitise.ts`):
  - `registerWorkspace(workspace, alliance)` registers both as super properties. `AnalyticsPerson` calls it before `identify`, so it runs on desk loads (`SignedInFrame`) and on board loads. `analyticsPerson` now takes `slug` and `unionId` and returns `alliance`.
  - It does nothing on a page load that started on a public page, the same rule as `identify`, so cookieless loads are unchanged.
  - `forgetPerson` (sign-out) unregisters both before `reset`.
  - `followPath` unregisters both on a client-side visit to a page outside `/w/<slug>`. It skips any page load that started on a public page.
  - `before_send` removes `workspace` and `alliance` from every event outside `/w/<slug>`. This is needed because the public page's `$pageview` is captured before `followPath` runs.
- **Server**:
  - `ServerEvent` has `where?: EventWorkspace`, and `ws_action` requires it. `wireProperties` adds both values to the event.
  - `counted` (`ws_action`) passes the access's slug and alliance.
  - `$exception`: `AppErrorEntry` has an optional `slug`. `recordAppError` looks the slug up after the response, only when analytics is on, and adds both values only when a workspace has that slug. A failed lookup sends the event without them.
  - The slug reaches `recordAppError` three ways:
    - `withContext(route, slug, handler)`, a new overload. All 33 handlers under `/api/w/[slug]` pass their slug.
    - The share target `/w/[slug]/share` passes it.
    - `instrumentation.ts` reads it from the request path when the route path contains `/w/[slug]`. The route path is the source file's, e.g. `/(private)/w/[slug]/thefts/page`; checked in the build.
  - `$ai_generation`: `AppContext.ai` is now `((where) => ChatModel) | null`. The notice and thanks draft routes call `ctx.ai?.(eventWorkspace(access))`.
  - Discord Translate: `TranslationJob.workspace` is set from the workspace the command already found by guild. A language button and a "for everyone" post look the workspace up by `input.guildId`. The interactions route builds the model with `ctx.ai?.(job.workspace)`.
  - `discord_command_used` (owner, 2026-11-19): the interactions route adds the workspace from the import job's access, or from the translation job's `workspace`. It never sends the guild id.
  - Squads read: the run_logs lines `squads.batch` and `squads.skip` carry `workspace` and `alliance`, from `SquadTarget.slug`. `sealedKeys` now selects the slug.
- **Tracking plan** (`docs/analytics/tracking-plan.md`):
  - A rule on which events carry the two values.
  - `workspace` and `alliance` in every table row that names a `ws_*` event.
  - A `ws_action` row in "Server-side signals".
  - The new properties on `$exception`, `$ai_generation` and `discord_command_used`.
  - A note on the squads lines.
  - A "By alliance (issue 452)" section of insights: adoption, features, tabs, board adoption, AI calls and tokens (#450), and errors, each broken down by `alliance`.
- **D115**: a dated amendment for issue 452.
- **Tests** (one per stated behaviour):
  - `events.test.ts`: the plan test requires `workspace` and `alliance` in every table row that names a `ws_*` event, `ws_action` included. A second test checks that the values are registered on a desk load, not on a public-started load, and that sign-out clears them. Its stand-in `reset` clears nothing, so the test proves sign-out's own unregister.
  - `server.test.ts`: `wireProperties` adds both values when the event has a workspace, and none otherwise.
  - `desk-action.test.ts`: `ws_action` carries `ogs` / `OGs`.
  - `app-errors.test.ts` (PGlite): a slug of a workspace gives `$exception` both values; an unknown slug gives neither.
  - `sanitise.test.ts`: events on public and `/admin` paths lose both; desk events keep them.
  - `posthog.test.ts`: `followPath` unregisters both off the desk, and never on a public-started load.
  - `squads-read.test.ts`: the skip line carries `ogs` / `OGs`.
  - `person.test.ts`: the person props carry `alliance`.

## Decisions

- **`/api/w/[slug]` counts as "under `/w/[slug]`"** for `$exception` (confirmed by the owner, 2026-11-19).
- **`discord_command_used` carries both values** (owner, 2026-11-19), although the issue did not list it.
- **The slug is checked against the database before it is sent.** `recordAppError` sends `workspace` only for a slug that names a workspace, so text typed into a URL never reaches PostHog as a workspace.
- **`before_send` removes both values outside `/w/<slug>`, `/admin` included**, as well as the unregister the issue asks for. Without it, the first public `$pageview` after a client-side visit from the desk would carry them.
- **"Squads read counts" = the run_logs lines.** The squads read sends no PostHog event (11ai handoff), so its count lines got both values. No PostHog event was added.
- **The tag is `string | null`** in the type. A workspace can only be made for a tracked alliance; null covers an alliance later removed from `config/alliances.ts`.

## Deviations

- **Replays**: the issue says replays carry both values. posthog-js puts no super property on `$snapshot` batches: they carry only `distinct_id` (checked in posthog-js 1.444.4 and in the e2e). Replay batches keep `workspace` from the path (`before_send`) but not `alliance`. A recording is found by alliance through its session's other events, which all carry it. The plan says so.
- **Signed out on `/w/<slug>`**: after sign-out, events still carry `workspace` from the path, because `before_send` has added it since D115. They lose `alliance` and the officer's id. The issue's "unregister on sign-out" holds for the registered values.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, **220 test files, 1191 tests** (4 skipped), drift and i18n.
- **Local production build** (`pnpm build`, no source maps): `next start` on :3991 with `VERCEL_ENV=production` and a fake project key, local Postgres (50 migrations), the OGs workspace on an invented guild, the Discord stand-in, and a preload that caught every PostHog request (39 in the final run; nothing reached PostHog) and answered Groq with an invented sentence. **37 of 37 checks pass** (`e2e.mjs`). The checks:
  - Public load: one cookieless `$pageview` with neither value, and nothing stored on the device.
  - Desk after sign-in: `$identify`, `ws_sign_in_completed` and `$pageview` all carry `ogs` / `OGs`, on the `ws_…` id. Replay batches carry `workspace` `ogs`.
  - Board: `$pageview` (`section` `board`) and 3 `ws_board_section_viewed` carry both values.
  - `ws_action` from a profile rename carries both values, on the same `ws_…` id.
  - `$ai_generation` from a notice Translate carries both values and no text.
  - `$exception` from a real 500 in `POST /api/w/ogs/thefts` carries both values. To cause it, the `thefts` table was renamed for a moment and renamed back.
  - `$exception` from a real render error on `/w/ogs/thefts`, through instrumentation, carries both values.
  - A client-side visit from the desk to `/players` (Next's router, same page load): the `$pageview` there carries neither value.
  - Sign-out, then an error thrown in the page: the browser `$exception` has no `alliance` and is not on the officer's id.
  - A signed Discord "Translate for me" from the workspace's guild: `$ai_generation` and `discord_command_used` carry both values.
  - No page error on the desk.
  - Across every caught request: no invented name (Ana, Wrenna, Thistle, Pip), no Discord user id, no guild id, no interaction token.
- Scripts and results are not committed. They are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ax/`: `e2e.mjs`, `e2e-results.txt`, `preload.mjs`, `make-env.mjs`, `seed.sql`, `start.sh`, `build.log` and `check.log`.
- No UI changed, so there are no screenshots.

## Open issues

- **An extra database connection per server error under a workspace.** It opens after the response, only with analytics on. If the database is down, the lookup fails and the event goes without the values.

## Next

- Model/effort: keep. One sitting covered the code, the tests and a 37-check e2e.
- What the owner must do first: merge and release. Then, in PostHog project 741657, build the insights in the plan's "By alliance" section. Events from before the release have no `alliance`.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
- **Rule for every later analytics e2e** (owner, 2026-11-19; also in D115): posthog-js drops every event from a browser that looks automated. It checks `navigator.webdriver` and the user agent. Hide `navigator.webdriver` (and `navigator.userAgentData`) in an init script, and use a normal browser user agent. Without both, the e2e catches no browser events. For replay to start, the stand-in remote config must also include `sessionRecording.endpoint`.

<adjustments>
- A new server event sent for a workspace must pass `where: eventWorkspace(access)`. `ws_action` already requires it in the type.
- A new route under `/api/w/[slug]` should call `withContext(ROUTE, slug, handler)`, so that its errors carry the workspace.
- A new AI caller takes `ctx.ai?.(eventWorkspace(access))`, not `ctx.ai`. The #450 caps can count `$ai_generation` by `alliance`.
- A new table row in the tracking plan that names a `ws_*` event must list `workspace` and `alliance`, or `pnpm check` fails.
</adjustments>

PR: (added by the orchestrator)
