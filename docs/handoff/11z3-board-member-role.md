# 11z3 — The members' board needs a member role (D105 amended)

## Built
- `workspaces.member_role_ids` (`text[]`, default empty), migration `drizzle/0034_workspace_member_roles.sql`.
- `/admin`, workspace card and form: "Member role ids" field under "Leadership role ids", same input (commas or spaces). The card lists "Member role ids: …", or "Members' board is off until you set a member role." when none is set.
- `POST /api/admin/workspaces` takes `member_role_ids` (required, may be empty): snowflakes, at most 20, duplicates dropped, strict zod, PIN. `saveWorkspace` writes it; when a caller leaves it out it writes an empty list.
- Sign-in (`lib/private/sign-in.ts`):
  - officer: leadership role or allowlist, unchanged;
  - member: in the server and holding a member role;
  - anyone else in the server: refused with `no_role`;
  - no member role set: refused with the new reason `board_closed`.
- `/w/[slug]/no-access` explains `no_role` with new words and `board_closed` with a new line, in EN, PT and FR.
- Re-check (`lib/private/access.ts`, `requireBoard`): a member session is served for 24 hours after its role check (`CHECK_MS`). After that the board page sends the browser through the silent Discord trip (`prompt=none`) that officers already use. That trip renews the same session in place, or deletes it and shows no-access. While the workspace has no member role, a member session is never served and takes the same trip, which ends it with `board_closed`.
- Docs: D105 and D73 amendments (2026-11-17), and the glossary entry for "members' board".

## Decisions
- Re-check approach: member sessions keep no Discord token, so they have no refresh path. I kept the 30-day cap and cookie and added a 24-hour role check with the silent re-auth, the same as officers (D99). Recorded in D105.
- I reused `no_role` for "in the server without a member role" and added `board_closed` for "no member role set". With no member role set, the requested copy ("Once an officer gives it to you…") would be wrong, because no role exists to give.
- A demoted officer or an expired allowlist entry now gets a member session only when that person holds a member role.

## Deviations
- The task asked for 360 screenshots of the `/admin` card in EN and PT. `/admin` is English only (D48), so only EN shots exist for it. The no-access pages have both EN and PT.
- I changed one existing test in `sign-in.test.ts` ("does not let an account in through another workspace's allowlist"). Its `nse` workspace has no member role, so the expected result is now `board_closed` instead of the board.

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc, vitest **171 files passed, 2 skipped; 910 tests passed, 4 skipped**, drift gate, i18n "17 languages up to date".
- Tests added or changed:
  - `lib/private/member-sessions.test.ts`, 3 new tests:
    - a guest in the server with no member role gets `no_role`, and no row is stored;
    - with no member role set, a member gets `board_closed`, an open member session is not served, and an officer still gets in;
    - a member who lost the role at the 24-hour re-check gets `no_role`, and the session is deleted.
  - `lib/private/sign-in.test.ts`: the member test now checks the role re-check (refused on day 29 until a renewal, renewed in place, ended on day 30).
  - `app/api/admin/workspaces/route.test.ts`, new, 2 tests:
    - wrong PIN gives 401; a missing field, a non-snowflake id or an unknown key gives 400; nothing is written;
    - duplicates are saved once, and an empty list turns the board off.
  - `app/(private)/api/w/[slug]/member-session.test.ts` still passes. No route was added.
- Local e2e: **32 of 32 checks pass**.
  - Setup: `next build` + `next start` on :3969, local Postgres with 35 migrations, the bridge, and a Discord stand-in with five role sets: Rook (R4), Rio (member role), Guest (in the server, no role), Ash (not in the server), and Rio after the role was removed.
  - No member role set: Rio gets `board_closed` in EN and PT, no session is stored, and Rook gets the desk.
  - The `/admin` write without the PIN answers 401.
  - The owner sets the member role on `/admin` at 360. The card changes from "off" to "Member role ids: …". The field is 16 px and 44 px high, with no sideways scroll.
  - Guest gets `no_role` with the new copy in EN and PT, and is not stored. Ash gets `not_member`. Rook stays an officer.
  - Rio lands on the board. With the check set 25 h back, a board load goes through the stand-in and returns to the board on the same session hash, with `checked_at` renewed.
  - With the check 25 h back again and the role removed, a board load ends on `no-access?why=no_role` and Rio's sessions are 0.
  - Clearing the member role on `/admin` closes the board: Rio's open session ends on the next board load with `board_closed`, and 0 member sessions are left.
