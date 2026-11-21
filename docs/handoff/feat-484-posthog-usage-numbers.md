# feat-484 — usage numbers from PostHog Endpoints

## Built

- `lib/analytics/endpoints.ts` runs a PostHog Endpoint by name and pinned version for one workspace:
  - `POST {POSTHOG_API_BASE_URL}/api/projects/741657/endpoints/<name>/run?version=1` with `Authorization: Bearer POSTHOG_QUERY_API_KEY` and `{"variables": {"workspace": "<slug>"}}`;
  - a 3 s timeout, and zod checks the answer's shape;
  - kept in Next's data cache per Endpoint, version and slug (tag `posthog-endpoints`);
  - anything but a good answer is null and is not kept.

  Two helpers read the cells:
  - `shownTotal` turns a count under 5 into null and rounds the rest down to a multiple of 5;
  - `firstTime` reads `minIf`'s 1970 as "never".
- `lib/env.ts` gained:
  - `POSTHOG_QUERY_API_KEY`: optional, `phx_…`, server only;
  - `POSTHOG_API_BASE_URL`: defaults to the US app host from `region.ts`, and can be pointed at a stub.

  `.env.example` documents the key.
- /admin, owner only, English only: an **Activity** section right under the Alliances table (`app/_ui/admin/Activity.tsx`, `lib/queries/admin-activity.ts`). `Alliances` streams it inside `<Suspense fallback={null}>`, so `Workspaces` is unchanged. There is one card per workspace, in the table's order:
  - The card's head is the alliance, as the `#w-<slug>` link the table uses, with the slug under it.
  - Six totals for the last 7 days, each "at least n" or "under 5":
    - officers active;
    - board visitors;
    - notices written;
    - roll call marks;
    - thanks shared;
    - screenshots read.
  - Setup, #486's funnel: created → key saved → webhook set → first roll call marked → first notice published. Each step is its UTC date, with "· day n" after Created when that is known, or "not yet".

  The data is one `lap_alliance_usage` call per workspace, kept 15 min.
- The desk: **Board reach** on Home (`app/(private)/_ui/BoardReach.tsx`, `lib/private/board-reach.ts`). It is a margin note after "Members this week", shown only while the board is on, and streamed inside Suspense. It holds:
  - "At least 60 members opened the board in the last 7 days.";
  - "See what members see";
  - "Totals only, never who. Some visits are never counted, so the real number can be higher."

  The data is one `lap_board_reach` call, kept 1 h. Under 5 visitors, nothing is drawn.
- The members' board: one line at the end, "Your officers see totals only: how many members open this board, never who." It is shown while the key is set (`ReachLine`).
- Copy in EN, PT-BR and FR for the desk and the board (`lib/private/dictionary.board.ts`). /admin is English (`lib/copy-admin-alliances.ts`).
- D145, and its line in `docs/decisions/README.md`.

## Decisions

- D145 records the Endpoints, the key, the cache, the rules and both surfaces.
- **Home, not Insights, holds the board's reach.** Insights is its own switch (D126) and leads with the daily reads. Home is where every officer lands, and its margin already has "Members this week".
- **No notices line (product panel MUST).** The issue's example was "the notice of Tuesday was opened by at least 48". No board event names a notice. The first build said "At least n of them saw the notices", from `ws_board_section_viewed` `notices`. That event fires when the Notices heading scrolls into view, even when it says "No notices", so officers would read it as "people read my notice". It was removed. A per-notice count needs a notice id on a board event.
- **Totals rounded down to a multiple of 5 (adversarial SHOULD).** Without rounding, an hourly change from "at least 5" to "at least 6" tells officers that one member opened the board in that hour. A rounded total is still true as "at least".
- **"The last 7 days", rolling, not the calendar week.** Under the 5 rule, a calendar week would show nothing on a Monday morning.
- **On /admin, under 5 reads "under 5".** On the desk it is not drawn. On /admin a missing card means PostHog did not answer, so "under 5" keeps the two apart. The setup steps are a workspace's milestones, not counts of people, so the 5 rule does not apply to them.
- **The setup steps are #486's setup funnel** (coordinator, 2026-11-21): created → key saved → webhook → first roll call marked → first notice published. All five are server `ws_action` events, so a closed tab or an ad blocker cannot lose them. The first build had a "bot installed" step. `ws_bot_installed` never fires for invited alliances, so it is gone.
- **`tier` comes from `persons` in the HogQL.** A board load's first `$pageview` is sent before `identify` (`person_profiles: "identified_only"`). The event-time `person.properties.tier` would miss those visits.
- **The board line shows only while the key is set.** With no key, officers see nothing, so the line would describe nothing.
- **The minimum and the rounding are applied in the app, not in the HogQL.** That keeps them tested, and lets /admin tell "under 5" from "no answer".

