# chore-env-safety: a guard against accidental agent reads of local env files; local work without production secrets

The owner (2026-11-21) approved this recommendation: agents must not read local secret files, and local development must work without production secrets. Branch `chore/env-safety` from `origin/dev`. Part of #592.

The real protection is that the local env file holds no production secret, which is the owner's to-do below. The hook only catches an agent's accidental read. It matches the text of a tool call, so it is not a sandbox.

## Built

- **`scripts/hooks/env-guard.sh`**: a PreToolUse hook for Bash, Monitor, Read, Grep and Glob, registered in `.claude/settings.json`. It reads Bash's and Monitor's `command`, Read's `file_path`, Grep's `path` and `glob`, and Glob's `pattern` and `path`, with jq, or with node when jq is missing. It exits 2 with a one-line reason when the input has any of these (names match case-insensitively):
  - **an env file name:** a word that starts with `.env` and is not `.env.example` (a trailing `.`, `!` or `?` is ignored). A word character, a backslash, `)` or `]` before it means it is not a file name, so `process.env`, "environment", the regex `process\.env` and `getAppContext().env` pass;
  - **a dotenv load** in a shell command: `-r`/`--require`/`--import dotenv`, `dotenv/config`, `require('dotenv')`, `from 'dotenv'`, `dotenvx run`, or `dotenv` as the command. A mere mention such as `git log --grep=dotenv` passes;
  - **a glob that matches an env file:** a word whose last part starts with `.` and matches an env file name, such as `.e*`, `.*` or `.[e]nv.local`. This applies to shell words, Glob patterns and Grep globs;
  - **a search that prints env files' lines without naming them** (shell commands only), when a path it searches is the repo root, a parent of it, `.`, `..`, `~` or omitted:
    - `grep -r`/`-R`, unless an `--exclude=` glob covers every env file name;
    - `rg` with `-u`, `--no-ignore*`, `--hidden` or `-.`;
    - `find` with `-exec`/`-execdir`/`-ok`, or with `xargs` later in the command.

    The block message points to the Grep tool, which respects .gitignore.
  - **input it cannot check:** not JSON, empty, or neither jq nor node on PATH. These are refused (fail closed).

  It lets through:
  - `.env.example`;
  - `pnpm <script>` (the `--env-file-if-exists` is in package.json, not in the command);
  - `git grep`;
  - recursive searches limited to named folders (`grep -rn X lib app`).
- **`scripts/hooks/env-guard.test.ts`**: 30 cases.
  - Blocked (16): `cat .env.local`, `grep KEY .env`, `ls -a | xargs cat .env*`, `cat .ENV.LOCAL`, `cat .[e]nv.local`, `node -r dotenv/config …`, `grep -rn DATABASE_URL .`, `rg --hidden DATABASE_URL`, `find . -type f -exec cat {} +`, Monitor `tail -f .env.local`, Read `…/.env.local`, Grep path `.env.production`, Glob `**/.e*`, Glob `**/.e?v.local`, Glob path `…/.env`, Grep glob `.e*`.
  - Refused (1): input that is not JSON.
  - Allowed (13): `cat .env.example`, Read `…/.env.example`, `pnpm dev:local`, `pnpm db:local:seed --with-states`, `git status`, `grep -rn 'process.env.EDIT_PIN' lib && echo environment`, `grep -rn 'process\.env' lib`, `grep -rn DATABASE_URL lib app`, `grep -rn --exclude='.env*' DATABASE_URL .`, Glob `**/*.ts`, `git commit -m "docs: copy .env.example."`, `grep -rn 'getAppContext().env' app`, `git log --grep=dotenv`.
- **`.claude/settings.json`**:
  - the hook matcher is `Bash|Monitor|Read|Grep|Glob`. Monitor is the only other tool in this Claude Code version that runs a shell command, and it takes `command` like Bash;
  - `permissions.deny` gets `Read(//**/.env.local.*)` and the Bash equivalents of the env Read rules: `.env` as a word or after `/`, `.env.local*`, `.env.dev*`, `.env.prod*`, `.env.preview*`, `.env.staging*`, `.env.test*`, `.env.vercel*`, and the dotenv loads `dotenv/config`, `dotenvx run`, `-r dotenv`, `--require dotenv`;
  - `permissions.deny` also refuses `fixture:record` to agents, in the same shape as the `db:seed` rules: `pnpm fixture:record*`, `pnpm run fixture:record*`, `pnpm*fixture:record*`, `npm*fixture:record*`, and `tsx`/`node` of `scripts/record-fixture.ts`.
