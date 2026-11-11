# 08zzy — Split DECISIONS.md (#127, session 2 of 2)

Spec: issue 127, the owner's comments of 2026-11-06 and 2026-11-11. Branch `session/08zzy-decisions-split`, from `origin/dev` at e71d1e1.
Corrected after the merge by the review follow-up: branch `fix/08zzy-decisions-split-review`, from `origin/dev` at 54d07a6. It changed this file and added one line to D41.

## Built
- `docs/decisions/DNN-<slug>.md`: one file per entry, 59 moved (D1 to D60 without D41), numbers zero-padded (`D01` to `D60`). Moved by a script that cuts `docs/DECISIONS.md` at each `## D` heading and writes each chunk unchanged. The script is in the session scratchpad, not in the repo.
- `docs/decisions/D41-one-file-per-decision-in-docs-decisions.md`: the new entry. It records the split and supersedes the old header sentence "split at ~25 entries". The review follow-up added one line at its end, "Amended 2026-11-11 (review of PR #224)": the index line in the README is the one edit a new decision shares with other sessions.
- `docs/decisions/README.md`: the old header text as it was, a note pointing to D41, the rule for adding a decision, and an index of 60 entries in numeric order.
- `docs/DECISIONS.md`: reduced to a pointer to `docs/decisions/README.md`.
- Citations outside `docs/handoff` repointed. Code comments, `docs/DESIGN.md` and `eslint.config.mjs` now say `docs/decisions/Dnn`. `.claude/rules/collector.md`, `lib/sources/internal.ts` and `pnpm-workspace.yaml` name `docs/decisions/` (the yaml names D10). `CONTRIBUTING.md` links D29 and the README. `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md` and `docs/SESSION_PLAYBOOK.md`: 13 lines (CLAUDE.md 27-30; plan 581, 637, 638; playbook 165, 166, 168, 251, 256, 265). On 11 of them only the path changed. On plan 581 and 637 the wording changed too (see Deviations). Plan 581 is the repo-tree entry (now `decisions/`); line 582 is untouched. Plan 316, 541, 572 and playbook 288 name no path and are untouched.

## Decisions
- The owner did not answer the two questions on #127. Assumed the recommended readings: the wait rule was kept (the split ran after D46 and D47 reached `dev`), and file names are zero-padded.
- Slug: the first six words of the heading title, lowercase, ASCII.
- Citation form in code comments: `docs/decisions/Dnn`. It is a prefix of the file name, not a path that opens: `git ls-files 'docs/decisions/D22*'` prints the file. (`git grep docs/decisions/D22` prints the lines that cite D22, not the file.)
- Review follow-up: the citation form and the three protected files stay as PR 224 left them (see Open issues). D41's sentences stay; the correction is an added dated line, as in D22 and D57.
- The README keeps the old header unchanged, followed by a note that D41 supersedes its second paragraph. D41 and the README never spell the old file name.
- The pointer file does not spell its own name. It cites D41.

## Deviations
- Two plan lines changed in wording beyond the path, which the owner's permission on #127 ("only to change references") does not cover:
  - Line 581 (repo tree): "`DECISIONS.md` one paragraph per decision" became "`decisions/` one file per decision".
  - Line 637: "a line in `docs/DECISIONS.md`" became "a file in `docs/decisions/`".
  - Reason at the time: "paragraph" and "line" no longer fit one file per entry. The review follow-up may not edit the plan, so both stay as merged until the owner decides (see Open issues).
- The task says the file would have 57 entries. It had 59 at e71d1e1 (D46 and D47 landed).
- Nothing that the prompt asked could not be done as written.

## Verified
- Open PRs at start: 223, 217, 185, 183. `gh pr diff <n> --name-only` for each lists no file named DECISIONS or under `docs/decisions`. Checked again before the push (see Open issues).
- Byte comparison (script `verify.mjs` in the scratchpad: the text of `git show origin/dev:docs/DECISIONS.md` from `## D1` to the end, against the 59 moved files read in original order and joined with one blank line):
  `entries 59 unique 59` / `bytes orig 112347 joined 112347` / `IDENTICAL`.
