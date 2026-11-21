## D144 — /admin's Alliances table: what each workspace uses and spends, from our own tables, in one more query (2026-11-21, owner, issue 485; amends D61, D124, D126)

Why: the owner (issue 485, 2026-11-20) wants to see on /admin what each alliance uses and spends. Our own tables already hold the server side. PostHog holds the people side (#484), not this.

**Where.** A new section, "Alliances", at the top of /admin's workspace sections, before "Workspaces". Owner only (the PIN, as the rest of /admin). English only (D48).

**Shape.**

- Below 640: one card per workspace, and the whole card is a link.
- From 640: a `ResponsiveTable` (D122) of 7 columns, which fits /admin's 960 px. Discord posts and Features show from 1024. "Last on the desk" is a line under the alliance there.
- A row opens that workspace's own entry in the Workspaces card below (`#w-<slug>`, clear of the sticky header). /admin has no page per workspace.
- **Order.** Rows that need a look come first. Their chip names the first reason (the table shows the reason only): "Needs a look · Key: paused", "Needs a look · Page errors: 3", "Needs a look · Daily limit used up". The reasons, in this order:
  1. a key an officer must mend: refused, to enter again, or none while the squads read is on;
  2. page errors, or Discord posts that failed;
  3. a daily limit used up, or a key out of quota today (it mends itself at 00:00 UTC; product panel, 2026-11-21).

  The rest follow by address. Only a reason is in red.

**Columns and sources.** Everything is counts and times only: no name, no key, no last 4 characters, no quota left, no webhook (D71, D124).

- **Tracker calls.** The workspace's own reads, for the quota day (`quotaDayRead`) and the 7 quota days to it:
  - `squad_reads.calls_used`, its first `/quota` call included (D124);
  - `shield_checks.morning_calls`, the Raid Shield check's morning read. Its Friday night burst is the squads read (D137).

  With its own key the cell reads "n of 1,000 today"; with OGs on `LAP_API_KEY`, "n today on the site's key". Beside it: "planned about n a day", D134's estimate from its switches.

- **Key.** `trackerKey` as `squadsKey` (`lib/workspace-keys.ts`) sees it, never opened:
  - **re-enter**: sealed under another master key, or `reenter`;
  - **ok**: usable now (`keyUsable`);
  - **paused**, with why: `invalid`, or `out_of_quota` today;
  - **none**: not set. OGs then reads on the site's key. Another workspace needs a look only when its squads read is on, since the read is then skipped.
  - With the keys off (no `WORKSPACE_KEYS_SECRET`), no saved key is used: OGs is on the site's key, the others read "none · keys are off on this site". That is the site's setting, so it is no reason to look (adversarial panel, 2026-11-21).
- **Daily limits.** D126's `workspace_usage` for the UTC day, against each cap: "12 of 20", "12 · no cap". A limit is used up when a cap above 0 is reached.
- **Discord posts.** Webhook posts since 00:00 UTC, "2 today · 1 failed". A post counts once, however many messages it took. The sources:
  - `notice_publishes`;
  - `garrison_plans`;
  - `thanks_shares` to Discord;
  - the Raid Shield summary (`shield_checks.posted_at`), at most one a day.

  Each table keeps only some of the tries, so the count can be low:
  - a garrison plan keeps only its last post's status and time, so a re-post the same day replaces the first;
  - the shield summary's message is edited in place, and each edit stamps `posted_at` again.

- **Page errors** (last 24 h). `app_errors` rows in the 24 h before the view whose new `workspace_slug` is the workspace's slug. It is a lower bound, as the help line says:
  - Only errors under `/w/[slug]` and `/api/w/[slug]` carry a slug.
  - The nightly reads run every workspace's batch together, so their errors carry none and stay on /admin/errors only.
  - `recordAppError` stores at most one row a second per instance.
- **Last on the desk.** The newest `workspace_sessions.seen_at` of an officer's session (D108's "On the desk now" source), as "3 hours ago". Member sessions never count.
  - An expired session still counts until it is deleted, because its `seen_at` is still a true visit.
  - Sessions last 7 days and an expired one is deleted at the next sign-in, so an older visit reads "none on record".
- **Features.** D126/D134: "n changed by you" (the owner's stored overrides of the defaults, switches and caps) and "k turned off by the alliance".

**"Today" is the UTC day everywhere in the table.** The tracker quota, D126's caps and the posts all reset at 00:00 UTC, which is 22:00 server time (UTC−2). The help line says "00:00 UTC", as D126's lines do, since `SERVER_TZ` is a setting.

**Cost: one statement per /admin view.**

- `allianceUsage` (`lib/queries/admin-alliances.ts`) is one SQL statement. It has four `group by` parts joined to `workspaces`, and it runs in the `Promise.all` that the Workspaces section already makes, on the request's one Pool (D141).
- Each part reads a bounded window:
  - the two reads by their `(day, union_id)` primary keys, 7 days;
  - `app_errors` by `app_errors_at_idx`, 24 h, and the table is capped at 500 rows;
  - the posts and the sessions from small tables. `notice_publishes` and `garrison_plans` have no time index and are never pruned; they grow by a few rows per workspace a week.
- Every other column comes from reads /admin already made: the key's facts, the switches, today's use and the member counts.
- So the table adds one transaction per view. The handoff has the measurement.

**`app_errors.workspace_slug`** (migration `0062_app_errors_workspace`).

- `recordAppError` stores the request's slug under `/w/[slug]` and `/api/w/[slug]`. Until now it went to PostHog only (issue 452).
- The path is user input, so a slug is stored only when it has a slug's shape (`WORKSPACE_SLUG`). Anything else is stored as null.
- The slug is not member data. /admin/errors does not show it.
- Rows from before this change have none, so the table's error count starts from this release.

**Not done.**

- "Tracker calls" leaves out two kinds of call:
  - The daily roster read's call for an alliance outside the tracked set, on its own key (D133). It is about one call a day. The read's `run_logs` lines do not say which key made each call.
  - The key test from Alliance settings ("Save and test", one `/quota` call). It is stored nowhere as a count.
- No per-workspace cap on tracker calls. The issue's D134 comment asks only to consider one; the squads read keeps its own 120 a day.
- No new tracking and no upstream call.

**Tests.**

- One per query part (`lib/queries/admin-alliances.test.ts`):
  - calls over the 7 quota days;
  - posts posted and failed since 00:00 UTC;
  - errors under the address in 24 h;
  - an officer's newest desk request.
- The slug stored only in a slug's shape (`lib/app-errors.test.ts`).
- The view (`app/_ui/admin/alliances-view.test.ts`):
  - the key states, including keys off;
  - calls against the key's 1,000;
  - a used-up limit;
  - the features changed;
  - the order and each reason's words.

**Amendment 2026-11-21 (perf panel; D149).** The cost line above no longer holds for the setup steps' marks part: it read the whole `roll_call_marks` table on every view. It now reads each roll call's first mark from `roll_call_marks_call_written_idx` (migration `0066_roll_call_marks_call_written`). The posts part still scans `notice_publishes` and `garrison_plans`: 0.8 ms at 20k notice posts, so they get no index.
