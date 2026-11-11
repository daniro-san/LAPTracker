# 08zzz — Admin gate first (issue 218)

## Built
- The four admin pages (`app/(pages)/admin/page.tsx`, `runs/page.tsx`, `errors/page.tsx`, `runs/[id]/page.tsx`) now start with `if (!(await isAdmin())) return <AdminShell title={…} />;`. The check is awaited before the `Promise.all` that starts the database read and the server clock, so while locked the page and the shell open no connection and run no query. The request as a whole still opens one: the root layout's `UpstreamBanner` reads the database on every page (see Deviations and Open issues).
- `/admin/runs/[id]` checks the session before the id regex and before `getRun`, so locked it answers the PIN card for an existing, an unknown and a malformed id. Unlocked, the regex 404 and the missing-run 404 are unchanged.
- `app/_ui/admin/AdminShell.tsx`: `children` is optional (the locked call passes none); the header comment says the pages check first. The PIN card still comes from the shell's own `isAdmin()` branch.
- `app/(pages)/admin/gate.test.ts`: six tests. Locked render of `/admin`, `/admin/runs`, `/admin/errors`, `/admin/runs/1` returns `AdminShell` with no children, the test then calls `AdminShell` with those props, and neither calls `openDb`; locked `/admin/runs/999999` does not call `notFound`; unlocked `/admin/runs/999999` (PGlite, real `adminToken` cookie) calls `notFound` once.

## Decisions
- One way to decide: the pages call the existing `isAdmin()` (cookie + `secretEquals`). `AdminShell` still calls it too, so a locked request reads the cookie twice. No second check was added and `AdminShell` was not given an `unlocked` prop, to keep the shell as the one place that picks the PIN card.
- While locked, the shell gets only a constant title from `copy.admin` and no children: no admin data in any prop.
- The test mocks `next/headers` (cookies), `next/navigation` (`notFound` throws), `@/lib/env` (`getEnv` returns `TEST_ENV`) and `@/lib/app-context` (the 08zu route pattern).

## Deviations
- Issue 218's done-when says a locked request to the four pages "opens no database connection". That holds for the page function and `AdminShell`, which is what the session prompt asked for ("the page renders the shell with the PIN card and runs no query"). It does not hold for the whole request: `app/layout.tsx` renders `UpstreamBanner` on every page (D27), and `app/_ui/UpstreamBanner.tsx` calls `withPageDb((db) => getUpstreamStatus(db, new Date()))`. The banner was not changed here: it is not in the prompt and D27 puts it above every page.

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

  The dev log shows each GET as 200 and no ECONNREFUSED or error line. That log cannot show a database read: `UpstreamBanner` ends in `.catch(() => null)`, so its failed read leaves no line. The server was stopped by port afterwards.
- Which code opens a connection while locked (review, 2026-11-11): a `git archive` copy of this branch in the scratchpad, one temporary log line with the caller's stack at the top of `withPageDb` in the copy's `lib/page.ts`, `next dev -p 3218`, the same placeholder env, no cookie. The same six GETs each answered 200 with the PIN card and no admin nav, and each logged exactly one `withPageDb` call, from `UpstreamBanner`. None came from a page function or from `AdminShell`. The server was stopped by port afterwards.
- The locked tests fail when the shell reads (review, 2026-11-11): in the same copy, with `await withPageDb((db) => listRuns(db, 1));` added before `isAdmin()` in `AdminShell`, the four locked tests fail with `database opened` (`Tests 4 failed | 2 passed (6)`); without that line, `Tests 6 passed (6)`.

## Open issues
- `app/(pages)/admin/page.tsx` is now 289 lines; ESLint allows 300.
- Page requests are still not rate-limited (only the PIN route is). A locked admin page request now costs the cookie read plus the banner's one connection and its `getUpstreamStatus` read (one to three queries), down from that plus the page's own reads (up to eight queries on `/admin`); not changed here.
- The root layout's `UpstreamBanner` (`app/_ui/UpstreamBanner.tsx:11`, rendered by `app/layout.tsx:32`) opens one connection and runs `getUpstreamStatus` on every page request, locked admin pages included. Issue 218's "opens no database connection" therefore holds for the page, not for the request, and this PR closes that issue. Owner's call: accept it under D27, or open a follow-up to skip the banner's read on a locked `/admin` request (the root layout cannot see the route, so that means moving or gating the banner, with an amendment line under D27).

## Next
Session: none — no session is queued behind this one.
Model / effort: keep (opus · medium) — five source files changed by 20 lines, one test file, one check run green on the first try.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none.

<adjustments>
- Every `/admin` page checks `isAdmin()` before any database read; a new admin page must start with the same line (`if (!(await isAdmin())) return <AdminShell title={…} />;`), and `AdminShell` accepts no children for that case.
- `app/(pages)/admin/gate.test.ts` is the first page test: it mocks `next/headers`, `next/navigation`, `@/lib/env` and `@/lib/app-context`, then calls the page function directly. Later page tests can reuse that pattern.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/220
