# Architecture

One dependency rule and one injection point. Source: docs/IMPLEMENTATION_PLAN.md §11.1.

```
app/api/*           thin HTTP handlers: auth → parse → call lib → respond. No logic.
app/(pages)/*       UI. Reads through lib/queries only.
app/(private)/*     the workspace (D71): pages under w/[slug], handlers under api/w (one fixed callback, D73).
                    One handler sits outside api/w: api/discord/interactions (public, checked by Discord's
                    signature instead of a session, then the officer rule; D96).
                    Reaches data only through lib/private, after requireWorkspace.
lib/collector.ts    domain: runSnapshot, freshness check, per-alliance fallback, resume logic.
lib/compute.ts      pure functions only — sums, deltas, freshness predicate, roster diff; no IO, no Date.now() (passed in).
lib/compact.ts      pure: the one compact-number format, K/M/B/T in every language (D78); app/_ui/format.ts and lib/discord-format.ts call it.
lib/budget.ts       pure quota arithmetic (requiredQuota, sampleQuota) and `MAX_RETRIES`, the one retry count that lib/sources/v1.ts imports.
lib/upstream-errors.ts, lib/raw-json.ts  the collector's error wording and raw_json trimming (split for size).
lib/collector-claim.ts  the collector's claim on a snapshot row and which rows a re-run drops (D62, D63; split for size).
lib/collector-sample.ts  a sample's call timeout, run deadline and no-retry rule (`callOptions`, D69; split for size).
lib/collector-log.ts  the collector's one run_logs line per /v1 call (split for size).
lib/sources/*.ts    adapters: v1.ts (documented API, primary), internal.ts (site API: ranks board + live-roster fallback,
                    unofficial, read-only). One output type.
lib/repo/*.ts       persistence: one module per table, plain functions over Drizzle.
lib/private/*.ts    the workspace (D71): requireWorkspace and its branded WorkspaceAccess, sessions, the Discord
                    sign-in, its own log (a code and numbers) and its en/pt-BR/fr dictionary. The only code
                    outside lib/repo that may read the blocked roster keys, for its own alliance's rows.
                    members.ts (the Members tab's read), member-week.ts (its pure week arithmetic and
                    D75's signals), members-list.ts (filters and search), members-sheet.ts (status,
                    reasons and "copy for spreadsheet"), first-use.ts (the first-use cards as data),
                    cookies.ts (the two cookie names, apart from the dictionaries, for client components);
                    their table reads are in lib/repo/workspace-rosters.ts, and the newest roster of any kind
                    (before the first end-of-day read) and the names members used in workspace-any-roster.ts.
                    Member facts (D80): fact-fields.ts (the fields, sources and merges; pure, also on the
                    client), member-facts.ts (versions, 409 and merging), onboarding-parse.ts ("Paste what
                    they told you"; pure, for pastes and OCR lines), time-zones.ts and zone-table.ts (the
                    picker's search; pure), sheet-parse.ts (pure) and sheet-import.ts (the one-time import);
                    their tables are in lib/repo/member-facts.ts and lib/schema-facts.ts.
                    notices.ts (the notices library's reads
                    and its save, issue 304), notice-rules.ts (pure: fields, the counter, "may be out of date",
                    the save's version check); its table reads and writes are in lib/repo/notices.ts.
                    The Calendar tab (issue 300): calendar.ts (reads and the field-level writes with their
                    version check), calendar-model.ts (pure: kinds, input schemas, which change fits which kind,
                    the weekly layout), calendar-kinds.ts (its fixed facts, no zod, for client components),
                    calendar-time.ts (pure, browser-safe: server days, ST and the viewer's clock, on
                    lib/schedule's `serverInstant`), calendar-words.ts (titles, dates, the 409 sentence),
                    caravan-suggest.ts (pure: the caravan suggestions' ranking) and caravans.ts (their read),
                    dictionary.calendar*.ts (its words); its tables are in lib/schema-calendar.ts, its reads and
                    writes in lib/repo/calendar.ts.
                    The thefts log (D97): thefts.ts (its read and writes, the attacker search), theft-groups.ts
                    (pure: attacker key, groups and counts, follow-up state), thefts-import.ts (the screenshot
                    import's save hook for Secret Ops reports), dictionary.thefts.ts (its words); tables in
                    lib/schema-thefts.ts, reads and writes in lib/repo/thefts.ts.
                    The screenshot import (D96): import.ts (drafts, save, discard, change of type),
                    import-kinds.ts (the kinds and the SaveHook other sessions plug in), import-save.ts
                    (the hooks: Alliance Duel points, the ranking checks), import-photo-hooks.ts (member
                    updates into member facts, Secret Ops reports into thefts), import-view.ts (To review, a
                    draft's review), import-read.ts (the only way to the OCR), import-words.ts,
                    import-input.ts (request bodies), discord-interaction.ts (signature, PING, the officer
                    rule, the deferred reply) and import-discord.ts (fetch, read, edit the reply, after the
                    response); their tables are lib/schema-import.ts, read in lib/repo/import.ts.
lib/ai/*.ts         Groq (D81): the chat client with its model fallback (groq.ts), the notice prompts and plain-text
                    cleanup (notice-writing.ts), the game glossary (glossary.ts). Reached through AppContext.ai.
lib/queries/*.ts    read models for the UI (joins, sorting, name history). Never write. Never expose BLOCKED_ROSTER_KEYS.
                    lib/queries/server-players.ts: `serverPlayers`, the tracked alliances' newest roster names (D97).
                    lib/queries/samples.ts: `eventSamples`, an event's Start, samples and End (D69).
                    lib/queries/live.ts: `eventProgress`, the event page's live section (alliance totals per reading, D69):
                    `progressRows` (the database, cacheable) and `eventProgressOf` (pure, per request, takes `now`).
lib/live.ts         pure: the live section's arithmetic: standings, kills per reading interval, the busiest two intervals,
                    when the page looks again (D69).
lib/event-cache.ts  the event page's shared cache (D79): one event's database rows for every viewer, tagged by event id
                    (Next's unstable_cache and revalidateTag); reached only through AppContext.eventCache.
lib/logger.ts, lib/notify.ts, lib/env.ts, lib/redact.ts
lib/discord-send.ts, lib/discord-format.ts, lib/event-image.tsx
                    the webhook transport (JSON, or multipart with a picture), the messages' number and
                    time formats, and the event picture drawn with next/og (D58).
lib/schedule.ts     pure: SERVER_TZ ↔ UTC, scheduled events and their times, Friday-check and rehearsal slots.
lib/tick.ts         the tick's decision: create the scheduled event's row, run the one due phase (from events.before_at/
                    after_at), a due sample (D69), the Friday check, a REHEARSAL_AT slot, the daily roster read.
lib/daily-read.ts   the daily roster read (D60, D72): quota check, /v1 rosters as arrays (and raw_json) into daily_rosters; not an event.
lib/rehearsal.ts    rehearsal creation (guards, retention) and the pure verdict.
lib/auth.ts         Bearer CRON_SECRET / x-edit-pin in constant time; the Postgres-backed rate limiter.
lib/run.ts          what a route runs: executeSnapshot and the tick's executeSample (D69) (finalise + logger
                    shutdown in finally, then notify) and quotaReport (the Friday check).
lib/route.ts, lib/app-context.ts, lib/app-errors.ts
                    the route shell (one DB per request, closed on every path; errors become a code),
                    the outside world in one object (env, clock, adapters, fetch, openDb, eventCache), app_errors.
config/alliances.ts the 20 tracked alliances, by union_id
app/img/*           /img/badge/[id] and /img/avatar/[uid]: upstream images served from our origin (D22), via lib/images.ts.
app/ingest/*        PostHog's same-origin proxy (D77), via lib/analytics/ingest.ts.
lib/analytics/*.ts  PostHog (D77): the typed custom events (events.ts), the browser SDK and replay switch (posthog.ts),
                    before_send (sanitise.ts, pure), the /ingest forwarding (ingest.ts) and the region (region.ts).
lib/images.ts       the two image sources (preset badge id, stored photo URL on its one host), capped fetch, cache headers.
proxy.ts            per-request CSP nonce (Next 16's middleware); next.config.ts holds the static security headers
instrumentation.ts  validates the environment once at server start
lib/build-version.ts pure: the footer's live version from Vercel's git variables (D59); next.config.ts calls it once per build.
lib/screenshot/     the screenshot reader (D74): pure parsers over OCR text lines (alliance duel, the might/kills/donation rankings, secret
                    operations, pasted text), classify.ts (which screen, scored, D96), merge.ts (pages of one ranking), nameKey and
                    matchName (candidates passed in), and one IO module, read-screenshot.ts (Tesseract.js, committed English data). No DB access.
lib/import-command.ts the Discord message command's definition, shared by the interactions route and scripts/discord-register-command.ts (D96).
```

