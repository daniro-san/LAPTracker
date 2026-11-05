# Session Playbook — LAP Tracker

Companion to `IMPLEMENTATION_PLAN.md` and `PREREQUISITES.md`. One Claude Code session per step. Each session reads the plan plus the handoff files from earlier sessions, does one phase, and writes its own handoff file. Nothing is carried between sessions through chat memory — only through files in the repo.

Model and effort choices follow Anthropic's model-specific prompting guides as of 2026-11-04 (links in §B). Re-check them when a new model ships; effort levels are recalibrated between model generations.

---

## A. How to use this file

1. Start every session in the repo root with a clean context (`/clear`, or a new `claude` process). The three documents live in `docs/` in the repo (`docs/IMPLEMENTATION_PLAN.md`, `docs/SESSION_PLAYBOOK.md`, `docs/PREREQUISITES.md`); prompts name them without the prefix.
2. Set the model and effort with `/model` (or `CLAUDE_CODE_EFFORT_LEVEL` in the environment). Levels: `low`, `medium`, `high`, `xhigh`, `max`; availability depends on the model. If a level listed here isn't offered, use the closest one below it.
3. Where the session says **plan mode first**: `Shift+Tab` until the status bar shows plan mode (or `claude --permission-mode plan`), read the plan Claude proposes, approve, then let it implement.
4. Paste the prompt block exactly. Replace `<...>` placeholders only where marked. The prompts use XML tags to separate the task, constraints and the definition of done — keep the tags; the models parse them better than prose.
5. A session is done when its **Done when** list is satisfied and its handoff file exists.
6. If a session goes off the rails after two corrections, `/clear` and re-run the same prompt with one extra sentence saying what went wrong. Don't keep correcting in a polluted context.
7. `fable` not listed in `/model`? Use `opus` at `xhigh` for Session 5. Everything else is unchanged.
8. **Branches and PRs, every session.** Work lands on `dev`; `main` is production and is written only by release PRs. Each session: `git switch -c session/NN-<slug>` from an up-to-date `dev`, conventional commits as it goes, then `git push -u origin HEAD` and a PR **based on `dev`** titled with the string from its `<done_when>` (`gh pr create --base dev --fill` locally; `gh api repos/{owner}/{repo}/pulls -f title=... -f head=... -f base=dev -F body=@docs/handoff/NN-*.md` in the cloud, where `gh pr` is rejected). The PR URL is the last line of the handoff. **You merge** (squash) after reading the handoff in the PR; then start the next session from `dev`. A release is a PR `dev → main` merged with a merge commit, then a tag (`v0.1.0` in Session 8, `v1.0.0` in Session 9); Vercel deploys production from `main`, and `dev`'s preview URL is staging. Plan §11.6 has the whole flow.
9. **Each session re-plans the next one.** Before writing its handoff, a session re-reads the next session's prompt here and fills the handoff's `## Next` section (format below). Before you start session N, open `docs/handoff/<N-1>-*.md`, read `## Next`, and paste its `<adjustments>` block into the prompt right after `<task>`. Apply its model/effort recommendation only if you agree with the reason. Rules that keep this from drifting:
   - A session may **add** an `<adjustments>` block; it never edits the original prompt text in this file. `<constraints>` and `<done_when>` are frozen; only you change them.
   - Model/effort recommendations are `keep`, `raise one level`, or `lower one level`, with a measurable reason (what was harder or easier than the plan assumed). "Use the best model" with no reason is not a recommendation.
   - Sessions 2–5 never go below the model/effort listed in §D, whatever a handoff says. That floor exists because those sessions hold the freshness guarantee.
   - If a session finds the plan itself wrong (not just the next prompt), it says so under `## Next → Plan changes needed` and stops short of editing `IMPLEMENTATION_PLAN.md`; you edit the plan.

### Handoff contract

Every session writes `docs/handoff/NN-<name>.md` with exactly these sections:

```
# NN — <name>
## Built            — files created/changed, one line each
## Decisions        — choices made that the plan left open, with the reason
## Deviations       — anything done differently from IMPLEMENTATION_PLAN.md, and why
## Verified         — commands run and their actual output (tests, curl, build)
## Open issues      — what the next session must know; empty is a valid answer
## Next             — see format below
```

The `## Next` section has a fixed shape so the owner can act on it in two minutes:

```
## Next
Session: <N+1 — name>
Model / effort: keep | raise one level | lower one level — <one measurable reason, or "no signal">
Owner must do first: <from PREREQUISITES.md §6, or "nothing">
Plan changes needed: <none | which section and why — do not edit the plan yourself>

<adjustments>
<!-- Paste this block into the next prompt right after </task>. Additions only:
     facts this session established that change what the next session should build,
     numbers to use instead of the plan's estimates, files that moved, things to skip because they're done. -->
- ...
</adjustments>
```

`docs/handoff/00-prereqs.md` is the one every later session reads first.

---

## A2. Running the sessions in the cloud (claude.ai/code) instead of the terminal

Verified against https://code.claude.com/docs/en/claude-code-on-the-web.md and https://code.claude.com/docs/en/cloud-environments.md on 2026-11-04. The plan and the prompts stay the same; these are the operational differences.

| Local terminal | Cloud session | What to change |
|---|---|---|
| Your machine's network | **Trusted** level by default: package registries + GitHub only. The game API, Discord, Vercel and Neon are blocked. | Create a cloud environment with **Custom** network access; allowlist in `PREREQUISITES.md` §3b. |
| `.env.local` | Doesn't exist (fresh clone; `.env*` is never uploaded). Environment variables set on the cloud environment are readable by the session. | API key → **network secret** for host `api.lastasylumtracker.com` (proxy injects `Authorization: Bearer`; the key never enters the VM). `DATABASE_URL`, `EDIT_PIN`, webhooks → environment variables. |
| You run manual steps in a shell | No shell for you; Claude runs every command. | Everything in `PREREQUISITES.md` §6 is done in the web dashboards (Vercel, Neon, GitHub). Claude only verifies with `curl` / `gh api`. |
| `/model` and `/effort` open pickers | Argument form only: `/model sonnet`, `/effort high`. Plan mode from the permission-mode dropdown. | Nothing else. |
| `gh` with your token | `gh` works through a proxy; REST subcommands (`gh api`, `gh workflow run`, `gh release create`) work; **GraphQL ones (`gh pr`, `gh issue`) are rejected**. Push to branches works. | PRs are opened with the REST call in §A.8 (or the **Create PR** button in the claude.ai session). |
| Commits stay on disk | Each session is a fresh clone. | **Every session ends with `git push -u origin HEAD` + a PR into `dev`**, or the next session never sees its handoff. `dev` and `main` are protected; a direct push is rejected. |
| `psql`/Postgres only if installed | PostgreSQL 16 is pre-installed (`service postgresql start`). | Session 3 can run `db:push` and tests against a local DB without touching Neon. |
| Screenshots via a local browser | No browser; Playwright's download host isn't allowlisted by default. | Run Sessions 6 and 7 locally with `claude --teleport <session-id>`, or add Playwright's host to the allowlist, or have the session publish the page as an Artifact for your review. |
| `AskUserQuestion` blocks until you answer | Same; the session idles and resumes when you answer, up to VM expiry. | Session 0's interview works; answer from phone or browser. |
| Secrets in `.env.local` could leak into the transcript if printed | A network secret can't be printed because the VM never has it. | Strictly better. Keep the "never print keys" rule for the env vars that are visible. |

### A3. Claude Desktop, Code tab (local or cloud)

Verified against https://code.claude.com/docs/en/desktop.md (first half of the page) on 2026-11-04. No CLI flags exist or are needed; every flag in this file has a UI equivalent, and the playbook never relies on conversation continuity, so switching surfaces between sessions costs nothing.

