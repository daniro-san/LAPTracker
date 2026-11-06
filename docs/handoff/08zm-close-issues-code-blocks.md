# 08zm — close-issues ignores code blocks and quotes

## Built
- `.github/workflows/close-issues.yml`: a jq function `prose` runs on the title and body before the keyword `scan`. It removes:
  - fenced code blocks. A fence is a line with up to 3 leading spaces, then 3 or more backticks or tildes. The block ends at a line that holds only a fence of the same character, at least as long as the opening one. An unclosed fence runs to the end of the text, as in CommonMark. The fence lines themselves are removed too;
  - blockquote lines: up to 3 spaces, then `>`;
  - inline code spans: a run of backticks up to the next run of exactly the same length, across lines too.
- The header comment of the workflow now says that text in code and quotes is ignored, so a PR body that quotes an example closing keyword should put it in code.
- Everything else from 08zi is unchanged: the trigger, permissions, keyword regex, same-repo filter, de-duplication, per-issue checks, the comment line, re-run safety and the job summary.

## Decisions
- Line-based in jq (`split("\n")`, `reduce` with the open fence as state), not a regex over the whole body. A regex cannot match a closing fence against its opening fence's character and length. With the line-based version, a fence of 4 backticks can wrap a block that contains a fence of 3, and a tilde block is not closed by a backtick line.
- `\r` is allowed after a closing fence: GitHub stores bodies edited in the web form with CRLF line ends.
- The title goes through `prose` too, so a keyword inside inline code in the title is ignored as well.
- Inline code is replaced with nothing, not with a space. `Fixes` followed directly by an inline code span and then `#N` then reads as `Fixes#N`, and the regex needs a space before `#`, so it does not match.

## Deviations
- None from the task.

## Verified
- `actionlint` 1.7.12: no findings for all seven workflows (it runs `shellcheck` on the `run:` block). YAML read back with Ruby: `on.pull_request = {types: [closed], branches: [dev]}`, `permissions = {contents: read, issues: write}`, job `if` = `github.event.pull_request.merged == true`, all unchanged.
- Local jq is `jq-1.7.1-apple`. `ubuntu-latest` ships jq 1.7.1, with the same Oniguruma engine (named backreference `\k<t>` and lookbehind are used).
- Dry run, the 08zi approach. The `run:` block was extracted from the YAML with Ruby, once from this branch and once from `origin/dev`. Both were run with bash against event files built from `gh pr view <n> --json number,title,body`. Stub 1 sent read-only `gh api` GETs to the real API and printed `gh issue comment` / `gh issue close` instead of running them. It refused any `gh api` call with `-X`, `--method`, `-f`, `-F`, `--field`, `--raw-field` or `--input`, and any other `gh` command. Stub 2 faked every response (no network). No issue was commented on or closed from this machine.

New script, stub 1 (real issue states):

```
===== 103   Skip #56: already closed.                                  exit=0
===== 112   Skip #58: already closed.                                  exit=0
===== 115   Skip #26: already closed. / Skip #27: already closed.     exit=0
===== 116   PR #116 names no issue with a closing keyword. Nothing to do.   exit=0
===== 999 (08zi crafted body)
Skip #106: already closed.
Skip #57: already closed.
Skip #94: already closed.
Skip #99: a pull request, not an issue.
Skip #9999: not found.
Skip vercel/next.js#123: another repository.
exit=0
===== none (08zi, PR #996)   PR #996 names no issue with a closing keyword. Nothing to do.   exit=0
```

(#57 and #106 were open when 08zi ran and are closed now, so they show "already closed" where 08zi showed "Closed". The refs found are the same.)

The #116 body under the old script, stub 2 (every issue faked as open, #777 faked as HTTP 502): it would have closed #1, #106, #26, #27, #56, #57, #58, #60, #94, #99, #9999 and failed on #777, all from the dry-run fixtures in the body's code blocks. The new script: nothing.

Old and new scripts, stub 2, output compared line for line: identical for 103, 112, 115, 999 and none.

New crafted bodies (stub 1):

```
===== code (PR #995)
title: ci: crafted code test `closes #57`
body:
  Intro.
  ```  fixes #57  ```                         (fenced, 3 backticks)
  Fixes #94                                   (outside code: must match)
  ~~~text  Closes #106  ~~~                   (fenced, tildes)
  ````md  ```  Resolves #57  ```  still inside: closes #106  ````   (4-backtick fence wrapping a 3-backtick one)
  after four-tick fence: closes #9999         (outside code: must match)
  > Fixes #57
     > closes #106 (indented quote)
  Inline `Closes #57` and ``fixes `x` #106`` and plain text.
  ~~~  unclosed tilde fence: fixes #57
result:
Skip #94: already closed.
Skip #9999: not found.
exit=0
===== crlf (PR #994): CRLF line ends; fixes #57 in a fence, then "Closes #9999", then "> closes #106"
Skip #9999: not found.
exit=0
===== mixed (PR #993): a tilde fence holding a backtick line, a keyword, then the closing tilde fence, then "Closes #9999"
Skip #9999: not found.
exit=0
```

Under the old script, `code` gave #106, #57, #94, #9999 and `crlf` gave #106, #57, #9999.

Faked re-run and error cases from 08zi (stub 2), new script:

```
===== rerun (PR #998, title "fix #57 again", body null; #57's comments already hold the line)
#57 already has the comment.
WOULD RUN: gh issue close 57 --reason completed
Closed #57.
exit=0
===== err (PR #997, body "Closes #777\nfixes #60"; #777 faked as HTTP 502)
WOULD RUN: gh issue comment 60 --body Closed by #997 (merged into `dev`)
WOULD RUN: gh issue close 60 --reason completed
Closed #60.
::error::Could not read #777: gh: Server Error (HTTP 502)
exit=1
```

- `pnpm check`: prettier, eslint and tsc pass. Vitest: 35 files passed, 3 failed with `Hook timed out in 10000ms` in `openTestDb()` (`lib/queries/players`, `running`, `upstream-status`). Those 3 run alone: 3 files, 10 tests passed (PGlite setup timeout, #124). `tsx scripts/check-drift.ts` on its own: "Everything's fine". This branch changes no TypeScript.
- Not verified: a run on GitHub. The first real run is this PR's own merge into `dev`: a `pull_request` run takes the workflow from the PR's merge ref, so it uses the new parser. Its body names only #133, outside code, so the run should close #133.

## Open issues
- Still matched (not stripped): indented code blocks (4 spaces or a tab, no fence), blockquote continuation lines that do not start with `>`, and HTML comments (`<!-- … -->`). The PR template only has HTML comments with no keywords. PR bodies here use fences, so none of these has caused a wrong close.
- Not reverted: #106 was closed by #116's merge before #117 implemented it. #117 has merged since, so #106 being closed is now correct. #60 was reopened by hand.
- Still from 08zi: full issue URLs after a keyword are not matched; fork PRs would fail with a read-only token.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches only CI; no app code, collector, cron path or quota.
Owner must do first: merge this PR into `dev`, then check that its `close-issues` run closed #133 and nothing else.
Plan changes needed: none.

<adjustments>
- Closing keywords inside fenced code, inline code or `>` quote lines in a PR title or body no longer close issues when the PR merges into `dev`. A session that quotes an example closing keyword in its PR body or handoff should put it in code; a keyword in plain text still closes the issue.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/135
