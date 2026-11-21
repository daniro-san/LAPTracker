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
- Setup, from the last 180 days. Each step is the UTC date it first happened, with "· day n" after the invite made the workspace (`workspace` / `create`, feat-486) when that is known. A step not reached reads "not yet". The steps are:
  1. key saved (`tracker_key` / `save`);
  2. bot installed (`ws_bot_installed`, or the invite's finish, which marks the bot seen, so an invited alliance reads "day 0");
  3. first roll call (`roll_call` / `mark`);
  4. first notice (`notice` / `add`).

  These are a workspace's own milestones, not counts of people, so the minimum of 5 does not apply to them.

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
