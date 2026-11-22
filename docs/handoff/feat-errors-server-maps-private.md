# feat/errors-server-maps-private — server stack traces readable, lib/private reports, URL masking

The owner-approved follow-up to PR #598 (part of #592). Size M: a new external call at build time, and a change to how `lib/private` handles errors. Plan and checks: `.specs/features/errors-server-maps-private/plan.md` and `checks.md`.

## Built

- **Server source maps** (`scripts/sourcemaps.ts`). After `next build`, `posthog-cli sourcemap process` runs for `.next/static` and then for `.next/server`. Both runs use the same key, the same environment filter (PATH, HOME, POSTHOG_CLI_*), the same release and a 120 s cap each.
  - Before each run, every chunk that has a `.js.map` is copied to a temp folder. If the run fails or times out, those chunks are copied back. A CLI stopped while rewriting a chunk can no longer ship a cut-short file.
  - After both runs, every `*.map` left under either directory is deleted, with or without the key.
  - The build line names each directory's result, for example `source maps: .next/static uploaded, .next/server upload failed (exit 1); 1053 left-over map files deleted`.
- **Frames carry `chunk_id`** (`lib/analytics/server.ts` `stackFrames`). PostHog resolves a JavaScript frame by its `chunk_id`. `@posthog/core` reads it from `globalThis._posthogChunkIds`, which the snippet the CLI injects fills when a chunk loads. Our server builds `$exception` by hand, so `stackFrames` now does the same lookup: a frame in an injected chunk carries that chunk's id.
- **`AppContext.report`** (`lib/app-context.ts`, `lib/report-error.ts`).
  - Its shape is `report(error, { route, kind })`.
  - `reporter(ctx)` builds it for `getAppContext` and for `testContext` alike. It reads only `route` and `kind` and calls `reportError`, which sends a redacted, `handled: true` `$exception`.
  - `ReportContext` is a closed union of literal module/code pairs.
- **Six `lib/private` catches now report:**

  | Where | `kind` | How it reaches `report` |
  | --- | --- | --- |
  | `frameReadStatus` | `w.read_status.failed` | `getAppContext()`, already read there |
  | `matchOnRead` | `w.pending.match_failed` | `getAppContext()` |
  | `runJob` failure | `w.import.discord_failed` | `JobDeps.report = ctx.report`, set in `app/(private)/api/discord/interactions/route.ts` |
  | `runJob` cleanup | `w.import.settle_failed` | `JobDeps.report` |
  | `opened` (a sealed webhook that does not open) | `w.webhook.open_failed` | `getAppContext()` |
  | invite `syncCommands` | `w.invite.commands_failed` | `getAppContext()` |

  Each catch still does what it did before: a log line, a null, a fallback, or the reply.
- **Browser SDK** (`lib/analytics/posthog.ts`): `mask_personal_data_properties: true` and `custom_personal_data_properties: PERSONAL_QUERY_KEYS` (`["m", "q"]`).
- **Docs:**
  - a dated amendment to D115 (maps, chunk ids, `AppContext.report`, the six catches, URL masking, IPs);
  - the tracking plan's server `$exception` row and a dated "Changed" line;
  - ARCHITECTURE's dependency line (`lib/app-context → lib/report-error`);
  - an owner to-do in `lib/patch-notes.ts`.
- **Tests** (one per behaviour):

  | Behaviour | Test |
  | --- | --- |
  | The server's maps are uploaded after the browser's, and none is left in `.next/server` | `scripts/sourcemaps.test.ts` "uploads the server's maps after the browser's…" |
  | A stopped run never ships a cut-short chunk; a finished run keeps its chunk ids | `scripts/sourcemaps.test.ts` "never ships a chunk the CLI was stopped while rewriting…" |
  | A frame in a chunk loaded with the CLI 0.19.0 snippet carries its `chunk_id`; other frames carry none | `lib/analytics/server.test.ts` |
  | A `lib/private` catch calls `report` with exactly `{ route, kind }` | `lib/private/read-status.test.ts` "reports the failure to error tracking…" |
  | The report is redacted: a drafts insert that fails during a Discord import sends `params: …`, and the invented name in the read lines appears nowhere in the batch | `lib/private/discord-interaction.test.ts` |
  | The init options are present on public and desk loads | `lib/analytics/posthog.test.ts` |

  The existing `sourcemaps.test.ts` cases now cover both directories, because the step's behaviour changed on purpose.

