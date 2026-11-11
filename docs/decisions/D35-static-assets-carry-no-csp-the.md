## D35 — Static assets carry no CSP; the proxy matcher stays narrow (2026-11-05, 08t)

Why: 07c (N6) measured that `/_next/static/*` responses have no `Content-Security-Policy` header, 12–15 files per page, locally and on Vercel, while every other response has one. The proxy matcher (`proxy.ts`) skips `_next/static`, `_next/image` and `favicon.ico`.

- **Browsers enforce a CSP only from a document's response, or a worker script's.** A script, stylesheet or font that a page loads runs under that page's policy: the page's `script-src 'self' 'nonce-…' 'strict-dynamic'` decides whether a chunk may load, `style-src` and `font-src 'self'` decide CSS and fonts. A CSP header on a `.js`, `.css` or `.woff2` response is ignored. So the static files are already covered by the nonce CSP of the page that loads them (D11).
- **What `/_next/static` serves.** `next build` on `922190a`: 22 `.js`, 1 `.css`, 16 `.woff2`. No HTML, SVG or worker. The app creates no Worker and registers no service worker; the `importScripts` mentions in two chunks are Turbopack's chunk loader and a polyfill checking whether they run inside a worker.
- **Opened directly.** A `.js` or `.css` file opened in a tab is shown as text. `X-Content-Type-Options: nosniff` (`next.config.ts`, every path including `/_next/static`) stops a browser from sniffing one as HTML. They are build output from this repo, not user content. The SVGs in `public/brand/` are served outside `/_next/static`, so the proxy gives them the page CSP.
- **Not done: widening the matcher.** It would run the proxy on every static request for a header browsers ignore.
- **Revisit** if the app adds a Worker or service worker, or serves HTML or SVG from `/_next/static`: a worker script's own response sets its policy.
