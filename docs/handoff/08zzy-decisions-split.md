# 08zzy — Split DECISIONS.md (#127, session 2 of 2)

Spec: issue 127, the owner's comments of 2026-11-06 and 2026-11-11. Branch `session/08zzy-decisions-split`, from `origin/dev` at e71d1e1.

## Built
- `docs/decisions/DNN-<slug>.md`: one file per entry, 59 moved (D1 to D60 without D41), numbers zero-padded (`D01` to `D60`). Moved by a script that cuts `docs/DECISIONS.md` at each `## D` heading and writes each chunk unchanged. The script is in the session scratchpad, not in the repo.
- `docs/decisions/D41-one-file-per-decision-in-docs-decisions.md`: the new entry. It records the split and supersedes the old header sentence "split at ~25 entries".
- `docs/decisions/README.md`: the old header text as it was, a note pointing to D41, the rule for adding a decision, and an index of 60 entries in numeric order.
- `docs/DECISIONS.md`: reduced to a pointer to `docs/decisions/README.md`.
- Citations outside `docs/handoff` repointed. Code comments, `docs/DESIGN.md` and `eslint.config.mjs` now say `docs/decisions/Dnn`. `.claude/rules/collector.md`, `lib/sources/internal.ts` and `pnpm-workspace.yaml` name `docs/decisions/` (the yaml names D10). `CONTRIBUTING.md` links D29 and the README. `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md` and `docs/SESSION_PLAYBOOK.md`: path references only, 12 lines (CLAUDE.md 27-30; plan 581, 637, 638; playbook 165, 166, 168, 251, 256, 265). Plan 581 is the repo-tree entry (now `decisions/`); line 582 is untouched. Plan 316, 541, 572 and playbook 288 name no path and are untouched.

## Decisions
- The owner did not answer the two questions on #127. Assumed the recommended readings: the wait rule was kept (the split ran after D46 and D47 reached `dev`), and file names are zero-padded.
- Slug: the first six words of the heading title, lowercase, ASCII.
- Citation form in code comments: `docs/decisions/Dnn` (a prefix of the file name, so `git grep docs/decisions/D22` finds it).
- The README keeps the old header unchanged, followed by a note that D41 supersedes its second paragraph. D41 and the README never spell the old file name.
- The pointer file does not spell its own name. It cites D41.

## Deviations
- Plan line 637 now says "a file in `docs/decisions/`" (was "a line in `docs/DECISIONS.md`"): "line" no longer fits one file per entry. Same intent.
- The task says the file would have 57 entries. It had 59 at e71d1e1 (D46 and D47 landed).
- Nothing that the prompt asked could not be done as written.

## Verified
- Open PRs at start: 223, 217, 185, 183. `gh pr diff <n> --name-only` for each lists no file named DECISIONS or under `docs/decisions`. Checked again before the push (see Open issues).
- Byte comparison (script `verify.mjs` in the scratchpad: the text of `git show origin/dev:docs/DECISIONS.md` from `## D1` to the end, against the 59 moved files read in original order and joined with one blank line):
  `entries 59 unique 59` / `bytes orig 112347 joined 112347` / `IDENTICAL`.
- `git grep -n 'DECISIONS.md' -- . ':!docs/handoff'` returns nothing. No file needs to be listed as allowed.
- `git grep -n DECISIONS -- . ':!docs/handoff'` leaves only the three lines that name no path (plan 316, 541 and 572, playbook 288), and plan 541's "DECISIONS D9", which the owner's permission does not cover.
- `pnpm check`: exit 0 (253 tests passed, 1 skipped; typecheck, lint, drizzle check, i18n check green). `prettier --check docs/decisions docs/DECISIONS.md CONTRIBUTING.md`: all files pass; Prettier changed no moved entry.
- `docs/handoff/*` not edited (81 lines there still cite the old name; the pointer keeps them valid).

## Open issues
- Issues that still tell a session to write an entry in `docs/DECISIONS.md`: 144 (TypeScript 7; "a D-entry in docs/DECISIONS.md" and "docs/DECISIONS.md D8") and 190 (compare events of different kinds; "a D-entry in docs/DECISIONS.md"). Issue 178 (MCP spike) says "what DECISIONS records". Issue 152 is closed. Their sessions must create `docs/decisions/DNN-<slug>.md` and add an index line to the README. The owner may want to edit their text.
- Open PRs 183 and 185 are spikes whose handoffs may say DECISIONS; neither edits the file. If a spike's build later adds an entry, it goes in `docs/decisions/`.
- `docs/IMPLEMENTATION_PLAN.md` lines 316, 541, 572 and `docs/SESSION_PLAYBOOK.md` line 288 still say "DECISIONS" without a path, as the owner's permission requires. Plan 582 still says the file is a single file split at about 25 entries; it is now out of date.
- Other open PRs that add a decision need to rebase and write a file, not a section. None did at the time of the push.

## Next
No session is queued behind this one; the playbook has no prompt after it.
- Model/effort: not applicable.
- Owner first: merge this PR before any session that adds a decision starts, then tell those sessions (issues 144, 190, spike builds) to write `docs/decisions/DNN-<slug>.md`, take the next free number (D61) and add one index line to `docs/decisions/README.md`.
- Plan change: `docs/IMPLEMENTATION_PLAN.md` repo tree (line 582, the note on one file split at about 25 entries) is now out of date. Not edited, because the permission covers paths only.
- `<adjustments>`: next free decision number is D61. A new decision touches only its own file and one line of the README index.

https://github.com/daniro-san/LAPTracker/pull/224
