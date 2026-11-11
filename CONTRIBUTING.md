# Contributing

For developers and the maintainer. The admin's guide is [README.md](README.md). The plan is [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md); secrets and accounts are in [docs/PREREQUISITES.md](docs/PREREQUISITES.md).

## Setup

Requires Node 26 (`.nvmrc`) and pnpm 12 (pinned in `packageManager`).

```bash
nvm use                 # reads .nvmrc → newest installed 26.x
npm i -g pnpm@12
pnpm install            # also installs the lefthook git hooks
cp .env.example .env.local   # fill in; never commit it
```

Pre-commit needs [gitleaks](https://github.com/gitleaks/gitleaks) on PATH (`brew install gitleaks`). For cloud sessions (claude.ai/code), paste `scripts/cloud-setup.sh` as the environment's setup script. It installs Node 26, pnpm 12 and gitleaks.

**Local database (no Docker, D47).** A plain Postgres cluster in `.pglocal/` (gitignored), reached by the Neon driver through a small WebSocket bridge. It needs the Postgres server binaries (`initdb`, `pg_ctl`, `postgres`, `psql`) on PATH. macOS: `brew install postgresql@18`, then `export PATH="$(brew --prefix postgresql@18)/bin:$PATH"` (the formula is keg-only, and the `initdb` that Homebrew's `libpq` puts on PATH cannot start a server). Debian or Ubuntu: `apt install postgresql`, then add `/usr/lib/postgresql/<version>/bin` to PATH.

Put these values in `.env.local`. They are placeholders: nothing here reaches Neon or the upstream API, because both upstream base URLs point at `127.0.0.1:9`, where nothing answers.

```bash
DATABASE_URL=postgres://lap:lap@127.0.0.1:54320/laptracker
DB_LOCAL_BRIDGE_PORT=54321
LAP_API_KEY=lap_local-placeholder
LAP_API_BASE_URL=http://127.0.0.1:9/v1
LAP_SITE_BASE_URL=http://127.0.0.1:9/api
CRON_SECRET=local-placeholder-cron-secret-0123456789
EDIT_PIN=000000
SERVER_TZ=Etc/GMT+2
EVENT_WEEKDAY=6
EVENT_TIME=12:00
SNAPSHOT_BEFORE=10:00
SNAPSHOT_AFTER=14:00
SNAPSHOT_WINDOW_MIN=45
QUOTA_CHECK_AT=fri 20:00
```

The user, password, port and database name come from `DATABASE_URL`; the bridge listens on `DB_LOCAL_BRIDGE_PORT` (default 54321). Every `db:local` script refuses to run unless the host of `DATABASE_URL` is exactly `localhost` or `127.0.0.1`, so a `.env.local` that points at Neon is never seeded or migrated by them.

```bash
pnpm db:local:start             # first run: initdb; then start the cluster and create the database
pnpm db:local:migrate           # apply drizzle/ through psql
pnpm db:local:bridge            # second terminal; keep it running
pnpm db:local:seed --with-states
pnpm dev:local                  # third terminal; next dev with the preload
pnpm db:local:stop              # when done
```

Seeded members keep the fixtures' photo URLs, so a local page that shows a member photo fetches it from the real photo host; that is not an upstream API call. The member history page (`/alliances/<id>/history`) is empty locally, because the seed does not fill `daily_rosters`.

## Environment variables

The app's variables are listed in [.env.example](.env.example) and validated by `lib/env.ts` when the server starts. A bad or missing value stops the server with the key names (never the values). Required: `LAP_API_KEY`, `DATABASE_URL`, `CRON_SECRET`, `EDIT_PIN`, and the schedule (`SERVER_TZ`, `EVENT_WEEKDAY`, `EVENT_TIME`, `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `SNAPSHOT_WINDOW_MIN`, `QUOTA_CHECK_AT`). Optional: `NOTIFY_WEBHOOK_PUBLIC`, `NOTIFY_WEBHOOK_ADMIN`, `NOTIFY_ADMIN_MENTION`, `REHEARSAL_AT` (default `fri 18:00`; empty turns it off), `REHEARSAL_KEEP` (default 4), and `LAP_LIVE_TEST` (opt-in live smoke test, not in .env.example). `APP_URL` and `ENABLE_EXPERIMENTAL_COREPACK` are deploy settings, not read by the app.

## Deploy and release

Production is Vercel (branch `main`), the database is Neon, and the scheduler is cron-job.org with GitHub Actions as a second path. Details: [plan §3.1 and §11.6](docs/IMPLEMENTATION_PLAN.md).

**Deploy.** Work lands on `dev` through squash-merged PRs. A release takes three clicks: Actions → **Prepare release** → Run workflow (pick patch, minor or major) opens the PR `dev → main` titled `release: vX.Y.Z` with generated notes; review it; **Merge** it with a merge commit. The tag and the GitHub Release then appear on their own (`release-publish`). The version is the latest `v*` tag plus the bump; `package.json` is not used. Vercel builds `main` as production; its build command (`vercel.json`) runs `pnpm db:migrate` first, so migrations apply on every deploy. Prepare release refuses when `dev` has nothing beyond `main` or a release PR is already open. If Prepare release is unavailable, open the PR by hand and, after the merge, run `gh release create vX.Y.Z --target main --generate-notes`. Preview deployments (`dev`, PRs) use Preview-scoped env vars (own database branch, own secrets, no `NOTIFY_*`) and sit behind Vercel Authentication.

**How to cut a release.**

1. Wait until the last push to `dev` has a green `check` (Actions → ci).
2. GitHub → Actions → **Prepare release** → **Run workflow**, pick `patch` (fixes), `minor` (features) or `major` (breaking), run it. It opens the PR `dev → main` titled `release: vX.Y.Z` with generated notes, and prints the PR link in the run summary. It stops with a message if `dev` has nothing new or a release PR is already open.
3. Open the PR, read the notes, wait for `check` to be green, then **Merge** with **Create a merge commit** (the only method `main` allows).
4. About 10 seconds later, `release-publish` creates the tag `vX.Y.Z` and the GitHub Release (Actions → release-publish; Releases page). Vercel deploys `main` and runs the migrations by itself.

The next version is the latest `v*` tag plus the bump, so `package.json` is never edited. If the PR is wrong, close it and run Prepare release again. If the tag or release does not appear, run `gh release create vX.Y.Z --target main --generate-notes`. Why it works this way: [D29](docs/DECISIONS.md).

**GitHub repository secrets.** `APP_URL` (the production origin, no trailing slash) and `CRON_SECRET` (must equal the Production value in Vercel).

**Scheduler.** The job "Vercel Ticker" on cron-job.org calls `POST /api/tick` every 15 minutes with the header `Authorization: Bearer <CRON_SECRET>` (D30). GitHub's own schedule has never started a run in this repository, so it is not relied on. To check it, open the job's History on cron-job.org: each run should show `204 No Content` when nothing is due. A `401` means its `CRON_SECRET` differs from the one in Vercel Production.

**Workflows.**

- `tick.yml` calls `POST /api/tick` on its own schedule (minutes 7, 22, 37 and 52 of every hour, D26) and from Actions → tick → Run workflow, where `phase` is `tick`, `before` or `after`. It fails on any non-2xx. All scheduling decisions live in the app. Do not add retries.
- `keepalive.yml` pushes a timestamp to the `keepalive` branch monthly, so GitHub does not disable the schedule after 60 days without activity. Vercel never builds that branch.
- `smoke.yml` sends `GET /` and `GET /players` after Vercel reports a successful deploy of `main`'s head (`status` event, D46), and from Actions → smoke → Run workflow. It prints each HTTP code and fails on any non-2xx. It has no retries and no alert: look at the Actions tab after each release.
- `dependabot-automerge.yml` squash-merges Dependabot minor/patch PRs into `dev` once CI is green. Majors wait for a human.

**Change the alliance list.** Edit `config/alliances.ts` and release. An event already created keeps its own copy of the list.

**Change snapshot times.** Edit `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `EVENT_TIME`, `SNAPSHOT_WINDOW_MIN` or `QUOTA_CHECK_AT` (server time) in Vercel's Production env vars, then redeploy. A scheduled event's row is created a day ahead and keeps its times, so a change applies from the next event row.

**Rotate the API key or the PIN.** Change `LAP_API_KEY` or `EDIT_PIN` in Vercel Production, redeploy, and update the copy in `.env.local`. For `CRON_SECRET`, change it in Vercel, in the GitHub secret **and** in the cron-job.org job's header, then redeploy production. Never paste any of them into a PR, issue or chat.

## Scripts

| Command                                      | Does                                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`     | Next.js                                                                                                                                                                                                          |
| `pnpm check`                                 | all gates: `prettier --check`, `eslint`, `tsc --noEmit`, `vitest run`, `scripts/check-drift.ts` (migrations match the schema), `scripts/i18n-check.ts` (translations are current). CI runs this                  |
| `pnpm test` / `pnpm typecheck`               | Vitest / `tsc --noEmit`                                                                                                                                                                                          |
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

## How the harness works

The code is written mostly by Claude Code sessions with a human reviewing. Every check is a script, not a memory:

- **CLAUDE.md** holds the standing rules every session reads. **`.claude/rules/*.md`** load only when an agent touches the matching paths (collector, API routes, tests).
- **Hooks** (`.claude/settings.json`, committed, so they also run in cloud sessions):
  - SessionStart → `scripts/install_pkgs.sh` installs deps when the lockfile changed and puts Node 26 on PATH in the cloud.
  - Every Edit/Write → `eslint --fix` on that file; remaining errors go straight back to the agent.
  - Stop → `pnpm check`; the turn can't end while it fails.
- **Pre-commit** (lefthook): prettier and eslint on staged files, and gitleaks for secrets (the repo is public).
- **CI** (`.github/workflows/ci.yml`): `pnpm check` and `pnpm audit --audit-level high` on every push and PR. Dependabot sends weekly grouped updates.
- **Translations**: the public pages' English strings (`lib/copy.ts`) are translated into `lib/i18n/<language>.ts`. A missing key reads English. `pnpm check` reports stale or missing keys, and the `translate-copy` skill (`.claude/skills/translate-copy`) fills them with the `translator` agent (`.claude/agents/translator.md`).
- **Fixtures** are recorded only through the `record-fixture` skill (`.claude/skills/`), because it spends API quota.
- **Review**: `/code-review` checks changes against [REVIEW.md](REVIEW.md).
- **Docs**: [ARCHITECTURE](docs/ARCHITECTURE.md) (one dependency rule), [GLOSSARY](docs/GLOSSARY.md) (one word per concept), [DECISIONS](docs/DECISIONS.md) (append-only), and `docs/handoff/` (one file per session).
