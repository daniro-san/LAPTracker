# 02 — Source adapters

## Built

- `lib/sources/types.ts`: `AllianceSnapshotInput`, `MemberInput`, `Quota`, `RanksBoard`, `V1Source`, `InternalSource`, plus the error classes `QuotaExhaustedError`, `NotFoundError`, `NotLiveError`, `SchemaError` (`code` + `paths`) and `UpstreamError` (`status`).
- `lib/sources/shared.ts`: `USER_AGENT`, `TIMEOUT_MS = 30_000`, the zod roster fields both APIs share, `toSnapshotInput`, and `readBody`, which parses a body into `{ data, raw }` or throws `SchemaError` with issue paths only.
- `lib/sources/v1.ts`: `fetchAlliance(id)` and `fetchQuota()`. Every request sends `Authorization: Bearer`, `User-Agent` and `Accept`, with a 30 s timeout and at most 4 requests in flight per process. Responses branch on `response.status` only:
  - 429 → `QuotaExhaustedError`, not retried.
  - 404 → `NotFoundError`.
  - 502/503/504 → up to 3 retries after 1/2/4 s + 0–250 ms jitter, or after `Retry-After` (clamped to 30 s).
  - Any other status → `UpstreamError`.
- `lib/sources/internal.ts`: `fetchRanks(server)` and `fetchAlliance(id)` (`live: true` only; `NotLiveError` on the stub). GET only, `User-Agent` only. The header comment says the refresh endpoint is closed on purpose and that this file never gets a refresh path.
- `lib/sources/index.ts`: `export const v1: V1Source`, `internal: InternalSource`.
- `lib/compute.ts`: `sumKills(members)`, null counted as 0.
- `lib/env.ts`: `LAP_API_BASE_URL` / `LAP_SITE_BASE_URL` with the plan §7 defaults (the only upstream host literals in `lib/` and `app/`), and `getSourceEnv()` (key + base URLs only). `.env.example` lists both under `# Upstream`.
- Tests:
  - `lib/sources/v1.test.ts` (13)
  - `lib/sources/internal.test.ts` (7)
  - `lib/sources/no-upstream-literals.test.ts` (2)
  - `lib/sources/v1.live.test.ts` (opt-in, 1)
  - `lib/sources/test-helpers.ts`
  - one assertion added in `lib/env.test.ts`
- Fixtures:
  - `fixtures/ranks-325-20261104T201831Z/ranks.json` (internal ranks board, 0 quota)
  - `fixtures/v1-ids/67111128.json` (FGH, from the smoke call)
  - two rows in `fixtures/README.md`
- `config/alliances.ts`: comments only. FGH changed from "unverified" to `v1 #20`, and the header notes how FGH was verified.
- `docs/DECISIONS.md` D15 (null kills/power) and D16 (adapter details); `docs/ARCHITECTURE.md` Deps types updated to the shipped ones.

## Decisions

