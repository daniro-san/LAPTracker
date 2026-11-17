# 11z2 — /admin "Sign out users"

## Built
- Each workspace card on `/admin` now has one button, "Sign out users", in place of "Sign out members only (officers stay signed in)" and "Sign out everyone, including me" (owner, 2026-11-17).
- The button opens a sheet (`app/_ui/admin/SignOutUsersSheet.tsx`, on `lib/brand/components/Sheet` with `RadioField`). It offers "Everyone (n)", "Officers only (n)", "Members only (n)" and "One person". An option with nobody in it is off. "One person" lists every person with an open session in that workspace: the name in `<bdi>`, officer or member, and "last seen …". The list gets a search field when it has more than 8 people. "Next" stays off until a choice is made.
- The confirm step in the same sheet states what will happen, with the count: "Sign out 8 members of /w/ogs?", "Sign out 1 officer of /w/ogs?", "Sign out all 12 people in /w/ogs?", "Sign out Kestrel (member)?". Every scope adds "This ends their sessions only. Nobody is blocked: whoever still belongs signs in with Discord again." Everyone and Officers only add that the `/admin` PIN is not a workspace session and stays unlocked, and that the owner's own Discord session in that workspace, if there is one, ends too. When the step changes, the question takes the focus, so a second tap on "Next" does not land on "Sign out".
- One route: `POST /api/admin/workspaces/sign-out {workspace_id, scope: "all"|"officers"|"members"|"user", user_id?}`. It uses a strict zod discriminated union: `user_id` is required with `"user"` and refused with any other scope. It is PIN-only, with the PIN's rate limits, through `authorize`. `POST /api/admin/workspaces/sign-out-members` is deleted. "One person" ends every session of that `workspace_users` row, only inside that workspace. A user with no session there (another workspace's user, or someone already signed out) gets `404 no_session` and nothing ends.
- `signOutWorkspace(db, workspaceId, who = {scope: "all"})` in `lib/repo/workspaces.ts` replaces `signOutMembers`. Existing callers that pass no scope behave as before.
- `listWorkspaces` (`lib/queries/workspaces.ts`) returns `signedIn` per workspace: user id, name (chosen name, else Discord display name), tier, and last seen. It no longer returns `memberSessions`.
- The success line reads "Sessions ended: {n}."
- Docs: dated amendments (2026-11-17, 11z2) in D105, D73 and D99.

## Decisions
- The counts in the sheet are people, not sessions, because the owner's example counts people ("Sign out 3 members"). The success line counts sessions, so one person on two phones shows 2.
- A person is shown as an officer when any of their open sessions is an officer's.
- "Last seen" is the latest `checked_at` of the person's open sessions, which is set at sign-in and at each Discord renewal (D99). No last-activity column exists. For an active officer it is within about an hour of their last use. For a member it is their sign-in time, because member sessions are not checked for 30 days.
- /admin copy is English only (D48), so the button has no PT or FR text.
- The search field appears above 8 people.

## Deviations
- The sheet is a two-step `Sheet` (pick, then confirm) instead of `ConfirmSheet`, which is still used elsewhere on /admin.
- `member-session.test.ts` is unchanged, because no officer route was touched.

## Verified
- `pnpm check` exits 0: 167 test files passed, 2 skipped; 886 tests passed, 4 skipped; drift gate fine; i18n "17 languages up to date".
- Route tests in `app/api/admin/workspaces/sign-out/route.test.ts` (6): a wrong PIN and bodies outside the schema are refused; everyone; officers only; members only; one person on two phones (both sessions end, nobody is blocked); one person from another workspace is refused with `404 no_session` and nothing ends. The old sign-out-members test was folded into these.
- Local e2e, 48 of 48 checks pass. Setup: `next build` + `next start` on :3968, local Postgres (32 migrations), the bridge, invented sessions (12 people in `/w/ogs`, one officer on two phones; 1 in `/w/nse`). It ran at 360 and 1280, light and dark. It checked:
  - one button per card;
  - the counts 12/4/8;
  - "Next" is off until a choice is made;
  - the search field shows and its text is 16 px;
  - each row shows the tier and last seen;
  - no target is under 44 px;
  - the one-person and everyone confirm texts;
  - no sideways scroll.
- Each scope was run through the PIN against the database:
  - members: 8 sessions ended, officers' sessions and `/w/nse` kept;
  - officers: 5 ended;
  - everyone: 13 ended, `/w/nse` kept;
  - Rook: 2 ended.
- Screenshots (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/admin-signout-shots/`: `card-`, `sheet-pick-`, `sheet-one-`, `sheet-search-`, `sheet-confirm-one-`, `sheet-confirm-all-` × `{360,1280}-{light,dark}`. In the designer pass at 360, the list, help lines and bar fit without overflow, and the danger is stated in the confirm step. No fix was needed.
- Names are not logged. The route logs nothing beyond `withContext`'s route name.

## Open issues
- The card's "{n} signed in" line counts sessions (13), while the sheet counts people (12). This is pre-existing and left as is. It could count people instead.
- `.env.local` from earlier handoffs lacks `SNAPSHOT_WINDOW_MIN` and `QUOTA_CHECK_AT`, which `lib/env.ts` now requires. I added them locally for the e2e.

## Next
- Model/effort: keep. The change was small and fit one sitting with the e2e.
- What the owner must do first: review and merge. No env or migration change.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- `/api/admin/workspaces/sign-out-members` no longer exists. Use `/api/admin/workspaces/sign-out` with `scope`.
- `signOutWorkspace(db, id, who)` takes a scope. Use it for any new "end sessions" need instead of adding another delete.
</adjustments>

PR: (added by the orchestrator)
