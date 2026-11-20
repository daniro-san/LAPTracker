# fix-498-500-followups: the review follow-ups of D129 (issue 498) and D130 (issue 500)

## Built

**Issue 498 (D129, alliance Discord settings)**

- Tests in `app/(private)/api/w/[slug]/discord/route.test.ts`, 4 new:
  - the limits: 5 Checks, 10 saves and 5 test messages per 15 minutes, refused ones included;
  - `commands_failed` when Discord refuses the commands `PUT`, with nothing recorded;
  - the install link: this server's `guild_id`, `disable_guild_select=true`, permissions `309237648384`;
  - after a `WORKSPACE_KEYS_SECRET` change, a saved webhook is `reenter`, and posting gets no channel. It never falls back to `WORKSPACE_DISCORD_WEBHOOKS`.
- The rule for which /admin changes re-register commands moved out of `app/api/admin/workspaces/features/route.ts`. It is now `changesCommands` in `lib/workspace-commands.ts`, built on `COMMAND_FEATURE`, which `lib/app-commands.ts` now exports, and on `SPENDS`. The pause rule is now "an allowance a command spends", not the literal `"translate"`. Behaviour is the same.
- `channelNames` runs in parallel with the page's own read on Board, Members (with the members view) and Garrison. On Garrison, the pair is read in `readGarrison` beside the page function, which keeps that function under the 80-line lint limit.
- `lib/private/discord-webhooks.ts`: `viewOf` no longer needs `as string`.
- D129's quoted card wording now matches `dictionary.discord.ts`.

**Issue 500 (D130, invites and requests)**

- Tests, 7 new:
  - in `lib/private/invite.test.ts`:
    - five wrong links from one address are counted, then even the right link is refused from that address, while another address gets in;
    - an invite takes 30 steps, then the next gets `rate_limited`;
    - the transaction's own guards, through `createInvitedWorkspace` directly: a second use is `closed`; a server or an address taken meanwhile is `taken`, and the link stays unused with no officer row.
  - in `lib/private/access-request.test.ts`:
    - the site takes 30 requests a day, then refuses the 31st;
    - an unanswered request is deleted 30 days after it was sent.
- Layering: `insertNewWorkspace` and `insertFirstOfficer` in `lib/repo/workspaces.ts` write the workspace and first-officer rows. `lib/repo/alliance-invites.ts` calls them inside the invite's transaction.
- /admin requests list:
  - `listRequests` returns the newest 50 (`REQUESTS_SHOWN`) and a `more` flag;
  - when there are more, the card says "Showing the newest 50. Requests never answered are deleted after 30 days.";
  - `purgeOldInvites` also deletes requests that are never answered 30 days after `created_at`.
- The owner's line when an alliance completes its Desk:
  - `POST /api/w/invite` sends one line to `NOTIFY_WEBHOOK_ADMIN` after `finish` (`deskMadeMessage` in `lib/notify-request.ts`): "Desk made: [TAG] Name now has its Officers' Desk at /w/<slug>. It shows on /admin#new-alliances." A failed send is ignored;
  - on /admin, a used invite link now reads "Desk made 20 Nov: /w/<slug>";
  - `inviteStep`'s finish result now carries `unionId`.
- Persona follow-ups:
  - `InviteRoles.tsx`: below 640 px (`max-sm:order-first`), the "Create the roles" block comes before the two role lists;
  - /admin: under a request whose claimed R5 the roster lists as R4 (`rankWarning`), a highlighted plum line says "Says R5, but the roster lists R4 · Recruiter. Worth a check before you approve.";
  - Home's tracker-key card, while the alliance has no key of its own (`none` or `site`), says "To get a key: sign in on the tracker's account page with Patreon, then copy the key that starts with lap_." The link "Open the tracker's account page" goes to `/account` on `LAP_SITE_BASE_URL`'s host in a new tab. It is in EN, PT-BR and FR. To keep `page.tsx` under the 300-line limit, `KeyCard` moved to `app/(private)/_ui/KeyCard.tsx`.
