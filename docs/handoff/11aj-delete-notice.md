# 11aj — Delete a notice (issue 411, D118)

## Built
- **Soft delete on `notices`.** Three nullable columns: `deleted_at`, `deleted_by` (FK to `workspace_users`, `set null`) and `delete_request_id`. Migration `drizzle/0040_notice_delete.sql` came from `pnpm db:generate --name notice_delete`; the orchestrator renumbers it if an open PR takes 0040.
- **One "live" condition** (`live` in `lib/repo/notices.ts`, `deleted_at is null`). It is on the library list, a notice's detail, `noticeTitles` (the Calendar's links and review titles), `noticeInWorkspace` (new Calendar links, review asks), the save's row lock (a save answers 404) and `newestNoticeValues` (the members' board). Review requests join their notice and leave out a deleted one: Home's "To review", the tab's number and approving (`lib/repo/notice-reviews.ts`).
- **Delete and Undo writes**, in `lib/repo/notice-deletes.ts` (`markNoticeDeleted`, `unmarkNoticeDeleted`), with `deleteNotice`, `noticeDelete` (zod) and `UNDO_MS` (60 s) in `lib/private/notices.ts`.
- **Route** `POST /api/w/[slug]/notices/delete {id, requestId, undo?}`. It uses `requireWorkspace`, so officers only: anything else gets 401 `signed_out`. A repeat of the same request id answers 200. A notice that is already deleted, of another workspace, or unknown answers 404. Undo only works for the officer who deleted, with the same request id, within 60 s. The log carries the codes `notices.deleted` and `notices.delete.undone` with no fields.
- **UI** (`app/(private)/_ui/NoticeDelete.tsx`):
  - "Delete notice" at the foot of a notice's page. It opens a Sheet with the title, where the notice leaves, and the Discord line, then Delete and Cancel.
  - After the delete, the library shows "Notice deleted." with Undo for 10 s (`?deleted=<id>&undo=<requestId>`). Undo opens the notice's page.
- **Home activity.** New small source "noticeDeleted" (`lib/repo/desk-activity.ts`). The line reads "Ana deleted the notice “…”" in EN, PT and FR. The feed's titles include deleted notices (`noticeTitles(…, true)`).
- Strings `notices.delete*`, `notices.deleted` and `activity.noticeDeleted` in EN, PT-BR and FR.
- `D118`, a dated amendment in D108, and a README line.

## Decisions
- **A soft delete on the row, not an append-only deletion table.** The row already holds who and when. The edits hold the title, and a deleted notice cannot be edited, so that title is the title at the time of the delete. Undo is a single column cleared. D118 records why this differs from D108's suggestion.
- **Earlier feed lines about a deleted notice stay** (saved, posted, review requests), with its title. They are history of officers' work, and none links to the notice. What "leaves every list" covers: the library, the page, the board, Calendar links, review requests, saves and publishing.
- **Undo window.** The page shows Undo for 10 s; the server accepts it for 60 s. A reload shows the line again, and the server's 60 s still decides.
- **Leaving the sheet.** The sheet leaves with `window.location.assign`, as `AddRollCall` and `PasteUpdates` do. The e2e found that `router.push` from an open Sheet is undone when the sheet's own history entry closes.
- **Quote marks.** Activity lines quote titles with “…” / « », as the existing lines do, not with the issue's 'X'.

## Deviations
- None from the brief. The library line says "Notice deleted." without the title: the title would have had to travel in the URL or be read from a deleted row, and the sheet just showed it.

## Verified
- `pnpm check` exits 0: prettier, eslint, tsc, vitest **189 files passed, 2 skipped; 1,009 tests passed, 4 skipped**, the drift gate and the i18n check ("17 languages up to date").
- New `app/(private)/api/w/[slug]/notices/delete/route.test.ts`, 5 tests:
  - the delete hides the notice from the library, its page, the board, the Calendar title and To review; a repeat is idempotent; a save is refused;
  - a member session gets 401 `signed_out`;
  - another workspace gets 404 on its own slug and 401 on this workspace's slug;
  - Undo works for the deleter only, with the same request id only, and not after `UNDO_MS`;
  - the activity line appears, and is gone after Undo.
- `member-session.test.ts` has a fixture for the new route.
- **Local e2e: 43 of 43 checks pass.** Production build on :3987, own local Postgres on :55337 with 41 migrations, the DB bridge, a Discord sign-in stand-in, an invented 40-member roster. No upstream, Groq or Discord call. Checks:
  - before the delete: the board and To review show the notice;
  - the button and the sheet's buttons are at least 44 px; Cancel keeps the notice;
  - after the delete: the library line with Undo; the notice is gone from the library, the board and To review; its page is a 404; the other officer's Home shows "Ana deleted the notice";
  - an Undo with another request id is refused; Undo returns to the notice and removes the activity line; Undo disappears after 10 s;
  - no session gets 401 `signed_out`;
  - no sideways scroll in any of the 8 screenshot modes.
- **Screenshots.** 32 shots: the page foot, the sheet, the library line and Home, at 360 and 1280, light and dark, EN and PT. They are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11aj-shots/` (not committed). Reviewed: the PT sheet wraps cleanly at 360, and the dark foot button reads in the seal colour. No WebKit run: Playwright WebKit is not installed here.

## Open issues
- An officer can still open the edit form of a Calendar entry linked to a deleted notice. The form keeps the old id, and saving other fields works. Re-picking a notice offers only live ones. Nothing breaks, but the stored id points at a deleted notice until someone relinks it.
- A delete of a notice another officer has open in the editor: their next save answers 404 ("not_found"), and the editor shows its generic refusal, not a "someone deleted this notice" line. This is a possible follow-up.

## Next
- Model/effort: keep. One feature with a migration, a route, a sheet and an e2e fits one sitting.
- What the owner must do first: review and merge. The migration (renumbered by the orchestrator if needed) runs with the deploy. No setting is needed.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Every new read of notices must use `live` from `lib/repo/notices.ts`, or join `notices` on it. Only Home's activity reads deleted notices on purpose.
- A sheet that leaves the page must use `window.location.assign`, not `router.push`. The open sheet's history entry undoes a client-side push.
- In this worktree layout, vitest's `exclude` of `.claude/worktrees/**` does not stop runs, but a path filter with `[slug]` finds nothing. Filter by a plain fragment, for example `vitest run notices/delete`.
</adjustments>

PR: (added by the orchestrator)
