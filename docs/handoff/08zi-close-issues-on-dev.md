# 08zi — Close linked issues when a PR merges into `dev`

## Built
- `.github/workflows/close-issues.yml`. Trigger: `pull_request` `closed` on base `dev`; the job runs only if `github.event.pull_request.merged == true`. Permissions: `contents: read`, `issues: write`. `ubuntu-latest`, `timeout-minutes: 5`, no `actions/checkout`, no third-party action (only `jq` and `gh`, both preinstalled on the runner).
- Parsing: `jq` reads `.pull_request.title` and `.pull_request.body` from `$GITHUB_EVENT_PATH` and scans them with `(?i)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?[ \t]+([\w.-]+/[\w.-]+)?#([0-9]+)\b`. A ref is kept when it has no `owner/repo` prefix or the prefix equals this repository (case-insensitive); any other prefix is logged as "another repository". Numbers are de-duplicated.
- Per issue: `gh api repos/$GH_REPO/issues/N`. Not found → skip; a pull request → skip; closed → skip; any other API error → `::error::`, the remaining refs are still handled, and the run fails at the end. An open issue gets the comment ``Closed by #PR (merged into `dev`)`` unless a comment with exactly that line already exists, then `gh issue close N --reason completed`. Every decision is printed and also written to the job summary.

## Decisions
- The title and body never pass through `${{ }}` or an env var into the shell: `jq` reads them from the event file. Only the PR number and repository name come from `${{ }}`, via `env`.
- `jq`'s `scan` (Oniguruma) instead of `grep -E`: `\b` and `(?i)` behave the same on the Ubuntu runner and on macOS, so the local dry run tests the same regex.
- Keyword must be followed by a colon or spaces/tabs on the same line, then `#N`. So `(#103)` in a squash title, `closes#70`, `prefix #91` and `#12abc` do not match. As on GitHub, each keyword takes one issue: `Fixes #1, #2` closes only #1.
- Re-run safety: closed issues are skipped, and before commenting the workflow reads the issue's comments (`--paginate`) and looks for the exact comment line, so a re-run after a failed close does not comment twice. The comments are read into a variable before `grep`, so `pipefail` cannot turn an early `grep -q` exit into "not found".
- `gh` gets `GH_REPO`, so no checkout is needed, the same way `release-*.yml` do it.

## Deviations
- None from the task.

## Verified
- `actionlint` 1.7.12 (installed with `brew`, nothing added to the repo; it also runs `shellcheck` on the `run:` block): no findings for the new file or the other six workflows. YAML read back with Ruby: `on.pull_request = {types: [closed], branches: [dev]}`, `permissions = {contents: read, issues: write}`, job `if` as above.
- Dry run of the real script: the `run:` block was extracted from the YAML with Ruby and run with bash against event files built from `gh pr view <n> --json number,title,body`. A `gh` stub sent read-only `gh api` GETs to the real API and only printed `gh issue comment` / `gh issue close` (it refused any other write). No issue was commented on or closed from this machine.

```
===== event 103 (PR #103)        body ends with "Closes #56"; also "the PR for #55", "fix that plan §10b"
Skip #56: already closed.
exit=0
===== event 112 (PR #112)        "Closes #58"
Skip #58: already closed.
exit=0
===== event 115 (PR #115)        title "… (#26, #27)", body "Closes #26" / "Closes #27", heading "(#26, #27)", "<adjustments for="#60 translation">"
Skip #26: already closed.
Skip #27: already closed.
exit=0
```

Crafted event, PR #999, title `chore: crafted test (#99)`, body:

```
fixes #57
Resolved: #94
Closes daniro-san/laptracker#106
Fixes vercel/next.js#123
See #60 for context, and the PR for #55.
prefix #91 and closes#70 and closes #12abc
Fixes #99
Closes #9999
```

