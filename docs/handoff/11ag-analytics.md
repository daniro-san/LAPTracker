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
- **The consent mode only for page loads that start on a public page.** posthog-js cannot record while cookieless, and the mode cannot change after `init`. So the mode is chosen per page load from the first page's area: public loads use `cookieless_mode: "on_reject"` (cookieless until the visitor says "Allow", then the 25 % public replay of D77), and desk and `/admin` loads keep `memory` persistence and replay (owner round below).
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
- **`identify()`** does nothing whenever `cookieless_mode` is set, so on any page load that started on a public page (third round). One test: with a stand-in SDK it is called on a desk load and not on a public-started one, allowed or not.
- **IP only for cookieless loads:** the proxy can tell. A cookieless page load uses `api_host` `/ingest/c`, with the prefix in `lib/analytics/region.ts`, which the browser bundle may import. `ingest.ts` strips `/c` and adds `x-forwarded-for` only there. Recorded in D115 and the D77 amendment.
- **Server `$exception`:** sent for every error before the per-second insert gate, through `after()`, so the error path does not wait. Outside a request it is just started.
- **Tests added:**
  - `clientIp`'s `x-forwarded-for` fallback (first address), through the proxy in `ingest.test.ts`;
  - `lib/analytics/posthog.test.ts`: a public page load starts cookieless on `/ingest/c` and never starts recording, even after it moves to `/w`.
- **Checks:**
  - `pnpm check` exits 0 (counts under Verified, updated).
  - Local e2e on a fresh production build: **26 of 26** pass. The one new check: desk events carry no IP header, while the public view's events still do.
  - Privacy grep: 0 names of the OGs fixture roster in the diff.

## Owner round (2026-11-18, PR 415)
- **Consent bar on public pages.** Public page loads use `cookieless_mode: "on_reject"` with `opt_out_capturing_by_default`, so no answer counts as "no".
  - **No answer or "No thanks":** cookieless, nothing stored, no replay, events on `/ingest/c`.
  - **"Allow":** PostHog's cookie and storage, `$opt_in`, events on `/ingest` with no IP, and the 25 % public replay with D77's masking.
  - The answer is kept in `localStorage.lap_analytics` (`lib/analytics/consent.ts`) only after the visitor answers. An answer applies at once (`answerConsent`).
  - The bar is `app/_ui/AnalyticsConsent.tsx`, fixed at the bottom so nothing moves when it appears. "Analytics choices" in the footer (`AnalyticsChoices.tsx`) opens it again.
  - Desk, board and `/admin` are unchanged and never show it. `identify` does nothing while a page load is cookieless.
  - **Copy:** `copy.consent` in EN, PT-BR and FR, plus the other 14 public languages. D48's check requires every public key in every language; all 17 are stamped.
- **Desk adoption:**
  - `counted` (`lib/private/desk-action.ts`) is wired into every write route under `/api/w/[slug]` (17 routes): a 2xx answer sends `ws_action` with `feature` and `action` on the officer's pseudonymous id, after the response.
  - `ws_board_section_viewed` (`board_section`: `week`, `notices`, `start_here`) comes from `BoardSectionsSeen.tsx`. The e2e caught that a property named `section` would be overwritten by `before_send`, so the property is `board_section`.
  - "Copy for the game" in the thanks sheet now sends `ws_thanks_shared` with `to: game`.
- **Tracking plan rewritten:** questions per event, the full `ws_action` feature × action table, and the insights and funnels to build (tabs opened, adoption by feature, screenshot funnel, notice funnel, board adoption, consent rate, Discord, errors, AI cost). A test fails if the code names an event, feature or action the plan does not list.
- **Tests:**
  - `lib/analytics/posthog.test.ts`: no answer, granted, answering on the bar, and desk loads unchanged.
  - `lib/private/desk-action.test.ts`: counted on success only, on the pseudonymous id, with no name.
  - `events.test.ts`: identify with `on_reject` (skipped unless opted in), and the plan check.
- **Checks:**
  - `pnpm check` exits 0: **191 files passed, 2 skipped; 1,015 tests passed, 4 skipped**.
  - Local production build: the consent run (`e2e-consent.mjs`) passes **26 of 26**, and the earlier run passes 26 of 26 again. The consent run covers no layout shift, 44 px buttons and no sideways scroll at 360. It covers what is stored before an answer, after "No thanks" and after "Allow", and that replay is never sent after "No thanks". It also covers the footer link, `ws_action` from a desk write on the same id as the page's identify, and all three board sections.
  - Screenshots: `consent-bar-{360,1280}-{light,dark}-{en,pt-BR}.png` in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ag-shots/`.
  - Designer check: the PT text fits in four lines at 360, the buttons share the row evenly, and dark mode reads clearly. The bar covers the footer's last lines until answered, which is expected for a bottom bar.

## Review round 3 (PR 415)
- **Fixed, HIGH:** a "No thanks" on a public page switched off analytics on the desk and `/admin`. `opt_out_capturing()` wrote posthog-js's default consent record (`__ph_opt_in_out_<token>`), which desk loads read too. Public loads now keep their own record (`consent_persistence_name: "lap_ph_public_consent"`, `PUBLIC_CONSENT_RECORD` in `lib/analytics/posthog.ts`), so the two never share one.
  - Test: the SDK stand-in keeps consent records by name as posthog-js does. A denial on a public load, then a desk load: it still captures and records.
  - e2e in one browser profile (`e2e-oneprofile.mjs`), **9 of 9**:
    - public page, "No thanks": only `lap_analytics` and `lap_ph_public_consent` were stored, and no `__ph_opt_in_out_*` record;
    - then the desk in the same profile: a page view (not cookieless), `$identify`, replay batches and an exception were all sent;
    - the footer link put focus on "Allow", and `/admin` showed no "Analytics choices".
  - The consent run and the earlier run pass 26 of 26 each again. `pnpm check` exits 0: **194 files passed, 2 skipped; 1,025 tests passed, 4 skipped**.
- Rebased on `origin/dev` (e42bcefe, #414); the decisions index kept both lines.
- **`identify`** is skipped whenever `cookieless_mode` is set, so a public load whose visitor allowed never ties PostHog's stored id to an officer.
- **"Analytics choices"** is hidden on `/admin` (`SiteFooter` `choices={false}`).
- **Focus:** when the footer opens the bar, focus moves to its first button.
- **`ws_action`:**
  - `shots/read` is now `screenshot` / `read_text`: a picture read to text for a paste box, nothing saved. The plan says so, and that a saved screenshot is `screenshot_draft` / `save`.
  - A replayed request id is still counted again. It is not cheap to avoid: the lib functions answer a replay exactly like the first write, so no route knows. Noted in the plan.
- **Copy:**
  - The bar says "no tracking cookie is stored" instead of "nothing is stored on your device", in all 17 languages.
  - PT's link reads "Preferências de estatísticas".

## Open issues
- The bar's 14 other languages were written in this session without the translate-copy skill's per-language glossary pass; a native check is worth doing.
- With cookieless server hash mode on, PostHog strips the IP before GeoIP, so the web analytics world map stays empty for visitors who did not allow the cookie.
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
