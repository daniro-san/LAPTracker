# 08zzzj — Sessions end: PIN change, 7 days, Log out

Owner requests, 2026-11-12:
1. After a PIN change, the old session should end by itself, the old cookie should be deleted, and the person should have to log in with the new PIN.
2. Then: "it stays on /admin if I'm logged in and never dies; there is no log-out button."

Before, the session cookie (`lap_admin`) was an HMAC of `EDIT_PIN` with no expiry. It stopped opening the pages once a new PIN was live, but:
- it stayed in the browser, and a browser that restores its tabs kept it for good;
- there was no way to log out;
- the PIN saved in `sessionStorage` (`lap_pin`) for the action buttons kept being sent after a change. Each 401 used up a PIN-limiter attempt.

The owner chose 7 days (asked in chat).

## Incident handling in the same conversation
v4.2.2 (release PR 245) was merged at 15:05 UTC. Production still served the rolled-back v4.2.0 deployment (`laptracker-f4lbjd9bb`, old PIN), because Vercel does not move the production domain after a rollback. With the owner's approval, `vercel promote laptracker-3ju5yx7u8` was run at about 15:31 UTC. `/`, `/admin` and `/players` answered 200 on it, and the production runtime logs of the 30 min before had no error line.

## Built
- `lib/admin-session.ts`:
  - `adminToken(env, issuedAt)` gives `<issued ms>.<HMAC(CRON_SECRET, "admin:" + PIN + ":" + issued)>`.
  - `sessionState(cookie, env, now)` gives `none`, `valid`, `changed` (signature for another PIN or secret) or `expired` (7 days or more, issued more than 1 min in the future, or the old format).
  - `adminSession()` reads the cookie; `isAdmin()` is `adminSession() === "valid"`. `SESSION_MS` = 7 days.
- `app/api/admin/session/route.ts`:
  - `POST` sets the cookie with `Max-Age` 7 days.
  - `DELETE` expires it (`Max-Age=0`, the same attributes) and answers 204. It needs no PIN and no database; a cross-site `DELETE` needs a CORS preflight, and the cookie is `SameSite=Strict`.
- `app/_ui/admin/AdminShell.tsx`: passes the reason (`changed`, `expired` or null) to `PinGate`, and adds `LogoutButton` to the nav.
- `app/_ui/admin/PinGate.tsx`:
  - `PinGate`, given a reason, deletes the cookie and the saved PIN and shows "The admin PIN has changed…" or "Your admin session has ended…". Without one it only drops the saved PIN.
  - `LogoutButton` does the same and refreshes the page.
- `app/_ui/admin/PinSheet.tsx`: `forgetPin()`. `app/_ui/admin/actions.ts`: `post()` drops the saved PIN on a 401.
- Copy: `nav.logout`, `pin.changed`, `pin.expired`. `refusals.unauthorized` is now "Wrong PIN, or the PIN has changed. Press again to enter it."
- `gate.test.ts`: `adminToken(TEST_ENV, new Date())` for the new signature; no assertion changed.
- Docs: a D3 amendment, and the README step "Open `/admin` and enter the admin PIN".

## Decisions
- **No automatic renewal.** Renewing without the new PIN would let in whoever knows only the old one.
- **The expiry is checked on the server, from the signed issue time.** A copied cookie stops working after 7 days too. Moving the time in a cookie breaks its signature (`changed`).
- **An open page logs out through the existing poller.** `/admin` refreshes every 20 s while idle, so no new timer was added.
- **The cookie is deleted through a route, not in `proxy.ts`.** A server component cannot set cookies, and the proxy would need a second copy of the session check.
- **On release, every current cookie (old format) counts as expired, once.**

## Deviations
- No committed test (CLAUDE.md: not asked). The behaviour was checked with temporary tests and in the browser.

## Verified
- A temporary `sessionState` test (passed, deleted) covers:
  - no cookie gives `none`; a fresh cookie and one 1 s short of 7 days give `valid`;
  - exactly 7 days gives `expired`; issued 30 s ahead gives `valid`, 2 min ahead `expired`;
  - another PIN gives `changed`; the old format gives `expired`;
  - an old cookie with its time moved forward and the same signature gives `changed`.
- Chrome at 360 px (playwright-core) on `next dev` against a local Postgres (D47), with `DATABASE_URL` and `EDIT_PIN` set on the process only:
  - PIN change: unlocked with PIN A. A press answered 401 by the browser (it never reached the server) dropped the saved PIN. After a restart with PIN B the page was locked with "The admin PIN has changed…", and the cookie and the saved PIN were both gone. PIN B unlocked it.
  - Log out: logged in, the cookie had 7.00 days left. After **Log out** the cookie and the saved PIN were gone, and the usual PIN prompt showed.
  - Expired: a cookie issued 8 days ago and signed for the right PIN gave "Your admin session has ended…", and the cookie was deleted.
  - In the 360 px nav, Log out wraps to a second line with a 44 px target; nothing scrolls sideways.
- `pnpm check`: prettier, eslint, typecheck, 254 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.

## Open issues
- None new.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. Checks passed on the first full run.
Owner must do first: merge this PR into `dev` and release it with #246 (minor). After the release, everyone logs in once (old cookies count as expired). If production is ever rolled back again, promote the next release by hand (Vercel does not do it after a rollback).
Plan changes needed: none.

<adjustments>
- A session is `adminSession()` (`none`/`valid`/`changed`/`expired`), not a plain boolean. Pages still call `isAdmin()`.
- `DELETE /api/admin/session` ends a session; `endSession()` in `PinGate.tsx` also drops the saved PIN.
- A new client-side place that saves the PIN must be cleared in `forgetPin()` (`app/_ui/admin/PinSheet.tsx`).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/247