## Deviations

- The brief said the base URL comes from "the existing PostHog host env". There is no such env: the host is a constant in `lib/analytics/region.ts` (D77). `POSTHOG_API_BASE_URL` defaults to it, like `DISCORD_API_BASE_URL`, so QA could point at a stub.
- Activity is its own section, not new columns in the Alliances table. Seven more columns do not fit /admin's 960 px (D144). It sits right under the table, in the same order.
- The issue's "This week" is "in the last 7 days" (see Decisions).
- The issue's per-notice example is not built (see Decisions).

## PostHog Endpoints (for the orchestrator)

Project 741657. Create both as HogQL Endpoints with one variable, `workspace` (String, required). Do not materialise them yet: the app keeps each answer for 15 min to 1 h. The code pins `version=1`. If the query is edited after creation, raise `version` in `ENDPOINTS` (`lib/analytics/endpoints.ts`). The app reads the columns by name, so their order does not matter, but the names must match exactly. The app reads only the first row.

### `lap_board_reach` (the desk; one row)

```sql
SELECT uniq(person_id) AS board_visitors
FROM events
WHERE event = '$pageview'
  AND properties.section = 'board'
  AND properties.workspace = {variables.workspace}
  AND person_id IN (SELECT id FROM persons WHERE properties.tier = 'member')
  AND timestamp >= now() - INTERVAL 7 DAY
```

`tier` is read from `persons`, not from `person.properties` on the event. A board load's first `$pageview` is sent before `identify` (`person_profiles: "identified_only"`), so at that moment the event's person has no properties yet. The person it is merged into does.

The response the code expects:

```json
{ "columns": ["board_visitors"], "results": [[62]] }
```

The cell is a whole number (a string of digits is also accepted).

### `lap_alliance_usage` (/admin; one row)

```sql
SELECT
  uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY
    AND (event = 'ws_action' OR (event = '$pageview' AND properties.area = 'workspace'))
    AND (properties.tier = 'officer'
      OR person_id IN (SELECT id FROM persons WHERE properties.tier = 'officer'))) AS officers_active,
  uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY
    AND event = '$pageview' AND properties.section = 'board'
    AND person_id IN (SELECT id FROM persons WHERE properties.tier = 'member')) AS board_visitors,
  countIf(timestamp >= now() - INTERVAL 7 DAY AND event = 'ws_action'
    AND properties.feature = 'notice' AND properties.action = 'add') AS notices_written,
  countIf(timestamp >= now() - INTERVAL 7 DAY AND event = 'ws_action'
    AND properties.feature = 'roll_call' AND properties.action IN ('mark', 'rest')) AS roll_call_marks,
  countIf(timestamp >= now() - INTERVAL 7 DAY AND event = 'ws_action'
    AND properties.feature = 'thanks' AND properties.action = 'share') AS thanks_shared,
  countIf(timestamp >= now() - INTERVAL 7 DAY AND event = 'ws_action'
    AND properties.feature = 'screenshot' AND properties.action IN ('add', 'read_text')) AS screenshots_read,
  minIf(timestamp, event = 'ws_action'
    AND properties.feature = 'workspace' AND properties.action = 'create') AS created,
  minIf(timestamp, event = 'ws_action'
    AND properties.feature = 'tracker_key' AND properties.action = 'save') AS key_saved,
  minIf(timestamp, event = 'ws_action'
    AND properties.feature = 'discord' AND properties.action = 'save') AS webhook,
  minIf(timestamp, event = 'ws_action'
    AND properties.feature = 'roll_call' AND properties.action = 'mark') AS first_roll_call,
  minIf(timestamp, event = 'ws_action'
    AND properties.feature = 'notice_publish' AND properties.action = 'publish') AS first_notice
FROM events
WHERE event IN ('ws_action', '$pageview')
  AND properties.workspace = {variables.workspace}
  AND timestamp >= now() - INTERVAL 180 DAY
  AND (event != '$pageview' OR timestamp >= now() - INTERVAL 7 DAY)
```

