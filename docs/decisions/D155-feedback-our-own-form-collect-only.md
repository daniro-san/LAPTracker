## D155 — Feedback: our own form on the desk and the board, collect only, kept 180 days, read on /admin/feedback (2026-11-22, owner, issue 713 part H; amends D77, D115, D125)

Why: the owner wants officers', members' and later visitors' ideas and problems in one place (#713, 2026-11-22). The spike's Part 3 compared PostHog surveys with a form of our own; the owner approved the recommendation in the chat the same day, relayed on #713: "Feedback: the desk and the board first. Public visitors come later." "Retention: feedback is kept 180 days." "Replies: collect only, with no reply to the sender. A sender sees "Received, thank you", and patch notes credit an idea without a name." Plan: `.specs/features/713-feedback/plan.md`.

**Our own form, not PostHog surveys.** PostHog's popover and widget surveys are rejected:

- they need feature flags and a new path on our `/ingest` proxy (it forwards events, replay and remote config only), and the app runs with `disable_surveys: true`;
- they show in PostHog's own UI, not the desk's design, languages and 44 px targets;
- the desk loses a survey's "seen" state on every page load, so a popover would keep coming back;
- free text in PostHog breaks the tracking plan's rule: properties are closed lists, never free text or names (D115).

A PostHog `api` survey for a 1–5 score only stays a later option (the spike's "Later").

**Where.** "Send feedback" ends every desk page in the signed-in frame and the members' board and Me (D105, D142). Public pages come later: they need 17 languages (D48). The sheet: the kind (Idea, Problem, Something good), the message (1–1,000 characters, a hint to leave out members' map positions and online times), Send. After a send: "Received, thank you." Nothing comes back to the sender: collect only.

**Route.** `POST /api/w/[slug]/feedback {area, kind, text, path, language, website}`, strict: same-origin JSON (`isSameOriginJson`), then the area's door. `desk` takes only an officer's session of this workspace (`requireWorkspace`); `board` takes the board's (`requireBoard`, officers and members) while the board is on (`403 turned_off` otherwise). A member's session with `desk`, no session, or another workspace's session is `401 signed_out`. `path` must be this workspace's page, without a query. Excluded from the officer-route walk in `member-session.test.ts` (members send from the board), with that reason; tested in its own `route.test.ts`.

**Spam and abuse.**

- `website` is a honeypot, off screen, out of the tab order and hidden from screen readers. Filled, the route answers `{ok: true}` and stores and counts nothing.
- At most 5 a day per IP hash and 20 a day per workspace, in `auth_attempts` day counters (`day:feedback:ip:<HMAC>`, `day:feedback:ws:<id>`), counted from the first send; the IP first, so one address over its limit never uses up the workspace's. The IP is never stored: its key is an HMAC-SHA-256 under `CRON_SECRET`, cut to 32 hex characters (a plain hash of an IPv4 address can be reversed by trying all of them), and day keys are pruned after a day. Past a limit: `429 too_many`, "You have sent a lot today. Try again tomorrow."

**Stored.** Table `feedback` (migration `0071_feedback`): `id`, `area` (`desk`, `board`), `kind` (`idea`, `problem`, `good`), `text`, `path`, `language` (`en`, `pt-BR`, `fr`), `workspace_id` (null only for a later public page's send), `tier` (`officer`, `member`), `created_at`, `status` (`new`, `read`, `issue`, `dropped`); an index on `created_at` for the list and the purge (D149). Never who sent it: no workspace user, uid, Discord id, name or IP. The text goes through `redactPrivate` (D115) before it is stored, so a pasted `x: 512` is kept as `x: …` and a photo URL as `…`. It never goes to a log, `run_logs`, PostHog, AI, translation or Discord.

**Kept 180 days.** The daily cleanup after the day's first read (the one that purges `app_errors` after 30 days, `lib/tick.ts`) deletes rows created more than 180 days before. A failed purge shows in /admin's "Needs you" like the others ("The 180-day feedback clean-up failed on …").

**The owner reads it** on `/admin/feedback` (PIN session, English only, D48): newest first, up to 200, filtered by kind and status (links), each with its day and time, workspace, desk or board, officer or member, language, page and text. Four buttons set the status: New, Read, Became an issue, Dropped (`POST /api/admin/feedback {id, status}`, PIN). An item becomes a GitHub issue only by hand and rewritten, because the repo is public.

**Analytics.** Only `feedback_sent {feedback_area, kind}`, from the sheet after a 200 (tracking plan, "Members' board"). The property is `feedback_area`, not `area`, which `before_send` sets on every event.

Tests: a send is stored redacted with no sender column; the honeypot stores and counts nothing; the 5th send from an IP passes and the 6th is refused, the 20th from a workspace passes and the 21st is refused; no auth_attempts key holds the IP; a cross-site request, no session, a member's session on the desk and another workspace's session store nothing; the purge deletes only rows past 180 days; /admin/feedback lists and filters; an officer's workspace session cannot set a status and the /admin pages show the PIN card without a database read; the workspace deletion removes the rows (D125's purge test).
