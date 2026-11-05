# 08zd — Anonymous Web Analytics and Speed Insights (issue #69)

## Built

- `app/_ui/VercelInsights.tsx` (client): `<Analytics />` from `@vercel/analytics/next` and `<SpeedInsights />` from `@vercel/speed-insights/next`, both with a `beforeSend` that cuts the query string and hash from the URL.
- `app/layout.tsx`: renders `<VercelInsights />` only when `VERCEL_ENV === "production"`.
- `proxy.ts`: a comment on why the CSP needs no new source. No directive changed.
- `package.json` / `pnpm-lock.yaml`: `@vercel/analytics` 2.0.1 and `@vercel/speed-insights` 2.0.0, exact pins. The lockfile gained only these two packages.
- `docs/DECISIONS.md` D36: what is sent, the CSP reasoning, Hobby limits, the package table (release date, install scripts, dependencies, why the platform isn't enough).

## Decisions

- **Free plan only, no custom events.** The owner, 2026-11-05, in this session: "just track what is available on the free plan, nothing from the pro plan should be used". Vercel `track()` is Pro only, so there are no custom events. I read "only the free plan" as also ruling out a first-party event counter in Postgres (option b). It was offered and not chosen, so it was not built and no issue was opened. The PR says `Closes #69`.
- **Production gate in the server layout, not the packages' `mode`.** `mode="auto"` only tells `NODE_ENV` apart, so previews would also send. `VERCEL_ENV` is read at request time (the layout is dynamic) and is `preview` on previews and unset on `next dev`, `next start` and in tests.
- **One client component.** The root layout is a server component and cannot pass a function (`beforeSend`) to a client component, so both components and the one `beforeSend` live in `VercelInsights.tsx`.
- **`beforeSend` keeps the path and cuts `?` and `#`.** It splits the string, so it works for absolute and relative URLs. Paths stay so page views show which alliance and player pages are read. `/players/<uid>` carries the viewed player's uid: a public page address, nothing about the visitor.
- **CSP unchanged.** Both packages add their script with `document.createElement` from a Next chunk that loaded with the nonce, and `'strict-dynamic'` trusts scripts added that way. Browsers without `'strict-dynamic'` fall back to `'self'`. Script and intake are same-origin: `/_vercel/insights/*` and `/_vercel/speed-insights/*`, or in v2 a per-build seed path (`/<seed>/script.js`, `/<seed>/view`, `/<seed>/vitals`, "Resilient Intake") that Vercel injects at build through `NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG`. `connect-src 'self'` covers the POSTs. Adding `/_vercel/...` to `script-src` would have no effect under `'strict-dynamic'`, and listing paths would miss the seed path.
- **Versions.** `@vercel/speed-insights` 2.1.0 was published 2026-11-05 (today), less than two weeks ago, so 2.0.0 (2026-03-10). `@vercel/analytics` 2.0.1 (2026-03-12) is the latest. Neither has install scripts or dependencies; peers `next >= 13` and `react ^18 || ^19` match.

## Deviations

- The task said to make the CSP allow `/_vercel/insights/*` and `/_vercel/speed-insights/*`. No directive change was needed (see Decisions); the browser check below shows both scripts requested with no CSP violation.
- The Vercel MCP `get_team` does not return the team's plan, and `get_project` does not say whether Web Analytics or Speed Insights is enabled. The plan is taken as Hobby from plan §5 and the owner's message.
- No test committed: the task asked for none. `beforeSend` was exercised in the browser on the production bundle (Verified).

## Verified

- Vercel docs read 2026-11-05 (`/docs/analytics/limits-and-pricing`, `/docs/analytics/privacy-policy`, `/docs/speed-insights/limits-and-pricing`, `/docs/speed-insights/privacy-policy`, `/docs/analytics/package`, `/docs/speed-insights/package`, `/docs/plans/pro-plan`). Hobby: Web Analytics 50,000 events/month team-wide, 1-month window, no custom events, 3-day grace then pause. Speed Insights free tier: 10,000 events over a rolling 30 days team-wide, RES only, then a pause of at least 14 days. Pro: $20/month, events $0.03 per 1,000. No cookies; visitors counted by a request hash discarded after 24 h; no IP stored.
- What the Analytics script sends: read in the served `https://vercel.com/_vercel/insights/script.js` (4,522 bytes): `o` = URL as returned by `beforeSend`, `dp` = route, `r` = referrer only if another host, `sv`/`sdkn`/`sdkv`; `fetch` POST with `keepalive` to the configured endpoint. Its `localStorage` and cookie code runs only on `identify`/`group`/`enableCookie`, which the app never calls. Without `beforeSend`, `/players?q=ann` would be sent whole (the script keeps `location.href` when the path is unchanged). The Speed Insights script on vercel.com returned 403; its payload is from Vercel's privacy page.
- `pnpm check` after rebasing on `origin/dev` (12f918f): prettier, eslint (with D34's dependency zones), tsc clean; vitest 33 files passed, 3 PGlite files (`leadership`, `players`, `upstream-status`) hit the 10 s `beforeAll` timeout at load average 36–49 (other lanes running). Re-run with `--hookTimeout=60000 --no-file-parallelism`: 3 files, 13 tests passed. `tsx scripts/check-drift.ts`: "Everything's fine".
- `pnpm build`: exit 0, compiled in 14.0 s.
- Local production run (`VERCEL_ENV=production next start`, reading the Neon preview branch through the main checkout's `.env.local`, read-only), in-app browser:
  - `/`: both scripts injected (`/_vercel/insights/script.js`, `/_vercel/speed-insights/script.js`, no nonce) and requested. They return 404 locally because only Vercel serves those paths. Console: two 404s, two MIME errors, the packages' "failed to load" logs, **no Content Security Policy message**.
  - `/players?q=ann#top`: the queued `beforeSend` from the bundle returned `{ type: "pageview", url: "http://localhost:3187/players" }` (Analytics) and `{ type: "vital", url: "http://localhost:3187/players", route: "/players" }` (Speed Insights). A same-origin `fetch` POST to `/_vercel/insights/view` reached the server (404), not blocked. No CSP message in the console.
  - `VERCEL_ENV=preview next start`, `/players?q=ann`: no script injected, `window.va` and `window.si` undefined.
  - Response header on `/players`: the unchanged CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'; connect-src 'self'`).
- Not verified: the real scripts on the production deployment (they exist only there, after the owner enables both products).

## Open issues

- **Owner, dashboard:** Vercel → project `laptracker` → **Analytics** → Enable, and **Speed Insights** → Enable. Until then the script paths 404 and nothing is collected (the packages log one line in the console). The first deploy to production after enabling creates the seed paths.
- **Speed Insights free tier may pause.** 10,000 events over 30 days, shared with the whole team. Each page load can report several vitals; the real count per load is unmeasured. If it pauses, collection stops for at least 14 days; the site is not affected. `sampleRate` (e.g. 0.5) on `<SpeedInsights />` would halve it — not set, since no number shows it is needed.
- **Web Analytics 50,000 events/month** are shared with every project in the team. Over that, collection pauses after 3 days of grace.
- Page views on `/players` no longer tell a search from a plain visit (the query is cut). Telling them apart would need a custom event (Pro) or keeping a non-identifying marker; neither was asked for.
- Hobby keeps Web Analytics data for 1 month and Speed Insights for 7 days in the dashboard.

## Next

Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call, no DB write and no timing.
Owner must do first: merge this PR into `dev`; enable Web Analytics and Speed Insights for the project in the Vercel dashboard (Open issues).
Plan changes needed: yes, in `docs/IMPLEMENTATION_PLAN.md` (not edited here): §5 Stack, "Observability: none third-party" (Vercel Web Analytics and Speed Insights now run on production, anonymous, D36); §7 "Observability: Postgres, not a third party" (add that page usage and web vitals go to Vercel, D36); §7 "Logging guarantees → No frontend tracking" (replace with D36: two Vercel scripts on production only, query strings cut, no custom events).

<adjustments>
- Session 9: once production runs a build made after Web Analytics and Speed Insights were enabled, open `/` and `/players?q=<a name>` on production with devtools: the two Vercel scripts load with 200 from a same-origin path, a POST to `/<seed>/view` returns 2xx, and the console shows no Content Security Policy violation. In the Vercel Web Analytics dashboard, `/players` appears without `?q=`.
- Session 9: when checking the pages, expect no cookie set by Vercel's scripts (Application → Cookies lists the same cookies as before this change).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/109