| CLI | Desktop Code tab |
|---|---|
| `/model fable`, `/effort high` | Model picker and **Effort** in the row under the prompt box (`Cmd+Shift+I`, `Cmd+Shift+E`). Set both before the first message. |
| `Shift+Tab` / `--permission-mode plan` | Permission-mode selector (`Cmd+Shift+M`) → **Plan**. `Shift+Tab` does nothing here. After approving the plan, switch to **Accept edits**. |
| `/clear` | New session (`Cmd+N`). One session per playbook step, named after it (click the title to rename). |
| `claude --cloud` | Environment selector → an environment under **Cloud** (set up per `PREREQUISITES.md` §3b), or session menu → **Open in → Cloud** for a running local session. |
| `claude --teleport` | Not needed. The cloud session pushes; you start a **Local** session in the same folder, `git pull`, and paste the next prompt. |
| Your shell for manual steps | **Terminal** pane (`Ctrl+\``) in a local session shares the session's folder and environment. |
| `.env.local` | Readable in **Local** sessions (it's your folder). Not in cloud sessions — use §3b. |
| `/code-review` | Same command in the prompt box; findings arrive as a **Code review** card. |

Recommended split in Desktop: Sessions 0, 6, 6b, 7 and 9 **Local** (they need `.env.local`, the Browser pane for screenshots, or your eyes on the result); Sessions 1–5b, 8 and 10 **Cloud** if you want to walk away. Mixing is fine as long as every session ends with a pushed branch and a PR into `dev`, and you merge before pasting the next prompt.

Prompt edits for cloud runs — only these three:
1. Session 0, step 2: replace "load LAP_API_KEY from .env.local without printing it" with "The API key is injected by the environment's network secret; call the API with curl and no Authorization header. Confirm the first call returns 200 and a quota object; if it returns 401, stop and tell me the secret isn't attached."
2. Session 2, live smoke test: the client sends `Authorization: Bearer $LAP_API_KEY`. Set `LAP_API_KEY=lap_cloud-placeholder` as an environment variable and let the proxy supply the real header. **Verify in Session 0 that the proxy overrides an existing Authorization header**; if it doesn't, run the smoke test locally instead and say so in the handoff.
3. Every `<done_when>`: "PR: …" means the REST PR call from §A.8, since `gh pr` is rejected in the cloud.

Everything else — handoff files, the `## Next` re-planning, CLAUDE.md rules, model/effort choices — is unchanged, because it lives in the repo, and the repo is what the cloud session clones.

---

## B. Prompting rules applied here (and why)

Source pages, all read 2026-11-04:
- General: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Fable 5.1: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1
- Opus 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
- Sonnet 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- Haiku 5.5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5

**All models**
- Be explicit and give the reason behind a constraint; the models generalise from the "why". Every `<constraints>` block below says why.
- XML tags separate instructions, context and definition of done. Same tag names in every prompt.
- Say what to do, not what not to do, where possible.
- Ask for a self-check against stated criteria ("Before you finish, verify…"); it reliably catches errors in code.
- Don't ask the model to write out its reasoning in the reply (that can trip the `reasoning_extraction` safeguard on Fable/Opus/Sonnet 5.5). Effort level controls thinking; the prompt doesn't.
- Guard against over-engineering and against hardcoding to pass tests — both have a tested block, placed in `CLAUDE.md` once (§C) rather than repeated per prompt.

**Fable 5.1** — default effort `high`. `medium` ≈ Fable 5 quality at lower cost. `xhigh`/`max` only where you measured a gain; on long deliverables they make the model draft the output in its thinking and again in the reply. Writes fewer progress updates between tool calls → ask for them. May rewrite whole files → ask for surgical edits. May add nearby fixes and extra test files → the "keep changes to what the task asks" block. Dense prose → "remove all mannered prose" in handoffs.
→ Used for Session 5 (review, short output, heavy reasoning) at `xhigh`.

**Opus 5.5** — default effort `medium`, which matches Opus 5 at `high`. Thinks more per level than Opus 5, so don't carry over old `high` settings. Strongest on multistep repo work and code review. Responds to instructions that name the specific kinds of early stop to avoid. For frontend, name the concrete patterns to avoid rather than saying "not generic".
→ Used for Sessions 2, 4, 5b, 7 at `medium`, and Sessions 3 and 9 at `high`.

**Sonnet 5.5** — agentic coding: `medium` for well-specified tasks, `high` for harder ones. At `low` it skips verification and stops early → never `low` here. Adds unrequested tests/docs at every level → scope paragraph. Verification paragraph makes skipped checks rare.
→ Used for Sessions 0, 1, 6, 8 at `medium`.

**Haiku 5.5** — default `medium`. `low` skips checks and stops early in long prompts; `high` for strict instruction following over long inputs.
→ Used for Session 10 at `medium`.

---

## C. Standing rules — put in `CLAUDE.md` once (Session 0 does this)

These are the tested blocks from the guides, kept out of each prompt so prompts stay short and the rules apply in every session. Session 0 writes them verbatim into `CLAUDE.md`.

```markdown
# LAP Tracker — rules for every session

Read docs/handoff/00-prereqs.md first, then the latest docs/handoff/*.md, then the part of docs/IMPLEMENTATION_PLAN.md the session names.

## Scope
Keep working until everything the session asked for is done, and only stop to ask when you can't go on without the owner or before a risky step. When the work is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for; if one would help, mention it in the handoff instead of doing it.
If, while working or testing, you find a pre-existing bug, a performance concern, or behavior the task doesn't mention, don't fix, optimize or extend it in this change unless the requested behavior cannot work without it; report it as a follow-up in the handoff. Where the task is ambiguous, implement the reading its wording and the plan most directly support, state that assumption in the handoff, and don't build for the other readings as well. Commit tests only where the task asks for them, sized like the neighboring test files — roughly one focused test per stated behavior.

## Verification
When you change code that can be run, built, or type-checked, run a real check that exercises the change before reporting it done: the project's tests, type-checker, or build, or the changed command itself. A syntax-only check, or a check command that failed to start, does not count; if all that is missing is the project's declared dependencies, install them with pnpm and the lockfile, never via sudo or the system package manager. Only if no real check can run here, say which one you did not run and why instead of reporting the change as done.

## Engineering
Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Don't add error handling, fallbacks, or validation for scenarios that can't happen; validate at system boundaries only (user input, the upstream API). Don't create helpers or abstractions for one-time operations.
Write general-purpose solutions. Do not hard-code values or create solutions that only work for the test inputs; tests verify correctness, they don't define the solution. If a test or requirement is wrong or infeasible, say so instead of working around it.
Never speculate about code you have not opened; read the file before answering about it.
The number of tokens used to edit files is best minimized, all else being equal, so when it will not affect the end result, surgically edit a file rather than rewrite the entire thing.

## Communication
Before you start, say in a line what you're about to do; brief updates while you work help the owner follow along. Close with a short recap that stands on its own. In handoff files, remove all mannered prose: say what you mean in literal phrases.

## Hard rules
- English only in code, comments, UI copy, commit messages and docs.
- Never commit to dev or main. Branch from `dev` as `session/NN-<slug>` (or `fix/`, `chore/`), Conventional Commits, push the branch, open the PR **with base `dev`** titled as the session's done_when says, put the PR URL as the last line of the handoff, and stop: the owner merges. `main` is production and is written only by release PRs from `dev`.
- Never print, log, commit or paste an API key, PIN, webhook URL or secret. Read them from .env.local or the environment only.
- Never run anything that spends upstream API quota unless the session explicitly allows it. Never call the site's refresh endpoint or imitate the site (Origin/Referer/cookies): the maintainer closed it on purpose.
- Stack: Next.js App Router, TypeScript, Tailwind, Drizzle + Neon, Vitest. Node 26 (`.nvmrc` = `26`), pnpm 12 (`packageManager`). Test: `pnpm test`. Typecheck: `pnpm typecheck`. All gates: `pnpm check`.
- Architecture: docs/ARCHITECTURE.md (one dependency rule, one injection point). Words: docs/GLOSSARY.md — use its terms in code and prose. Decisions: docs/DECISIONS.md.
- New dependency: only if the platform can't do it; note the reason, release date and install scripts in docs/DECISIONS.md.
- Roster fields x, y, online, last_online_at, joined_at, daily_*, avatar_url stay in raw_json and are never returned by any query, route, page, log or message.
- lib/sources/internal.ts is unofficial and read-only (ranks board + live-roster fallback). Never widen its use beyond what docs/DECISIONS.md records.
- Secrets are compared with timingSafeEqual; PIN and cron routes are rate-limited; responses never carry stack traces.
- UI is mobile-first: designed at 360 px, cards below 640 px, nothing hover-only, touch targets ≥ 44 px, compact numbers; reads only through lib/queries; no charts in v1; player pages look like alliance pages.

## Handoff (every session, last step before the PR)
Write docs/handoff/NN-<name>.md with sections Built / Decisions / Deviations / Verified / Open issues / Next. Before writing `## Next`, re-read the NEXT session's prompt in docs/SESSION_PLAYBOOK.md and fill `## Next` in the exact shape given there: model/effort as keep / raise one / lower one with a measurable reason; what the owner must do first; whether the plan itself needs a change (say which section — do not edit docs/IMPLEMENTATION_PLAN.md or docs/SESSION_PLAYBOOK.md); and an `<adjustments>` block with additions only: facts you established that change what the next session should build, real numbers to replace the plan's estimates, things to skip because they're already done. If you also notice a prompt further ahead that your findings affect, add a second `<adjustments for="Session M">` block.
```

---

## D. Session map

| # | Session | Model | Effort | Mode | Reads | Writes |
|---|---|---|---|---|---|---|
| 0 | Prerequisites | sonnet | medium | default | plan §2, §7, Phase 0, fixtures/ | `00-prereqs.md`, `config/alliances.ts`, `fixtures/`, `CLAUDE.md`, `.env.example` |
| 1 | Scaffold + harness + security baseline | opus | medium | plan first | plan §5, §11, §12, 00 | repo skeleton, `.claude/*`, CI, docs, `01-scaffold.md` |
| 2 | Source adapters + tests | opus | medium | plan first | plan, 00, 01 | `lib/sources/*`, tests, `02-sources.md` |
| 3 | Schema + collector + freshness | opus | high | plan first | plan, 00–02 | schema, `lib/compute.ts`, `lib/collector.ts`, tests, `03-collector.md` |
| 4 | Routes + logger + notifications | opus | medium | plan first | plan, 00–03 | `app/api/*`, `lib/logger.ts`, `lib/notify.ts`, `04-routes.md` |
| 5 | Adversarial review (read-only) | fable | xhigh | plan mode, stays there | plan, 00–04 | `05-review.md` |
| 5b | Fix review findings | opus | medium | default | 05 | `05b-fixes.md` |
| 6 | UI: main table + alliance page, mobile-first | sonnet | medium | default | plan Phase 5/5c, 00, 04 | `app/*`, `StatTable`, `06-ui.md` |
| 6b | Player pages + search | sonnet | medium | default | plan Phase 5d, 06 | `app/players/*`, `lib/queries/players.ts`, `06b-players.md` |
| 7 | Branding + Granny Doctor | opus | medium | default | plan §5b, 06 | `lib/brand/*`, `/brand`, `07-brand.md` |
| 7b | Usability + language-light pass | opus | medium | default | DESIGN.md, 06–07 handoffs | `lib/copy.ts`, page fixes, `07b-usability.md` |
| 8 | Deploy, Actions, env, webhooks | sonnet | medium | default | plan, 00, 04 | `.github/workflows/*`, README, `08-deploy.md` |
| 9 | Dry run against production | opus | high | default | plan §7, 08 | `09-dryrun.md` |
| 10 | README + runbook polish | haiku | medium | default | all handoffs | README, CONTRIBUTING.md, `10-docs.md` |

Sessions 2–5 hold the freshness guarantee (§3.7) and the source boundary (§3.5) — including "never touch the site's refresh". That's where the stronger models go; Session 5 keeps Fable because a fresh strongest-model reviewer is cheap insurance on the one invariant that matters.

---

## Session 0 — Prerequisites

**Model:** sonnet · **Effort:** medium · **Mode:** default
**Before starting (you, by hand):** `.env.local` with `LAP_API_KEY=lap_...` (the official key, after revoking the test one). `fixtures/probe-*` and `fixtures/v1-*` are already in the repo from the 2026-11-04 experiments.

```text
<session>
Session 0 of SESSION_PLAYBOOK.md. Read IMPLEMENTATION_PLAN.md in full (§2, §2b, §3.5, §3.7, §7, Phase 0), SESSION_PLAYBOOK.md §C, and every file under fixtures/.
</session>

<task>
The API experiments are done and documented in §2 and fixtures/. This session only closes the gaps and prepares the repo. No application code.

1. Ask me for the in-game "server time" right now and compare it with `date -u`; it must be UTC−2 (plan §7). Then interview me with AskUserQuestion only for: whether the admin Discord webhook exists (the public one and the maintainer heads-up are done).
2. Resolve the 18 §7 alliances not yet in fixtures/ on /v1/alliances/{id} (curl, User-Agent, key from .env.local never printed): confirm name/abbr against the board, note rank.rank, save each response to fixtures/v1-ids/<id>.json. Stop and report if more than two fail.
3. Write config/alliances.ts (20 verified entries), .env.example (every variable in §7 and PREREQUISITES.md §4, no values), CLAUDE.md (the block in SESSION_PLAYBOOK.md §C, verbatim), fixtures/README.md (what each folder is, when it was recorded, what it cost), `.nvmrc` containing `26` (plan §11.4), `.gitignore` (Next.js default plus `.env*` except `.env.example`), and `.github/PULL_REQUEST_TEMPLATE.md` with three headings: What / Verified / Handoff.
4. docs/handoff/00-prereqs.md per the handoff contract: the §2 facts with their fixture file names as evidence, the 18 resolutions, the server-time → UTC conversion for the §7 defaults (SNAPSHOT_BEFORE 10:00 → 12:00 UTC, SNAPSHOT_AFTER 14:00 → 16:00 UTC, QUOTA_CHECK_AT Friday 20:00 → 22:00 UTC) with the two clock readings as evidence.
5. Append "Answered — see docs/handoff/00-prereqs.md" under each §10 question in IMPLEMENTATION_PLAN.md. Change nothing else in the plan.
</task>

<constraints>
- At most 20 documented-API calls today, none on a Friday or Saturday. No calls to the internal refresh endpoint — closed, and the fixtures already prove it.
</constraints>

<done_when>
config/alliances.ts has 20 verified entries; fixtures/README.md, CLAUDE.md, .env.example, .nvmrc, .gitignore, PR template exist; `git check-ignore .env.local` prints it; 00-prereqs.md written. PR: "chore: session 0 — prerequisites" (branch session/00-prereqs into dev; no CI exists yet, so the owner merges on reading).
</done_when>
```

---

## Session 1 — Scaffold + agentic harness

**Model:** opus · **Effort:** medium · **Mode:** plan mode first

**Why Opus here now:** the scaffold is mechanical, but this session also lays down the harness every later session runs inside (hooks, rules, gates). A wrong hook or a lint rule that fights the codebase costs every session after it. Plan §11 specifies the content; the model's job is to wire it correctly, not to design it.

```text
<session>
Session 1 of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/handoff/00-prereqs.md, IMPLEMENTATION_PLAN.md §5, Phase 1, §11 and §12 in full.
</session>

<task>
Plan first. Then build, in this order:
1. Scaffold: Next.js (stable), TypeScript strict (+ noUncheckedIndexedAccess, exactOptionalPropertyTypes), Tailwind, Vitest, Drizzle + @neondatabase/serverless, zod, fast-check. Nothing else unless §12.4's test is met and the reason is written in docs/DECISIONS.md. Keep config/alliances.ts, fixtures/, docs/, CLAUDE.md, .env.example untouched. Folder layout exactly as §11.1 (empty modules with a one-line header comment are fine).
1b. Runtime pins from plan §11.4: `.nvmrc` = `26` (major only), `engines.node` = `">=22.0.0"`, `packageManager` = the pnpm 12 version you have (`pnpm -v`), `.npmrc` with `engine-strict=false`; `scripts/cloud-setup.sh` that resolves the newest 26.x from `nodejs.org/dist/index.json`, installs it into `/opt/node26`, prepends it to PATH in `~/.bashrc`, and installs pnpm 12 (the owner pastes it as the cloud environment's setup script — PREREQUISITES §3b). No Dockerfile, no devcontainer — the plan says why.
2. Tooling from §11.2 and §11.4: ESLint (typescript-eslint strict, import/order, max-lines 300, max-lines-per-function 80, complexity 12, max-depth 3), Prettier, `pnpm check`, lefthook pre-commit (prettier + eslint on staged, `gitleaks git --pre-commit --staged` with a custom `lap_` rule), `.github/workflows/ci.yml` with pnpm/action-setup + setup-node (`node-version-file: .nvmrc`, `cache: pnpm`), `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm audit --audit-level high`, actions pinned to SHAs, `permissions: contents: read`, job name `check` (the ruleset requires this exact name). `.github/dependabot.yml` for npm and github-actions, weekly, grouped minor/patch.
3. Harness from §11.5: `.claude/settings.json` (hooks: PostToolUse Edit|Write → eslint --fix on the changed file; Stop → pnpm check; SessionStart → scripts/install_pkgs.sh cloud-aware; permissions allow/deny as §11.4, with `git push origin main`, `git push origin dev` and `git push --force*` denied and `git push -u origin HEAD`, `gh pr *`, `gh api *` allowed), `.claude/rules/{collector,api-routes,tests}.md`, `.claude/skills/record-fixture/SKILL.md` (complete — it spends quota), `REVIEW.md` with the Session 5 checklist plus the §12.1 blocked-keys check.
4. Security baseline from §12.3 and §12.5: security headers in next.config; `lib/env.ts` with zod validation of every variable in .env.example (fail fast); a `lib/redact.ts` helper the logger will use; a `BLOCKED_ROSTER_KEYS` constant in lib/queries with a test that no read model exports them.
5. Docs: docs/ARCHITECTURE.md (§11.1 with the Deps interface in TypeScript), docs/GLOSSARY.md, docs/DECISIONS.md seeded from §3.1–§3.6 and the dependency list (one paragraph each, dated).
6. lib/budget.ts with one exported pure function stub and one property test that passes trivially, so fast-check is proven wired. One placeholder route test. .gitignore covers .env*, node_modules, .next, .claude/worktrees.
7. README.md: what this is, setup, env vars, scripts, "how the harness works" — short.
</task>

<constraints>
- The tooling must pass on the scaffold itself before you commit; a gate that fails on an empty repo trains every later session to bypass it.
- Hooks must be fast (< 10 s on a one-file edit). Measure and report the PostToolUse timing in the handoff.
- No DI container, no base classes, no generic repository — §11.7 lists what not to add. If a lint rule needs disabling for the scaffold, that is a signal the rule is wrong for this repo; change the rule, don't add disable comments.
- For every dependency you add, run `pnpm view <pkg> time.modified scripts` and note the date and any install scripts in docs/DECISIONS.md. A package untouched for a year or with a binary-downloading postinstall needs a stated reason.
</constraints>

<verify>
Run `pnpm check` and `pnpm audit --audit-level high` clean. Confirm `node -v` prints 26.x and `pnpm -v` the pinned version, and paste both. Make a deliberate lint error in a scratch file, confirm the PostToolUse hook reports it, then remove the file. Confirm `lefthook run pre-commit` blocks a staged file containing a fake `lap_` key (gitleaks). Paste the outputs in the handoff.
</verify>

<done_when>
`pnpm check` passes; both hook checks demonstrated; all §11.5 files exist; docs/handoff/01-scaffold.md lists installed versions and the hook timing measured. PR: "chore: session 1 — scaffold and harness". This PR is the first one CI runs on; its handoff tells the owner to add `check` as a required status on the main ruleset right after merging (PREREQUISITES §6).
</done_when>
```

---

## Session 2 — Source adapters + tests

**Owner-supplied `<adjustments>` (2026-11-04, after reviewing what Sessions 0 and 1 produced on the older prompts) — paste right after `</task>`, together with the block from `docs/handoff/01-scaffold.md`:**

```text
<adjustments>
- Branch from `dev` (the owner created it from main; `git fetch origin dev && git switch -c session/02-sources origin/dev`) and open the PR with base `dev`, not `main` — plan §11.6 changed after CLAUDE.md was last generated. Also regenerate CLAUDE.md from the current §C block of docs/SESSION_PLAYBOOK.md (it now says base `dev`) and add "Bash(git push origin dev)" to the deny list in .claude/settings.json.
- Add LAP_API_BASE_URL and LAP_SITE_BASE_URL to .env.example and lib/env.ts with the plan §7 defaults; the adapters read base URLs only from lib/env (plan Phase 2, with the grep test).
- Use the one live smoke call on FGH (67111128): it both proves the client and verifies the last unverified entry of config/alliances.ts (already swapped in on the Session 1 branch, commit a6c1249). If it returns 200, record it with the record-fixture skill and update the entry's comment with its /v1 rank; if it 502s again, leave the list as is and say so in the handoff.
- members[].kills can be null (AFR fixture): keep null on the row, sum as 0, state it in DECISIONS (plan Phase 2).
</adjustments>
```


**Model:** opus · **Effort:** medium · **Mode:** plan mode first

```text
<session>
Session 2 of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/handoff/00 and 01, IMPLEMENTATION_PLAN.md §2, §2b, §3.5, §3.7 and Phase 2.
</session>

<task>
Plan first, then implement lib/sources/ as Phase 2 specifies:
- One output type AllianceSnapshotInput shared by both adapters, with sourceUpdatedAt and cached.
- v1.ts: fetchAlliance(id), fetchQuota(); Authorization + User-Agent always; quota and cached parsed from every response; retries 502/503/504 max 3 with 1s/2s/4s + jitter, Retry-After honoured; 30 s per-call timeout; 429 → QuotaExhaustedError; 404 → NotFoundError; concurrency 4.
- internal.ts: fetchRanks(server) → { pulledAt, power, kills } maps; fetchAlliance(id) for the live:true shape only, NotLiveError on the stub shape. No refresh functions — the endpoint is closed and the header comment says so.
- index.ts exports { v1, internal }.
Tests (mocked fetch; bodies from fixtures/v1-* and fixtures/probe-*): both adapters parse into the same type; totalKills == sum(members.kills); cached parsed; retry then success; 429 aborts; headers always present; ranks parsing; NotLiveError on the URSA stub fixture.
One opt-in live smoke test (LAP_LIVE_TEST=1) calling /v1/quota once; run it once and record before/after remaining.
</task>

<constraints>
- Branch on `response.status`, never `statusText`: on Node 26 `fetch` may negotiate HTTP/2 and `statusText` is empty there (plan §11.4).
- No live calls in unit tests (CI, quota). The smoke test is the only live call this session: 1.
- internal.ts must not contain any code path that writes to or refreshes the site; a reviewer will grep for it.
- No upstream URL literal outside the defaults in lib/env.ts (LAP_API_BASE_URL, LAP_SITE_BASE_URL); write the test that greps for it (plan Phase 2). Each adapter validates the response with a zod schema of only the fields it reads; a schema failure is its own error class and run_logs code (`v1.schema`, `internal.schema`).
</constraints>

<verify>
Check each test against the behaviour it names; none may pass against an empty implementation.
</verify>

<done_when>
Unit tests pass offline; smoke test cost exactly 1 call; docs/handoff/02-sources.md written. PR: "feat: session 2 — source adapters".
</done_when>
```

---

## Session 3 — Schema, collector, freshness

**Model:** opus · **Effort:** high · **Mode:** plan mode first

```text
<session>
Session 3 of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/handoff/00–02, IMPLEMENTATION_PLAN.md §3.4, §3.5, §3.7, §6, Phase 3 and §11.1.
</session>

<task>
Plan first. Then, in this order:
1. Drizzle schema from §6 exactly (events, snapshots, alliance_snapshots, member_snapshots) with constraints and the uid index. Migration. Small lib/db.ts.
2. lib/compute.ts, pure: sumKills, sumPower, isFresh(now, updatedAt, maxAge), delta(before, after) returning null when either side is not fresh, rosterDiff(before, after) → { joined, left, stayed, renamed }, nameHistory(rows) → ordered distinct (tag, name) with first/last seen (§3.8), seriesDeltas(referenceRows) → per-event deltas and change flags with the stale rule (Phase 5e). Property tests with fast-check: totalKills equals the member sum for any roster; delta of alliance totals equals the sum of member deltas plus joined minus left; delta is null whenever either side is stale; nameHistory never drops a pair and keeps first-seen order; for seriesDeltas the sum of consecutive deltas equals last − first when no row is stale.
3. Freshness tests BEFORE the collector: a row whose source_updated_at is older than 20 min is is_fresh=false and makes the snapshot partial; a stale row never yields a delta; a stale run (running > 10 min) is re-runnable without force; a re-run fetches only alliances with no row.
4. lib/collector.ts per the Phase 3 pseudocode: quota check; fetch rosters via deps.v1 at concurrency 4; on final failure per alliance try deps.internal.fetchAlliance and mark source='internal', NotLiveError → row with error; board best-effort; freshness per row; status rules; one call counter with MAX_UPSTREAM_CALLS=120.
5. Collector tests with mocked v1 + internal: happy path all fresh; a v1 response with an old updated_at → stale row → partial with that alliance named in the summary; v1 fails and internal is live → row with source internal; v1 fails and internal is a stub → row with error; 429 mid-run → partial with the rows so far; MAX_UPSTREAM_CALLS aborts even when nothing fails; thrown error leaves the row at running.
6. `pnpm snapshot:dry --phase before` against the mocked sources.
</task>

<constraints>
- No routes, no logging transport, no notifications: a logger interface with a console implementation. Those are Session 4.
- No live API calls in this session.
- Freshness is the guarantee this tool exists for (§3.7): a delta against stale data must be impossible to display. Tests pin that, not coverage.
- Time comes from deps.now so freshness is testable without waiting.
</constraints>

<verify>
Each test asserts the property in its name; the call counter is incremented in exactly one place.
</verify>

<done_when>
Every test named above exists and passes; migration generated; docs/handoff/03-collector.md lists the freshness tests. PR: "feat: session 3 — schema, collector, freshness".
</done_when>
```

---

## Session 4 — Routes, logger, notifications

**Owner-supplied `<adjustments>` (2026-11-04) — paste right after `</task>`, together with the block from `docs/handoff/03-*.md`:**

```text
<adjustments>
- Lint the dependency rule (plan §11.2): add `import-x/no-restricted-paths` zones to eslint.config.mjs from docs/ARCHITECTURE.md — lib/compute, lib/budget, lib/schedule import nothing from `@/`; `lib/**` never imports `@/app/**`; `app/**` never imports `@/lib/sources/**` or `@/lib/repo/**`. Prove it with a scratch file containing a forbidden import that `pnpm lint` rejects, then delete the file and paste the output in the handoff.
- max-lines-per-function is 80 and max-depth is 3 (PR "chore: lint limits"); don't split a function only to satisfy a counter — split along the architecture or leave it.
</adjustments>
```


**Model:** opus · **Effort:** medium · **Mode:** plan mode first

```text
<session>
Session 4 of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/handoff/00–03, IMPLEMENTATION_PLAN.md Phase 4, Phase 6 ("Notifications", "Observability", "Logging guarantees") and the Friday check in §3.4.
</session>

<task>
Plan first. Then:
1. lib/logger.ts: implements the Logger interface from Session 3 by inserting into run_logs (plan §6, Phase 6); every method is one INSERT in try/catch, never throws, never recurses (imports only lib/repo and lib/redact); error-level lines are mirrored once to console.error; stops at MAX_RUN_LOG_LINES = 400 with a final `log.capped` line; every `data` object goes through redact() first. Plus instrumentation.ts with onRequestError → app_errors (1 insert/s per instance, table capped at 500 rows by the insert).
2. lib/notify.ts: public and admin Discord senders with the exact templates from Phase 6; silent when unset; called only after the snapshot row is finalised.
3. Routes: POST /api/tick (Bearer CRON_SECRET; event-driven per plan §3.1: create the coming Saturday's event row with before_at/after_at from SNAPSHOT_BEFORE/AFTER in SERVER_TZ when within a day of it; run the one phase whose [x_at, x_at + SNAPSHOT_WINDOW_MIN) window contains now and has no snapshot; after a test event's AFTER phase compute and post the rehearsal verdict; Friday check after QUOTA_CHECK_AT; 204 when nothing is due), POST /api/rehearsal (x-edit-pin; inserts an is_test event named `REHEARSAL <iso>` with before_at = now + 15 min, after_at = now + 45 min; 409 if one is pending or a §3.1 guard applies; the tick calls the same lib function for REHEARSAL_AT — weekly, comma-separated list, empty = off — and prunes rehearsals beyond REHEARSAL_KEEP), POST /api/snapshot (phase, force; Bearer CRON_SECRET or x-edit-pin compared with timingSafeEqual; Postgres-backed rate limiter per §12.2 (auth_attempts table; per-IP 5/15 min, global lockout at 20/h; never module-scope state); run lock → 409 via a conditional update, not read-then-write; maxDuration = 120; try/catch that always finalises the snapshot row), GET /api/events, GET /api/events/[id] (read models only — §12.1 blocked keys never appear), GET /api/quota (numbers only), GET /api/quota/check (posts to the admin webhook if remaining < 900). zod on every body and query string. Error responses carry a code, never a message from a third-party error.
3b. Migration: `events.before_at`, `events.after_at` (timestamptz, not null) — Session 3's schema predates them; generate the Drizzle migration here and make the collector's event creation set them.
3c. lib/notify.ts: `is_test` events never call the public webhook; admin messages for them are prefixed `[TEST]`; the rehearsal verdict message lists each check with ✅/❌ and the number behind it (plan §3.1).
4. Tests: tick creates the Saturday event once and never twice; REHEARSAL_AT creates a rehearsal once per listed slot per week and never on EVENT_WEEKDAY or the day after; the guard refuses a rehearsal 3 h before a real before_at; REHEARSAL_KEEP prunes the oldest rehearsal and its rows; tick runs BEFORE exactly once across three ticks inside its window and never outside it (deps.now injected); a rehearsal event created at T runs BEFORE on the first tick ≥ T+15 and AFTER on the first tick ≥ T+45; the verdict is PASS on a mocked fresh pair and FAIL naming the alliance when one `source_updated_at` did not advance, and FAIL naming the number when calls_used ≠ the quota drop; test events post to admin only; tick with both phases due runs only the earlier one; 409 on an active lock; the snapshot row is finalised when the collector throws; the logger stops at the 400th line and writes `log.capped`; a logger whose repo throws does not throw and the run completes; only CRON_SECRET and PIN are accepted on /api/snapshot; the rate limiter blocks the 6th attempt from one IP and the global lockout engages at 20 across IPs, with state read back from the DB (a fresh module import must still see the count); `GET /api/events/[id]` contains none of BLOCKED_ROSTER_KEYS; the logger redacts a value equal to EDIT_PIN.
</task>

<constraints>
- The finally block exists because serverless functions drop buffered events on return; a shutdown skipped on any path is a bug, not a style issue.
- GET /api/quota costs one upstream call per request; the UI must warn before calling it.
</constraints>

<verify>
Trace every early return and thrown error in /api/snapshot and confirm shutdown() still runs.
</verify>

<done_when>
Tests pass; `pnpm build` passes; docs/handoff/04-routes.md has a curl example per route. PR: "feat: session 4 — routes, logger, notifications".
</done_when>
```

---

## Session 5 — Adversarial review (read-only)

**Model:** fable · **Effort:** xhigh · **Mode:** plan mode, and it must **stay** there — this session changes nothing.
(`fable` unavailable → `opus` at `xhigh`.)

```text
<session>
Session 5 of SESSION_PLAYBOOK.md. You are a reviewer. Stay in plan mode; do not edit any file. Read CLAUDE.md, IMPLEMENTATION_PLAN.md in full, docs/handoff/00–04, then the code under lib/, app/api/, drizzle/ and the tests.
</session>

<task>
Review the code against the plan, not against taste. Report only findings that affect correctness, the quota guarantees, or stated requirements. For each: file and line, what the plan requires, what the code does, severity (blocker / should-fix / note), and a one- or two-sentence fix. Check specifically:
- Can a snapshot be marked complete with any row whose source_updated_at is older than 20 min? Trace the v1 path, the internal fallback path, and a re-run.
- Can a delta ever be displayed when either side is stale, or between a roster number and a board number?
- Does the AFTER run ever use a different alliance list than the event's copy?
- Is MAX_UPSTREAM_CALLS counted on every upstream call (retries and quota checks included)?
- Does any code path call the internal refresh endpoint or send Origin/Referer/cookie headers to the site?
- Can a logger failure (DB down) abort or delay a run? Can the logger ever call itself?
- Can the exception cap be bypassed by aggregated events?
- Is the run lock race-safe for one scheduler plus one human (conditional update or unique constraint; read-then-write is not acceptable)?
- Any place a key, PIN or secret could reach logs, the public webhook, a response body or git?
- Tests that assert the wrong thing or pass vacuously.
</task>

<constraints>
- A reviewer asked to find gaps will find some; report only gaps that matter to correctness or requirements, and put everything else under Notes. Chasing cosmetic findings leads to over-engineering.
- Remove all mannered prose from the report.
</constraints>

<done_when>
docs/handoff/05-review.md with sections Blockers, Should-fix, Notes, and "What I checked and found correct". Do not commit.
</done_when>
```

Read the report yourself before Session 5b and decide which should-fix items you accept.

---

## Session 5b — Fix review findings

**Model:** opus · **Effort:** medium · **Mode:** default

```text
<session>
Session 5b of SESSION_PLAYBOOK.md. Read CLAUDE.md, IMPLEMENTATION_PLAN.md, docs/handoff/05-review.md and handoffs 02–04.
</session>

<task>
Fix every Blocker. Fix these Should-fix items: <paste the ones you accept, or "all">. Skip Notes unless trivial. For each fix add or adjust a test that would have caught it. No refactoring beyond the findings.
</task>

<verify>
Full test suite and build. For each Blocker, name the test that now covers it.
</verify>

<done_when>
All Blockers closed with a test; suite green; docs/handoff/05b-fixes.md lists each finding and what changed. PR: "fix: session 5b — address review findings".
</done_when>
```

---

## Session 6 — UI: main table + alliance page, mobile-first

**Model:** sonnet · **Effort:** medium · **Mode:** default

```text
<session>
Session 6 of SESSION_PLAYBOOK.md. Read docs/DESIGN.md §3–§5 and §9 first (plain styling now, but the component list, spacing and the never-list already apply). Read CLAUDE.md, docs/handoff/00 and 04, IMPLEMENTATION_PLAN.md Phase 5, 5c, 5e and §3.8. Read the Phase 5b hard rules but do no branding yet.
</session>

<task>
Build with plain Tailwind, no component library, server-rendered:
- A `StatTable` component with two layouts from one data shape: cards below 640 px, table at ≥ 640 px; compact numbers (3.94B / 34.2M) with full values on tap; signed, coloured deltas with a sign character; nothing hover-only.
- `/` and `/events/[id]`: event selector in a sticky compact header, status chips, quota, the comparison table/cards sorted by before.total_power — each metric as value · signed delta with arrow · percent, kills with the member-loss note when negative (Phase 5) — with the "formerly …" badge from lib/queries/names.ts, freshness dots with updated_at on tap, board numbers in a collapsed section with pulled_at. No run buttons on public pages.
- `/admin`: PIN gate (bottom sheet, `inputmode="numeric"`, once per session), noindex + robots Disallow, not linked from public pages; effective schedule in server time and UTC from lib/env plus the next event's before_at/after_at; **Rehearse now** (confirm: ~45 API calls over ~50 min; shows the pending rehearsal's phase status and the last verdict with its ✅/❌ lines); "Run BEFORE/AFTER now" for the current event (confirm: ~21 API calls, up to a minute); /admin/runs (list), /admin/runs/[id] (the run_logs timeline: time, level, code, alliance tag, the data fields that matter), /admin/errors (app_errors grouped by digest, newest first).
- `/events/[id]/alliances/[unionId]`: header with the alliance name timeline; member StatTable with before/after/delta, joined/left from compute.rosterDiff, "(was X)" on renamed members, client-side sort, min/max might inputs, name filter; each member links to /players/[uid] (page comes in Session 6b — link may 404 for now). Below it, the "Across events" section from Phase 5e using lib/queries/alliances.ts allianceHistory and compute.seriesDeltas: one card/row per event, after-snapshot reference (B marker on fallback), name/tag changes, members with +joined/−left, might/kills/lv deltas vs previous event, server rank.
- `pnpm db:seed`: three fake events from fixtures/ (include one renamed alliance, one renamed member, one member who changes alliance, and one stale row) so every state renders locally.
- Screenshots at 360, 390 and 1280 px of both pages → docs/screenshots/06-*.png. Run Lighthouse (mobile) on `/` and record the performance score.
</task>

<constraints>
- Phone first: most readers arrive from a Discord link on a phone during the event. If something only works on desktop, it is not done.
- No charts, no new aggregate queries; those are v2.
- Touch targets ≥ 44 px; no horizontal page scroll at any width — check it in the screenshots, don't assume it.
</constraints>

<done_when>
Nine screenshots exist (main, alliance, admin at three widths); no horizontal scroll in any; Lighthouse mobile performance ≥ 90 on `/` (or the number and why); seed works from an empty DB; docs/handoff/06-ui.md written. PR: "feat: session 6 — UI, mobile-first". Put the Vercel preview URL of the PR in the handoff once Session 8 has linked Vercel (before that, screenshots are the review).
</done_when>
```

---

## Session 6b — Player pages and search

**Model:** sonnet · **Effort:** medium · **Mode:** default

```text
<session>
Session 6b of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/DESIGN.md §3–§5 and §9, docs/handoff/06-ui.md, IMPLEMENTATION_PLAN.md Phase 5d, 5e, §3.8 and §12.1.
</session>

<task>
Using the StatTable and header patterns from Session 6, build:
- lib/queries/players.ts: history for one uid across events (member_snapshots → alliance_snapshots → snapshots → events), and a name search over current and historical names (ILIKE), capped at 50 results.
- `/players/[uid]`: header (current name, alliance tag link, name timeline, alliance-membership timeline), then the Phase 5e "Across events" StatTable: one card/row per event, newest first, with name/alliance changes marked, might and kills with both the in-event delta and the delta vs previous event (compute.seriesDeltas), lv delta, fresh. Last 12 by default, "show all".
- `/players?q=`: search box (`type="search"`), results list with name, current alliance, last seen event; ambiguous names show every match.
- Link the search from the main header. Extend db:seed so one player appears in two alliances across the two events.
- Screenshots at 360, 390 and 1280 px of both pages → docs/screenshots/06b-*.png.
- A test asserting the player query never returns a §12.1 field.
</task>

<constraints>
- Same mobile rules as Session 6; same component — a player page must look like an alliance page.
- Stats and names only: a player page shows nothing the tracker site doesn't already show (§12.1).
</constraints>

<done_when>
Both pages render from seed data; screenshots exist; the §12.1 test passes; docs/handoff/06b-players.md written. PR: "feat: session 6b — player pages and search".
</done_when>
```

---

## Session 7 — Branding

**Model:** opus · **Effort:** medium · **Mode:** default
If the `frontend-design` skill is available, open the prompt with "Use the frontend-design skill."

```text
<session>
Session 7 of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/DESIGN.md in full (the contract), docs/handoff/06-ui.md and 06b-players.md, IMPLEMENTATION_PLAN.md Phase 5b.
</session>

<task>
Step 1 — mock only. Create lib/brand/tokens.css (the §2–§4 tokens of docs/DESIGN.md, light and dark), the Logo, LaceBorder and YarnCorner SVG components, and a static page /brand showing: logo at 24 px and 200 px, the palette, both typefaces, the lace border, the yarn corner, the wax-seal button, the three status-chip icons, one sample table row using the tokens; light and dark mode. Screenshots at 360 px and 1280 px → docs/screenshots/07-brand-*.png. Then STOP and ask me to review.

Step 2 — only after I say yes, in this session: apply tokens and components to the Session 6 and 6b pages (main, alliance, player, search). Decoration in header, corners, borders and empty states only; the table stays plain and high-contrast. Then the error pages from Phase 5b: app/not-found.tsx, app/error.tsx and app/global-error.tsx with one original inline-SVG illustration each, the Phase 5b copy, a single CSS keyframe animation per page that stops under prefers-reduced-motion, a Retry button on error.tsx calling reset(), and never an error message, digest or stack in the markup. Screenshot both at 360 px. Favicon, opengraph-image and web manifest with 192/512 icons from the logo. Re-take the Session 6/6b screenshots at 360 and 1280.
</task>

<constraints>
- Nothing from the game: no logo, art, fonts or screenshots. Original SVG only. The site is public and the game's assets are not ours.
- Avoid these specific defaults: Inter/Roboto/system fonts for display text, purple gradients, pill-shaped buttons, numbered "01/02/03" section labels, italic accent words in headlines, generic card grids. The brief in Phase 5b says what to use instead.
- The stop after step 1 is deliberate: a rejected mock costs minutes, a rejected full restyle costs the session.
- The mascot is the Granny Doctor (DESIGN.md "Mascot"): an old lady plague doctor with a cane and a knitting bag, original, three poses at most. Comic but serious; game references only as allusions in copy.
- Every string you add goes through lib/copy.ts (create it if Session 7b hasn't yet); no literals in components.
- docs/DESIGN.md §9 is a hard list; §10's colour-literal test and the screenshot set are part of done. If the owner changes a decision at the mock, edit DESIGN.md in the same commit as the tokens.
</constraints>

<done_when>
Mock approved by me; pages re-screenshotted; 404 and error pages exist with their screenshots and a test that error.tsx output contains none of the thrown error's text; no game assets in the repo. Commit after step 1 ("feat: brand mock") and step 2 ("feat: session 7 — branding applied"). docs/handoff/07-brand.md written.
</done_when>
```

---

## Session 7b — Usability and language-light pass

**Model:** opus · **Effort:** medium · **Mode:** default
**Before starting (you, by hand):** pick three alliance members who read little or no English (ideally RU, ES, PT) and tell them a link is coming; the session gives you the message to send.

```text
<session>
Session 7b of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/DESIGN.md in full ("Who uses this", "Language-light rules", "Navigation and hierarchy" are the contract), IMPLEMENTATION_PLAN.md Phase 5f, docs/handoff/06-ui.md, 06b-players.md and 07-brand.md, and look at every screenshot in docs/screenshots/.
</session>

<task>
1. Audit, then fix, every public page (main, alliance, player, search) against the language-light rules. Concretely: every sentence becomes a chip, a label or a number; one legend under the header; status strip with Before/After chips instead of prose; order strictly by rank (the page is for the whole server; other alliances will use it) with an optional per-viewer "this is my alliance" highlight + jump control kept in localStorage (try/catch, page correct without it); rank numbers; header title "Server 325 · Saturday Ledger" with the byline "kept by the Old Grandmas"; three channels per state (colour + arrow + word); Intl formatting for numbers, dates and times from the request's Accept-Language with server time explicit; labels ≤ 2 words, the game's own terms (Might, Kills, Members). Quota and sync details move to /admin.
2. Move every user-facing string into lib/copy.ts (stable keys, English values, one module); components import from it. Add a test that greps app/ for JSX text nodes and string props longer than 2 words outside lib/copy.ts and fails on hits (allow numbers, punctuation and keys).
3. Navigation: breadcrumbs on alliance and player pages, search in the header, one row shape at the three depths. No tooltip carries information that isn't also visible.
3b. Rank movement (plan Phase 5e): `#n` beside every tag with `▲k` / `▼k` / `=` — before → after on the comparison page (ledger rank by might and by kills, server rank from the API), event over event on the alliance and player "Across events" rows. `compute.rankDelta` pure with a test; `—` when there is no previous value.
4. Write the message for the owner to send to three members (in English; the owner translates if needed): the preview URL and three tasks — find your alliance's kills change; which alliance lost the most members; when are the numbers from. Wait for the owner's answers; record each member's language, answers, time and confusion in the handoff; fix what failed, in this session, and re-screenshot.
5. Screenshots at 360/390/1280, light and dark, for every page touched.
</task>

<constraints>
- No translation yet: the fix for "I can't read this" is fewer words and better structure, not a dictionary.
- No new components beyond DESIGN.md's list; status-strip, rank and legend are already on it.
- Nothing from the game's assets. The tracker site is a reference for clarity only.
</constraints>

<done_when>
Every public page passes the language-light rules; ranks and their movement show on cards, rows and across-events sections; lib/copy.ts holds all strings and the grep test passes; the three-member test is recorded with its fixes; screenshots attached; docs/handoff/07b-usability.md written. PR: "feat: session 7b — usability and language-light pass" (into dev).
</done_when>
```

**Re-plan:** Session 8 is deploy; the only thing it needs from here is whether lib/copy.ts introduced a build step (it shouldn't).

---

## Session 8 — Deploy, GitHub Actions, env, webhooks

**Owner-supplied `<adjustments>` (2026-11-04) — paste right after `</task>`, together with the block from `docs/handoff/07-brand.md`:**

```text
<adjustments>
- Lint the dependency rule (plan §11.2; it was scheduled for Session 4 too late): add `import-x/no-restricted-paths` zones to eslint.config.mjs from docs/ARCHITECTURE.md — lib/compute, lib/budget, lib/schedule import nothing from `@/`; `lib/**` never imports `@/app/**`; `app/**` never imports `@/lib/sources/**` or `@/lib/repo/**`. If the current code violates a zone, that is a finding: list it in the handoff and fix only what is a one-line import move; otherwise narrow the zone and say so. Prove the rule with a scratch file `pnpm lint` rejects, then delete it.
- Migrations on deploy (plan §3.2): add `db:migrate` (`drizzle-kit migrate`, reading DATABASE_URL_UNPOOLED), set Vercel's Build Command to `pnpm db:migrate && pnpm build` (ask the owner to do it in the dashboard, or `vercel project` settings via the CLI), add the drift gate to `pnpm check` (`db:generate` yields no new file; `drizzle-kit check` passes), and show the schema version (`drizzle.__drizzle_migrations`) on `/admin` and in the Friday message. First production deploy = first migration of Neon main; the PR's preview build = first migration of `preview`. Verify both by reading `__drizzle_migrations` on each branch (Neon MCP or `psql`) and paste the counts.
- Plan §10b lists what Sessions 3–5b changed relative to the plan text; read it before the deploy checks. N10 (x-real-ip trust on Vercel) is yours to verify empirically: send a request with a forged `x-real-ip` to the deployed /api/snapshot and read which IP the limiter recorded.
</adjustments>
```


**Model:** sonnet · **Effort:** medium · **Mode:** default
**Before starting (you, by hand):** `PREREQUISITES.md` §6, row "Session 8".

```text
<session>
Session 8 of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/handoff/00 and 04, IMPLEMENTATION_PLAN.md Phase 6, §3.1 and the Friday check in §3.4.
</session>

<task>
1. .github/workflows/tick.yml: `*/15 * * * *` (daily, plan §3.1) → one curl --fail --max-time 150 -X POST $APP_URL/api/tick with secrets.CRON_SECRET; workflow_dispatch with a `phase` input calling /api/snapshot directly. No times in YAML (§3.1). No retry actions.
2. .github/workflows/dependabot-automerge.yml (plan §11.6): Dependabot minor/patch only, `gh pr merge --auto --squash`, `permissions: contents: write, pull-requests: write`. Then .github/workflows/keepalive.yml: monthly commit of a timestamp to .keepalive on the `keepalive` branch (`git push --force origin HEAD:keepalive`; never dev or main — both are protected and have no bypass). `permissions: contents: write`, actions pinned to SHAs, no third-party "auto-commit" action — plain `git config/commit/push` in a run step. Add `"git": { "deploymentEnabled": { "keepalive": false } }` to the existing vercel.json so Vercel never builds that branch. Test it once with `gh workflow run keepalive.yml` and show the resulting commit on that branch, and that no Vercel deployment was created for it.
2b. Verify the SCM setup empirically and paste the output: `gh api repos/{owner}/{repo}/rules/branches/main` lists pull_request, required_status_checks (`check`), non_fast_forward and required_linear_history; `gh api repos/{owner}/{repo}/rules/branches/dev` lists the same plus required_linear_history, and each branch's pull_request rule allows only its merge method (merge on main, squash on dev); `gh api repos/{owner}/{repo}` shows allow_squash_merge true, allow_merge_commit true, allow_rebase_merge false, delete_branch_on_merge true, allow_auto_merge true. `.github/dependabot.yml` has `target-branch: dev` for both ecosystems (add it if missing). Confirm in the Vercel dashboard (ask the owner, or `vercel env ls` if the CLI is linked) that DATABASE_URL, CRON_SECRET, EDIT_PIN differ between Production and Preview and that no NOTIFY_* exists in Preview; confirm the PR's preview URL asks for Vercel authentication.
3. First release, after the owner has merged this session's PR into `dev` (as a follow-up message in this session, or the first thing in Session 9 — say which in the handoff): open the release PR `dev → main` titled `release: v0.1.0` with the generated notes as body (`gh api repos/{owner}/{repo}/releases/generate-notes -f tag_name=v0.1.0 -f target_commitish=dev` gives the text). The owner merges it with a **merge commit**; then `gh release create v0.1.0 --target main --generate-notes --title "v0.1.0 — first production deploy"`. Confirm Vercel produced a **production** deployment from the merge (Deployments → filter `main`); paste the deployment URL and the commit SHA.
3b. Verify the deployed app: curl $APP_URL for GET /api/events and GET /api/quota (1 upstream call — note it). Confirm the production function's maxDuration (120 s) is honoured on the Hobby plan; note the measured duration. If tables are missing, ask me before running db:push against production.
4. `gh workflow run tick.yml` once outside any window and confirm a 204. Then the end-to-end proof of the scheduler: ask the owner to tap **Rehearse now** on `/admin` (or `curl -X POST -H "x-edit-pin: …" $APP_URL/api/rehearsal` — the owner types the PIN, you never see it) and, without triggering anything by hand, watch the cron ticks run BEFORE within 15 min of before_at and AFTER within 15 min of after_at; paste the two `[TEST]` admin messages and the verdict. If the verdict is FAIL, that is the session's finding — fix only what the ❌ line names. Then set QUOTA_CHECK_AT to a few minutes from now in Vercel, redeploy, confirm the Friday message, restore the value.
5. README.md: deploy steps, changing the alliance list, changing snapshot times (env vars → redeploy), rotating the API key or PIN, running a snapshot by hand from /admin or GitHub.
</task>

<constraints>
- GitHub disables schedules in a public repo after 60 days without repository activity; the keepalive workflow (on its own branch) plus Dependabot are that activity. Not optional.
- The tick must be idempotent: prove with two back-to-back `gh workflow run` calls inside a window that only one snapshot row exists.
- Secrets are read from `gh secret list` and the Vercel env list, never echoed.
</constraints>

<done_when>
Both workflows validate; the manual Friday check produced a Discord message; README has the ops sections; docs/handoff/08-deploy.md written. PR: "chore: session 8 — deploy and scheduling" (into dev). `v0.1.0` is the first `dev → main` release PR (step 3) and is the first production deploy.
</done_when>
```

---

## Session 9 — Dry run against production

**Model:** opus · **Effort:** high · **Mode:** default
**When:** a weekday, never Friday or Saturday. Costs ~22 upstream calls.

```text
<session>
Session 9 of SESSION_PLAYBOOK.md — the dry run. Read CLAUDE.md, docs/handoff/00, 03, 04, 08, IMPLEMENTATION_PLAN.md Phase 7 and §3.6. Today is a weekday; confirm with me before any call that spends quota.
</session>

<task>
1. Ask the owner to tap **Rehearse now** on `/admin` (an `is_test` event: admin webhook only). Do not trigger either phase by hand: the point is the cron path. Wait for the `[TEST] Rehearsal PASS/FAIL` message (~50 min; use the time to prepare the queries for step 2) and paste it.
2. From the DB (snapshots, alliance_snapshots, run_logs) record in a table: wall-clock duration, calls_used, quota_remaining_after, retries by status code, and per alliance: seconds for the call, cached, age of source_updated_at, is_fresh, source. Confirm calls_used equals the drop in /v1/quota.
3. Compare members.length vs member_count for all 20 alliances. Ask me to compare OGs total_kills with the in-game alliance screen; record the difference and whether the board number is closer.
4. Decide from the numbers: did every /v1 read come back fresh? How long did pulls take vs the 2.4 s baseline, and did 503/504 appear? Is maxDuration right? Propose and implement only what the numbers justify, with a test; say what you did not change and why.
5. Leave the test event in place (`is_test` keeps it off the public pages); it is the baseline the first Saturday is compared against.
</task>

<constraints>
- Every estimate in the plan about duration, 503 rates and concurrency is a guess until this session measures it; change code only from measured numbers.
</constraints>

<done_when>
docs/handoff/09-dryrun.md has the numbers table, the kills comparison and the changes made; quota arithmetic reconciles exactly. PR: "chore: session 9 — dry run results" (into dev). After merge, if the quota arithmetic reconciled: release PR `dev → main` titled `release: v1.0.0`, merge commit, then `gh release create v1.0.0 --target main --generate-notes --title "v1.0.0 — dry run reconciled"` — that is the production deploy the first Saturday runs on.
</done_when>
```

---

## Session 10 — README and runbook polish

**Model:** haiku · **Effort:** medium · **Mode:** default

```text
<session>
Session 10 of SESSION_PLAYBOOK.md. The current date is <today>. Read CLAUDE.md, IMPLEMENTATION_PLAN.md Phase 8, and every file in docs/handoff/.
</session>

<task>
Rewrite README.md for a non-developer alliance admin: what the tool does; the Saturday timeline (what runs automatically, what each Discord message means, what to do on ⚠️ or ❌); what "stale" means on the table; running a snapshot by hand; where to look when something breaks (/admin/runs, /admin/errors); the quota rules in plain language. Use the real numbers (duration, calls) from docs/handoff/09-dryrun.md. Move developer setup to CONTRIBUTING.md.
</task>

<constraints>
- Keep working until both files are done; don't stop to ask unless something in the handoffs contradicts itself — then ask one question.
- Plain language, no marketing phrasing; the readers are gamers, not engineers.
</constraints>

<done_when>
README reads as an operator manual; CONTRIBUTING.md holds developer content; docs/handoff/10-docs.md written. PR: "docs: session 10 — README and runbook".
</done_when>
```

---

## After v1

`IMPLEMENTATION_PLAN.md §8b` (Discord `/ask` with LLM → query templates) gets its own playbook once a few Saturdays of real data exist. The questions people actually ask will change the templates; don't plan it before then.
