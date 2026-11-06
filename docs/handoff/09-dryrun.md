# 09 — Dry run against production

Status: done. Rehearsal event 8 passed on the cron path; the quota arithmetic reconciles exactly; no code changed.

## Built
- `docs/handoff/09-dryrun.md` (this file). No code, test or config change: nothing measured justified one (see Decisions).
- Production event 8 `REHEARSAL 2026-11-05T22:36:14.504Z` (`is_test`), snapshots 5 (before) and 6 (after), left in place as the baseline for the first Saturday.

## Decisions
- **No change to `maxDuration` (120 s), `RUN_DEADLINE_MS` (100 s), `CONCURRENCY` (4), the retry policy or `TIMEOUT_MS`.** Both runs took 9.6 to 10.0 s, 12 times under the limit, with 0 retries. The only time the limit was hit (2026-11-05 outage, D25) every read answered 504 after about 46 s; a larger `maxDuration` would not have turned those into data, and the 100 s deadline already closes such a run as partial. Raising concurrency would save about 5 s on a 10 s run; nothing needs those 5 s.
- **No change to the source order (§3.5).** The `/v1` roster kill sum for OGs equals the in-game number exactly; the board is 55,301 off (see Kills comparison).
- **No extra `/v1/quota` call.** "calls_used equals the drop in /v1/quota" is proven from the quota numbers the runs themselves received (each phase's quota check and the alliance responses), and across runs from the manual round that ran before them. A separate quota call after 00:00 UTC would have read a new day's counter and proved nothing.
- **Retry status codes:** the `v1.retry` log line carries `retry_n` but not the HTTP status. This run had 0 retries, so "retries by status code" is exactly 0 for every code. Adding the status to `v1.retry` is a follow-up (Open issues), not done: no retry happened, so no measured number calls for it.

## Deviations
- The playbook's Session 9 header says "Costs ~22 upstream calls". The rehearsal is two phases and cost 42 (21 + 21). The prompt's task (tap **Rehearse now**) is what was run.
- The owner read the in-game OGs numbers twice: at about 23:08 UTC (kills only) and at about 02:50 UTC on 2026-11-06 (kills and power), not right after the After run at 23:30. The 23:08 reading is the one compared exactly; the second is recorded for completeness. The time of the second reading is taken from the database clock when it was reported (`now()` = 02:53:49 UTC).
- Production tables were cleared by the owner after Session 8, so the 504 outage of 2026-11-05 (02:00–18:30 UTC) is no longer in `run_logs`. The "whole day" retry count covers the three snapshots that exist: 4 (manual round, 22:00 UTC), 5 and 6.

## Verified

**Verdict** (`/admin` "Last rehearsal", screenshot from the owner; the Discord admin message carries the same lines):

```
[rehearsal] Thu, 11/05/2026, 21:06 server time            ✓ Pass
Before snapshot: done (due Thu, 11/05/2026, 20:51 server time)
After snapshot: done (due Thu, 11/05/2026, 21:21 server time)
✓ both snapshots complete
✓ every alliance fresh in both (before 20/20, after 20/20)
✓ data time moved forward for every alliance (20/20)
✓ calls used = quota drop (before 21 = 21, after 21 = 21)
✓ each run under 120 s (before 10.0 s, after 9.6 s)
✓ started within 45 min of schedule (before +9 min, after +9 min)
```

**Runs** (`snapshots`, `run_logs`; Neon project `flat-dew-50243708`, branch `main`, read-only SQL through the Neon MCP):

| | Before (snapshot 5) | After (snapshot 6) |
|---|---|---|
| Due (UTC) | 22:51:14 | 23:21:14 |
| Started by the tick (UTC) | 23:00:20.227 (+9 min 06 s) | 23:30:15.334 (+9 min 01 s) |
| Wall-clock (`duration_ms`) | 10,048 ms | 9,638 ms |
| Status | complete | complete |
| `calls_used` | 21 (1 quota + 20 alliances) | 21 (1 quota + 20 alliances) |
| `quota_remaining_before` (quota check, counts itself) | 905 | 884 |
| `quota_remaining_after` | 885 | 864 |
| Quota drop (`before − after + 1`) | 21 | 21 |
| Quota check call | 548 ms | 503 ms |
| Alliance read, min / median / max | 1.20 / 1.57 / 2.42 s | 1.26 / 1.58 / 2.35 s |
| `cached: true` | 0 of 20 | 0 of 20 |
| `is_fresh = false` | 0 | 0 |
| `source = internal` | 0 | 0 |
| Retries (`v1.retry`) by status 502 / 503 / 504 | 0 / 0 / 0 | 0 / 0 / 0 |
| Non-200 final responses | 0 | 0 |
| warn/error log lines | 0 | 0 |
| Board `pulled_at` | 16:49:51 UTC (6 h 10 min old) | same board |

**Quota arithmetic, every call on 2026-11-05 from 22:00 UTC:**

| Step | remaining | Calls |
|---|---|---|
| Earlier rehearsal (Session 8, rows cleared) ended at | 927 | — |
| Manual round 7: quota check | 926 | 1 (927 − 926) |
| Manual round 7: end (`calls_used` 21) | 906 | 21 = 926 − 906 + 1 |
| Rehearsal before: quota check | 905 | 1 (906 − 905): no call between the runs |
| Rehearsal before: end (`calls_used` 21) | 885 | 21 = 905 − 885 + 1 |
| Rehearsal after: quota check | 884 | 1 (885 − 884): no call between the phases |
| Rehearsal after: end (`calls_used` 21) | 864 | 21 = 884 − 864 + 1 |
| **Rehearsal total** | 906 → 864 | **42 = 21 + 21** |

**Per alliance** (call seconds from the `v1.fetch` line's `duration_ms`; age = that line's time − `source_updated_at`; every row `source v1`, `cached false`, `is_fresh true`, HTTP 200; `member_count` = `members.length` in `raw_json` = stored member rows in both phases):

| Tag | union_id | Before s | Before age s | After s | After age s | member_count = members.length |
|---|---|---|---|---|---|---|
| NSE | 67109944 | 2.42 | 1.1 | 2.25 | 1.1 | 97 = 97 |
| PSY | 67110067 | 1.65 | 0.9 | 1.59 | 0.9 | 77 = 77 |
| IMPA | 67110079 | 1.37 | 0.9 | 1.38 | 0.9 | 88 = 88 |
| URSA | 67110320 | 2.21 | 1.1 | 2.10 | 1.1 | 95 = 95 |
| YAHO | 67110335 | 1.56 | 1.0 | 1.65 | 1.1 | 96 = 96 |
| CR8R | 67110415 | 1.20 | 0.7 | 1.26 | 0.8 | 75 = 75 / 76 = 76 |
| BOH | 67110465 | 1.48 | 0.8 | 1.44 | 0.8 | 71 = 71 |
| TmS | 67110584 | 2.39 | 1.1 | 2.35 | 1.1 | 99 = 99 |
| RDK | 67110927 | 1.57 | 1.1 | 1.74 | 1.1 | 94 = 94 |
| TRI | 67110958 | 1.55 | 1.0 | 1.55 | 1.1 | 99 = 99 |
| WACK | 67110992 | 1.67 | 1.1 | 1.70 | 1.2 | 100 = 100 |
| WOK | 67110999 | 1.41 | 0.9 | 1.43 | 1.0 | 96 = 96 |
| AFR | 67111040 | 1.35 | 0.8 | 1.32 | 0.8 | 76 = 76 |
| FGH | 67111128 | 1.36 | 0.7 | 1.41 | 0.7 | 67 = 67 |
| OGs | 67111155 | 2.22 | 1.2 | 2.22 | 1.1 | 100 = 100 |
| BRAV | 67111313 | 1.43 | 0.9 | 1.40 | 0.9 | 88 = 88 |
| HSR | 67111657 | 1.70 | 1.0 | 1.58 | 1.1 | 97 = 97 |
| NDA | 67112691 | 1.50 | 1.0 | 1.49 | 0.9 | 93 = 93 |
| TEST | 67116075 | 1.57 | 1.1 | 1.62 | 1.1 | 100 = 100 |
| FSPN | 67117338 | 1.77 | 1.1 | 1.73 | 1.2 | 99 = 99 |

CR8R grew from 75 to 76 members between the phases; both counts match their own `members` array.

The first batch of four concurrent reads in each run (NSE, URSA, TmS, OGs) took 2.1–2.4 s; the other 16 took 1.2–1.8 s. Manual round 7 shows the same split (1.25 / 1.58 / 2.24 s). The cause was not investigated; it costs about 0.7 s per run.

**Kills comparison (OGs, 67111155):**

| Source | total kills | Taken at (UTC) | − in-game at 23:08 |
|---|---|---|---|
| In-game alliance screen (owner) | **34,168,993** | ≈ 23:08 | — |
| `/v1` roster sum, before | 34,168,993 | 23:00:21 | **0** |
| `/v1` roster sum, after | 34,168,993 | 23:30:17 | **0** |
| Ranks board `kills` | 34,224,294 | board pulled 16:49:51 | +55,301 (+0.16 %) |
| In-game alliance screen (owner), second reading | 34,173,047 | ≈ 02:50 (Nov 6) | +4,054 (3 h 20 min of play after the after run) |

The roster sum is exact; the board is further off and, although 6 hours older, higher than the game. Kill counts only go up, so the most likely cause is a member with kills who left OGs between 16:49 and 23:00 (the board keeps the old total). §3.5 does not flip: `/v1` stays the primary, the board stays a cross-check.

Power at the second reading (in-game 4,054,665,044 at ≈ 02:50) is not comparable with the after run (`/v1` 4,038,640,282 at 23:30, board 3,998,380,856 at 16:49): power moves with every troop trained, and the readings are 3 h 20 min apart.

**Checks run:**
- SQL (read-only `select`s) on production; the queries are in this session's scratchpad and in the tables above.
- `pnpm vitest run lib/queries/players.test.ts lib/queries/upstream-status.test.ts` in the main checkout: 8 passed in 2.46 s, after the stop hook's full `pnpm check` timed out on both in `beforeAll` (10 s) under parallel load. No code changed in this session.
- `pnpm check` on this branch (`session/09-dryrun`, from `origin/dev` bfc1bc9): Prettier clean, ESLint and `tsc` clean, 35 test files passed, 1 skipped; 151 tests passed, 1 skipped; 6.81 s.

## Open issues
- **`v1.retry` has no status code.** `lib/collector.ts` `attemptHook` logs `{ union_id, retry_n }`; `lib/sources/v1.ts` `request` knows the status but `onAttempt` receives only the attempt number. On a Saturday with retries, "retries by status code" can only be read from final failures. Small follow-up: pass the previous status to `onAttempt` and log it; one test in `lib/sources/v1.test.ts`.
- **The tick ran 9 minutes after each due time.** Due times were 22:51 and 23:21; ticks ran at 23:00:20 and 23:30:15, i.e. cron-job.org fires on the quarter hour. Saturday's due times with the §7 defaults (10:00 and 14:00 server = 12:00 and 16:00 UTC) fall on a quarter hour, so the lag there should be seconds. A rehearsal's lag is up to 15 minutes by construction (created at a random minute + 15 / + 45).
- **Keep event 8:** `pruneRehearsals` keeps the newest `REHEARSAL_KEEP` rehearsals (default 4; the production value was not read in this session). Friday's automatic rehearsal (`REHEARSAL_AT`, 18:00 server) adds one. Event 8 is deleted only after `REHEARSAL_KEEP` newer rehearsals exist, or at once if `REHEARSAL_KEEP` is 1.
- **Timeouts in the full suite:** `lib/queries/players.test.ts` and `lib/queries/upstream-status.test.ts` time out in `beforeAll` (PGlite, 10 s) when 31 test files start together; they pass alone in 2.5 s. Already reported in handoff 08; a larger `hookTimeout` in `vitest.config` would fix it. Not changed.
- The board was 6 h 10 min old at both runs (`pulled_at` 16:49:51). It is a cross-check only, so this changes no number.

## Next
Session: 10 — README and runbook polish
Model / effort: keep (haiku, medium) — no signal; the session rewrites prose with numbers that now exist.
Owner must do first: merge this PR into `dev`; then release `v1.0.0` (Actions → **Prepare release** → `major`, which gives `v0.4.0` → `v1.0.0`; merge the PR with a merge commit; `release-publish` creates the tag) and rename the GitHub Release to "v1.0.0 — dry run reconciled" if `release-publish` used another title. Release before Friday 18:00 server (20:00 UTC), when the automatic rehearsal runs and `main` freezes (Phase 8).
Plan changes needed: §2 and §3.6 — "~2.3–2.6 s per read, ≈ 15 s per run" becomes "1.2–2.4 s, median 1.6 s; 9.6–10.0 s per run of 20 alliances" (measured 2026-11-05, 60 reads). §4 — a phase costs exactly 21 calls (1 quota + 20 alliances) with no retries; a rehearsal costs 42. SESSION_PLAYBOOK Session 9 header — "Costs ~22 upstream calls" should read 42.

<adjustments>
- Real numbers for the README (rehearsal of 2026-11-05, event 8): each snapshot takes about 10 seconds (9.6 s and 10.0 s), uses 21 API calls (1 quota check + 20 alliances), and a full rehearsal uses 42 of the 1,000 daily calls. A Saturday (before + after) uses 42 plus the Friday quota check.
- Each alliance read took 1.2 to 2.4 seconds (median 1.6 s). All 40 reads were fresh (data less than 2 seconds old); no retries, no errors.
- The scheduler (cron-job.org) ticks on the quarter hour: a phase starts at the first quarter hour after its due time. Saturday's 12:00 and 16:00 UTC are on a quarter hour.
- OGs total kills from the tracker equalled the in-game alliance screen exactly (34,168,993); the ranks board was 55,301 off. The README can say the kills come from the member list and match the game.
- Rehearsal event 8 is the baseline kept for the first Saturday (`is_test`, not on public pages).
- The `/admin` "Last rehearsal" block shows six checks with ✓ and a Pass/Fail seal; the README can quote them from Verified above.
</adjustments>
