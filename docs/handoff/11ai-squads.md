# 11ai — Squads from the tracker (issue 413, D117)

## Built
- **Source.** `fetchPlayer` in `lib/sources/v1.ts`: `GET /v1/players/{uid}` without `fresh`. The schema is in `lib/sources/v1-player.ts` and reads only `uid`, `quota` and each squad's `squad`, `power`, `soldiers`, `soldier_load`, `seen_at`, `heroes[]` (`id`, `lv`, `star`, `q`, `awaken`). The rest of the body is dropped. `V1Source` has the new method; the test fake returns no squads.
- **The nightly read.** `lib/squads-read.ts` runs behind `POST /api/squads-read` (cron Bearer, `maxDuration` 120).
  - It runs in batches of at most 100 s, sequential, with 500 ms between calls and no retries.
  - A batch is due only inside the daily read's window, after the day's read finished, and when the batch ends before 00:00 ST.
  - `tick.yml` calls the route after every tick and again while it answers 200, at most 4 times. The job timeout went from 5 to 14 minutes.
  - The day's record is `squad_reads` (status, cursor, calls, with squads, failed, quota left, reason). The log lines `squads.skip`, `squads.heroes` and `squads.batch` carry counts and codes only.
- **The rules** (`lib/squads.ts`, pure):
  - `squadsReserve` is a margin of 100, plus the KvK's reads when the scheduled event falls on the same UTC quota day;
  - the cap is one call per roster member, at most 120 a day;
  - `mainSquad` picks the strongest squad;
  - `trackerMightWrite` is the version rule.
- **Storage.** `member_squads` is append-only. A row is added only when a squad changed. A squad missing from a response is never touched. `hero_catalog` holds hero ids and names. Migration `0040_squads` (from `pnpm db:generate`) also adds `tracker` to `member_facts_source_check`.
- **"Main squad might".** A new version with source `tracker` ("from the tracker" / "do tracker" / "du tracker"), written through `lib/repo/member-facts.ts` with `written_by` null.
- **Hero pictures.** `/img/hero/[id]` serves only ids in `hero_catalog`. It fetches `/static/heroes/<id>.png` from the tracker site's origin, redraws it at 80 px and caches it for 30 days. The catalog is refreshed by the day's first batch when it is older than 20 hours.
- **Card.** A "Squads (from the tracker)" section after Member info (`MemberSquads.tsx`, `lib/private/member-squads.ts`):
  - each squad's might and "seen {date}";
  - its heroes with picture, name, R / SSR / UR, level and `floor(star/5)` stars as "★10", UR first (see the review round);
  - a plain box and "Unknown hero" for an id outside the catalog;
  - one quiet line when the tracker has seen no squad.
  - `HeroPicture` is in `app/_ui/Pictures.tsx`.
- Words in `lib/private/dictionary.squads.ts` (EN, PT-BR, FR). `internal.ts` has a header note: squads come from `/v1`, the arena endpoint is not used.

