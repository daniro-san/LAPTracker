# LAPTracker

Snapshots of the 20 top alliances on Last Asylum Plague server 325, taken 1 hour before and 1 hour after the weekly Saturday event: might and kills before, after and the delta. Every snapshot is kept forever. The data comes from the documented API of lastasylumtracker.com. Spec: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

Status: scaffold (Session 1 of [docs/SESSION_PLAYBOOK.md](docs/SESSION_PLAYBOOK.md)). Nothing collects data yet.

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
