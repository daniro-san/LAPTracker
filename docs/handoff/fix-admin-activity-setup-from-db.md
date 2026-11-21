# fix-admin-activity-setup-from-db — /admin Activity: setup from our database, exact action counts

## Built

- The owner checked /admin's Activity section in production, on OGs. Setup read "not yet" for Created, Key saved, First roll call marked and First notice published, and all six counts read "under 5". The setup steps came from `ws_action` events, which exist only since v5.29 (2026-11-21). OGs was created, and its key saved, long before that.
- **The setup steps now come from our own tables.** D144's one `allianceUsage` statement (`lib/queries/admin-alliances.ts`) gained four `group by` parts and one join (`SETUP_PARTS`, `SETUP_COLUMNS`, `SETUP_JOINS`). It returns `setup` per workspace:

  | Step | Source | No date, but done |
  | --- | --- | --- |
  | Created | `workspaces.created_at` | never: always set |
  | Key saved | `min(changed_at)` of `workspace_key_changes` rows with `action = 'set'`, counted only when `workspace_keys` has a row | "done" when `workspace_keys.status <> 'unset'` and no `set` row is left |
  | Webhook set | `min(saved_at)` of `workspace_webhooks`, both channels | none |
  | First roll call marked | `min(written_at)` of `roll_call_marks` joined to `roll_calls` (deleted roll calls included) | none |
  | First notice published | `min(published_at)` of `notice_publishes` with `status = 'posted'` | none |

  The row passes through `AllianceRow.setup` (`app/_ui/admin/alliances-view.ts`) to `Activity` (`app/_ui/admin/Activity.tsx`). A step reads its UTC date with "· day n" counted from Created, "done", or "not yet".
- **PostHog no longer gives setup.** `lib/queries/admin-activity.ts` reads only the six counts. `ENDPOINTS.allianceUsage` is pinned to `version: 2`. `firstTime` is gone from `lib/analytics/endpoints.ts`. Columns are still read by name, so an extra column is ignored.
- **Action counts are exact.** Notices written, roll call marks, thanks shared and screenshots read show the bare number, 0 to 4 included, with no rounding. Officers active and board visitors keep "at least n" (rounded down to 5s) and "under 5" (`PEOPLE_TOTALS`). If an action cell is not a whole number from 0, the answer has another shape, so that workspace's card is left out. The desk's board reach is unchanged.
- /admin help text (`lib/copy-admin-alliances.ts`): it now says people counts are rounded and actions are counted as they are, that setup comes from the workspace's own records, and what "done" means. New key: `done`.
- D145 has a dated amendment (2026-11-21) covering both changes.

## Decisions

- **0 new transactions.** The setup reads are new parts of D144's statement, not a new query in the `Promise.all`.
- **Key saved needs a `workspace_keys` row** (adversarial SHOULD). `saveTrackerKey` claims the `set` row before it tests the key, and drops it only when the key is refused or unreachable. A request that dies mid-test would leave a row for a key that was never stored. If the workspace never stored any key, that row is ignored.
- **Key saved reads `workspace_keys.status` only**, never `ciphertext`, `nonce` or `last4`.
- **The cards still need PostHog's answer.** A workspace PostHog did not answer for still has no card, setup included, as D145 says. The brief asked only to change where the setup comes from.
- **Site webhooks do not count.** The site's fallback webhooks (`WORKSPACE_DISCORD_WEBHOOKS`) are not the workspace's own step, so Webhook set reads "not yet" without a saved channel. This matches the #486 funnel step (`discord` / `save`).

## Deviations

- The brief asked for "done without a date" wherever a table has no timestamp. Only Key saved can be in that state. Every other step's table keeps a time.
- Webhook set is the earliest **stored** channel's latest save, not the first save ever. Saving a channel again moves its `saved_at` later, and Remove deletes the row. No table keeps the webhook's history. So the date is a day by which a webhook was set. D145's amendment says so.

## The new `lap_alliance_usage` (version 2, for the orchestrator)

Project 741657, the same Endpoint, the same one variable `workspace` (String, required). The five `minIf` setup columns are gone. All six counts are 7-day counts, so the 180-day window and the per-column 7-day conditions collapse into one `timestamp >= now() - INTERVAL 7 DAY` in `WHERE`. The counts are the same as version 1's.

```sql
SELECT
  uniqIf(person_id, (event = 'ws_action' OR (event = '$pageview' AND properties.area = 'workspace'))
    AND (properties.tier = 'officer'
      OR person_id IN (SELECT id FROM persons WHERE properties.tier = 'officer'))) AS officers_active,
  uniqIf(person_id, event = '$pageview' AND properties.section = 'board'
    AND person_id IN (SELECT id FROM persons WHERE properties.tier = 'member')) AS board_visitors,
  countIf(event = 'ws_action'
    AND properties.feature = 'notice' AND properties.action = 'add') AS notices_written,
  countIf(event = 'ws_action'
    AND properties.feature = 'roll_call' AND properties.action IN ('mark', 'rest')) AS roll_call_marks,
  countIf(event = 'ws_action'
    AND properties.feature = 'thanks' AND properties.action = 'share') AS thanks_shared,
  countIf(event = 'ws_action'
    AND properties.feature = 'screenshot' AND properties.action IN ('add', 'read_text')) AS screenshots_read
FROM events
WHERE event IN ('ws_action', '$pageview')
  AND properties.workspace = {variables.workspace}
  AND timestamp >= now() - INTERVAL 7 DAY
```

The response the code expects:

```json
{
  "columns": ["officers_active", "board_visitors", "notices_written", "roll_call_marks", "thanks_shared", "screenshots_read"],
  "results": [[4, 41, 6, 120, 1, 9]]
}
```

