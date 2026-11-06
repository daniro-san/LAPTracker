# 08zt — Tick heartbeat and no-tick alert (#121)

## Built
- **Migration 0011** (`drizzle/0011_bored_ezekiel.sql`, from `pnpm db:generate`):
  - creates `tick_log` (`id` serial, `started_at` not null, `finished_at`, `outcome`);
  - drops `app_alerts_single_row_check`.
- **`lib/repo/ticks.ts`:**
  - `startTick(db, at)` inserts a row and returns its id. It also deletes everything older than the newest `MAX_TICK_LOG = 700` rows, the same way `insertAppError` does.
  - `finishTick(db, id, at, outcome)`.
  - `latestTickAt(db)`.
- **`app/api/tick/route.ts`:** after `authorize` and the query check pass, `startTick` runs before `runTick`. After `runTick`, `finishTick` stores `tick.kind`.
- **`lib/repo/app-errors.ts`:** `claimAlert(db, id, now, gapMs)` is the one `insert … on conflict do update … where` statement, with `APP_ERROR_ALERT = 1` and `TICK_SILENCE_ALERT = 2`. `claimAppErrorAlert(db, now, gapMs)` calls it with id 1. `lib/app-errors.test.ts` is unchanged and passes.
- **`lib/tick.ts` `watchTicks(ctx, db)`:**
  1. If the newest tick started 60 min ago or less, it does nothing.
  2. Otherwise it claims alert 2 with a 60 min gap.
  3. The call that wins the claim posts `tickSilenceMessage` to the admin webhook.

  `TICK_SILENCE_MS = 60 * 60_000`.
- **`app/api/tick/watch/route.ts`:** `POST`, cron auth through the same `authorize(… { cron: true, pin: false })` as the tick. It rejects any query string, calls `watchTicks` and answers 204. No `maxDuration`, because it makes one or two DB calls and at most one Discord call (5 s timeout).
- **Admin message** (`lib/copy-discord.ts`, `lib/notify.ts` `tickSilenceMessage`):
  - `⚠ No tick for {min} min (last {at}). Check the cron-job.org job and CRON_SECRET · /admin`;
  - `⚠ No tick recorded yet. Check the cron-job.org job and CRON_SECRET · /admin` when there is no row.
- **/admin Status** (`app/(pages)/admin/page.tsx`): a "Last tick" fact.
  - Value: the newest tick's start, from `clock.stamp` (server time with the word).
  - Note: "Newest first: …" with the last five outcomes as words (nothing due, snapshot, quota check, rehearsal, no end).

  Read through `recentTicks(db)` in `lib/queries/admin.ts`. The words are in `lib/copy-admin.ts`; admin copy is English only (D48).
- `lib/db.test-helpers.ts` `truncateAll` also truncates `tick_log`.
- **Tests:**
  - In `app/api/tick/route.test.ts`:
    - an idle tick writes `{ startedAt, finishedAt, outcome: "idle" }`;
    - a tick with the wrong secret answers 401 and writes no row.
  - In the new `app/api/tick/watch/route.test.ts`:
    - watch at 61 min posts exactly one admin message ("No tick for 61 min"), and a second watch at 70 min posts nothing;
    - watch at 30 min posts nothing.
- **D45.** It also supersedes D30's "Not done" line.

## Decisions
- **When the heartbeat is written.** After the query check as well as `authorize`, right before `runTick`. A tick with a stray query string answers 400 and does no work, so it is not a heartbeat either. The decision said "after `authorize` succeeds, before `runTick`", and both checks come before `runTick`.
- **`claimAppErrorAlert` stays as a one-line wrapper.** That keeps its callers and its test unchanged, as the decision asked: "without changing its behaviour; its existing tests must still pass".
- **`watchTicks` lives in `lib/tick.ts`, not in the route.** The route stays auth, parse, call lib, respond (docs/ARCHITECTURE.md). The tick route calls `startTick` and `finishTick` directly: the decision places the insert in `route.ts`, and `app → lib/repo` is allowed.
- **No chip for a silent scheduler on /admin.** The decision asks for the time and the last outcomes. The Discord alert is what says "silent".

