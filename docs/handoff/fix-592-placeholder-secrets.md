# fix/592-placeholder-secrets

## Built
- `parseEnv` in `lib/env.ts` throws when `NODE_ENV` and `VERCEL_ENV` are both `production` and `EDIT_PIN` or `CRON_SECRET` equals its public placeholder from `.env.example`. The error names the variable, never the value.
- The two strings are in one const, `PUBLIC_PLACEHOLDERS`, with a comment naming `.env.example`.
- One parametrised test in `lib/env.test.ts`, one case per variable. Each case also checks that the same value passes on a preview and in development.
- Amendment to D03 dated 2026-11-22.

## Decisions
- Exact match only; no length or strength rule, so production cannot be stopped by a new rule.
- The check sits in `parseEnv`, so `getEnv()` and `instrumentation.ts` run it once at server start, with no change to `instrumentation.ts`.
- `NODE_ENV` and `VERCEL_ENV` are read from the source passed to `parseEnv`, which is `process.env` in `getEnv()`.

## Deviations
- The task said to find the placeholders without opening an env file. A grep printed the two lines of `.env.example` by accident. The coordinator then approved using those two values.
- The agent worktree no longer existed on resume, so the work was done in a new worktree from `origin/dev`.

## Verified
- `pnpm vitest related --run lib/env.ts lib/env.test.ts`: 154 files passed, 1 skipped.
- `pnpm check`: see the PR.

## Open issues
- The placeholder strings must be kept in step with `.env.example` by hand. If the template changes, the guard stops matching.

## Next
- None.

What was missing from the task prompt? The location of the cron placeholder outside an env file.

PR: (added by the orchestrator)