## Dependency rule

- `app → lib/{route, auth, run, tick, rehearsal, schedule, queries, repo, images, analytics, ai}`; `lib/private → lib/analytics/events` (the sign-in mark, D77); `lib/private → lib/screenshot` (the name matcher, for the sheet import, D80; the OCR, the classifier and the parsers, for the screenshot import, D96); `lib/run → lib/{collector, queries}` (queries: the public Discord message's numbers).
- `lib/collector → lib/{compute, sources, repo, logger, notify}` **through the `Deps` object passed in**.
- `lib/compute`, `lib/budget` and `lib/compact` import nothing from the project.
- `lib/logger` imports only `lib/repo` and `lib/redact`.
- `lib/screenshot` imports nothing from the project.
- `lib/ai` imports nothing from the project: a request carries only the officer's text (D81).
- Nothing in `lib/` imports from `app/`.
- Only `app/(private)` imports `lib/private` (an allowlist zone: every other module is fenced out by default). `app/(private)` does not import `lib/repo`. `lib/private` imports neither `lib/notify*` nor `lib/discord-*` (D71).

No DI container, no base classes, no event bus, no generic repository. `Deps` is the collector's injection boundary. Routes get theirs from `getAppContext()` in `lib/app-context.ts`, the one module route tests replace (`vi.mock`); a Next `route.ts` may export only handlers and segment config, so it cannot take arguments.

## Deps

The shape Session 2–4 implement. Names follow docs/GLOSSARY.md; the source types were settled in Session 2 (lib/sources/types.ts); Repo is Session 3.

```ts
// lib/sources/types.ts (Session 2) — the source of truth; this is a copy for orientation.
type UnionId = number;
type Uid = number;
type Phase = "before" | "after";

interface MemberInput {
  uid: Uid;
  name: string;
  power: number | null; // null kept, summed as 0 (D15)
  kills: number | null;
  lv: number | null;
}

/** The one output type of both adapters (plan Phase 2). */
interface AllianceSnapshotInput {
  unionId: UnionId;
  tag: string;
  name: string;
  memberCount: number;
  totalPower: number;
  totalKills: number; // sumKills(members)
  members: MemberInput[];
  serverRank: number | null;
  level: number | null;
  sourceUpdatedAt: Date | null;
  cached: boolean | null; // null for internal
  quota: Quota | null; // from that /v1 response; null for internal
  raw: unknown;
}

interface Quota {
  remaining: number;
  limit: number;
  used: number;
}

interface RanksBoard {
  pulledAt: Date; // older of the two boards
  power: Map<UnionId, number>;
  kills: Map<UnionId, number>;
}

/** Called before every /v1 attempt, retries included; the collector counts calls here (Session 3). */
type OnAttempt = (attempt: number, status?: number | null) => void; // status: what caused this retry

interface V1Source {
  fetchAlliance(id: UnionId, onAttempt?: OnAttempt): Promise<AllianceSnapshotInput>;
  fetchQuota(onAttempt?: OnAttempt): Promise<Quota>;
}

interface InternalSource {
  fetchRanks(server: number): Promise<RanksBoard>;
  /** live: true rosters only; throws NotLiveError on the stub shape. */
  fetchAlliance(id: UnionId): Promise<AllianceSnapshotInput>;
}

// Errors (instanceof): QuotaExhaustedError (429), NotFoundError (404), NotLiveError (stub),
// SchemaError { code: "v1.schema" | "internal.schema", paths }, UpstreamError { status }.

// lib/repo/index.ts (Session 3); createRepo(db) over Drizzle, createMemoryRepo() for tests and snapshot:dry.
interface Repo {
  getEvent(eventId: number): Promise<EventRow | null>;
  setEventAllianceIds(eventId: number, ids: number[]): Promise<void>;
  findSnapshot(eventId: number, phase: Phase): Promise<SnapshotRow | null>;
  startSnapshot(
    eventId: number,
    phase: Phase,
    startedAt: Date,
    expected: SnapshotRow | null,
  ): Promise<number | null>; // compare-and-set claim
  clearAllianceRows(snapshotId: number): Promise<void>; // force only
  listAllianceRows(snapshotId: number): Promise<AllianceRowStatus[]>;
  insertAllianceRow(snapshotId: number, row: AllianceRow, members: MemberRow[]): Promise<void>; // one transaction
  finishSnapshot(snapshotId: number, result: SnapshotResult): Promise<void>; // calls_used accumulates
}

interface Logger {
  info(code: string, data?: Record<string, unknown>): Promise<void>;
  warn(code: string, data?: Record<string, unknown>): Promise<void>;
  error(code: string, data?: Record<string, unknown>): Promise<void>;
}

// Session 4: notify is not in Deps. runSnapshot returns a RunSummary; lib/run.ts sends it after
// the row is final, through lib/notify.ts.
interface Notifier {
  public(content: string): Promise<void>; // alliance channel, plain language
  admin(content: string): Promise<void>; // officers channel, technical, optional mention
}

interface Deps {
  v1: V1Source;
  internal: InternalSource;
  repo: Repo;
  logger: Logger;
  now: () => Date;
}
```