## Decisions

- **Which catches report.** Only a catch that hides a failure of our own code, database or crypto, and ends in a code line or nothing. The catches that turn an expected failure into a result still do not report, as D115's "Not reported, on purpose" says:
  - bad input (`new URL`, `JSON.parse`, time zones, signatures);
  - Discord and Groq network failures that are already turned into a reply;
  - refused pictures;
  - closing a dropped OCR worker.
- **`getAppContext()` inside the catch** where the function has no deps built from `ctx`, as `frameReadStatus` already does. Pages and routes keep their signatures. `runJob` already receives deps that its route builds from `ctx`, so `report` goes there.
- **The context is closed by its type.** Plan review asked for it: a template string with a name in it no longer type-checks. A new catch adds its pair to `ReportContext`, which is the review point.
- **Copy aside and put back** instead of splitting `inject` and `upload` into two commands. `inject` also needs the network (it resolves the release), so it can hang as well. Putting the chunks back covers both.
- **No new dependency, no new env variable.** posthog-cli 0.19.0 and posthog-js 1.444.4 are already installed.
- **Init option names** come from the installed typings: `@posthog/types` 1.425.1 `posthog-config.d.ts`, which posthog-js 1.444.4 resolves. `mask_personal_data_properties` also feeds `getPersonInfo`, `posthog-persistence.js:1625`, which keeps the first URL and referrer in the SDK's storage before `before_send` runs. `m` is the open member card (a uid, D122). `q` is a typed name (`/players?q=`, the Members search). The other query keys are filters with fixed values.
- **IP recommendation: keep discarding client IPs. No code change.**
  - Nothing reads location. The tracking plan has no geo property and no geo question. The two D145 Endpoints (`lap_board_reach`, `lap_alliance_usage`) do not read `$geoip_*`. `lib/` and `app/` never set or read `$ip` or `$geoip`.
  - A located IP would mostly be wrong anyway. Server events come from Vercel's address. Desk, `/admin` and replay requests carry no visitor IP (D77). With cookieless mode, PostHog strips the IP before GeoIP (D115).
  - The one place the visitor's IP is sent on purpose is a cookieless public load, which needs it for the daily hash, and PostHog drops it after.
  - posthog-js's `ip` option has no effect in 1.444.4. Its typing says to use the "Discard IP data" project setting instead. D77 records that the project discards IPs.
  - Owner to-do (added to `ownerTodo`): check that "Discard client IP data" is still on in project 741657's settings.
- **Plan review verdicts** (full text in plan.md § Plan review):
  - Product strategy: approve with changes.
  - Adversarial (privacy, D71, build security): approve with changes.

  Taken: the truncation guard, the closed context type, and a real-build check. The build-time, duplicate-report and `/admin/errors` notes went into the plan. Declined, with reasons in plan.md § Out of scope: a skip switch, rate-limiting, `failureCode` as `kind`.

## Deviations

