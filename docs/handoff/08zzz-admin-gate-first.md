# 08zzz — Admin gate first (issue 218)

## Built
- The four admin pages (`app/(pages)/admin/page.tsx`, `runs/page.tsx`, `errors/page.tsx`, `runs/[id]/page.tsx`) now start with `if (!(await isAdmin())) return <AdminShell title={…} />;`. The check is awaited before the `Promise.all` that starts the database read and the server clock, so a locked request opens no connection and runs no query.
- `/admin/runs/[id]` checks the session before the id regex and before `getRun`, so locked it answers the PIN card for an existing, an unknown and a malformed id. Unlocked, the regex 404 and the missing-run 404 are unchanged.
- `app/_ui/admin/AdminShell.tsx`: `children` is optional (the locked call passes none); the header comment says the pages check first. The PIN card still comes from the shell's own `isAdmin()` branch.
- `app/(pages)/admin/gate.test.ts`: six tests. Locked render of `/admin`, `/admin/runs`, `/admin/errors`, `/admin/runs/1` returns `AdminShell` with no children and never calls `openDb`; locked `/admin/runs/999999` does not call `notFound`; unlocked `/admin/runs/999999` (PGlite, real `adminToken` cookie) calls `notFound` once.

## Decisions
- One way to decide: the pages call the existing `isAdmin()` (cookie + `secretEquals`). `AdminShell` still calls it too, so a locked request reads the cookie twice. No second check was added and `AdminShell` was not given an `unlocked` prop, to keep the shell as the one place that picks the PIN card.
- While locked, the shell gets only a constant title from `copy.admin` and no children: no admin data in any prop.
- The test mocks `next/headers` (cookies), `next/navigation` (`notFound` throws), `@/lib/env` (`getEnv` returns `TEST_ENV`) and `@/lib/app-context` (the 08zu route pattern).

## Deviations
- None.

## Verified
- `pnpm vitest run "app/(pages)/admin/gate.test.ts"`: `Test Files 1 passed (1)`, `Tests 6 passed (6)`.
- `pnpm check`: exit 0. `All matched files use Prettier code style!`; eslint and tsc clean; `Test Files 55 passed | 1 skipped (56)`, `Tests 252 passed | 1 skipped (253)`; drift `Everything's fine`; `i18n: 17 languages up to date with English`.
- Locked GET with no database: `next dev -p 3218` in this worktree (no `.env.local` here), placeholder env typed inline, `DATABASE_URL=postgres://nobody@127.0.0.1:1/none` (nothing listens). No cookie sent.

  | Path | Status | "Enter the admin PIN to see this page." | Admin nav ("Snapshot runs") |
  |---|---|---|---|
  | /admin | 200 | present | absent |
  | /admin/runs | 200 | present | absent |
  | /admin/errors | 200 | present | absent |
  | /admin/runs/1 | 200 | present | absent |
  | /admin/runs/999999 | 200 | present | absent |
  | /admin/runs/abc | 200 | present | absent |

  The dev log shows each GET as 200 and no ECONNREFUSED or error line. The server was stopped by port afterwards.

## Open issues
- `app/(pages)/admin/page.tsx` is now 289 lines; ESLint allows 300.
- Page requests are still not rate-limited (only the PIN route is). Locked they now cost one cookie read and no query, so this matters less; not changed here.

## Next
Session: none — no session is queued behind this one.
Model / effort: keep (opus · medium) — five source files changed by 20 lines, one test file, one check run green on the first try.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none.

<adjustments>
- Every `/admin` page checks `isAdmin()` before any database read; a new admin page must start with the same line (`if (!(await isAdmin())) return <AdminShell title={…} />;`), and `AdminShell` accepts no children for that case.
- `app/(pages)/admin/gate.test.ts` is the first page test: it mocks `next/headers`, `next/navigation`, `@/lib/env` and `@/lib/app-context`, then calls the page function directly. Later page tests can reuse that pattern.
</adjustments>
