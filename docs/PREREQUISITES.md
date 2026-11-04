# Prerequisites — LAP Tracker

Everything you need **before** Session 0 of `SESSION_PLAYBOOK.md`, plus what each later session needs from you. Items are grouped by when they block. Nothing here costs money on the free tiers listed; verify limits yourself — they change.

## 1. Accounts

| Account | Why | Plan | Set up when | Notes |
|---|---|---|---|---|
| **GitHub** (personal) | Public repo, Actions scheduler, repo secrets | Free | Before Session 0 | Public repo → unlimited Actions minutes. Enable **secret scanning + push protection** in repo Settings → Code security (free on public repos). |
| **Last Asylum Tracker API** | The data source | Free (1,000 calls/UTC day) | Done (2026-11-04) | Key created after Patreon login. v1 needs ~55 calls/day. The site's internal endpoints (plan §2b) are open and used for the ranks board and as a live-roster fallback; the refresh endpoint is closed (403, see plan §3.5). |
| **Vercel** | Hosting | Hobby (free) | Before Session 8 | Link the GitHub repo. Hobby cron is not used (plan §3.1). |
| **Neon** (Postgres) | Database | Free | Before Session 8 | Create it from **Vercel Marketplace → Storage → Neon** so `DATABASE_URL` is injected automatically. A standalone Neon account works too. Not Supabase (free tier pauses after ~7 days idle — plan §3.2). |
| **Discord** | Alliance notifications | — | Before Session 8 | Permission: **Manage Webhooks** (you have it — the screenshot shows one created). Two webhooks, see §1b. |
| **Anthropic / Claude** | Claude Code | A plan that offers `fable` and `opus` in `/model`; Pro/Max/Team for cloud sessions | Before Session 0 | If `fable` is not listed, use `opus` at `high` for Sessions 3 and 5 (see playbook). Cloud sessions: see §3b. |

Not needed: Supabase, cron-job.org, Sentry, New Relic, Vercel Pro.


### 1b. Discord webhooks — exact setup

A webhook is not a bot and has no role: it is a URL, and **whoever has the URL can post to that channel**. Treat it like a password (Vercel env only, never in chat or the repo). Leaking one is cheap to fix: *Delete Webhook*, create a new one, replace the env var.

