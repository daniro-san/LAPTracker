# 08 — Deploy and scheduling

Status: steps 1, 2 (workflows, config), 2b (GitHub half) and 5 are done. Steps 2 (live keepalive test), 2b (Vercel half), 3, 3b and 4 need the PR merged into `dev`, a release to `main` and the owner; they are not done. They continue in this session after the merge (follow-up message), not in Session 9.

## Built
- `.github/workflows/tick.yml`: `*/15 * * * *`, one `curl --fail --max-time 150 -X POST` with `Authorization: Bearer $CRON_SECRET`. `workflow_dispatch` input `phase` (`tick` default, `before`, `after`): `tick` calls `/api/tick`, the others call `/api/snapshot?phase=…`. `permissions: {}`, no retry.
- `.github/workflows/dependabot-automerge.yml`: runs for `dependabot[bot]`, skips `version-update:semver-major`, runs `gh pr merge --auto --squash`. Uses `dependabot/fetch-metadata` v3.1.0 pinned by SHA.
- `.github/workflows/keepalive.yml`: monthly (`0 6 1 * *`) and manual; writes a UTC timestamp to `.keepalive`, commits, `git push --force origin HEAD:keepalive`. `permissions: contents: write`, checkout pinned by SHA, no third-party commit action.
- `vercel.json`: `git.deploymentEnabled.keepalive: false`.
- `.github/dependabot.yml`: `target-branch: dev` on both ecosystems (it was missing).
- `README.md`: "Deploy and operate" section (deploy, secrets, workflows, alliance list, snapshot times, key/PIN rotation, manual runs, rehearsal). Removed the stale "Status: scaffold … Nothing collects data yet" line.

## Decisions
- `tick.yml` dispatch default is `tick`, so `gh workflow run tick.yml` exercises the same path as the schedule (step 4).
- Auto-merge decides on `fetch-metadata`'s `update-type`. For a grouped PR this is the highest bump in the group.
- `permissions: {}` on tick: the job reads only repository secrets.

## Deviations
- Task 2b says `main` lists `required_linear_history`. It does not, and must not: `main` takes merge commits only (plan §11.6), which a linear-history rule forbids. `dev` has it.
- Task 3: `v0.1.0` already exists (tag on `main`, released 2026-11-04T21:31:31Z; PR #10). Step 3 as written (first release) is superseded. The next release is a new version, to be agreed with the owner.
- Workflow files exist only on this branch. `gh workflow run` works only for workflows on the default branch (`main`), so tick and keepalive cannot be run until a release.

## Verified
- `pnpm check`: 26 files passed, 1 skipped; 101 tests passed, 1 skipped. Prettier clean on the workflows, `vercel.json` and README.
- Workflow YAML parses (`yaml.safe_load`). `actionlint` is not installed; no other validator was run.
- Repo settings (`gh api repos/daniro-san/LAPTracker`): `allow_squash_merge true, allow_merge_commit true, allow_rebase_merge false, delete_branch_on_merge true, allow_auto_merge true`.
- `rules/branches/main`: `deletion`, `non_fast_forward`, `pull_request` (`allowed_merge_methods: ["merge"]`, 0 approvals), `required_status_checks` (`check`).
- `rules/branches/dev`: `deletion`, `non_fast_forward`, `required_linear_history`, `pull_request` (`allowed_merge_methods: ["squash"]`), `required_status_checks` (`check`).
- Repository secrets present: `APP_URL`, `CRON_SECRET`.
- Vercel env comparison (Production vs Preview, no `NOTIFY_*` in Preview) and preview Authentication: not checked. The Vercel connector returned 403 until the owner approves team access.
- Not run: keepalive test, tick 204, idempotence, release, deployed-app checks, maxDuration, rehearsal, Friday message. Upstream API calls this session: 0.

## Open issues
- The `dev` → `main` gap: the workflows only become active after a release to `main`.
- Owner must approve Vercel team access for the connector (single-use link) or paste `vercel env ls` output.
- Task 3b: GET `/api/quota` spends 1 upstream call; not run.
- Drift gate and `import-x/no-restricted-paths` zones from the playbook's owner-supplied Session 8 adjustments were not in this prompt and were not done (`eslint.config.mjs` has no zones).

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal; nothing measured yet because the deploy steps are still open.
Owner must do first: merge this PR into `dev`; approve the Vercel team access; choose the release version; merge the release PR with a merge commit; run the rehearsal and the quota-check steps with Claude in this session before Session 9.
Plan changes needed: §11.6 / Phase 6: `main` has no `required_linear_history` (it takes merge commits). Phase 6: `v0.1.0` already exists, so "first release" in Session 8 step 3 needs a new number.

<adjustments>
- Run `gh` with `GH_TOKEN=$(gh auth token --user daniro-san)`; the default account cannot list secrets or open PRs.
- `tick.yml` is dispatched with `gh workflow run tick.yml` (default `phase=tick`) or `-f phase=before|after`.
- The Session 9 rehearsal is only meaningful once the Session 8 step 4 scheduler proof has passed.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/40