The response the code expects:

```json
{
  "columns": ["officers_active", "board_visitors", "notices_written", "roll_call_marks", "thanks_shared", "screenshots_read",
              "created", "key_saved", "webhook", "first_roll_call", "first_notice"],
  "results": [[4, 41, 6, 120, 1, 9,
               "2026-11-10T09:00:00Z", "2026-11-10T09:30:00Z", "2026-11-11T08:00:00Z", "2026-11-12T18:00:00Z", "1970-01-01T00:00:00Z"]]
}
```

The five setup steps are #486's setup funnel (`docs/handoff/feat-486-onboarding-analytics.md`), all server `ws_action` events:

1. `created`: `workspace` / `create`;
2. `key_saved`: `tracker_key` / `save`;
3. `webhook`: `discord` / `save`;
4. `first_roll_call`: `roll_call` / `mark`;
5. `first_notice`: `notice_publish` / `publish`.

`ws_bot_installed` is not a step: it never fires for invited alliances, because the invite's finish marks the bot seen (`lib/private/invite-steps.ts`).

- The six counts are whole numbers.
- The five times are ISO date-time strings. `minIf` with no match gives 1970-01-01, and the code reads anything before 2000 (or null) as "not yet".

Check after creating them: run each with `{"workspace": "ogs"}` and check that the columns are as above. Then the owner's real check (Open issues).


## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest (283 files, 1461 tests passed, 4 skipped), drift and i18n.
- Tests against stubbed Endpoint answers:
  - `lib/analytics/endpoints.test.ts` (3);
  - `lib/private/board-reach.test.ts` (1);
  - `lib/queries/admin-activity.test.ts` (1).
- QA on a local production build:
  - The setup: a local Postgres 18 with 63 migrations; three invented workspaces `amber`, `birch` and `cedar`, with officer sessions and an `amber` member session; upstream and Discord on a dead port.
  - PostHog was a local HTTP stub (`POSTHOG_API_BASE_URL=http://127.0.0.1:3585`) that answers by the workspace variable. No call reached PostHog or upstream. All 22 stub requests carried the bearer key.
  - The scripts are in `scratchpad/484-e2e/` (`gen.mjs`, `posthog-stub.mjs`, `qa.mjs`), with screenshots in `scratchpad/484-e2e/shots/`.
  - Failure modes, 28 of 28 passed. With the stub down (503), answering junk, and answering after 5 s:
    - /admin and Home answer 200, with no Activity section and no Board reach;
    - no error text, no stack and no key in the HTML;
    - with the slow stub, the heading showed after 220–262 ms and the page finished at 3.1–3.2 s (the timeout).
  - Answers, 55 of 55 passed:
    - Activity per workspace: rounded totals, "under 5", the setup dates with "day n", "not yet", and the alliance link to `#w-amber`;
    - a second /admin view made 0 new stub calls (cached);
    - Home: amber "At least 60", birch "At least 15", and nothing for cedar (under 5). No workspace showed another's number;
    - the board line for a member in EN and FR, and in an officer's PT preview;
    - no sideways scroll, and the link is 44 px at 360, 640 and 1280, light and dark, EN and PT.
  - Stale, 1 of 1 passed: after the answers were kept, the stub went down and Home still showed the kept number.
