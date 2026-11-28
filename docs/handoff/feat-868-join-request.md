# feat/868-join-request

## Built
- **`/join`** (`JOIN_COMMAND` in `lib/app-commands.ts`): a slash command (type 1) with one required text option `player` (1–40 characters) and PT-BR and FR descriptions. Its D126 switch is `discord_join` (group `discord`; labels in `lib/copy-admin-features.ts` and `lib/private/dictionary.switches.ts`). It is registered with the other commands through `commandsFor`.
- **`lib/private/discord-join.ts`**: after the existing signature and 5-minute check in `handleInteraction`, it records one request per Discord user and workspace (`join_requests`) and replies privately (`flags: 64`, mentions off) with "Sent to your officers." in the sender's Discord `locale`. Refusals: no workspace ("no Officers' Desk"), switch off, empty text, more than 3 an hour per person (`auth_attempts` key `join:` plus a SHA-256 of the Discord id). A new request (not a replaced one) gives the route a `joinNote`. The interactions route opens the leaders' webhook before answering and posts one message after the answer, containing only the typed text and a link to `/w/[slug]/requests`, in the server's `guild_locale`.
- **Members → Requests** (`app/(private)/w/[slug]/requests/page.tsx`, `_ui/JoinRequests.tsx`): a Members view in the switch and the sidebar while `discord_join` is on. Each open request shows "mossy asks to join as “Moss”", the day it was sent, one "Approve as <name · rank>" per newest-roster player matched (an ID the roster lists, else the D74 matcher's match or its suggestions), and Decline. With no match: "Not in the roster yet…" and Decline only.
- **`POST /api/w/[slug]/join-requests`** (`lib/private/join-requests.ts`): officers only (`requireWorkspace`), same origin, strict zod body. Approve upserts the Discord user's `workspace_users` row (`joinUser`; a row grants no access) and sets an approved link through `setLink` (D142's flow: other pending claims of that player go; `409 taken` when someone else holds it). It then deletes the request, gives the member role (`PUT /guilds/{g}/members/{u}/roles/{r}` with the bot token), and posts the welcome (D159 post 3) for that one member when the owner allows it and officers turned it on. The answer carries codes only. Decline deletes the request and posts nothing. Both count as `ws_action` `join_request` (tracking plan updated).
- **Alliance settings → Discord → Member role** (`_ui/DiscordMemberRole.tsx`, `lib/private/discord-member-role.ts`): "Choose a role" reads the server's roles and the bot's own member with the bot token and offers only roles below the bot's highest, without @everyone and managed roles. "Check and save" reads them again and stores only a role still in that list (422 `not_below` otherwise). Remove clears it. These are actions `roles`, `member_role` and `remove_member_role` on `/api/w/[slug]/discord`, limited to 10 per 15 minutes per workspace.
- `BOT_PERMISSIONS` gains Manage Roles: `309506083840`. The bot step's lead line says the bot gives the member role.
- Expiry: a request older than 7 days is neither listed nor answered; the daily tick deletes it (`purgeOldJoinRequests` in `lib/tick.ts`).
- Migration `drizzle/0092_join_requests.sql` (from `pnpm db:generate`): table `join_requests`, columns `workspace_discord.member_role_id` and `member_role_name`. `join_requests` is in D125's list (`lib/repo/workspace-data.ts`, not downloaded).
- Words: `lib/private/dictionary.join.ts` (EN, PT-BR, FR), spread into the settings dictionaries.
- Tests:
  - `lib/private/discord-join.test.ts`: a signed `/join` records the request and gives the note; an unsigned one records nothing; the 4th in an hour is refused; the tick purges a request older than 7 days.
  - `app/(private)/api/w/[slug]/join-requests/route.test.ts`: Approve creates the approved link, gives the role with the bot token and posts the welcome; Decline posts and links nothing; an expired request is not shown or answered; another workspace's officer neither sees nor answers it.
  - The member role test in `app/(private)/api/w/[slug]/discord/route.test.ts`: only a role below the bot is offered and saved.
  - The existing tests that list the command set, the tables, the desk features and the officer routes were updated.
- Dated amendments to D129 and D142.

## Decisions
- A slash command only; no button. The task said "and/or". A button would need a message that the bot posts and keeps somewhere, which this app does not have.
- `discord_join` is a free feature. It is allowed and on by default, so a new alliance's Check registers `/join` too. Every request still waits for an officer.
- No alliance-wide language setting exists. The private reply follows the sender's Discord locale, as D101's commands do. The leaders' note follows the server's `guild_locale`, else English. The welcome uses its post's own language.
- Approve is offered only for a player in the newest roster, because a D142 link needs a roster uid. A request whose player is not listed yet waits up to 7 days, or is declined.
- A role Discord refuses, or a failed welcome, does not undo the link. The desk line says what did not happen.
- The bot's user id is taken as `DISCORD_CLIENT_ID`, the application id. Discord gives a bot user the application's id.

## Deviations
- None from the task. Beyond the prompt: the install link's permission integer changed (Manage Roles), and the existing Check, feature and registration tests now expect `/join` in the command set.

## Verified
- `pnpm vitest related --run` on all changed files: 272 files ran. Eight failures were the expected list checks (command set, D125 tables, tracking plan, officer-route fixtures). After fixing them, the failed files and 33 seed-related files pass.
- `pnpm typecheck`: passed.
- `pnpm check`: passed on the second run (422 test files and 2,316 tests passed, 2 files skipped; drift and i18n checks clean). The first run stopped at a type error in the settings route's role-action narrowing, which is fixed.
- No real Discord or upstream call was made: every test stubs `fetch`.

## Open issues
- **Double welcome:** a member approved here gets the welcome at once. The daily welcome also names everyone new in the roster against the day before, so a player who joined in the game that same day may be named twice.
- Home's "To review" count does not include join requests. Officers learn of them from the leaders' channel note and the Requests view.
- A server that added the bot before this release has no Manage Roles until an officer taps "Add LAPTracker to Discord" again. Until then, Approve says the role was not given.
- `/join` replies are in the sender's language. The command's name stays `join` in every language; only its descriptions are localized.

## Next
- Owner steps, once after the release:
  1. Nothing in the Discord Developer Portal or Vercel: the commands are guild commands, registered by each alliance's Check in Alliance settings → Discord or by /admin's "Register the Discord command". Run one of them so `/join` appears in each server.
  2. Each alliance: tap "Add LAPTracker to Discord" again to grant Manage Roles. In Discord, under Server Settings → Roles, put the LAPTracker role above the member role. Then choose the member role in Alliance settings → Discord.
  3. Update the new-alliance guide artifact with the Member role step and `/join`.
- Follow-up: count open join requests in Home's "To review".
- Follow-up: skip the daily welcome for a member already welcomed by an Approve that day.

What was missing from the task prompt? Whether `/join` should be on by default for new alliances, and whether the daily welcome should skip a member already welcomed by an Approve.

PR: (added by the orchestrator)
