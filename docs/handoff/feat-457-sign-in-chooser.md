# feat-457 — "Sign in" on the public site, the /w chooser, one session per workspace

## Built

- **Public links** to `/w`:
  - the header's "Sign in", from 640 px;
  - below 640 px, the bottom row of the gear menu;
  - the footer's "Alliance officers and members: sign in".
  - Two keys in `lib/copy.ts` (`site.signIn`, `site.signInFooter`), translated into all 17 other languages by the translate-copy skill and stamped.
- **`/w`** (`app/(private)/w/(onboarding)/page.tsx`): "Sign in with Discord", the list of the alliances this device is signed in to, the "none" line, D73's error lines, and "Leading an alliance?" with "Request an Officers' Desk for your alliance" linking to `/w/request`. Words in EN, PT and FR in `lib/private/dictionary.chooser.ts`.
- **`GET /api/w/login`** and the callback's `w.` branch (`lib/private/chooser.ts`):
  - one Discord sign-in (`identify guilds.members.read guilds`);
  - the account's servers are matched against the workspaces, at most 10;
  - each match is checked by that workspace's own rules (`refusalFor`), then `admit` makes or renews its session;
  - exactly one goes straight there, several go to `/w`, none goes to `/w?e=none`.
- **One session cookie per workspace**: `__Host-lap_ws.<slug>` (`sessionCookieName`, `sessionToken`, `sessionCookie` in `lib/private/session.ts`).
  - `openSession`, `signOut`, the callback and the invite's finish use it.
  - The old `__Host-lap_ws` is still read, never written.
  - Logout clears the cookie that carried the session.
- **Refactors needed for the above.**
  - `memberIn` was split out of `readMember` (`discord.ts`).
  - `admit` returns the cookie and the landing; `landing()` builds the redirect (`sign-in.ts`).
  - `stateRefusal` is exported from `invite-sign-in.ts`.
  - Two repo reads: `workspacesOnServers`, `sessionsByHashes`.
- `proxy.ts`: `private, no-store` on `/w` and `/api/w` themselves. `areaOf`: `/w` is the workspace area with no workspace.
- D131, the index line, and a D73 amendment.

## Decisions

- D131. Sessions: one cookie per workspace (the issue's first option), not a switch menu. The chooser's single sign-in then leaves the person in every alliance at once, and switching needs no Discord trip.
- The `/w` list comes only from this browser's own session cookies. It never comes from Discord or from other workspaces, so it cannot reveal a workspace.
- The state prefix is `w.`. No slug is shorter than two characters, so no new reserved slug is needed.
- A workspace that refuses the person during the chooser's trip ends the session this browser held there (D99's renewal-or-out).
- Two wordings follow the persona panel; the orchestrator decided them under the owner's standing OK for persona-validated copy:
  - the "none" line: "We didn't find an alliance for this Discord account yet. Ask your alliance's leadership whether it uses LAPTracker." (was the issue's "…Ask your leadership for the link.");
  - the request link: "Request an Officers' Desk for your alliance" (was the task's "No Desk yet? Request one").
  - PT and FR are the panel's. Both strings are in the workspace dictionary (`lib/private/dictionary.chooser.ts`, EN/PT/FR), not `lib/copy.ts`, so the translate-copy skill had nothing to translate (`i18n:todo` is `{}`).

## Deviations

- **Scopes.** The issue says `identify guilds`. The chooser asks for `identify guilds.members.read guilds`, because the roles in a server can only be read with `guilds.members.read`, and the issue asks for the role check sign-in does today.
- **Header below 640 px.** The issue asks for a header link. At 360 px the header has 3 px to spare (D49), so below 640 px the link is in the gear menu, plus the footer.

## Verified

- **`pnpm check`**: green after rebasing onto `origin/dev` with #502: 238 test files, 1287 tests passed and 4 skipped; i18n: 17 languages up to date. The one conflict was `finishInvite`'s return in `lib/private/invite-steps.ts`: #502's `unionId` is kept, with this branch's per-workspace cookie.
- **New tests**: 5 in `lib/private/chooser.test.ts`, and 1 more in the issue 471 suite (`lib/private/member-sessions.test.ts`):
  - one browser keeps a cookie per workspace;
  - a token renamed to the other workspace's cookie opens nothing and is not listed.
- **Existing tests**: `sign-in.test.ts` now expects the per-workspace cookie name. All other tests pass unchanged, because they send the old cookie name, which is still read.
- **Local e2e: 39 of 39 checks pass.**
  - Setup:
    - a production build (`next build`, `next start` on :55534);
    - local Postgres 18 with all 53 migrations, and the seed's invented data;
    - two workspaces (OGs and WACK) on invented servers;
    - a Discord stand-in on :55535 with three invented accounts.
  - The run covered:
    - the header link is hidden at 360 and shown at 1280; the gear row at 360; the footer link at both widths;
    - `/w` answers `private, no-store` and links `/w/request`;
    - an account in no alliance gets the plain line and no cookie;
    - a member of one alliance goes straight to its board;
    - an officer in OGs and member in WACK: both are listed with the right labels, two cookies are set, both open, and OGs stays signed in after opening WACK;
    - signing out of OGs leaves only WACK listed;
    - the scopes Discord was asked for, and no role read on a server without a workspace;
    - no sideways scroll on `/w`, signed out and with the list, in EN and PT, light and dark, at 360 and 1280.
- **Screenshots**: 23, in the scratchpad's `457/shots/`. Looked at as a designer: nothing overflows, and the PT lines wrap cleanly.
- **Persona panel** (a member on a phone in PT, an R4 in two alliances, product strategy): all three said "ship with fixes". Applied:
  - the bar reads "LAPTracker", not "Officers' Desk";
  - "Signed in on this device";
  - "Missing an alliance? You may be in it with another Discord account." (PT and FR to match);
  - after review, the "none" line and the request link (see Decisions).
  - The e2e and the screenshots ran before those two wordings changed; the change is copy only.
- **Privacy**: the invented names were checked against the OGs fixture roster. "Wren" was a substring of a real name and was replaced.

## Open issues

- **Discord's rate limit** on `/users/@me/guilds/{id}/member` is tight. A person in many workspace servers gets up to 10 reads in one callback. A read Discord refuses leaves that workspace out, with no error shown.
- **Old cookie**: sessions made before this change stay on `__Host-lap_ws` until they end (7 or 30 days). Nothing to do.
- **`/w` lists only workspaces with an open session.** After 30 days without visiting, an alliance disappears from the list until the person signs in again.

## Next

- Model/effort: keep.
- Owner first: nothing in Vercel or the Discord application.
- Plan change: none.

<adjustments>
- Any new sign-in path writes `sessionCookie(slug, …)` and reads `sessionToken(cookies, slug)`, never `SESSION_COOKIE` directly.
- `/w` is the public way in. A guide or message that sends people to `/w/<slug>` can send them to `/w` instead.
- `refusalFor`, `admit` and `landing` in `lib/private/sign-in.ts` are the reusable pieces of a sign-in.
</adjustments>

PR: (added by the orchestrator)
