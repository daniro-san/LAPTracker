# test — no data leaks or mixes between workspaces (issue 471)

No leak was found. Every surface below was attacked from a second workspace, and every attack was refused without changing the other workspace's rows. No production code changed, and no decision needs an amendment.

## Built
- Tests with two invented workspaces, `alpha` and `bravo` (union ids 900001 and 900002, two Discord servers). Each workspace has a row in every table it owns (D125's seed). Extended files keep their own fixtures (`ogs`, `nse`).
- New files:
  - `app/(private)/api/w/[slug]/cross-workspace.test-helpers.ts`: seeds both workspaces with every feature on and an officer session each. Bravo's officer then adds records through the routes under known request ids. It also has one `call()` for every route, and turns analytics on so tests can read each `ws_action`'s workspace.
  - `app/(private)/api/w/[slug]/cross-workspace.test.ts` (2 tests):
    - Alpha's officer sends 72 requests (71 writes and the member card's read) under Alpha's address that name Bravo's records. Each is refused with a 4xx at Bravo's record; the test also checks the code is not one of the early refusals (`bad_request`, `wrong_type`, `turned_off`, `signed_out`). Three picture removals on Bravo's notices answer 200 and remove nothing. Bravo's rows are identical before and after, no Discord post is made and no `ws_action` is sent.
    - Alpha's adds under Bravo's request ids (D100) make new Alpha records, Bravo's rows stay identical, and the 6 `ws_action` events all name `alpha`.
  - `app/(private)/api/w/[slug]/cross-workspace-reads.test.ts` (3 tests): the reads the pages make with an id from the address (notice, history, last post, reviews, draft, roll call, garrison plan, member card) return nothing of Bravo's. Home's activity pages carry Alpha's lines only.
  - `lib/private/discord-servers.test.ts` (3 tests):
    - A second workspace on a taken server gets `guild_taken`.
    - Each of these opens nothing: the other server's leadership role, a leadership role on the other server, and a server with no workspace.
    - The same message sent on both servers is claimed once in each workspace and matched against each alliance's own members. OGs' picture read for Bravo finds no rows and saves nothing.
  - `lib/private/discord-interaction.test-helpers.ts`: the Discord test's existing stand-ins, moved out of `discord-interaction.test.ts` so that both files can use them.
- Extended files (one test or one case each):
  - `member-session.test.ts`: on every officer route found by walking the folder (29 handlers), another workspace's officer session gets `401 signed_out`.
  - `data-export/route.test.ts`: Alpha's ZIP holds the same bytes whether or not the other workspace has its own rows in every table.
  - `workspace-purge.test.ts`: the other workspace's rows are identical after the purge, not only present.
  - `board.test.ts`: a member's board shows only its own workspace's notices, Calendar, Start here and thanks. The member's session opens neither the other board nor the other desk.
  - `member-sessions.test.ts`: one Discord account, officer in one workspace and member in the other, through the real sign-in round trip. Each session opens only its own workspace, at its own tier.
  - `workspace-keys.test.ts`: two workspaces with keys spend only their own key on their own members. A sealed key copied into the other workspace's row opens for neither, is never spent there, and is marked `reenter`.
  - `img/notice/[id]/route.test.ts`: another workspace's member gets 404 for a picture on a notice that this workspace's own board shows.
  - `share/route.test.ts`: another workspace's officer is refused by the phone's share target.
  - `roster-fields.test.ts`: no file in `app/(private)`, `lib/private` or `lib/repo` uses Next's data cache, cache tags or React's `cache`.
- `lib/workspace-data.test-helpers.ts`: `ownedRows(db, ws)`, every row a workspace owns as JSON, used for the "unchanged" checks.

### Surface inventory