## Deviations
- **The branch is cut from `session/08zs-data-correctness` (#150).** #150 is not merged, and this branch shares `lib/sources/v1.ts`, `lib/collector.ts` and `lib/queries/admin.ts` with it. #148 (#120) is merged into `dev`; `dev` (through `a613d14`) was merged into both branches. Until #150 merges, this PR's diff also shows #150's commit. The PR body says so. Merge #150 first.

## Verified
- `pnpm check` on Node 26.5.0 (see the PR body for the final run): prettier, eslint, tsc, vitest, `check-drift` (the drift gate generates nothing new: 0011 matches `lib/schema.ts`), `drizzle-kit check` and i18n-check.
- Mutation pass. Each mutation was applied and reverted by a script, and each made its test fail:
  - the gap comparison (60 → 120 min) fails the 61/70 min test;
  - the comparison flipped fails the 30 min test;
  - the claim replaced by `true` makes the 70 min watch post a second message and fails the 61/70 min test;
  - `startTick` moved before `authorize` fails the 401 test;
  - the `startTick` call removed fails the heartbeat test.
- `lib/app-errors.test.ts` passes unchanged after the claim was generalised.
- /admin: checked by `tsc` and eslint only. The worktree has no `.env.local`, and the server validates its environment at start, so the page was not rendered here. Look at Status on the preview or production /admin after release.
- No upstream call, no webhook, no Neon: PGlite and the fake fetch only.

## Open issues
- **A false alarm after release is possible.** The first watch call after the release that applies 0011 alerts "No tick recorded yet" if no tick has run since the release. Add the watch job after the first tick (within 15 min of the release).
- **A cron-job.org-wide outage stops both jobs.** This is accepted in D45; cron-job.org emails on its own failures.
- **The docs do not mention the watch job yet.** I left them out because it was not asked; the `<adjustments>` below give the lines:
  - `CONTRIBUTING.md:39` (Scheduler) describes only the Ticker job;
  - `CONTRIBUTING.md:51` (rotation) names one cron-job.org header;
  - README's list of Discord messages does not have the tick-silence alert.
- **Each authorised tick costs two more small DB writes** (insert plus cap check, then the update). At 96 ticks a day this is negligible.

## Owner must do first
1. Merge #150 first, then this PR.
2. Release to `main` **after** the scheduled event of 2026-11-07. This PR carries migration 0011, and the #49 cutoff allows no migration before then. The Vercel build applies 0011.
3. After the first tick has run on the release (check /admin "Last tick"), add a second job on cron-job.org:
   - Title: e.g. "Vercel Tick Watch"
   - URL: `https://laptracker-inky.vercel.app/api/tick/watch`
   - Method: `POST`
   - Schedule: every 15 minutes
   - Header: `Authorization: Bearer <CRON_SECRET>` (the same secret as the "Vercel Ticker" job; not repeated here)
   - Expected answer: `204 No Content`. A `401` means the secret differs from Vercel Production.

   A `CRON_SECRET` rotation (D30) now has four places to change: Vercel Production, the GitHub secret, and both cron-job.org jobs.

## Next
Session: none numbered after 10 in `docs/SESSION_PLAYBOOK.md` (Session 10 merged as #149). The candidate follow-up is a short docs change for the watch job, after the owner has created it.
Model / effort: not applicable.
Owner must do first: the three steps under "Owner must do first" above.
Plan changes needed: none. D45 supersedes D30's "Not done" line.

<adjustments>
- `CONTRIBUTING.md:39` (Scheduler) should name two cron-job.org jobs: "Vercel Ticker" (`POST /api/tick`) and the watch job (`POST /api/tick/watch`, every 15 min). Both send `Authorization: Bearer <CRON_SECRET>`, and both should show `204 No Content` in their History.
- `CONTRIBUTING.md:51` (rotation): a `CRON_SECRET` rotation changes Vercel Production, the GitHub secret, and the header of **both** cron-job.org jobs.
- README, the Discord messages list: "⚠ No tick for N min (last …)" means the scheduler stopped calling the app, or its secret is wrong. It repeats at most once an hour while ticks are missing. /admin → Status → "Last tick" shows the newest tick time and what the last five did.
</adjustments>
