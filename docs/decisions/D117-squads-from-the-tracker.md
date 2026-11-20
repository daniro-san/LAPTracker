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
- `q` took only 3, 4 and 5, always the same for one hero id: 3 is SR, 4 is SSR, 5 is UR (the owner's game screenshots; see the amendment below).
- `star` ran 0–50 (97 heroes at 50), so the star level `floor(star / 5)` is 0–10. `lv` ran 1–145; the owner says it goes up to 150, and the card fits "Lv 150".
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
- its heroes, UR first, then SSR, then SR, then by the raw `star` and level (the site's order): the picture with a thin frame in its rarity's colour, the name from the catalog, the rarity tag (SR / SSR / UR) in the game's colours, "Lv 150", and the game's five star icons (see the amendment below);
- one line under the heading: "The tracker lists only the squads it has seen."
- with no squad stored: "The tracker has not seen their squads yet."

**At a glance** (owner, 2026-11-18). Four squads are normal (players buy a pack for a fourth), so a member has 3 or 4, and officers look for the strongest squad and for what changed and when.

- **Every stored squad, in squad-number order** (1 to 4), each number's newest row.
- **The strongest squad** is the one with the highest power, the lower number on a tie: the same squad whose power is "Main squad might" (`mainSquad`). It sits in the soft drawn frame with a 5 % plum tint and carries the word "Strongest" / "Mais forte" / "La plus forte" beside its name. The word carries the meaning, never the tint alone.
- **What changed and when.** Under each squad, after "seen {date}": when an earlier stored row of that squad exists, the power change since it, "+1.20M since Sun, Nov 15" (D78's compact numbers; the date is that row's sighting, else our read of it), and "Heroes changed" when the heroes, a hero's level or a hero's stars differ. A drop reads "−400K since …" in the same plain ink, never in red (D75). With no earlier row, nothing more is said. The read is `squadPairs` (each squad's newest row and the one before it).
- It fits 360 px with 4 squads of 5 heroes, in two hero columns.

These are plain information: a squad the tracker has not seen asks nothing of anyone (D75). Read in `lib/private/member-squads.ts` by `access.unionId` only (D71). Words in `lib/private/dictionary.squads.ts` (EN, PT-BR, FR).

**Hero pictures** (D22's rule, owner comment on #413).

- The tracker's public static files, no API and no quota. `/static/heroes.json` maps id → `{name, icon}`; only the name is kept.
- It is stored in `hero_catalog` and read again by the day's first squads batch when it is older than 20 hours (at most daily). A failure keeps the old catalog. A hero the new catalog drops keeps its row.
- `GET /img/hero/[id]` serves `/static/heroes/<id>.png` from the origin of `LAP_SITE_BASE_URL`, only for an id in `hero_catalog` (never from the catalog's `icon` path), through `fetchImage` (our User-Agent, 5 s, no redirects, 1 MB, raster only). A PNG or JPEG is redrawn at 80 px. `Cache-Control: public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800`. Any other id or a failure is the bodyless 404.
- The card asks for a picture only for a catalog hero. Any other id, or a picture that fails, is a plain bordered box with "Unknown hero".

**Privacy.** Squads are workspace-only data of the own alliance (D71): no public page, query, Discord message, AI request or shared cache reads them. The image route serves a hero's picture, which is the tracker's public asset, not member data.

**Amendment 2026-11-18 (owner, from game screenshots; branch `fix/squads-rarity-stars`).**

- **Rarity is SR / SSR / UR**, not R / SSR / UR. In the game a `q` 3 hero shows "SR", a `q` 4 hero "SSR", a `q` 5 hero "UR". The order stays UR, SSR, SR.
- **The game's colours.** The tag is drawn in SR blue, SSR purple and UR gold, and the hero's picture gets a 2 px frame in the same colour. These are tokens `--rarity-sr`, `--rarity-ssr` and `--rarity-ur` in `lib/brand/tokens.css`, with a light and a dark value (DESIGN.md "Rarity"). As 12 px semibold text each keeps 4.5:1 on paper and on the strongest squad's tint; the lowest is UR in light on the tint, 5.0:1. The letters always say the rarity, so the colour never carries it alone.
- **Stars as the game draws them.** The star level is 0–10 (`floor(star / 5)`), and the game always draws 5 star icons. Levels 1–5 fill them yellow from the left. Levels 6–10 turn them red from the left: level 7 is 2 red and 3 yellow, level 10 is 5 red. `star` has 5 sub-steps per level, so the next icon is partly filled, `(star % 5) / 5`, in the colour it will become (`starIcons`, `lib/private/member-squads.ts`).
  - The colours are tokens `--star-yellow` and `--star-red`, each 3:1 or more against paper and the tint, light and dark (small graphics). The red is not the seal red of warnings; the five icons together read as stars, not as an error (D75).
  - Screen readers hear "Star level 7 of 10" / "Nível de estrela 7 de 10" / "Niveau d’étoile 7 sur 10", so the colours carry nothing alone.
  - This replaces "★10" (one star and the count).
- **No top hero.** The "Top hero" mark (one hero per member, ranked by rarity, then stars, then level), its rule line, its words in the three languages and its test are removed at the owner's request. The game shows a power per hero (for example 1,031,107), but `/v1/players` does not send it, so any ranking of heroes would be a guess. The card is about the squads: every squad, the strongest one framed and tagged, and what changed.

**Amendment 2026-11-19 (orchestrator, before the next release; branch `fix/squads-from-tick`): the tick starts the batches.**

- **Why.** The squads read was chained from `tick.yml`, but GitHub's schedule fires only about 3 times a day at random times (recent runs 02:01, 20:41, 12:20, 03:49 UTC). The real scheduler is cron-job.org's "Vercel Ticker" (D30): `POST /api/tick` every 15 minutes at :00, :15, :30 and :45, with a 30 s timeout. A batch would almost never have landed in the 23:30–23:58:20 ST window.
- **Rule.** `/api/tick` starts the next squads batch after its answer (`after`, `lib/squads-tick.ts`) whenever one is due: inside the daily read's window and ending before 00:00 ST (`squadsBatchDue`, the same `dailyReadDue` and `endsInServerDay(now, RUN_DEADLINE_MS)` as `runSquadsBatch`).
  - The batch opens its own database connection, because the request's connection closes with the answer.
  - It runs `runSquadsBatch` unchanged: the claim, the progress saved after every call, the 120-call cap, the KvK reserve and the 100 s deadline.
  - An error becomes an `app_errors` row (route `/api/tick`, kind `after`), a code only.
  - cron-job.org gets its answer first, so its 30 s timeout never waits for the batch.
- **`maxDuration` of `/api/tick` is 300 s** (was 120, D6). One function run holds the tick's own work (at most 100 s plus its writes, for example the 23:30 daily read) and, after the answer, one batch (at most 100 s). 300 s is the Vercel Hobby maximum with Fluid compute.
- **Two batches a night.** The 23:30 tick runs the daily read, answers, then starts batch 1. The 23:45 tick starts batch 2. A tick at 00:00 is on the next server day, so it starts nothing.
  - At the current pace, 500 ms between calls plus about 1 s per call and a few database writes, a call takes about 1.5 s. So a batch holds about 64–66 calls, and two batches about 130.
  - A night needs about 100 members plus 5–6 retries, about 106 calls, so it fits with about 20 calls to spare.
  - It stops fitting once a call takes more than about 1.4 s on average (106 calls over 200 s). Then the rest of the roster waits for tomorrow; nothing breaks, and the day's row says how far it got. The gap was not shortened.
- **The backup path stays.** `POST /api/squads-read` stays for manual runs, and `tick.yml`'s step stays for whenever GitHub's schedule does fire in the window. The claim makes any two callers safe together: one batch at a time, and nobody is read twice.

**Amendment 2026-11-19b (owner, to check the read without waiting for the night; branch `feat/admin-run-squads-now`, part of issue 472): /admin can start the read now.**

- **Why.** The owner wants to run the squads read once by hand to check it. Until now a batch ran only in the nightly window, and `POST /api/squads-read` answered 204 at any other time.
- **The button.** /admin has a "Squads read" section after Workspaces. It has a "Run the squads read now" button for each workspace (`POST /api/admin/squads-read?union=<id>`) and one for all workspaces (no `union`).
  - PIN only, through `authorize`: `timingSafeEqual` on a hash, and the PIN's own rate limiter, as for /admin's other buttons. There is no separate limit on presses: the claim, the day's cap and the reserve already bound what presses can spend.
- **What a press does.** The route answers 202 with the day and the workspaces whose batches start. The batches then run after the answer (`after`), through `squadsBatch` → `runSquadsBatch` with `force`, on their own database connection. An error becomes an `app_errors` row of route `/api/admin/squads-read`.
  - One batch after another while members are left and another whole batch (100 s) would end by 240 s; the route's `maxDuration` is 300 s. A batch that made no call ends the press too. The tick still runs one batch.
- **Only the window check changes.** `force` replaces "inside the daily read's window and ending before 00:00 server time" with `forcedSquadsDay`. Everything else is unchanged:
  - the day's read must be done (not missing, not `running`);
  - the claim and the per-call progress save;
  - the 120-call cap, retries included;
  - the reserve: the margin, plus the KvK reserve on `LAP_API_KEY`;
  - D124's keys: each workspace on its own key, and OGs on `LAP_API_KEY` only until it has its own;
  - D117's one retry and no `fresh`;
  - the 100 s deadline of each batch.
- **Which row: the quota day's** (`quotaDayRead`, `lib/schedule.ts`). A press reads the row of the daily read whose `DAILY_ROSTER_AT` falls on the current UTC day. That is the same row the nightly batches of that quota day use.
  - With the server at UTC−2 and 23:30, a press at 13:00 server time on Friday goes on with Thursday's read (Friday 01:30 UTC). It takes the members after that row's cursor and the retry list.
  - So a press and the nightly batches never read a member twice in one UTC day, and the day's cap counts both.
  - Between 22:00 and the end of the daily read (server time), the quota day's read has not run yet, and a press answers 409 `daily_read_pending`.
- **When a press is refused** (409, no batch):
  - `event_window`: from the scheduled event's Before until its After's window closes (`inEventWindow`);
  - `quota_reset`: a 100 s batch would end after 00:00 UTC, so its calls would land on the next quota day under this day's row. Each later batch of the press checks this again;
  - `daily_read_pending`;
  - `no_target`: no workspace (or not that one) has the squads read on (D126) and a key the read can use (D124).
- **Progress on /admin.** The section lists the workspaces the read takes (`squadTargets`' rule: the squads read on (D126), and a key the read can use (D124), worked out from the key's status without opening it) and any workspace with a row that day. For each, the quota day's row shows:
  - its state: not read yet, a batch running now, more to read, done, or stopped or skipped with the reason;
  - "Read N of M · R waiting to retry · F failed · quota left Q". N is the roster members up to the cursor. R is the retry list. F is the failed calls, retries included;
  - "Last batch …": the newest `squads.batch` line of that workspace.
  - Counts only (`lib/queries/squads-progress.ts`). The button reads "Run the squads read now" before the first batch and "Run the next batch" while members are left and no batch holds the claim. It is hidden when the day is done, stopped or skipped.
- **The tick does not continue a forced run.** A press does not change when the tick starts batches: only inside the nightly window. Outside it, what one press leaves takes another press.
- **Logs.** A pressed batch's `squads.batch` line carries `forced: true`, besides D117's counts. No uid, name or squad.
- **Known limit.** On `LAP_API_KEY`, a press starts from the last quota number the day's row (or the daily read) saved. That number can be hours old by then. Calls spent in between (an /admin Retry, a rehearsal) come out of the safety margin, which exists for them. From the first answer on, each response's `quota.remaining` guards every call.

**Amendment 2026-11-20 (owner, issues 472 and 490; D132): a daily queue replaces the window, and every answer is kept.**

- **The window rule is replaced.** The squads read no longer runs only in the daily read's window (`dailyReadDue`, ending before 00:00 ST). Each alliance gets a queue per quota day (`squad_queue`, made from the day's roster by its first batch). Every tick reads a batch of at most 25 members (`SQUADS_BATCH_CALLS`) in at most 60 s (`SQUADS_BATCH_MS`), whenever the batch ends before the next 00:00 UTC. The 23:30 and 23:45 ticks are the first two of about four on a normal night.
- **"Once per member, plus one retry" becomes "one answer per member, at most 3 attempts".** A 5xx, no answer or a call the deadline cut after sending goes to the back of the queue, 15 minutes later, so it is tried on a later tick. The cursor (`after_uid`) and the retry list (`retry_uids`) are dropped. The queue row and the day's counts are saved in one transaction under the claim. The cap of 120, the no-`fresh` rule and the claim are unchanged.
- **The KvK reserve waits instead of skipping.** A call that would cut into `squadsReserve` ends the batch with the row still `running` (`reason: quota`). The next ticks try again, and the queue goes on once the event's reads no longer need the quota. "The Saturday rule" above therefore no longer skips Friday night. It spends what the reserve allows, and the rest is read after the event. On `LAP_API_KEY`, nothing runs during the event's Before/After window.
- **Members who join during the day** are queued from an answer's alliance roster when the tracker updated that alliance after the day's roster read. Only the uids are read.
- **What is kept from the body changes.** "Nothing else of the body is kept" no longer holds. Each answer is a `player_reads` row (the body less `alliance_members`, `raw_json` cleared after 90 days, the shield, map and profile fields as columns). Its `history[]` rows go to `player_history` once each. Each squad keeps its `troops`, and each hero keeps its `honor`. `ue` and the squad's `sid` stay inside `raw_json` only. See D132.
- **/admin.** The progress line reads "Squads today: N of M read · R waiting to retry · F not read · quota left Q", plus "Next try at HH:MM server time." When everyone left waits for a later try, the state reads "N waiting to try again · next try at HH:MM ST" and the button is hidden. The press runs the same queue's batches now, and the tick goes on with what a press leaves.
