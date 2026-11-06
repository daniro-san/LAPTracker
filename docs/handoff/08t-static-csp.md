# 08t — CSP for static assets decided (#52)

## Built
- `docs/DECISIONS.md` D35: `/_next/static/*` keeps no CSP header and the proxy matcher (`proxy.ts`) is not widened. Option (a) of the issue. No code change.

## Decisions
- Option (a). Browsers enforce a CSP from a document's response or a worker script's response; JS, CSS and fonts load under the CSP of the page that requests them, which is the nonce CSP from `proxy.ts` (D11). A header on a static file would be ignored, and widening the matcher would run the proxy on 12–15 more requests per page for nothing.
- D35 names when to revisit: a Worker or service worker, or HTML/SVG served from `/_next/static`.

## Deviations
- None. `proxy.ts` CSP directives were not touched (lane F, #69, edits them).

## Verified
- `next build` on `922190a` (this branch's base): `.next/static` holds 22 `.js`, 1 `.css`, 16 `.woff2`; no `.html`, `.svg` or worker file. `grep` for `new Worker`, `serviceWorker`, `importScripts` in `.next/static`: two hits, both runtime checks (Turbopack's chunk loader, a polyfill testing for a worker scope), no worker created. Same grep over `app/` and `lib/`: none.
- `next.config.ts` sends `X-Content-Type-Options: nosniff` on `/:path*`, which includes `/_next/static`.
- 07c's measurement (N6) is the evidence that static responses have no CSP today; not re-measured.
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc clean; vitest hit the 10 s PGlite `beforeAll` timeout in 4 files at load average 32–35 (other lanes, same as 08s). `vitest run --hookTimeout=120000`: 35 files, 151 passed, 1 skipped.

## Open issues
- None from this change.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; docs only, nothing here affects the dry run.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none.

<adjustments>
- Plan §12.3 / 07c N6 are closed by D35: do not add a CSP to `/_next/static`. If a later session adds a Worker or a service worker, its script response needs its own CSP (D35 "Revisit").
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/105
