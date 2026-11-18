# 11ag — Analytics: real unique users, readable errors, a tracking plan (D115, issue #395)

## Built
- **Unique users** (`lib/analytics/posthog.ts`):
  - A page load that starts on a public page runs in PostHog's cookieless mode. PostHog's servers make a daily-salted hash, so a visitor is one person per day, and nothing is stored on the device.
  - A page load that starts on `/w` or `/admin` keeps `memory` persistence and replay. `person_profiles` is `identified_only`.
- **Pseudonymous identify:**
  - `lib/analytics/person.ts` makes the id: `ws_` + 32 hex of an HMAC of the workspace user id, under a key derived from `CRON_SECRET`.
  - `app/(private)/_ui/AnalyticsPerson.tsx` calls `identify` with the id, `tier` and the workspace slug. `SignedInFrame` renders it for officers, `/w/[slug]/board` for members and officers. `BoardAccess` gained `userId` for this.
  - `SignOutButton` calls `reset`.
- **`/ingest`** sends the visitor's IP as `x-forwarded-for` only on a cookieless page load's events (`/ingest/c/e/`, `/ingest/c/i/v0/e/`), which the cookieless hash needs. Desk, board and `/admin` events, replay batches and the remote config carry none.
- **Scrubbed exceptions** (`scrubMessage` in `lib/analytics/sanitise.ts`), in every area:
  - digit runs → `#`, emails → `[email]`, query strings cut, quoted text → `…`;
  - after `reading`, `setting` or `evaluating`, a quoted path is kept only when every part is a built-in member from a fixed list (`map`, `length`…), an index or a one-letter variable;
  - type and frames are kept.
- **`section`** on every `/w` and `/admin` event: the tab, from a closed list.
- **Error boundaries:** `app/error.tsx` and `app/global-error.tsx` send what they catch with `boundary`.
- **Source maps:**
  - `scripts/sourcemaps.ts` runs after `next build` in `pnpm build`. With `POSTHOG_PERSONAL_API_KEY`: `posthog-cli sourcemap process --delete-after` (project 741657, release `laptracker` at the commit SHA).
  - Without the key, `next.config.ts` builds no maps. Every left-over `.map` under `.next/static` is deleted either way.
  - New dev dependency `@posthog/cli` 0.19.0, its postinstall denied.
- **Server events** (`lib/analytics/server.ts`), one batch to `/batch/` with the distinct id `laptracker-server`:
  - `$exception` from `recordAppError`: class name, kind and route pattern only;
  - `discord_command_used` from the interactions route;
  - `$ai_generation` per Groq request: `groqChat` has an observer, wired in `lib/app-context.ts`. It carries model, tokens, latency, fallback and error code, and no text.
- **Tracking plan:** `docs/analytics/tracking-plan.md`. New browser events:
  - `ws_draft_discarded`, `ws_screenshot_failed`, `ws_updates_pasted`, `ws_text_read`;
  - `ws_notice_fit`, `ws_notice_ai_failed`, `ws_review_requested`, `ws_review_approved`, `ws_notice_published`;
  - `ws_roll_call_marked`;
  - `ws_thanks_shared` (`to`: `board`, `discord`, `game`), from the share-thanks sheet (D114).
- **TypeError fix:** `app/(private)/_ui/request-id.ts` (`newRequestId`) replaces all 16 `crypto.randomUUID()` calls in `app/(private)/_ui`, the three in `ShareThanksEdit.tsx` (D114) among them.
- **Docs:** D115, a D77 amendment, the decisions index, ARCHITECTURE and `.env.example` (`POSTHOG_PERSONAL_API_KEY`).

## Decisions
- **Cookieless only for page loads that start on a public page.** posthog-js refuses session replay in `cookieless_mode: "always"`, and the mode cannot change after `init`. So the mode is chosen per page load from the first page's area, which keeps replay on the desk and `/admin` (D77). Cost: public pages are no longer recorded at 25 %.
- **The salt is derived from `CRON_SECRET` through an HMAC** with a fixed purpose string, so the owner has no new secret to set. Rotating `CRON_SECRET` makes new ids.
- **The CLI, not `@posthog/nextjs-config`.** The plugin adds a webpack plugin this Turbopack build does not use and three more packages, and its newest release is under two weeks old. The CLI runs only when the key is set; its binary is downloaded on first run, because the postinstall is denied (D10).
- **A failed upload does not fail the build.** The site ships with minified stacks, and the build log says so.
- **Server `$exception` carries no message.** The message may be built from private data; it stays in `app_errors.detail` (D61, D71).
- **"Paste updates" now sends `ws_updates_pasted`**, no longer `ws_screenshot_sent`, which counted pastes as screenshots.
- **OpenTelemetry: not now** (D115 gives the reason).

