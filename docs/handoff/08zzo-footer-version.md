# 08zzo — The footer shows the live version

## Built
- `lib/build-line.ts`: `buildLine(env, builtAt)` returns the build line.
  - On a `main` deploy whose commit message has a `release: vX.Y.Z` line: `v2.0.0 · 88215d2 · 2026-11-09`.
  - On any other deploy: `<branch> · <short sha> · <date>`. This covers `dev` and a `main` commit that is not a release.
  - When `VERCEL_GIT_COMMIT_SHA` is unset: `local`.
- `next.config.ts`: `env: { BUILD_LINE: buildLine(process.env, new Date()) }`. Next replaces `process.env.BUILD_LINE` with the string at build time.
- `app/_ui/SiteFooter.tsx`: one line under the byline (`text-xs`, `text-ink/65`, right-aligned, tabular numerals). `AdminShell` already renders `SiteFooter`, so /admin shows the same line with no change there.
- `lib/build-line.test.ts`: three tests, one each for main (release), dev and local.
- docs/DECISIONS.md D58. docs/ARCHITECTURE.md: one line for `lib/build-line.ts`.

## Decisions
- D58. The version comes from `VERCEL_GIT_COMMIT_MESSAGE` on ref `main`. It uses the same `^release: vX.Y.Z` match as `release-publish.yml`. Tags were not used for two reasons: Vercel's clone is shallow, and `release-publish` creates the tag on the same push that starts the Vercel build, so the build would race the tag.
- I checked Vercel's system variables page (https://vercel.com/docs/environment-variables/system-environment-variables, updated 2026-07-15). `VERCEL_GIT_COMMIT_SHA`, `_REF` and `_MESSAGE` are available at "Both build and runtime". No variable carries a build timestamp, so the date is the clock when `next build` evaluates `next.config.ts`.
- The version is shown only when the ref is `main`. If `dev` is fast-forwarded to the release merge commit, a `dev` deploy still reads `dev`. The dev test uses a release message so that it fails without this check; I confirmed it fails when the check is removed.
- The date is ISO `YYYY-MM-DD` in UTC, so the line has no words, needs no translation and adds nothing to `lib/copy.ts`.
- The colour is `ink/65`, not the `ink/50` I tried first. DESIGN.md requires text contrast ≥ 4.5:1. Computed from the tokens: `ink/50` on paper is 3.14:1 in light; `ink/65` is 4.91:1 in light and 6.38:1 in dark. The byline is `ink/70`.

## Deviations
- The issue's example writes the date as `Nov 8`. A month name is a word in English and would need translating, so the line uses `2026-11-08`. If the owner wants `Nov 8`, it needs a locale-aware format at request time, or a word in copy for each language.
- The string also appears in the client chunks of the error boundary. `app/error.tsx` is a client component that renders `ErrorPage` → `SiteFooter`. It is a constant: no client code computes it, and it holds no secret.

## Verified
- `pnpm check` exits 0 (prettier, eslint, tsc, vitest, drift, i18n-check).
- `next build` ran with `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF=main` and `VERCEL_GIT_COMMIT_MESSAGE="release: v2.0.0 (#190)…"`. It exits 0, and `v2.0.0 · 88215d2 · <date>` is a string literal in `.next/server` chunks.
- Local `next dev` ran on a throwaway stack: Postgres 18 in the scratchpad, `drizzle/*.sql` applied with psql, `scripts/seed.ts`, the WebSocket→TCP relay and preload from 08zzm, `env -i` with placeholder values, no API key, upstream hosts at `127.0.0.1:9`, no webhooks, no Neon. No upstream call was made.
- The `VERCEL_GIT_*` values were set to a fake `main` release commit so the captures show the release form. `/` and `/admin` (locked, PIN card) return 200 with the line.
- Chrome was driven over CDP: exact viewport, emulated `prefers-color-scheme`, cookies cleared before each capture, dev overlay removed. `scrollWidth` equals the viewport in every capture.
- Screenshots (footer region):
  - `docs/screenshots/08zzo-footer-{360,1280}-{light,dark}.png`: the home page.
  - `docs/screenshots/08zzo-admin-footer-360-{light,dark}.png`: /admin.

## Open issues
- Pre-existing: `app/(pages)/admin/page.tsx` runs its seven admin queries (`latestRehearsal` … `recentTicks`) before `AdminShell` checks the session. Every locked /admin request reads the DB, though nothing is rendered. Found when /admin returned 500 on a stack with no DB. Not changed here.
- On `main`, the line shows a version only on a deploy of the release merge commit itself. A redeploy of that commit keeps the version. Any later commit pushed to `main` that is not a release shows `main · <sha>`.

## Next
Session: none planned after this change in docs/SESSION_PLAYBOOK.md; it goes into the next `dev → main` release.
Model / effort: keep — a small footer line.
Owner must do first: merge this PR into `dev`. After the next release merge, check that the production footer reads `vX.Y.Z · <sha> · <date>` and the `dev` deploy reads `dev · <sha> · <date>`.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/200