1. **Public** — the channel the alliance reads. The one you already created (*Spidey Bot* in `#guides-and-beyond`) works, but consider a dedicated channel such as `#kvk-ledger` so Saturday tables don't get buried under guides. Rename it to `LAPTracker` (the app overrides name and avatar per message anyway). *Copy Webhook URL* → Vercel `NOTIFY_WEBHOOK_PUBLIC`.
2. **Admin** — create a private channel (e.g. `#laptracker-admin`): in its permissions, deny *View Channel* to `@everyone` and allow it to your officer role or to the two or three people who should see failures. Then *Integrations → Webhooks → New Webhook* inside that channel. Visibility is governed by the channel, not by the webhook. → Vercel `NOTIFY_WEBHOOK_ADMIN`.
3. **Optional ping** — to get a phone notification on ⚠️/❌: Discord *Settings → Advanced → Developer Mode*, then right-click your name → *Copy User ID*. Set `NOTIFY_ADMIN_MENTION=123456789012345678` in Vercel — digits only, no `<@ >`; the app builds the `<@id>` mention itself (for a role: `NOTIFY_ADMIN_MENTION=role:123456789012345678`). Without it, admin messages are silent posts.
4. **Test from your Mac** (the URL is the secret, so do it yourself):
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -H 'Content-Type: application/json' \
     -d '{"username":"LAPTracker","content":"webhook test — ignore"}' "$NOTIFY_WEBHOOK_ADMIN"
   ```
   `204` means it posted. Delete the test message afterwards if you like.

Don't put the admin webhook in a DM: Discord webhooks only post to server channels.

## 2. Local machine

| Tool | Why | Check |
|---|---|---|
| **Node.js 26** (Active LTS; Vercel's default) | Next.js, scripts | `node -v` → `v26.x`. `nvm install 26` (or `fnm install 26`); after Session 1, `nvm use` inside the repo reads `.nvmrc` (`26`) and picks your newest 26.x. |
| **pnpm 12** | Package manager | `pnpm -v` → `12.x`. Install: `npm i -g pnpm@12` (corepack no longer ships with Node 25+). Session 1 pins the exact version in `packageManager`; pnpm then self-selects it. |
| **git** | Everything | `git --version` |
| **Claude Code CLI** | All sessions | `claude --version`; run `claude` in the repo and confirm `/model` lists the models above |
| **GitHub CLI `gh`** | Sessions 8–9: `gh workflow run`, `gh secret set` | `gh auth status` |
| **curl** + **jq** | Session 0 API verification, Session 8 checks | `curl --version`, `jq --version` |
| **Vercel CLI** (optional) | `vercel env pull` to sync env vars locally; `vercel logs` | `pnpm dlx vercel --version` |
| **openssl** | Generate `CRON_SECRET` | `openssl rand -hex 32` |

Windows: use WSL2; the playbook assumes a POSIX shell.

## 3. Claude Code configuration

**Required MCP connectors: none.** Every session works with the shell, `curl`, `gh` and the files in the repo. That is deliberate — fewer moving parts, nothing to debug on a Saturday.

Optional, only if you already use them:
- **Neon MCP** — inspect tables during Sessions 3 and 9. Nice to have; `psql` or Drizzle Studio (`pnpm drizzle-kit studio`) do the same.
- **frontend-design skill** — Session 7. If missing, the prompt still works; the branding brief in the plan is explicit enough.

Settings worth having in `~/.claude/settings.json` or the repo's `.claude/settings.json`:
- A permission allowlist for `pnpm test`, `pnpm typecheck`, `pnpm build`, `git commit`, `curl` — fewer prompts, same control.
- Nothing that sets `CLAUDE_CODE_EFFORT_LEVEL` globally; the playbook sets effort per session via `/model`.

## 3b. Cloud sessions (claude.ai/code) — one-time environment setup

Only if you run sessions in the cloud (Pro/Max/Team). Playbook §A2 lists what changes in practice. Set this up once at https://claude.ai/code → environment selector → **New environment**:

- **Name:** `laptracker`
- **Network access: Custom**, check "Also include default list of common package managers", and list:
  ```
  api.lastasylumtracker.com
  lastasylumtracker.com     # internal endpoints, read-only: ranks board + live-roster fallback (plan §3.5)
  discord.com
  discordapp.com
  *.vercel.app              # or your custom domain
  *.neon.tech               # Neon's HTTP driver; direct TCP 5432 is not proxied, so use @neondatabase/serverless
  ```
  Add `playwright.azureedge.net` and `cdn.playwright.dev` only if you want screenshots in Sessions 6–7 taken in the cloud (verify the current download hosts in Playwright's docs; they change).
- **Network secret:** type Bearer, allowed website `api.lastasylumtracker.com`, header `Authorization`, prefix `Bearer`, value = your `lap_...` key. The key never enters the VM.
- **Environment variables** (readable by the session — never put the API key here when a secret can carry it):
  ```
  LAP_API_KEY=lap_cloud-placeholder    # the proxy supplies the real header; Session 0 verifies this
  DATABASE_URL=...                     # Neon pooled HTTP connection string, from Session 8 on; local Postgres before that
  EDIT_PIN=...
  CRON_SECRET=...
  NOTIFY_WEBHOOK_PUBLIC=... / NOTIFY_WEBHOOK_ADMIN=...
  SERVER_TZ=Etc/GMT+2 / EVENT_WEEKDAY=6 / EVENT_TIME=12:00 / SNAPSHOT_BEFORE=10:00 / SNAPSHOT_AFTER=14:00 / SNAPSHOT_WINDOW_MIN=45 / QUOTA_CHECK_AT="fri 20:00"
  BASH_DEFAULT_TIMEOUT_MS=600000       # builds and the dry run take longer than the 2-minute default
  ```
- **Setup script:** the image ships Node 20/21/22 (22 on PATH) with pnpm; Node 26 is not pre-installed. Paste `scripts/cloud-setup.sh` (written in Session 1) as the environment's setup script: it downloads the newest Node 26.x from nodejs.org (on the default allowlist) into `/opt/node26`, prepends it to PATH in `~/.bashrc`, and installs pnpm 12. The cached snapshot keeps whatever patch it installed; re-run the setup script from the environment's settings if you ever want a newer one. It runs once and is cached as a filesystem snapshot. The first cloud session must confirm `node -v` prints 26 — if it prints 22, the PATH line is not being read and Session 1's handoff says what to change. Keep the `SessionStart` hook that runs `pnpm install --frozen-lockfile` when the lockfile changed.
- **GitHub:** install the Claude GitHub App on the repo (cloud sessions clone and push through it). Branch protection on `main` must allow the app to push, or sessions work on branches and you merge from the UI.

What you still do by hand, in dashboards instead of a terminal: everything in §6. The cloud session cannot create the Vercel project, link Neon, or add GitHub repository secrets for you.

## 4. Secrets and values to have ready

Create these before the session that needs them. **Never paste any of them into the Claude Code chat**; put them in `.env.local` (gitignored) or in Vercel/GitHub secrets, and let Claude Code read from there.

| Value | Where it lives | Needed by | How to get it |
|---|---|---|---|
| `LAP_API_KEY` | `.env.local`, Vercel | Session 0 | Already created. One key. |
| `LAP_API_BASE_URL`, `LAP_SITE_BASE_URL` | `.env.local`, Vercel | Session 2 | Not secrets; defaults in code. Only set them if the tracker moves hosts or bumps `/v1`. |
| Server timezone | Known | — | UTC−2 fixed (`Etc/GMT+2`), from the in-game clock on 2026-11-04. Session 0 re-checks once. |
| `DATABASE_URL` | Vercel (from Neon), `.env.local` | Session 3 (local dev), Session 8 | Neon dashboard → connection string (pooled). |
| `CRON_SECRET` | Vercel + GitHub repo secret | Session 8 | `openssl rand -hex 32` |
| `EDIT_PIN` | Vercel | Session 8 | 6–8 digits you'll share with alliance admins (6 is the minimum the limiter math assumes, plan §12.2). |
| `NOTIFY_WEBHOOK_PUBLIC`, `NOTIFY_WEBHOOK_ADMIN`, `NOTIFY_ADMIN_MENTION` (optional) | Vercel | Session 8 | §1b. |
| `APP_URL` | GitHub repo secret | Session 8 | The Vercel production URL. |
| `SERVER_TZ`, `EVENT_WEEKDAY`, `EVENT_TIME`, `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `SNAPSHOT_WINDOW_MIN`, `QUOTA_CHECK_AT` | Vercel, `.env.local` | Session 8 | Server time. Change snapshot times here, redeploy — no commit (plan §3.1). |
| `ENABLE_EXPERIMENTAL_COREPACK=1` | Vercel | Session 8 | Makes the build use the pnpm version in `packageManager`. Not a secret. |

