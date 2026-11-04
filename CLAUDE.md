# LAP Tracker — rules for every session

Read docs/handoff/00-prereqs.md first, then the latest docs/handoff/*.md, then the part of IMPLEMENTATION_PLAN.md the session names.

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
- Never print, log, commit or paste an API key, PIN, webhook URL or secret. Read them from .env.local or the environment only.
- Never run anything that spends upstream API quota unless the session explicitly allows it. Never call the site's refresh endpoint or imitate the site (Origin/Referer/cookies): the maintainer closed it on purpose.
- Stack: Next.js App Router, TypeScript, Tailwind, Drizzle + Neon, Vitest. Node 26 (`.nvmrc` = `26`), pnpm 12 (`packageManager`). Test: `pnpm test`. Typecheck: `pnpm typecheck`. All gates: `pnpm check`.
- Architecture: docs/ARCHITECTURE.md (one dependency rule, one injection point). Words: docs/GLOSSARY.md — use its terms in code and prose. Decisions: docs/DECISIONS.md.
- New dependency: only if the platform can't do it; note the reason, release date and install scripts in docs/DECISIONS.md.
- Roster fields x, y, online, last_online_at, joined_at, daily_*, avatar_url stay in raw_json and are never returned by any query, route, page, log or message.
- lib/sources/internal.ts is unofficial and read-only (ranks board + live-roster fallback). Never widen its use beyond what docs/DECISIONS.md records.
- Secrets are compared with timingSafeEqual; PIN and cron routes are rate-limited; responses never carry stack traces.
- UI is mobile-first: designed at 360 px, cards below 640 px, nothing hover-only, touch targets ≥ 44 px, compact numbers; reads only through lib/queries; no charts in v1; player pages look like alliance pages.

## Handoff (every session, last step before the commit)
Write docs/handoff/NN-<name>.md with sections Built / Decisions / Deviations / Verified / Open issues / Next. Before writing `## Next`, re-read the NEXT session's prompt in SESSION_PLAYBOOK.md and fill `## Next` in the exact shape given there: model/effort as keep / raise one / lower one with a measurable reason; what the owner must do first; whether the plan itself needs a change (say which section — do not edit IMPLEMENTATION_PLAN.md or SESSION_PLAYBOOK.md); and an `<adjustments>` block with additions only: facts you established that change what the next session should build, real numbers to replace the plan's estimates, things to skip because they're already done. If you also notice a prompt further ahead that your findings affect, add a second `<adjustments for="Session M">` block.
