# 08zq — Release ops

## Built
- `.github/workflows/smoke.yml`: triggers `status` and `workflow_dispatch`. The job runs on a dispatch, or when the status context is `Vercel`, the state is `success` and `github.event.sha == github.sha`. It sends `GET` to `$APP_URL/` and `$APP_URL/players`, prints each path and HTTP code, and exits 1 if any code is not 2xx or curl fails. No retries, no alert. `permissions: {}`, `timeout-minutes: 5`, `curl --max-time 30`. The step checks both paths before failing, so a red run shows both codes.
- `CONTRIBUTING.md`: one bullet for `smoke.yml` in the Workflows list.
- `docs/DECISIONS.md` D46: smoke check and why the trigger differs from the decision of 2026-11-06; auto-merge of the release PR declined; 504s count against the quota and the maintainer is not asked.

## Decisions
- D46 sits directly after D45, not at the end of the file. Session 08zv appends D47 at the end; two appends at the same place would conflict when the owner merges.
- CONTRIBUTING.md: only the Workflows list changed. Session 08zv edits Setup and the Scripts table of the same file.
- The step loops over both paths and fails at the end, instead of stopping at the first bad path. Assumption: the owner wants both codes in the log.
- The 504 / quota sentence cites README.md and docs/IMPLEMENTATION_PLAN.md §4 (the task said line 133, which is in §4).

## Deviations
- The trigger is not the one in the decision of 2026-11-06 (`deployment_status`, `/events`). The owner changed it on issue 128 on 2026-11-11: `on: status`, `/players`, plus `workflow_dispatch`. D46 records why.

## Verified
- YAML parse, PyYAML: `['status', 'workflow_dispatch'] github.event_name == 'workflow_dispatch' || (github.event.context == 'Vercel' && github.event.state == 'success' && github.event.sha == github.sha)`. Ruby `YAML.load_file(".github/workflows/smoke.yml").keys` printed `["name", true, "permissions", "jobs"]` (`on` reads as `true` in YAML 1.1; GitHub reads it as `on`).
- Shell step extracted from the YAML and run against a throwaway `python3 -m http.server` on port 3128 (stopped afterwards; a curl to 3128 now fails):
  - `/` 200 and `/players` 200: `/ -> HTTP 200`, `/players -> HTTP 200`, exit 0.
  - `/` 200 and `/players` 404: `/ -> HTTP 200`, `/players -> HTTP 404`, exit 1.
  - nothing listening (port 3199): `/ -> curl failed`, `/players -> curl failed`, exit 1.
- `pnpm check`: exit 0; Test Files 54 passed | 1 skipped; Tests 246 passed | 1 skipped; drift "Everything's fine"; i18n "17 languages up to date with English".
- Not verified: the `if:` expression and the `status` payload fields (`context`, `state`, `sha`) were not run on GitHub. No workflow linter is installed. The workflow runs only from the default branch, so the first real run is the next production deploy after a release carries it to `main`. Nothing was run against production.

## Open issues
- Until a release carries the file to `main`, the workflow does nothing. After that release, run Actions → smoke → Run workflow once to see it work by hand.
- A `status` event also fires for other contexts and for `dev` deploys; the `if:` skips them, but each shows as a skipped run in the Actions tab.
- Vercel authors the status, so GitHub sends no failure email; the signal is the Actions tab (accepted by the owner).
- CONTRIBUTING.md:39 and D30 say GitHub's schedule "has never started a run"; the triage found 22 successful scheduled runs of tick.yml since 2026-11-05. Not changed here.
- TypeScript 7 pin: issue 144, out of scope.

## Next
Session: 08zzy-decisions-split (issue 127)
Model / effort: keep (sonnet · medium) — this session needed no more than that and the split is a mechanical move of text.
Owner must do first: merge this PR and 08zv (D47) into `dev`, and make sure no other open PR edits docs/DECISIONS.md.
Plan changes needed: none

<adjustments>
- D46 exists, placed directly after D45 (before D52), not at the end of the file. The split must keep D46 in the same numeric order as the other entries.
- Entries are not in numeric order in the file (D48, D49 come before D43; D52, D53 after D45). Check the order before moving entries.
- 08zv appends D47 at the end of docs/DECISIONS.md; both must be on `dev` before the split starts (D46, D47).
- smoke.yml and the CONTRIBUTING.md Workflows bullet cite "D46"; keep the reference valid in the split.
</adjustments>
