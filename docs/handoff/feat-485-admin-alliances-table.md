# feat-485 — /admin Alliances table

## Built

- A new "Alliances" section on /admin, above "Workspaces", with one row per workspace (`app/_ui/admin/AlliancesTable.tsx`, `app/_ui/admin/alliances-view.ts`). It is owner only (the PIN) and English only.
  - Below 640 there is one card per workspace, and the whole card is a link. From 640 it is a `ResponsiveTable` with 7 columns. Discord posts and Features show from 1024. "On the desk: …" is a line under the alliance.
  - A row opens the workspace's entry in the Workspaces card (`#w-<slug>`, `scroll-mt-20`, so it lands clear of the sticky header).
  - The rows that need a look come first. Their red chip names the first reason. In rank order:
    1. key: refused, re-enter, or none while the squads read is on;
    2. page errors or failed Discord posts;
    3. a daily limit used up, or a key out of quota today.
- The columns and their sources:
  - **Tracker calls:** `squad_reads.calls_used` + `shield_checks.morning_calls`, for the quota day and 7 quota days. Shown as "n of 1,000 today" on its own key, or "n today on the site's key". Beside it, "planned about n a day" from D134's estimate.
  - **Key:** `trackerKey` read by `squadsKey`'s rule, with no write and no tracker call.
  - **Daily limits:** `workspace_usage` against the caps.
  - **Discord posts:** posts that went through or failed since 00:00 UTC.
  - **Page errors:** in the last 24 h.
  - **Last on the desk:** the officer sessions' `seen_at`.
  - **Features:** "n changed by you · k turned off by the alliance".
- `lib/queries/admin-alliances.ts`: `allianceUsage` is one SQL statement with four `group by` parts. It runs in the Promise.all that the Workspaces section already makes.
- `app_errors.workspace_slug` (migration `0062_app_errors_workspace`): `recordAppError` stores the request's slug when it has a slug's shape.
- D144, plus copy in `lib/copy-admin-alliances.ts` (nested as `copy.admin.workspaces.alliances`, because `lib/copy-admin.ts` is at its 300-line limit).

## Decisions

- D144 records the columns, their sources, the order of reasons, the cost and what is left out.
- "Last officer activity" uses D108's presence source (`workspace_sessions.seen_at`, officer sessions only), not D108's activity feed. The feed has about 15 sources per workspace, and running it for every workspace on each /admin view would cost far more than one `group by`. Every feed action is a desk request, so `seen_at` is never older than the newest feed line while the session is stored. Expired sessions still count until they are deleted.
- "Today" is the UTC day. The tracker quota, the caps and the posts all reset at 00:00 UTC (22:00 ST). The copy says "00:00 UTC" because `SERVER_TZ` is a setting.
- "Tapping a row opens the workspace's existing /admin page": /admin has no page per workspace, so a row links to that workspace's entry in the Workspaces card on the same page.
- Panel changes:
  - From product: failed Discord posts are shown and are a reason; the chip names its reason; a key out of quota ranks with the caps; the errors label became "Page errors".
  - From adversarial: with the keys off, the Key column follows `squadsKey`.
  - From QA: the anchor clears the sticky header; only a reason is red; values no longer break mid-number.

## Deviations

- "Discord messages sent today" counts **posts**, not messages. Garrison and thanks posts do not store how many messages they took.
- "Errors in the last 24 h" counts only errors under `/w/[slug]` and `/api/w/[slug]`, from this release on, so it is a lower bound. The nightly squads and shield batches run every workspace together and carry no slug. `recordAppError` keeps at most one row a second. Tagging the batch errors per workspace would mean changing how `runSquadsBatch` reports errors, so it is left as a follow-up.
- "Tracker calls" leaves out the D133 own-key daily roster call (about 1 a day) and the "Save and test" `/quota` call. Neither is stored per workspace with its key.
- No per-workspace cap on tracker calls. The issue's D134 comment asked only to consider one.

## Verified

- `pnpm check` passes.
- New tests:
  - `lib/queries/admin-alliances.test.ts`: one per query part.
  - `lib/app-errors.test.ts`: the slug is stored only in a slug's shape.
  - `app/_ui/admin/alliances-view.test.ts`: the key states including keys off, calls against 1,000, a used-up limit, features changed, and the order and reason words.
- A local production build against a local Postgres 18 (63 migrations, the fixture seed, and 3 invented workspaces `amber`/`birch`/`cedar` in different states). There were no upstream, Discord or Groq calls: the upstream base URL pointed at a dead port.
- Transactions per /admin view, from `pg_stat_database`, median of 7 views after one warm-up:

  | Build | Transactions | Sessions |
  | --- | --- | --- |
  | `origin/dev` | 49 | 3 |
  | this branch | 50 | 3 |

  So the table costs +1 transaction per view, measured three times.
- `EXPLAIN ANALYZE` of the statement: 0.14 ms. `squad_reads` and `shield_checks` are read through their `(day, union_id)` primary keys.
- Screenshots at 360, 768, 1024 and 1280, light and dark, are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/qa485/shots3/`. No width scrolls sideways, and the table fits /admin's 960 px. A tap at 360 and 1280 lands the workspace 80 px from the top, under the 64 px header.
- Leak check (QA): the /admin HTML has no last 4, quota left, ciphertext, webhook URL, avatar_url, x/y, online or joined_at. A locked /admin shows the PIN card only.
- Panel:
  - Product/owner: 1 MUST (the errors label), fixed.
  - Adversarial/SRE: no MUST. 2 SHOULDs: keys-off fixed; background errors documented as a lower bound.
  - QA: 1 MUST (the anchor under the header), fixed. 2 SHOULDs, fixed.

## Open issues

- Follow-up: tag the squads and shield batch errors with their workspace, so "Page errors" can become "Errors".
- Follow-up (product SHOULD, not built): flag calls far above the plan (for example "5× the plan").
- `notice_publishes` and `garrison_plans` have no time index and are never pruned. The posts part scans them whole. That is cheap now, but it grows a few rows per workspace a week.
- An error in `allianceUsage` fails the whole Workspaces section, as any of its other reads would.

## Next

- Model/effort: keep. One query and one view, but a long list of source semantics to pin down.
- Owner first: merge. The migration adds one nullable column; Vercel's `db:migrate` applies it.
- Plan change: none.

<adjustments>
- `app_errors.workspace_slug` exists now. Any per-workspace error view can group on it instead of parsing `route`.
- `allianceUsage` already returns calls, posts, failed posts, errors and the officers' last desk request per workspace. Reuse it rather than adding reads.
</adjustments>

<adjustments for="issue 484">
- The server-side spend per alliance is on /admin's Alliances table (D144). The PostHog dashboard need not repeat tracker calls, caps or webhook posts.
</adjustments>

PR: (added by the orchestrator)
