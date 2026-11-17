## D99 — Workspace sessions renew in place through Discord about once a day, up to seven days; sign-in returns to the page asked for (2026-11-17, panel batch B, ADV-1, ADV-6/7, ADV-8)

Amends D73 "Session end" and "Login and logout paths". D71's "no token stored" and its "loses access within a day" are kept.

Why: under D73, a session ended after 24 hours, and its cookie expired with it.

- A phone tab left open answered every Save with "Could not save. Try again." The only way out was a reload, which lost the typed work (ADV-1).
- Every sign-in landed on Home, so the review link in the Discord command's reply lost its target (ADV-6/7).

**What D73 stores.** No Discord token: only the session token's sha256. So the role can be checked again only by a trip through Discord. A trip with `prompt=none` asks the officer nothing when they are still signed in to Discord in that browser.

**The rule.**

- **Role check.** A session row has `checked_at`, the last time Discord confirmed the role. It is set at sign-in and at each renewal.
- **API routes.** A workspace API serves a session for 24 hours after `checked_at` (`CHECK_MS`). Past that it answers `401 {"code":"signed_out"}`. The row is kept.
- **Pages.** A page that finds the check 23 hours old or more (`RENEW_MS`), or the session past its end, sends the browser through `/api/w/<slug>/login?silent=1&next=<page>`.
  - The callback reads the roles again.
  - When the person still passes, it renews the same session in place: same token, same cookie, `checked_at` = now. Then it returns to the page.
  - The visible trip comes about once a day, as under D73. An API call made from a page loaded before the 23rd hour still has at least an hour left.
- **The cap.** A session ends 7 days after sign-in (`SESSION_MS`), or earlier when the allowlist entry that let its person in ends (D73). After that, the same trip makes a new session. The cookie's Max-Age is the session's end, so the browser keeps sending it and an expired session goes through Discord silently instead of showing the sign-in.
- **Demoted officers (ADV-8).** An officer whose R4/R5 role was removed loses access within 24 hours, at the latest at the next renewal. "Sign out everyone in this workspace" on `/admin` is the instant way.
  - A renewal whose roles no longer pass deletes that session and shows the no-access page.
  - A Discord error or refusal during the trip also deletes the session, so the page shows the sign-in instead of looping.
- **One code.** Every `/api/w/<slug>/…` route answers a request without a usable session with `401 signed_out`.
  - The client shows one line everywhere: "You were signed out. Your text is still here." It is followed by a link, "Sign in again (opens a new tab), then try again here."
  - The link opens the silent sign-in in a new tab, with this page as `next`. Nothing on the page is cleared, so the next Save works.
- **Return path.** `/api/w/<slug>/login?next=` carries the page asked for. It travels inside the OAuth `state` (third dot-separated part, base64url), which is compared with its cookie in constant time. It is checked again in the callback (`returnPath`).
  - Accepted: a path starting with `/w/<slug>` (that exact path or below it), parsed against a fixed origin, with its query and without its fragment.
  - Refused: a scheme, `//host`, a backslash, whitespace, a `..` that leaves the workspace, another slug, or more than 512 characters. These go to Home.
  - A signed-out deep link (for example the Discord reply's `/w/<slug>/shots/<id>`) goes to `/w/<slug>?next=…`, and the sign-in button carries it.
  - A renewal does not add the analytics `#signed-in` fragment (D77), since it is not a sign-in.
- **Sign out.** Sign out works on a session waiting for its check. It asks first ("Sign out? The text you have not saved on this page is lost.") when the page holds unsaved work, marked `data-unsaved`: the notice editor with changes, or a draft review with fixes.

**Owner's decision, not built: an encrypted Discord refresh token.**

- **What it would do.** The callback would keep the Discord refresh token, encrypted with AES-GCM under a new secret env key. The server would then check the role about every hour with no visible trip.
- **What it gives.** A demoted officer loses access within about an hour instead of 24 hours. Officers whose browser is not signed in to discord.com never see Discord's sign-in page at a renewal.
- **What it costs.**
  - It reverses D71's "no token stored": a database leak plus that key gives read access to each officer's identity and server membership until the token is revoked.
  - It needs a new secret env var that the owner sets and rotates.
  - It adds a Discord call on the request path once an hour per officer.
- **Not chosen either:** extending a session on every API request without a Discord check, because that would let a demoted officer keep access through API calls alone.

**Amendment (2026-11-17, 11z, D105).** The `/admin` button "Sign out everyone in this workspace" now reads "Sign out everyone, including me", in a danger style, after "Sign out members only (officers stay signed in)" (D105). What it does is unchanged.
