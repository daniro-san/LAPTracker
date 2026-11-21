# feat — a member's own page on the members' board (issue 487, D142)

## Built

- **`/w/[slug]/board/me`**, linked from the board under its lead. The door is `requireBoard`; the page then depends on the session's "This is me" link:
  - no link: the member picks their player (D87's suggestions and search, `MeLink.tsx` over `ThisIsMe.tsx`);
  - pending: a waiting line and "Pick another player", nothing private;
  - approved by an officer: the member's own data;
  - left the alliance: a closed-page line and "This isn't me".
- **The member's data** (`lib/private/me.ts`, `me-parts.ts`, `lib/repo/me.ts`, `MeSections.tsx`):
  - might and kills over 30 days as D68 line charts, and "Back to N% of your might before KvK";
  - squads with the D136 lineup and "seen" ages;
  - where they are needed: Elixir team, caravan seat and roll-call marks. This comes first on phones, in the margin column from 1024.
- **Links** (`lib/repo/player-links.ts`, `lib/private/me-link.ts`):
  - `workspace_users.player_link` (`approved` / `pending`) and `player_linked_at`, migration `0061_member_player_links` (after #532's `0060_roster_member_uids_gin`);
  - one approved link per player (a partial unique index);
  - every member's link waits for an officer's Approve; a pending claim reserves nothing, and an approval clears the other claims of that player.
- **Routes:**
  - `POST /api/w/[slug]/me` (claim, drop), board door;
  - `POST /api/w/[slug]/member-links` (approve, unlink), naming the claim the officer saw (workspace user id and player uid); a claim that changed since answers 404 and the page reads again. Officers only, `ws_action` `member_link`.
- **Desk:**
  - Home "To review" lists pending links with the player's rank, a name hint ("Hint: the Discord name matches this game name." or "… is not this game name.") and Approve, Reject; they count in the Home tab number.
  - The member card header says "Linked to Discord: <name>" with Remove link (asks first), or Approve and Reject.
- **Officers' D87 "This is me"** now refuses a player another user holds (`409 taken`, "Already linked — ask an officer.").
- **Words** in `lib/private/dictionary.me.ts` (EN, PT-BR, FR), spread through `dictionary.board.ts`.
- **Moved:** `workspace_sessions` to `lib/schema-sessions.ts`, re-exported from `lib/schema.ts`. `lib/schema.ts` had gone over the 300-line lint limit; drizzle reports no schema change from the move.
- **Moved:** the board's account line to `BoardAccount.tsx`, shared by the board and the new page.

## Decisions

- **D142** records the link states, the door (`meAccess` gives a branded `MeAccess` only for an approved link), what is shown and never shown, the query counts and the panel. D87 and D105 have dated amendments.
- **No auto-approval** (orchestrator, 2026-11-21, on privacy grounds): every member's link waits for an officer's Approve, even when the Discord name is the game name. A member can edit their own server nickname, and the data behind the link is that player's own. The first build, and the persona panel, had an `auto` state; it is gone.
- **Matching:** the D74 matcher's one match by current game name is now only a hint on the officer's review line.
- **The door:** "Reads only through lib/private, after requireWorkspace" is read as the workspace door for members: `requireBoard` plus an approved link. A member's session never gets a `WorkspaceAccess`.
- **Recovery:** the newest read's might against the member's might at the Start read of the newest public scheduled event of the last 30 days, shown only after a read that came after the event's day.

## Deviations

- **Never shown on the board before, now on the member's own page:** caravan seats and roll-call marks (D105's list), for the member's own seat and marks only.
- **The member's own daily quests, coins and donations are not shown** (review of PR 534). CLAUDE.md's hard rule lets `daily_tech`, `daily_honor` and `active` leave the database only after `requireWorkspace`; the member's page is behind `requireBoard`. The repo read no longer touches raw_json, the "This week" card and its words are gone, and a test asserts the keys are absent from the member's read. CLAUDE.md is unchanged.
- **Rebased** onto `origin/dev` after #532 merged; the migration was regenerated with `pnpm db:generate --name member_player_links` as 0061 and its two data steps re-added to the SQL (journal and snapshot by the tool).
- **The issue's auto-accept is not built**: the orchestrator removed it (see Decisions).
- **Panel real data:**
  - The first 6 `/v1/players` attempts were refused with 403 (Python's default User-Agent) and returned no data.
  - I retried once with the app's own User-Agent (`laptracker/1.0`): 6 reads, no `fresh`, 1.1 s apart, 12 requests in all.
  - The raw answers are deleted. People are referred to by role only.

## Verified

- **`pnpm check`:** see the commit report.
- **Tests added:**
  - `app/(private)/api/w/[slug]/me/route.test.ts`, 6 cases in the issue 471 suite.
  - `lib/private/me-parts.test.ts`, 4 cases.
  - One case in `profile.test.ts`.
  - The new route's fixture in `member-session.test.ts`.
- **The suite catches a broken gate:** letting a pending link through `meAccess` fails the pending case.
- **Local production build** on Postgres 18 with all migrations and invented data (25 members, 36 days of reads with one missing, a KvK with its Start read, squads, an Elixir team, a caravan seat, Raid prep marks, five sessions):
  - 92 of 94 checks pass at 360, 640 and 1280, light and dark, EN, plus PT and FR at 360 and PT at 1280;
  - every page answers 200, with no sideways scroll and 44 px targets;
  - no blocked key and no other member's data on the member pages;
  - the two failures are Home's pre-existing hidden file input (1 px, `aria-hidden`), which is not a tap target.
- **Review fixes (PR 534)**, checked by tests: an Approve or Remove of a claim that changed since finds nothing (the test fails when the uid condition is dropped); another workspace's officer approves and removes nobody here; the member's read holds no daily key or value.
- **QA pass** (separate): pass.
  - Flows end to end, and 15 break attempts: another alliance's uid, a non-existent uid, a held player, a double claim, a member calling the officer route, another workspace's user, other slugs, no or forged origin, GET, bad bodies, and 6 races between a member's and an officer's claim of one player. All are refused as designed; each race left one link holding the player.
  - Fixed after QA: Remove of a user with no link now answers 404.
  - The QA ran on the build with auto-approval. Removing it was checked by the tests, not by a second browser run: the isolation suite now shows a name-matched claim waiting, a member unable to approve their own, and only an officer's Approve opening the page.
- **Transactions per view** (`pg_stat_database.xact_commit`, minimum of 3):

  | View | Transactions |
  |---|---|
  | Me, approved link | 20 |
  | Me, pending, picker or left | 13 |
  | Board | 19 |
  | Home | 62 |
  | Member card | 32 |

- **The migration's data steps** (then numbered 0060) on a scratch database, with two users holding one player: the lower id keeps it and the other is cleared; the other workspace's link is unaffected; the kept links become `approved`.

## Open issues

- **The member's own daily stats wait for the owner.** Showing their daily quest points, coins and donations against their own last week (the issue's item 2) needs the owner to change CLAUDE.md's hard rule and D71 for this page. The first build's card (`weekCard` and the "This week" words) is in commit `c885b7d7` for when that happens.
- **Connections per render:** the per-request Pool opens several connections for parallel reads, measured 5–6 on the board and the Me page. That is the perf spec's Batch 3.
- **Repeated claims:** a member can claim again right after a Reject; nothing limits it.
- **The picker carries the newest roster** (name, rank, might) to a member without an approved link, as D87 does for officers. These are public fields.
- **"Where you're needed" shows the whole week**, so a caravan seat earlier in the week still shows after its day.
- **The board link says "Your own page"**, not the member's name. Naming them would need a read on the board.
- **Left from the review of PR 534 (nice-to-haves, not done):** a limit on claims right after a Reject; hiding a caravan seat once its day has passed; naming the member on the board link; folding the parallel reads into one connection (Batch 3).

## Next

- Model/effort: keep.
- **Owner first**:
  - decide whether a member may see their own `daily_tech`, `daily_honor` and `active` on their page (a change to CLAUDE.md's hard rule and D71); until then the page leaves them out.
- Plan change: none.

<adjustments>
- If the owner allows the member's own daily fields: restore the "This week" card from `c885b7d7`, and copy `active`, `daily_honor` and `daily_tech` into arrays at write time rather than reading raw_json per view.
- `meAccess(board)` is the only way to a member's own data; any new member-facing read should take `MeAccess`.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/534
