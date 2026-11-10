# 08zzo — The footer shows the live version

## Built
- `lib/build-line.ts`: `buildInfo(env, builtAt)` returns `{ BUILD_LABEL, BUILD_AT }`.
  - On a `main` deploy whose commit message has a `release: vX.Y.Z` line: `v2.0.0 · 88215d2`.
  - On any other deploy: `<branch> · <short sha>` (`dev · 88215d2`).
  - When `VERCEL_GIT_COMMIT_SHA` is unset: `local`, with an empty `BUILD_AT`.
  - `BUILD_AT` is otherwise the build time in ISO.
- `next.config.ts`: `env: buildInfo(process.env, new Date())`. Next replaces `process.env.BUILD_LABEL` and `process.env.BUILD_AT` with strings at build time.
- `app/_ui/SiteFooter.tsx`: one line under the byline (`text-xs`, `text-ink/65`, right-aligned, tabular numerals). It shows the label, then the build time through `clock.at`, the form of the "as of" lines, e.g. `v2.0.0 · 88215d2 · Nov 9, 18:01 server time`.
  - `SiteFooter` now requires `clock: Clock | null`.
  - Callers pass the clock they already had: the event, alliance, compare, players and player pages, and `EventView`.
  - `EmptyEvents` and `app/not-found.tsx` (through `ErrorPage`) take `requestClock()`. `AdminShell` takes `requestServerClock()`. Both are cached per request.
  - `app/error.tsx` and `app/global-error.tsx` pass `null`.
- Tests:
  - `lib/build-line.test.ts`: main (release), dev, local.
  - `app/_ui/SiteFooter.test.ts`: the time comes from the page's clock; with no clock it is left out.
- docs/DECISIONS.md D58. docs/ARCHITECTURE.md: one line for `lib/build-line.ts`.

## Decisions
- D58. The version comes from `VERCEL_GIT_COMMIT_MESSAGE` on ref `main`. It uses the same `^release: vX.Y.Z` match as `release-publish.yml`. Tags were not used for two reasons: Vercel's clone is shallow, and `release-publish` creates the tag on the same push that starts the Vercel build, so the build would race the tag.
- I checked Vercel's system variables page (https://vercel.com/docs/environment-variables/system-environment-variables, updated 2026-07-15). `VERCEL_GIT_COMMIT_SHA`, `_REF` and `_MESSAGE` are available at "Both build and runtime". No variable carries a build timestamp, so the time is the clock when `next build` evaluates `next.config.ts`.
- Owner, 2026-11-09, on the first version of this PR:
  - (1) a full date, formatted like the system's other dates. The footer uses `clock.at`: the viewer's language, zone and date order on public pages (D38), server time on /admin. Month names and "server time" come from `Intl` and the existing copy keys, so nothing new goes in `lib/copy.ts`.
  - (2) nothing goes straight to `main`: PR → `dev`, then the normal release cutoff. A `main` deploy is therefore always a release; no code depends on this.
  - (3) keep the contrast rule: `ink/65` stays.
- The version is shown only when the ref is `main`. If `dev` is fast-forwarded to the release merge commit, a `dev` deploy still reads `dev`. The dev test uses a release message so that it fails without this check; I confirmed it fails when the check is removed.
- `clock` is required on `SiteFooter` and `ErrorPage`, not optional, so `tsc` finds every caller.
- The colour is `ink/65`. DESIGN.md requires text contrast ≥ 4.5:1. Computed from the tokens: `ink/50` on paper is 3.14:1 in light; `ink/65` is 4.91:1 in light and 6.38:1 in dark. The byline is `ink/70`.

## Deviations
- The time has no year. `clock.at` is the system's form for "as of" times and has none. The only form with a year is `clock.stamp`, the admin area's, and it ignores the viewer's date order.
- Six page files outside the footer and admin shell changed by one attribute each (`clock={clock}`), because the date needs each page's clock: `events/[id]/alliances/[unionId]/page.tsx`, `events/compare/page.tsx`, `players/page.tsx`, `players/[uid]/page.tsx`, `EventView.tsx`, `not-found.tsx`. `error.tsx`, `global-error.tsx`, `EmptyEvents.tsx` and `ErrorPage.tsx` changed for the same reason.
- The client error boundaries show the label without the time: they have no request clock.

## Verified
- `pnpm check` exits 0 (prettier, eslint, tsc, vitest, drift, i18n-check).
- `next build` ran with `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF=main` and `VERCEL_GIT_COMMIT_MESSAGE="release: v2.0.0 (#190)…"`. It exits 0, and the server chunk holds `"v2.0.0 · 88215d2"` and the ISO build time as literals, next to `e.at(new Date(g))`.
- Local `next dev` ran on a throwaway stack: Postgres 18 in the scratchpad, `drizzle/*.sql` applied with psql, `scripts/seed.ts`, the WebSocket→TCP relay and preload from 08zzm, `env -i` with placeholder values, no API key, upstream hosts at `127.0.0.1:9`, no webhooks, no Neon. No upstream call was made.
- The `VERCEL_GIT_*` values were set to a fake `main` release commit. `/`, `/admin` (locked, PIN card) and a 404 all render `v2.0.0 · 88215d2 · Nov 10, 00:08 server time`. With `Accept-Language: pt-BR` and the `date=dd/mm` cookie, the line reads `v2.0.0 · 88215d2 · 10/11, 00:08 hora do servidor`.
- Chrome was driven over CDP: exact viewport, emulated `prefers-color-scheme`, cookies cleared before each capture, dev overlay removed. `scrollWidth` equals the viewport in every capture.
- Screenshots (footer region):
  - `docs/screenshots/08zzo-footer-{360,1280}-{light,dark}.png`: the home page.
  - `docs/screenshots/08zzo-admin-footer-360-{light,dark}.png`: /admin.
  - `docs/screenshots/08zzo-footer-360-light-pt-br.png`: the home page in Portuguese with the dd/mm date order.

## Open issues
- Pre-existing: `app/(pages)/admin/page.tsx` runs its seven admin queries (`latestRehearsal` … `recentTicks`) before `AdminShell` checks the session. Every locked /admin request reads the DB, though nothing is rendered. Found when /admin returned 500 on a stack with no DB. Not changed here.

## Next
Session: none planned after this change in docs/SESSION_PLAYBOOK.md; it goes into the next `dev → main` release.
Model / effort: keep — a small footer line.
Owner must do first: merge this PR into `dev`. After the next release merge, check that the production footer reads `vX.Y.Z · <sha> · <date, time>` and the `dev` deploy reads `dev · <sha> · <date, time>`.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/200
