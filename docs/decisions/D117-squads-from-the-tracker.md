## D117 — Squads from the tracker: a nightly /v1/players read for the own alliance, append-only squads, hero pictures, and "Main squad might" from the tracker (2026-11-17, owner, 11ai, issue 413; amends D80)

Why: spike #409 found that `GET /v1/players/{uid}` (the documented API) returns an undocumented `squads` array: the squads the tracker has seen, each with its power and heroes. The owner chose this path (2026-11-17) over the site's internal arena API, which stays unused. Officers type "Main squad might" by hand today (D80, D109); the tracker can fill most of it.

**What is read.**

- One `GET /v1/players/{uid}` per member of `OWN_ALLIANCE_ID`'s roster in the day's read (D72), and nothing for other alliances.
- No `fresh=1`: the tracker's cached copy (up to 60 minutes old) is enough for squads, and the maintainer's game account makes no live read.
- A call is never retried (`maxRetries: 0`), so a member costs exactly one call a day. A 502/503/504 counts as failed for that member.
- The zod schema (`lib/sources/v1-player.ts`) reads only `uid`, `quota` and, per squad, `squad`, `power`, `soldiers`, `soldier_load`, `seen_at` and `heroes[]` (`id`, `lv`, `star`, `q`, `awaken`). A missing or null `squads` is no squads. Missing optional fields are null. A squad without a numeric `power` fails the call as `v1.schema` (paths only). `seen_at` is not documented: epoch seconds, milliseconds and ISO strings are all read.
- Nothing else of the body is kept or logged: not `history`, not `alliance_members` (whose private fields D71 governs), not `ranks`.
- `lib/sources/internal.ts` is not used and not widened. The arena endpoint (raven, arena teams) is out until the maintainer agrees (#409).

**When, and how it fits Vercel.**

- `POST /api/squads-read` (Bearer `CRON_SECRET`, the tick's `authorize`, `maxDuration` 120) runs one batch of at most `RUN_DEADLINE_MS` (100 s), sequential, 500 ms between calls (`PACE_MS`).
- The tick workflow calls it after every tick and again while it answers 200, at most 4 times. It answers 204 when nothing is due. All times stay in the app (D26's rule): a batch is due only inside the daily read's window (`dailyReadDue`), once the day's read is no longer `running`, and only when the batch ends inside the server day (`endsInServerDay(now, RUN_DEADLINE_MS)`, so no batch starts after 23:58:20 ST). In practice the 23:37 tick's workflow run reads the squads right after the daily read. If the OGs roster is missing until the 23:52 automatic retry, the 23:52 run reads them.
- Batches go on in uid order from `squad_reads.after_uid`. A batch claims the day (`batch_at`, stale after `RUN_STALE_AFTER_MS`) and releases it at its end, so the next call takes the next batch at once and two pingers never read the same member.
- A member is read once a day whatever happens to the call: the cursor moves past a failed call too.

**Quota** (INVARIANT `squads.keeps-event-reserve`).

- No `/v1/quota` call. The run starts from what the day's read left (`quota_remaining_before − calls_used`), then follows each response's `quota.remaining`.
- It starts only when that is at least `min(members, 120) + squadsReserve`. It stops before any call that would leave less than `squadsReserve`. A 429 stops it.
- `squadsReserve` = `SQUADS_SAFETY_MARGIN` (100: an /admin Retry, a rehearsal, slack), plus `eventReserve` when the scheduled event falls on the same quota day (a UTC day) and is not over: `requiredQuota(20)` for the Before and After, plus 21 calls for every sample between them (D69). That is 365 for KvK with samples every 15 minutes.
- **The Saturday rule, read in quota terms.** The quota resets at 00:00 UTC (22:00 ST). The read of Friday 23:37 ST is Saturday 01:37 UTC, so it spends from the KvK's own quota day, before the KvK reads. That run starts only if, after it, the KvK's reads and the margin still fit. Otherwise it is skipped with `reason: quota` and the numbers. Saturday's own run (Sunday 01:37 UTC) draws on a fresh quota day after the KvK reads; it keeps the margin only. Measured cost: about 100 calls a day for OGs (101 members), against 21 for the daily read and about 42 + 15 × 21 on a KvK day.

**The cap** (INVARIANT `squads.calls-capped`). At most one call per member of the day's roster, and never more than `SQUAD_CALLS_MAX` (120) in a day; past it the day stops with `reason: cap`.

**Storage** (INVARIANT `squads.append-only`).

- `member_squads`: one row per squad and observation (union, uid, squad number, power, soldiers, soldier_load, heroes as jsonb, the tracker's `seen_at`, our `read_at`).
- A read adds a row only when the squad differs from that member's newest row of the same number (another `seen_at`, power or heroes), so an unchanged squad is stored once.
- A squad missing from a later response is never deleted or changed. The card shows each number's newest row.
- `squad_reads`: one row per server day with the status (`running`, `done`, `stopped`, `skipped`), the members, the cursor, calls used, members with squads, failed calls, the quota left and the reason. Counts and codes only.
- Migration `0040_squads` (`pnpm db:generate`); it also widens `member_facts_source_check` with `tracker`.

**Logs.** `run_logs` lines under the day (`read_day`), so `/admin/runs/daily/[day]` lists them after the read's own lines:

- `squads.skip` (`reason`: `no_roster`, `quota`, `quota_unknown`, with `quota_remaining` and `required`);
- `squads.heroes` (catalog size, or the failure's class or HTTP status);
- `squads.batch` (status, calls, players read, with squads, failed, `might_written`, left, `quota_remaining`, `reason`).

No uid, name or squad value is logged. The lines are not `v1.fetch`, so the read's own calls table is unchanged.

**"Main squad might" from the tracker** (amends D80).

- New fact source `tracker`, shown as "from the tracker" / "do tracker" / "du tracker". The editor never sends it.
- **The main squad is the strongest stored squad**: among each squad number's newest row, the highest power; a tie goes to the lower number. It is not "squad 1", because the tracker may not have seen squad 1.
- **When a version is written** (INVARIANT `squads.officer-value-kept`, `trackerMightWrite`), after each member's squads are stored:
  - no value yet: write;
  - the newest value equals the main squad's power: nothing;
  - the newest version is from the tracker: write when it differs;
  - the newest version is an officer's, a message's or the sheet's (or a clear): write only when the tracker saw the squad (`seen_at`, else our first read of that observation) after that version was saved. A value typed after the sighting stays the newest until the tracker sees the squad again.
- It is always a new version (D80): the officer's value stays in the history, the card shows the source, and the D109 trend line shows the change. An editor opened before the tracker's write gets D80's 409 with the newer value, as with another officer.
- The version rule lives in `lib/squads.ts`, not `lib/private`: the nightly read runs outside the workspace and may not import `lib/private` (D71's fence). It writes through `lib/repo/member-facts.ts` with `written_by` null, so Home's activity feed (which lists officers' saves) does not show it.
- Only for the workspace of `OWN_ALLIANCE_ID`; with no workspace the squads are stored and no fact is written.

**The member card.** A "Squads (from the tracker)" section after Member info:

- each squad: "Squad 2", "Might 61.2M", "seen Mon, Nov 16";
- its heroes, ordered as the site orders them (quality, then stars, then level): the picture, the name from the catalog, "Lv 80" and `floor(star / 5)` whole stars (★, with "4 stars" for screen readers);
- one line under the heading: "The tracker lists only the squads it has seen."
- with no squad stored: "The tracker has not seen their squads yet."

These are plain information: a squad the tracker has not seen asks nothing of anyone (D75). Read in `lib/private/member-squads.ts` by `access.unionId` only (D71). Words in `lib/private/dictionary.squads.ts` (EN, PT-BR, FR).

**Hero pictures** (D22's rule, owner comment on #413).

- The tracker's public static files, no API and no quota. `/static/heroes.json` maps id → `{name, icon}`; only the name is kept.
- It is stored in `hero_catalog` and read again by the day's first squads batch when it is older than 20 hours (at most daily). A failure keeps the old catalog. A hero the new catalog drops keeps its row.
- `GET /img/hero/[id]` serves `/static/heroes/<id>.png` from the origin of `LAP_SITE_BASE_URL`, only for an id in `hero_catalog` (never from the catalog's `icon` path), through `fetchImage` (our User-Agent, 5 s, no redirects, 1 MB, raster only). A PNG or JPEG is redrawn at 80 px. `Cache-Control: public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800`. Any other id or a failure is the bodyless 404.
- The card asks for a picture only for a catalog hero. Any other id, or a picture that fails, is a plain bordered box with "Unknown hero".

**Privacy.** Squads are workspace-only data of the own alliance (D71): no public page, query, Discord message, AI request or shared cache reads them. The image route serves a hero's picture, which is the tracker's public asset, not member data.