The code runs `?version=2`. **Publish version 2 before this branch deploys.** Until version 2 exists, every call fails and /admin draws no Activity section; nothing else breaks. To check, run version 2 with `{"workspace": "ogs"}` and confirm the six columns.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest (284 files passed, 2 skipped; 1471 tests passed, 4 skipped), drift and i18n.
- Tests, one per stated behaviour:
  - `lib/queries/admin-alliances.test.ts`: a workspace created 2026-03-01 shows its real date for each of the five steps. The test data includes a key saved twice with a remove between, two webhook channels, two marks, and a failed publish before a posted one. A stored key with no change row reads "done".
  - `lib/queries/admin-activity.test.ts`: action counts are exact (6, "122", 0, 4). People counts read null under 5 and are rounded down otherwise (3 → null, 41 → 40). An extra column is ignored. A failed workspace is left out.
  - `lib/analytics/endpoints.test.ts`: the `firstTime` assertions are removed.
- **Local production build, with invented data.**
  - Setup: Postgres 18 on 55780 with 63 migrations, the bridge, and a PostHog stub that answers version 1 with the setup columns and version 2 without them. Upstream and Discord pointed at a dead port.
  - Three workspaces:
    - `amber`: old, created 2026-02-10, with a key, two webhooks, 300 roll calls (30,000 marks) and a posted notice;
    - `birch`: created 2026-11-19, with a webhook only;
    - `cedar`: a stored key with no change row.
  - Scripts: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/fix-setup-e2e/` (`gen.mjs`, `posthog-stub.mjs`, `measure.mjs`, `peek.mjs`, `explain.sql`).
  - **Transactions per /admin view** (`pg_stat_database`, median of 7 views after one warm-up; every view had the same count):

    | Build | Transactions | Sessions |
    | --- | --- | --- |
    | `origin/dev` | 42 | 4 |
    | this branch | 42 | 4 |

    So the change adds 0 transactions. It was re-measured after the final edit: 42.
  - **The statement**, by `EXPLAIN ANALYZE` on the same data: about 0.1 ms before, 8.7 to 10.4 ms after. Almost all of that is the `marked` part, which reads `roll_call_marks` once (30,000 rows, 281 buffers).
  - **The cards read:**
    - amber: Created 2026-02-10 · day 0, Key saved 2026-02-11 · day 1, Webhook set 2026-02-12 · day 2, First roll call marked 2026-02-14 · day 4, First notice published 2026-02-21 · day 11. Counts 6 / 120 / 1 / 9, "under 5", "at least 40".
    - birch: Roll call marks 0 and Screenshots read 0 shown as 0.
    - cedar: Key saved "done", and all four action counts 0.
  - A stray `set` claim added to birch, which never stored a key, still read "not yet".
- **Panel** (both results reached me):
  - **Adversarial: no MUST.**
    - SHOULD, key date for a key never stored: fixed (Decisions).
    - SHOULD, version 2 may not be published at deploy: kept, as the brief says. The orchestrator publishes version 2 first (above).
    - No leak: the new parts read only times and `workspace_keys.status`. Nothing new goes to logs, PostHog or a cache.
    - It judged that exact action counts on the owner-only page identify no member (D75).
    - It found no cheaper exact plan without a new index. A lateral `order by written_at limit 1` was slower (11.6 ms, 37k buffers).
    - NICEs, not applied: Webhook set reads current state; a publish stuck in `posting` stays "not yet"; the `created: null` fallback cannot happen. All three are in Open issues.
  - **QA at 360, 640 and 1280, light and dark: no MUST or SHOULD.**
    - All texts matched exactly.
    - No sideways scroll. The card-head link is 44.3 px. One column below 640, two from 640.
    - The /admin HTML has no `phx_`, stack, webhook URL, ciphertext, or x/y/online/last_online_at/joined_at/avatar_url keys.
    - A second view made 0 new stub calls.
    - Its NICE, say what "done" means, was applied in the help text.
    - Screenshots: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/fix-setup-e2e/qa/activity-360-light.png`, `activity-360-dark.png`, `activity-1280-light.png` in the same folder.
- The diff has 0 hits against the 404 names in `fixtures/`.

## Open issues

- **Publish `lap_alliance_usage` version 2** (above) before this deploys.
- The marks part grows with `roll_call_marks`. It is about 10 ms at 30,000 rows, and it runs only on /admin views. Past a few hundred thousand marks there are two fixes: an index on `roll_call_marks (roll_call_id, written_at)`, or the step's first time stored on `workspaces`. Follow-up, not built.
- Webhook set moves later when a channel is saved again, and reads "not yet" after both channels are removed. A true first time needs a webhook history (a write). Follow-up.
- A notice publish whose function dies after Discord accepted it stays `posting`. First notice published can then read "not yet" although a notice went out. Rare. Not changed.
- The setup steps are hidden whenever PostHog does not answer, because they live in the PostHog card. Showing them without PostHog would change D145's "nothing at all" rule. That is the owner's call.

## Next

- Model/effort: keep. One statement extended, one read model narrowed, one card. The time went to each table's write path, to make sure each date is true.
- Owner first: nothing. The orchestrator publishes `lap_alliance_usage` version 2 (the HogQL above) and runs it once with `{"workspace": "ogs"}` before merging.
- Plan change: none.

<adjustments>
- /admin's setup steps come from `allianceUsage` (`setup` per workspace). A new /admin per-workspace milestone is a new part of that statement, not a PostHog column.
- `lap_alliance_usage` holds only the six 7-day counts from version 2 on. The code pins version 2.
- Action counts on /admin are exact. Only people counts follow the 5 rule and its rounding.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/560
