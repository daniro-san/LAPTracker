## D145 — Usage numbers from PostHog Endpoints: per-workspace Activity on /admin, the board's reach on Home, totals only (2026-11-21, owner, issue 484; amends D75, D77, D115, D144)

Why: the owner (issue 484, 2026-11-20) wants usage numbers inside the app from PostHog's own data instead of new tracking tables. Since issue 452 every desk and board event carries `workspace` and `alliance`, so the counts already exist.

**How the numbers are read.**

- PostHog Endpoints: saved HogQL queries in project 741657, run by name with `POST /api/projects/741657/endpoints/<name>/run?version=<n>` and `Authorization: Bearer POSTHOG_QUERY_API_KEY`. The body is `{"variables": {"workspace": "<slug>"}}`. The version is pinned in `lib/analytics/endpoints.ts` (`ENDPOINTS`), so an edit in PostHog cannot change the shape the app reads.
- The handoff `docs/handoff/feat-484-posthog-usage-numbers.md` holds the two queries, `lap_board_reach` and `lap_alliance_usage`. The member and officer `tier` is read from `persons`, not from the event's person properties: a board load's first `$pageview` is sent before `identify` (`person_profiles: "identified_only"`).
- `POSTHOG_QUERY_API_KEY` (`lib/env.ts`, optional, `phx_…`) is a personal API key with read-only query scope on that project:
  - it is server only, sent only to PostHog, and never logged;
  - it is not an argument of the cached function, so it is in no cache key;
  - it is not `POSTHOG_PERSONAL_API_KEY`, which stays for source maps (D115);
  - it is set in Production only, so a preview never reads production numbers.
- `POSTHOG_API_BASE_URL` defaults to the US app host from `lib/analytics/region.ts` (D77). It exists so the local e2e can point at a stub, like `DISCORD_API_BASE_URL`.
- Each call has a 3 s timeout. In every one of these cases the surface is not drawn, with no error and no empty frame, and the failure is never kept:
  - no key;
  - an error status (401, 403, 404, 429, 5xx);
  - a network error or a timeout;
  - an answer of another shape (zod).
- Kept in Next's data cache (`unstable_cache`) per Endpoint, version and workspace slug, with tag `posthog-endpoints`: 1 h for the desk, 15 min for /admin. During an outage an expired entry is still served while its refresh fails.
- Both surfaces are async server components inside `<Suspense fallback={null}>`, so PostHog never holds up the page. Measured with a stub that answers after 5 s: the page's heading showed after about 0.25 s, and the stream closed at the 3 s timeout with nothing drawn.

**The rules (issue 484, D75, D71, D115).**

- Totals only. The Endpoints return one row of counts and first times per workspace. No per-person row, name, Discord id or pseudonymous id reaches the app. The queries filter on the event's `workspace` property, never on a person.
- No total below 5 (`MIN_TOTAL`, `shownTotal`). On the desk such a total is not drawn. On /admin it reads "under 5".
- Every shown total is rounded down to a multiple of 5 (adversarial panel, 2026-11-21). It stays true as "at least". It also hides a change of one person between two hourly refreshes, which an officer could otherwise match to one member's visit.
- "At least" in every number's words. PostHog misses some visits: blocked scripts, a page closed before sending, and anything outside production. So a count is a lower bound. After a new `CRON_SECRET` the pseudonymous ids change (`lib/analytics/person.ts`), and for 7 days one member can be counted twice.

**/admin: "Activity"** (owner only, English only, D48). It is a section right under D144's Alliances table, with one card per workspace in the table's order: one column below 640, two from 640. The card's head is the alliance, as the same `#w-<slug>` link the table's rows use, with the slug under it. Each card shows:

- The last 7 days:
  - officers active: distinct officers with a desk event;
  - board visitors: distinct members who opened the board;
  - notices written (`notice` / `add`);
  - roll call marks (`roll_call` / `mark` and `rest`);
  - thanks shared (`thanks` / `share`);
  - screenshots read (`screenshot` / `add` and `read_text`).
