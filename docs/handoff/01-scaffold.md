# 01 — Scaffold and harness

## Built

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (install scripts denied), `.npmrc` (`engine-strict=false`), `.nvmrc` (`26`): pinned deps, `packageManager: pnpm@12.16.1`, `engines.node >=22.0.0`.
- `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, plus `esModuleInterop` (which `next build` insists on).
- `eslint.config.mjs`: typescript-eslint `strict`, `import-x/order`, max-lines 300, max-lines-per-function 50 (off for `*.test.ts`, D14), complexity 12, no `any`.
- `.prettierrc.json`, `.prettierignore` (the fixtures, the three planning docs and CLAUDE.md are kept verbatim).
- `vitest.config.ts`, `postcss.config.mjs`, `app/globals.css` (Tailwind 4).
- §11.1 layout:
  - `app/layout.tsx`, `app/(pages)/page.tsx`, and `app/api/tick/route.ts`: a 501 placeholder plus its test.
  - `lib/{collector,compute,logger,notify}.ts`, `lib/sources/{v1,internal,index}.ts`, `lib/repo/index.ts`: one-line header stubs.
  - `lib/queries/{index,blocked-keys}.ts` plus a test.
- `lib/env.ts` (zod, every `.env.example` variable) and `instrumentation.ts`, which exits 1 at server start on a bad environment. Test included.
- `lib/redact.ts` plus a test. `lib/budget.ts` (`requiredQuota`) plus a fast-check property test.
- `next.config.ts` (static security headers, `poweredByHeader: false`) and `proxy.ts` (per-request nonce CSP; API routes get `default-src 'none'`).
- `lefthook.yml` (gitleaks, prettier, eslint on staged files) and `.gitleaks.toml` (the defaults plus a `lap_` rule).
- `.github/workflows/ci.yml` (SHA-pinned, `contents: read`, frozen install, check, audit) and `.github/dependabot.yml`.
- `.claude/settings.json` (hooks plus permissions), `.claude/rules/{collector,api-routes,tests}.md`, `.claude/skills/record-fixture/SKILL.md`, `REVIEW.md`.
- `scripts/cloud-setup.sh` (Node 26 from nodejs.org with a SHA-256 check, pnpm 12, gitleaks via `go install`), `scripts/install_pkgs.sh` (SessionStart), `scripts/hooks/post-edit-lint.mjs`, `scripts/hooks/stop-check.sh`.
- `docs/ARCHITECTURE.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md` (D1–D14), `README.md`.
- From Session 0's no-quota part (owner decision): `CLAUDE.md` (playbook §C verbatim) and `.env.example`.
- Moved with `git mv`: `IMPLEMENTATION_PLAN.md`, `SESSION_PLAYBOOK.md` and `PREREQUISITES.md` are now in `docs/`, with path references updated (D13).
- Untracked: `.env.local` (`git rm --cached`; the local file is kept, the owner had already rotated the key) and `fixtures/.DS_Store`. `.gitignore` covers `.env*` (except `.env.example`), `node_modules`, `.next`, `.claude/worktrees`.

## Decisions

- **TypeScript 6.0.3**, not 7.0.2: typescript-eslint 8.72.1 supports `<6.1.0` (D8).
- **eslint-plugin-import-x**: the plan's eslint-plugin-import was last published 2025-06 and doesn't support ESLint 10 (D9).
- **Install scripts denied** with `allowBuilds: false` for esbuild and lefthook. pnpm 12 fails installs with unapproved build scripts. Lefthook installs its git hooks through `prepare` instead (D10).
- **CSP nonce via `proxy.ts`**, and the root layout calls `connection()`, so all pages render dynamically (D11).
- **gitleaks command**: `gitleaks git --pre-commit --staged`, because `protect` is hidden/deprecated in v8.30 (D12).
- **Planning docs moved to `docs/`** (D13, owner request).
- **`instrumentation.ts` calls `process.exit(1)`.** If `register()` only throws, Next keeps the server up and answers 500 to every request (measured). Exiting is the fail-fast the plan asks for.
- **`QUOTA_CHECK_AT="fri 20:00"` is quoted** in `.env.example`, because unquoted it breaks `set -a; . .env` in a shell. Next's dotenv strips the quotes.
- **Stop hook does not honour `stop_hook_active`.** The plan wants it to block while `pnpm check` fails, bounded by Claude Code's block cap. My plan said otherwise; I changed it to match the plan.
- **Two extra deny rules** beyond §11.4's literal list: `Bash(git push -f*)` and `Bash(pnpm exec drizzle-kit drop*)`. They are aliases of rules that are already there.
- **Permissions-Policy** leaves out `interest-cohort` (obsolete).
- **`eslint-config-next` / `@next/eslint-plugin-next` not added**, because the prompt's dependency list doesn't include them. Next 16 removed `next lint`, so Next's own rules (e.g. `no-html-link-for-pages`) don't run. Worth adding when the UI starts (Session 6), with a DECISIONS entry.

## Deviations

- **Session 0 never ran.** This session wrote `CLAUDE.md` and `.env.example`, which belong to Session 0, on the owner's instruction. `config/alliances.ts`, `fixtures/README.md` and `docs/handoff/00-prereqs.md` still don't exist; they need 18 API calls and the owner's in-game clock reading. §11.1 lists `config/alliances.ts`; it is the only §11.1 path not created.
- **The three planning docs were edited** (path references only) and moved. The playbook says sessions don't edit them; the owner asked for the move in this session's prompt.
- The plan says `import/order` → `import-x/order`, `typescript` latest → 6.0.3, and `gitleaks protect` → `gitleaks git --pre-commit --staged` (see Decisions).
- Files not in §11.1, all required by §12 or Next: `proxy.ts`, `instrumentation.ts`, `lib/budget.ts` (the prompt asked for it), `lib/redact.ts`, `lib/queries/blocked-keys.ts`.

## Verified

Container: started with Node 22.23.4 and pnpm 10.28.0. I ran `bash scripts/cloud-setup.sh` (44 s), which installed Node 26.13.0, pnpm 12.16.1 and gitleaks v8.30.1. This session's Bash tool doesn't re-read `~/.bashrc`, so every command here prefixed `PATH=/opt/node26/bin:$PATH`.

```
$ node -v
v26.13.0
$ pnpm -v
12.16.1
$ gitleaks: v8.30.1 (go install), lefthook 2.2.2
```

Installed versions: next 16.4.5, react/react-dom 19.3.1, drizzle-orm 0.45.4, @neondatabase/serverless 1.2.0, zod 4.6.7, typescript 6.0.3, @types/node 26.6.6, @types/react(-dom) 19.3.0, tailwindcss and @tailwindcss/postcss 4.3.4, postcss 8.5.32, vitest 5.1.0, fast-check 4.10.2, drizzle-kit 0.31.11, eslint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.1, eslint-plugin-import-x 4.17.1, prettier 3.9.10, lefthook 2.2.2. Dates and install scripts are in DECISIONS D7.

**`pnpm check`** — 3.4–3.5 s wall (3 runs):

```
$ prettier --check . && eslint . && tsc --noEmit && vitest run
Checking formatting...
All matched files use Prettier code style!
 RUN  v5.1.0 /home/user/LAPTracker
 Test Files  5 passed (5)
      Tests  9 passed (9)
