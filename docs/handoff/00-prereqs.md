# 00 — Prerequisites

## Built
- `config/alliances.ts` — `SERVER = 325` and the 20 alliances from plan §7, each verified on `/v1` today; comments carry board power rank · board kills rank · `/v1` `rank.rank`.
- `fixtures/v1-ids/<union_id>.json` — 18 raw `/v1/alliances/{id}` responses (the §7 ids other than 67111155 and 67110320).
- `fixtures/README.md` — every fixture folder: what it is, when it was recorded, what it cost.
- `.env.example` — every variable in plan §7 and PREREQUISITES.md §4, names only.
- `.gitignore` — `.env*` (except `.env.example`), `.claude/worktrees/`, `.claude/settings.local.json`, `.DS_Store`.
- `CLAUDE.md` — the block from SESSION_PLAYBOOK.md §C, verbatim (lines 138–171, copied with `awk`).
- `IMPLEMENTATION_PLAN.md` §10 — "Answered — see docs/handoff/00-prereqs.md" under each question; nothing else changed.
- Untracked from git: `.env.local` (it was committed in `68c2370 first commit`) and `fixtures/.DS_Store`.

## Decisions
- Name/abbr checked against plan §7, not against a live board read: §7 was extracted from the board JSON (2026-11-03 16:35 UTC) and no board fixture exists. A fresh board read would have touched the internal API for no gain.
- Retried the one `502` once, as plan §2 prescribes for `502/503/504`.
- TRM (67110063) kept in the list although `/v1` now ranks it #31 (see Open issues). The list is the owner's config (§3.4); swapping it is the owner's call.
- `.env.example` also lists `APP_URL` and `ENABLE_EXPERIMENTAL_COREPACK` because PREREQUISITES §4 lists them, with a comment saying where each one lives.

## Deviations
- **API calls:** this session made 19 quota-counted calls (18 + one retry). But the owner had this session redo Session 0, which had already run once on branch `claude/dreamy-cori-r5ve6a` (commit `6b713d6`). That makes today's account total `used = 50`, over the playbook's "at most 20 documented-API calls today". The owner chose the redo knowing that.
- **Before those 19:** 18 calls with the key that was then in this worktree's `.env.local` (the one committed in `68c2370`) all returned `401 {"detail":"invalid_api_key"}`. The loop did not stop after the third failure as it should have. Whether 401s count against quota is unknown. The bodies were deleted, and the owner then replaced the key.
- **Time conversion:** the task asks for Saturday 11:00 and 13:00. Plan §7 defaults are `SNAPSHOT_BEFORE=10:00` and `SNAPSHOT_AFTER=14:00`, so both pairs are converted below.

## Verified

**Server offset (two clock readings, 2026-11-04):**
- Owner read in-game server time `17:37:02`; `date -u` immediately after the answer: `2026-11-04T19:37:11Z`.
- 19:37:11 − 17:37:02 = 2 h 00 min 09 s; the 9 s is reading/typing lag. **Server = UTC−2** (`SERVER_TZ=Etc/GMT+2`; the POSIX sign is inverted). This agrees with the plan's earlier reading (server 14:37:01 at 16:37:08 UTC).

**Saturday conversions (UTC = server + 2 h; next Saturday is 2026-11-07):**

| Server time (UTC−2) | + 2 h | UTC |
|---|---|---|
| 10:00 (`SNAPSHOT_BEFORE` default) | 10 + 2 | 12:00 |
| 11:00 | 11 + 2 | **13:00** |
| 12:00 (`EVENT_TIME`) | 12 + 2 | 14:00 |
| 13:00 | 13 + 2 | **15:00** |
| 14:00 (`SNAPSHOT_AFTER` default) | 14 + 2 | 16:00 |
| Fri 20:00 (`QUOTA_CHECK_AT`) | 20 + 2 | Fri 22:00 |

All Saturday times fall on the same UTC day, which the quota rule assumes (§4). An AFTER later than 22:00 server time would cross into the next UTC day.

**Owner interview:** both Discord webhooks (public and admin) exist. The maintainer was notified.

**§2 facts and their evidence:**

