# chore-env-safety: agents cannot read local env files; local work runs without production secrets

The owner (2026-11-21) approved this recommendation: agents must not be able to read local secret files, and local development must work without production secrets. Branch `chore/env-safety` from `origin/dev`. Part of #592.

## Built

- **`scripts/hooks/env-guard.sh`**, a PreToolUse hook for Bash, Read, Grep and Glob, registered in `.claude/settings.json`. It parses the hook input with jq, or with node when jq is missing, the same way `pr-base-guard.sh` does. It exits 2 with a one-line reason when:
  - a Bash command, Read `file_path`, Grep `path`/`glob` or Glob `pattern`/`path` contains a word that starts with `.env` after a non-word character and is not exactly `.env.example`. Examples: `.env`, `.env.local`, `.env.production.local`, `.env*`, `./.env`;
  - a Bash command names `dotenv` or `dotenvx`;
  - a Glob pattern or Grep glob ends in a part that starts with `.` and matches an env file name (`.env*`, `.e*`, `.*`).

  It lets these through: `.env.example`; `process.env.X`; "environment"; Grep content patterns such as `\.env\.local`; and `pnpm <script>`, because the `--env-file-if-exists=.env.local` sits in package.json, not in the command text.
- **`scripts/hooks/env-guard.test.ts`**: 14 cases that run the script with sample hook input.
  - Blocked: `cat .env.local`, `grep KEY .env`, `ls -a | xargs cat .env*`, `node -r dotenv/config …`, Read `…/.env.local`, Grep path `.env.production`, Glob `**/.env*`.
  - Allowed: `cat .env.example`, Read `…/.env.example`, `pnpm dev:local`, `pnpm db:local:seed --with-states`, `git status`, a grep for `process.env.EDIT_PIN` plus `echo environment`, Glob `**/*.ts`.
- **`.claude/settings.json` `permissions.deny`**:
  - Read: added `.env.local.*`.
  - Bash equivalents of the existing Read rules, which had none: `.env` as a word or after `/`, `.env.local*`, `.env.dev*`, `.env.prod*`, `.env.preview*`, `.env.staging*`, `.env.test*`, `.env.vercel*`, and `*dotenv*`.
- **`.env.example`**: lists every variable the app reads (`lib/env.ts`, plus `DATABASE_URL_UNPOOLED`, `DB_LOCAL_BRIDGE_PORT`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_API_BASE_URL`, `NEXT_PUBLIC_BLANK_COPY`) and the deploy settings, each with a one-line comment. Values:
  - required ones: the local placeholders that were in CONTRIBUTING;
  - outside services' base URLs: `127.0.0.1:9`;
  - optional secrets: empty.

  A closing comment names what is deliberately not set there: Vercel's system variables, and the test opt-ins `LAP_LIVE_TEST` (spends quota), `LAP_SMOKE_OUT` and `OCR_TEST`. The sections and their order are unchanged.
- **CONTRIBUTING.md**:
  - a "Local setup without production secrets" paragraph under Setup;
  - the placeholder block under "Local database" is replaced by a pointer to `.env.example`, so the values live in one place;
  - a line for the new hook in "How the harness works".

## Decisions

- `EDIT_PIN` and `CRON_SECRET` are not empty in the template. `lib/env.ts` requires them and the server does not start without them, so they keep the local placeholders (`000000`, a 40-character local string). The other secrets are empty.
- The guard blocks any mention of a secret env file name in a Bash command, quoted or not, commit messages included. Stripping quotes would let `echo "$(cat .env.local)"` through. An agent rephrases the message.
- Glob and Grep globs are checked only when their last part starts with `.`. Without that rule, `**/*` would be blocked as well, and it only lists file names.
- `cp .env.example .env.local` is blocked for agents, because it overwrites the owner's file. The owner runs it himself.

## Deviations

- The task asked that "each assertion must fail if the guard is removed". That holds for the 7 block cases when the guard always allows (exit 0). The 7 allow cases are checked the other way: they fail when the guard always blocks (exit 2). All 14 fail when the script is missing. All three were run once; the results are under Verified.

## Verified

- `pnpm check`: passed (prettier, eslint, tsc, vitest 299 files / 1574 tests passed, 2 files / 4 tests skipped, drift, i18n).
- Guard replaced by `exit 0`: 7 failed (the block cases). Replaced by `exit 2`: 7 failed (the allow cases). Script removed: 14 failed. Restored, and byte-compared with the original.
- jq and node paths: 13 edge inputs run with jq and with a PATH without jq gave the same exit codes.
- `.env.example` parsed with `node:util` `parseEnv` and passed through `lib/env.ts` `parseEnv`: valid. Every `envSchema` key is in the template except `LAP_LIVE_TEST` and `VERCEL_ENV`, which the closing comment names.
- No `.env*` file other than `.env.example` was opened, read or printed in this session.

## Open issues

- The guard matches text, like `pr-base-guard.sh`. Another spelling gets past it: a variable holding the name, `.e""nv.local`, or a script file that reads it. It catches mistakes, not intent.
- A Grep without `path` or `glob` searches the tree. `.env.local` is gitignored, so ripgrep skips it by default. The hook adds nothing in that case.
- A Grep glob such as `.env.e*`, which could only match `.env.example`, is blocked, because the word is not exactly `.env.example`. This is a minor false positive, left as it is.
- The hooks in `.claude/settings.json` are loaded when a session starts. Sessions already running do not have the guard.

## Next

- Model/effort: keep. The work was a shell script, a template and docs, with no app code.
- Owner first, on his own machine:
  1. Remove the production secrets from `.env.local`. Either start again from `cp .env.example .env.local` with `pnpm db:local`, or point `DATABASE_URL` at the Neon `preview` branch's role and password, never production's.
  2. If he wants, rotate everything that was ever in `.env.local`: the upstream API key, the Neon password, `CRON_SECRET`, `EDIT_PIN`, the Discord webhooks, client secret and bot token, the PostHog personal keys, `GROQ_API_KEY`, `WORKSPACE_KEYS_SECRET` (rotating it means every saved workspace tracker key must be entered again) and the VAPID private key. Then update Vercel and the GitHub secrets.
  3. Restart running Claude Code sessions so they load the new hook.
- Plan change: none.

<adjustments>
- Agents cannot read `.env.local`. A task that needs a real value must have the owner run the command himself, or use `pnpm <script>`, which loads the file into the app only.
- `.env.example` now holds the local placeholders. Copying it gives a working local setup on `pnpm db:local` with no outside calls.
</adjustments>

PR: (added by the orchestrator)