| Surface | How it was attacked | Test | Result |
|---|---|---|---|
| Every officer route under `api/w/[slug]` (29 handlers) | Another workspace's officer cookie, a member cookie, no cookie | `member-session.test.ts` | 401 `signed_out` on each |
| Calendar (edit, delete, Undo) | Bravo's entry id; Bravo's trash request id (D123) | `cross-workspace.test.ts` | 404; Bravo unchanged |
| Roll call (mark, the rest, undo, team, delete, archive) | Bravo's call id, and Bravo's `{entry, week}` | `cross-workspace.test.ts` | 404; Bravo unchanged |
| Thefts (remove, Undo) | Bravo's theft ids; Bravo's trash request id | `cross-workspace.test.ts` | 404; Bravo unchanged |
| New members (delete, Undo, link, facts by `-uid`) | Bravo's pending ids | `cross-workspace.test.ts` | 404; Bravo unchanged |
| Member facts and card | Bravo's member uid 202 | `cross-workspace.test.ts`, `-reads.test.ts` | 404 `not_member`; card null |
| Follow-ups (record, Undo) | Bravo's member; Bravo's follow-up request ids as Undo target | `cross-workspace.test.ts` | 400 / 409 `not_found`; Bravo unchanged |
| Garrison (enemy, save, post) | Bravo's Undead Siege entry | `cross-workspace.test.ts`, `-reads.test.ts` | 404; view null; no Discord post |
| Notices (save, delete, restore, publish) | Bravo's notice ids, one of them in the trash | `cross-workspace.test.ts` | 404; Bravo unchanged; no Discord post |
| Notice reviews (ask, approve) | Bravo's notice and review ids; Bravo's officer as reviewer | `cross-workspace.test.ts` | 404 / 400 `reviewer` |
| Notice pictures (upload `?id=`, Keep, Remove, Use in another notice) | Bravo's notice ids; a copy in both directions | `cross-workspace.test.ts` | 404 (Remove: 200, nothing removed); Bravo unchanged |
| `/img/notice/[id]` | Another workspace's officer and member | `img/notice/[id]/route.test.ts` | 404 |
| Screenshot drafts (discard, retype; review page) | Bravo's draft id | `cross-workspace.test.ts`, `-reads.test.ts` | 404 `gone`; view null |
| Thanks (take down) | Bravo's share id | `cross-workspace.test.ts` | 404 |
| Profile "This is me" | Bravo's member | `cross-workspace.test.ts` | 400 `not_in_alliance` |
| Sheet import | A decision naming Bravo's member | `cross-workspace.test.ts` | 400 `not_member` |
| Request ids (D100) on 6 adds | Bravo's request ids replayed by Alpha | `cross-workspace.test.ts` | New Alpha records; Bravo unchanged |
| Analytics `ws_action` (issue 452) | Alpha's writes and refusals | `cross-workspace.test.ts` | 6 events, all `alpha`; none for refusals |
| Home activity feed | Alpha's pages with both workspaces seeded | `cross-workspace-reads.test.ts` | Alpha's lines only |
| Members' board | A member of one workspace | `board.test.ts` | Own workspace's content only; other doors `other_workspace` |
| One person in two workspaces | Officer in one, member in the other, one browser | `member-sessions.test.ts` | Each session opens only its own workspace at its own tier |
| Phone share target | Another workspace's officer | `share/route.test.ts` | Refused; no reading, no draft |
| "Download our data" | Alpha's ZIP with and without Bravo's rows | `data-export/route.test.ts` | Same bytes |
| "Delete this workspace" and the purge | Bravo's address typed in Alpha; purge of one workspace | `cross-workspace.test.ts`, `workspace-purge.test.ts` | 400 `address_mismatch`; the other workspace's rows identical |
| Discord "Send to LAPTracker" | Other server's role, other server, server with no workspace, same message on both | `discord-servers.test.ts` | Refused; one claim per workspace, own roster only |
| Unique Discord server (D126) | A second workspace on a taken server | `discord-servers.test.ts` (and the existing `app/api/admin/workspaces/route.test.ts`) | `guild_taken` |
| Discord Translate allowance (D126) | Two workspaces' counts | Existing `features.test.ts` | Counted apart |
| Tracker keys (D124) | Both with keys; a sealed row copied across | `workspace-keys.test.ts` (and the existing AAD test) | Own key only; copy opens for neither, `reenter` |
| Squads read | Which key reads which members | `workspace-keys.test.ts` | Each union on its own key |
| Shared caches | Static scan | `roster-fields.test.ts` | None in private code |
| Screenshots and pictures in storage | Code read | — | No Blob: pictures are rows in `notice_pictures` (covered above); screenshots are read in memory and not kept |

