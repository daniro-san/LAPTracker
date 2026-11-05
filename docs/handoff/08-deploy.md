# 08 — Deploy and scheduling

Status: done, except the Friday quota message (step 5 of the task list, not run) and the idempotence proof as written (replaced, see Verified). Updated 2026-11-05 after the follow-up work in this session; the first version of this file was PR #40.

## Built
- `.github/workflows/tick.yml`: cron `7,22,37,52 * * * *` and `curl -sS --max-time 150 -X POST` that fails on any non-2xx (D26, PR #73; first version `*/15` with `--fail`), with `Authorization: Bearer $CRON_SECRET`. `workflow_dispatch` input `phase` (`tick` default, `before`, `after`): `tick` calls `/api/tick`, the others call `/api/snapshot?phase=…`. `permissions: {}`, no retry.
- `.github/workflows/dependabot-automerge.yml`: runs for `dependabot[bot]`, skips `version-update:semver-major`, runs `gh pr merge --auto --squash`. Uses `dependabot/fetch-metadata` v3.1.0 pinned by SHA.
- `.github/workflows/keepalive.yml`: monthly (`0 6 1 * *`) and manual; writes a UTC timestamp to `.keepalive`, commits, `git push --force origin HEAD:keepalive`. `permissions: contents: write`, checkout pinned by SHA, no third-party commit action.
- `vercel.json`: `git.deploymentEnabled.keepalive: false`.
- `.github/dependabot.yml`: `target-branch: dev` on both ecosystems (it was missing).
- `README.md`: "Deploy and operate" section (deploy, secrets, workflows, alliance list, snapshot times, key/PIN rotation, manual runs, rehearsal). Removed the stale "Status: scaffold … Nothing collects data yet" line. Follow-up PR: "Scheduler" paragraph for cron-job.org and the three-place `CRON_SECRET` rotation.
- Releases `v0.2.0` and `v0.2.1` (PRs #41 and #74). Production deployed from `main` at f5b84fb (v0.2.1).
- cron-job.org job "Vercel Ticker": the scheduler (D30).
- Other sessions started from this one and merged into `dev`: admin run copy (#43), run finish time (#44), collector deadline (#72, D25), upstream status banner (#75, D27), manual rounds (#77, #78, D28), release workflows (#79, #81, D29).

## Decisions
- `tick.yml` dispatch default is `tick`, so `gh workflow run tick.yml` exercises the same path as the schedule (step 4).
- Auto-merge decides on `fetch-metadata`'s `update-type`. For a grouped PR this is the highest bump in the group.
- `permissions: {}` on tick: the job reads only repository secrets.
- cron-job.org is the scheduler and GitHub's schedule is not relied on (D30). The tick is idempotent, so both callers can stay.
- A Before for the Saturday event stays refused before `before_at`. Weekday data goes into a manual round (D28), which the tick never runs.
- Suggested for later and not built here: a tick log table shown in `/admin`; an alert when no tick arrived for an hour; editable event name and date; a single Run button that picks the phase; Session 8b (avatars) can start a session for the tick log.

## Deviations
- Task 2b says `main` lists `required_linear_history`. It does not, and must not: `main` takes merge commits only (plan §11.6), which a linear-history rule forbids. `dev` has it.
- Task 3: `v0.1.0` already exists (tag on `main`, released 2026-11-04T21:31:31Z; PR #10). Step 3 as written (first release) is superseded. The next release is a new version, to be agreed with the owner.
- Workflow files exist only on this branch. `gh workflow run` works only for workflows on the default branch (`main`), so tick and keepalive cannot be run until a release.
- Task 4 asked for a scheduler proof on GitHub's schedule. GitHub started no scheduled run at all (zero `schedule` events since 2026-11-05 10:05 UTC), so the scheduler is cron-job.org (D30) and the proof was made with a rehearsal on that path.
- Task 4's idempotence proof (two back-to-back `gh workflow run` calls inside a window) was not run. The cron-job.org job called the tick several times inside the rehearsal's Before window and the database holds one snapshot per phase.
- `APP_URL` pointed at an address that redirects. The first manual tick returned HTTP 308 and the run was green (`curl --fail` accepts 3xx). The secret now holds `https://laptracker-inky.vercel.app` (owner approved) and the workflow fails on any non-2xx (D26).
- The first Before (a manual rehearsal on 2026-11-05 11:06 UTC) stayed `running` because the upstream answered 504 after ~46 s on every alliance read and Vercel stopped the function at 120 s. The collector now closes the snapshot as partial at 100 s (D25). The stuck event 1 and its rows were deleted from Neon (member_snapshots, alliance_snapshots, run_logs, snapshots, event) with the owner's approval.

## Verified
- `pnpm check`: 26 files passed, 1 skipped; 101 tests passed, 1 skipped. Prettier clean on the workflows, `vercel.json` and README.
- Workflow YAML parses (`yaml.safe_load`). `actionlint` is not installed; no other validator was run.
- Repo settings (`gh api repos/daniro-san/LAPTracker`): `allow_squash_merge true, allow_merge_commit true, allow_rebase_merge false, delete_branch_on_merge true, allow_auto_merge true`.
- `rules/branches/main`: `deletion`, `non_fast_forward`, `pull_request` (`allowed_merge_methods: ["merge"]`, 0 approvals), `required_status_checks` (`check`).
- `rules/branches/dev`: `deletion`, `non_fast_forward`, `required_linear_history`, `pull_request` (`allowed_merge_methods: ["squash"]`), `required_status_checks` (`check`).
- Repository secrets present: `APP_URL`, `CRON_SECRET`.
- Vercel access was approved by the owner; production deployments of `main` were read through the Vercel connector (v0.2.1, commit f5b84fb).
- keepalive: run by hand; commit 4f76f724 on branch `keepalive`; Vercel made no deployment for it.
- `maxDuration`: a tick that ran past the limit was answered with 504 at 121.6 s, so the 120 s limit is honoured.
- Rehearsal on 2026-11-05 (event 5), started from `/admin`, Before due 20:26 UTC and After due 20:56 UTC: Before ran at 20:30:15, After at 21:00:21 UTC, both started by the cron-job.org ticks, both `complete`, 20 alliances from `/v1` each, 0 stale, 21 calls each, 10.9 s and 10.4 s, quota 948 then 927 remaining. The admin "Last rehearsal" block shows Pass on all six checks. The two admin Discord messages were not pasted into this handoff.
- A Before pressed on `/admin` for the Saturday event (due 2026-11-07 12:00 UTC) returned `snapshot_not_due` (409). `executeSnapshot` refuses every run before `before_at`, force included (`lib/run.ts`).
- Not run: Friday quota-check message (`QUOTA_CHECK_AT`), `GET /api/quota` (spends 1 call).
- Upstream API calls from this session: about 6 single probes during the outage (all 504 or 502 except the last), one probe at 18:38 UTC (200 in 3.3 s), plus the rehearsal's 42.

## Open issues
- Friday quota-check message not tested. `claimQuotaCheck` claims it once on the coming Saturday's event row (`events.quota_checked_at`); a test now would use up the real Friday message unless that column is cleared after the test. The test also needs `QUOTA_CHECK_AT` set a few minutes ahead in Vercel and a production redeploy.
- Task 3b: GET `/api/quota` spends 1 upstream call; not run.
- GitHub's schedule never started a run (D30). Cause unknown; a GitHub support ticket is an option. `tick.yml` still carries its schedule.
- No record that a tick call arrived. cron-job.org's History is the only evidence; a tick log table (one row per call, shown in `/admin`) and an alert after an hour without a tick are suggestions.
- The upstream returned 504 on every keyed alliance read from about 02:00 to 18:30 UTC on 2026-11-05 and each failed call counts against the 1,000 per day. A question to the maintainer: can 504s stop counting? A separate key per environment is not possible (one key per account).
- Editable event name and date, and a manual Run now for the Saturday event, were requested by the owner: manual rounds (D28) cover the weekday case; the Saturday event stays refused before `before_at`.
- `lib/queries/players.test.ts` times out in `beforeAll` (10 s) when `pnpm check` runs under load; it passes alone in 1.4 to 2.2 s. A larger `hookTimeout` would fix it; not changed.
- Drift gate and `import-x/no-restricted-paths` zones from the playbook's owner-supplied Session 8 adjustments were not in this prompt and were not done (`eslint.config.mjs` has no zones).

## Next
Session: 9 — Dry run against production
Model / effort: keep (opus, high). The run on 2026-11-05 took 10.4 to 10.9 s for 20 alliances with 21 calls each, far under the 120 s limit, so nothing measured argues for lowering or raising it.
Owner must do first: merge this PR into `dev`; merge the pending PRs for the manual round, the admin layout and the release workflows into `dev`, and cut a release so production carries them; choose a weekday that is not Friday or Saturday.
Plan changes needed: §3.1 and Phase 6: the scheduler is cron-job.org (D30), not GitHub's schedule. §11.6 / Phase 6: `main` has no `required_linear_history` (it takes merge commits). Session 8 step 4's idempotence proof as written (two `gh workflow run` calls) is replaced by the rehearsal evidence in Verified.

<adjustments>
- Run `gh` with `GH_TOKEN=$(gh auth token --user daniro-san)`; the default account cannot list secrets or open PRs.
- `tick.yml` is dispatched with `gh workflow run tick.yml` (default `phase=tick`) or `-f phase=before|after`.
- A rehearsal already passed on 2026-11-05 (event 5, scheduled by cron-job.org): Before 20:30:15 and After 21:00:21 UTC, both `complete`, 20/20 fresh from `/v1`, 21 calls each, 10.9 s and 10.4 s, quota 948 then 927. Session 9 step 1 can reuse event 5's rows for the step 2 table; a second rehearsal is optional and costs about 42 calls.
- The ticks in the rehearsal started 4 minutes after each due time (cron-job.org every 15 minutes, jitter up to 20 s), inside the 45 minute window.
- The upstream had a 17-hour 504 outage on 2026-11-05; the collector now closes a run as partial at 100 s (D25) and `/` shows a banner when the last run failed upstream (D27). Step 4's 503/504 count should read `run_logs` for the whole day, outage included.
- `/admin` refuses a Before for the Saturday event before its `before_at` (`snapshot_not_due`), force included. A manual round (D28) is the way to run on a weekday.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/83
