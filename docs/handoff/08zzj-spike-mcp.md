# 08zzj — Spike: an MCP server for other people's agents and bots (issue #178)

Owner's question (2026-11-06): could we have an MCP server that people connect to their own agents or bots, to read LAPTracker's data?

Short answer: yes, and it costs zero upstream quota. The real limit is Neon's free compute, not MCP. MCP calls are POSTs, and Vercel's CDN does not cache POSTs. So every uncached call is a function run plus a Neon query, and steady third-party traffic would keep Neon awake until its monthly allowance runs out, which takes the whole site down, Saturday's collector included. The recommendation below puts a CDN-cached public GET API underneath and a thin `/mcp` on top.

## Built

Nothing in the repo except this file. The prototype lives in the scratchpad and is not committed:

- `server.ts`: a Node `http` server on `127.0.0.1:3917/mcp` that mounts `createMcpHandler` from `mcp-handler` 2.3.0 (on `@modelcontextprotocol/server` 2.4.0, installed in the scratchpad with `--ignore-scripts`). Three read-only tools over `lib/queries`: `list_events` → `listEvents`, `get_alliance` → `getAllianceDetail`, `search_players` → `searchPlayers`. Database: an in-process PGlite, migrated from `drizzle/` and filled by `scripts/seed.ts` ("seeded 20 alliances × 3 events, 1 rehearsal"). It ran under `env -i`, with no `DATABASE_URL`, no key and no webhooks, so it could not reach Neon or the upstream.
- Tool outputs map `badgeId` to `https://laptracker-inky.vercel.app/img/badge/<id>` and `hasAvatar` to `…/img/avatar/<uid>` (D22), turn the role `Map`s into a `role` field per member, and drop `isTest`.
- An `Origin` check: no header is allowed, a localhost origin is allowed, anything else gets 403. This is the spec's MUST, and mcp-handler does not do it itself (its only CORS code is on the OAuth metadata route).
- Helper scripts: `call.py` (one 2026-07-28 request), `bench.py` (200 calls), `leakcheck.mts` (runs the repo's `findBlockedKeys` over every saved output) and `control.mts` (a planted-key negative control).

## Decisions

- **The spec read is revision 2026-07-28**, the newest folder in `modelcontextprotocol/modelcontextprotocol/docs/specification/` (read with `gh api`, 2026-11-07). Its changelog removes sessions (`Mcp-Session-Id`) and the `initialize` handshake, adds a required `server/discover`, and has every request carry its version in `_meta` and in the `MCP-Protocol-Version` header ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), major changes 1–3). The protocol is now stateless, which suits a serverless route.
- **Clients from before 2026-07-28 still send `initialize`.** The versioning page says a "dual-era" server "MAY serve both eras concurrently on the same endpoint" ([versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning), "Backward Compatibility"). mcp-handler 2.x says it does exactly this: "serves the 2026-07-28 MCP specification natively while transparently falling back to stateless Streamable HTTP for 2025-era clients" (its README). The prototype confirmed both eras (see Verified).
- **The prototype used the SDK, not hand-written JSON-RPC.** A hand-written route would have to track a protocol whose transport was rewritten in July 2026: `Mcp-Method`/`Mcp-Name` headers, `resultType`, `ttlMs`/`cacheScope` on list results, error codes renumbered to −32020…−32022, plus legacy `initialize` for older clients. That churn is what the dependency absorbs.

## Deviations

- The issue asks for MCP Inspector or `claude mcp add`. `claude mcp add --transport http laptracker-spike http://127.0.0.1:3917/mcp` connected (`claude mcp get` showed "✔ Connected"), but it saved the entry under the main checkout's path, so a headless `claude -p` started in this worktree did not load it. The tool call was therefore made with `claude -p … --mcp-config <scratchpad>/mcp.json --strict-mcp-config` instead, which is the same Claude Code HTTP client. I did not install MCP Inspector: `@modelcontextprotocol/inspector` 2.14.0 has a `postinstall` (`node scripts/install-clients.mjs`), and D10 denies install scripts.
- I did not read `api.lastasylumtracker.com/docs`. It is on the API host, and this spike stayed off that host entirely.