- The task said the `lib/private` lint fence forbids analytics. It forbids only `lib/notify*` and `lib/discord-*`, and `lib/private` already imports `lib/analytics/events`. The fence is unchanged.
- `testContext` (`lib/app-context.test-helpers.ts`) now has `report`. It uses production's `reporter`, so the redaction test covers production's wiring. A first version had its own copy of the wiring, and a deliberate break of production's would have gone unseen.
- `jobDeps` (`lib/private/discord-interaction.test-helpers.ts`) gets a no-op `report`.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest (298 files passed, 2 skipped; 1,566 tests passed, 4 skipped), drift (no schema change) and i18n (17 languages up to date).
- Each new test fails when the code is broken on purpose. Each break was reverted after its run.

  | Break | Result |
  | --- | --- |
  | `MAP_DIRS` without `.next/server` | 5 of 6 `sourcemaps` tests fail |
  | The restore after a stopped run removed | the cut-short-chunk test fails |
  | `chunk_id` not set on frames | the server frames test fails |
  | An extra `slug` key in the `read-status` report context (forced past the type) | the closed-list test fails |
  | The `read-status` report call removed | the closed-list test fails |
  | `reporter` sending the raw message straight to `captureServer` instead of through `reportError` | the redaction test fails |
  | `mask_personal_data_properties` removed | the init-options test fails |
  | `m` dropped from the keys | the init-options test fails |

  Breaking only `appErrorDetail`'s redaction did not fail the redaction test. `sendException`'s `scrubMessage` runs `redactPrivate` again, so it is a second layer, not a gap.
- Real build: a local `next build` (Next 16.4.5, Turbopack) wrote 1,053 maps under `.next/server` and 0 under `.next/static` (no key). No `.nft.json` lists a `.map`, so deleting them cannot break Vercel's function tracing.
- Real chunks with the snippet: a scratch script put the CLI 0.19.0 snippet into a copy of every mapped server chunk, as `inject` does (1,052 files). Every one parses, and the 918 under `chunks/` load with `require` and record their chunk id.
- Not run: a real `posthog-cli sourcemap inject` or upload. It needs the key, which this machine does not have, and it would write to PostHog. The snippet was read from the 0.19.0 binary.
- Not run: `next start`. The pages need the database, and `.env*` was not read.
- The Verifier sub-agent of `/tlc-spec-lean` was not dispatched. The skill reserves that for the orchestrator, over `origin/dev..HEAD`.

## Open issues

- `/admin/errors` keeps the minified server stack. PostHog Error Tracking is the readable view.
- The first deploy with the key will take longer. The server upload may take up to 120 s; its real time is unknown until the first Vercel build log. If it times out every time, raise `UPLOAD_TIMEOUT_MS` or the CLI's `--concurrency`.
- Follow-ups, not built:
  - `lib/private/discord-translate-run.ts:99` turns any error that is not a `ChatError` (a bug of ours) into `ChatError("failed")` and reports nothing.
  - `report` is not rate-limited. A database outage sends one event per failed page read; PostHog groups them into one issue.
  - Server `$exception` carries no release id (`$exception_release_id`). It is not needed to resolve frames, only to group issues by release.
- `fixtures/screenshots/98-alliance-duel-weekly-phone.txt` (existing, not touched here) holds what look like real in-game names. The new test replaces one line with an invented name and asserts only on that name.

## Next

- Model/effort: keep. The work was mostly reading the SDK and CLI internals, at the right depth.
- Owner first:
  1. Merge and release.
  2. In the first production build log, read the `source maps:` line. Both directories should say `uploaded`.
  3. Open one server issue in PostHog → Error tracking and check that its frames name `lib/…` or `app/…` files.
  4. Check the IP setting (`ownerTodo`).
  5. Optional: add an Error Tracking alert on the new `w.*` kinds, with the existing alerts to-do.
- Plan change: none.

<adjustments>
- A `lib/private` catch that swallows a failure of our own code calls `report(error, { route, kind })` from `getAppContext()` or from deps built from `ctx`, and adds its pair to `ReportContext` in `lib/report-error.ts`. It never imports `reportError` directly.
- Server frames resolve in PostHog only for chunks whose upload finished. A failed or stopped upload puts that directory's chunks back without ids.
- New query keys that carry a person go in `PERSONAL_QUERY_KEYS` (`lib/analytics/posthog.ts`).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/615
