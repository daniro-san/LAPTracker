## D144 — /admin's Alliances table: what each workspace uses and spends, from our own tables, in one more query (2026-11-21, owner, issue 485; amends D61, D124, D126)

Why: the owner (issue 485, 2026-11-20) wants to see on /admin what each alliance uses and spends. Our own tables already hold the server side. PostHog holds the people side (#484), not this.

**Where.** A new section, "Alliances", at the top of /admin's workspace sections, before "Workspaces". Owner only (the PIN, as the rest of /admin). English only (D48).

**Shape.**

- Below 640: one card per workspace, and the whole card is a link.
- From 640: a `ResponsiveTable` (D122). Discord posts, Officers seen and Features show from 1024.
- A row opens that workspace's own entry in the Workspaces card below (`#w-<slug>`). /admin has no page per workspace.
- **Order.** Rows that need a look come first, marked "Needs a look":
  1. a key that cannot be used;
  2. errors;
  3. a daily limit used up.

  The rest follow by address.

**Columns and sources.** Everything is counts and times only: no name, no key, no last 4 characters, no quota left, no webhook (D71, D124).

| Column        | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tracker calls | The workspace's own reads: `squad_reads.calls_used` (its first `/quota` call included, D124) and `shield_checks.morning_calls` (the Raid Shield check's morning read; its Friday night burst is the squads read, D137). Counted for the quota day (`quotaDayRead`) and for the 7 quota days to it. With its own key the cell reads "n of 1,000 today". With OGs on `LAP_API_KEY` it reads "n today on the site's key". Beside it: "planned about n a day", D134's estimate from its switches. |
| Key           | `trackerKey` as the squads read sees it, never opened. Sealed under another master key, or `reenter`: **re-enter**. Usable now (`keyUsable`): **ok**. `invalid` or `out_of_quota` today: **paused**, with why. Not set: **none**, which needs a look only when the squads read is on and the workspace is not OGs (the read is then skipped).                                                                                                                                                 |
| Daily limits  | D126's `workspace_usage` for the UTC day, against each cap: "12 of 20", "12 · no cap". A limit is used up when a cap above 0 is reached.                                                                                                                                                                                                                                                                                                                                                      |
| Discord posts | Webhook posts that went through since 00:00 UTC: `notice_publishes` posted, `garrison_plans` posted, `thanks_shares` posted to Discord, and the Raid Shield summary (`shield_checks.posted_at`, at most one a day: its message is edited in place). A post counts once, however many messages it took.                                                                                                                                                                                        |
| Errors 24 h   | `app_errors` rows in the 24 h before the view whose new `workspace_slug` is the workspace's slug.                                                                                                                                                                                                                                                                                                                                                                                             |
| Officers seen | The newest `workspace_sessions.seen_at` of an officer's session (D108's "On the desk now" source), as "3 hours ago". Member sessions never count. Sessions expire after 7 days and are deleted at the next sign-in, so an older visit reads "none on record".                                                                                                                                                                                                                                 |
| Features      | D126/D134: the owner's stored overrides of the defaults (switches and caps), and how many allowed features the alliance turned off.                                                                                                                                                                                                                                                                                                                                                           |

**"Today" is the UTC day everywhere in the table.** The tracker quota, D126's caps and the posts all reset at 00:00 UTC, which is 22:00 server time (UTC−2). The help line says "00:00 UTC", as D126's lines do, since `SERVER_TZ` is a setting.

**Cost: one statement per /admin view.**

- `allianceUsage` (`lib/queries/admin-alliances.ts`) is one SQL statement. It has four `group by` parts joined to `workspaces`, and it runs in the `Promise.all` that the Workspaces section already makes, on the request's one Pool (D141).
- Each part reads a bounded window:
  - the two reads by their `(day, union_id)` primary keys, 7 days;
  - `app_errors` by `app_errors_at_idx`, 24 h, and the table is capped at 500 rows;
  - the posts and the sessions from small tables.
- Every other column comes from reads /admin already made: the key's facts, the switches, today's use and the member counts.
- So the table adds one transaction per view. The handoff has the measurement.

**`app_errors.workspace_slug`** (migration `0062_app_errors_workspace`).

- `recordAppError` stores the request's slug under `/w/[slug]` and `/api/w/[slug]`. Until now it went to PostHog only (issue 452). It is stored only when it has a slug's shape (`WORKSPACE_SLUG`); the path is user input, so anything else is stored as null.
- The slug is not member data. /admin/errors does not show it.
- Rows from before this change have none, so the table's error count starts from this release.

**Not done.**

- The daily roster read's call for an alliance outside the tracked set, on its own key (D133), is about one call a day and is not in "Tracker calls". The read's `run_logs` lines do not say which key made each call.
- No per-workspace cap on tracker calls. The issue's D134 comment asks only to consider one; the squads read keeps its own 120 a day.
- No new tracking and no upstream call.

**Tests.**

- One per query part (`lib/queries/admin-alliances.test.ts`): calls over the 7 quota days; posts since 00:00 UTC; errors under the address in 24 h; an officer's newest desk request.
- The slug stored only in a slug's shape (`lib/app-errors.test.ts`).
- The view (`app/_ui/admin/alliances-view.test.ts`): the key states; calls against the key's 1,000; a used-up limit; the features changed; the order.
