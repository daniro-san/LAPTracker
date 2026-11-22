# fix/ci-release-runs: release PRs stop re-running `pull_request` workflows; Dependabot cooldown and a lint-format group (issue 592, CI audit R1 + R3)

## Built

- `.github/workflows/ci.yml`: `on: pull_request: branches: [dev]` (plus `workflow_dispatch`, unchanged). The header comment says where the release PR's `check` comes from.
- `.github/workflows/dependabot-automerge.yml`:
  - `on: pull_request: branches: [dev]`;
  - `permissions: {}` at workflow level, with `contents: write` and `pull-requests: write` on the job only;
  - job `if:` checks both `github.actor` and `github.event.pull_request.user.login` are `dependabot[bot]`;
  - the merge step also skips `steps.metadata.outputs.dependency-group == 'lint-format'`. The pinned fetch-metadata v3.1.0 (`25dd0e34…`) declares that output; checked in its `action.yml` at that SHA.
- `.github/workflows/release-prepare.yml`: comment only. The release PR gets no run of its own; the dispatch reports `check`.
- `.github/dependabot.yml`:
  - npm `cooldown` `default-days: 7`, `semver-major-days: 14`;
  - group `lint-format` (prettier, eslint, `@eslint/*`, typescript-eslint, `eslint-plugin-*`; minor and patch), listed before `minor-and-patch`;
  - github-actions `cooldown` `default-days: 7`.
- `CONTRIBUTING.md` release step 4: wait for `check` from the dispatch on `dev`, then `gh pr merge <n> --merge --match-head-commit <sha>`; nobody approves a held run.
- `.claude/settings.json`: removed the `gh api -X POST …/actions/runs/*/approve` allow rule.
- `docs/decisions/D29-…`: dated amendment (no held run, with the run evidence).
- `docs/decisions/D150-dependency-cooldown-and-a-lint-format-group.md` and its index line.

## Decisions

- **No formatting change for #420.** Prettier 3.10.1 measures Thai text narrower than 3.9.10. It joins 5 broken lines in `lib/i18n/th.ts` and re-pads the whole table in `lib/i18n/glossary/th.md` (339 lines). 3.9.10's `--check` rejects 3.10.1's output of both files, and 3.10.1 rejects the current files. No whitespace change passes under both, so the regrouping is what unblocks #420.
- **pnpm `minimumReleaseAge` not added.** pnpm 12.16.1 supports it (minutes; strict when set explicitly). It checks every lockfile entry even on `pnpm install --frozen-lockfile`. With `10080`, a clean frozen install of today's lockfile fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`: `@posthog/core@1.68.0`, published 2026-11-15T14:18:02Z. The task said to add it only if it does not break that install.
- **pnpm `trustPolicy: no-downgrade` not added.** A clean frozen install with it fails with `ERR_PNPM_TRUST_DOWNGRADE` on `lefthook@2.2.2` ("High-risk trust downgrade … possible package takeover").
- **D150 amends plan §11.6 and §12.4, not a decision.** No earlier decision covers Dependabot automerge; the workflow cites plan §11.6.
- **The GitHub Actions cooldown has only `default-days`.** GitHub's options reference lists github-actions as supporting default days but not the SemVer-bump keys.

## Deviations

- The report's batch 3 suggested `trustPolicy: no-downgrade` alongside `minimumReleaseAge`. Neither is in, for the reasons above.
- `docs/IMPLEMENTATION_PLAN.md` line 572 still lists the `actions/runs/*/approve` POST among the allow rules. It was not edited (CLAUDE.md: do not edit the plan).

## Verified

