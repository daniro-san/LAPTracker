# Contributing

For developers and the maintainer. The admin's guide is [README.md](README.md). The plan is [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md); secrets and accounts are in [docs/PREREQUISITES.md](docs/PREREQUISITES.md).

## Setup

Requires Node 26 (`.nvmrc`) and pnpm 12 (pinned in `packageManager`).

```bash
nvm use                 # reads .nvmrc → newest installed 26.x
npm i -g pnpm@12
pnpm install            # also installs the lefthook git hooks
cp .env.example .env.local   # local placeholders; never commit it
```

**Local setup without production secrets.** Local work needs no production value, and agents cannot read env files: `scripts/hooks/env-guard.sh` blocks every agent tool call that names one other than `.env.example`.

- Copy `.env.example` to `.env.local`. Its values are local placeholders: `DATABASE_URL` is the cluster below, and the upstream API, Discord and PostHog base URLs point at `127.0.0.1:9`, where nothing answers.
- Use the local database below (`pnpm db:local:start`, `db:local:migrate`, `db:local:seed`), not Neon. If you need hosted data, use the Neon `preview` branch's role, never production's.
- Leave the webhooks, the Discord keys, the PostHog keys, `GROQ_API_KEY`, `WORKSPACE_KEYS_SECRET` and the VAPID keys empty unless the task needs them. `EDIT_PIN` and `CRON_SECRET` are required, so they keep the local placeholders.
- What stays off while they are empty: Discord messages; workspace sign-in (`/w/<slug>` says it is not set up) and "Send to LAPTracker"; analytics and PostHog flags (use `LOCAL_FLAGS`); the usage numbers on `/admin` and the desk; Translate and Improve writing; Publish to Discord; saved workspace tracker keys; officers' browser notifications. Upstream reads fail, so pages show the seed's data.

