# chore: spec-driven issue and PR templates (part of issue 592)

## Built

- `.github/ISSUE_TEMPLATE/` with three GitHub issue forms and a config:
  - `feature.yml` (label `enhancement`): problem and who it's for, acceptance criteria, out of scope, data and privacy, how to verify, design validation, done when, size.
  - `improvement.yml` (label `enhancement`): the same fields, plus "What happens today" first and a "DB cost" line in How to verify.
  - `bug.yml` (label `bug`): problem and who it's for, steps to reproduce, expected, actual, environment and version, then the same fields as a feature.
  - `config.yml`: `blank_issues_enabled: true`.
- Field details:
  - Acceptance criteria: the placeholder shows one `- [ ]` line per criterion in EARS style, using the five patterns `tlc-spec-lean` lists (When, While, If, Where, and a plain "shall").
  - Data and privacy: a prefilled value that names the fields touched, any private roster field, and whether data reaches logs, caches, analytics or Discord. The description lists the private fields from CLAUDE.md.
  - How to verify: a prefilled value with tests, QA flows, widths 360 / 768 / 1280, and light and dark.
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
  - M or L feature: run `tlc-spec-lean` first, then build against its frozen criteria;
  - QA checks the criteria one by one;
  - what `ready` and `needs-decision` mean.
- Labels created on GitHub with `gh label create`:
  - `ready` (#0e8a16): "Criteria settled; can be built".
  - `needs-decision` (#d93f0b): "Waits for the owner's decision before building".

## Decisions

- No D-number. This is contributor tooling, not product behaviour.
- The forms do not apply `ready` or `needs-decision` themselves. A form cannot pick a label from an answer. A default `needs-decision` would block every issue the owner files, and a default `ready` would mark unreviewed issues as buildable. The markdown header of each form says when to add which.
- The bug form leaves criteria, privacy, verify, design and done when optional. Steps, expected and actual already define the fix for most bugs.
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
- Labels: `gh label list --search ready` and `--search decision` show both new labels.
- Not verified: how the forms render on GitHub. Forms render only from the default branch (`main`), so they appear after the next release.

## Open issues

- The label `decision` ("Needs the owner's call", #d9cdb4) already existed and means the same as `needs-decision`. The owner may want to keep one of them and relabel the issues that use the other.
- The issue forms show on GitHub only after this reaches `main` through a release.

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- Issues filed from now on carry EARS criteria in a `- [ ]` list under "Acceptance criteria". QA and `/pr-review` can read them from the issue body and tick them in the PR's "Acceptance criteria" section.
- `ready` and `needs-decision` exist on GitHub. An agent picking up an issue labelled `needs-decision` waits for the owner.
</adjustments>

PR: (added by the orchestrator)