## Verified

**Real client (Claude Code 2.1.319).** The server log shows the session it opened, in modern-era requests only: `POST server/discover pv=2026-07-28 → 200`, `POST tools/list pv=2026-07-28 → 200 1557B`, `POST tools/call pv=2026-07-28 → 200 29943B 186ms`. The model replied: "50 players returned. First player: DwarfElf". Claude Code sent no `initialize`.

**Tool list** (`tools/list`, 2026-07-28; inputs only):

| tool | input | annotations |
|---|---|---|
| `list_events` | `{}` (strict) | `readOnlyHint: true, idempotentHint: true, openWorldHint: false` |
| `get_alliance` | `{event_id: int > 0, union_id: int > 0}` (strict) | same |
| `search_players` | `{q: string, 2–40 chars}` (strict) | same |

The result also carried `"resultType":"complete","ttlMs":0,"cacheScope":"private"` and `_meta["io.modelcontextprotocol/serverInfo"]`.

**One call's output**: `get_alliance {"event_id":2,"union_id":67109944}`, 64,797 bytes, 98 + 98 members. This is the `after` row and the first member, from `structuredContent`:

```json
{"id":61,"tag":"NSE","name":"Natural Selection","memberCount":98,"capacity":null,
 "totalPower":4200188282,"totalKills":58236948,"serverRank":1,"level":8,"isFresh":true,
 "sourceUpdatedAt":"2026-10-24T16:00:30.000Z","phase":"after","failed":false,
 "badgeImage":"https://laptracker-inky.vercel.app/img/badge/110"}
{"uid":340024664389,"name":"Egyption","power":89987726,"kills":6257354,"lv":30,
 "photo":"https://laptracker-inky.vercel.app/img/avatar/340024664389","role":null}
```

**No blocked key and no `avatar_url` comes out.** The outputs checked were `tools/list`, `list_events`, `get_alliance` (public event), `get_alliance` (rehearsal), `search_players` and a bad-arguments call:

- `findBlockedKeys` (the repo's own, `lib/queries/blocked-keys.ts`) over `result` and over the JSON parsed from every `content[].text`: **0** hits in all 6 files.
- Negative control: the same check on a copy with a planted `avatar_url` and `last_online_at` returned both paths, so the check can fire.
- `grep -c -E 'avatar_url|avatarUrl|phs-image|globallap|raw_json|rawJson|last_online|joined_at|daily_'`: **0** in every file.
- The seed does store photo URLs (`scripts/seed-data.ts` reads `avatar_url` from the fixtures). Our own links appear instead: 328 `/img/avatar/` links in `get_alliance` and 58 in `search_players`, each member counted twice because the spec asks for the JSON in a text block as well as in `structuredContent` (["SHOULD also return the serialized JSON in a TextContent block"](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).

**Visibility.** `list_events` returned events 3, 2 and 1 only; the seeded rehearsal (event 4, `isTest: true`) was absent. `get_alliance` for all 20 tracked `union_id`s: event 2 returned 20/20 rows, event 4 returned 20/20 `not_found` (`isError: true`). This is `publicEvent` (`lib/queries/visibility.ts`) at work; the tool layer added nothing.

**Transport behaviour** (curl against the prototype):

| request | result |
|---|---|
| legacy `initialize` (2025-11-25), no session header | 200 SSE, `protocolVersion: "2025-11-25"` |
| legacy `tools/call list_events` with `MCP-Protocol-Version: 2025-11-25`, no session | 200 SSE with the events |
| modern `server/discover` | 200 JSON, `supportedVersions: ["2026-07-28"]` |
| `GET /mcp` | 405 (the spec says 405 for GET/DELETE, "Backward Compatibility") |
| `Origin: https://evil.example` | 403 |
| `get_alliance {"event_id":"2; drop table events","union_id":1,"x":1}` | `isError: true`, "expected number, received string, Unrecognized key: \"x\"", no stack |

**Measured per call** (200 sequential calls each, server CPU from `ps cputime`, which includes the in-process PGlite query; this is not Neon latency):

| call | response bytes | wall ms/call | server CPU ms/call |
|---|---|---|---|
| `tools/list` | 1,557 | 3.8 | 2 |
| `list_events` | 2,585 | 6.6 | 3 |
| `get_alliance` | 64,797 | 3.6 | 4 |
| `search_players` (`q=ar`, 50 hits) | 29,943 | 16.4 | 17 |

**Packages** (`pnpm view`, 2026-11-07; "install scripts" = preinstall/install/postinstall):

| package | version to pin | released | unpacked | runtime deps | install scripts |
|---|---|---|---|---|---|
| `mcp-handler` (Vercel Labs, Apache-2.0) | 2.3.0 (2.3.1 came out 2026-11-05, two days ago; take the previous one, as D19 did) | 2026-10-07 | 245 KB | `chalk`, `commander`; peers `next >=13`, `@modelcontextprotocol/server ^2` | none |
| `@modelcontextprotocol/server` | 2.4.0 | 2026-10-23 | 7.0 MB | `@modelcontextprotocol/core` 2.4.0, `zod ^4.2.0` (we have 4.6.7) | none |
| `@modelcontextprotocol/core` | 2.4.0 | 2026-10-23 | 1.4 MB | `zod` | none |
| `@modelcontextprotocol/sdk` (v1 line, for comparison) | 1.32.2 | 2026-10-23 | 4.5 MB | 17, including `express`, `hono`, `cors`, `jose`, `ajv` | none |

`node_modules` of the scratchpad install: 17 MB for 6 packages. SDK 2.4.0 still sets `LATEST_PROTOCOL_VERSION = "2025-11-25"`, but its types carry the 2026-07-28 shapes, and the handler answered `server/discover` with `["2026-07-28"]`.

**Plan limits used in the cost section** (read 2026-11-08):

- Vercel Hobby ([plans/hobby](https://vercel.com/docs/plans/hobby), updated 2026-09-14): 1,000,000 function invocations, 4 CPU-hrs Active CPU, 360 GB-hrs provisioned memory, 100 GB Fast Data Transfer, 1,000,000 CDN requests. Past a limit: "you will have to wait until 30 days have passed before you can use the feature again". Hobby is "non-commercial, personal use only".
- Vercel CDN ([caching/cdn-cache](https://vercel.com/docs/caching/cdn-cache), updated 2026-09-14): only a "Request [that] uses `GET` or `HEAD` method" is cacheable; a request carrying an `Authorization` header is not; a function must send `s-maxage`.
- Vercel WAF ([rate-limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), updated 2026-08-28): "available on all plans"; Hobby gets 1 rate-limit rule per project (within 3 custom rules), keyed on IP or JA4, fixed window from 10 s to 10 min, action 429/Deny/Challenge/Log, 1,000,000 allowed requests included. "Mitigated traffic does not incur CDN Requests or Fast Data Transfer"; the docs do not say whether a blocked request counts as a function invocation.
- Vercel Runtime Cache ([caching/runtime-cache](https://vercel.com/docs/caching/runtime-cache), updated 2026-08-28): available on Hobby, 1M reads and 200K writes a month shared by the team, 2 MB per item. Past a limit the cache "is paused for the rest of the period".
- Neon Free ([pricing](https://neon.com/pricing), [plans](https://neon.com/docs/introduction/plans), updated 2026-11-04): 100 CU-hours per project per month; the compute table starts at 0.25 CU; scales to zero "After 5 min" of inactivity ("cannot disable"); 5 GB egress; 1 GB storage. "Compute is suspended only if a project uses up its monthly 100 CU-hours or 5 GB of network transfer; it resumes at the start of the next billing period".

**Upstream site** (lastasylumtracker.com, public HTML only, nothing under `/api/` and nothing on `api.`): `/terms`, `/tos`, `/terms-of-service`, `/privacy`, `/api-docs`, `/docs`, `/developers` and `/about` all return 404. The home page has no terms or reuse text. It says Patreon Pro gives an "API limit of 2,000 requests a day, not 1,000", it calls itself "not an official 37Games or Eyu website", and its only contact is a Discord invite.

**Gates:** `pnpm check` exit 0 on this branch with this file (prettier, eslint, tsc, vitest 44 files / 211 tests passed, 1 skipped, drift, i18n).

**Clean-up:** the prototype server is stopped, and `~/.claude.json` has no `laptracker-spike` entry. `git status` before this file was clean, and there is no `AGENTS.md` because `next dev` was never run.

## The six questions

**1. Shape.** There are three shapes (see Options). MCP on the same Next app is one App Router route (`app/mcp/route.ts` exporting the handler as `GET` and `POST`). mcp-handler 2.x needs no Redis ("Redis is no longer needed or used") and no `maxDuration` option. The deciding fact is that **MCP is POST-only, so the CDN cannot cache it**. A plain GET API can be cached at the CDN, so most calls never reach a function or Neon.

**2. Tools.** Each tool reuses `lib/queries` as it is, behind one whitelist module:

| tool | input | lib/queries | output |
|---|---|---|---|
| `list_events` | — | `listEvents` | id, name, eventAtUtc, manual, snapshots[{phase, status, startedAt, finishedAt}] |
| `get_event` | `event_id` | `getEventPage(db, id).page` | the ledger: per alliance before/after totals, ledger ranks, joined/left, movers (alliances and members) |
| `get_alliance` | `event_id, union_id` | `getAllianceDetail` | as in the prototype: rows plus rosters with role, badge/photo as `/img` URLs |
| `alliance_history` | `union_id` | `allianceHistory` | across events: reference row per event, deltas vs previous, ledger ranks |
| `get_player` | `uid` | `playerHistory` | name timeline, alliance timeline, per-event might/kills/lv |
| `search_players` | `q` (2–40) | `searchPlayers` | as in the prototype, at most 50 |

Rules for the outputs:
- Dates as ISO strings.
- `Map`s as arrays.
- `badgeId` becomes `/img/badge/<id>` and `hasAvatar` becomes `/img/avatar/<uid>` (or null).
- Inputs are strict zod objects with integer ids.
- Annotations: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`. Clients "MUST consider tool annotations to be untrusted" (tools page), so the annotations are a label, not a control.

**3. Rules** the build has to enforce, each with a test:

- **Read-only.** The public route files import only `lib/queries` (the new whitelist module) and `lib/route`. Nothing from `lib/sources`, `lib/repo`, `lib/run` or `lib/collector`. D34 already lints the dependency rule, and the build adds this restriction to it.
- **Only what pages show.** `getEventDetail` (and today's public `GET /api/events/[id]`) also returns `callsUsed`, `quotaRemainingAfter`, `durationMs` and `error` on snapshots, and `powerBoard`, `killsBoard`, `source` and `boardPulledAt` on rows. The board numbers come from `lib/sources/internal.ts`, which D5 records only as "the ranks board (cross-check, 0 quota)". Serving them to third parties would widen that use, so the whitelist drops all of these fields.
- **No blocked key, no `avatar_url`.** Run `findBlockedKeys` over every route and tool output, as the prototype did.
- **Visibility.** Already enforced inside `lib/queries` by `publicEvent`; the prototype proved 20/20 hidden for the rehearsal.
- **No upstream.** Follows from the import rule: there is no path to `/v1` or to the internal source.

**4. Abuse and cost.**

Auth:
- **No auth.** The data is already public on our pages.
- An API key per client costs three things: a table and a migration, an issuing UI on /admin, and a Neon read on every call to check the key.
- A key in `Authorization` also turns off Vercel's CDN cache (per the cdn-cache page).

Rate limiting:
- **Not the PIN limiter's pattern.** `lib/auth.ts` writes `auth_attempts` in Postgres on every counted request (`recordFailure`, an upsert), and it counts failures, not requests. Used per public call, it would hit Neon on every call, which is exactly the load to avoid.
- Use Vercel WAF's one Hobby rate-limit rule instead: per IP, for example 60 requests per 60 s on `/api/public/*` and `/mcp`, action 429.
- The same rule set to Deny is the kill switch, with no code change.

Cost at 10,000 calls a day (= 300,000 a month):

| resource | uncached (MCP straight to Neon) | GET API behind the CDN (MCP calls it) | source |
|---|---|---|---|
| Vercel invocations | 300k of 1M (30 %) | MCP: 300k (30 %); GET hits from the CDN: 0; GET misses: one per key per TTL | Hobby page |
| Vercel Active CPU | 300k × 2–17 ms = 0.2–1.4 h of 4 h | MCP layer ≈ 2–4 ms per call = 0.2–0.3 h | prototype `ps` CPU, which includes PGlite, so it is an upper bound for the query part and does not include the Neon driver |
| Fast Data Transfer | mean of the three tool responses ≈ 32 KB → ≈ 9.7 GB of 100 GB | about half that for the GET bodies (no text duplicate) | prototype bytes |
| **Neon compute** | one query every 8.6 s keeps the compute up 24 h/day: 0.25 CU × 24 h = 6 CU-h a day → **100 CU-h are gone on day 17** and compute is suspended for the rest of the month (site and collector down). Any traffic with gaps under 5 min has this effect; evenly spread, that is ≥ 288 calls a day. | only CDN misses reach Neon: with `s-maxage=86400` on a closed event, at most one query per URL per day per region | Neon plans page; arithmetic |
| Neon egress (5 GB) | not measured; if a query moves about half the response size (≈ 16 KB), that is ≈ 4.8 GB a month, right at the cap | negligible | estimate, labelled |

The site's own traffic already uses part of the 100 CU-h. Its current monthly figure is on the Neon dashboard and was not read here.

**5. Dependency.**
- Use `mcp-handler` 2.3.0 with `@modelcontextprotocol/server` 2.4.0: no install scripts, and 2 direct packages + 3 transitive (`core`, `chalk`, `commander`; `zod` is already ours). They serve both eras from one Web `Request → Response` handler.
- A hand-written JSON-RPC route needs no dependency, but it must implement both eras and keep up with a spec that rewrote its transport in July 2026.
- `@modelcontextprotocol/sdk` 1.x is the older line with 17 runtime dependencies; not that.

**6. Upstream terms.**
- I found no terms to conflict with: the site has no terms page, and the API docs page was not read.
- Serving through MCP spends no upstream quota and causes no pulls on the maintainer's side; every answer comes from our DB or our CDN.
- But the site sells a higher API limit through Patreon. A free mirror of our snapshots could compete with that, so ask before building. For the maintainer (over the Discord on the home page):
  1. May we republish our stored snapshots (alliance totals; member uid, name, might, kills, level) through a public API/MCP that other people's bots call?
  2. Do the API terms (`api.lastasylumtracker.com/docs`) limit redistribution of data read with a key, or say the key is for personal use?
  3. Do you want attribution (wording, link) in every response?
  4. Is the photos proxy (`/img/avatar/[uid]`, images from `phs-image.globallap.com`) fine to hand to third parties, or pages only?
  5. Would you rather bots use your API directly (Patreon), and should we point them there instead?
  6. Is there a call rate you'd want us to cap at?

## Options

| | A — Public GET API + OpenAPI file | B — `/mcp` only, tools on lib/queries | **C — A, then a thin `/mcp` over A (recommended)** |
|---|---|---|---|
| What | `GET /api/public/…` for the six reads above, `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`, a hand-written `openapi.json` | `app/mcp/route.ts` with mcp-handler; each tool calls `lib/queries` and opens a Neon connection | A's routes, plus `/mcp` whose tools `fetch` A's URLs on our own origin, so MCP answers come from the CDN cache |
| Upstream quota | 0 | 0 | 0 |
| Storage | 0 | 0 | 0 |
| New dependencies | 0 | 2 direct + 3 transitive (table above) | same as B |
| Work (estimate; the prototype's server was 120 lines and took about 1 h with the spec reading) | ~2–3 h: whitelist module, 6 routes, openapi.json, one test per route | ~2 h: route, 6 tools, Origin check, tests | ~3.5–4.5 h: A, plus ~1–1.5 h for `/mcp` |
| New rules or decisions | a D-entry: public API fields, cache TTLs, no auth, WAF rule; the import restriction | a D-entry for MCP; two rows in the D7 dependency table | both |
| Owner, outside code | 1 WAF rule (dashboard) | 1 WAF rule | 1 WAF rule |
| Risks | bots need someone to wire an OpenAPI tool; no "add this URL to Claude/ChatGPT" | **every call reaches Neon: day-17 suspension at 10k/day (table above)**; protocol churn means upgrades | MCP calls still invoke a function (~2–4 ms CPU each); one extra hop on a cache miss; the self-fetch is a new pattern (route → HTTP → route) that needs a D-entry; preview deployments are behind Vercel Authentication, so the self-fetch works on production only (tests mock `fetch`) |

**Recommendation: C**, built only after the maintainer answers questions 1–2. Reasons:
- It gives the owner what was asked: a URL people paste into Claude, ChatGPT or their bots.
- The CDN is what keeps third-party traffic away from Neon's 100 CU-hours, and MCP alone cannot use it.
- A also serves bots that are not MCP clients.

The cache TTLs, applied to the response headers:
- An event whose AFTER is `complete` or `partial` and older than a day gets `s-maxage=86400`.
- Anything newer, plus `list_events` and search, gets `s-maxage=300`.

The trade-off: a rename or a visibility switch (D28, D39) reaches cached copies only when the TTL runs out. In particular, a round switched to `admin` stays visible at the CDN for up to that long.

## Open issues

- **Pre-existing, not fixed:** `GET /api/events` and `GET /api/events/[id]` are public today, uncached (no `Cache-Control` anywhere under `app/api`), and `/api/events/[id]` returns `callsUsed`, `quotaRemainingAfter`, `durationMs`, `error`, `powerBoard`, `killsBoard`, `source` and `boardPulledAt`. Anyone can already loop on it against Neon. Follow-up: either the build's whitelist replaces it, or it gets the same headers and field trim.
- D22's "the server's players agreed to share their data" was agreed for our pages. Whether it covers third-party bots is the owner's call.
- Vercel's docs do not say whether a WAF-blocked request counts as a function invocation.
- How a visibility switch to `admin` should purge the CDN copy was not looked into (a cache purge API or a short TTL).

## Next

Session: NN-public-api-mcp — public read API and `/mcp` (builds option C of #178). Only after the owner picks C and the maintainer has answered.
Model / effort: raise one — it is a new unauthenticated public surface plus a new dependency on a protocol revision (2026-07-28) that the SDK's own `LATEST_PROTOCOL_VERSION` does not name yet.
Owner must do first: ask the maintainer questions 1–6 (section 6) and paste the answers into the issue; confirm C, no auth, and the six tools; read this month's Neon CU-hours; add the WAF rule (IP, 60/60 s, 429) on `/api/public/` and `/mcp` after the deploy.
Plan changes needed: docs/IMPLEMENTATION_PLAN.md §12 (Security) gains "public read API and MCP"; §11.1/docs/ARCHITECTURE.md gains `app/api/public/*`, `app/mcp`, and the whitelist module in the dependency rule. Do not edit them in the build without the owner.

```text
<session>
Session NN-public-api-mcp. Read CLAUDE.md, docs/handoff/00-prereqs.md, docs/handoff/08zzj-spike-mcp.md (all of it: the rules, the tools table, the cost table, option C), docs/ARCHITECTURE.md, docs/DECISIONS.md D5, D7, D10, D22, D28, D34, D42, lib/queries/index.ts, lib/queries/event-page.ts, lib/route.ts. Branch session/NN-public-api-mcp.
</session>

<task>
- lib/queries/public.ts: the whitelist read models for the six reads in the handoff's tools table, built on the existing queries. Dates as ISO, Maps as arrays, badgeId → `/img/badge/<id>`, hasAvatar → `/img/avatar/<uid>` or null. Never return callsUsed, quotaRemainingAfter, durationMs, error, isTest, powerBoard, killsBoard, source, boardPulledAt, raw_json or any BLOCKED_ROSTER_KEYS.
- GET routes under app/api/public/ for the six reads (zod-strict query and params, `withContext`), each with `Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400` for an event whose AFTER is complete or partial and older than 24 h, else `s-maxage=300`. public/openapi.json describing them.
- app/mcp/route.ts with mcp-handler 2.3.0 on @modelcontextprotocol/server 2.4.0 (exact pins; record both in a DECISIONS entry with release date, size and install scripts, per D7). Six read-only tools (annotations as in the handoff) whose handlers fetch the matching /api/public URL on the request's origin and return its JSON as structuredContent plus one text block. Answer 403 when an Origin header is present and is not the app's own origin; GET answers 405.
- A DECISIONS entry: public API and MCP — fields, TTLs, no auth, the WAF rule as the rate limit and kill switch, the self-fetch, and why the Postgres limiter is not used.
- Tests, one per stated behaviour: each public route and each tool output has zero findBlockedKeys hits and none of the dropped fields; a rehearsal and an `admin` round are not found; Cache-Control per case; a foreign Origin gets 403; an import-restriction lint stops app/api/public and app/mcp from importing lib/sources, lib/repo, lib/run or lib/collector.
</task>

<constraints>
- No upstream call, no /v1, no internal-source call, no write anywhere in these routes.
- No auth and no Postgres rate limiter on these routes (the handoff says why).
- Leave GET /api/events and /api/events/[id] as they are; report them.
- Verify with `pnpm check`, plus one real MCP client against `next dev` with the local seed DB (Claude Code via `--mcp-config`). Record its tools/list and one call in the handoff, and grep the outputs as the spike did.
</constraints>

<done_when>
pnpm check green; the client run recorded; docs/handoff/NN-public-api-mcp.md written. PR into dev: "feat: public read API and MCP server (#178)".
</done_when>
```

<adjustments>
- MCP spec revision 2026-07-28 is stateless: no `initialize`, no `Mcp-Session-Id`, `server/discover` required, `MCP-Protocol-Version` and `Mcp-Method`/`Mcp-Name` headers. mcp-handler 2.x serves it and 2025-era clients from one handler. Claude Code 2.1.319 speaks 2026-07-28; curl with `initialize` gets 2025-11-25.
- mcp-handler does not check Origin; the route must.
- `claude mcp add` from a worktree saves the entry under the main checkout's path; use `claude -p --mcp-config <file> --strict-mcp-config` to test from a worktree.
- The prototype's way to run lib/queries outside Next: PGlite + `migrate` + `scripts/seed.ts` `seed(db)` gives 20 alliances × 3 events + 1 rehearsal (event 4) in a few seconds, with no Neon.
- Measured sizes: get_alliance ≈ 65 KB with the text duplicate, search_players (50 hits) ≈ 30 KB, list_events ≈ 2.6 KB.
- Do not install @modelcontextprotocol/inspector: it has a postinstall (D10).
</adjustments>