Pre-commit needs [gitleaks](https://github.com/gitleaks/gitleaks) on PATH (`brew install gitleaks`). For cloud sessions (claude.ai/code), paste `scripts/cloud-setup.sh` as the environment's setup script. It installs Node 26, pnpm 12 and gitleaks.

**Local database (no Docker, D47).** A plain Postgres cluster in `.pglocal/` (gitignored), reached by the Neon driver through a small WebSocket bridge. It needs the Postgres server binaries (`initdb`, `pg_ctl`, `postgres`, `psql`) on PATH. macOS: `brew install postgresql@18`, then `export PATH="$(brew --prefix postgresql@18)/bin:$PATH"` (the formula is keg-only, and the `initdb` that Homebrew's `libpq` puts on PATH cannot start a server). Debian or Ubuntu: `apt install postgresql`, then add `/usr/lib/postgresql/<version>/bin` to PATH.

The placeholders in `.env.example` (above) are set up for it. The user, password, port and database name come from `DATABASE_URL`; the bridge listens on `DB_LOCAL_BRIDGE_PORT` (default 54321). Every `db:local` script refuses to run unless the host of `DATABASE_URL` is exactly `localhost` or `127.0.0.1`, so a `.env.local` that points at Neon is never seeded or migrated by them.

```bash
pnpm db:local:start             # first run: initdb; then start the cluster and create the database
pnpm db:local:migrate           # apply drizzle/ through psql
pnpm db:local:bridge            # second terminal; keep it running
pnpm db:local:seed --with-states
pnpm dev:local                  # third terminal; next dev with the preload
pnpm db:local:stop              # when done
```

Seeded members keep the fixtures' photo URLs, so a local page that shows a member photo fetches it from the real photo host; that is not an upstream API call. The member history page (`/alliances/<id>/history`) is empty locally, because the seed does not fill `daily_rosters`.

**End-to-end tests (D150).** `pnpm test:e2e` runs the Playwright suite in `e2e/` on a production build: `next build`, then `next start` on port 3477 with the db:local bridge on 54377. Before the tests it drops and recreates the database `lap_e2e` on your local cluster, migrates it and loads the invented seed (`e2e/fixtures/seed.ts`); your own database is not touched. It needs the cluster running (`pnpm db:local:start`) and a browser, once: `pnpm exec playwright install chromium` (add `webkit` for `E2E_WEBKIT=1`, which also runs the desk flows on an iPhone's WebKit). The cluster's address defaults to `postgres://lap:lap@127.0.0.1:54320/lap_e2e`; set `E2E_DATABASE_URL` if yours differs (the host must be local and the database name must contain `e2e`). The server gets placeholder settings only, not `.env.local`'s, and every outside service points at `127.0.0.1:9`; a test fails if the browser or the server (`next start`) tries to reach any other host; `next build` is not guarded and downloads the Google Fonts. It refuses to start within 10 minutes of 02:00 UTC, when the server's day changes. `E2E_NO_BUILD=1 pnpm test:e2e` reuses the last build; the build replaces `.next`. Add `--project=phone` (360 px) or `--project=wide` (1280 px) for one width, and `--ui` to watch. A failure leaves a trace in `test-results/`: `pnpm exec playwright show-trace <path>`.

## Environment variables

The app's variables are listed in [.env.example](.env.example) and validated by `lib/env.ts` when the server starts. A bad or missing value stops the server with the key names (never the values). Required: `LAP_API_KEY`, `DATABASE_URL`, `CRON_SECRET`, `EDIT_PIN`, and the schedule (`SERVER_TZ`, `EVENT_WEEKDAY`, `EVENT_TIME`, `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `SNAPSHOT_WINDOW_MIN`, `QUOTA_CHECK_AT`). Optional: `NOTIFY_WEBHOOK_PUBLIC`, `NOTIFY_WEBHOOK_ADMIN`, `NOTIFY_ADMIN_MENTION`, `REHEARSAL_AT` (default `fri 18:00`; empty turns it off), `REHEARSAL_KEEP` (default 4), and `LAP_LIVE_TEST` (opt-in live smoke test, not in .env.example). `APP_URL` and `ENABLE_EXPERIMENTAL_COREPACK` are deploy settings, not read by the app.

## Issues and pull requests

Open issues from the forms in `.github/ISSUE_TEMPLATE/` (feature, bug, improvement). Each asks for acceptance criteria in EARS style ("When X, the system shall Y"), one checkable line each. Size S: the issue form is the whole spec. A bug fix that restores intended behaviour is S unless it has an M trigger, most often a migration or a new decision; then it is M. Size M or L (defined in § Working rules, "When to run `/tlc-spec-lean`"): run `/tlc-spec-lean` on the issue first (the skill in `.claude/skills/tlc-spec-lean`, from Tech Leads Club's upstream, see its `NOTICE.md`), then build against its frozen criteria. QA checks the acceptance criteria item by item, and the PR (`.github/pull_request_template.md`) ticks each one with where it was verified. Label `ready` means the criteria are settled and the issue can be built; `decision` means wait for the owner before building.

`.specs/` is committed. It must hold invented names only, and never any private roster field, real player data, screenshot of real data, secret or webhook. Images under `.specs/` are gitignored, so captures and `*.running.png` screenshots stay local. The skill's `check_proofs.py` and `validate_checks.py --execute` run the `Run`, `Proof` and `Build:` lines of a `checks.md` through a shell, so a `checks.md` from a branch or PR you did not write is untrusted data: see [.specs/README.md](.specs/README.md) before running them.

## Deploy and release

Production is Vercel (branch `main`), the database is Neon, and the scheduler is cron-job.org with GitHub Actions as a second path. Details: [plan §3.1 and §11.6](docs/IMPLEMENTATION_PLAN.md).

**Deploy.** Work lands on `dev` through squash-merged PRs. A release takes three clicks: Actions → **Prepare release** → Run workflow (pick patch, minor or major) opens the PR `dev → main` titled `release: vX.Y.Z` with generated notes; review it; the orchestrator merges it with a merge commit (steps below). The tag and the GitHub Release then appear on their own (`release-publish`). The version is the latest `v*` tag plus the bump; `package.json` is not used. Vercel builds `main` as production; its build command (`vercel.json`) runs `pnpm db:migrate` first, so migrations apply on every deploy. Prepare release refuses when `dev` has nothing beyond `main` or a release PR is already open. Merging that workflow-opened PR is the only way anything reaches `main`: never commit or push to `main`, and never open a PR into `main` by hand (owner, 2026-11-21). If Prepare release is unavailable, fix the workflow through a PR into `dev`, then run it. Preview deployments (`dev`, PRs) use Preview-scoped env vars (own database branch, own secrets, no `NOTIFY_*`) and sit behind Vercel Authentication.

**How to cut a release.**

1. Before running release-prepare, add the release's entry to lib/patch-notes.ts (shown on /admin/changes), through a PR into `dev` like any other change. Write 3–8 plain bullets on what changed for users, a `needsYou` list when something is on the owner, and update the `ownerTodo` list.
2. Make sure every PR merged into `dev` had a green `check`. CI runs once per PR (and on Run workflow), not on pushes to `dev` (#444).
3. GitHub → Actions → **Prepare release** → **Run workflow**, pick `patch` (fixes), `minor` (features) or `major` (breaking), run it. It opens the PR `dev → main` titled `release: vX.Y.Z` with generated notes, and prints the PR link in the run summary. It stops with a message if `dev` has nothing new or a release PR is already open.
4. Open the PR and read the notes. Its `ci` run (`pull_request`) waits for approval, because the workflow opened the PR with `GITHUB_TOKEN`: approve it (Actions → the held run → Approve and run, or `gh api -X POST repos/daniro-san/LAPTracker/actions/runs/<id>/approve`). A `check` from a Run workflow on `dev` does not count toward the PR's required checks, so Prepare release no longer starts one; a release still runs `ci` once. When `check` is green, the orchestrator merges with **Create a merge commit** (the only method `main` allows): `gh pr merge <n> --merge --match-head-commit <sha>`, with the SHA whose `check` it saw. If a PR merged into `dev` after Prepare release ran, the release PR's head moved and its `ci` runs again on that push; approve it if held, wait for green, then merge with the new SHA.
5. About 10 seconds later, `release-publish` creates the tag `vX.Y.Z` and the GitHub Release (Actions → release-publish; Releases page). Vercel deploys `main` and runs the migrations by itself.

The next version is the latest `v*` tag plus the bump, so `package.json` is never edited. If the PR is wrong, close it and run Prepare release again. If the tag or release does not appear, run `gh release create vX.Y.Z --target main --generate-notes`. Why it works this way: [D29](docs/decisions/D29-releases-prepare-release-opens-the-pr.md).

**GitHub repository secrets.** `APP_URL` (the production origin, no trailing slash) and `CRON_SECRET` (must equal the Production value in Vercel).

**Scheduler.** The job "Vercel Ticker" on cron-job.org calls `POST /api/tick` every 15 minutes with the header `Authorization: Bearer <CRON_SECRET>` (D30). GitHub's own schedule has never started a run in this repository, so it is not relied on. To check it, open the job's History on cron-job.org: each run should show `204 No Content` when nothing is due. A `401` means its `CRON_SECRET` differs from the one in Vercel Production.

**Workflows.**

- `tick.yml` calls `POST /api/tick` on its own schedule (minutes 7, 22, 37 and 52 of every hour, D26) and from Actions → tick → Run workflow, where `phase` is `tick`, `before` or `after`. It fails on any non-2xx. All scheduling decisions live in the app. Do not add retries.
- `keepalive.yml` pushes a timestamp to the `keepalive` branch monthly, so GitHub does not disable the schedule after 60 days without activity. Vercel never builds that branch.
- `smoke.yml` sends `GET /` and `GET /players` after Vercel reports a successful deploy of `main`'s head (`status` event, D46), and from Actions → smoke → Run workflow. It prints each HTTP code and fails on any non-2xx. It has no retries and no alert: look at the Actions tab after each release.
- `dependabot-automerge.yml` squash-merges Dependabot minor/patch PRs into `dev` once CI is green. Majors and the `lint-format` group (formatter and linter bumps, which can reformat files) wait for a human (D151). Dependabot proposes a version only after it is 7 days old (14 for majors).

**Change the alliance list.** Edit `config/alliances.ts` and release. An event already created keeps its own copy of the list.

**Change snapshot times.** Edit `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `EVENT_TIME`, `SNAPSHOT_WINDOW_MIN` or `QUOTA_CHECK_AT` (server time) in Vercel's Production env vars, then redeploy. A scheduled event's row is created a day ahead and keeps its times, so a change applies from the next event row.

**Rotate the API key or the PIN.** Change `LAP_API_KEY` or `EDIT_PIN` in Vercel Production, redeploy, and update the copy in `.env.local`. For `CRON_SECRET`, change it in Vercel, in the GitHub secret **and** in the cron-job.org job's header, then redeploy production. Never paste any of them into a PR, issue or chat.

## Scripts

| Command                                      | Does                                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`     | Next.js                                                                                                                                                                                                          |
| `pnpm check`                                 | all gates: `prettier --check`, `eslint`, `tsc --noEmit`, `vitest run`, `scripts/check-drift.ts` (migrations match the schema), `scripts/i18n-check.ts` (translations are current). CI runs this                  |
| `pnpm test` / `pnpm typecheck`               | Vitest / `tsc --noEmit`                                                                                                                                                                                          |
| `pnpm test:e2e`                              | the Playwright suite on a production build and the local cluster ("End-to-end tests" above)                                                                                                                      |
| `pnpm lint` / `pnpm format`                  | ESLint / Prettier (write)                                                                                                                                                                                        |
| `pnpm db:generate` / `pnpm db:migrate`       | Drizzle migration file from `lib/schema.ts` / apply migrations                                                                                                                                                   |
| `pnpm db:seed`                               | three invented past Saturdays from `fixtures/`, for local screens. Never against production; `--reset` empties the tables first; `--with-states` adds an empty event a week ahead and one whose After is running |
| `pnpm db:local:start` / `pnpm db:local:stop` | start (and on first use `initdb`) / stop the local cluster in `.pglocal/`, on 127.0.0.1 at the port of `DATABASE_URL`. Local `DATABASE_URL` only                                                                 |
| `pnpm db:local:migrate`                      | apply `drizzle/` to the local cluster through `psql`, in journal order; skips what is already applied, by the same journal table as `pnpm db:migrate`. Local `DATABASE_URL` only                                 |
| `pnpm db:local:bridge`                       | WebSocket → TCP bridge from `DB_LOCAL_BRIDGE_PORT` (default 54321) to the local cluster. Local `DATABASE_URL` only                                                                                               |
| `pnpm db:local:seed`                         | `pnpm db:seed` (same flags) through the bridge. Local `DATABASE_URL` only                                                                                                                                        |
| `pnpm dev:local`                             | `pnpm dev` with `scripts/db-local-preload.mjs`, which sends the Neon driver's WebSocket to the bridge when `DATABASE_URL` is local                                                                               |
| `pnpm snapshot:dry`                          | one snapshot (`--phase before\|after`) through the real adapters with fixtures served instead of the network. No database, no quota                                                                              |
| `pnpm i18n:todo` / `pnpm i18n:stamp`         | the translation work list as JSON / mark translated keys as current                                                                                                                                              |

**Migrations.** Change the schema files `drizzle.config.ts` lists (`lib/schema*.ts`), then run `pnpm db:generate`; never hand-edit `drizzle/meta`. A data backfill may be added by hand to the generated `.sql` (as in `0061`). If a rebase brings in a migration with the same number as yours, set your `.sql` aside, restore `drizzle/meta` from `dev`, run `pnpm db:generate` again, and copy any hand-added statements into the new file.

## How the harness works

The code is written mostly by Claude Code sessions with a human reviewing. Every check is a script, not a memory:

- **CLAUDE.md** holds the standing rules every session reads. **`.claude/rules/*.md`** load only when an agent touches the matching paths (collector, API routes, tests, the private workspace).
- **Hooks** (`.claude/settings.json`, committed, so they also run in cloud sessions):
  - SessionStart → `scripts/install_pkgs.sh` installs deps when the lockfile changed and puts Node 26 on PATH in the cloud.
  - Every Edit/Write → `eslint --fix` on that file; remaining errors go straight back to the agent.
  - Every Bash call → `scripts/hooks/pr-base-guard.sh` refuses a `gh pr create` without `--base dev`.
  - Every Bash, Read, Grep and Glob call → `scripts/hooks/env-guard.sh` refuses one that names an env file other than `.env.example`, or dotenv.
  - Stop → `pnpm check`; the main session's turn can't end while it fails, or while the tree has changes and `node_modules` is missing, until two fix rounds in a row have failed (then the turn ends with a notice to the user). Subagents fire `SubagentStop`, which has no hook.
- **Enforcement layers** (nobody commits or pushes to `dev` or `main`; `main` changes only by merging the release-prepare PR). The guard is GitHub's: the `dev` and `main` rulesets require a PR and `check`, block force pushes and deletion (`dev` also requires linear history), and have no bypass actors, so `--admin` cannot get past them. Behind it, in order:
  - the lefthook pre-commit job refuses a commit on `dev` or `main`;
  - the deny patterns in `.claude/settings.json` (pushes to `dev`/`main`, PRs into `main`, `--admin`, `--no-verify`, write `gh api` calls, secret `.env` reads);
  - the PreToolUse and Stop hooks.

  The client-side layers match command text, so `pnpm exec git push`, `git -C …` or another spelling gets past them; they catch mistakes, not intent. `git push -u origin HEAD` stays allowed: on `dev` or `main` the lefthook job stops the commit first, and GitHub rejects the push.

- **Pre-commit** (lefthook): prettier and eslint on staged files, and gitleaks for secrets (the repo is public).
- **CI** (`.github/workflows/ci.yml`): `pnpm check` and `pnpm audit --audit-level high` once per PR (into `dev`, and the release PR into `main`, whose run waits for approval) and on Run workflow, not on push; a PR that touches only `docs/**` or `*.md` runs `prettier --check` only (#444). `.github/workflows/e2e.yml` runs `pnpm test:e2e` against a Postgres service container on every PR into `dev`, a required check that skips the build and tests when a PR changes nothing the app runs, and with WebKit on `dev` when Prepare release dispatches it and on a daily cron (D150). Dependabot sends weekly grouped updates.
- **Translations**: the public pages' English strings (`lib/copy.ts`) are translated into `lib/i18n/<language>.ts`. A missing key reads English. `pnpm check` reports stale or missing keys, and the `translate-copy` skill (`.claude/skills/translate-copy`) fills them with the `translator` agent (`.claude/agents/translator.md`).
- **Fixtures** are recorded only through the `record-fixture` skill (`.claude/skills/`), because it spends API quota.
- **Review**: `/code-review` checks changes against [REVIEW.md](REVIEW.md); `/pr-review` reads it through `.claude/pr-review.md`.
- **Docs**: [ARCHITECTURE](docs/ARCHITECTURE.md) (one dependency rule), [GLOSSARY](docs/GLOSSARY.md) (one word per concept), [decisions](docs/decisions/README.md) (append-only), and `docs/handoff/` (one file per PR). Persona and UX validation rules: [DESIGN.md § Validation](docs/DESIGN.md).
- **Memory**: repo-level rules live in the harness files above; an agent's private memory may hold only machine- or orchestrator-specific notes.

## Working rules

- **Closing issues.** `Closes #N` in the PR body, written as plain prose, closes the issue when the PR merges into `dev` (`.github/workflows/close-issues.yml`). GitHub itself ignores it, because `main` is the default branch. Inside code, inline code or a quote it does nothing, and `Part of #N` or a bare `(#N)` never closes. Close an issue by hand only when no PR closes it.
- **Review depth by risk.** Changes to `lib/private`, privacy or quota get the full panel: personas, an adversarial reviewer, QA and `/pr-review`. Low-risk UI or copy changes get one reviewer, QA and `/pr-review`. Every new PR gets `/pr-review` before merge; PRs already in production are not re-reviewed.
- **When to run `/tlc-spec-lean`.** Size every feature, improvement and bug fix before building it. Work asked for in chat with no issue follows the same rule: the orchestrator or build agent sizes it and records the size in the PR. M and L run `/tlc-spec-lean` first; S builds from the issue form or the chat request.
  - **M** is any of: a new route or page; a migration; a new decision (`docs/decisions`); a change to how private roster fields flow (`lib/private`, D71, D76, D142); a new external call or quota use; a flow across two or more screens.
  - **L** is work that needs more than one PR, as judged when planning, or that adds a new top-level desk tab or a new family of public pages. L wins over M. **S** is everything else.
  - **Bug fixes.** A bug fix that restores intended behaviour is S: the form is its spec. It is M when it has an M trigger, most often a migration or a new decision.
  - **Not sized (n/a):** docs and harness chores; copy-only changes; dependency bumps. An M trigger or a one-way door always wins over this list and over the bug-fix rule: a chore or bug fix that changes a private-field flow or adds quota use is M, and a one-way door goes to the owner.
  - **Plan review.** The product-strategy persona and an adversarial reviewer review the plan, and their verdicts go in the PR. The skill's `**Approved**` line quotes a person's own words; an agent never writes words the owner did not say.
    - Standing approval (owner, 2026-11-21): "go with what you and the personas recommend". It covers a plan both verdicts approve, with no one-way door and no `decision` label. Its line is `**Approved**: <date> - user: "go with what you and the personas recommend" (owner, 2026-11-21, standing approval in CONTRIBUTING.md § Working rules); product-strategy verdict: <link>; adversarial verdict: <link>`.
    - A plan with a one-way door, or for an issue labelled `decision`, goes to the owner. Its `**Approved**` line quotes the owner's own reply on that plan.
    - One-way doors: deleting data; a schema change that is hard to undo; a change to privacy or to what private fields reach; a change in quota spend; a new dependency.
- **Review findings are input.** Fix before merge only real bugs, regressions, privacy problems and contradictions with a decision. Turn the rest into a follow-up issue or drop it, and say which. Don't spend a fix round on style-only or speculative findings.
- **Visible value first.** Keep at least one decision-useful view moving in every batch, and build infrastructure only as far as the next view needs. Never hold a finished PR that other work waits on. If `dev` is red, fix it first in a small `fix/` PR.
- **Performance and database cost: user value first.** Never make these staler:
  - the night read;
  - Raid prep;
  - member cards right after a read;
  - the status bar while a read runs.

  Prefer changes users can't see or that make pages faster, and on-demand reads with a cache over scheduled work.

- **Copy.** Write like a person, in plain words. Before you cut or change a user-facing string, grep `docs/decisions` for it. If a decision quotes it, append a dated amendment at the end of that decision (see [Adding a decision](docs/decisions/README.md)); never rewrite the decision's earlier text.
- **Analytics plan, every change.** Every feature or change says in its PR what it adds to, changes in and removes from [the tracking plan](docs/analytics/tracking-plan.md), or "no change" and why.
  - **Add:** the event and the product question it answers. Properties come from a closed list and never carry a name or a private field: follow the plan's "Rules for every event".
  - **Change:** a property, when the event fires, or what a funnel step means. When a number's meaning changes, add a dated line to the plan's "Changed" section.
  - **Remove:** take the event out of both the code and the plan. `lib/analytics/events.test.ts` fails when the code sends an event the plan lacks, and when an Event column in the plan's tables names an event that is no longer in the code's event lists (`ANALYTICS_EVENTS`, `ServerEvents`).
  - **PostHog side:** when a PostHog insight, dashboard or Endpoint uses the event (the Endpoints `lap_board_reach` and `lap_alliance_usage`, D145), check it read-only. A change it needs on the PostHog side becomes an owner to-do in `lib/patch-notes.ts` (`ownerTodo`).
- **Tests check real behaviour (owner, 2026-11-21).** A test protects a user flow, a user action, or a rule a decision or the plan states, never a test count or coverage. This bullet is the one place for what a test must protect and for the fake-test list. CLAUDE.md says when to add tests; `.claude/rules/tests.md` covers which kind of test fits which code, naming, fixtures, time, mocks and what end-to-end tests assert.
  - Its name is the behaviour as a user or the system sees it ("an officer's mark survives a reload", "a 31-day-old error is purged by the daily read"), not the function it calls.
  - Inputs look like real use: invented names, but realistic shapes, sizes and timing (server weekdays, KvK Saturday, the 23:30 ST read).
  - Fake tests, which review flags: a test that only asserts a mock was called with what the test itself passed; a snapshot of implementation details; a test of a private helper with no behaviour of its own; a duplicate of another test's behaviour; an assertion that can't fail.
  - A guard test for a stated invariant is fine when it names the rule it guards, e.g. a private field never reaches analytics (D71, D115), or every event is in the tracking plan. A fast-check property test of a pure invariant (`lib/compute.ts`, `lib/budget.ts`) is fine too.
  - When a test breaks because the app's behaviour changed on purpose, change the test with it. Don't loosen it until it passes.
  - Recommended, pending the owner's confirmation (2026-11-21): a PR whose task changes a desk flow, or the numbers a public page shows, updates that flow's end-to-end assertion in the same PR, as with any test the change breaks. It adds no new tests beyond what CLAUDE.md allows.
  - An end-to-end test asserts what the user sees: the heading, the seeded values as the page formats them, and the screen after each action. A request or a status code alone is never enough (`.claude/rules/tests.md`).
- **The repo is public.** Use invented names and values everywhere: code, tests, fixtures, handoffs, docs, screenshots and commit messages. Never copy lines from private chats or member screenshots, and never commit a real game screenshot or Discord post. Grep your diff for real roster names before committing.
- **Feature flags (D91).** The public features in `FLAGS` (`lib/flags.ts`) show only when their PostHog flag is on; `LOCAL_FLAGS` turns them on locally. Check the flag before calling a feature missing.
- **Local processes.** Use your own ports. Stop what you started by PID or port, never by a name pattern (`pkill`, `killall`).
- **Worktrees.** A fresh worktree has no `node_modules`: run `pnpm install --frozen-lockfile` there. Turbopack refuses a symlinked `node_modules`.
- **The new-alliance guide.** After a release that changes a workspace onboarding or settings flow (sign-in, invite, Alliance settings, export and delete, feature switches), the guide kept outside the repo needs fresh screenshots, with names, avatars, messages and ids blurred. Say so in the handoff.
