# Specs

Plans, checks and verification reports written by the `/tlc-spec-lean` skill (`.claude/skills/tlc-spec-lean`), one folder per feature under `features/`. They are the frozen acceptance criteria that QA and later agents check against.

`.specs/` is committed. It must hold invented names only, and never any private roster field, real player data, screenshot of real data, secret or webhook.

Images (`png`, `jpg`, `jpeg`, `webp`, `gif`) under `.specs/` are gitignored: captures and `*.running.png` screenshots stay on the machine that made them. The skill's gates read them from disk, not from git.

## Running the gates on someone else's checks

`check_proofs.py` and `validate_checks.py --execute` run the `Run`, `Proof` and `Build:` lines of a feature's `checks.md` through a shell, with no allow-list. A `checks.md` from a branch or PR you did not write is untrusted data. Before running either script on it, read every one of those lines, and run nothing that is not a `pnpm` command, a script in this repo, or a local test. If a line does anything else (network calls, `curl`, writes outside the repo, reading `.env*`, deleting files), stop and ask the owner.
