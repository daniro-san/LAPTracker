# Architecture

One dependency rule and one injection point. Source: docs/IMPLEMENTATION_PLAN.md §11.1. This file names what each folder owns and where each feature lives; the code is the file inventory (`git ls-files lib app`).

## Map

```
app/(pages)/        public pages and /admin. Read through lib/queries only.
app/_ui/            shared UI for pages and the desk (charts, format, admin sections).
app/api/*           thin HTTP handlers: auth → parse → call lib → respond. No logic.
app/img/*           the images served to pages: avatar, badge, frame, hero, preview (D22).
app/(private)/      the workspace (D71): pages under w/[slug], handlers under api/w (one fixed callback, D73).
                    Outside api/w: api/discord/interactions (public, checked by Discord's signature, D96),
                    w/[slug]/manifest.webmanifest and share (D110), img/notice/[id] (D119).
                    Reaches data only through lib/private, after requireWorkspace.
lib/ (top level)    the domain and the plumbing: collector*, compute, budget, compact, words, schedule, run, tick,
                    rehearsal, notify*, discord-*, push*, squads*, shield-*, kvk*, copy*, app-context, report-error.
lib/sources/        adapters: v1.ts (documented API, primary), internal.ts (site API: ranks board, ours and the
                    KvK opponent's (D155), and live-roster fallback, unofficial, read-only). One output type.
lib/repo/           persistence: one module per table, plain functions over Drizzle. lib/schema*.ts hold the tables.
lib/queries/        read models for pages. Never name a blocked roster key (blocked-keys.ts).
lib/private/        the workspace's reads, rules and dictionaries. The only code outside lib/repo that may read the
                    blocked roster keys, for its own alliance's rows.
lib/screenshot/     the screenshot reader (D74): pure parsers over OCR text, one IO module. No DB access.
lib/ai/             the translator (D81). lib/analytics/ PostHog (D115). lib/brand/ tokens and components.
lib/i18n/           one translation file per public language (D48, D88).
config/ drizzle/ scripts/ e2e/   alliance config, migrations, scripts and hooks, Playwright specs.
```

Pure modules take the clock and every input as arguments: `lib/compute`, `lib/budget`, `lib/compact` (the one compact-number format, D78), `lib/schedule`. `lib/words` (the one `fill` and `plural`, issue 592) is pure except that `fill` reads `NODE_ENV` for its missing-placeholder rule.

## Dependency rule

