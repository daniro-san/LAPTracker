# 08zzo — The footer shows the live version

## Built
- `lib/build-version.ts`: `buildVersion(env)` returns:
  - `v2.0.0` on a `main` deploy whose commit message has a `release: vX.Y.Z` line;
  - the branch name on any other Vercel deploy (`dev`);
  - `local` when `VERCEL_GIT_COMMIT_REF` is unset.
- `next.config.ts`: `env: { BUILD_VERSION: buildVersion(process.env) }`. Next replaces `process.env.BUILD_VERSION` with the string at build time.
- `app/_ui/SiteFooter.tsx`: one line under the byline (`text-xs`, `text-ink/65`, right-aligned, tabular numerals). `SiteFooter` is rendered by every public page, the error and 404 pages and `AdminShell`, so no caller changed.
- `lib/build-version.test.ts`: three tests, one each for main (release), dev and local.
- docs/DECISIONS.md D58. docs/ARCHITECTURE.md: one line for `lib/build-version.ts`.

## Decisions
- D58. The version comes from `VERCEL_GIT_COMMIT_MESSAGE` on ref `main`. It uses the same `^release: vX.Y.Z` match as `release-publish.yml`. Tags were not used for two reasons: Vercel's clone is shallow, and `release-publish` creates the tag on the same push that starts the Vercel build, so the build would race the tag.
- I checked Vercel's system variables page (https://vercel.com/docs/environment-variables/system-environment-variables, updated 2026-07-15). `VERCEL_GIT_COMMIT_REF` and `_MESSAGE` are available at "Both build and runtime".
- Owner, 2026-11-09, after the first two versions of this PR:
  - The version number alone is enough. The commit and the date are gone.
  - Nothing goes straight to `main`: PR → `dev`, then the normal release cutoff. A `main` deploy is therefore always a release; no code depends on this.
  - Keep the contrast rule: `ink/65`.
- On `dev` the line reads `dev`, and locally `local`: neither has a version number. This is my reading of "only the version"; showing nothing there is the other option.
- The version is shown only when the ref is `main`. If `dev` is fast-forwarded to the release merge commit, a `dev` deploy still reads `dev`. The dev test uses a release message so that it fails without this check; I confirmed it fails when the check is removed.
- The colour is `ink/65`. DESIGN.md requires text contrast ≥ 4.5:1. Computed from the tokens: `ink/50` on paper is 3.14:1 in light; `ink/65` is 4.91:1 in light and 6.38:1 in dark. The byline is `ink/70`.

## Deviations
- The issue asked for `v2.0.0 · 88215d2 · Nov 8` and `dev · <sha> · <date>`. The owner reduced it to the version alone. The issue's "a test covers the line for main / dev / local" still holds.

## Verified
- `pnpm check` exits 0 (prettier, eslint, tsc, vitest, drift, i18n-check).
- `next build` ran with `VERCEL_GIT_COMMIT_REF=main` and `VERCEL_GIT_COMMIT_MESSAGE="release: v2.0.0 (#190)…"`, and exits 0. `"v2.0.0"` is a string literal in the `.next/server` chunks of the footer and of `ErrorPage`.
- Local `next dev` ran on a throwaway stack: Postgres 18 in the scratchpad, `drizzle/*.sql` applied with psql, `scripts/seed.ts`, the WebSocket→TCP relay and preload from 08zzm, `env -i` with placeholder values, no API key, upstream hosts at `127.0.0.1:9`, no webhooks, no Neon. No upstream call was made.
- The `VERCEL_GIT_*` values were set to a fake `main` release commit. `/`, `/admin` (locked, PIN card) and a 404 all render `v2.0.0`.
- Chrome was driven over CDP: exact viewport, emulated `prefers-color-scheme`, cookies cleared before each capture, dev overlay removed. `scrollWidth` equals the viewport in every capture.
- Screenshots (footer region):
  - `docs/screenshots/08zzo-footer-{360,1280}-{light,dark}.png`: the home page.
  - `docs/screenshots/08zzo-admin-footer-360-{light,dark}.png`: /admin.

## Open issues
- Pre-existing: `app/(pages)/admin/page.tsx` runs its seven admin queries (`latestRehearsal` … `recentTicks`) before `AdminShell` checks the session. Every locked /admin request reads the DB, though nothing is rendered. Found when /admin returned 500 on a stack with no DB. Not changed here.

## Next
Session: none planned after this change in docs/SESSION_PLAYBOOK.md; it goes into the next `dev → main` release.
Model / effort: keep — a small footer line.
Owner must do first: merge this PR into `dev`. After the next release merge, check that the production footer reads `vX.Y.Z` and the `dev` deploy reads `dev`.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/200
