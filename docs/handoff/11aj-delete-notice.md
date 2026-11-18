# 11aj — Delete a notice (issue 411, D118)

## Built
- **Soft delete on `notices`.** Six nullable columns:
  - `deleted_at`, `deleted_by` (FK to `workspace_users`, `set null`) and `delete_request_id`;
  - `restored_at`, `restored_by` and `restore_request_id`, the last restore from the trash.
  - Migration `drizzle/0040_notice_delete.sql` came from `pnpm db:generate --name notice_delete`, regenerated in the review round to add the restore columns. The orchestrator renumbers it if #416 merges first.
- **One "live" condition** (`live` in `lib/repo/notices.ts`, `deleted_at is null`). It is on:
  - the library list and a notice's detail;
  - `noticeTitles` (the Calendar's links and review titles) and `noticeInWorkspace` (new Calendar links, review asks);
  - the save's row lock, and `newestNoticeValues` (the members' board).
  - Review requests join their notice and leave out a deleted one: Home's "To review", the tab's number and approving (`lib/repo/notice-reviews.ts`).
- **Writes** in `lib/repo/notice-deletes.ts`: `markNoticeDeleted`, `unmarkNoticeDeleted`, `restoreDeletedNotice` and `noticeIsDeleted`. `deleteNotice`, `noticeDelete` (zod) and `UNDO_MS` (60 s) are in `lib/private/notices.ts`.
- **Route** `POST /api/w/[slug]/notices/delete {id, requestId, undo? | restore?}`. It uses `requireWorkspace`, so officers only: anything else gets 401 `signed_out`.
  - Delete: a repeat of the same request id answers 200 and writes nothing, also after that delete was undone. A notice that is already deleted, of another workspace, or unknown answers 404.
  - Undo: only the officer who deleted, with the same request id, within 60 s.
  - Restore: any officer of the workspace, at any time, on a deleted notice; who, when and its request id are recorded. A repeat answers 200 and writes nothing.
  - The log carries `notices.deleted`, `notices.delete.undone` and `notices.restored`, with no fields.
  - Analytics (D115, after the rebase on #415): a 2xx is counted through `counted` as `ws_action` `notice` / `delete`, `undo` or `restore`. `restore` is new in `DESK_ACTIONS` (`lib/analytics/server.ts`). The `notice` row in `docs/analytics/tracking-plan.md` lists the three actions and the `/notices/delete` route; the plan's test checks every action against the plan.
  - The page makes its request ids with `newRequestId()` (`request-id.ts`, D115), also for the restore.
- **Save route.** A save to a deleted notice answers 410 `notice_deleted`; an unknown notice stays 404 `not_found`.
- **UI.**
  - `app/(private)/_ui/NoticeDelete.tsx`: "Delete notice" at the foot of a notice's page asks with `AskSheet`. The question shows the title, where the notice leaves, and the Discord line. "Keep it" is the main button and has the focus; "Delete" follows in seal.
  - After the delete, the library replaces the notice's history entry and shows "Notice deleted." with Undo for 10 s (`?deleted=<id>&undo=<requestId>`). Undo replaces that entry with the notice's page.
  - Editor: a save that answers `notice_deleted` shows "Could not save. Try again." with a "Restore from trash?" chip. After the restore it says "Restored. Save to keep your text." The draft stays in the editor (`useSaveNote` in `notice-editor-state.ts`; the delete route's client call is `sendDelete` in `notice-client.ts`).
  - `AskSheet` takes optional `children` (more under the question), `seal` (the destructive answer drawn in seal) and `busy`.
- **Home activity.** Two new small sources, deleted and restored (`lib/repo/desk-activity-trash.ts`). The lines read "Ana deleted the notice “…”" and "Rook restored the notice “…”" in EN, PT and FR. The feed's titles include deleted notices (`noticeTitles(…, true)`).
- Strings `notices.delete*`, `notices.deleted`, `notices.trash.*`, `activity.noticeDeleted` and `activity.noticeRestored`, in EN, PT-BR and FR.
- `D118`, a dated amendment in D108, and a README line.

## Decisions
- **A soft delete on the row, not an append-only deletion table.** The row already holds who and when. The edits hold the title, and a deleted notice cannot be edited, so that title is the title at the time of the delete. Undo clears one column. The restore keeps only the newest restore of a notice (who, when, request id): an earlier restore overwritten by a later one has no Home line.
- **Owner answers (2026-11-18):**
  - the library line stays without the title;
  - earlier feed lines about a deleted notice stay;
  - the Calendar link behaviour stays as it is;
  - a save to a deleted notice offers "Restore from trash?".
- **Undo window.** The page shows Undo for 10 s; the server accepts it for 60 s. A reload shows the line again, and the server's 60 s still decides.
- **History.**
  - The question owns one history entry, as every modal sheet does. On Delete, the question closes first, which steps back off that entry; after that `popstate`, `location.replace` loads the library in place of the notice's entry. Back then never reaches the 404.
  - Undo uses `router.replace` to the notice, so the library entry with `?deleted=…&undo=…` is gone and Back never shows the stale line. See Deviations.
- **The restore chip** sits under the save bar's error, as a `chip()`, because the save bar holds two buttons (DESIGN.md). It shows only when the save answered `notice_deleted`.
- **Quote marks.** Activity lines quote titles with “…” / « », as the existing lines do, not with the issue's 'X'.

## Deviations
- **Undo history.** The review asked to replace the library URL with the plain library before going to the notice. In Next, `router.replace` followed by `router.push` lets the push cancel the pending replace (the e2e showed the stale entry). A `history.replaceState` kept Next's cached tree with the stale line. Undo now replaces the library entry with the notice itself. Back goes to the page before the library: never the stale line, never a 404.
- **The first round's sheet** had Delete as the main button. It is now `AskSheet`, per DESIGN.md "Question", which wins over the brief's "main then Cancel".

## Verified
- After the rebase on `origin/dev` (#414, #415), `pnpm check` exits 0: prettier, eslint, tsc, vitest **195 files passed, 2 skipped; 1,034 tests passed, 4 skipped**, the drift gate and the i18n check ("17 languages up to date"). The one conflict, `notice-editor-state.ts`, kept #415's `trackAsk` and `newRequestId` beside this branch's `useSaveNote`; the shared draft-keep and leave warning are unchanged.
- **Short e2e after the rebase: 11 of 11 checks pass**, on a fresh local database with an invented 20-member roster:
  - the question names the notice and gives "Keep it" the focus;
  - after the delete, the library line and Home's delete line;
  - Undo returns to the notice and removes the line, and Back shows no stale line;
  - the restore: Wren deletes while Ana edits; Save offers "Restore from trash?"; the text stays; Save keeps it; Home reads "Ana restored the notice".
- `app/(private)/api/w/[slug]/notices/delete/route.test.ts`, 8 tests:
  - the delete hides the notice from the library, its page, the board, the Calendar title, To review and the To review tab's number. Publishing it is refused (`not_found`), and a repeat is idempotent;
  - a member session gets 401 `signed_out`;
  - another workspace gets 404 on its own slug and 401 on this workspace's slug;
  - Undo works for the deleter only, with the same request id only, and not after `UNDO_MS`;
  - the activity line appears, and is gone after Undo;
  - a replay of a delete's request after its Undo answers 200, the notice stays live, and there is no new activity line;
  - a save to a deleted notice answers 410 `notice_deleted`, and to an unknown one 404;
  - another officer restores after the Undo window: a repeat is idempotent, a restore of a live notice is 404, Home reads "Rook restored the notice “…”", and the officer's save then goes through.
- `member-session.test.ts` has a fixture for the new route.
- **Local e2e before the rebase: 51 of 51 checks pass.** Production build on :3997 (another worktree's app held :3987), own local Postgres on :55337 with 41 migrations, the DB bridge, a Discord sign-in stand-in, an invented 40-member roster. No upstream, Groq or Discord call. Checks:
  - before the delete: the board and To review show the notice;
  - the question: the button and its buttons are at least 44 px; "Keep it" has the focus; Delete follows it and is drawn in seal; Keep it keeps the notice;
  - after the delete: the library line with Undo; the notice is gone from the library, the board and To review; its page is a 404; the other officer's Home shows "Ana deleted the notice";
  - Undo: one with another request id is refused; Undo returns to the notice and removes the activity line; Back after Undo shows no stale line and no 404; Undo disappears after 10 s;
  - Back after a delete does not land on the 404;
  - restore: Ana edits while Wren deletes; Save shows "Restore from trash?"; the restore keeps her text in the editor; Save then stores it; Wren's Home reads "Ana restored the notice";
  - no session gets 401 `signed_out`;
  - no sideways scroll in any of the 8 screenshot modes.
- **Screenshots.**
  - Before the rebase: 34 shots of the page foot, the question, the library line and Home at 360 and 1280, light and dark, EN and PT, plus the editor before and after "Restore from trash?". Reviewed: the PT question wraps cleanly at 360, and Delete reads in seal in light and dark.
  - Those files were lost when the scratchpad was cleared on an Orca restart. The short e2e after the rebase made two new shots, the library line and the restored editor (360, light, EN), in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11aj-shots/` (not committed).
  - No WebKit run: Playwright WebKit is not installed here.

## Open issues
- An officer can still open the edit form of a Calendar entry linked to a deleted notice. The form keeps the old id, and saving other fields works. Re-picking a notice offers only live ones. The owner accepted this.
- The trash can only be reached from a refused save. There is no list of deleted notices.

## Next
- Model/effort: keep. One feature with a migration, a route, a question, a restore and an e2e fits one sitting with a review round.
- What the owner must do first: review and merge. The migration (renumbered by the orchestrator if needed) runs with the deploy. No setting is needed.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Every new read of notices must use `live` from `lib/repo/notices.ts`, or join `notices` on it. Only Home's activity reads deleted notices on purpose.
- A modal sheet owns one history entry. To leave the page from it, close it first and act on the next `popstate` (`NoticeDelete.tsx`, `leave`). A `router.push` or `location.replace` sent while it is open lands on or replaces the sheet's entry.
- In Next, `router.replace` followed at once by `router.push` drops the replace. Use a single `router.replace` to the destination.
- A destructive question uses `AskSheet` with `seal`; extra lines under the question go in its `children`.
- In this worktree layout, a vitest path filter with `[slug]` finds nothing. Filter by a plain fragment, for example `vitest run notices/delete`.
</adjustments>

PR: (added by the orchestrator)