- **`.env.example`**: every variable the app reads, each with a one-line comment. Values:
  - the required ones: local placeholders;
  - the outside services' base URLs: `127.0.0.1:9`;
  - the optional secrets: empty.

  Line 1 says Vercel uses its own values, never these. `QUOTA_CHECK_AT` is now quoted, so a shell can source the file. A closing comment names what is deliberately not set (Vercel's system variables, `LAP_LIVE_TEST`, `LAP_SMOKE_OUT`, `OCR_TEST`).
- **`lib/env.ts`**: unchanged. A production guard that refused the template's placeholders was built and then taken out by the orchestrator: nobody can read production's values while the owner is away, and a match would have stopped every request on the next deploy. It goes in after the owner's check (Next).
- **record-fixture**:
  - new `pnpm fixture:record` (`scripts/record-fixture.ts`, `tsx --env-file-if-exists=.env.local`). It takes `<path under /v1> <output file>` lines on stdin and calls the upstream default base URL from `lib/env.ts` with `USER_AGENT` from `lib/sources/shared.ts`. It neutralises every output except `/tmp/` paths (D76) and stops at 401/403/429. It spends one quota call per line, so it refuses to start unless `FIXTURE_RECORD_CONFIRM=spend` is set, and agents are denied it;
  - `scripts/record-fixture.test.ts`: without the variable, the script makes no call and writes nothing. The run is under `e2e/no-network.mjs`, so even a broken check reaches no outside host;
  - `.claude/skills/record-fixture/SKILL.md` §2 and §3: the agent writes the call list and the command; the owner runs `FIXTURE_RECORD_CONFIRM=spend pnpm -s fixture:record` in his own terminal and pastes the output back. The agent no longer greps the env file for the key. The claim that a placeholder's 401 spends no quota is gone (unknown, `docs/handoff/00-prereqs.md`).
- **CLAUDE.md**: the secrets rule now reads "Code and `pnpm` scripts read secrets from the local env file (.env.local) or the environment; agents never open, print or search that file".
- **CONTRIBUTING.md**:
  - "Local setup without production secrets": the hook is a guard against accidental reads, not a sandbox; the owner creates `.env.local` from `.env.example`; how a fresh worktree runs the app without one;
  - the hook's line in "How the harness works";
  - a `pnpm fixture:record` row in Scripts.
- **D03**: a dated amendment: the template's placeholders are public and must never be production's values.

## Decisions

- **Required secrets get placeholders.** `EDIT_PIN` and `CRON_SECRET` are required by `lib/env.ts`, so the template gives them local placeholders. Now that these are public, production must not use them (owner check first, then a guard).
- **Quoted mentions are blocked too.** The guard blocks a mention of a secret env file name in a shell command even inside quotes, commit messages included. Stripping quotes would let `echo "$(cat .env.local)"` through.
- **Recursive searches use a path rule.** A recursive search counts only when a path it searches contains the repo root's top level, where the env files are, so `grep -r X lib` passes. A command that `cd`s into `lib` and then searches `.` is blocked (false positive).
- **The fixture script is the owner's.** CLAUDE.md forbids spending quota unless a session allows it, and `Bash(pnpm *)` would let an agent run the script without a prompt. So there are two layers: a deny rule for agents, and a confirmation variable in the script for anyone.
- **dotenv is blocked only where it loads a file.** A mention (a `git log --grep`, a package name in prose) passes, in both the hook and the deny rules.
- **The fixture script always uses the real upstream URL** (lib/env.ts's default). A local `LAP_API_BASE_URL` points at `127.0.0.1:9`, and the skill always meant the real API.
- **Fresh worktree:** export the template into each command (`set -a; . ./.env.example; set +a; …`). Agents cannot create `.env.local`, and Next and the `--env-file-if-exists` scripts both read from the process environment.

## Deviations

- The coordinator asked for `git reset --hard origin/chore/env-safety`. That command is denied in settings.json. I ran `git rebase origin/chore/env-safety` instead, in both review rounds: nothing local was dropped, and this round starts from d91f380d.

## Verified

- `pnpm check`: passed (prettier, eslint, tsc, vitest 308 files / 1615 tests passed, 2 files / 4 tests skipped, drift, i18n).
- Each new hook case fails when its check is removed. I removed one check at a time in a copy of the script and restored it afterwards (byte-compared):

  | Check removed | Case that fails |
  |---|---|
  | lowercasing | `.ENV.LOCAL` |
  | the backslash rule | `process\.env` |
  | the `--exclude=` strip | the `--exclude='.env*'` allow |
  | `covers_env` | the same allow |
  | the dotenv line | `dotenv/config` |
  | the wildcard line | `.[e]nv.local` and Glob `**/.e*` |
  | the recursive line | grep, rg and find |
  | `grep_reaches` alone | the grep case only |
  | `rg_reaches` alone | the rg case only |
  | `find_reaches` alone | the find case only |
  | the path rule (every path counts) | `lib app`, `process\.env` and `EDIT_PIN` allows |
  | Monitor in the parser | the Monitor case |
  | fail closed | the non-JSON case |
  | Grep's `glob` key in the parser | Grep glob `.e*` |
  | Glob's `path` key in the parser | Glob path `…/.env` |
  | `?` in the wildcard test | Glob `**/.e?v.local` |
  | the trailing-punctuation strip | the `copy .env.example.` allow |
  | `)` and `]` before `.env` | the `getAppContext().env` allow |
  | the dotenv rule back to "any mention" | the `git log --grep=dotenv` allow |
  | the wildcard line (again) | `.[e]nv.local`, Glob `.e*`, Glob `.e?v.local`, Grep glob `.e*` |

  The first round's results still hold: with the guard always allowing, the 7 original block cases fail; with it always blocking, the allow cases fail; with the script missing, every case fails.
- 64 sample inputs (42 last round, 22 this round: the false positives, dotenv forms and new keys) gave the expected exit codes under macOS `/bin/bash` 3.2. 13 inputs gave the same codes with jq and with node only. With neither on PATH, the hook refuses. A 400-line command takes 0.2 s.
- `scripts/record-fixture.test.ts` passes. With the confirmation check disabled it fails: the run exits on the refused host, and no outside host was reached. No quota was spent in this PR. The script was only run with empty stdin, or stopped before any call.
- Fresh worktree with no local env file: the template exported in the shell, then `db:local:start`, `migrate`, `bridge` and `seed --with-states`, then `dev:local -p 3490` (cluster 54390, bridge 54391). `/` and `/admin` answered 200. Everything I started was stopped by PID, and the cluster with `db:local:stop`. `.pglocal/` stays in the worktree (gitignored).
- No `.env*` file other than `.env.example` was opened, read or printed.

## Open issues

What the guard does not cover. It catches mistakes, not intent:

- names built at runtime or split by quoting: `f=.e; cat ${f}nv.local`, `cat .e""nv.local`, a variable holding the path;
- programs that open the file themselves. An example is `bash scripts/probe-v1.sh`, which greps `.env.local` for the key; the command text never names the file. The same goes for a `node`, `python` or `tsx` one-off that builds the path;
- searchers and readers it does not parse:
  - `ag`, `ack`, `git grep --no-index`;
  - `ls -a | xargs cat` with no `find`;
  - `grep`/`rg` long options whose argument comes as a separate word, which can be misread as a path;
- tools outside the matcher: MCP tools, and Write/Edit (overwriting is possible; Edit needs a prior Read, which is denied);
- sessions that started before this change, which load hooks at start.

Known false positives:

- any shell command that mentions a secret env file name, commit messages included;
- `.env.e*` (it could only match the template);
- a recursive grep of `.` after a `cd` into a subfolder;
- `find . … | xargs …` even when the find only selects `.ts` files.

Follow-ups for the owner:

- `docs/SESSION_PLAYBOOK.md` lines 95, 162 and 221 still say to read the key from `.env.local`. CLAUDE.md forbids editing that file in a session, so it needs the owner or a playbook update.
- `scripts/probe-v1.sh` (owner-run) still greps `.env.local`. Leave it, or route it through `pnpm fixture:record`.

## Next

- Model/effort: keep. The review round's findings were text-matching gaps, and the fixes are covered by mutation-checked cases.
- Owner first, on his own machine:
  1. Remove the production secrets from `.env.local`. Either start again from `cp .env.example .env.local` with `pnpm db:local`, or point `DATABASE_URL` at the Neon `preview` branch's role and password, never production's.
  2. Check that production's `EDIT_PIN` and `CRON_SECRET` are not the template's placeholders; then ask for the `lib/env.ts` guard that refuses them in production.
  3. If he wants, rotate everything that was ever in `.env.local`: the upstream API key, the Neon password, `CRON_SECRET`, `EDIT_PIN`, the Discord webhooks, client secret and bot token, the PostHog personal keys, `GROQ_API_KEY`, `WORKSPACE_KEYS_SECRET` (every saved workspace tracker key must then be entered again) and the VAPID private key. Then update Vercel, the GitHub secret and the cron-job.org header (D30).
  4. To record a fixture, the agent hands over the command. Run `FIXTURE_RECORD_CONFIRM=spend pnpm -s fixture:record` in your own terminal, with the real key in the environment or in `.env.local` for that run only, and paste the output back. Agents are denied the script and never see the key.
  5. Restart running Claude Code sessions so they load the hook.
- Plan change: none. `docs/SESSION_PLAYBOOK.md` line 162 repeats the old secrets rule (see Open issues).

What was missing from the task prompt?

- `EDIT_PIN` and `CRON_SECRET` are required and cannot be empty.
- Blocking the copy leaves agents in a fresh worktree with no `.env.local`.
- The record-fixture skill read the key with grep, which the new rule forbids.
- Whether Monitor and the recursive searchers were in scope.

<adjustments>
- Agents cannot read `.env.local`. A task that needs a real value has the owner run the command, or uses a `pnpm <script>`, which loads the file into the app only. Fixtures are recorded by the owner (`FIXTURE_RECORD_CONFIRM=spend pnpm -s fixture:record`).
- In a fresh worktree, run the app as `set -a; . ./.env.example; set +a; pnpm dev:local` (same prefix for `db:local:*`), on ports of its own.
- Production must not use the template's `EDIT_PIN` and `CRON_SECRET`. Nothing in code refuses them yet: the owner checks Vercel's values first (D03).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/612
