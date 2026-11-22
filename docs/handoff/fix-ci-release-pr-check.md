# fix/ci-release-pr-check

## Built
- `ci.yml`: `pull_request` runs for PRs into `dev` and `main` again, so the release PR gets its own `check`.
- `release-prepare.yml`: no longer starts a Run workflow of `ci` on `dev` (the e2e dispatch stays).
- CONTRIBUTING release step 4 and the CI line: approve the release PR's held `ci` run, then merge with `--match-head-commit`.
- `.claude/settings.json`: the `actions/runs/*/approve` allow rule is back; the `gh workflow run ci.yml --ref dev` allow is gone.
- D29: dated amendment.

## Decisions
- Keep one `ci` run per release by dropping the dispatch rather than the release PR's own run: only a `pull_request` run counts toward the PR's required checks.

## Deviations
None.

## Verified
- The v5.46.0 release PR (#611) stayed `BLOCKED` with a green `check` from the Run workflow on its head commit: GraphQL `statusCheckRollup` listed only the Vercel contexts, and the check suite (event on `dev`) was linked to #611 but not counted.
- `pnpm check` and JSON parse of `.claude/settings.json`.

## Open issues
- #602's handoff and the CI/CD audit report (R1) state the dispatch `check` satisfies the ruleset; this PR corrects that.

## What was missing from the task prompt?
The audit's R1 was verified only by the presence of the check run on the SHA, not by a merge.

## Next
Close #611, run Prepare release again after this merges, approve the held `ci` run, merge.

https://github.com/daniro-san/LAPTracker/pull/613