```
WOULD RUN: gh issue comment 106 --body Closed by #999 (merged into `dev`)
WOULD RUN: gh issue close 106 --reason completed
Closed #106.
WOULD RUN: gh issue comment 57 --body Closed by #999 (merged into `dev`)
WOULD RUN: gh issue close 57 --reason completed
Closed #57.
Skip #94: already closed.
Skip #99: a pull request, not an issue.
Skip #9999: not found.
Skip vercel/next.js#123: another repository.
exit=0
```

(#57 and #106 are real open issues; #94 a real closed issue; #99 a real PR. The title's `(#99)`, the plain `#60`/`#55`, `prefix #91`, `closes#70` and `#12abc` produced nothing.)

Three more cases with a second stub that faked two responses:

```
===== event rerun (PR #998)      title "fix #57 again", body null; #57's comments already hold the line
#57 already has the comment.
WOULD RUN: gh issue close 57 --reason completed
Closed #57.
exit=0
===== event err (PR #997)        title "feat: x (#57)", body "Closes #777\nfixes #60"; #777 lookup faked as HTTP 502
WOULD RUN: gh issue comment 60 --body Closed by #997 (merged into `dev`)
WOULD RUN: gh issue close 60 --reason completed
Closed #60.
::error::Could not read #777: gh: Server Error (HTTP 502)
exit=1
===== event none (PR #996)       title "docs: y (#60)", body "Mentions #57 and #106 only."
PR #996 names no issue with a closing keyword. Nothing to do.
exit=0
```

- `pnpm check`: prettier, eslint and tsc pass; `scripts/check-drift.ts` run on its own passes. Vitest failed twice in the full run with `Hook timed out in 10000ms` in `openTestDb()` for a different set of `lib/queries/*.test.ts` files each time (2, then 4). Those four files pass when run alone (4 files, 14 tests). The machine's load average was 27 (other sessions running), and this branch changes no TypeScript. CI on this PR is the clean full run.
- Not verified: a run on GitHub. The first real run happens when a PR merges into `dev` with this file in its merge ref. That includes this PR's own merge (a `pull_request` run takes the workflow file from the PR's merge ref, not from `main`), which names no issue, so it should log "names no issue … Nothing to do."

## Open issues
- What the owner should look for in the Actions tab: a `close-issues` run for each PR merged into `dev` (closed-without-merge PRs show the job as skipped). The run's summary lists one line per ref: `Closed #N.`, `Skip #N: already closed.`, `Skip #N: not found.`, `Skip #N: a pull request, not an issue.`, `Skip owner/repo#N: another repository.`, or "names no issue". On the issue: a comment from `github-actions[bot]` with ``Closed by #PR (merged into `dev`)`` and the state "Closed as completed". A red run means an API error; it is safe to re-run.
- Not matched, though GitHub honours them on the default branch: a full issue URL after a keyword (`Fixes https://github.com/daniro-san/LAPTracker/issues/N`). None of the PRs read here use that form.
- Keywords inside code blocks or quotes are matched too.
- A PR from a fork gets a read-only token on `pull_request`, so the close would fail with an error. The repo has no fork PRs today.
- PRs merged by `GITHUB_TOKEN` (the Dependabot auto-merge) do not trigger workflows, so this does not run for them. Dependabot PRs do not name this repo's issues anyway.
- The owner's 2026-11-05 choice (a workflow instead of making `dev` the default branch) is not recorded in `docs/DECISIONS.md`; the task did not ask for it. Add a D-entry if wanted.
- After this merges, the "close issues by hand after a PR into `dev`" step is no longer needed, except for issues closed by a full URL ref or by a fork PR.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches only CI; no app code, collector, cron path or quota.
Owner must do first: merge this PR into `dev`. No migration, no environment variable, no repository setting.
Plan changes needed: none.

<adjustments>
- From the next merge into `dev` on, `Closes #N` in a PR body closes issue #N; no session needs to close its issues by hand. Check the issue after the merge only if the `close-issues` run is red.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/116