- Setup, from the last 180 days: #486's setup funnel (feat-486, PR #542). Each step is the UTC date it first happened, with "· day n" after Created when that is known. A step not reached reads "not yet". The steps are all server `ws_action` events:
  1. created (`workspace` / `create`, the invite's finish);
  2. key saved (`tracker_key` / `save`);
  3. webhook set (`discord` / `save`);
  4. first roll call marked (`roll_call` / `mark`);
  5. first notice published (`notice_publish` / `publish`).

  `ws_bot_installed` is not a step: it never fires for invited alliances, because the invite's finish marks the bot seen (`lib/private/invite-steps.ts`). These are a workspace's own milestones, not counts of people, so the minimum of 5 does not apply to them.

- One Endpoint call per workspace, in parallel. A workspace PostHog did not answer for is left out; with none, there is no section.
- It does not join the Alliances table: seven more columns would not fit /admin's 960 px.

**The desk: "Board reach" on Home.** It is a margin note after "Members this week", and only while the alliance's board is on (D126). Home, not Insights: every officer lands on Home, and Insights is its own switch. The note holds:

- "At least 60 members opened the board in the last 7 days.";
- "See what members see";
- "Totals only, never who. Some visits are never counted, so the real number can be higher."

Under 5 visitors there is no note at all. EN, PT-BR and FR (`lib/private/dictionary.board.ts`).

**The issue's per-notice example is not built.** The issue's example was "The notice of Tuesday was opened by at least 48". No board event names a notice. `ws_board_section_viewed` `notices` fires as soon as the Notices heading scrolls into view, even when it says "No notices for members right now", so officers would read it as "people read my notice" (product panel, 2026-11-21: a MUST). A per-notice count needs a notice id on a board event, which is a new tracking decision.

**The members' board says so.** While `POSTHOG_QUERY_API_KEY` is set, the board ends with one line: "Your officers see totals only: how many members open this board, never who." With no key the desk shows no reach, so the line would describe nothing.

**"The last 7 days", not the calendar week.** A rolling window means the same on every day. Under the 5 rule, a calendar week would show nothing on a Monday morning.

**Not done.**

- No per-notice reach (see above).
- No new events and no new tables. Tracker calls, caps and Discord posts stay on D144's table, from our own database.
- The minimum and the rounding are applied in the app, not in the HogQL, so /admin can tell "under 5" from "PostHog did not answer".
- A slug freed by a deleted workspace and taken by a new one would show the old alliance's last 7 days, and its setup dates for 180 days. That needs the workspace's `created_at` as a second variable. It is a follow-up.
- /admin makes all its calls at once. Past about 20 workspaces, PostHog's query limit (about 240 a minute) could drop some cards in a window. A single grouped Endpoint is a follow-up.

**Tests.**

- `lib/analytics/endpoints.test.ts`:
  - the request: the URL with its pinned version, the bearer key and the workspace variable;
  - nothing on no key (and no request), on an error status, on a timeout or on another shape;
  - the 5 rule and the rounding;
  - `minIf`'s 1970 read as "never".
- `lib/private/board-reach.test.ts`: visitors from 5, rounded, and nothing under 5.
- `lib/queries/admin-activity.test.ts`:
  - one call per workspace;
  - totals rounded, and under 5 as null;
  - steps not reached as null;
  - a failed workspace left out.

**Amendment (2026-11-21, owner check in production, issue 484): /admin's setup steps come from our own tables, and its action counts are exact.**

- **Setup from our database, not PostHog.** On OGs the owner read "Created: not yet", "Key saved: not yet", "First roll call marked: not yet" and "First notice published: not yet". The `ws_action` events exist only since v5.29 (2026-11-21), and OGs was created and its key saved long before. So the event-based steps were false for every workspace older than the events. Each step is now its first time in our tables, read by D144's one `allianceUsage` statement (four more `group by` parts and one join, no new transaction):
  1. created: `workspaces.created_at`;
  2. key saved: the first `set` in `workspace_key_changes`, counted only once the workspace has a `workspace_keys` row (a key was stored at least once). A save claims its `set` row before the key's test and drops it when the key is refused, but a request that dies mid-test leaves the row (adversarial panel, 2026-11-21). "done", without a date, when a key is stored and no such row is left;
  3. webhook set: the earliest `saved_at` of the workspace's stored channels. Saving a channel again moves its time later, and Remove deletes it, so this is the date by which a webhook was set;
  4. first roll call marked: the first `roll_call_marks` write of the workspace's roll calls (deleted ones too);
  5. first notice published: the first `notice_publishes` row that went through (`posted`).

  A step with a row reads its UTC date, with "· day n" counted from Created. "done" is for a step whose table shows it done but keeps no time. "not yet" only when nothing exists. The site's fallback webhooks (`WORKSPACE_DISCORD_WEBHOOKS`) are not the workspace's own step, so they do not count. The cards are still drawn only when PostHog answered for the workspace, as before. `lap_alliance_usage` version 2 drops the five setup columns, and the code pins version 2; it reads columns by name and ignores any others.

- **Action counts are exact.** Notices written, roll call marks, thanks shared and screenshots read count actions, not people, so they show as they are, 0 to 4 included, with no rounding. "Under 5" hid whether a feature is used at all (product panel SHOULD, 2026-11-21). An action cell that is not a whole number from 0 is an answer of another shape, so that workspace's card is left out. **People counts are unchanged:** officers active and board visitors still read "under 5" below 5 and are rounded down to a multiple of 5 (D75). The desk's board reach is unchanged.
- **Tests.** `lib/queries/admin-alliances.test.ts`: a workspace created before the events shows its real dates, and a stored key with no change row reads "done". `lib/queries/admin-activity.test.ts`: action counts exact from 0, people under 5 as null and the rest rounded, and a column the app does not read is ignored.

**Amendment 2026-11-21 (perf panel; D149).** "First roll call marked" is read from each roll call's first mark through `roll_call_marks_call_written_idx`, still over deleted and archived roll calls. The dates are unchanged.

**Amendment 2026-11-22 (issue 585, F12).** Activity draws every workspace's card with its setup steps even when PostHog answers nothing (no key, down, or no workspace answered), under one line, "No totals from PostHog right now: setup steps only."; the totals show only for a workspace PostHog answered for. Two steps join the list, from our own tables in the same statement: "Member role" (done while the workspace has one; no table keeps when) after Created, and "First read" (the first read day with a roster of its alliance that did not fail, from the day before the workspace was made on) after it.