- `git grep -n 'DECISIONS.md' -- . ':!docs/handoff'` returns nothing. No file needs to be listed as allowed.
- `git grep -n DECISIONS -- . ':!docs/handoff'` returns four lines, none of which names a path: plan 316, 541 ("DECISIONS D9") and 572, and playbook 288. The owner's permission covers path references only, so they are unchanged.
- `pnpm check`: exit 0 (253 tests passed, 1 skipped; typecheck, lint, drizzle check, i18n check green). `prettier --check docs/decisions docs/DECISIONS.md CONTRIBUTING.md`: all files pass; Prettier changed no moved entry.
- `docs/handoff/*` not edited (81 lines there still cite the old name; the pointer keeps them valid).
- Review follow-up, on `fix/08zzy-decisions-split-review`:
  - `git show 54d07a6 --format= --numstat -- CLAUDE.md docs/IMPLEMENTATION_PLAN.md docs/SESSION_PLAYBOOK.md`: `4 4 CLAUDE.md` / `3 3 docs/IMPLEMENTATION_PLAN.md` / `6 6 docs/SESSION_PLAYBOOK.md`. 13 lines, not 12.
  - `git show 54d07a6 --format= -- docs/IMPLEMENTATION_PLAN.md`: line 581 `-  DECISIONS.md  one paragraph per decision` / `+  decisions/  one file per decision`; line 637 `- a line in docs/DECISIONS.md` / `+ a file in docs/decisions/`; line 638 changes the path only.
  - `ls docs/decisions/D22`: `No such file or directory`. `git ls-files 'docs/decisions/D22*'`: `docs/decisions/D22-player-photos-and-alliance-badges-served.md`. The prefix form is on 18 lines in 15 files; each prefix matches one file.
  - `git grep -n DECISIONS -- . ':!docs/handoff'`: 4 lines (plan 316, 541, 572; playbook 288). `git grep -n 'DECISIONS.md' -- . ':!docs/handoff'`: nothing.
  - Open PRs 226, 225, 217, 185, 183: `gh pr diff <n> --name-only` lists no file under `docs/decisions`.
  - `git diff --name-only origin/dev`: `docs/decisions/D41-one-file-per-decision-in-docs-decisions.md` and this file. `CLAUDE.md`, the plan and the playbook are not edited.
  - `pnpm check`: exit 0. `All matched files use Prettier code style!`; `Test Files 55 passed | 1 skipped (56)`, `Tests 253 passed | 1 skipped (254)`; `No schema changes, nothing to migrate`; `i18n: 17 languages up to date with English`.

## Open issues
- Issues that still tell a session to write an entry in `docs/DECISIONS.md`: 144 (TypeScript 7; "a D-entry in docs/DECISIONS.md" and "docs/DECISIONS.md D8") and 190 (compare events of different kinds; "a D-entry in docs/DECISIONS.md"). Issue 178 (MCP spike) says "what DECISIONS records". Issue 152 is closed. Their sessions must create `docs/decisions/DNN-<slug>.md` and add an index line to the README. The owner may want to edit their text.
- Open PRs 183 and 185 are spikes whose handoffs may say DECISIONS; neither edits the file. If a spike's build later adds an entry, it goes in `docs/decisions/`.
- `docs/IMPLEMENTATION_PLAN.md` lines 316, 541, 572 and `docs/SESSION_PLAYBOOK.md` line 288 still say "DECISIONS" without a path, as the owner's permission requires. Plan 582 still says the file is a single file split at about 25 entries; it is now out of date.
- Other open PRs that add a decision need to rebase and write a file, not a section. None did at the time of the push.
- Plan lines 581 and 637 were reworded beyond the path (see Deviations). The owner either accepts both, or restores the two phrases by hand: "one paragraph per decision" on 581 (keeping `decisions/`) and "a line in" on 637. No session may edit the plan for this.
- 18 lines in 15 files cite a decision as `docs/decisions/Dnn` (`CLAUDE.md` line 29 is one). That is a prefix of the file name, not a path that opens. The form is kept. Changing it to the full file name or to `docs/decisions/Dnn-*.md` is the owner's call, and the `CLAUDE.md` line needs the owner's hand.
- D41's sentence "two sessions never edit the same file" is wrong for the README index. The entry is append-only, so the sentence stays and the dated amendment line at its end corrects it.

## Next
Session: none — no session is queued behind this one; `docs/SESSION_PLAYBOOK.md` has no prompt after it.
Model / effort: keep (sonnet · medium, the level the prompt on issue 127 names) — the 59 entries moved byte for byte; the review's five findings were in this handoff, in one sentence of D41 and in two plan lines, none in a moved entry.
Owner must do first: decide plan lines 581 and 637 (accept the wording, or restore the two phrases by hand; see Open issues). Then tell the sessions that add a decision (issues 144 and 190, spike builds) to write `docs/decisions/DNN-<slug>.md` and to add one line to the index in `docs/decisions/README.md`.
Plan changes needed: `docs/IMPLEMENTATION_PLAN.md` repo tree, line 582: its note still says the decisions are one file that splits at about 25 entries; D41 superseded that. Lines 581 and 637: the owner's choice above. Not edited here, because the owner's permission covered path references only, in the split session only.

<adjustments>
- The next free decision number is D61.
- A new decision is one new file, `docs/decisions/DNN-<slug>.md` (number zero-padded), plus one line in the index of `docs/decisions/README.md`. That index line is the one edit shared with other sessions: a conflict on it is how a duplicate number shows up, so compare the numbers when resolving it.
- `docs/DECISIONS.md` is a pointer to `docs/decisions/README.md`. Do not add entries to it.
- Code comments cite a decision as `docs/decisions/Dnn`. `git ls-files 'docs/decisions/Dnn*'` prints the file.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/224
