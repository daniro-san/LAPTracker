# 03 — Schema, collector, freshness

## Built

- `lib/schema.ts`: `events`, `snapshots`, `alliance_snapshots` and `member_snapshots` from plan §6, with:
  - CHECKs on `phase`, `status` and `source`;
  - unique `(event_id, phase)`, `(snapshot_id, union_id)` and `(alliance_snapshot_id, uid)`;
  - index `member_snapshots(uid)`;
  - three FKs.
- `drizzle.config.ts`, `pnpm db:generate`, and the migration `drizzle/0000_flippant_slapstick.sql` (4 tables, 1 index, 3 FKs). `drizzle/` is in `.prettierignore`, because it is generated.
- `lib/db.ts`: `openDb(url = getEnv().DATABASE_URL)` → `{ db, close }`. It uses a Neon `Pool` (WebSocket) with `drizzle-orm/neon-serverless`, so writes can use transactions.
- `lib/repo/`:
  - `index.ts`: the `Repo` interface, its row types and `createRepo(db)`.
  - `events.ts`, `snapshots.ts`, `alliance-snapshots.ts`: Drizzle functions, one module per table.
  - `memory.ts`: an in-memory Repo with the same semantics, used by the tests and `snapshot:dry`.
- `lib/compute.ts`: `sumPower`, `isFresh`, `delta`, `rosterDiff`, `nameHistory` and `seriesDeltas`, next to the existing `sumKills`.
- `lib/collector.ts`:
  - `runSnapshot(eventId, phase, deps, { force })` → `RunSummary`;
  - `RunRefusedError` (`reason`: `complete` | `running` | `no-event`);
  - `Deps = { v1, internal, repo, logger, now }`;
  - `MAX_UPSTREAM_CALLS = 120`, `FRESH_MAX_AGE_MS = 20 min`, `RUN_STALE_AFTER_MS = 10 min`, concurrency 4.
- `lib/logger.ts`: the `Logger` interface and `consoleLogger`.
- `lib/sources`: the `onAttempt` hook. `V1Source.fetchAlliance(id, onAttempt?)` and `fetchQuota(onAttempt?)` call it before every attempt, retries included. When it throws, that attempt is not sent.
- `scripts/snapshot-dry.ts` and `pnpm snapshot:dry --phase before|after`.
- Tests:
  - `lib/compute.test.ts` (5 properties);
  - `lib/freshness.test.ts` (4);
  - `lib/collector.test.ts` (7);
  - 1 added in `lib/sources/v1.test.ts`;
  - `lib/collector.test-helpers.ts` (fakes).
- Docs:
  - `docs/DECISIONS.md` D17 (tsx) and D18 (collector details);
  - `docs/ARCHITECTURE.md`: the Deps block as shipped, including `OnAttempt`, `Repo`, and notify not yet in Deps.
- `tsx` 4.23.15 devDependency (D17).

### Freshness tests (`lib/freshness.test.ts`, written and run red before `lib/collector.ts` existed, committed in `97f9666`)

1. `records a row older than 20 minutes as is_fresh=false and makes the snapshot partial`: one roster 20 min + 1 ms old is stale, one exactly 20 min old is fresh, and the status is `partial`.
2. `never yields a delta for a stale row`: BEFORE runs all fresh. In AFTER, one alliance returns the BEFORE roster unchanged. `delta()` is null for that alliance only, and AFTER is `partial`.
3. `re-runs a snapshot left running for more than 10 minutes without force, and refuses one started less than 10 minutes ago`:
   - a repo failure leaves the snapshot `running`;
   - at +9 min the run is refused with `RunRefusedError('running')`;
   - at +10 min + 1 ms it runs and completes.
4. `re-runs fetch only alliances with no row`: the first run stops on a 429 at the 6th call. The second run's `/v1` calls are exactly the missing ids, and it completes with 20 rows.

Red run before the collector: `Failed Tests 4`, `TypeError: runSnapshot is not a function`.

## Decisions