- `app → lib/{route, auth, run, tick, rehearsal, schedule, queries, repo, images, analytics, ai, flags}`; `lib/private → lib/analytics/events` (the sign-in mark, D77); `lib/{app-errors, report-error, app-context} → lib/analytics/server` (route errors and `$ai_generation`, D115); `lib/report-error → lib/analytics/{sanitise, events}` (the exception's scrubbed message, D115 2026-11-21); `lib/{app-errors, run, run-notify, tick, push, app-context} → lib/report-error` (an error's redacted detail and a handled `$exception`; `lib/report-error` imports neither `lib/notify*` nor `lib/discord-*`, so `lib/private` reaches it through `lib/push` and `AppContext.report` within D71, D115 2026-11-21); `lib/analytics/sanitise → lib/redact` (the private-field redactor in the browser's scrubber); `lib/{redact, sources/shared} → lib/queries/blocked-keys` (the private keys and the photo host, which import nothing); `lib/private → lib/screenshot` (the name matcher, for the sheet import, D80; the OCR, the classifier and the parsers, for the screenshot import, D96); `lib/private → lib/ai` (the translator, for Discord's Translate commands, D101); `lib/private → lib/redact` (`redactPrivate` on a feedback text before it is stored, D157); `lib/run → lib/{collector, queries, flags}` (queries: the public Discord message's numbers; flags: its war-turnout line, D91).
- Upstream only through `lib/run`, `lib/tick` or `lib/rehearsal`. One more read, from /admin: the KvK opponent card's ranks board suggestion, `lib/opponent-suggest.ts` → `internal.ts` `fetchRanks` through `AppContext.internal`, once per (KvK, server) (D155). A page or handler also calls the `lib/` modules of its own feature (the Features table below); a new cross-module edge is added to the list above.
- `lib/collector → lib/{compute, sources, repo, logger, notify}` **through the `Deps` object passed in**.
- `lib/compute`, `lib/budget`, `lib/compact` and `lib/words` import nothing from the project.
- `lib/logger` imports only `lib/repo` and `lib/redact`.
- `lib/screenshot` imports nothing from the project.
- `lib/ai` imports nothing from the project: a request carries only the officer's text (D81).
- Nothing in `lib/` imports from `app/`.
- Only `app/(private)` imports `lib/private` (an allowlist zone: every other module is fenced out by default). Two exceptions: `lib/push-tick.ts` imports `lib/private/push-roll-calls.ts` and nothing else of it (D148), and `lib/posts-tick.ts` imports `lib/private/catalog-posts.ts` and nothing else of it (D159). `app/(private)` does not import `lib/repo`. `lib/private` imports neither `lib/notify*` nor `lib/discord-*` (D71); `lib/push` and `lib/report-error`, which it reaches, import neither (D115).

No DI container, no base classes, no event bus, no generic repository. `Deps` is the collector's injection boundary. Routes get theirs from `getAppContext()` in `lib/app-context.ts`, the one module route tests replace (`vi.mock`); a Next `route.ts` may export only handlers and segment config, so it cannot take arguments.

### How each rule is enforced

| Rule                                                                                       | Enforced by                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `lib/compute`, `lib/budget`, `lib/words`, `lib/screenshot`, `lib/ai` import nothing        | ESLint `import-x/no-restricted-paths` zones (eslint.config.mjs, D34, D81) |
| `lib/schedule` imports only the `Env` type                                                 | ESLint zone                                                               |
| Nothing in `lib/` or `config/` imports `app/`                                              | ESLint zone                                                               |
| `app` does not import `lib/sources`                                                        | ESLint zone                                                               |
| Pages, `app/_ui` and `app/(private)` do not import `lib/repo`                              | ESLint zone                                                               |
| Only `app/(private)` imports `lib/private`; two exceptions, D148's and D159's              | ESLint allowlist zones                                                    |
| `lib/private`, `lib/push`, `lib/report-error` import no `notify*`/`discord-*`              | ESLint zones (D71)                                                        |
| Blocked roster keys stay out of read models and outside the desk                           | `lib/queries/blocked-keys.test.ts`, `lib/private/roster-fields.test.ts`   |
| The upstream host only in `lib/env.ts`; `internal.ts` read-only                            | `lib/sources/no-upstream-literals.test.ts`                                |
| Quota routes check a secret or PIN first                                                   | `app/api/quota-gate.test.ts`                                              |
| Desk routes check the session first                                                        | `app/(private)/api/w/[slug]/member-session.test.ts`                       |
| A write to a table a public page reads invalidates `publicCache`                           | `lib/public-cache.test.ts` (D143)                                         |
| No colour literal; no page text outside the copy files                                     | ESLint `no-restricted-syntax`, `lib/copy.test.ts`                         |
| `lib/compact` imports nothing from the project                                             | **review only** (its zone is missing)                                     |
| `lib/logger` imports only `lib/repo` and `lib/redact`                                      | **review only**                                                           |
| `lib/collector` reaches sources, repo, logger and notify only through `Deps`               | **review only**                                                           |
| `app` and `lib` import only the edges the first bullet lists, and a handler holds no logic | **review only** (`.claude/rules/api-routes.md`)                           |
| `lib/redact` and `lib/queries/blocked-keys` import nothing from the project                | **review only**                                                           |

## Features

Paths are relative to the repo; `*` is a prefix. Pages are `app/(pages)/...` for public features and `app/(private)/w/[slug]/...` for the desk (handlers: `app/(private)/api/w/[slug]/...`). Desk reads are `lib/private/*`, public reads `lib/queries/*`.

| Feature                           | Route                                                                                                | Read or private module                                                                                                                             | Repo module                                                                           | Decisions                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| Public event pages                | `app/(pages)/events/[id]/page.tsx`, `events/compare`, `events/fight-clock`                           | `lib/queries/event-page.ts`, `events.ts`, `compare.ts`, `fight-clock.ts`, `movers.ts`, `turnout.ts`                                                | `lib/repo/events.ts`, `snapshots.ts`                                                  | D28, D49, D53, D57, D79, D143   |
| Ranks board, alliances, flow      | `app/(pages)/alliances/**`                                                                           | `lib/queries/alliances.ts`, `alliance-list.ts`, `ranks.ts`, `standing.ts`, `balance.ts`, `flow.ts`, `merge.ts`                                     | `lib/repo/alliances.ts`, `alliance-snapshots.ts`                                      | D89, D90, D133, D146            |
| Players and images                | `app/(pages)/players/**`, `app/img/*`                                                                | `lib/queries/players.ts`, `player-search.ts`, `player-progress.ts`, `photo.ts`                                                                     | `lib/repo/player-reads.ts`, `player-frames.ts`                                        | D22                             |
| KvK                               | `app/api/admin/kvk-opponent`                                                                         | `lib/queries/kvk.ts`, `lib/queries/admin-kvk.ts`, `lib/kvk.ts`, `lib/collector-opponent.ts`, `lib/opponent-suggest.ts` (`internal.ts` ranks board) | `lib/repo/kvk.ts`                                                                     | D152, D155                      |
| Collector, tick, cron             | `app/api/tick`, `snapshot`, `rehearsal`, `quota`                                                     | `lib/collector.ts`, `lib/run.ts`, `lib/tick.ts`, `lib/rehearsal.ts`, `lib/daily-read.ts`                                                           | `lib/repo/snapshots.ts`, `ticks.ts`, `run-logs.ts`, `rehearsals.ts`, `daily-reads.ts` | D01, D21, D25, D30, D45, D141   |
| Squads read                       | `app/api/squads-read`                                                                                | `lib/squads.ts`, `squads-read.ts`, `squads-tick.ts`, `lib/queries/squads-progress.ts`                                                              | `lib/repo/squads.ts`, `squad-queue.ts`                                                | D117, D132                      |
| Raid Shield check                 | tick; Raid prep page                                                                                 | `lib/shield-read.ts`, `shield-check.ts`, `shield-post.ts`, `shield-tick.ts`                                                                        | `lib/repo/shield-checks.ts`                                                           | D137, D147                      |
| Discord messages and commands     | `app/(private)/api/discord/interactions`                                                             | `lib/notify.ts`, `discord-send.ts`, `discord-format.ts`, `app-commands.ts`, `lib/private/discord-interaction.ts`                                   | `lib/repo/workspace-discord.ts`                                                       | D58, D96, D101, D129            |
| Admin                             | `app/(pages)/admin/**`, `app/api/admin/*`                                                            | `lib/queries/admin*.ts`, `lib/admin-session.ts`, `admin-invites.ts`                                                                                | `lib/repo/alliance-invites.ts`, `app-errors.ts`                                       | D37, D40, D61, D144             |
| Workspace sign-in and access      | `app/(private)/w/(onboarding)/**`, `app/(private)/api/w/login`, `invite`, `request`, `auth/callback` | `lib/private/access.ts`, `session.ts`, `sign-in.ts`, `invite.ts`, `access-request.ts`                                                              | `lib/repo/workspaces.ts`, `workspace-keys.ts`                                         | D71, D73, D99, D105, D130, D131 |
| Desk Home and members' board      | `w/[slug]/page.tsx`, `board/**`, `start-here`, `no-access`                                           | `lib/private/board.ts`, `me.ts`, `start-here.ts`, `alliance-week.ts`                                                                               | `lib/repo/me.ts`, `start-here.ts`                                                     | D105, D116, D142, D146          |
| Members                           | `w/[slug]/members/page.tsx`                                                                          | `lib/private/members*.ts`, `member-*.ts`, `fact-fields.ts`, `pending-members.ts`, `former-members.ts`                                              | `lib/repo/member-facts.ts`, `pending-members.ts`, `workspace-rosters.ts`              | D75, D80, D98, D106             |
| Roll call                         | `w/[slug]/roll-call/**`                                                                              | `lib/private/roll-call*.ts`                                                                                                                        | `lib/repo/roll-call.ts`, `roll-call-deletes.ts`                                       | D103, D120                      |
| Raid prep                         | roll call kind `shield`, `api/w/[slug]/raid-prep`                                                    | `lib/private/raid-prep.ts`, `lib/raid-prep-fill.ts`                                                                                                | `lib/repo/roll-call.ts`                                                               | D137                            |
| Follow-up                         | `w/[slug]/follow-up/page.tsx`                                                                        | `lib/private/follow-up*.ts`, `card-follow-up.ts`                                                                                                   | `lib/repo/member-follow-ups.ts`                                                       | D104, D140                      |
| Insights                          | `w/[slug]/insights/page.tsx`                                                                         | `lib/private/insights*.ts`                                                                                                                         | `lib/repo/workspace-rosters.ts`                                                       | D139, D153                      |
| Calendar, garrison, caravans      | `w/[slug]/calendar/**`, `api/w/[slug]/calendar`, `garrison`                                          | `lib/private/calendar*.ts`, `garrison*.ts`, `caravans.ts`                                                                                          | `lib/repo/calendar.ts`, `garrison.ts`                                                 | D102, D121                      |
| Notices                           | `w/[slug]/notices/**`, `img/notice/[id]`                                                             | `lib/private/notice*.ts`                                                                                                                           | `lib/repo/notices.ts`, `notice-*.ts`                                                  | D81, D102, D113, D118, D119     |
| Screenshot import, thefts, thanks | `w/[slug]/import`, `shots/[id]`, `thefts`                                                            | `lib/screenshot/*`, `lib/private/import*.ts`, `thefts*.ts`, `thanks.ts`                                                                            | `lib/repo/import.ts`, `thefts.ts`, `thanks.ts`                                        | D96, D97, D100, D110, D114      |
| Browser notifications             | `api/w/[slug]/push`                                                                                  | `lib/push.ts`, `lib/push-tick.ts`, `lib/private/push-*.ts`                                                                                         | `lib/repo/push.ts`                                                                    | D148                            |
| Feature switches                  | `api/w/[slug]/features`, `app/api/admin/workspaces/features`                                         | `lib/flags.ts`, `lib/workspace-features.ts`, `lib/private/features.ts`                                                                             | `lib/repo/workspace-features.ts`                                                      | D91, D134                       |
| Catalog posts                     | `api/w/[slug]/posts`, the tick (`app/api/tick`); owner switches `post_*`, never on the Features card | `lib/post-catalog.ts`, `lib/posts-tick.ts`, `lib/private/post-settings.ts`, `lib/private/catalog-posts.ts`                                         | `lib/repo/workspace-posts.ts`                                                         | D134, D156, D159                |
| Errors and analytics              | `app/error.tsx`, `app/ingest/[...path]`                                                              | `lib/report-error.ts`, `lib/app-errors.ts`, `lib/analytics/*`                                                                                      | `lib/repo/app-errors.ts`                                                              | D115                            |
| Feedback                          | `api/w/[slug]/feedback`, `app/(pages)/admin/feedback`, `app/api/admin/feedback`                      | `lib/private/feedback.ts`, `lib/queries/admin-feedback.ts`                                                                                         | `lib/repo/feedback.ts`                                                                | D157                            |

## Deps

The collector's injection boundary (lib/collector.ts); names follow docs/GLOSSARY.md. The source of truth for the types is `lib/sources/types.ts` (the adapters' one output type, `AllianceSnapshotInput`, and their errors) and `lib/repo/index.ts` (`Repo`: `createRepo(db)` over Drizzle) and `lib/repo/memory.ts` (`createMemoryRepo()`, for tests and `snapshot:dry`).

```ts
interface Deps {
  v1: V1Source; // fetchAlliance, fetchQuota
  internal: InternalSource; // fetchRanks, fetchAlliance (live rosters only)
  repo: Repo;
  logger: Logger; // info, warn, error: a code and numbers
  now: () => Date;
}
```

`notify` is not in `Deps`: `runSnapshot` returns a `RunSummary` and `lib/run.ts` sends it, through `lib/notify.ts`, after the snapshot row is final.
