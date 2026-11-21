---
# pr-review project config for LAPTracker, written by hand in the shape `/pr-review --setup` writes.
# Keys left out keep the skill's defaults (references/config.md).
model: sonnet

# The project's review checklist and its path-scoped rules join every subagent's context.
context_paths:
  - REVIEW.md
  - .claude/rules/*.md
  - docs/ARCHITECTURE.md
  - docs/GLOSSARY.md

# Privacy findings (blocked roster keys, secrets) are blockers.
severity_overrides:
  security: always_blocker
---

# Project-specific review rules

REVIEW.md is this project's checklist; apply every item that the diff touches. Check correctness, privacy and regressions first, and skip findings about style only (formatting, naming taste, comment wording): prettier and eslint own those.

## Always blockers

- A roster field in `BLOCKED_ROSTER_KEYS` (`lib/queries/blocked-keys.ts`) is returned, logged or sent anywhere CLAUDE.md's roster-fields rule and `.claude/rules/private.md` do not allow.
- `lib/private` is imported where the `import-x/no-restricted-paths` zones in `eslint.config.mjs` do not allow it, or a private page or handler returns private fields without `requireWorkspace` and the own-alliance filter. The one member exception is D142's own page `/w/[slug]/board/me` (`requireBoard` plus an approved link, own uid only).
- A key, PIN, webhook URL or secret is committed, logged or put in a response; a secret is compared without `timingSafeEqual`.
- A change adds upstream API calls that no decision in `docs/decisions/` allows, calls the site's refresh endpoint, or sends Origin, Referer or cookie headers to the site.
- A response carries a stack trace or a third party's error message.
- A `drizzle/meta` change that `pnpm db:generate` would not produce: a snapshot or journal edit without its migration `.sql`, or a migration `.sql` without its snapshot and journal entry. Hand-added data statements (backfills) inside a generated `.sql` are allowed.
- A change to `lib/compute.ts`, `lib/collector.ts`, `lib/budget.ts` or `lib/sources/*` ships without a test (`.claude/rules/collector.md`).

## Should fix

- A test asserts nothing that can fail, or a skipped or weakened test is merged.
- A page reads data outside `lib/queries` (public pages) or `lib/private` (workspace pages).
- A UI change breaks the 360 px layout, adds a hover-only control or a touch target under 44 px.
- A new user-facing string misses a language the page serves (public pages: `lib/i18n`; desk: EN, PT-BR, FR).