```

**`pnpm audit --audit-level high`**: exit 0, `Severity: 2 moderate`. Both are below the gate:

- esbuild <0.25 (dev-server CORS), via drizzle-kit → @esbuild-kit (deprecated) → esbuild 0.18.20.
- minimatch <11.0.1 (ReDoS), via eslint → @eslint/config-array.

Both are dev-only, and neither is fixable here without upstream releases.

**PostToolUse hook.** I wrote `lib/__scratch.ts` with an unused import, an `any`, an unused variable and misordered imports, then piped a real PostToolUse payload into the hook command:

```
run 1: exit=2 wall=.738s
run 2: exit=2 wall=.647s
run 3: exit=2 wall=.619s
eslint found problems in lib/__scratch.ts after --fix:
  1:10  error  'readFileSync' is defined but never used     @typescript-eslint/no-unused-vars
  3:10  error  'z' is defined but never used                @typescript-eslint/no-unused-vars
  5:28  error  Unexpected any. Specify a different type     @typescript-eslint/no-explicit-any
  6:9   error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars
✖ 4 problems (4 errors, 0 warnings)
```

`--fix` reordered the imports itself (node:fs first, then a blank line, then zod). Then I deleted the scratch file.

- Clean file (`lib/budget.ts`): exit 0, 0.58 s.
- Non-lintable file (`README.md`): exit 0, skipped.
- **PostToolUse timing: 0.58–0.74 s per one-file edit**, against the 10 s budget.

Caveat: Claude Code reads hooks at session start, and `.claude/settings.json` didn't exist when this session started, so the hook couldn't fire on this session's own edits. The test pipes the same JSON shape Claude Code sends into the exact command in settings.json. The first edit in Session 2 is the live confirmation.

**Stop hook**: exit 2 with the failing `pnpm check` tail while the scratch file existed (0.83 s); exit 0 on the clean tree (4.4 s).

**SessionStart hook** (`CLAUDE_CODE_REMOTE=true`):

- run 1 with no stamp: frozen install, exit 0, 0.09 s.
- run 2: stamp matched, exit 0, 0.01 s.
- `CLAUDE_ENV_FILE` received `export PATH="/opt/node26/bin:$PATH"`.

**lefthook + gitleaks.** I staged `scratch-leak.ts` containing `lap_` + 32 random alphanumerics and ran `pnpm exec lefthook run pre-commit`. Exit 1, blocked:

```
┃  secrets ❯
Finding:     export const k = "REDACTED";
RuleID:      lap-api-key
File:        scratch-leak.ts
WRN leaks found: 1
summary: (done in 0.74 seconds)
✔️ prettier (0.29 seconds)
✔️ eslint (0.70 seconds)
🥊 secrets (0.07 seconds)
```

The default rules alone would not have caught it; the custom rule in `.gitleaks.toml` did. Then I unstaged and deleted the file.

The new rule also flagged this session's own env test fixture (`lap_test000…`). It was changed to `lap_test-placeholder`, which doesn't match.

**Mutation checks** (does each test fail when it should):

- Adding `lib/queries/zz-mutant.ts` that reads `m.joined_at` fails the blocked-keys test: `expected [ 'zz-mutant.ts: joined_at' ] to deeply equal []`.
- Changing `RESERVE_CALLS` 5→4 fails the property test with `Counterexample: [0]`.

Both were reverted.

**Build, headers and CSP:**

- `pnpm build` passes: `/` and `/api/tick` are dynamic, and the proxy is active.
- `next start` with no env: it prints `Invalid environment:` with every missing key name (no values) and exits 1 at boot.
- With a dummy env, `curl -I /` returns `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `Strict-Transport-Security`, and `content-security-policy: default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; …` (no `unsafe-inline` for scripts).
- `POST /api/tick` returns 501 with `default-src 'none'`.
- Playwright on `/`: status 200, the h1 renders, 14 scripts, all with a nonce, and no console messages on a clean load.
- An injected `<img onerror>` handler (XSS-style) did not run, and Chrome reported the CSP violation.

