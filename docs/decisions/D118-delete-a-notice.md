## D118 — Delete a notice: a soft delete with who, when and the title kept, a short Undo, and a line on Home (2026-11-18, owner, 11aj, issue 411; amends D108)

Why: officers wrote test notices and had no way to remove them. The owner asked for Delete, officers only, with a confirmation that names the notice and says that a notice already posted to Discord stays in Discord.

**Shape: a soft delete on the notice's row.**

- Three nullable columns on `notices` (migration `notice_delete`): `deleted_at`, `deleted_by` (the officer, `set null` if the account goes) and `delete_request_id` (the delete sheet's request id, D100).
- The row and its `notice_edits` stay, so the title at the time of the delete is kept: a deleted notice cannot be edited, so its last title is the title it had when it was deleted.
- D108 suggested "a small append-only row (who, when, the title at the time)". A separate table is not needed: the row already holds who and when, and the edits already hold the title. Undo then needs only one column cleared, not a second record that cancels the first.

**A deleted notice leaves every list and read.** One condition (`live`, `deleted_at is null`, `lib/repo/notices.ts`) is on:

- the library and a notice's page (a deleted notice's page is a 404, like a notice of another workspace);
- a save (404 `not_found`), so nothing writes to it, and a Publish to Discord (its read finds nothing);
- the members' board (D105), which reads notices through `newestNoticeValues`;
- the Calendar's titles of linked notices (D102). An entry linked to a deleted notice shows no link; the entry keeps the id, and Undo brings the link back. A new link to a deleted notice is refused as for an unknown notice;
- review requests (D113): Home's "To review", the tab's number, and approving one. They join the notice and leave out a deleted one.

**Home's activity (D108).**

- A new part of the small sources' read: `notices` with `deleted_at` in the 14-day window and a known `deleted_by`. The line reads "Ana deleted the notice “Test notice”" (PT "Ana apagou o aviso “…”", FR "Ana a supprimé l’annonce « … »"), with the notice's last title.
- The feed's title lookup includes deleted notices, so the earlier lines about the notice (saved, posted, review requests) keep their title. They are history of work done, not a list of notices, and none of them links to the notice.
- An undone delete has no line: `deleted_at` is null again.

**Delete and Undo.**

- `POST /api/w/[slug]/notices/delete {id, requestId, undo?}`. Officers only through `requireWorkspace`: no session or a member's session answers 401 `signed_out` (D99, D105). The request id (D100) makes a repeat of the same delete answer 200 and change nothing; a delete of a notice someone already deleted answers 404 `not_found`.
- Undo names the delete's request id. It works only for the officer who deleted, within `UNDO_MS` (60 s) of the delete. It is not a restore from history: after that, the notice stays deleted.
- The page: "Delete notice" (a text button in the seal colour, 44 px) at the foot of a notice's page, under Calendar. It opens a sheet: "Delete this notice?", the title, where it leaves ("the notices list, the Members' board, the Calendar and review requests") and "If it was published to Discord, it stays in Discord. Delete it there yourself if you need to." Delete, then Cancel.
- After Delete the library opens with "Notice deleted." and Undo for 10 s (the URL carries the id and the request id). Undo opens the notice's page again. A reload shows the line again, and the server still decides by its 60 s.
- The sheet leaves with a full page load, as the other sheets that leave the page do: a client-side push is undone when the open sheet's own history entry closes.

**Not done.** No list of deleted notices, no restore after the Undo window, nothing removed from Discord.
