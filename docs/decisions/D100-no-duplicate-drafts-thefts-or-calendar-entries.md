## D100 — No duplicates from a repeat: Discord pictures claimed once, add sheets carry a request id, Send screenshots busy until the drafts exist (2026-11-17, panel batch B, ADV-7/10, ADV-12)

Amends D96 (the Discord command) and D97 (typed thefts), the calendar's add (issue 300) and the new notice (issue 304).

Why: the same input could be stored twice, each time with nothing to show it was a repeat.

- **Discord.** Running "Send to LAPTracker" twice on one message, or two officers running it at once, made two identical sets of drafts and spent the OCR twice.
- **Desk.** "Send screenshots" was enabled again while the drafts were being made.
- **Add sheets.** A theft, calendar or new-notice add retried after a lost answer was stored twice. That inflates the theft totals officers take to other alliances, against D75.

**Discord (D96 amended).**

- A new table, `discord_pictures`, keeps one row per (workspace, message id, attachment id). It stores the draft the picture went into: null while the picture is being read, or when it made no draft.
- The interaction handler claims the message's pictures with one `insert … on conflict do nothing returning` before it answers. Only the pictures this run claimed are read.
- When none is new, it answers at once, only to the sender: "These pictures were already sent to the Officers' Desk. No new draft was made." Below that is a Review link to each draft they went into. No job runs.
- After the run, each picture's draft is recorded. A picture that was not fetched or read in time is let go, so a later run tries it again. When the reading fails, every picture of the run is let go.
- A claim lasts as long as a draft (7 days). It goes with its draft when the draft is deleted, and older claims are dropped at the next claim.
- No picture, URL or file name is stored: ids only.

**Add sheets (D97, issues 300 and 304 amended).**

- The theft add sheet, the calendar add sheet and the notice editor each make one `crypto.randomUUID()` when they open, and send it as `requestId` with an add (for a notice: its first Save, which has no id). The routes require it (a UUID).
- `thefts.request_id`, `calendar_entries.request_id` and `notices.request_id` hold it, each with a unique index on (workspace, request id).
- An add whose request id is already stored answers as the first one did: `ok`, and for the calendar and the notice the first one's id. Nothing new is stored.
- An add that was refused (for example a bad time, or a theme that already exists) stored nothing, so the officer can fix the form and send again with the same id.
- The id is kept with the row rather than for "a short window", because a UUID does not repeat.

**Desk.**

- "Send screenshots" stays disabled from the first picture until the drafts exist.
- When making the drafts fails, the pages already read are kept and "Try again" sends them without reading the pictures again.
- A 401 while reading stops the reading and shows the signed-out line (D99) instead of "This picture could not be read."
