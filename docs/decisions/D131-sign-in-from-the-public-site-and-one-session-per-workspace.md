## D131 — "Sign in" on the public site opens /w: one Discord sign-in finds every alliance the account may open, and each workspace keeps its own session cookie (2026-11-20, owner, issue 457; amends D73, D99, D105)

Why: with more than one alliance, people need a way in from the public site, not only the `/w/<slug>` link someone sent them (owner, issue 457). And D73's "one session cookie per browser" meant that signing in to a second workspace replaced the first.

**The links.**

- Public header: a quiet "Sign in" text link to `/w`, from 640 px. Below 640 px the header has no room (D49's 360 px budget), so the same link sits at the bottom of the gear menu as "Alliance officers and members: sign in".
- Footer: "Alliance officers and members: sign in", on every public page.
- Both strings are in `lib/copy.ts` (`site.signIn`, `site.signInFooter`) and translated into all 18 languages. /admin's header (`publicPage` false) has no header link.

**`/w`** (`app/(private)/w/(onboarding)/page.tsx`, EN · PT · FR in `lib/private/dictionary.chooser.ts`). It is under the onboarding layout: not indexed, no link preview, masked in replay.

- **"Sign in with Discord"** goes to `GET /api/w/login`, then Discord through D73's one callback. The state starts with `w.`. No slug has fewer than two characters, so no workspace state starts with that, and no slug needs to be reserved. A bad state counts under D73's per-IP limit (`stateRefusal`, shared with D130).
- **Scopes**: `identify guilds.members.read guilds`.
  - **Deviation from the issue**, which said `identify guilds`: a member's roles in a server can only be read with `guilds.members.read`. Without it, the roles could not be "checked the same way sign-in does today".
- **What the callback does** (`finishChooserSignIn`, `lib/private/chooser.ts`):
  1. It reads `/users/@me` and `/users/@me/guilds` once, on the server.
  2. It matches the servers' ids against `workspaces.discord_guild_id` (`workspacesOnServers`), at most 10 matches.
  3. For each match, it reads the person's roles there (`/users/@me/guilds/{id}/member`) and applies that workspace's own rules (`refusalFor`: blocked, leadership role or allowlist → officer, member role → member; D71, D105).
  4. Each workspace that lets the person in gets its session renewed or made (`admit`), exactly as its own sign-in does.
  5. A workspace that now refuses a session this browser holds ends that session (D99's renewal-or-out).
  - The server list is never stored, logged or sent anywhere. The log line `w.chooser` carries only the counts (`matched`, `admitted`).
- **Where it lands.**
  - Exactly one: straight there, the desk for an officer, the board for a member.
  - Several: `/w`, which lists them.
  - None: `/w?e=none`, "We didn't find an alliance for this Discord account yet. Ask your alliance's leadership whether it uses LAPTracker." The issue's "Ask your leadership for the link" was changed after the persona panel, since members get in through their role, not a link.
  - Discord refused or did not answer: D73's `signin.e.*` lines.
- **The list** ("Signed in on this device", `chooserView`) is read from this browser's own session cookies only, never from Discord.
  - One row per open session: the alliance's tag and name, "Officers' Desk" or "Members' board", one tap to open it.
  - It names no workspace this browser has no session for.
  - A cookie whose name is another workspace's lists nothing.
  - A blocked person's session, an ended session, and a member's session in a workspace whose board is closed are left out.
  - Under the list: "Missing an alliance? You may be in it with another Discord account." and the sign-in again.
- **"Leading an alliance?"** with "Request an Officers' Desk for your alliance" links to `/w/request` (D130). The panel found the first wording, "No Desk yet? Request one", read as two questions in a row. This is the first public link to it.
- The page bar says "LAPTracker", not "Officers' Desk", since members sign in here too (persona panel).
- Analytics: `/w` is the `workspace` area with no `workspace` property (`areaOf`), like `/w/invite`. A sign-in that made a session adds D77's `#signed-in` fragment to the landing page.
- `proxy.ts` now sets `private, no-store` on `/w` and `/api/w` themselves, not only below them.

**Sessions: one cookie per workspace (the issue's first option).** Chosen over "switch workspace from a menu in the desk header". With one cookie per workspace, the chooser's single sign-in leaves the person signed in to every alliance at once. A menu would need another trip through Discord at each switch.

- The cookie is `__Host-lap_ws.<slug>` (`sessionCookieName`), with D73's attributes and D99's Max-Age. Every sign-in, renewal, the invite's finish (D130) and the chooser write it.
- `requireWorkspace`, `requireBoard`, the callback and Sign out read the workspace's own cookie, else the old single cookie `__Host-lap_ws` (`sessionToken`).
  - Sessions made before this change keep working until they end: 7 days for an officer, 30 for a member. Then the next sign-in writes the new cookie.
  - The old cookie is never written again.
- Sign out clears the cookie that carried the session, so it signs out of that workspace only.
- Nothing else changes. A session row still belongs to one workspace (`INVARIANT workspace.session-bound`). A token under another workspace's cookie name gets `other_workspace`. D99's renewal, D105's tiers and the 401 `signed_out` code are unchanged.

**Tests** (one per behaviour, `lib/private/chooser.test.ts`):

- the authorize URL's scopes, callback and `w.` state;
- a person in two alliances on different servers is signed in to both, each at its own tier;
- roles are read only on servers that have a workspace, and no server list is stored;
- exactly one goes straight there (the board for a member);
- none says so and makes no session.

The issue 471 suite (`lib/private/member-sessions.test.ts`): one browser keeps a cookie per workspace, and a token renamed to the other workspace's cookie opens nothing and is not listed. `sign-in.test.ts` now expects the per-workspace cookie name.

**Owner steps.**

1. Discord Developer Portal: nothing. The redirect URI is D73's one callback, and scopes need no setting.
2. Vercel: nothing.

**Not done here.** A "switch alliance" menu in the desk header: `/w` lists the alliances instead. Listing alliances whose session ended (sign in again to see them).