**CI**: run 1 on push of ef8f7af, `completed / success` in 27 s (Node from `.nvmrc`, pnpm from `packageManager`, frozen install, check, audit): https://github.com/daniro-san/LAPTracker/actions/runs/41898007351

## Open issues

- **Session 0's remaining parts are not done:** `config/alliances.ts` (20 verified ids), `fixtures/README.md` and `docs/handoff/00-prereqs.md`. Session 2 reads 00-prereqs and fixtures/README; run Session 0 before Session 2.
- `.env.local` is untracked, but its content stays in the first commit's history. The owner says the key in it was already rotated. gitleaks run over the working tree flags `.env.local` (generic-api-key), so do not re-add it.
- **Node 26 on PATH in a fresh cloud session is unverified.** `cloud-setup.sh` appends the PATH line to `~/.bashrc`, but this session's Bash tool didn't pick it up (shell snapshot taken at start). `install_pkgs.sh` also writes the PATH to `CLAUDE_ENV_FILE`, which should cover it. The next cloud session must run `node -v` first; if it prints v22, prefix commands with `PATH=/opt/node26/bin:$PATH` and report it.
- Permissions allow `git push origin main`, but cloud sessions push to `claude/*` branches, so those pushes will still prompt. Add a rule if that's unwanted.
- `BLOCKED_ROSTER_KEYS` follows §12.1 and CLAUDE.md exactly. The roster also has `frame_url` (bulk, trimmed from `raw_json` by §6) and `active` (behavioural). Neither is on the list; that's the owner's call.
- The two moderate audit findings above. Dependabot will surface the fixes when upstreams release them.
- `pnpm build` rewrites `tsconfig.json` if `esModuleInterop` is removed. Leave it in.
- The plan still says `lib/lat-client.ts` in §11.2 and §11.6. §11.1 and Phase 2 say `lib/sources/v1.ts`. I treated `lat-client` as stale.

