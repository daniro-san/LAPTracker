## D118 — Delete a notice: a soft delete with who, when and the title kept, a short Undo, a restore from the trash, and lines on Home (2026-11-18, owner, 11aj, issue 411; amends D108)

Why: officers wrote test notices and had no way to remove them. The owner asked for Delete, officers only, with a confirmation that names the notice and says that a notice already posted to Discord stays in Discord. Review round (owner, 2026-11-18): an officer whose save finds the notice deleted can restore it.

**Shape: a soft delete on the notice's row.**

- Six nullable columns on `notices` (migration `notice_delete`):
  - `deleted_at`, `deleted_by` (the officer, `set null` if the account goes) and `delete_request_id` (the question's request id, D100);
  - `restored_at`, `restored_by` and `restore_request_id`: the last restore from the trash.
- The row and its `notice_edits` stay, so the title at the time of the delete is kept: a deleted notice cannot be edited, so its last title is the title it had when it was deleted.
- D108 suggested "a small append-only row (who, when, the title at the time)". A separate table is not needed: the row already holds who and when, and the edits already hold the title. Undo then needs only one column cleared, not a second record that cancels the first.

**A deleted notice leaves every list and read.** One condition (`live`, `deleted_at is null`, `lib/repo/notices.ts`) is on:

- the library and a notice's page (a deleted notice's page is a 404, like a notice of another workspace);
- a save, which answers 410 `notice_deleted` (an unknown notice stays 404 `not_found`), and a Publish to Discord (its read finds nothing, 404);
- the members' board (D105), which reads notices through `newestNoticeValues`;
- the Calendar's titles of linked notices (D102). An entry linked to a deleted notice shows no link; the entry keeps the id, and Undo or a restore brings the link back (owner: fine as it is). A new link to a deleted notice is refused as for an unknown notice;
- review requests (D113): Home's "To review", the tab's number, and approving one. They join the notice and leave out a deleted one.

**Home's activity (D108).**

- Two new parts of the small sources' read (`lib/repo/desk-activity-trash.ts`): notices with `deleted_at`, and notices with `restored_at`, in the 14-day window with a known officer.
- "Ana deleted the notice “Test notice”" (PT "Ana apagou o aviso “…”", FR "Ana a supprimé l’annonce « … »") and "Rook restored the notice “…”" (PT "restaurou o aviso", FR "a restauré l’annonce"), with the notice's last title.
- The feed's title lookup includes deleted notices, so the earlier lines about the notice (saved, posted, review requests) keep their title (owner: they stay). They are history of work done, and none of them links to the notice.
- An undone delete has no line: `deleted_at` is null again. Only the newest restore of a notice is kept, so an earlier restore overwritten by a later one has no line.

**Delete, Undo and Restore.**

- `POST /api/w/[slug]/notices/delete {id, requestId, undo? | restore?}`. Officers only through `requireWorkspace`: no session or a member's session answers 401 `signed_out` (D99, D105).
- Delete: the request id (D100) makes a repeat answer 200 and write nothing, also after that delete was undone (a late replay never deletes again). A delete of a notice someone already deleted answers 404 `not_found`.
- Undo names the delete's request id. It works only for the officer who deleted, within `UNDO_MS` (60 s) of the delete.
- Restore: any officer of the workspace, at any time, on a deleted notice. It clears `deleted_at` and records who, when and its own request id; a repeat of the same restore answers 200 and writes nothing. A restore of a live notice answers 404.

**The page.**

- "Delete notice" (a text button in the seal colour, 44 px) at the foot of a notice's page, under Calendar.
- It asks first with `AskSheet` (DESIGN.md "Question", an alertdialog): "Delete this notice?", the title, where it leaves ("the notices list, the Members' board, the Calendar and review requests") and "If it was published to Discord, it stays in Discord. Delete it there yourself if you need to."
  - "Keep it" (PT "Manter", FR "La garder") is the main button and has the focus. "Delete" follows as a secondary button drawn in seal.
  - Review, 2026-11-18: the first build had Delete as the main button, against the Question rule.
- After Delete, the library replaces the notice's page in the history (`location.replace`), so Back does not land on its 404. The library says "Notice deleted." with Undo for 10 s; the URL carries the id and the request id. A reload shows the line again, and the server still decides by its 60 s.
- The question owns one history entry, as every modal sheet does. Delete closes it first, which steps back off that entry, and on that `popstate` loads the library with `location.replace`. A client-side push, or a replace sent while the question is open, would land on or replace the question's entry.
- Undo replaces the library's entry (with `?deleted=…&undo=…`) with the notice's page (`router.replace`). Back from the notice goes to the page before, never to a stale "Notice deleted." line. A replace to the plain library followed by a push does not work: in Next the push cancels the pending replace.
- In the editor, a save that answers `notice_deleted` shows "Could not save. Try again." with a "Restore from trash?" chip (PT "Restaurar da lixeira?", FR "Restaurer depuis la corbeille ?"). The chip restores the notice and says "Restored. Save to keep your text." The draft never leaves the editor (and the device keeps it, D102), so the next Save keeps the officer's text.

**Not done.** No list of deleted notices, no way into the trash other than a refused save, nothing removed from Discord.

**Amendment 2026-11-19 (D123, issue 427).** The delete, Undo and restore now run on the shared soft delete (`lib/repo/trash.ts`), and the page on the shared `DeleteButton` and `UndoLine` (`app/(private)/_ui/DeleteRecord.tsx`). `lib/repo/notice-deletes.ts` is gone. Nothing changes for officers: the same words, request ids, URLs, 60 s and 10 s.
