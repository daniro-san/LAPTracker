# LAPTracker

Snapshots of the 20 top alliances on Last Asylum Plague server 325, taken 1 hour before and 1 hour after the weekly Saturday event: might and kills before, after and the delta. Every snapshot is kept forever. The data comes from the documented API of lastasylumtracker.com. Spec: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Setup

Requires Node 26 (`.nvmrc`) and pnpm 12 (pinned in `packageManager`). Accounts and secrets are in [docs/PREREQUISITES.md](docs/PREREQUISITES.md).

```bash
nvm use                 # reads .nvmrc → newest installed 26.x
npm i -g pnpm@12
pnpm install            # also installs the lefthook git hooks
cp .env.example .env.local   # fill in; never commit it
```

Pre-commit needs [gitleaks](https://github.com/gitleaks/gitleaks) on PATH (`brew install gitleaks`). For cloud sessions (claude.ai/code), paste `scripts/cloud-setup.sh` as the environment's setup script. It installs Node 26, pnpm 12 and gitleaks.

## Environment variables

The app's variables are listed in [.env.example](.env.example) and validated by `lib/env.ts` when the server starts. A bad or missing value stops the server with the key names (never the values). Required: `LAP_API_KEY`, `DATABASE_URL`, `CRON_SECRET`, `EDIT_PIN`, and the schedule (`SERVER_TZ`, `EVENT_WEEKDAY`, `EVENT_TIME`, `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `SNAPSHOT_WINDOW_MIN`, `QUOTA_CHECK_AT`). Optional: `NOTIFY_WEBHOOK_PUBLIC`, `NOTIFY_WEBHOOK_ADMIN`, `NOTIFY_ADMIN_MENTION`, and `LAP_LIVE_TEST` (opt-in live smoke test, not in .env.example). `APP_URL` and `ENABLE_EXPERIMENTAL_COREPACK` are deploy settings, not read by the app.

## Deploy and operate

Production is Vercel (branch `main`), the database is Neon, and the scheduler is GitHub Actions. Details: [plan §3.1 and §11.6](docs/IMPLEMENTATION_PLAN.md).

**Deploy.** Work lands on `dev` through squash-merged PRs. A release takes three clicks: Actions → **Prepare release** → Run workflow (pick patch, minor or major) opens the PR `dev → main` titled `release: vX.Y.Z` with generated notes; review it; **Merge** it with a merge commit. The tag and the GitHub Release then appear on their own (`release-publish`). The version is the latest `v*` tag plus the bump; `package.json` is not used. Vercel builds `main` as production; its build command (`vercel.json`) runs `pnpm db:migrate` first, so migrations apply on every deploy. Prepare release refuses when `dev` has nothing beyond `main` or a release PR is already open. If Prepare release is unavailable (for example before the first release that carries it), open the PR by hand and, after the merge, run `gh release create vX.Y.Z --target main --generate-notes`. Preview deployments (`dev`, PRs) use Preview-scoped env vars (own database branch, own secrets, no `NOTIFY_*`) and sit behind Vercel Authentication.

**How to cut a release.**

1. Wait until the last push to `dev` has a green `check` (Actions → ci).
2. GitHub → Actions → **Prepare release** → **Run workflow**, pick `patch` (fixes), `minor` (features) or `major` (breaking), run it. It opens the PR `dev → main` titled `release: vX.Y.Z` with generated notes, and prints the PR link in the run summary. It stops with a message if `dev` has nothing new or a release PR is already open.
3. Open the PR, read the notes, wait for `check` to be green, then **Merge** with **Create a merge commit** (the only method `main` allows).
4. About 10 seconds later, `release-publish` creates the tag `vX.Y.Z` and the GitHub Release (Actions → release-publish; Releases page). Vercel deploys `main` and runs the migrations by itself.

The next version is the latest `v*` tag plus the bump, so `package.json` is never edited. If the PR is wrong, close it and run Prepare release again. If the tag or release does not appear, run `gh release create vX.Y.Z --target main --generate-notes`. Why it works this way: [D29](docs/DECISIONS.md).

**GitHub repository secrets.** `APP_URL` (the production origin, no trailing slash) and `CRON_SECRET` (must equal the Production value in Vercel).

**Workflows.**

- `tick.yml` calls `POST /api/tick` every 15 minutes. All scheduling decisions live in the app. Do not add retries.
- `keepalive.yml` pushes a timestamp to the `keepalive` branch monthly, so GitHub does not disable the schedule after 60 days without activity. Vercel never builds that branch.
- `dependabot-automerge.yml` squash-merges Dependabot minor/patch PRs into `dev` once CI is green. Majors wait for a human.

**Change the alliance list.** Edit `config/alliances.ts` and release. An event already created keeps its own copy of the list.

**Change snapshot times.** Edit `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `EVENT_TIME`, `SNAPSHOT_WINDOW_MIN` or `QUOTA_CHECK_AT` (server time) in Vercel's Production env vars, then redeploy. A Saturday row is created a day ahead and keeps its times, so a change applies from the next event row.

**Rotate the API key or the PIN.** Change `LAP_API_KEY` or `EDIT_PIN` in Vercel Production, redeploy, and update the copy in `.env.local`. For `CRON_SECRET`, change it in Vercel **and** in the GitHub secret, then redeploy. Never paste any of them into a PR, issue or chat.

**Run a snapshot by hand.** On `/admin`, enter the PIN and use the Before or After seal (a confirm dialog opens). From GitHub: Actions → tick → Run workflow → pick `before` or `after`. Either spends about 21 API calls. A run that already completed is refused (409).

**Rehearse.** The Rehearse seal on `/admin` starts a test event (about 45 calls over about 50 minutes) that the normal ticks run; the verdict goes to the admin Discord channel. A rehearsal also runs by itself at `REHEARSAL_AT`.

## Scripts

| Command                                  | Does                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                                                              |
| `pnpm check`                             | all gates: `prettier --check`, `eslint`, `tsc --noEmit`, `vitest run` — CI runs this |
| `pnpm test`                              | Vitest                                                                               |
| `pnpm typecheck`                         | `tsc --noEmit`                                                                       |
| `pnpm lint` / `pnpm format`              | ESLint / Prettier (write)                                                            |

## How the harness works

The code is written mostly by Claude Code sessions with a human reviewing. Every check is a script, not a memory:

- **CLAUDE.md** holds the standing rules every session reads. **`.claude/rules/*.md`** load only when an agent touches the matching paths (collector, API routes, tests).
- **Hooks** (`.claude/settings.json`, committed, so they also run in cloud sessions):
  - SessionStart → `scripts/install_pkgs.sh` installs deps when the lockfile changed and puts Node 26 on PATH in the cloud.
  - Every Edit/Write → `eslint --fix` on that file; remaining errors go straight back to the agent.
  - Stop → `pnpm check`; the turn can't end while it fails.
- **Pre-commit** (lefthook): prettier and eslint on staged files, and gitleaks for secrets (the repo is public).
- **CI** (`.github/workflows/ci.yml`): `pnpm check` and `pnpm audit --audit-level high` on every push and PR. Dependabot sends weekly grouped updates.
- **Fixtures** are recorded only through the `record-fixture` skill (`.claude/skills/`), because it spends API quota.
- **Review**: `/code-review` checks changes against [REVIEW.md](REVIEW.md).
- **Docs**: [ARCHITECTURE](docs/ARCHITECTURE.md) (one dependency rule), [GLOSSARY](docs/GLOSSARY.md) (one word per concept), [DECISIONS](docs/DECISIONS.md) (append-only), and `docs/handoff/` (one file per session).