- **The dispatch `check` is on the release PR's head SHA** (GET reads as daniro-san):
  - PR #593, head `fab5252f12c0cb9571a684bc18043fe8ad1fd490` (`dev → main`, merged). It has two `check` check-runs from `github-actions`, both success. Run 44957284752: `workflow_dispatch`, `head_branch` `dev`, attempt 1, started 22:32:41Z. Run 44957286702: `pull_request`, attempt 2, which is the approved held run.
  - PR #589, head `b509ad32…`: the same pair (44951339803 dispatch, 44951342843 `pull_request` attempt 2).
  - The `main` ruleset (26563616) requires context `check` with `integration_id` 15368, which is GitHub Actions. `strict_required_status_checks_policy` is false. The dispatch run alone satisfies it.
- **YAML:** PyYAML `safe_load` of `dependabot.yml`, `ci.yml`, `dependabot-automerge.yml` and `release-prepare.yml`. The parsed `on`, `permissions`, job `if`/`permissions`, cooldowns and group order are as intended.
- **actionlint** 1.7.12 (already installed at `/opt/homebrew/bin`) on the three changed workflows: no findings.
- **`.claude/settings.json`** parses as JSON.
- **Prettier:** 3.9.10 (the repo's) and 3.10.1 (in the scratchpad, not the repo) run on the two Thai files, as above.
- **pnpm policies:** clean frozen installs in scratch copies of `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `.npmrc`, one per setting, with the errors quoted above.
- **`pnpm check`:** exit 0. prettier, eslint and tsc are clean. vitest: 297 files passed and 2 skipped; 1,552 tests passed and 4 skipped. Drift and i18n checks are clean (17 languages).
- **Not checked:** `dependabot.yml` against Dependabot's own validator. It runs only on GitHub, after the file reaches the default branch. Keys and group order were checked against GitHub's Dependabot options reference.

## Open issues

- **Dependabot reads `dependabot.yml` from the default branch (`main`).** The cooldown and the `lint-format` group take effect only after the next release. Then Dependabot rebuilds #420 without prettier, and prettier arrives in its own `lint-format` PR, which needs `pnpm exec prettier --write lib/i18n/th.ts lib/i18n/glossary/th.md` by hand.
- **`lefthook@2.2.2` trust downgrade** reported by pnpm's `trustPolicy`. Look at its provenance on npm before turning on `trustPolicy: no-downgrade`, or before the next lefthook bump.
- **`minimumReleaseAge: 10080`** can go into `pnpm-workspace.yaml` once `@posthog/core@1.68.0` is 7 days old (2026-11-22T14:18Z), if nothing younger lands first. Re-run a clean `pnpm install --frozen-lockfile` with it set before committing. In strict mode it also makes `pnpm add`/`update` fail when no version in range is 7 days old.
- **D150 collides with PR #600's D150.** Whichever of the two merges second renumbers (README rule).
- **Security updates still target `main`** (report S7). This change does not touch that; R8 does.

## Next

- Model/effort: keep. The work was config plus evidence reads, and the one surprise (pnpm checking the lockfile against policy on frozen installs) came from running it, not from reasoning.
- Owner first: on the first release after this merges, check that the release PR shows only the dispatch `check` (no `action_required` run), that it is green, and merge with `--match-head-commit`. After that release, check that Dependabot rebuilt #420 without prettier.
- Plan change: `docs/IMPLEMENTATION_PLAN.md` §11 (line 572, the allow-rule list) still names the `actions/runs/*/approve` POST; it should drop it.

<adjustments>
- pnpm 12.16.1 verifies every lockfile entry against `minimumReleaseAge` and `trustPolicy` on `pnpm install --frozen-lockfile` ("Verifying lockfile against supply-chain policies"). A policy that the committed lockfile violates breaks CI, Vercel and the SessionStart hook at once. Test any such setting with a clean frozen install in a scratch copy first.
- Prettier 3.10.x reformats Thai (and likely other combining-mark scripts). When the `lint-format` PR arrives, run `prettier --write` on the reported files in that PR. It is not a translation change.
- The release PR's `check` comes only from the dispatch on `dev`. If `release-prepare` ever stops dispatching `ci`, the release PR has no `check` and cannot merge.
</adjustments>

PR: (added by the orchestrator)