The suite was checked against deliberately broken code (each change reverted afterwards). Each break made a test fail:
- dropping the workspace filter in `lib/repo/trash.ts`;
- dropping it in `copyPicture`;
- dropping it in `ownedBy` (the export);
- disabling the session-bound check in `lib/private/access.ts` (29 route cases failed);
- adding a `next/cache` import to `lib/private`.

## Decisions
- A refusal must come from the other workspace's record. Each attack's answer must be a 4xx whose code is not an early refusal (`bad_request`, `wrong_type`, `turned_off`, `signed_out`). This keeps an attack from passing because its body was malformed.
- "Unchanged" means every row the other workspace owns, from D125's table list plus its `workspaces` row, compared as JSON before and after.
- The export comparison masks three things that change between two seeds even with nothing leaked: timestamps that the database's `now()` fills, the seed's random request ids, and each line's own serial id (the download's line takes the next id after the other workspace's rows). A leaked row would still add a line.
- Per the owner's 2026-11-19 comment: there is no shared-server scenario, only the refusal of a second workspace on a taken server. The person in two workspaces is an officer in one and a member in the other, on different game servers.

## Deviations
- The Discord test's stand-ins moved to `lib/private/discord-interaction.test-helpers.ts`. The two-server cases are in `discord-servers.test.ts`, because adding them to `discord-interaction.test.ts` went over the 300-line lint limit. The existing cases are unchanged.
- `member-session.test.ts` and `share/route.test.ts` make their sessions in one loop over both workspaces. Adding the second workspace the long way went over the complexity limit (12).
- The person-in-two-workspaces test is in `member-sessions.test.ts`, not `sign-in.test.ts`, which was at its line limit.
- I did not run the optional browser check. Every route, page read and door is exercised at the handler level with real cookies on PGlite. A browser would add only cookie storage, and since one browser holds one `__Host-lap_ws` cookie, switching workspaces in a browser is the sign-in round trip that `member-sessions.test.ts` already runs.

## Verified
- `pnpm check` passes: prettier, eslint, tsc, and vitest with 1229 tests passed and 4 skipped across 231 files (229 passed, 2 skipped). The schema drift check passes (no schema change, no migration), and i18n reports 17 languages up to date.
- 13 new test cases, plus another workspace's session added to the existing 29-handler route walker, and assertions added to the purge, picture and share tests.
- 5 deliberately broken builds, each caught; see the end of Built.
- An independent read-only audit of every query in `lib/repo` and `lib/private` found no query on a workspace-owned table that skips the workspace filter or a check on an id read with it. Every request-id unique index is `(workspace_id, request_id)`.
- No upstream, Discord, Groq or PostHog call: all are stubs. None of the fixture roster's names appear in the added lines.

## Open issues
- Hardening, not a leak: no composite foreign key makes a child row's `workspace_id` equal its parent's. Examples are `notice_pictures`, `notice_reviews` and `notice_publishes` against `notices`, and `calendar_occurrences` and `garrison_plans` against `calendar_entries`. The garrison upserts (`lib/repo/garrison.ts`) also conflict on `(entry_id, week)` without the workspace. Both are safe today only because the caller first checks the id with the workspace filter (`siegeOf`, `findEntry`). A composite key `(workspace_id, id)` on the parents, with the children pointing at it, would make the database refuse a mismatch. That is a migration, so I left it for a follow-up.
- `/img/notice/[id]` looks up a picture's owner across workspaces on purpose (`pictureOwner`), then requires that owner's session. Every refusal is the same 404, so nothing is learned from the id.

## Next
- Model/effort: keep.
- What the owner must do first: merge. After that, inviting the second alliance is not blocked by isolation.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A test that needs two full workspaces can use `seedTwo`, `call` and `idsOf` from `app/(private)/api/w/[slug]/cross-workspace.test-helpers.ts`, and `ownedRows` from `lib/workspace-data.test-helpers.ts`. A new write route should add its Bravo-id attack to `attacks()` in `cross-workspace.test.ts`. The route walker in `member-session.test.ts` already fails on a new route without a fixture.
- Discord tests can import the signing key, `command`, `signed`, `interactions`, `discord` and `jobDeps` from `lib/private/discord-interaction.test-helpers.ts`.
</adjustments>

PR: (added by the orchestrator)
