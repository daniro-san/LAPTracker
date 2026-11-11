## D40 — /admin "Run something now": one row of seals, a manual round options form (2026-11-05, 08k) (numbered D30 by mistake until 2026-11-05)

Why: the owner found the run area cluttered, the visibility dropdown hard to read and the bare "run or cancel" confirmation before a round was created unhelpful.

- **Layout.** Before, After and Rehearse are three columns on one row (360 px included), each with a one-line help and its cost. "Manual round" is its own row below.
- **One options form, two places.** `RoundOptions` (name, visibility as three radio options with one line each, Discord post as a checkbox) is used by "Start a manual round" (opens inline under the button; "Create round" is the confirmation, so no separate confirm sheet) and by the round's card ("Change options", "Save changes"). Seals still ask for a confirmation that names the cost. Save sends only what changed: a rename (only after the Before ran, D28), then the settings, as two calls.
- **API change (minimal).** `POST /api/manual-event` accepts an optional JSON body `{name?, visibility?, post_public?}` (same name rules as rename, same `admin_cannot_post` 409). With no body it behaves as before. Needed because the name and options are set before the round exists and a rename is refused until a snapshot exists.
- **Round summary.** The card shows name, Before and After state, visibility, Discord and the API calls the round has used (sum of its snapshots' `calls_used`, read in `latestManualEvent`).
- **Not built:** a modal for the form (inline keeps the round's options next to the button), deleting a round (D28).
