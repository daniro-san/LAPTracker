# feat — a new alliance gets its Desk by itself: invite link and Request an Officers' Desk (issue 453)

## Built

- **/admin → New alliances** (`app/_ui/admin/Invites.tsx`, `InvitesCard.tsx`, `POST /api/admin/invites`, PIN):
  - Requests, each with "Roster says: R4 · Recruiter, seen 19 Nov" or "Name not found in the roster". The owner can "Approve and make the link" or "Decline", with an optional reason.
  - "Invite an alliance": the owner picks a tracked alliance without a workspace and taps "Create the invite link". The link is shown once, with Copy.
  - "Invite links": each link with its state and "Cancel the link".
  - A new link for an alliance cancels its earlier one.
- **The link** `/api/w/invite/<id>.<secret>`:
  - It holds 32 random bytes. Only the sha256 is stored, and the check uses `timingSafeEqual`.
  - It works once, for 7 days.
  - Opening it trades the secret for an HttpOnly cookie, then goes to `/w/invite`. The secret is never in a page's address.
  - A wrong link is counted under the IP (D73's limits).
- **`/w/invite`** has four steps, each with a tip, in EN, PT-BR and FR:
  1. **Sign in with Discord** (`identify guilds`). This uses D73's one callback with a state starting `invite.`. The server list is read on the server, and only the servers she owns or can manage are kept.
  2. **Pick the server.** A server that already has a workspace shows "Already has a Desk" and is refused.
  3. **Add the bot** with D129's install link, then "I added it: continue". This reads the server's roles with the bot token, and the step waits while the bot is not in.
  4. **Pick the roles** from lists, by name and colour. Or create `[TAG] Leadership` and `[TAG] Members` (editable, with the alliance's own tag). This needs "Allow LAPTracker to create roles" first, a second install link with Manage Roles. "Give me the leadership role" is ticked by default. Discord's refusals are said in plain words.
- **"Open our Officers' Desk"** does all of this in one transaction:
  - marks the link used;
  - creates the workspace, only as a new row;
  - adds her as an allowlisted officer with no end.

  It then registers the commands that are on in her server and signs her in on her Desk.
- **`/w/request`** needs no account:
  - She gives the alliance, her in-game name, and "I'm the alliance leader (R5) or an R4" with R5 or R4.
  - At most 3 a day per address and 30 a day for the site.
  - The owner gets one line in the admin Discord channel.
  - The status page shows waiting, approved ("Continue" opens the invite with her own status secret) or not approved with the owner's reason. It also gives a link to keep.
- **Storage**: migration `0052_alliance_invites` (`alliance_invites`, `access_requests`). Decided requests and closed links are deleted 30 days after.
- **Analytics** (issue 486): `ws_access_requested`, `admin_workspace_approved`, `ws_invite_opened` and `ws_invite_completed`, with a new section and funnel in the tracking plan. `/w/invite` and `/w/request` carry no `workspace` property.
- **Docs**: D130; amendments to D73, D101 and D126; ARCHITECTURE.md.

## Decisions

- **Request access needs no Discord account.** This follows the owner's comment of 2026-11-20 (name, rank, roster match only). The requester comes back through a random status secret, kept in a cookie and as a link. The owner's 2026-11-19 comment asked for a Discord DM; that is not built, because there is no account to DM.
- **The invite's first officer is on the allowlist with no end.** She gets in before she holds the role, and she is never locked out later.
- **One account per invite, once a server is picked.** Until then, signing in again with another account replaces the first, so a wrong account can be fixed.
- **The server list and the steps' state live on the invite row.** No new session type is added. The list is dropped when the link is used.
- **The alliance list for requests is the tracked alliances.** Issue 459's ranks-board list is not in `dev` yet.
- **Neither table has a `workspace_id`.** The invite keeps the created slug as text, so D125's purge and download are untouched.

## Deviations

- Issue body step 5 said "the owner gets a Home line" when a Desk is made. /admin shows "used: /w/<slug>" instead; there is no Home line.
- `lib/private/discord.ts`: the code exchange moved into `exchangeCode`, and `userSchema` now returns `{id, name}`. Both the sign-in and the invite use them, and sign-in behaviour is unchanged.

## Verified

- Tests, 14 new:
  - `lib/private/invite.test.ts` (5);
  - `lib/private/access-request.test.ts` (3);
  - `lib/private/invite-isolation.test.ts` (3, the issue 471 suite: a taken server is refused; an invite never attaches to another workspace, its alliance's or one on a server taken meanwhile, with Bravo's rows identical; a status secret opens only its own request);
  - `app/api/admin/invites/route.test.ts` (2);
  - tracking-plan checks.
- Full vitest before the copy fixes: 1266 passed, 4 skipped. `pnpm check`: see the commit report.
- **Local e2e, 47 of 47 checks pass.** Setup: a production build (`next start` on :55464), local Postgres 18 with all 53 migrations, the bridge, and a Discord stand-in on :55462 that handles authorize, token, guilds, roles and commands. Invented data: WACK's roster with "Vellamo Rook", R4 · Recruiter; YAHO's workspace on "Second Hall". The run covered:
  - The request: it waits for the tick, the status link is shown, and the admin channel line is sent through the stand-in.
  - /admin shows the roster line and the approve link.
  - The requester continues. The invite address carries no secret.
  - Only managed servers are listed, and the taken one is disabled.
  - The bot link is locked to the server with permissions 309237648384.
  - The step waits for the bot.
  - The roles are listed without @everyone. The names prefill with `[WACK]`, and the create link has 309506083840.
  - The refusal is said in words, and the roles are created and picked.
  - The Desk opens signed in, and the used link shows "Your Officers' Desk is ready."
  - The commands were PUT only to her server, and the leadership role was given.
  - A second link is refused for an alliance with a Desk.
  - No sideways scroll at 360 or 1280, light or dark, in EN, PT and FR.
- Screenshots: 27, in the scratchpad's `453-shots/`.
- **Persona panel** (an R5 alone in PT/FR, the owner, product strategy): every persona said "ship with fixes". Applied:
  - the leadership help says "not the members' role";
  - "Save this link. It is the only way to see the answer later…";
  - the admin link help says a request also gets Continue on its page;
  - the Discord line links `/admin#new-alliances`.

  The "disabled Send has no reason" point was already covered: the line shows while the box is unticked.
- No player name from the 2049 fixture names appears in the diff. The one hit is the alliance name "TheWackyOnes", which is already public in `config/alliances.ts`.

## Open issues

- Nothing on the public site links to `/w/request` yet. Issue 457's `/w` page should add "Leading an alliance? Request an Officers' Desk."
- Not done (persona nice-to-haves):
  - on narrow screens, the "create the roles" block sits below both role lists;
  - a claimed R5 that the roster lists as R4 is not highlighted on /admin;
  - the Desk's tracker-key card does not say where to get a key.
- Not checked against real Discord: the shape of the `/users/@me/guilds` permissions; 403 on `POST /guilds/{id}/roles` without Manage Roles; 403 on giving a role above the bot's. All three follow Discord's documentation.
- The new-alliance guide is outside the repo. Its ID-copy steps should become "open the invite link".
- An invite's allowlist entry has no end, and /admin has no way to remove an allowlist entry.

## Next

- Model/effort: keep.
- Owner first: nothing in Vercel or the Discord application. To try it: /admin → New alliances → Invite an alliance.
- Plan change: none.

<adjustments>
- #457: link "Leading an alliance? Request an Officers' Desk." to `/w/request`. `invite` and `request` are reserved slugs.
- #459: swap the request form's alliance list (`ALLIANCES` in `app/(private)/w/(onboarding)/request/page.tsx` and `requestInput`) and /admin's invite picker for the ranks-board list. `allianceOf` in `lib/private/invite.ts` gives the tag for role names.
- #486: the four onboarding events exist. Skip them there.
</adjustments>

PR: (added by the orchestrator)
