## D39 — Any public event can be renamed from /admin (2026-11-05, 08zb, issue #106)

- **Rule.** `POST /api/manual-event/rename` (PIN only, the D28 name rules) renames any event that is not a rehearsal. A scheduled (Saturday) event can be renamed whenever its row exists, from a day before its Before (the tick makes it then), before any snapshot included: naming the coming event ahead ("KvK 12-11") is the use the owner showed in the approved mock. A manual round keeps D28: only after a snapshot exists (409 `rename_before_run`). A rehearsal answers 404 `event_not_found`.
- **Where.** `/admin` "Run something now" shows the current event by name with Rename (free); before its row exists a line says when it can be renamed. A manual round is still renamed in its card's options.
- **Path kept.** The route keeps its D28 path rather than a new one; `renameManualEvent` became `renameEvent`. Discord messages already sent keep the old name.