## Decisions
- D117 (new); D80 has a dated amendment (the fourth source).
- **Main squad** = the strongest stored squad (each number's newest row), not squad 1, because the tracker may not have seen squad 1. A tie goes to the lower number.
- **Version rule.**
  - The tracker writes a new version only when the value differs.
  - Over an officer's, a message's or the sheet's value, it writes only when the tracker saw the squad after that value was saved (`seen_at`, else our first read of that observation). A value typed after the sighting stays until the tracker sees the squad again, so the two never take turns overwriting each other.
  - The officer's value stays in the history, and the card shows "from the tracker".
- **The Saturday rule in quota terms.** The quota resets at 00:00 UTC (22:00 ST).
  - The run of Friday 23:37 ST spends from Saturday's UTC quota, before the KvK reads. That run starts only if the KvK's Before, After and samples (365 calls with 15-minute samples) plus the margin still fit after it.
  - Saturday's own run draws on Sunday's quota, after the KvK reads, so it keeps only the margin.
  - This is my reading of "Saturdays only if quota remains after the KvK reads". If the owner meant the Saturday-ST run literally, that run is always far above the margin.
- **No `/v1/quota` call.** The run starts from `quota_remaining_before − calls_used` of the day's read, then follows each response's `quota`.
- **One call per member per day, strictly.** No retries, and a failed member is not read again that day.
- The version rule lives in `lib/squads.ts`, not `lib/private`, because the nightly run may not import `lib/private` (D71's fence).

## Deviations
- **Chaining.** The issue offered "split across the tick, or chain batches". I chain batches from the workflow: the app decides whether a batch is due, and the workflow only repeats the call while it gets 200. The 23:52 tick may be taken by D72's automatic retry, so the tick alone does not leave room for 100 calls.
- **Log lines** go to `run_logs` under the day's `read_day`, so they show on `/admin/runs/daily/[day]` after the read's own lines. They are not `v1.fetch` lines, so the read's calls table is unchanged.

## Verified
- `pnpm check` exits 0: 190 files, 1011 tests passed (4 skipped), drift fine, i18n up to date. The final layout fix was only re-formatted and rebuilt; `pnpm build` exits 0.
- New tests:
  - `lib/sources/v1-player.test.ts` (4): squads present (the path has no `fresh`, nothing else of the body is kept), absent or null, partial, and a bad `power` failing as `v1.schema` with the path only;
  - `lib/squads.test.ts` (5): the KvK reserve on Friday night's quota day; only the margin on Thursday and Saturday nights and after the After; no samples; the main squad; the version rule;
  - `lib/squads-read.test.ts` (5): one call per member, then idle; 130 members stop at 120 (`cap`); Friday night skipped with `reason: quota` and a log line with no uid, while Thursday runs with the same quota; a stop before the reserve; old squads kept with an unchanged squad stored once; a tracker version written while an officer's newer value stays;
  - `app/img/hero/[id]/route.test.ts` (1): a catalog id is fetched; unknown ids are refused and never fetched;
  - `app/(private)/_ui/MemberSquads.test.ts` (2): the card render in EN and PT, and the empty state.
- **e2e** on a local production build (:3987), local Postgres 18, an invented 40-member roster, and stand-ins for Discord sign-in and for the tracker (`/v1/players` and the static hero files). No real upstream call.
  - The real `POST /api/squads-read`: a wrong secret gets 401. The first call answered 200 `done` with 40 calls in 20.6 s; the next call answered 204.
  - The stand-in saw 40 player requests, all without `fresh`, and 1 catalog request.
  - DB: 35 members with squads, 46 squad rows, 34 tracker versions, quota left 830. The officer's newer 41M value stayed. An officer's older 30M value got version 2, 43.7M "from the tracker".
  - Playwright Chrome (first round, before the review round): **70 of 70 checks pass**. They covered the hero route (one 200, three 404s); at 360 and 1280, light and dark, EN and PT: the heading, squad, might, seen date, level and unknown hero, the stars' label, 7 pictures loaded and none for the unknown id, legendary first, nothing overflowing, the officer value kept, and no request leaving our origin; the Quillon card ("43.7M, +13.7M this week, from the tracker"); and the empty line.
  - The design pass found "Lv / 80 ★★★★" wrapping in the 3-column grid at 1280. Fixed (the text column takes the free width, the level line does not wrap), rebuilt, and re-checked: 70 of 70.
- Privacy grep of the diff against the 101 names of the OGs fixture: 0 hits.
- Screenshots (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ai-shots/`: `squads-{360,1280}-{light,dark}-{en,pt}`, `card-{360,1280}-{light,dark}-{en,pt}`, `card-quillon-tracker-360-light-en`, `squads-none-360-light-en`.

## Review round (PR 416, 2026-11-18)
Input: the PR review, a one-off real read of all 100 OGs members that the orchestrator ran with the owner's leave (aggregated, no names; I made no upstream call), and the owner's answers.

- **Crash safety.** After every call, the cursor, the retry list, the calls used, the counts and the quota left are saved in one update guarded by the batch's claim (`updateClaimedSquadRead`). A killed function cannot make the next batch read a member again. A batch whose claim was taken over as stale stops writing and answers idle.
- **Deadline.** The 100 s now count from before the claim and the hero catalog refresh.
- **Deadline before a call.** A call the deadline cut before it was sent does not move the cursor; that member stays for the next batch.
- **Retry** (owner). After the pass, each member whose call failed with a 5xx or got no answer gets one more call. A 429 or another 4xx is never retried. The 120 cap now counts every call of the day, retries included, and the reserve applies to retries too. Migration `0041_squad_retries` adds `squad_reads.retry_uids`.
- **`seen_at`.** All-digit strings are read as epoch seconds. A sighting is stored as at most our read time.
- **Card.**
  - Each hero gets an R / SSR / UR tag (`q` 3 / 4 / 5, owner), UR first.
  - Stars show as "★10" (one star and the count), because ten drawn stars overflowed at 360.
  - Two columns at every width: the sheet is about 440 px wide on a desktop, and three columns wrapped "★10" under the level.
  - "Lv 150" fits.
- **`tick.yml`.** The loop also stops when the answer says `"more":false`.
- **`awaken`** stays stored and is not shown (owner: show it once the server is about 120 days old).
- **Thanks** (owner). A tracker version counts toward the thanks only at 5 % growth or more, like any version. `progressOf` already did this for every source; a test now pins it for tracker versions.
- **D117 updated.** The measured facts from the real read; the `cached` wording now says only what was observed (84 of 95 `cached: false`, median age 0 s), not a claim about the maintainer's game account; R/SSR/UR replaces "legendary/epic" everywhere.
- **New tests:**
  - in `lib/squads-read.test.ts`: a 429 stops the day; a 502 member is retried once and not again; the next batch goes on from the cursor without re-reading; a second caller is refused while a claim is held; a stale claim is taken over;
  - in `lib/private/fact-trend.test.ts`: tracker versions are thanked only at 5 % or more;
  - an all-digit `seen_at` in `v1-player.test.ts`;
  - "Lv 150", "★10" and UR before SSR before R in `MemberSquads.test.ts`.
- **Verified (r2).** `pnpm check` exits 0 (190 files, 1017 tests passed, 4 skipped) before the last layout change.
  - **e2e** on a new production build, with a tracker stand-in shaped like the real read: up to 4 squads of 5 heroes (one of 4), star up to 50, level up to 150, `q` 3/4/5 fixed per hero, `ue` −1, `seen_at` in epoch seconds 0.2–1.3 days old. It answers 502 once for two members.
  - The real route made 42 calls for 40 members, retried 2, `retry_uids` came back empty, status `done`, then 204. 1 catalog request; no `fresh`.
  - Playwright Chrome: **86 of 86 checks pass**, before and after the two-column change. The checks cover 18 hero pictures in 4 squads, UR first with "★10", R/SSR/UR tags, every hero line inside its column, and nothing overflowing, at 360 and 1280, light and dark, EN and PT.

## Open issues
- WebKit (iPhone 390) did not run: the sign-in click timed out in Playwright WebKit on localhost (`w.state_bad` in the app log), as in earlier sessions.
- Follow-up, not done: the `/admin` daily run page does not label the squads lines specially. They show as plain log lines.

## Next
- Model/effort: keep. The scope fit one session.
- What the owner must do first: merge. The release applies migrations `0040_squads` (three new tables and a widened check) and `0041_squad_retries` (one column). No environment change. The `tick.yml` change takes effect from `main`. On the first night, look at `/admin/runs/daily/[day]` for the `squads.batch` line, its `retried` and its `quota_remaining`.
- Later (owner, 2026-11-18): show `awaken` on the card once the server is about 120 days old. It is already stored on every squad row (`member_squads.heroes[].awaken`); only `lib/private/member-squads.ts` and `MemberSquads.tsx` need to show it.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Measured: 40 sequential `/v1/players` calls with 500 ms pacing took 20.6 s locally, so about 100 members fit one batch of 100 s at the tracker's cached speed. The 4-batch loop is headroom.
- A raven or arena read, if the maintainer allows it, should reuse `squad_reads`' batching and `squadsReserve`, not the tick.
- `getDailyRead` now also returns `quotaRemainingBefore`.
</adjustments>

PR: (added by the orchestrator)