## Deviations
- The PostHog MCP has no access to project 741657 (`switch-project` answered 404; the MCP account sees project 255350 only), so the error-tracking issues were not read. The TypeError cause was found by reproducing it.
- The source-map injection and upload could not run here: the CLI needs a real key to resolve the release, even for `inject`. With a fake key, the build made 55 maps; the CLI ran in its own dry-run mode, which sends nothing; the step deleted all 55. The real upload is checked on the first production build (owner's step 4).
- No screenshots: no UI changed. The two screens the fix restores were checked by their headings and fields in the test browser (below).

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc, vitest **187 files passed, 2 skipped; 989 tests passed, 4 skipped**, drift gate, i18n "17 languages up to date".
- Tests added or changed:
  - `lib/analytics/sanitise.test.ts`: the scrubber, both tests rewritten (names, numbers, emails, query strings and quotes go; engine-quoted code stays), and `section`.
  - `lib/analytics/person.test.ts`: the id is stable, salted and differs per user and per secret. It never contains the raw id. It is off without production analytics.
  - `lib/analytics/server.test.ts`: one batch, the fixed id, no person; nothing is sent when analytics is off; a failed send never throws. `$ai_generation` has no `$ai_input` and no `$ai_output_choices`; `$exception` has no message.
  - `lib/analytics/events.test.ts`: new events take enums only (type-level).
  - `lib/analytics/ingest.test.ts`: the IP goes on `/e/` and not on `/s/`.
  - `lib/ai/groq.test.ts`: the observer gets the model, tokens, fallback and error code, with no text and no key.
  - `scripts/sourcemaps.test.ts`: without the key no upload runs and the maps are deleted. With the key, it goes only into the CLI's environment, and the maps are deleted even when the upload fails.
  - `app/(private)/_ui/request-id.test.ts`: without `crypto.randomUUID`, 50 v4 UUIDs, all distinct, that `z.uuid()` accepts.
- **Production builds:**
  - Without the key: 0 maps, and the log says "nothing uploaded".
  - With a fake key: 55 maps built; the CLI ran in dry-run (nothing sent); 0 maps left.
- **Local e2e, 25 of 25 checks pass.**
  - Setup: `next start` on :3966 with `VERCEL_ENV=production` and a fake project key, the local Postgres (39 migrations), the 11ae invented roster, an invented officer and member, and the 11ad Groq stub. A preload logged every PostHog request; nothing reached PostHog.
  - Public page: cookieless (`$posthog_cookieless`, `$cookieless_mode: true`); the IP header is on event POSTs; no cookie or storage; no replay.
  - Officer on the desk: identified as `ws_…`, with only `tier: officer` and `workspace: ogs`. Sections `home`, `thefts`, `notices` and `calendar` arrive. Replay is sent, and replay batches carry no IP.
  - A thrown `TypeError("No member 'Bramble' at 512, 384")` arrived as `No member '…' at #, #`, with `section: notices`.
  - Translate sent `ws_notice_translated` and 2 `$ai_generation` events, with no text and no key.
  - After sign-out, events are not the officer's.
  - Member on the board: identified with `tier: member` and `section: board`.
  - No page error on the desk pages in Chromium or WebKit (iPhone user agent).
  - No invented roster or officer name in any event; no session cookie forwarded.
- **TypeError reproduction** (browser with `crypto.randomUUID` removed):
  - Before the fix: Thefts → "Add" fell to "Something cracked.", and `/w/ogs/notices/new` showed "Something cracked."
  - After the fix: the theft sheet opens, and the editor shows "New notice" with its title field.
- **Privacy grep:** 1,323 added lines checked against the 101 names of the OGs fixture roster: 0 found.
- Scripts and logs (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ag/`: `e2e.mjs`, `e2e-results.txt`, `old-browser.mjs`, `posthog-preload.mjs` and `build1.log` to `build4.log`.

## Review round (PR 415)
- **Rebased on `origin/dev`**, which has D114 share-thanks. The one conflict was the decisions index (both lines kept); the board page merged as is.
  - `ShareThanksEdit.tsx`: its 3 `crypto.randomUUID()` calls use `newRequestId()`.
  - It sends `ws_thanks_shared`: `board` or `discord` when that share went through, and `game` once the text is on the clipboard. `CopyButton` gained an `onCopied` callback for this.
- **Scrubber quotes** (`QUOTED` in `lib/analytics/sanitise.ts`):
  - each quote closes with its own kind (a backreference for straight quotes, and the `‘…’` and `“…”` pairs);
  - a quote with a letter or digit on its outer side is an apostrophe, not a delimiter.
  - Tested: `can't access property "Bramble", x is undefined` → `can't access property "…", x is undefined`; `it's 'Ana'` → `it's '…'`.
- **Code-quote exemption:** after `reading`, `setting` or `evaluating`, a path is kept only when every part is in `BUILT_IN` (a fixed list of built-in members: `map`, `length`, `filter`, `then`, `forEach`, `push`, `toString`, `includes`…), an index, or a one-letter minified variable.
  - Tested: `(reading 'Bramble')`, `(setting 'DragonSlayer99')` and `(evaluating 'byName.Bramble')` become `'…'`; `(reading 'map')` stays.
- **`scripts/sourcemaps.ts`:** the CLI gets only `PATH`, `HOME` and the `POSTHOG_CLI_*` variables, with a 120 s timeout. A timeout is logged ("upload stopped after 120 s") and the build goes on.
  - Tests: `DATABASE_URL` and `CRON_SECRET` do not reach the child's env; a timeout still deletes the maps.
- **`identify()`** does nothing when `cookieless_mode` is `"always"`. One test: with a stand-in SDK it is called on a desk load and not on a cookieless one.
- **IP only for cookieless loads:** the proxy can tell. A cookieless page load uses `api_host` `/ingest/c`, with the prefix in `lib/analytics/region.ts`, which the browser bundle may import. `ingest.ts` strips `/c` and adds `x-forwarded-for` only there. Recorded in D115 and the D77 amendment.
- **Server `$exception`:** sent for every error before the per-second insert gate, through `after()`, so the error path does not wait. Outside a request it is just started.
- **Tests added:**
  - `clientIp`'s `x-forwarded-for` fallback (first address), through the proxy in `ingest.test.ts`;
  - `lib/analytics/posthog.test.ts`: a public page load starts cookieless on `/ingest/c` and never starts recording, even after it moves to `/w`.
- **Checks:**
  - `pnpm check` exits 0 (counts under Verified, updated).
  - Local e2e on a fresh production build: **26 of 26** pass. The one new check: desk events carry no IP header, while the public view's events still do.
  - Privacy grep: 0 names of the OGs fixture roster in the diff.

## Open issues
- Public-page replay is gone (cookieless mode cannot record). If the owner wants it back on some public loads, the only way is a consent choice (`cookieless_mode: "on_reject"`), which needs a banner and stores the choice in local storage.
- With cookieless server hash mode on, PostHog strips the IP before GeoIP, so the web analytics world map stays empty for public pages.
- The scrubber keeps unquoted words. A name that some code puts into an error message without quotes would pass. No code does that today; errors are codes.
- Caravans: the local data had no caravan this week, so the caravan form itself was not opened; the fix there is the same call in `EntryForm`.
- Follow-up, not done: the issue's TypeErrors were never seen with a message. If one comes back after this release, its scrubbed message and `section` will now say which.

## Next
- Model/effort: keep. One sitting covered the code, the docs and a 25-check e2e.
- What the owner must do first, in this order:
  1. PostHog, project 741657 → Settings → Project → Web analytics: turn on **Enable cookieless tracking** and save. Until then PostHog ignores the public pages' events.
  2. PostHog → Account settings → **Personal API keys** → Create. Name it `laptracker-sourcemaps`, give it access to project 741657 only, with the one scope **`error_tracking:write`**.
  3. Vercel → laptracker → Settings → Environment Variables: add `POSTHOG_PERSONAL_API_KEY` with that key, environment **Production** only, **Sensitive** on.
  4. Merge, release (D29), then check that PostHog → Error tracking → Symbol sets lists the new build, and that a production build log says "source maps: uploaded".
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A new client write in `app/(private)/_ui` that needs a request id must call `newRequestId()`; `crypto.randomUUID()` breaks Safari before 15.4.
- New client writes must use `newRequestId()` from `app/(private)/_ui/request-id.ts`, not `crypto.randomUUID()`, which breaks Safari before 15.4.
- A new event must answer a question in `docs/analytics/tracking-plan.md` and take enums only. Server events go through `lib/analytics/server.ts`.
- A new page under `/w/[slug]` or `/admin` with a new first segment should be added to `SECTIONS` in `lib/analytics/sanitise.ts`; until then its views count as `other`.
</adjustments>

PR: (added by the orchestrator)
