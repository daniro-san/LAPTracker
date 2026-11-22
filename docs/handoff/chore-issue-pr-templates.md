# chore: spec-driven issue and PR templates (part of issue 592)

## Built

- `.github/ISSUE_TEMPLATE/` with three GitHub issue forms and a config:
  - `feature.yml` (label `enhancement`): problem and who it's for, acceptance criteria, out of scope, data and privacy, how to verify, design validation, done when, size.
  - `improvement.yml` (label `enhancement`): the same fields, plus "What happens today" first and a "DB cost" line in How to verify.
  - `bug.yml` (label `bug`): problem and who it's for, steps to reproduce, expected, actual, environment and version, then the same fields as a feature.
  - `config.yml`: `blank_issues_enabled: true`.
- Field details:
  - Acceptance criteria: the placeholder shows one `- [ ]` line per criterion in EARS style, using the five patterns `tlc-spec-lean` lists (When, While, If, Where, and a plain "shall").
  - Data and privacy: the prompt names the fields touched, any private roster field, and whether data reaches logs, caches, analytics or Discord. The description lists the private fields from CLAUDE.md. In feature and improvement the field is required, so the prompt is a `placeholder`; prefilled text would count as an answer. The same applies to the bug form's required "Environment and version". The bug form's optional privacy field keeps a prefilled `value`.
  - How to verify: a prefilled value with tests, QA flows, widths 360 / 768 / 1024 / 1280 / 1440 (the layout widths in DESIGN.md § Layout system, D122), and light and dark. The PR template lists the same widths.
  - Design validation: points to DESIGN.md § Validation (persona panel, PostHog usage, product persona). It is optional.
  - Size: a dropdown with S, M and L. In the feature and improvement forms, the M and L options say "run tlc-spec-lean first".
  - Required fields:
    - feature: problem, criteria, privacy, done when and size;
    - improvement: the same, plus today;
    - bug: problem, steps, expected, actual and environment.
- `.github/pull_request_template.md`, renamed from `PULL_REQUEST_TEMPLATE.md` and rewritten. Its sections:
  - `Closes #` / `Part of #N`;
  - What and why;
  - Acceptance criteria, ticked, each with where it was verified;
  - Data and privacy;
  - Verification: `pnpm check`, QA, widths and themes, and DB cost;
  - Design validation;
  - Gates: review, `/pr-review`, decision and handoff;
  - Follow-ups.

  The hints are HTML comments.
- `CONTRIBUTING.md`: a new section "Issues and pull requests", placed before "Deploy and release". It covers:
  - S: the form is the whole spec;
  - M or L feature: run `/tlc-spec-lean` first (`.claude/skills/tlc-spec-lean`), then build against its frozen criteria;
  - QA checks the criteria one by one;
  - what `ready` and `decision` mean.
