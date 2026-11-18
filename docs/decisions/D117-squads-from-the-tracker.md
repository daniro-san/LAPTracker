## D117 — Squads from the tracker: a nightly /v1/players read for the own alliance, append-only squads, hero pictures, and "Main squad might" from the tracker (2026-11-17, owner, 11ai, issue 413; amends D80; review and real read 2026-11-18)

Why: spike #409 found that `GET /v1/players/{uid}` (the documented API) returns an undocumented `squads` array: the squads the tracker has seen, each with its power and heroes. The owner chose this path (2026-11-17) over the site's internal arena API, which stays unused. Officers type "Main squad might" by hand today (D80, D109); the tracker can fill most of it.

**What is read.**

- One `GET /v1/players/{uid}` per member of `OWN_ALLIANCE_ID`'s roster in the day's read (D72), and nothing for other alliances.
- No `fresh=1`. We ask for the tracker's cached copy. Whether that avoids a live read on the tracker's side is not known: in the real read of 2026-11-18, 84 of 95 answers said `cached: false` and 11 said `cached: true`, with a median `age_seconds` of 0.
- The adapter never retries a call (`maxRetries: 0`). The run itself retries a member once, after the pass, when their call failed with a 5xx, got no answer, or was cut by the batch's deadline after it was sent (owner, 2026-11-18). A 429 or any other 4xx is never retried. So a member costs one call a day, two at most.
- The zod schema (`lib/sources/v1-player.ts`) reads only `uid`, `quota` and, per squad, `squad`, `power`, `soldiers`, `soldier_load`, `seen_at` and `heroes[]` (`id`, `lv`, `star`, `q`, `awaken`). A missing or null `squads` is no squads. Missing optional fields are null. A squad without a numeric `power` fails the call as `v1.schema` (paths only).
- `seen_at` is read as epoch seconds (an all-digit string too), milliseconds or an ISO string, and is stored as at most our read time.
- Nothing else of the body is kept or logged: not `history`, not `alliance_members` (whose private fields D71 governs), not `ranks`, and not the heroes' `honor` or `ue`, or the squads' `sid`.
- `lib/sources/internal.ts` is not used and not widened. The arena endpoint (raven, arena teams) is out until the maintainer agrees (#409).

**Measured** (one read of all 100 OGs members, 2026-11-18, run by the orchestrator with the owner's leave; aggregated, no names).

- 95 calls answered 200 and 5 answered 502, at scattered positions; the quota counter suggests a 502 also counts. That is why each failed member gets one retry (5 to 6 extra calls a night). A member whose retry fails too misses that day; their stored squads simply stay.
- Every 200 had a `squads` key. 34 of the 95 members had an empty list. The rest had 1–4 squads (9 had 1, 11 had 2, 31 had 3, 10 had 4), numbered 1–4. Every squad had 5 heroes except one with 4.
- Squad keys: `squad`, `power`, `soldiers`, `soldier_load`, `heroes`, `sid`, `seen_at`. Hero keys: `id`, `lv`, `star`, `q`, `awaken`, `honor`, `ue`.
- `seen_at` was always an integer in epoch seconds, 0.2–1.3 days old. Squad power ran 2.0M–21.0M.
- `q` took only 3, 4 and 5, always the same for one hero id. The owner (2026-11-18): rarity runs R < SSR < UR, so 3 is R, 4 is SSR, 5 is UR.
- `star` ran 0–50 (97 heroes at 50), so `floor(star / 5)` is 0–10 stars. `lv` ran 1–145; the owner says it goes up to 150, and the card fits "Lv 150".
- `awaken` was always 0 and `ue` always −1: neither is shown. `awaken` is stored with the squad, to be shown once the server is about 120 days old (owner, 2026-11-18); `honor` and `ue` are not stored.
- All 30 hero ids seen were in the 34-hero catalog.

**When, and how it fits Vercel.**

- `POST /api/squads-read` (Bearer `CRON_SECRET`, the tick's `authorize`, `maxDuration` 120) runs one batch of at most `RUN_DEADLINE_MS` (100 s), sequential, 500 ms between calls (`PACE_MS`). The 100 s count from before the claim and the hero catalog refresh, so the whole batch stays inside `maxDuration`.
- The tick workflow calls it after every tick and again while it answers 200 with `"more":true`, at most 4 times. It answers 204 when nothing is due. All times stay in the app (D26's rule): a batch is due only inside the daily read's window (`dailyReadDue`), once the day's read is no longer `running`, and only when the batch ends inside the server day (`endsInServerDay(now, RUN_DEADLINE_MS)`, so no batch starts after 23:58:20 ST). In practice the 23:37 tick's workflow run reads the squads right after the daily read. If the OGs roster is missing until the 23:52 automatic retry, the 23:52 run reads them.
- Batches go on in uid order from `squad_reads.after_uid`. A batch claims the day (`batch_at`, stale after `RUN_STALE_AFTER_MS`) and releases it at its end, so the next call takes the next batch at once and two pingers never read the same member. A claim older than 150 s belongs to a killed function and is taken over.
- **Once per member, plus one retry** (INVARIANT `squads.once-per-member`). As soon as a call's answer (or failure) is in, before its squads are stored, the cursor, the retry list (`squad_reads.retry_uids`), calls used, counts and quota left are written in one update guarded by the batch's claim (`batch_at` equals the time it claimed). A function killed mid-batch, even while storing, therefore leaves both at its last call, and the next batch never calls a member again. A batch whose claim was taken over stops writing and answers idle.
- The cursor moves past a failed call too. When the pass is over, each member on the retry list gets one more call, in the order they failed, and leaves the list whatever its answer. A call the deadline cut before it was sent is not a call; that member stays for the next batch. A call the deadline cut after it was sent counts as failed and puts the member on the retry list. The cap and the reserve apply to that retry too. The list is `squad_reads.retry_uids`.

**Quota** (INVARIANT `squads.keeps-event-reserve`).

- No `/v1/quota` call. The run starts from what the day's read left (`quota_remaining_before − calls_used`), then follows each response's `quota.remaining`.
- It starts only when that is at least `min(members, 120) + squadsReserve`. It stops before any call that would leave less than `squadsReserve`. A 429 stops it.
- `squadsReserve` = `SQUADS_SAFETY_MARGIN` (100: an /admin Retry, a rehearsal, slack), plus `eventReserve` when the scheduled event falls on the same quota day (a UTC day) and is not over: `requiredQuota(20)` for the Before and After, plus 21 calls for every sample between them (D69). That is 365 for KvK with samples every 15 minutes.
- **The Saturday rule, read in quota terms.** The quota resets at 00:00 UTC (22:00 ST). The read of Friday 23:37 ST is Saturday 01:37 UTC, so it spends from the KvK's own quota day, before the KvK reads. That run starts only if, after it, the KvK's reads and the margin still fit. Otherwise it is skipped with `reason: quota` and the numbers. Saturday's own run (Sunday 01:37 UTC) draws on a fresh quota day after the KvK reads; it keeps the margin only. Measured cost: about 100 calls a day for OGs (101 members), against 21 for the daily read and about 42 + 15 × 21 on a KvK day.

**The cap** (INVARIANT `squads.calls-capped`). One call per member of the day's roster plus at most one retry, and never more than `SQUAD_CALLS_MAX` (120) calls in a day, retries included; past it the day stops with `reason: cap`. The quota guard below applies to every call, retries too.

**Storage** (INVARIANT `squads.append-only`).

- `member_squads`: one row per squad and observation (union, uid, squad number, power, soldiers, soldier_load, heroes as jsonb, the tracker's `seen_at`, our `read_at`).
- A read adds a row only when the squad differs from that member's newest row of the same number (another `seen_at`, power or heroes), so an unchanged squad is stored once.
- A squad missing from a later response is never deleted or changed. The card shows each number's newest row.
- `squad_reads`: one row per server day with the status (`running`, `done`, `stopped`, `skipped`), the members, the cursor, calls used, members with squads, failed calls, the quota left and the reason. Counts and codes only.
- Migration `0041_squads` (`pnpm db:generate`); it also widens `member_facts_source_check` with `tracker`.

**Logs.** `run_logs` lines under the day (`read_day`), so `/admin/runs/daily/[day]` lists them after the read's own lines:

- `squads.skip` (`reason`: `no_roster`, `quota`, `quota_unknown`, with `quota_remaining` and `required`);
- `squads.heroes` (catalog size, or the failure's class or HTTP status);
- `squads.batch` (status, calls, players read, with squads, failed, retried, `might_written`, left, `quota_remaining`, `reason`).

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
- **The thanks** (owner, 2026-11-18). A tracker version counts toward the weekly thanks (D114) only as any other version does: when the week's growth reaches `SQUAD_GROWTH` (5 %). Below that it updates the card and brings no thanks.
- The version rule lives in `lib/squads.ts`, not `lib/private`: the nightly read runs outside the workspace and may not import `lib/private` (D71's fence). It writes through `lib/repo/member-facts.ts` with `written_by` null, so Home's activity feed (which lists officers' saves) does not show it.
- Only for the workspace of `OWN_ALLIANCE_ID`; with no workspace the squads are stored and no fact is written.

**The member card.** A "Squads (from the tracker)" section after Member info:

- each squad: "Squad 2", "Might 61.2M", "seen Mon, Nov 16";
- its heroes, UR first, then SSR, then R, then by stars and level (the site's order): the picture, the name from the catalog, the rarity tag (R / SSR / UR), "Lv 150" and the stars as one star and the count, "★10" (`floor(star / 5)`, with "10 stars" for screen readers). Ten stars drawn one by one did not fit a hero's column at 360 px;
- one line under the heading: "The tracker lists only the squads it has seen."
- with no squad stored: "The tracker has not seen their squads yet."

These are plain information: a squad the tracker has not seen asks nothing of anyone (D75). Read in `lib/private/member-squads.ts` by `access.unionId` only (D71). Words in `lib/private/dictionary.squads.ts` (EN, PT-BR, FR).

**Hero pictures** (D22's rule, owner comment on #413).

- The tracker's public static files, no API and no quota. `/static/heroes.json` maps id → `{name, icon}`; only the name is kept.
- It is stored in `hero_catalog` and read again by the day's first squads batch when it is older than 20 hours (at most daily). A failure keeps the old catalog. A hero the new catalog drops keeps its row.
- `GET /img/hero/[id]` serves `/static/heroes/<id>.png` from the origin of `LAP_SITE_BASE_URL`, only for an id in `hero_catalog` (never from the catalog's `icon` path), through `fetchImage` (our User-Agent, 5 s, no redirects, 1 MB, raster only). A PNG or JPEG is redrawn at 80 px. `Cache-Control: public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800`. Any other id or a failure is the bodyless 404.
- The card asks for a picture only for a catalog hero. Any other id, or a picture that fails, is a plain bordered box with "Unknown hero".

**Privacy.** Squads are workspace-only data of the own alliance (D71): no public page, query, Discord message, AI request or shared cache reads them. The image route serves a hero's picture, which is the tracker's public asset, not member data.
