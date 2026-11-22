# fix/e2e-webkit-linux

## Built
- `e2e/https-server.mjs`: the `iphone` project's server. It is Next's custom server (`next({ dev: false, hostname: "localhost", port })`) on the same production build, over HTTPS on 127.0.0.1:3478. A self-signed certificate and its key come from `openssl req -x509 ... -keyout /dev/stdout` at start and stay in memory.
- `playwright.config.ts`: with `E2E_WEBKIT=1`, a third web server (`node e2e/https-server.mjs 3478`, the same server environment and preloads as `next start`, `NODE_ENV=production`, ready on `https://localhost:3478/robots.txt` with `ignoreHTTPSErrors`). The `iphone` project gets `baseURL: https://localhost:3478` and `ignoreHTTPSErrors: true`. The header comment says why.
- `e2e/env.ts`: `HTTPS_PORT` (`E2E_HTTPS_PORT`, default 3478) and `HTTPS_BASE_URL`. The `BASE_URL` comment now says that Chromium keeps the Secure cookie on http localhost.
- D150: dated amendment (2026-11-22).

## Decisions
- **Root cause.** Playwright's WebKit on Linux keeps cookies in libsoup. libsoup's `soup_cookie_applies_to_uri` returns FALSE for a Secure cookie unless the scheme is `https` or `wss`, and it has no localhost exception (https://github.com/GNOME/libsoup/blob/master/libsoup/cookies/soup-cookie.c, `if (cookie->secure && !soup_uri_is_https (uri)) return FALSE;`; `soup_uri_is_https` in libsoup/soup-uri-utils.c compares the scheme only). The `__Host-lap_ws.<slug>` cookie is Secure, so it is never sent to `http://localhost:3477`, and the desk shows its sign-in screen. macOS WebKit uses Apple's cookie store, which sends it. WebKit's own bugs record the localhost inconsistency (https://bugs.webkit.org/show_bug.cgi?id=281149, https://bugs.webkit.org/show_bug.cgi?id=232088).
- **Option 2 (HTTPS), but not as a proxy.** No Playwright or WebKit setting makes libsoup treat localhost as secure, so option 1 does not exist. Dropping Secure is not possible, because a `__Host-` cookie must be Secure. A proxy in front of `next start` on another port would break every write: the app compares Origin with `new URL(request.url).origin`, and `next start` builds that URL from its own port (`resolve-routes.js`: `${protocol}://localhost:${opts.port}`), so the proxy would have to rewrite Origin. `next start` refuses a certificate (`Using a self signed certificate is only supported with next dev`). Next's custom server is given its own port and runs the same `getRequestHandlers` as `next start`, so Origin, cookies and redirects match without rewriting anything.
- The certificate is made at run time and never written to disk, so nothing reaches the repository or gitleaks.

## Deviations
- The task suggested "a tiny Node https proxy". I built an HTTPS Next server instead, for the Origin reason above. It is a second Next process on the same build, for the `iphone` project only.

## Verified
Local: Apple silicon, Node 26.5.0, Postgres 18 (worktree-local db:local cluster on 54320), Playwright 1.65.1 (Chromium headless shell 1255, WebKit 2388), OpenSSL 4.1.0.
- `E2E_WEBKIT=1 pnpm test:e2e` (with `next build`): 50 passed, 3 skipped, 0 failed, 26.2 s.
- `E2E_NO_BUILD=1 E2E_WEBKIT=1 pnpm test:e2e --repeat-each=3`: 150 passed, 9 skipped, 0 failed, 40.7 s; no `e2e-outbound.log`.
- Run time, no build, old config against new, alternating twice: 16.9 s / 17.1 s against 18.2 s / 18.4 s.
- The `iphone` tests that write (Roll call's mark and clear) pass over HTTPS, so the Origin check holds.
- `pnpm vitest related --run playwright.config.ts e2e/env.ts e2e/https-server.mjs`: 3 passed. `pnpm check`: exit 0.
- CI failure artifact of run 45006762322: the `iphone` traces show `addCookies` with the Secure `__Host-` cookie, then `http://localhost:3477/w/lnk` answered with the sign-in page. WebKit's trace leaves the Cookie header out of every request, so the trace alone does not prove which cookie was dropped.
- **Not run here:** Linux WebKit. Docker was not to be started. The orchestrator's dispatch of `e2e.yml` on this branch is the check.

## Open issues
- `docs/handoff/test-477-e2e-ci.md` line 60 says WebKit sends the Secure cookie to http localhost. That is true on macOS only. Old handoffs are left as they are; D150's amendment corrects it.

## What was missing from the task prompt?
That the app checks Origin against `next start`'s own port, which rules out a proxy on another port.

## Next
- Dispatch `e2e.yml` on `fix/e2e-webkit-linux` (workflow_dispatch, so `E2E_WEBKIT=1`). Check the `e2e` job, step `Run pnpm test:e2e`: 0 failed, with the 4 runnable `[iphone]` desk tests passing.

PR: (added by the orchestrator)