- Privacy grep: 4,288 added lines checked against the 101 names of the OGs fixture roster: 0 found.
- Screenshots (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11z3-shots/`:
  - `no-access-no-role-360-{en,pt-BR}` (light and dark);
  - `no-access-board-closed-360-{en,pt-BR}`;
  - `admin-card-set-{before,after}-360-en` and `admin-card-clear-after-360-en`;
  - `admin-form-set-360-en`.

  Designer check: the copy fits at 360 in PT, and the card's "off" line is bold so it stands out. No fix was needed.

## Review round (PR 390, security review)
- **Old member sessions.** Migration 0034 also deletes every member-tier session (`DELETE FROM "workspace_sessions" WHERE "tier" = 'member';`, after a drizzle statement breakpoint). A session made under the old rule ("anyone in the server") would otherwise have been served for up to 24 hours after the owner set the role. Recorded in D105.
  - Test: `lib/private/member-roles-migration.test.ts` migrates a database to 0033, makes a member session and an officer session, applies 0034 and sets the role. The member's session is refused (`signed_out`); the officer's is still served. With the DELETE removed, the test fails.
- **The `/admin` form pre-fills** (`app/_ui/admin/WorkspaceForm.tsx`, moved out of `WorkspacesCard.tsx`).
  - Picking a workspace ("Workspace to edit") or the alliance it belongs to loads its current address, server id, leadership role ids and member role ids. Editing one field keeps the others.
  - The heading reads "Editing /w/<slug>", or "New workspace". "New workspace" is the last option of the picker and starts with empty fields.
  - A save that would empty the member roles of a workspace that has some asks first in a sheet: "This closes the members' board. Save anyway?", with "Save anyway" and Cancel.
  - Recorded in D105 and D73.
- **Two sign-in tests** (`member-sessions.test.ts`): a blocked account that holds the member role gets `blocked`; an account whose allowlist entry expired but that holds the member role gets the board.
- `pnpm check` exits 0: **172 files passed, 2 skipped; 913 tests passed, 4 skipped**.
- Form e2e, **14 of 14 checks pass** (production build on :3969, local database, two workspaces), all at 360:
  - the form opens on the first workspace, and picking `/w/ogs` loads its four fields and its alliance;
  - a save that changes only the member roles keeps the server id and both leadership role ids in the database;
  - picking nse's alliance loads `/w/nse`, and "New workspace" empties the fields;
  - emptying the member roles opens the sheet. Cancel writes nothing. "Save anyway" empties only the member roles, and the card then says the board is off;
  - saving a workspace whose member roles were already empty does not ask;
  - no target is under 44 px, and nothing scrolls sideways.
- Screenshots: `r2-form-prefilled-ogs-360-en`, `r2-form-prefilled-360-en-{light,dark}` (with the heading), `r2-form-new-360-en`, `r2-close-board-sheet-360-en`, in the same folder.

## Open issues
- Members whose phone browser is not signed in to discord.com now see Discord's sign-in page about once a day. D105 first avoided that cost, and the owner chose privacy over it. If members complain, the option is D99's "encrypted Discord refresh token", which is not built.
- Changing the member role ids (without clearing them) does not end open member sessions right away. They end at their next 24-hour check. "Sign out users → Members only" ends them right away.

## Next
- Model/effort: keep. The change was small and fit one sitting with the e2e.
- What the owner must do first: merge, release, then on `/admin` pick `/w/ogs` in the workspace form (its current settings load), type the OGs member role id (the role sorted members get) and save. Until then the members' board is closed for everyone; officers are not affected. The release signs every member out once (migration 0034).
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- `NoAccess` has a fifth reason, `board_closed`. A new caller of the sign-in should handle it like `no_role`.
- `requireBoard` now checks a member's role every 24 hours. A future member-facing API route must use `CHECK_MS` for member sessions too, not an unlimited window.
</adjustments>

PR: (added by the orchestrator)
