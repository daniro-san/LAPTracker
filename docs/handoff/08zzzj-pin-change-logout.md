# 08zzzj — A changed PIN logs everyone out

Owner request, 2026-11-12. After a PIN change, the old session should end by itself, the old cookie should be deleted, and the person should have to log in with the new PIN.

The session cookie (`lap_admin`) is an HMAC of `EDIT_PIN`, so it already stopped opening the pages once the new PIN was live. Two things were left behind:
- The cookie stayed in the browser, unused.
- The PIN saved in `sessionStorage` (`lap_pin`) for the action buttons kept being sent. Each press got 401, and each 401 used up an attempt of the PIN limiter (5 per IP per 15 min, 20 per hour in total).

## Built
- `lib/admin-session.ts`: `hasStaleAdminCookie()` is true when a session cookie exists but does not match the current PIN (or `CRON_SECRET`).
- `app/api/admin/session/route.ts`: `DELETE` expires the cookie (`Max-Age=0`, the same `Path`, `HttpOnly`, `SameSite=Strict`, `Secure` in production) and answers 204. It needs no PIN and no database: it only clears this browser's own cookie. A cross-site `DELETE` needs a CORS preflight, and the cookie is `SameSite=Strict`.
- `app/_ui/admin/AdminShell.tsx`: passes `stale` to `PinGate`.
- `app/_ui/admin/PinGate.tsx`: on mount it drops the saved PIN (`forgetPin`). With `stale`, it also calls `DELETE /api/admin/session` and shows "The admin PIN has changed. Enter the new PIN to see this page." instead of the usual prompt.
- `app/_ui/admin/PinSheet.tsx`: `forgetPin()`.
- `app/_ui/admin/actions.ts`: `post()` drops the saved PIN on a 401. The next press asks for the PIN, and the page reload after every press shows the PIN card if the session ended too.
- Copy: `copy.admin.pin.changed`. `refusals.unauthorized` is now "Wrong PIN, or the PIN has changed. Press again to enter it."
- Docs: a D3 amendment, and the README step "Open `/admin` and enter the admin PIN".

## Decisions
- **No automatic renewal.** Renewing a session without the new PIN would let in someone who knows only the old one. The person types the new PIN once.
- **Logout comes from the existing poller.** `/admin` pages already refresh every 20 s while idle (`useRunWatch`). After the new deployment, an open page turns into the PIN card at its next refresh, and the card does the clean-up. No new timer or check.
- **The cookie is deleted through a route, not in `proxy.ts`.** A server component cannot set cookies, and checking the PIN in the proxy would duplicate the session logic there.

## Deviations
- No committed test (CLAUDE.md: not asked). The existing `gate.test.ts` covers the locked shell (the cookie there is stale) and still passes.

## Verified
Chrome at 360 px (playwright-core) on `next dev` against a local Postgres (D47; `DATABASE_URL` and `EDIT_PIN` set on the process only):
1. With PIN A: unlocked, cookie set, saved PIN set.
2. A Before press whose request the browser answered with 401 (it never reached the server): the saved PIN was dropped, and the result read "Wrong PIN, or the PIN has changed. Press again to enter it."
3. Server restarted with PIN B (a new deployment), page loaded again: locked, cookie **gone**, saved PIN gone, and the prompt read "The admin PIN has changed. Enter the new PIN to see this page."
4. PIN B unlocked the page again.

`pnpm check`: prettier, eslint, typecheck, 254 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.

Not checked in a browser: an open page turning into the card by itself, with no navigation. That path is the existing 20 s refresh, which re-renders `AdminShell` into `PinGate`, and step 3 exercises that same render.

## Open issues
- None new.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. Checks passed on the first full run; one rerun of the browser script (the page reload right after the dev server restart was aborted; `goto` with a retry fixed it).
Owner must do first: merge this PR into `dev` and release it with #246 (and #245 if not merged yet). Then the next PIN change logs everyone out by itself.
Plan changes needed: none.

<adjustments>
- `DELETE /api/admin/session` ends a session; a future "Log out" button can call it too.
- A new client-side place that saves the PIN must also clear it in `forgetPin()` (`app/_ui/admin/PinSheet.tsx`), or a changed PIN leaves it behind.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/247