- **Null `kills`/`power`** stays null on the member row and sums as 0 (D15). AFR has 1 such member and FGH has 2.
- **Smoke call target** (owner's choice in planning): `fetchAlliance(67111128)`, not `/v1/quota`. One call both proves the client and verifies FGH. The test wraps `fetch` and refuses a second request, so a 502 cannot turn into 4 calls through retries.
- **FGH fixture** = `JSON.stringify` of the parsed body the smoke test saved to the scratchpad (`LAP_SMOKE_OUT`). Recording it through the skill would have cost 2 more calls (quota before and after). Round-tripping was byte-identical for all 23 earlier `/v1` bodies (measured; the internal probe bodies are not, because of whitespace). The test only writes to the path it is given; I copied the file into `fixtures/`.
- **Ranks fixture recorded** (owner's choice): one `GET /api/servers/catalog/325/ranks` with `User-Agent` only.
- **`getSourceEnv()`** instead of `getEnv()` in the adapters: the smoke test runs with only `LAP_API_KEY` in the environment. Full validation at boot is unchanged.
- **Output type** adds `totalKills` and `quota` (null for internal) to the plan's shape. `Quota` also carries `used`. `cached` is null for internal.
- **Retry-After clamp at 30 s; timeouts and other statuses are not retried; the internal adapter never retries** (D16).
- **`RanksBoard.pulledAt`** = the older of the two alliance boards' `pulled_at`.
- `lib/sources/shared.ts` and `lib/sources/test-helpers.ts` are not in §11.1. Both adapters read the same roster fields, so one zod schema serves them instead of two copies.

## Deviations

- **Branch:** `claude/vibrant-carson-wmbxlt`, not `session/02-sources`. The cloud harness assigns the branch and allows pushes only there.
- **Smoke test** reads one alliance instead of calling `/v1/quota`, as plan §11.3 says (owner's choice, see Decisions). The cost is the same: 1 call.
- **No changes were needed** for the three Session 1 leftovers in the adjustments. They were already on main when this branch started (`3b2ee6d`):
  - `.claude/settings.json` already allows `git push -u origin HEAD` and `gh pr *`; `git push origin main` sits in **deny** and stays there.
  - `CLAUDE.md` equals playbook §C (only the code fences differ).
  - `.github/PULL_REQUEST_TEMPLATE.md` has What / Verified / Handoff.
- **The TRM → AFR / 404 → FGH swap** was also already in `config/alliances.ts`. Only the FGH comment changed.
- **The plan's literal-grep rule applies to test files too**, so `lib/env.test.ts` asserts the defaults' URL paths (`/v1`, `/api`) instead of the full URLs.

## Verified

Node: the container started on v22.23.4. `bash scripts/cloud-setup.sh` (exit 0) installed Node v26.13.0, pnpm 12.16.1 and gitleaks v8.30.1. Every command ran with `PATH=/opt/node26/bin:$PATH`.

`pnpm check` (6.5 s wall):

```
$ prettier --check . && eslint . && tsc --noEmit && vitest run
All matched files use Prettier code style!
 Test Files  8 passed | 1 skipped (9)
      Tests  31 passed | 1 skipped (32)
```

Offline: every unit test stubs `fetch` and points the base URLs at `https://v1.test/v1` and `https://site.test/api`, so no request can reach the upstream. The parse test covers 24 `/v1` bodies, the 23 earlier ones plus FGH.

**Mutation check.** I applied each mutant to the source, ran `vitest run lib/sources`, and restored the file. Each mutant was killed (≥ 1 failing test) unless noted:

| Mutant | Failing tests |
|---|---|
| `fetchAlliance` throws (empty implementation) | 13 |
| internal `fetchAlliance` throws | 5 |
| `MAX_RETRIES` 0 | 4 |
| `MAX_RETRIES` 4 | 1 |
| 429 not mapped | 1 |
| 404 not mapped (v1) | 1 |
| 404 not mapped (internal) | 1 |
| no User-Agent | 1 |
| no Authorization | 1 |
| concurrency 10 | 1 |
| `Retry-After` ignored | 1 |
| `statusText === "OK"` treated as success | 1 |
| quota zeroed | 1 |
| `sumKills` returns 0 | 3 |
| `cached` dropped | 1 |
| `nick_name` optional in schema | 1 |
| stub accepted | 1 |
| ranks maps swapped | 1 |
| `pulledAt` = newer board | 1 |
| `Origin` header on internal | 2 |
| a `refresh` POST function added to internal.ts | 1 |
| host literal in v1.ts | 1 |
| base URL ignored | 2 |
| 429 added to the retry set | **survived** — equivalent mutant: the 429 check runs before the retry check, so the entry is unreachable |

**Live smoke test, run once** (2026-11-04 20:23:27–20:23:31 UTC, a Wednesday):

```
$ LAP_LIVE_TEST=1 LAP_SMOKE_OUT=<scratchpad>/fgh.json pnpm exec vitest run lib/sources/v1.live.test.ts
      Tests  1 passed (1)
```

- Response: 200; FGH / MegaDeath, `sid` 325, `rank.rank` **20**, 67 members (`member_count` 67), `power` 1,258,013,704 = `sum(members.power)`, `sum(kills)` 1,082,174, 2 members with `kills: null`, `cached: false`, `updated_at` 20:23:30 UTC (the read time).
- **Quota:** before `used` 57 / `remaining` 943 (the last row in fixtures/README.md, Session 1); after `used` 58 / `remaining` 942. **Exactly 1 call.** Account total today: 58.
- The saved body contains no `lap_`.

**Ranks board** (`GET …/servers/catalog/325/ranks`, 20:18:31 UTC, 0 quota): 200 in 1.23 s, 127,405 bytes, `cached: true, stale: false`. `alliance_power` has 98 rows and `alliance_kills` 97, both `pulled_at` 16:41:48 UTC (3.6 h old at read time). `score` is a digit string. OGs: power 3,934,102,584, kills 34,213,081.

**Read-only grep:** `grep -n -i 'refresh\|POST\|Origin\|Referer\|cookie' lib/sources/internal.ts` matches lines 3–5 only (the header comment).

gitleaks (lefthook pre-commit) passed on all three commits.

## Open issues

- **The collector cannot count retries yet.** `v1.fetchAlliance` retries internally, but `MAX_UPSTREAM_CALLS = 120` must count every attempt (.claude/rules/collector.md), and `run_logs` wants `v1.retry` lines. Nothing in the adapter reports attempts today. Session 3 has to add a way to report them (for example an optional `onAttempt(status)` callback, or a returned attempt count).
- **The concurrency cap is module-level**, so it is shared by everything in one serverless instance. That is correct for one run per instance; two parallel runs in one instance would share the 4 slots.
- **The internal 404 status is assumed.** The probe kept only the body (`{"detail":"alliance not found"}`), not the status code. If the site answers 200 with that body, `fetchAlliance` throws `SchemaError` (`internal.schema`), not `NotFoundError`.
- **The board and the roster disagree, as expected** (§2b): OGs board kills 34.2 M vs `/v1` roster sums ~25 M. Board numbers stay out of deltas.
- **Session 3 should use the board's per-board times.** `alliance_power` and `alliance_kills` each carry their own `pulled_at`, ~10 ms apart; only the older one is kept.
- **Plan text that is now stale** (not edited, per CLAUDE.md):
  - §7's FGH comment: "v1 unverified … Session 2's smoke call verifies it". It is now v1 #20.
  - §11.3: "Live smoke — one `/v1/quota` call". It is now one alliance read.
  - Phase 2's `AllianceSnapshotInput` lacks `totalKills`, `quota`, `serverRank` and `level`.
- The two moderate audit findings from Session 1 are unchanged. GitHub secret scanning and push protection are still the owner's to switch on.

## Next

Session: 3 — Schema, collector, freshness
Model / effort: keep (opus · high). The adapters took no more judgment than the prompt expected: the 13 + 7 + 2 tests and every listed behaviour landed without redesign. Session 3 carries the freshness guarantee and the call counter.
Owner must do first:

- Merge this PR into main.
- Nothing else is blocking. Session 3 makes no live calls.

Plan changes needed:

- §7: the FGH comment → `v1 #20 (verified 2026-11-04 20:23 UTC)`.
- §11.3: the live smoke row → "one `/v1/alliances/{id}` read (FGH), opt-in `LAP_LIVE_TEST=1`, 1 call".
- Phase 2: add `totalKills`, `quota`, `serverRank`, `level` to `AllianceSnapshotInput` (as in docs/ARCHITECTURE.md).
- No change needed to SESSION_PLAYBOOK.md's Session 3 prompt beyond the adjustments below.

<adjustments>
- Sources are done: `import { v1, internal } from "@/lib/sources"` (types in `lib/sources/types.ts`; errors `QuotaExhaustedError`, `NotFoundError`, `NotLiveError`, `SchemaError{code,paths}`, `UpstreamError{status}`; match with `instanceof`). `Deps.v1: V1Source`, `Deps.internal: InternalSource`.
- `sumKills` already exists in lib/compute.ts (null → 0, D15). Reuse it, add the rest of compute around it, and give it its fast-check property test there.
- `AllianceSnapshotInput` already carries `totalKills`, `serverRank`, `level`, `sourceUpdatedAt: Date | null`, `cached: boolean | null` and `quota: Quota | null` (`{ limit, used, remaining }`, from that `/v1` response; null for internal). Read `remaining` from each alliance response instead of making extra quota calls. `MemberInput.power` and `.kills` are `number | null`.
- v1 retries happen inside `fetchAlliance`/`fetchQuota` (up to 4 attempts) and are invisible to the caller today. MAX_UPSTREAM_CALLS has to count them, so the collector needs an attempt hook from the adapter (e.g. an optional `onAttempt` argument). Design it in Session 3, with its test; it is the one change to lib/sources it needs.
- Concurrency 4 is already enforced inside v1.ts (a module-level cap). The collector may simply `Promise.all` over the alliances, or keep its own limit of 4; either way no more than 4 requests are in flight.
- The internal adapter never retries. Per §3.5, the fallback is one `internal.fetchAlliance` after v1's final failure. `NotLiveError` means a row with an error; `SchemaError.code` is the `run_logs` code (`v1.schema` / `internal.schema`).
- `RanksBoard.pulledAt` is the older of the two boards' `pulled_at`. Measured: the board was 3.6 h old at 20:18 UTC and has 98 power rows and 97 kills rows.
- Real numbers: a `/v1` read that pulled took ~3 s in the smoke test (20:23:27 → 20:23:31, including vitest startup); 00-prereqs measured 1.46–2.53 s. The quota account stood at `used` 58 on 2026-11-04.
- Mocked-fetch test pattern to reuse: `lib/sources/test-helpers.ts` (`mockFetch`, `respond`, `readFixture`, `v1AllianceFixtures`, `stubSourceEnv`). Collector tests should mock `Deps.v1`/`Deps.internal` directly, not fetch.
- Fixtures for collector tests: 24 `/v1` alliance bodies, now including `fixtures/v1-ids/67111128.json` (FGH, 2 null kills), and the ranks board at `fixtures/ranks-325-20261104T201831Z/ranks.json`.
- Node in this cloud container started at v22 again; `bash scripts/cloud-setup.sh` fixes it (≈1 min). Run `node -v` first.
</adjustments>

<adjustments for="Session 9">
- FGH (67111128) is verified on `/v1` (200, rank #20, 2026-11-04 20:23 UTC). The dry run no longer has to prove it. A 502 there is an upstream blip, not a bad id.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/3
