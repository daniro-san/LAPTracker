# 08j — Release workflows

## Built
- `.github/workflows/release-prepare.yml`: `workflow_dispatch` with input `bump` (patch | minor | major, default patch). Refuses when a release PR (`dev → main`) is open, or when `dev` has no commits beyond `main`. Reads the latest strict `vX.Y.Z` tag, computes the next version, generates notes with `releases/generate-notes` (`tag_name`, `target_commitish: dev`, `previous_tag_name`) and opens the PR titled `release: vX.Y.Z` with the notes as body. Permissions: `contents: write` (the generate-notes POST needs it; nothing pushes, tags or merges), `pull-requests: write`.
- `.github/workflows/release-publish.yml`: on push to `main`, if the commit message has `release: vX.Y.Z` at the start of a line, creates the tag and the GitHub Release (`gh release create vX.Y.Z --target $GITHUB_SHA --title vX.Y.Z --generate-notes`). Does nothing if the tag exists. Permissions: `contents: write`. Serialised by a concurrency group.
- README "Deploy" paragraph: Actions → Prepare release → review → Merge (merge commit) → tag and release appear; the by-hand fallback is kept in one sentence.
- `docs/DECISIONS.md` D29.

## Decisions
- Publish matches `release: vX.Y.Z` at the start of any line, not only the first. The repo's `merge_commit_title` is `PR_TITLE` and `merge_commit_message` is `BLANK`, so the merge commit's first line is already `release: vX.Y.Z (#N)`; the any-line match also covers GitHub's default message, where the title is on line 3.
- The tag is created on `$GITHUB_SHA` (the pushed merge commit), not on `main`, so a later push cannot move it.
- Tag existence is checked with `git/ref/tags/<tag>` (exact), not `matching-refs` (prefix: `v0.3.1` would match `v0.3.10`). A non-404 error fails the run instead of being read as "absent".
- No `actions/checkout`: both workflows use only the API and `gh`, so no repo code is fetched or run.
- `default_workflow_permissions` stays `read`; permissions are declared per workflow.

## Deviations
- **Repository setting NOT changed.** The task authorised turning on "Allow GitHub Actions to create and approve pull requests". My `PUT /repos/daniro-san/LAPTracker/actions/permissions/workflow` call was refused by the session's permission classifier, so I did not retry or work around it. Current state, read before the attempt: `default_workflow_permissions: read`, `can_approve_pull_request_reviews: false`. Nothing about the repository was changed in this session. Until the owner turns it on, `release-prepare` fails at `gh pr create` (after the checks and the notes call, so it has no partial effect). Owner action: Settings → Actions → General → Workflow permissions → tick "Allow GitHub Actions to create and approve pull requests" (leave "Read repository contents and packages permissions" selected). Or tell me to retry and approve the call.
- The task says "head commit message starts with `release: v`". The workflow job `if` is `contains(…, 'release: v')`, and the step then requires the strict pattern at a line start (see Decisions).

## Verified
- **Required check on a bot-opened PR.** Rulesets read through the API: `main` requires `check` with `integration_id 15368` (GitHub Actions), merge commits only, no bypass actors. The head of `dev` (0779997) has a completed `check` run from `github-actions` with conclusion `success` (from the `ci` push run). A required status check is read from the head SHA, so the PR shows it green without a `pull_request` run. This was read from the API for a real commit; it was not observed on a bot-opened PR, because no PR can be opened yet. Watch the first one: if `check` shows "Expected — waiting", the newest push to `dev` has no finished `check` run (cancelled by `ci`'s `cancel-in-progress`, or still running). Wait for the run on `dev` and re-open.
- **`generate-notes`:** called for real with `tag_name=v0.2.2`, `target_commitish=dev`, `previous_tag_name=v0.2.1`; it returned the list of PRs #42 to #78 and created nothing.
- **Logic dry run:** extracted each `run:` block from the YAML and ran it against a stub `gh`. Prepare, with tags `v0.1.0 v0.2.0 v0.2.1 v0.2.10 v0.10.0 v0.2.9-rc1 vfoo`: patch → `v0.10.1`, minor → `v0.11.0`, major → `v1.0.0` (the rc and junk tags are ignored, `v0.10.0` beats `v0.2.10`); with only `v0.2.1`: patch → `v0.2.2`; unknown bump, no tags, an open PR, and `dev` with 0 commits ahead each stop with an `::error::` and a non-zero exit. Publish: `feat: x` → no-op; `release: v0.3.0 (#80)` and the default merge message → `gh release create v0.3.0 --target <sha> …`; `fix: mention release: v9.9.9 in docs` → no-op; tag exists → no-op; a 500 on the tag lookup → exit 1. The stub test is not committed (the task asked for one verification, not a test file).
- YAML parsed with PyYAML; that run caught an unquoted `: ` in the publish `if`, fixed. `actionlint` is not installed here, so the files were also read twice by hand against the style of `tick.yml` and `ci.yml`. No actions are used, so there are no SHA pins to add.
- `pnpm check`: prettier, eslint, tsc, vitest pass (29 files passed, 1 skipped; 120 tests passed, 1 skipped).
- Not verified: an actual run of either workflow. `release-prepare` cannot be dispatched until it is on `main`, and no tag, release or PR to `main` was created.

## Open issues
- The repository setting above is still off.
- **First release with these workflows.** Workflow files only run from the default branch, so Prepare release does not appear in the Actions tab until a release brings it to `main`. For that release: open the PR `dev → main` by hand titled `release: vX.Y.Z` (use `gh api repos/{owner}/{repo}/releases/generate-notes -f tag_name=vX.Y.Z -f target_commitish=dev -f previous_tag_name=v0.2.1` for the body), merge it with a merge commit. A `push` run uses the workflow files of the pushed commit, so `release-publish` should fire on that same merge and create the tag and release; not observed. If it does not, run the old `gh release create vX.Y.Z --target main --generate-notes`. Doing that first is also safe: publish then sees the tag and does nothing. From the next release on, use Actions → Prepare release.
- Suggested version for that first release: `v0.3.0` (the changes since v0.2.1 include features, e.g. manual rounds).
- Not built, as instructed: a post-deploy smoke check (call the production URL after Vercel deploys and fail the run on a non-2xx), and auto-merge of the release PR once `check` is green.
- Small gaps: a push to `main` whose message holds `release: vX.Y.Z` for an already-used version is ignored silently (by design); a release PR created while the newest push to `dev` is still running `ci` waits on the required check.

## Next
Session: 9 — Dry run against production
Model / effort: keep (opus / high) — no signal; this session touched no application code.
Owner must do first: tick "Allow GitHub Actions to create and approve pull requests" in Settings → Actions → General (or ask for a retry); merge this PR into `dev`. Session 9 plays a weekday run and does not need a release, but the next release is the first one that carries these workflows (see Open issues).
Plan changes needed: IMPLEMENTATION_PLAN.md §11.6 and SESSION_PLAYBOOK.md item 8 describe the release as a manual PR plus `gh release create`; they should point to D29 and the README Deploy paragraph.

<adjustments>
- Releases are now cut with Actions → Prepare release; Session 10, if it needs a release, uses that after the first workflow-carrying release has been done by hand.
</adjustments>
