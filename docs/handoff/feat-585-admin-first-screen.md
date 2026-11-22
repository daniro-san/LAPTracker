# feat-585-admin-first-screen: /admin says what needs the owner first (#585 batch 2b, slice 2)

Size L (the #585 batch 2b plan, four slices); this PR builds slice 2. Plan: `.specs/features/585-settings-admin/plan.md` § S2 (criteria 17-26, updated before building), checks C17-C30 in `checks.md`. Findings F11, F12, F13 and F34 of the 585 review.

## Built

- **"Needs you"**, the first section of /admin, above Status (`needs-you.ts`, drawn with `PageIndex` in an `AdminSection`). One row per kind of thing that waits on the owner, only while it waits, each with its count in words and a 44 px link to where it is done, in this order:
  1. the scheduler late;
  2. today's daily read to retry;
  3. access requests waiting (all of them, by `count(*)`, not only the 50 listed);
  4. app errors in the last 24 h;
  5. workspaces "n to set up · n with a key to fix";
  6. workspace deletions asked;
  7. the morning API reading low;
  8. your to-dos (the open `ownerTodo` count).

  With nothing waiting, one line: "Nothing needs you now." The to-dos row is the only one not in yarn, because it stands for weeks.
- **Setup gaps on the Alliances table** (F12, D144 amendment). There are two:
  - "Setup: no member role": the members' board is closed, and the owner sets the role on /admin.
  - "Setup: no read yet": no roster of its alliance that did not fail, from the day before the workspace was made on, once a daily read that started after it was made has finished.

  Setup ranks after a key problem and errors, and before a used-up limit.
- **Activity** shows each workspace's setup steps even when PostHog has no totals, with "Member role" and "First read" added (F12, D145 amendment).
- **The nav's App errors count**, for the last 24 h and read out in words, on every /admin page. It is one indexed count, shared with "Needs you" through React `cache`.
- **The API reading** (F34). Above 1,000 it reads "3,869 left" with a muted "Above the 1,000 plan", never "OK". Grouped digits everywhere. The "1,000" figure in the 9 /admin and guide strings now comes from `DAILY_QUOTA` in `lib/budget.ts`.
- **The Last tick fact** says "Late" in seal by the watcher's own rule (`heartbeatBoundary`, D45/D141) (F34).
- **/admin/errors** (F34):
  - each group shows the workspace addresses it happened under;
  - `?w=<slug>` keeps that workspace's groups, with "Show all errors";
  - any other value lists everything.

  The Alliances row's page error count links there. Below 640 the card is no longer one big link; its alliance name is.
- **WorkspaceForm** (F13): a workspace whose alliance no board or roster names yet keeps it in the select as "{id} · not read yet". So editing it no longer shows the first alliance in the list. The Alliances table uses the same label.
- Code moves:
  - `readWorkspaces` and `alliancesOf` are out of `Workspaces`, so the page reads the workspaces once for both "Needs you" and the sections;
  - `listErrorGroups` moved to `lib/queries/admin-errors.ts`;
  - the Status and Needs you copy is in `lib/copy-admin-status.ts` and `lib/copy-admin-needs.ts`, to keep files under 300 lines.
- Docs: DESIGN.md `PageIndex` line (/admin uses it, `href`); D144 and D145 amendments; plan and checks.

## Decisions

- **No "no Discord" setup gap.** The product persona and the adversarial review both said an alliance may choose no channel (D75), as S1 settled. Activity still lists "Webhook set".
- **The workspaces count is setup and key only.** Page errors have their own row (the owner persona: one error counted twice). A used-up limit and a key out of quota mend at 00:00 UTC (the product persona).
- **No Needs you row for a reading above 1,000.** The owner persona: the reading is usually above 1,000, so the row would show every day.
- **"Low" comes only from the daily read's reading taken before the day's spend.** The adversarial review: a snapshot's reading after the event day's runs is under 900 by design.
- **That morning reading is the first quota check in the newest daily read's run log** (`morningQuota`, `lib/queries/admin-page.ts`), not `daily_reads.quota_remaining_before`. The PR #637 review found that a Retry (D67, D72) overwrites that column and `started_at` with its own reading, taken after the spend, or with null. The retry only adds run log lines after the first read's, so the first read's `v1.fetch` quota line stays first. It counts only within the read deadline (100 s) of the day's first log line: when the first read's check was cut and left no line, a retry's check is not taken in its place. No migration is needed. If that first check got no number, there is no "Low" row.
- **No nav count beside Overview.** The owner persona: it repeats the section under it. The adversarial review: on every admin page it would run the whole Alliances read set on each 4-second poll during a run (#521). S3's Workspaces page gets its own count.
- **The standing approval applies.** There is no one-way door: no schema change, no deletion, no quota spend, no dependency, no new place for a private field. All three reviews approved with changes, and their changes were taken (plan § S2 plan review).

## Deviations

- **Plan criterion 17's "a late tick (none for 20 minutes or more)" cannot work as worded.** Since D141 an idle tick writes no row, so it would be "late" most of the day. "Late" now uses the watcher's rule.
- **Criterion 19 is cut to the App errors count**; see Decisions.
- **/admin is taller**: 9,184 → 10,852 px at 360, 6,578 → 7,799 at 1280.
  - The cause on the seed is mostly Activity, which was hidden there because local PostHog has no key and now shows the setup steps (F12). In production Activity already showed, so the growth there is Needs you (about 270 px) and two more steps per card.
  - Making the page shorter is slice 3 (F33).
- **The nav wraps at 360**: "Patch notes" moved to the second row, beside Idle and Log out, because of the App errors badge. All targets stay 44 px.

## Verified

- `pnpm check`: passed. Prettier, eslint, tsc, vitest (319 files, 1,686 tests, 4 skipped), drift and i18n.
- Tests, one per behaviour:
  - `needs-you.test.ts`: 5;
  - `StatusFacts.test.ts`: 2;
  - `alliances-view.test.ts`: 2 new, and the `byAttention` test extended with setup;
  - `admin-errors.test.ts`: 4;
  - `admin-alliances.test.ts`: 1 new, and the setup-steps test given the two new steps;
  - `gate.test.ts`: 2 rendered /admin tests.

  The existing fixture workspace now has a member role, because a set-up workspace has one.
- **Breaks: 25 mutations, all killed.** Each one broke the code on purpose and its test file failed (`585-admin/mutate.py`):
  - Needs you: the order; rows shown with nothing waiting; "low" from any reading; 1,000 read as above; late after 60 minutes of quiet; the to-dos in yarn; the workspaces row counting errors and limits;
  - setup gaps: "no read yet" before a finished read; setup ranked after a used-up limit;
  - F13: the unread alliance left out of the select;
  - the first-read SQL counting a failed roster, or one from long before; "read since" ignoring when the workspace was made;
  - /admin/errors: `?w=` ignored; later rows' addresses dropped; `?w=` taking any string; the 24 h count counting every row;
  - requests: answered ones counted;
  - Activity hidden without PostHog;
  - Needs you after Status; the nav count left out; page errors opening the workspace;
  - the quota: "OK" above 1,000; "n of 1,000" above 1,000;
  - no Late chip.
- **Walked** on a local production build with the invented 585 seed. Captures are in the scratchpad, not committed: `585-admin/shots/before/` and `585-admin/shots/after/`, /admin, /admin/errors and /admin/errors?w=ogs at 360, 768, 1024 and 1280, light and dark, with no sideways scroll.
  - /admin/errors?w=ogs shows "Errors under /w/ogs only.", "Show all errors", and "/w/ogs · …" on each group.
  - The Alliances table lists `ogs` first (page errors), then `brk` ("900802 · not read yet", "Setup: no member role"), then `fern`.
- **Statements per view** (`log_statement = all`, one signed-in GET):
  - /admin: 41 → 43 (the waiting-requests count and the errors count; the workspace reads still run once);
  - /admin/errors: 7 → 8; /admin/runs: 10 → 11; /admin/changes: 6 → 7 (the nav's count).
- **First-glance test** (360 × 780, about 5 s, the owner, "What do I need to do today on /admin?"):
  - Before: "Nothing is urgent today. The API budget is fine, nothing is running, and the next run is a week away." Wrong (MUST): a request, two workspaces without a member role and an app error were waiting. He also read "3869 of 1,000" as contradictory.
  - After: "Approve the one waiting access request, look at the one app error from the last 24 hours, set up the 2 workspaces, and go through the 25 open to-dos. I'd start with access and the error." Right, with high confidence. His one doubt, "25 open to-dos looks as important as the access request", is fixed: the to-dos row is no longer in yarn.
- Privacy: /admin's new parts carry counts, words and workspace addresses only. There is no roster field, name, key, webhook or Discord id. `?w=` is checked against the workspace address pattern and escaped by React.
- Real names: the diff uses only invented names (Juniper Vale, amber, birch, brk, fern, ogs).
- **PR #637 review fixes** (/pr-review: Approve with comments; tlc-spec-lean Verifier: FAIL on C22 and C24, now closed, `.specs/features/585-settings-admin/verification.md`):
  - the morning reading survives a Retry (above). `lib/queries/admin-page.test.ts`, 3 tests: the first check kept through a retry that read 819 after the spend; no number when the first check got none; no retry's check taken for a cut first read's;
  - C22 now bites: a workspace made at 22:30 ST, a read day behind the UTC day, keeps the roster of the read that started after it (the day before counts); and a read still running since a workspace was made is no read;
  - C24 now bites: the rendered /admin, with page errors 23 h and 25 h old, counts 1 in the nav;
  - "Nothing needs you now." has a render test (C31);
  - the unused `TRACKER_QUOTA` is gone, so `DAILY_QUOTA` is the one 1,000;
  - `alliancesOf` runs once per render (the page passes it to `Workspaces`); `needs-you.ts` matches on the `Look` type; the plan's S2 Assumptions table is one table again.
  - Breaks after the fixes: 31 mutations, all killed (the 25 above, plus: "read since" counting a running read; first read without the day before; the nav window at 48 h; the morning reading from any read day; a retry's check taken for a cut first read's; "Needs you" with no line when nothing waits). Two more are equivalent and are not counted: dropping the morning query's quota-endpoint filter, and taking the latest check instead of the first. A read's first `v1.fetch` is always its quota check (`readRosters` returns before any alliance call when it fails), and only one read's lines fall within the deadline window.

## Open issues

- To-dos: show the first open item's text beside the count (owner persona SHOULD). 25 are open today, and a release marks them done.
- Post the same "Needs you" rows in the owner's Discord admin message: one function, two outlets (product persona).
- A "no member role" gap stays while an alliance means its board to stay closed (accepted, Assumptions).
- An idle /admin tab does not refresh between tick windows, so "Late" can be stale until its next refresh (accepted).
- Analytics: no change to the tracking plan, and no new event. What to measure after release, read-only in PostHog:
  - the time from `ws_access_requested` to `admin_workspace_approved`;
  - the share of /admin sessions whose next pageview is `/admin/errors` or `/admin/changes`;
  - `$pageleave` max scroll on /admin under 640 px;
  - `$pageview` of `/admin/errors` with `?w=`.

## Next

- Model/effort: keep. Slice 2 fit one session with three reviews, two first-glance rounds and 31 mutations, plus one review round.
- What the owner must do first: nothing for slice 2. Slice 4 (F38) still waits on the owner's decision (#621).
- Plan change: none to `docs/IMPLEMENTATION_PLAN.md` or `docs/SESSION_PLAYBOOK.md`. S2's criteria were updated in `.specs/features/585-settings-admin/plan.md` (above).
- Slice 3, the /admin structure (F33): Overview, Runs, Workspaces and one page per workspace. It adds new routes (an M trigger), so it gets its own plan review: the product-strategy persona and the adversarial reviewer.

<adjustments>
- Slice 3 builds on S2's pieces, so it does not need to make them again:
  - `readWorkspaces` and `alliancesOf` (`app/_ui/admin/Workspaces.tsx`) read the workspaces once;
  - `needsYou` (`app/_ui/admin/needs-you.ts`) gives the rows;
  - `setupGaps` and `SetupGap` (`alliances-view.ts`) give the setup checklist;
  - `errorsLastDay` (`AdminShell.tsx`) gives the nav count;
  - `PageIndex` with `href` draws rows on another page.
- A `/admin/workspaces` nav item should carry the "Needs you" workspaces count (setup and key). S2 left it out because no such page existed.
- Measured on the invented seed: /admin is 10,852 px at 360 and 7,799 at 1280. Activity plus the Workspaces card are most of it, and they are what S3 moves to their own pages.
- Statement budget: /admin is now 43 statements a view, sub-pages 7-11. Keep the nav at one cheap count, not the Alliances read set: RunWatch refreshes every 4 s during a run.
- F49 (/admin/runs) and F35 (dates) are still open; F35 belongs to the words pass.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/637