## Next

Session: 2 — Source adapters + tests (only after Session 0's remaining steps)
Model / effort: keep — no signal. The scaffold took no design judgment beyond version compatibility.
Owner must do first:

- Run Session 0 (config/alliances.ts, fixtures/README.md, 00-prereqs.md; 18 API calls, weekday only). Paste the Session 0 adjustments below.
- Paste `scripts/cloud-setup.sh` as the cloud environment's setup script, if not done.

Plan changes needed:

- §11.4 says `gitleaks protect` and `import/order`; §12.4 implies TypeScript latest. These are now `gitleaks git --pre-commit --staged`, `import-x/order` and TypeScript 6.0 (DECISIONS D8, D9, D12).
- §11.2 and §11.6 mention `lib/lat-client.ts`; it should be `lib/sources/v1.ts`.
- The playbook's Session 0 prompt tells it to write CLAUDE.md and .env.example, which now exist.

<adjustments for="Session 0">
- CLAUDE.md (playbook §C verbatim) and .env.example already exist (written in Session 1 on the owner's instruction). Do not rewrite them. Check that .env.example matches §7 and PREREQUISITES §4 and only add what's missing; lib/env.ts validates every variable in it, so update lib/env.ts and lib/env.test.ts in the same commit if you add one.
- The planning docs now live in docs/: docs/IMPLEMENTATION_PLAN.md, docs/SESSION_PLAYBOOK.md, docs/PREREQUISITES.md.
- .env.local is already untracked and gitignored.
- Fixture recording follows .claude/skills/record-fixture/SKILL.md. Save the 18 responses as the prompt says (fixtures/v1-ids/<id>.json) and create fixtures/README.md with the skill's table.
- A pre-commit gitleaks rule blocks `lap_` + 20 or more alphanumerics; a response that echoes the key will be refused.
</adjustments>

<adjustments>
- Paths: the plan is at docs/IMPLEMENTATION_PLAN.md. Stubs with header comments already exist at lib/sources/{v1,internal,index}.ts; replace them.
- Node 26's fetch: branch on `response.status` only (already in .claude/rules/collector.md).
- Put test bodies in fixtures/ via the record-fixture skill only; tests read `fixtures/v1-20261104T155902Z/alliance-*.json` (existing) and `fixtures/v1-ids/*` (Session 0).
- `lib/budget.ts` has `requiredQuota(n) = 2 × (n + 5)`; reuse it, don't re-derive.
- `max-lines-per-function` is off for `*.test.ts` (D14); every other lint limit applies to tests.
- `exactOptionalPropertyTypes` is on: optional fields on the adapter output type must be `T | null` (as in docs/ARCHITECTURE.md), not `?: T` assigned `undefined`.
- Run `node -v` first; if it's not 26.x, see Open issues.
</adjustments>