- Labels:
  - `ready` (#0e8a16, "Criteria settled; can be built"): created on GitHub with `gh label create`.
  - `decision` ("Needs the owner's call", #d9cdb4): it already existed, and the forms and CONTRIBUTING.md use it for "wait for the owner".

- `.claude/skills/tlc-spec-lean/` (owner, 2026-11-21): the `tlc-spec-lean` skill, ported so every session has it, cloud sessions included.
  - Source: Tech Leads Club, https://github.com/tech-leads-club/agent-skills, path `packages/skills-catalog/skills/(development)/tlc-spec-lean`.
  - Pinned at `f69e6154b3ac900ea661687479b407cc1be9d4a9` (2026-10-31, skill version 2.2.0). It is the newest commit on that path that is at least two weeks old. The three commits from 2026-11-18 (version 3.1.0) were too new.
  - The 19 upstream files are byte-identical to the pin, and all are mode 100644:
    - `SKILL.md`;
    - `references/`: `build.md`, `checks.md`, `memory.md`, `plan.md`, `verify.md` and `verify-screens.md`;
    - `scripts/`: `check_commit.py`, `check_proofs.py`, `lean_config.py`, `lessons.py`, `selftest.py`, `validate_checks.py`, `validate_plan.py` and `validate_verification.py`;
    - `scripts/fixtures/`: `checks.md`, `plan.md`, `proofs.md` and `verification.md`.
  - The added `NOTICE.md` holds the source, the pin, the author, the licences, "unmodified", how to re-sync, and the full MIT text. Upstream licenses `SKILL.md` under CC-BY-4.0, and everything else in the folder (references, scripts, fixtures) under the repository's MIT License.
  - `.prettierignore` skips the upstream files, so they stay identical to the pin. `NOTICE.md` is still checked.

- `.specs/README.md` and one paragraph in CONTRIBUTING.md carry the same rule: "`.specs/` is committed. It must hold invented names only, and never any private roster field, real player data, screenshot of real data, secret or webhook." The skill does not create a README of its own.
- After the second `/pr-review` on #596:
  - `.gitignore` ignores image files under `.specs/` (png, jpg, jpeg, webp and gif, in any case). The skill's gates read pictures from disk, so they still work.
  - `.specs/README.md` § "Running the gates on someone else's checks": `check_proofs.py` and `validate_checks.py --execute` run a `checks.md`'s `Run`, `Proof` and `Build:` lines through a shell. A PR's `checks.md` is untrusted data. Read those lines first, and run nothing but `pnpm` commands, repo scripts or local tests. CONTRIBUTING.md points to the README.
  - REVIEW.md § Specs: flag a `checks.md` command that is not a `pnpm` command, a repo script or a local test, and flag real data under `.specs/`.
  - CONTRIBUTING.md follows the issue forms on sizes. A bug of any size, and an S feature or improvement, use the form only. An M or L feature or improvement goes through `/tlc-spec-lean`.
  - NOTICE.md: `SKILL.md` is CC-BY-4.0. Everything else in the folder is MIT, per upstream's `LICENSE`.

## Decisions

- `.specs/` is committed (orchestrator, 2026-11-21). The specs are the frozen criteria that QA and later agents check against. `tlc-spec-lean` writes them there at the repo root.

- No D-number. This is contributor tooling, not product behaviour.
- The task asked for a new `needs-decision` label. I created it, and then the orchestrator decided to keep the existing `decision` label instead, because existing issues already use it. No issue or PR used `needs-decision`, so it was deleted from GitHub.
- The forms do not apply `ready` or `decision` themselves. A form cannot pick a label from an answer. A default `decision` would block every issue the owner files, and a default `ready` would mark unreviewed issues as buildable. The markdown header of each form says when to add which.
- The bug form leaves criteria, privacy, verify, design and done when optional. Steps, expected and actual already define the fix for most bugs.
- After `/pr-review` on #596, the widths come from DESIGN.md § Layout system (D122) and not from § Validation. § Validation lists its own widths (360, 390, 412, 600–820, 1024, 1180 and 1280), and only for the UX review of charts. The layout section is where the general set lives. The references to DESIGN.md § Validation and `/pr-review` stay as they are: PR 594 adds both, and this branch is rebased on `dev` after 594 merges.
- The section in CONTRIBUTING.md sits before "Deploy and release" and not at the end of the file. PR 594 appends "Working rules" at the end and edits the harness section. This placement avoids a rebase conflict with it.

## Deviations

- The task asked for a new `.github/pull_request_template.md`. The repo already had `.github/PULL_REQUEST_TEMPLATE.md` with What / Verified / Handoff. I renamed it with `git mv` and replaced its content, so there is one template, not two. `docs/SESSION_PLAYBOOK.md` (line 222) and `docs/handoff/02-sources.md` still name the old file and its three headings. Both are historical records, so I did not edit them.
- "Blank issues allowed for the owner": GitHub has no per-user switch. `blank_issues_enabled: true` allows blank issues for everyone who can open issues.

## Verified

- Issue-form shape: a script in the scratchpad parsed all four YAML files with PyYAML 6.0.3. It checked the allowed top-level keys, the body element types, the attribute keys per type, unique ids and labels, dropdown options (non-empty, unique, no reserved "None"), and `validations.required` as a boolean. Result: 0 errors.
  - feature: 9 elements;
  - improvement: 10;
  - bug: 13;
  - config: `{'blank_issues_enabled': True}`.
- Ruby Psych 5.2.2 is available as a second parser. PyYAML was the check that ran.
- `prettier --check .`: "All matched files use Prettier code style!". A glob run printed `config.yml` and the PR template, which confirms Prettier covers the new files.
- `close-issues.yml`: the template's bare `Closes #` and the `#N` inside hints have no digits, so the keyword match never fires on an unfilled template.
- `pnpm check`: exit 0. Prettier, ESLint and tsc are clean; Vitest ran 296 test files passed and 2 skipped, 1532 tests passed and 4 skipped; drift and i18n checks pass.
- tlc-spec-lean port:
  - The upstream download went into its own scratchpad directory, through a sparse fetch of the pinned commit. `diff -r` against the copy is empty.
  - Script review, before copying (read only, nothing executed):
    - Only the standard library is imported.
    - No network calls.
    - `check_proofs.py` runs, through `/bin/sh`, only the `Run`/`Build:` lines the author writes in `.specs/features/<f>/checks.md`, plus read-only `git` commands. `validate_verification.py` also runs only read-only `git` commands.
    - Writes go only under `.specs/`. `selftest.py` deletes only `tempfile.mkdtemp()` directories.
  - Privacy scan: no company names, people other than the public upstream credit, emails, local paths or credentials. The only URLs are conventionalcommits.org and an `example.com` placeholder in `selftest.py`.
  - Not run: `selftest.py` and the other scripts. The task said to run nothing from the download.
- Labels: `gh label list --search decision` shows only `decision`, and `--search ready` shows `ready`. Before the delete, `gh issue list` and `gh pr list --label needs-decision --state all` both returned `[]`.
- Not verified: how the forms render on GitHub. Forms render only from the default branch (`main`), so they appear after the next release.

## Open issues

- The issue forms show on GitHub only after this reaches `main` through a release.
- `selftest.py` has not been run here. The orchestrator reviews the scripts and runs it separately: `python3 .claude/skills/tlc-spec-lean/scripts/selftest.py` to prove the gates on this machine. It works only in temp directories.

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- Issues filed from now on carry EARS criteria in a `- [ ]` list under "Acceptance criteria". QA and `/pr-review` can read them from the issue body and tick them in the PR's "Acceptance criteria" section.
- `ready` exists on GitHub. An agent picking up an issue labelled `decision` waits for the owner.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/596
