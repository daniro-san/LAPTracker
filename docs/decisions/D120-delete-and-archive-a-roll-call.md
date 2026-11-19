## D120 — Delete a roll call (with a short Undo) and archive one (2026-11-19, owner, 11am, issue 424; amends D103 and D108)

Why: officers made test roll calls and could not remove them (owner, 2026-11-18). The owner asked for Delete, officers only, in the notice's pattern (D118), and for Archive: finished roll calls the officers want to keep, off the active list, with an "Archived" filter and Unarchive.

**Shape: a soft delete and an archive on the roll call's row.**

- Five nullable columns on `roll_calls` (migration `roll_call_delete`): `deleted_at`, `deleted_by` (the officer, `set null` if the account goes) and `delete_request_id` (the question's request id, D100); `archived_at` and `archived_by`.
- The row, its marks and its Elixir Scramble team stay. Undo clears `deleted_at`; Unarchive clears both archive columns.
- No restore from a trash and no list of deleted roll calls (D118 has one for notices; the issue did not ask for it here).

**A deleted roll call leaves every list, count and Home (D103).** One condition (`live`, `deleted_at is null`, `lib/repo/roll-call.ts`) is on every read of `roll_calls`:

- the week's list and its counts, the Archived list, a roll call's page (a 404, like a roll call of another workspace), marking, "the rest" and its undo, and team picks (`findCall`, `findAdded`, `callsOfWeeks`, `archivedCalls`);
- the other Elixir Scramble team's members (`otherTeams`): a deleted team no longer holds anyone;
- Home's roll call lines (`marksWritten` in `lib/repo/desk-activity.ts`): a deleted roll call's marks are in no line.
- Nothing else reads `roll_calls`, `roll_call_marks` or `roll_call_team` (grep, 2026-11-19). There is no member history of roll call marks today, and no screen counts marks across roll calls (D103 "Nothing reads the marks to make a status"), so there was nothing more to filter.

**Two unique indexes now cover live rows only.**

- `roll_calls_entry_week_unique` (entry, week): after a Calendar roll call is deleted, its Calendar entry stays, and the week's occasion starts again as a new, empty roll call with its first mark. The question says so ("The Calendar entry stays, and its roll call starts again empty.").
- `roll_calls_added_unique` (workspace, kind, day, hand-added): after a test roll call is deleted, a real one can be added on the same kind and day.
- Undo is refused (404) when a new live roll call took the deleted one's place meanwhile (the same Calendar week, or the same kind and day added by hand); the list then says "Could not undo. The roll call stays deleted."

**Delete and Undo** (`POST /api/w/[slug]/roll-call`, `{action: "delete", id, requestId, undo?}`).

- Officers only through `requireWorkspace`: no session or a member's session answers 401 `signed_out` (D99, D105). Another workspace's roll call answers 404 `not_found`.
- The request id makes a repeat answer 200 and write nothing, also after that delete was undone: a late replay never deletes again. A delete of a roll call someone already deleted answers 404.
- Undo names the delete's request id. It works only for the officer who deleted, within `UNDO_MS` (60 s) of the delete. The list offers it for 10 s.

**Archive and Unarchive** (`{action: "archive", id, on}`).

- Any officer, on any saved roll call (one with a row: a Calendar occasion before its first mark or pick has nothing to archive). "Finished" is read as the officers' call, not a date rule.
- Archiving keeps the first officer's who and when; a repeat answers 200. Unarchive clears both.
- An archived roll call leaves the week's list (a Calendar one too: its occasion is not shown again as a new one). Its page still opens from the Archived list or the Calendar's "Roll call ›" link, shows "Archived" under the day, and can still be marked. Its marks still count where marks count (Home's lines).

**The pages.**

- At the foot of a roll call's page, under a rule: "Done with it? Archive takes it off the week's list and keeps it under Archived.", an "Archive" chip (or "Unarchive" when archived), and "Delete roll call", a text button in seal (44 px).
- Delete asks with `AskSheet`: "Delete this roll call?", its title and day, "It leaves the roll call list, its counts and Home. Its marks stop counting anywhere.", and for a Calendar one the line above. "Keep it" (PT "Manter", FR "Le garder") is the main button and has the focus; "Delete" follows in seal.
- After Delete, the week's list replaces the page in the history (`location.replace` after the question's own entry is stepped off, as D118), so Back does not land on a 404. The list says "Roll call deleted." with Undo; the URL carries the id and the request id. Undo replaces the list's entry with the roll call's page (`router.replace`).
- The Roll call tab has two filter links under the intro: "Active" (the week, as before) and "Archived" (`?archived=1`): every archived roll call, the newest day first, each with its counts, by its id. The week bar and "Add a roll call" are on Active only. Empty: "No archived roll calls. Archive one from its page when it is done."
- An archived Calendar roll call on the Archived list has the kind's title and its day, without the Calendar entry's title or time (one Calendar read per week would be needed); its page has both.

**Home (D108).** Two more parts of the small sources' read (`lib/repo/desk-activity-calls.ts`): "Ana deleted the roll call “KvK shield”" (PT "apagou a chamada", FR "a supprimé l’appel") and "Ana archived the roll call “…”" (PT "arquivou a chamada", FR "a archivé l’appel"). An undone delete or an unarchived roll call has no line; a deleted roll call's archive line goes with it. Both parts take the feed's page cursor (`< before`, D108 paging). A delete or an archive is never grouped into a run, and each line carries its roll call's id, so two roll calls of the same kind deleted one after the other stay two lines.

**Analytics (D115).** `ws_action` `roll_call` with `delete`, `undo_delete` (the rest's undo stays `undo`), `archive` and `unarchive`.
