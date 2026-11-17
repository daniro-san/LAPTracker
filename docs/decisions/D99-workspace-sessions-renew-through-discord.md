## D99 — Workspace sessions renew through Discord every half hour of use, up to seven days; sign-in returns to the page asked for (2026-11-17, panel batch B, ADV-1, ADV-6/7, ADV-8)

Amends D73 "Session end" and "Login and logout paths", and the 24-hour rule in D71 "Who: sessions". D71's "no token stored" is kept.

Why: under D73, a session ended after 24 hours.

- The cookie expired with it. A phone tab left open answered every Save with "Could not save. Try again." and no way out but a reload, which lost the typed work (ADV-1).
- An officer who lost the R4/R5 role kept access for up to 24 hours (ADV-8).
- Every sign-in landed on Home, so the review link in the Discord command's reply lost its target (ADV-6/7).

**What D73 stores.** No Discord token: only the session token's sha256. So the role can be checked again only by a trip through Discord. A trip with `prompt=none` asks the officer nothing when they are still signed in to Discord in that browser.

**The rule.**

- **Role check.** A session row now has `checked_at`, the last time Discord confirmed the role. It is set at sign-in and at each renewal.
- **API routes.** A workspace API serves a session for one hour after `checked_at` (`CHECK_MS`). Past that hour it answers `401 {"code":"signed_out"}`. The row is kept.
- **Pages.** A page that finds the check 30 minutes old or more (`RENEW_MS`, the last part of the hour) sends the browser through `/api/w/<slug>/login?silent=1&next=<page>`.
  - The callback reads the roles again.
  - When the person still passes, it renews the same session in place: same token, same cookie, `checked_at` = now. Then it returns to the page.
  - An officer who keeps using the desk therefore never meets a sign-in, and an API call made from a page loaded less than 30 minutes ago always has at least 30 minutes left.
- **The cap.** A session ends 7 days after sign-in (`SESSION_MS`), or earlier when the allowlist entry that let its person in ends (D73). After that, the same trip makes a new session. The cookie's Max-Age is the session's end, so the browser keeps sending it and an expired session goes through Discord silently instead of showing the sign-in.
- **Demoted officers.** A renewal whose roles no longer pass deletes that session and shows the no-access page.
  - A demoted officer loses pages within 30 minutes of their last check and the APIs within an hour.
  - A Discord error or refusal during the trip also deletes the session, so the page shows the sign-in instead of looping.
  - `/admin` → "Sign out everyone in this workspace" stays the instant way.
- **One code.** Every `/api/w/<slug>/…` route answers a request without a usable session with `401 signed_out` (the screenshot routes used to answer with the refusal reason).
  - The client shows one line everywhere: "You were signed out. Your text is still here." It is followed by a link, "Sign in again (opens a new tab), then try again here."
  - The link opens the silent sign-in in a new tab, with this page as `next`. Nothing on the page is cleared, so the next Save works.
- **Return path.** `/api/w/<slug>/login?next=` carries the page asked for. It travels inside the OAuth `state` (third dot-separated part, base64url), which is compared with its cookie in constant time. It is checked again in the callback (`returnPath`).
  - Accepted: a path starting with `/w/<slug>` (that exact path or below it), parsed against a fixed origin, with its query and without its fragment.
  - Refused: a scheme, `//host`, a backslash, whitespace, a `..` that leaves the workspace, another slug, or more than 512 characters. These go to Home.
  - A signed-out deep link (for example the Discord reply's `/w/<slug>/shots/<id>`) goes to `/w/<slug>?next=…`, and the sign-in button carries it.
  - A renewal does not add the analytics `#signed-in` fragment (D77), since it is not a sign-in.
- **Sign out.** Sign out works on a session waiting for its check. It asks first ("Sign out? The text you have not saved on this page is lost.") when the page holds unsaved work, marked `data-unsaved`: the notice editor with changes, or a draft review with fixes.

**Not chosen.**

- **Store the Discord token, encrypted, and re-check on the server every hour.** That would avoid the page trips. It reverses D71's "no token stored" and needs a key the owner must set, so it is left for the owner to decide.
- **Sliding the session on every API request without a Discord check.** That would let a demoted officer keep access through API calls alone.

**Known limit.** A browser not signed in to discord.com (for example an iPhone officer who authorised through the Discord app) sees Discord's sign-in page at a renewal instead of a silent trip. Under D73 this happened once a day; now it can happen at each renewal until they sign in to Discord in that browser.
