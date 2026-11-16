# 11m — PostHog: analytics, session replay and client errors (D77)

Part of #326: the four events whose UI is not on `dev` yet are wired by the Members PR (#329). Decision D77. Owner changes during the session (2026-11-16): US region instead of EU; PostHog on every page with session replay everywhere and masking per area, instead of replay only on `/w` and nothing on `/admin`; the key is the Vercel variable `POSTHOG_KEY`, read on the server, instead of `NEXT_PUBLIC_POSTHOG_KEY`.

## Built
- **Dependency:** `posthog-js` 1.444.4, pinned exactly (released 2026-11-02, no install scripts). `pnpm-workspace.yaml` denies the postinstall of its dependency `core-js` (a funding banner, D10).
- **`lib/analytics/`**:
  - `region.ts`: the one region constant (`us`) and the three PostHog hosts derived from it.
  - `sanitise.ts`: `before_send`, pure.
    - It cuts the query string and hash from every URL-like property, nested ones included (element chain `href`s, stack frame file names, URLs in exception messages).
    - It drops the properties posthog-js reads from a query string (`$session_entry_utm_*`, click ids, `ph_keyword`).
    - It sets `area` (`public` / `workspace` / `admin`) and `workspace` (the slug) from the event's own path.
    - It replaces exception messages with `[masked]` on `/w` and `/admin`.
    - It also holds `MASK_CLASS` (`ph-mask`).
  - `events.ts`: the closed list of six custom events with closed-list properties, `track()`, `SIGNED_IN_HASH`, and `analyticsKey(env)` (the key when `VERCEL_ENV` is `production` and `POSTHOG_KEY` is set, used by the layout and the sign-in). It does not import posthog-js; calls wait for PostHog to load and do nothing when it never loads or fails to load.
  - `posthog.ts`:
    - `startPostHog(key)`: the SDK config. `no-external` build, memory persistence, no person profiles, no device model, no campaign parameters, no URL hashes, autocapture ignored on `/admin` and `/w`, exception autocapture without console errors, no heatmaps, dead clicks, performance, flags, surveys, tours or conversations, and the replay masking.
    - `followPath`: starts and stops replay by area (public 25 %, `/w` and `/admin` always). It imports the recorder chunk the first time a page is recorded.
  - `ingest.ts`: the `/ingest` forwarding (body, content type and encoding, PostHog's query string, our origin; nothing else).
    - Only the paths the SDK uses: `POST /e/`, `/i/v0/e/` (the events endpoint PostHog's remote config can name), `/s/`, and `GET /array/<key>/config`. Anything else answers 404 without a request to PostHog.
    - A body over 1 MB (`content-length`, then the bytes read) answers 413.
    - The remote config keeps PostHog's `cache-control`, or `public, s-maxage=300` when it has none; ingestion answers `no-store`.
- **`app/ingest/[...path]/route.ts`**: GET and POST, both `forwardToPostHog`.
- **`app/_ui/PostHogAnalytics.tsx`**:
  - the SDK chunk is requested after the window `load` event, in a `requestIdleCallback` (3 s timeout; a `setTimeout` where it does not exist); a failed import leaves tracking a no-op, with no unhandled rejection;
  - `loadAnalytics` is registered during its first render, which comes before any component's effect, so a sign-in or language event made before the SDK arrives waits for it;
  - follows `usePathname()` for replay;
  - counts `ws_sign_in_completed` once per page load from the `#signed-in` fragment, then removes it with `history.replaceState(null, …)`.
- **`app/layout.tsx`**: reads `POSTHOG_KEY` on the server (`analyticsKey(process.env)`) and renders `<PostHogAnalytics apiKey=…>` only when `VERCEL_ENV === "production"` and the key is set. `lib/env.ts` has both names, optional.
- **Masked areas:** `app/(private)/w/[slug]/layout.tsx` and `app/(pages)/admin/layout.tsx` wrap their pages in `<div className="ph-mask">`.
- **Wired events:**
  - `lib/private/sign-in.ts` redirects a successful sign-in to `/w/<slug>#signed-in` only when analytics is on, else to `/w/<slug>` as before;
  - `app/(private)/_ui/LanguageSwitch.tsx` sends `ws_language_switched` when the language changes.
- **`proxy.ts`:**
  - `/ingest/*` gets the deny-all CSP, as `/api/*` and `/img/*` do;
  - the trailing-slash 308 is kept for every path but `/ingest/` (`next.config.ts` sets `skipTrailingSlashRedirect`).
- **Tests:**
  - `lib/analytics/sanitise.test.ts` (3);
  - `lib/analytics/events.test.ts` (1, type-level, checked by `tsc`);
  - `lib/analytics/ingest.test.ts` (1): the allowlist and the cap, with `fetch` mocked;
  - `lib/private/sign-in.test.ts`: one new test, the fragment only with analytics on (a preview with the key gets none);
  - `lib/private/roster-fields.test.ts` now asserts that the analytics files are in its scan.
- **Docs:** D77 and its index line, a README section "Analytics, session replay and errors (PostHog)", `docs/ARCHITECTURE.md` (the `lib/analytics` and `app/ingest` layers, the dependency rule), `.env.example` (`POSTHOG_KEY`).

## Decisions
- **A route handler, not next.config rewrites.** Next proxies a rewrite with every request header (`next/dist/server/lib/router-utils/proxy-request.js`, httpxy). The workspace session (`__Host-lap_ws`), the `/admin` session and the visitor's IP would reach PostHog. Measured on the local production build: a request to `/ingest/e/` carrying a cookie, `x-forwarded-for`, a referer with a query and a user agent reached the upstream fetch with `content-type` and `origin` only. The cost is one Vercel function invocation per PostHog request (Hobby: 1M a month).
- **The `no-external` build, the recorder bundled as our own chunk.** No script source is added to the CSP, and no code is loaded from PostHog at run time. The recorder chunk (about 68 KB gzip) is downloaded only when a page is recorded, so three public page loads out of four never fetch it.
- **Masking follows the DOM.** The `/w` and `/admin` layouts carry the `ph-mask` class. Under it, rrweb masks all text (`maskTextSelector`), empties every attribute but styling and sizes (`maskAttributeFn`), and blocks images and form fields (`blockSelector`). A client-side navigation needs no recorder restart and has no window where the old area's masking applies. Every input value everywhere is masked to a constant `***` (`maskInputFn`), so lengths are not kept.
- **Our own sampling.** Public sessions are sampled in the browser (`PUBLIC_REPLAY_SAMPLE = 0.25`, once per page load), and `startSessionRecording(true)` overrides PostHog's own sampling. A sampled-out public visitor never downloads the recorder, and `/w` and `/admin` are always recorded.
- **`area` and `workspace` are set in `before_send` from each event's path**, not with `register()`. A registered property is updated in an effect, after the history-change page view of a client-side navigation is sent.
- **Exception messages on `/w` and `/admin` are replaced whole.** A coordinate-pair or timestamp pattern would miss a value printed any other way and does not catch names. The type and stack frames stay. Public messages keep their text, with URLs cut. Public pages never receive the blocked roster fields.
- **Click autocapture on public pages is intended.** It feeds PostHog's click heatmaps, and the clicked text there is public game data. It is off on `/w` and `/admin` (`url_ignorelist`): the custom events cover the workspace, and `/admin` gets page views, exceptions and replay, as the owner listed.
- **The SDK loads after the page** (review of #332): after `load` and an idle moment, so it never delays the page. The first page view is sent when it starts, with the URL of that moment.
- **Sign-in event.** A `#signed-in` fragment on the callback's success redirect, only when analytics is on, is read by the browser, never by a server. The daily silent re-authorisation (`prompt=none`) goes through the same redirect, so it counts as a sign-in too. The callback does not know whether a sign-in was silent.
- **Filter names** for `ws_filter_used` come from issue #296: `new`, `low_donations`, `missing_data`, `away`, `r4_plus`. The first-use and copy events have no properties.

## Deviations
- The brief said Next rewrites and `persistence: 'memory'` + `ip: false`. Rewrites were replaced by a route handler (see Decisions). posthog-js 1.444.4 logs that `ip` "has NO EFFECT AT ALL". The IP is kept out by the proxy and by the project's IP anonymization.
- The brief listed `mask_all_text` / `mask_all_element_attributes` for autocapture on `/w`. Autocapture is off there and on `/admin` instead (the brief's other option).
- The brief said super properties. They are per-event properties set in `before_send` (see Decisions).
- The brief's `.env.local` key `NEXT_PUBLIC_POSTHOG_KEY=phc_test` became `POSTHOG_KEY=phc_test`, after the owner's change.
- Minimum session duration: the SDK has no local setting for it; it applies the project's **Minimum duration** to every area. It is an optional owner step, not code.
- `save_campaign_params: false` does not stop posthog-js from sending `$session_entry_utm_*` and click ids read from the entry URL. The sanitiser drops them (found by the local check, which entered with `?utm_source=x`).

## Verified
- Checks (a)–(f) were run manually with a Playwright harness against a local production build; the evidence is outside the repo, and `pnpm check` covers only the sanitiser, the type test and the fence test, plus (since the review of #332) the `/ingest` allowlist and cap and the sign-in fragment.
- `pnpm check` exit 0 (load average 30–40): prettier, eslint, tsc, vitest 76 files passed and 1 skipped, 369 tests passed and 1 skipped, no timeout; drift gate "Everything's fine"; i18n "17 languages up to date".
- **After the review of #332**, on a new production build with the deferred SDK load, the harness ran again: (a)–(f) pass (evidence in `posthog-evidence/rerun-review-332/`).
  - The harness's `/admin` pages now stay 16 s each. The SDK starts after `load` and an idle moment, the fixture's 5 s minimum duration counts from there, and a replay batch sent at unload goes out as a beacon, which Playwright does not intercept.
  - The proxy on that build: an unknown path and `/ingest/static/recorder.js` answer 404, a 1.1 MB body 413, the remote config `cache-control: public, s-maxage=300`, an event `no-store`.
- Probes, each reverted:
  - with `MemberFilter = string`, `tsc` fails `events.test.ts` twice (the `expectTypeOf` assertion and an unused `@ts-expect-error`);
  - a scratch `lib/analytics/zz-probe.ts` reading `daily_tech` fails `roster-fields.test.ts` with `lib/analytics/zz-probe.ts: daily_tech`.
- **Local production build** (`pnpm build`, exit 0; `next start` with `VERCEL_ENV=production`, `POSTHOG_KEY=phc_test` in a worktree-only `.env.local`):
  - setup: a local Postgres 18 cluster seeded with `pnpm db:local:seed`, workspace `ogs` registered, and a Discord stub (the 11c recipe);
  - Playwright (playwright-core, system Chrome) intercepted every `/ingest/**` request with `route.fulfill`;
  - the remote config it served was hostile on purpose: console and network capture on, `maskAllInputs: false`, heatmaps, dead clicks and performance on, minimum duration 5 s;
  - a Node preload answered any server-side fetch to `*.posthog.com` locally, so nothing reached PostHog.
  - Evidence in the session scratchpad, `posthog-evidence/` (`summary.txt`, per-run requests, events, decoded replay and inspection, `excerpts.json`, the harness).
  - (a) Public page, sampled in:
    - one `$pageview` with `$current_url` `http://localhost:3277/players`, after entering at `/players?q=Seed&utm_source=x#top` and searching "Amaranthine";
    - no query or hash in any URL, and no `utm` property;
    - replay with 68 readable text nodes;
    - the search input recorded as `***` only, and "Amaranthine" absent from every payload.
    - Sampled out: one `$pageview`, no replay request.
  - (b) `/admin`:
    - `$pageview` x3 and `$exception` with value `[masked]`; no `$autocapture`;
    - 2 replay requests with 419 nodes under `ph-mask` and 0 unmasked text or attribute;
    - the PIN field recorded as a blocked 358×44 box; the PIN, the member row's name and values, "Might unchanged" and the alliance names are absent from every payload.
  - (c) `/w/ogs` signed in through the stub:
    - replay with 147 masked nodes and 0 leaks;
    - the officer's name, an injected member card (name, "x 4719, y 8263", photo, input) and the PT shell words are absent;
    - `ws_sign_in_completed` x1 and `ws_language_switched {language: "pt-BR"}`;
    - `$exception` value `[masked]`;
    - the URL was `/w/ogs#signed-in` on arrival and `/w/ogs` 1.5 s later.
  - (d) No `securitypolicyviolation` and no CSP console message in any run. The only console errors are the two Vercel Insights scripts answering 404 on a local server, as in 08zd.
  - (e) No PostHog cookie, localStorage or sessionStorage key in any run. Cookies present are the app's own (`lap_admin`, `__Host-lap_ws`, `lap_ws_lang`; sessionStorage `lap_pin`).
  - (f) In one page load, `/w/ogs` → `/` → `/w/ogs` by client-side navigation: 0 leaks over the whole recording, and public text was readable while on `/`. In a sampled-out run, the recording stopped on `/` and restarted on `/w` (6 full snapshots), with 0 leaks.
  - Proxy: one unload beacon escaped Playwright's interception and reached the real `/ingest/s/` route. The preload answered it. It went upstream with `content-type: text/plain` and `origin` only, while the browser held the workspace and admin cookies.
  - `/players/` and `/w/ogs/?e=denied` still answer 308 to the path without the slash; `/ingest/e/` keeps its slash.
- Found and fixed during the check:
  - the trailing-slash redirect first looped (a `NextURL` clone puts the slash back);
  - the sign-in hash came back after a client-side navigation back to `/w/ogs`, so the event fired twice;
  - `$session_entry_utm_source` reached the payload.
- PostHog's free allowances read with the PostHog docs search on 2026-11-16: 1M events, 5K recordings, 100K exceptions; over a limit, ingestion drops.

## Open issues
1. **Members tab (#296), first-use cards (#312):** `ws_copy_spreadsheet`, `ws_filter_used`, `ws_first_use_done` and `ws_first_use_skipped` are exported from `lib/analytics/events.ts`. Their UI does not exist on `dev`, so they are not wired here; the Members PR (#329) wires them after this merges.
2. **"Unique visitors" counts page loads.** With memory persistence, every full page load gets a new random id, so PostHog's visitor counts mean page loads.
3. **No location data.** PostHog receives Vercel's address, so its GeoIP shows Vercel's region, not the visitor's country.
4. **Function invocations.** Every PostHog request is one Vercel function invocation (Hobby: 1M a month, shared with the crons and pages). Not measured on production.
5. **Optional owner step:** Session replay → Minimum duration 5 s (applies to every area).
6. **A privacy note in the footer** is an open option in D77, not built.
7. **Bundle cost.** The SDK chunk is about 125 KB gzip (`dist/module.no-external.js` measured with `gzip -9`), loaded on every production page. The recorder, about 68 KB more, loads only on recorded pages.
8. **Four transitive packages are younger than two weeks** (`@posthog/core` 1.68.0, `@posthog/types` 1.425.1, `@posthog/browser-common` 0.10.8, `dompurify` 3.4.18). The browser does not run them: the posthog-js dist files are self-contained. The build uses them for types only.
9. **Replay batches over 1 MB** (compressed) are refused with 413. The recorder flushes at about 0.9 MB before compression; the largest whole run in the local check compressed to 158 KB.

## Next
Session: #296 — Workspace: Members tab with API data and weekly donations.
Model / effort: keep — this change adds no data model and no upstream call; the Members session's size is unchanged.
Owner must do first: merge this PR into `dev`. Optional: PostHog → Session replay → Minimum duration 5 s.
Plan changes needed: none in the plan sections the next session reads. §5 and §7's "no third-party observability" lines are superseded by D36 and D77 (not edited here).

<adjustments>
- Analytics: call `track("ws_copy_spreadsheet")` on the copy button and `track("ws_filter_used", { filter })` on each filter (`new`, `low_donations`, `missing_data`, `away`, `r4_plus`), from `@/lib/analytics/events`. If a filter name changes, change the `MemberFilter` union too; `events.test.ts` keeps properties to closed lists.
- Replay: every page under `/w/[slug]` is masked by the layout's `ph-mask` wrapper, with no work in the page. Keep member values inside the page tree: a portal to `document.body` would leave the masked area.
- Exceptions on `/w` are sent with the message replaced by `[masked]`, so a thrown error that names a member is safe. Do not log member values to the console: console capture is off, but other tools read it.
</adjustments>

<adjustments for="Session #312">
- Call `track("ws_first_use_done")` when an officer finishes the cards and `track("ws_first_use_skipped")` when they skip them (no properties).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/332