## 5. Decisions to make before Session 0 (plan §10)

1. ~~Maintainer heads-up~~ — done 2026-11-04.
2. ~~Event window~~ — deferred 2026-11-04: going with 10:00 / 14:00, configurable via env vars; revisit after the first real Saturday.
2. Whether "might" should show roster churn (joined/left) — default **yes**, it's free (plan Phase 5c).
3. The alliance channel language — stated: **English**.

## 6. Session-by-session: what you do by hand

| Before | You do |
|---|---|
| Session 0 | Revoke the test key, create the official one, put it in `.env.local` as `LAP_API_KEY`. Have the in-game server time on screen for the offset re-check. `fixtures/probe-*` and `fixtures/v1-*` committed. Delete `scripts/probe-refresh.sh`; keep `scripts/probe-v1.sh` (with the placeholder, not the key). **GitHub, once (plan §11.6):** Settings → General: Pull Requests → only *Allow squash merging* (default message: PR title and description), *Automatically delete head branches*, *Allow auto-merge*. Settings → Rules → Rulesets → New branch ruleset: name `main`, target default branch, enforcement Active, **no bypass list**, rules: *Restrict deletions*, *Require linear history*, *Require a pull request before merging* (0 approvals), *Block force pushes*. Leave *Require status checks* for after Session 1. Settings → Code security: secret scanning + push protection on, Dependabot alerts + security updates on. |
| After Session 1 | (Session 1 already exists on branch `claude/trusting-albattani-4s5ca3` with CI green — open its PR to `main`, read `docs/handoff/01-scaffold.md`, merge.) Then wait for CI to finish once on main and edit the `main` ruleset: *Require status checks to pass* → add `check` (it only appears in the picker after it has run). From here every PR needs green CI to merge. |
| Every session | Read the handoff in the PR, merge (squash), delete nothing by hand (branches auto-delete). Start the next session from `main`. |
| Session 2 | Nothing. (The one live smoke test costs 1 API call.) |
| Session 3 | Optional: a local Neon branch or any Postgres for `pnpm db:push`. |
| Session 7 | Review the `/brand` mock and say yes/no before step 2. |
| Session 8 | Vercel project linked to the repo (production branch `main`, previews on); Neon linked, plus a Neon branch named `preview`; both Discord webhooks; env vars in Vercel **scoped**: Production = the real values; Preview = `DATABASE_URL` of the `preview` branch, a different `CRON_SECRET` and `EDIT_PIN`, no `NOTIFY_*`; Deployment Protection → Vercel Authentication for previews; `APP_URL` + `CRON_SECRET` (production) as GitHub secrets. |
| Session 9 | Pick a weekday. Compare OGs' kill sum with the in-game alliance screen when asked. |
| First Saturday | Confirm the Friday quota message arrived; watch the channel around SNAPSHOT_BEFORE and SNAPSHOT_AFTER server time (+ up to ~35 min of tick/Actions lag). Note when the KvK really starts and ends in-game: that settles the event-window decision (§5 item 2). |

## 7. Cost summary

- Infrastructure: $0/month on the listed tiers (Vercel Hobby, Neon free, GitHub public repo).
- Upstream API: $0; ~55 of 1,000 daily calls on Saturdays.
- Claude usage: Session 5 (Fable) is the expensive one; everything else is Sonnet/Opus at medium or high. Expect the whole v1 to fit comfortably in a normal monthly plan; the dry run (Session 9) and the review (Session 5) are the two to not rerun casually.