| Fact | Evidence |
|---|---|
| Auth by `Authorization: Bearer lap_…`; a bad key gives `401 {"detail":"invalid_api_key"}` | the 18 rejected calls this session (19:37:27–19:37:36 UTC, bodies not kept); `fixtures/v1-*` (200 with the key) |
| 1,000/UTC day, `patron: false`, `quota` in every body, `/v1/quota` counts | `fixtures/v1-20261104T154755Z/quota-before.json` (`used 1`) → `alliance-67111155.json` (`used 2`) → `alliance-67110320.json` (3) → `quota-after.json` (4); same pattern in `v1-20261104T155902Z/` (5 → 8) |
| A `502` also counts against quota | `fixtures/v1-ids/67109944.json` `used 32`, the 502 on 67110584 (body `error code: 502`, no quota object), then `67110992.json` `used 34`. The retry `67110584.json` is `used 50` |
| `User-Agent` required (Cloudflare 403 without it) | not re-tested this session (it would cost nothing but adds nothing); every call here sent `laptracker/1.0 (+https://github.com/daniro-san/LAPTracker)` |
| Flat alliance object with `union_id, sid, name, abbr, power, member_count, capacity, level, exp, rank{rank,score}, live, updated_at, cached, cache_seconds, declaration, bulletin, leader_name, members[]`; members carry `power` and `kills` | key list of `fixtures/v1-ids/67109944.json` (plus `badge_id, badge_url, gift_level, join, language, leader_id, server_badge_url, quota`) |
| `power == sum(members.power)`; `member_count == members.length` | true in all 22 `/v1` reads: the four in `fixtures/v1-*/alliance-*.json` and the 18 in `fixtures/v1-ids/` |
| Refresh-on-read | `v1-20261104T154755Z/alliance-67111155.json` `cached false, updated_at 15:47:58`; `v1-20261104T155902Z/alliance-67111155.json` `cached false, updated_at 15:59:04`. URSA: 15:48:00 → 15:59:07. Today all 18 `v1-ids` were `cached: false`, with `updated_at` 19:40:11–19:40:55 = the read time |
| Read that pulls ≈ 2.3–2.6 s | today: 1.46–2.53 s per call (median ≈ 1.9 s), 18 sequential reads in ~34 s |
| `rank.rank` = the game's power ranking on the server | OGs #2, URSA #4 (`fixtures/v1-*`); the 18 below |
| Internal refresh is closed: `POST` → 403 `Refresh only from the site`, `GET` → 405; status open with a per-alliance cooldown | `probe-67111155-20261104T153457Z/02-refresh.json`, `probe-67110320-20261104T153605Z/02-refresh.json`; `probe-67111155-20261104T153003Z/02-refresh.json` (405); `probe-67111155-…153457Z/03-status-*` (557 → 493 s) vs `probe-67110320-…/03-status-*` (0 s) |
| Internal alliance GET has two shapes | `probe-67111155-*/01-before.json` (`live: true`, `power`, `updated_at`) vs `probe-67110320-*/01-before.json` (`live: false`, `power`/`updated_at` null); unknown id → `probe-67110250-*/01-before.json` `alliance not found` |
| Internal GET returns the site's last pull, not a fresh one | OGs `updated_at` 15:01:28 in `probe-67111155-…153003Z/01-before.json`, 15:34:14 in `…153457Z/01-before.json` (it moved only because the page was opened) |

**The 18 resolutions** (`GET /v1/alliances/{id}`, 2026-11-04 19:40:10–19:40:56 UTC; all `sid 325`, all `cached: false`; name and abbr equal to §7 for all 18):

| union_id | abbr | name | HTTP | rank.rank | power | members | sum(kills) |
|---|---|---|---|---|---|---|---|
| 67109944 | NSE | Natural Selection | 200 | 1 | 4,352,946,009 | 98 | 60,940,385 |
| 67110584 | TmS | TheMightySpartans | 502, then 200 on retry | 3 | 3,878,732,881 | 98 | 33,327,382 |
| 67110992 | WACK | TheWackyOnes | 200 | 5 | 3,664,099,971 | 100 | 25,934,946 |
| 67110335 | YAHO | AGGRESSOR | 200 | 6 | 3,296,516,523 | 97 | 22,844,386 |
| 67117338 | FSPN | Slapsticks | 200 | 7 | 3,274,058,935 | 99 | 18,685,332 |
| 67110927 | RDK | Ritter-der-Kokusnuss | 200 | 9 | 3,041,083,234 | 94 | 8,715,388 |
| 67110958 | TRI | TRIUMPHANTS | 200 | 8 | 3,053,490,001 | 99 | 15,108,572 |
| 67116075 | TEST | Test-Tickles | 200 | 10 | 3,016,564,138 | 100 | 19,400,306 |
| 67111657 | HSR | Harmonie San. & Reha | 200 | 11 | 2,925,183,201 | 97 | 15,655,578 |
| 67110067 | PSY | Psycho Killers | 200 | 13 | 2,532,314,037 | 77 | 6,171,497 |
| 67110079 | IMPA | IMPERIUM AETERNUM | 200 | 12 | 2,644,694,769 | 88 | 17,369,904 |
| 67111313 | BRAV | ꧁Black Raven꧂ | 200 | 15 | 2,382,558,946 | 88 | 7,818,159 |
| 67112691 | NDA | NoDiscord | 200 | 14 | 2,466,411,915 | 89 | 9,350,119 |
| 67110465 | BOH | BladesOfHonor | 200 | 16 | 2,128,418,080 | 70 | 2,143,647 |
| 67110415 | CR8R | BCR8RNU | 200 | 17 | 1,997,884,004 | 73 | 6,266,788 |
| 67110999 | WOK | Wolfskinder | 200 | 18 | 1,532,956,286 | 96 | 2,319,795 |
| 67110063 | TRM | Thermopylae | 200 | **31** | 771,188,573 | 47 | 788,338 |
| 67110811 | 404 | Берсерк | 200 | 21 | 1,214,121,304 | 89 | 1,554,624 |