- Panel (all three reached me):
  - **Product, with an R5 officer and a member persona**:
    - 1 MUST: the notices line. Removed.
    - SHOULD: the note's "Under 5 is not shown" was dropped and the new wording adopted in EN, PT and FR. Applied.
    - SHOULD: show /admin's four action counts exactly. Not applied (Open issues).
    - NICE: PT "Seus oficiais". Applied.
    - They found nothing punitive under D75, and no ranking.
  - **UX designer**:
    - no MUST;
    - SHOULDs applied: the alliance first and linked, one setup format, a shorter /admin help. The note SHOULD was solved by the product wording;
    - NICEs not applied: collapse an all-"under 5" card, bare numbers, hairline rows in the note.
  - **Adversarial**:
    - no MUST. It confirmed:
      - the cache key holds no secret;
      - failures are never kept;
      - officers previewing the board are not counted as members;
      - the owner's events are not counted;
    - SHOULD applied: rounding to a multiple of 5;
    - SHOULDs left as follow-ups: a reused slug, and /admin's parallel calls.

## Open issues

The owner's steps, from the issue:

1. In PostHog, create a personal API key with read-only query scope for project 741657.
2. Add it in Vercel as `POSTHOG_QUERY_API_KEY`, Production, Sensitive. Not Preview: a preview would read production numbers.
3. The PostHog connector in this Claude session is signed into another organisation. Reconnect it to the LAPTracker org if you want the agents to build and test the Endpoints directly.

Then the orchestrator creates the two Endpoints above, and the owner does one real check against project 741657 with the key. That check is the issue's last done-when, so issue 484 stays open until then. If board visitors read far lower than the officers expect, check the `persons` tier filter first.

A question for the owner: the product panel would show /admin's four action counts (notices, roll call marks, thanks, screenshots) exactly, with 0 as "none". They count actions, not people, and "under 5" hides whether a feature is used at all. I kept "no total below 5" for every total, as the issue and the brief state it. It is a one-line change in `lib/queries/admin-activity.ts` if you agree.

Follow-ups, not built:

- **A reused slug.** A deleted workspace's slug taken by a new alliance would show the old alliance's last 7 days, and its setup dates for 180 days. The fix: pass the workspace's `created_at` as a second Endpoint variable, and put it in the cache key.
- **/admin calls PostHog once per workspace, all at once.** Past about 20 workspaces, PostHog's query limit (about 240 a minute) could drop cards in a window. The fix: one Endpoint grouped by `properties.workspace`, kept as one entry.
- **Per-notice reach.** It needs a notice id on a board event. That is a tracking decision.
- **Outages.** During a long PostHog outage, Next keeps serving the last kept answer, which may be days old. Storing `fetchedAt` and dropping answers older than 24 h would fix it.
- **A new `CRON_SECRET`.** It changes every pseudonymous id, so for 7 days one member can be counted twice. D145 says so.

## Next

- Model/effort: keep. One client, two read models, two small components. Most of the time went to which events can carry each number honestly.
- Owner first: the three steps above. Then the orchestrator creates `lap_board_reach` and `lap_alliance_usage` in project 741657 as written above, and runs each once with `{"workspace": "ogs"}`.
- Plan change: none.

<adjustments>
- The Endpoint client (`lib/analytics/endpoints.ts`, `endpointRow`) is generic. A new PostHog number is a new entry in `ENDPOINTS` plus a read model; no new plumbing is needed.
- `tier` must be read from `persons` in HogQL. The event-time `person.properties.tier` misses each board or desk load's first `$pageview`, which is sent before `identify`.
- `ws_board_section_viewed` cannot count notices read: it fires when the heading scrolls into view, even with no notices.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/546