- Dated amendments: D129 and D130, both 2026-11-20. ARCHITECTURE has two line updates.

## Decisions

- **The owner's "Home line" goes to two places, because there is no owner Home page:**
  - the admin Discord channel, which already gets the request line;
  - /admin → New alliances → Invite links.
- **The commands rule goes in `lib/workspace-commands.ts`, not in a new module.** /api/admin already imports it, and it already holds the "commands follow the switches" logic. It is not `lib/private` (D71 fence).
- **The list shows 50 requests.** At 30 a day with the 30-day purge, at most about 900 rows can exist, so 50 covers one to two busy days.
- **The rank highlight:**
  - it shows only when R5 is claimed and the roster's rank text starts with "R4" (`/^R4\b/`), as the persona asked;
  - other mismatches, such as R5 claimed and R3 listed, are not highlighted;
  - it is a line, not a block: it never stops Approve (D75).
- **Where to get a key:**
  - the words follow `docs/IMPLEMENTATION_PLAN.md` ("Key from `/account` after Patreon login") and `docs/PREREQUISITES.md`;
  - the host is built from `LAP_SITE_BASE_URL`, because `no-upstream-literals.test.ts` allows the host only in `lib/env.ts`.

## Deviations

- Members: only `channelNames` joined the parallel read. `toReviewCount` stays after it, as before, to keep the change in scope.
- `KeyCard` moved to its own file, and Garrison has a small `readGarrison` function. Both are only to stay under the lint line limits this change would otherwise break.
- I added one more test than issue 500 lists: the purge of unanswered requests. It covers a rule this change adds.

## Verified

- `pnpm check` passes: prettier, eslint, tsc, vitest, drift and i18n. Vitest: 237 files passed, 2 skipped. Tests: 1281 passed, 4 skipped.
- The touched suites pass on their own:
  - Discord route and features route: 12 of 12;
  - invite, access request, invite isolation and admin invites route: 24 of 24.
- No real Discord or upstream call: every test uses the existing stubs.
- Privacy: the added lines contain none of the 328 member and leader names in the `fixtures/**/alliance-*.json` rosters.
- **Not run:** the local e2e on a production build, and the screenshots at 360/1280, light/dark, EN/PT. The UI changes are small:
  - a flex `order` class on the invite's roles step;
  - one highlighted line on /admin;
  - a paragraph and a link on Home's key card.

  Reaching the roles step needs the Discord stand-in and a signed-in invite. That fixture is not set up in this worktree. Typecheck and lint cover the markup; the layout is not verified by eye.

## Open issues

- Screenshots of the three UI changes have not been taken: `/w/invite` step 4 at 360 px, /admin request with the R4 line, Home key card in PT and FR. Take them before release, as for the guide (owner's standing rule).
- `listInvites` on /admin has no limit. It is bounded by one open link per alliance and the 30-day purge, so I left it.
- D130's "Not done here" still says the owner's Home line is not built. The amendment supersedes it. The sentence itself was left unchanged.
- The account page path (`/account`) comes from the plan's note of 2026-11-04. Nobody has checked it again since.

## Next

- Model/effort: keep. This was test and wiring work, with no new design.
- Owner first: nothing in Vercel or Discord. The Desk-made line uses the existing `NOTIFY_WEBHOOK_ADMIN`.
- Plan change: none.

<adjustments>
- Issue 498 and issue 500 are done. Skip their items in any later session.
- `changesCommands(change)` in `lib/workspace-commands.ts` is the one place to extend if a new Discord command or allowance is added. Add the command to `COMMAND_FEATURE` and the rule follows.
- `insertNewWorkspace` and `insertFirstOfficer` in `lib/repo/workspaces.ts` are the writes any future "create a workspace" path should reuse.
</adjustments>

PR: (added by the orchestrator)