Failures: 0 after one retry (the limit was 2).

## Open issues
- **The API key was committed to a public repo.** `origin/main` (`68c2370 first commit`, `daniro-san/LAPTracker`, public) contains `.env.local` with a `lap_` key. That key now returns 401, so it looks revoked. It stays in git history until `main` is rewritten; whether to do that is the owner's call. This branch untracks the file and ignores `.env*`. Turn on GitHub secret scanning and push protection (PREREQUISITES §1).
- **Two Session 0 results exist.** `origin/claude/dreamy-cori-r5ve6a` (`6b713d6`) is an earlier Session 0 run, and Session 1 was already built on it (`origin/claude/trusting-albattani-4s5ca3`). This branch is a second, independent run from `main`. The owner must pick which one `main` gets before Session 1's work is merged; the two will conflict on the same files.
- **TRM (67110063)** is `rank.rank` 31 with 47 members and 0.77 B power. §7 lists it as board #19. Either it lost members after the board pull of 2026-11-03 16:35 UTC, or it is shedding them now. The `/v1` top 20 now has other alliances in it (whoever holds #19 and #20; not looked up, to save quota). Swap or keep: the owner's call.
- Board order and `/v1` order differ in three adjacent pairs (RDK/TRI, PSY/IMPA, BRAV/NDA). They are a day apart and come from different counters, which is expected.
- This machine runs Node `v24.20.0`; PREREQUISITES §2 expects 26.x before Session 1. (`config/alliances.ts` loads under it: 20 entries, 20 unique ids, `SERVER 325`.)
- A `502` costs quota. The §4 retry allowance (≤ 10) already covers that; the collector's `calls_used` should count failed calls too.

## Next
Session: 1 — Scaffold + agentic harness
Model / effort: keep — no signal; nothing in Session 0 changes the scaffold's difficulty.
Owner must do first: pick which Session 0 branch becomes `main` (this one or `claude/dreamy-cori-r5ve6a`); confirm the leaked key is revoked and decide about rewriting history; enable secret scanning and push protection on the repo; decide TRM.
Plan changes needed: §7 — the TRM comment and rank (`/v1` #31, not #19), and whether to swap it. Phase 0 / the Session 0 prompt — conversion times (11:00/13:00 in the prompt, 10:00/14:00 in §7 defaults); make them one pair. §4 — note that a `502` counts against quota.

<adjustments>
- `.gitignore` exists with `.env*`, `!.env.example`, `.claude/worktrees/`, `.claude/settings.local.json`, `.DS_Store`. Extend it (node_modules, .next, …); don't replace it.
- `.env.example` already lists every variable, including `APP_URL` and `ENABLE_EXPERIMENTAL_COREPACK`. `lib/env.ts` validates the app's variables; `APP_URL` is only used by GitHub Actions, and `ENABLE_EXPERIMENTAL_COREPACK` only by the Vercel build, so neither belongs in `lib/env.ts`.
- `config/alliances.ts` exports `SERVER`, `TrackedAlliance`, `ALLIANCES` (`as const satisfies readonly TrackedAlliance[]`). Keep the file untouched.
- Fixtures for parser tests: 22 `/v1` alliance bodies (`fixtures/v1-*/alliance-*.json`, `fixtures/v1-ids/*.json`). Non-ASCII names for rendering tests: 67111313 (꧁Black Raven꧂), 67110811 (Берсерк, tag `404`).
- Measured `/v1` read time: 1.46–2.53 s, median ≈ 1.9 s (plan says ~2.4 s).
</adjustments>