- Error rows store nulls, not zeros (owner's choice). §6 columns made nullable:
  - `alliance_snapshots.tag`, `name`, `member_count`, `total_power`, `total_kills`, `raw_json`;
  - `member_snapshots.power` and `kills` (D15).

  `delta()` returns null when a total is null or `is_fresh` is false.
- **Collector tests use the in-memory Repo** (owner's choice). The Drizzle repo was checked by hand against a local Postgres (see Verified).
- **Claim before quota.** `findSnapshot` decides; `startSnapshot` is a compare-and-set that a race cannot win twice. Session 4's 409 lock can reuse it. Details in D18.
- **`force`** deletes the snapshot's rows and collects everything again. A plain re-run fetches only alliances with no row.
- **The call counter** is `attemptHook` in `lib/collector.ts`, the only place `run.calls` is incremented. It counts `/v1` attempts only (the quota check, reads and retries), so `calls_used` matches `/v1` `used`. Internal calls cost no quota and are not counted.
- **Status rules:**
  - `failed` when the cap was hit (plan "Logging guarantees") or no row holds data;
  - `complete` when every alliance has a fresh row without error;
  - otherwise `partial`, which covers a 429 mid-run (plan §4, task).
- **The collector has its own pool of 4 workers**, on top of v1.ts's module cap. With it, a 429 or the cap stops new fetches; a plain `Promise.all` would already have started all 20.
- **`raw_json`** drops `badge_url`, `server_badge_url`, `bulletin`, `declaration`, `quota`, and the members' `avatar_url` and `frame_url` (§6). The blocked roster keys (`x`, `y`, …) stay in raw_json, as CLAUDE.md says.
- **Notify** is not in `Deps` this session (no notifications). `runSnapshot` returns `RunSummary` with `stale` and `failed` lists of `{ unionId, tag }` for Session 4 to pass on.
- **`snapshot:dry`** runs the real adapters, with `fetch` stubbed to serve `fixtures/` and `updated_at` rewritten to 30 s ago. It uses the memory repo, so nothing is written anywhere. Base URLs point at `*.invalid`, and the key is a placeholder.

## Deviations

- Plan §6 says `NOT NULL` for the columns listed under Decisions; they are nullable.
- Plan §11.3 calls the collector integration test "real local Postgres, every commit". The committed tests use the in-memory Repo, CI has no Postgres, and the Neon driver cannot reach plain Postgres without a WebSocket proxy. The Drizzle repo was verified once by hand instead.
- The Phase 3 pseudocode inserts the snapshot after the quota check; this code claims it first (D18).
- **Branch:** commits are on the worktree branch `claude/session-3-schema-compute-collector-534db3`, pushed as `session/03-collector`. The branch started from `main` (Session 2 was merged there, see #5), so `origin/dev` was merged in (`2d50f16`) for the PR to target `dev`. Conflicts came only from the squashed history: dev's `lib/` and the docs touched here were identical to main's, so this branch's side was kept. The merge brings dev's plan, prereqs and playbook edits (#6, #7).
- **PR not opened from the session:** `gh` on this Mac is logged in as `danilosilvackl`, which has `pull` only on `daniro-san/LAPTracker` (`createPullRequest` → "must be a collaborator"). The owner opens it from the pushed branch.
- **`lib/compute.ts` was rewritten once in this session.** A mutation check restored it with `git checkout`, which reverted it to the committed Session 2 version. I wrote the same content again and re-ran its tests. Later mutation checks restore from a scratch copy.

## Verified

Node `v26.13.0` (nvm; this Mac's default is v24.20.0, so every command ran with the v26 bin first on PATH). pnpm 12.16.1.

`pnpm check`, 2.55 s wall:

```
All matched files use Prettier code style!
 Test Files  11 passed | 1 skipped (12)
      Tests  48 passed | 1 skipped (49)
```

The skipped test is the opt-in live smoke test. No live API calls were made this session (0 quota).

`pnpm db:generate` produced `drizzle/0000_flippant_slapstick.sql`:

```
alliance_snapshots 18 columns 0 indexes 1 fks
events 6 columns 0 indexes 0 fks
member_snapshots 7 columns 1 indexes 1 fks
snapshots 11 columns 0 indexes 1 fks
```

`pnpm snapshot:dry --phase before`, 0.75 s wall:

```
summary { snapshotId: 1, phase: 'before', status: 'complete', callsUsed: 21,
  quotaRemainingAfter: 942, durationMs: 31, error: null, stale: [], failed: [] }
NSE  v1 fresh 98  4352946009 60940385
…    (20 rows, all v1, all fresh)
FGH  v1 fresh 67  1258013704 1082174
```

- `--phase after` also completes.
- 942 is the lowest `remaining` in the fixture bodies (FGH's).
- NSE's numbers match the 00-prereqs table.

**Drizzle repo against real Postgres 18 (hand check, not committed).**
- Setup:
  1. `initdb` a throwaway cluster in the scratchpad on `127.0.0.1:54329` (TCP only);
  2. `psql -f drizzle/0000_flippant_slapstick.sql` → `CREATE TABLE ×4, ALTER TABLE ×3, CREATE INDEX ×1`;
  3. `pnpm add -D pg`, temporarily;
  4. a tsx script runs `createRepo()` over `drizzle-orm/node-postgres`, cast to `Db`.
- Results (18/18 ok):
  - the claim inserts, and a second insert-claim loses;
  - a compare-and-set with a stale expected row fails, and with the current row succeeds;
  - `runSnapshot` with fakes over the real repo: 20 alliance rows, 57 member rows;
  - the error row has `total_power` null and its error line;
  - null member kills are stored as null;
  - `alliance_ids` is copied onto the event;
  - a plain re-run fetches nothing (the error row counts as a row) and adds 1 call (21 → 22);
  - `force` re-collects all 20: 60 members, `calls_used` 43;
  - a complete snapshot is refused without `force`.
- Teardown: the script was deleted, package.json and pnpm-lock.yaml restored from copies, `pnpm install --frozen-lockfile` run, and the cluster stopped.

**Mutation checks.** Each mutant was applied, the tests run, and the file restored from a scratch copy. Every mutant was killed:

| Mutant | Failing tests |
|---|---|
| `delta` ignores `isFresh` | `is null whenever either side is stale` |
| `seriesDeltas` diff off by one | `sums consecutive deltas to last − first …` |
| `nameHistory` overwrites `firstSeen` | `never drops a pair and keeps first-seen order` |
| cap check `>` instead of `>=` | `aborts at MAX_UPSTREAM_CALLS …` |
| `FRESH_MAX_AGE_MS` 30 min | freshness test 1 |
| status ignores `isFresh` | freshness 1, freshness 2, `marks the snapshot partial and names the alliance …` |
| re-run fetches every id | freshness test 4 |
| 10-min run lock ignored | freshness test 3 |
| AFTER reads the config | `aborts at MAX_UPSTREAM_CALLS …` (its 150 ids live only on the event) |

The call counter is incremented in exactly one place: `grep -n "run.calls++" lib/collector.ts` → one line, inside `attemptHook`.

gitleaks 8.30.1 (Homebrew, already installed; `/opt/homebrew/bin` was missing from this shell's PATH) passed on all commits.

## Open issues

- **An error row or a stale row is never re-fetched by a plain re-run.** The plan rule is "a re-run fetches only alliances without a row", and the hand check confirms it. To retry FGH after a 502 plus a stub fallback, the owner has to `force`, which re-collects all 20 (21 calls). If error rows should be retried without `force`, the rule has to change (plan Phase 3 / §4): owner's call.
- **No per-call `v1.fetch` log line yet.** The plan wants one run_logs line per upstream call (`endpoint`, `http_status`, `cached`, `duration_ms`, `quota_remaining`). The collector logs only:
  - `snapshot.start`, `quota`, `board.failed`;
  - `v1.retry` (from the hook), `internal.fallback`, `stale`;
  - `abort`, `snapshot.finish`.

  The adapter does not expose HTTP status or duration on success. Session 4 should add the line, measuring with `deps.now` around the call.
- **When `runSnapshot` throws**, its call count is lost with it. The snapshot stays `running`, and `calls_used` stays at the earlier value. Session 4's `finally` cannot know how many calls the failed run spent.
- **When one worker throws**, the others stop taking new ids, but in-flight fetches still finish and may write their rows after `runSnapshot` has rejected.
- **CI does not test the Drizzle repo.** Session 4's rate-limiter test needs a real DB as well (see Next).
- **`events.alliance_ids` is `NOT NULL` with no default.** Whoever creates an event (Session 4's tick) passes `allianceIds: []`; the BEFORE run fills it.
- **`member_snapshots` and `alliance_snapshots` FKs have no `on delete cascade`** (§6 says none). `clearAllianceRows` deletes members first, in one transaction.
- **Local Postgres on macOS:** `initdb` needs `LANG=en_US.UTF-8`, and the scratchpad path is too long for a Unix socket (max 103 bytes), so use `-k ''` and `listen_addresses=127.0.0.1`.
- Still open from 02: the two moderate audit findings, and GitHub secret scanning and push protection (the owner's to switch on).

## Next

Session: 4 — Routes, logger, notifications
Model / effort: raise one (opus · medium → high). Session 4 has 10 named tests, and one ("rate limiter … state read back from the DB, a fresh module import must still see the count") needs a DB-backed test path that does not exist. CI has no Postgres, and the Neon Pool cannot reach a plain Postgres without a WebSocket proxy. That is a design choice before any route is written.

Owner must do first:

- Merge this PR.
- Decide how Session 4 tests against a real DB. Options:
  - (a) `pg` as a devDependency, plus a Postgres service in `ci.yml`, with tests using `drizzle-orm/node-postgres` cast to `Db` (this worked by hand here);
  - (b) a Neon test branch (network in CI, a secret);
  - (c) keep the in-memory repo and drop "read back from the DB".
- Decide whether a plain re-run should retry error and stale rows (Open issues).

Plan changes needed:

- §6: mark the nullable columns as shipped (`alliance_snapshots` tag/name/member_count/total_power/total_kills/raw_json for error rows; `member_snapshots` power/kills for D15).
- §11.3: the integration tier is the in-memory Repo until a DB-backed path exists; say which one Session 4 picks.
- Phase 3: the claim comes before the quota call, and `force` clears the rows (D18).
- "Logging guarantees" vs §4: an abort at `MAX_UPSTREAM_CALLS` is `failed`, while a 429 mid-run is `partial`. The two sections say different things; the code follows each where it is the more specific.

<adjustments>
- `lib/logger.ts` exports `Logger` (`info|warn|error(code, data?) => Promise<void>`), `LogData` and `consoleLogger`. Implement the run_logs logger behind the same interface. The collector emits `snapshot.start`, `quota`, `board.failed`, `v1.retry`, `internal.fallback`, `stale`, `abort` and `snapshot.finish`, with snake_case data keys (`union_id`, `retry_n`, `calls_used`, …), and never names. `v1.fetch` per call is still missing; add it in the collector, not the adapter.
- `run_logs`, `auth_attempts` and `app_errors` are not in `lib/schema.ts`. Add them there and run `pnpm db:generate`, which writes `drizzle/0001_*.sql`. drizzle-kit 0.31.11 works with install scripts denied.
- The run lock already exists:
  - `runSnapshot` throws `RunRefusedError` with `reason` `'running'` (a run younger than 10 min, or a lost compare-and-set race), `'complete'` (pass `{ force: true }`) or `'no-event'`;
  - map `'running'` to 409;
  - the race-safety is `repo.startSnapshot` (a conditional insert/update), so the route needs no second lock.
- Finalising after a throw: the snapshot stays `running`. In the route's `finally`, call `repo.finishSnapshot(id, { status: 'failed', callsUsed: 0, … })`. `RunSummary` is not available then; get the snapshot id from `repo.findSnapshot(eventId, phase)`. `calls_used` accumulates, so pass 0, not a guess.
- `Deps` has no `notify`. Call notify from the route after `runSnapshot` returns:
  - use `summary.status`, `summary.stale` (`{ unionId, tag }`) and `summary.failed` (`{ unionId, tag, error }`);
  - `tag` can be null for an error row whose id is not in config.
- `openDb()` returns `{ db, close }`; close it in `finally`. `createRepo(db)` gives the Repo.
- Events: create with `allianceIds: []`; the BEFORE run copies the config onto the event.
- Real numbers: `pnpm check` 2.55 s locally; `snapshot:dry` 0.75 s; one fake 20-alliance run takes ~30 ms of collector time.
- Testing against Postgres by hand: `initdb` with `LANG=en_US.UTF-8`, start with `-k '' -c listen_addresses=127.0.0.1`, apply `drizzle/*.sql` with psql, and use `drizzle-orm/node-postgres` + `pg` cast to `Db`. All 8 repo functions behaved as the memory repo does.
- This Mac: the Node default is v24 (use `~/.nvm/versions/node/v26.13.0/bin`). gitleaks is at `/opt/homebrew/bin`, which this shell's PATH lacked.
</adjustments>

<adjustments for="Session 9">
- `calls_used` counts every `/v1` attempt (the quota check, reads and retries) and nothing from the internal API. A clean run is exactly 21; each 502/503/504 retry adds 1. That is the number to reconcile against the quota `used` delta.
- A re-run adds its own calls to the same snapshot's `calls_used`. A plain re-run of a partial snapshot costs 1 call plus one per missing alliance; `force` costs 21.
</adjustments>
