# 08zv-local-postgres

Issue 126, session 2 of 2. A local Postgres for `pnpm dev` and the seed, without Docker.

## Built

- `scripts/db-local.mjs`: `start` (runs `initdb` into `.pglocal/` on first use, starts the cluster on 127.0.0.1 at the port of `DATABASE_URL`, creates the database if missing), `stop`, `migrate` (applies `drizzle/` through `psql` in journal order), `check` (the host check only). It exports `localDatabaseUrl`, which the bridge and the preload import.
- `scripts/db-local-bridge.mjs`: a WebSocket server (ws) on 127.0.0.1:`DB_LOCAL_BRIDGE_PORT` (default 54321) that pipes each socket to 127.0.0.1:<port of `DATABASE_URL`>.
- `scripts/db-local-preload.mjs`: replaces `globalThis.WebSocket` with a subclass that sends `wss://<database host>/v2` to `ws://127.0.0.1:<DB_LOCAL_BRIDGE_PORT>/v2` when `DATABASE_URL` is local, and passes every other socket through.
- `package.json`: `db:local:start`, `db:local:stop`, `db:local:migrate`, `db:local:bridge`, `db:local:seed` (runs `check`, then `scripts/seed.ts` under tsx with the preload; flags such as `--reset` and `--with-states` pass through), `dev:local` (`NODE_OPTIONS='--import ./scripts/db-local-preload.mjs' next dev`). `ws` 8.22.1 as an exact devDependency; lockfile updated.
- `.gitignore`: `.pglocal/`.
- `CONTRIBUTING.md`: Setup gets a "Local database" part (Postgres binaries, the `.env.local` placeholder block, the commands in order, the photo-host line, the empty member history line); the Scripts table gets the six new commands. Prettier re-aligned the whole table, so the diff shows every row.
- `docs/DECISIONS.md`: D47 at the end.

## Decisions

- The preload wraps `globalThis.WebSocket` (owner, 2026-11-11). The same preload serves the tsx seed and `next dev`, so no `neonConfig` is set anywhere. `lib/db.ts`, `scripts/migrate.ts` and `next.config.ts` are not changed.
- The preload decides per connection, not at import, because the `next dev` server process reads `.env.local` after the preload has loaded.
- Auth method `password` (cleartext) for all connections: the driver pipelines a cleartext password and the dev server's copy of the driver keeps `pipelineConnect: "password"`. The cluster listens on 127.0.0.1 only, with `unix_socket_directories = ''`.
- "Already applied": `db:local:migrate` uses the same journal table and rule as `scripts/migrate.ts`. Entries newer than the newest `created_at` in `drizzle.__drizzle_migrations` run, each in one `psql --single-transaction` call together with its journal row (sha256 of the file, `created_at` = journal `when`). A second run applies 0.
- Host check: `new URL(DATABASE_URL).hostname` must equal `localhost` or `127.0.0.1`; anything else, an empty value or an unparsable value exits 2. All four `db:local` commands that touch a database, and `stop`, run the check first.
- Defaults: Postgres port comes from `DATABASE_URL` (CONTRIBUTING uses 54320), bridge 54321 (`DB_LOCAL_BRIDGE_PORT` overrides), data directory `.pglocal/` (fixed). The bridge is a foreground process in its own terminal; it is not started by `db:local:start`.
- `ws` 8.22.1, not 8.22.2: 8.22.2 was released 2026-11-08, three days before this session; D19 took the previous release in the same case. The workspace has no pnpm release-age setting (`pnpm config get minimum-release-age` prints `undefined`, `pnpm-workspace.yaml` has none).
- Owner question 3 was not answered; recommended reading taken: the member history page renders empty locally because the seed does not fill `daily_rosters`. Stated in CONTRIBUTING.md and D47. No test for the image routes' no-URL rule.
- `URL` is imported from `node:url` in the `.mjs` files, because `eslint.config.mjs` gives `scripts/**/*.mjs` only the `process` and `console` globals. I did not edit the eslint config.

## Deviations

- The decision of 2026-11-05 said the preload sets `neonConfig` (`wsProxy`, `useSecureWebSocket = false`, `pipelineConnect = false`). It does not: the owner's answer of 2026-11-11 chose the `globalThis.WebSocket` wrap, which covers both tsx and `next dev`, so `neonConfig` is not needed.
- The ports in the orchestrator's notes for my runs (Postgres 54126) were taken: a `python3` process (pid 88171, not started by me) listened on 127.0.0.1:54126, and `pg_ctl start` failed with "could not bind IPv4 address". I did not touch that process and used 54136 (Postgres), 54236 (bridge) and 3136 (`next dev`) instead.
- `dev:local` is a new script name that is not `db:local*`; the task says "pnpm dev with the preload". `pnpm dev` itself is unchanged.

## Verified

All runs used a worktree `.env.local` with only the placeholder values from CONTRIBUTING.md (ports changed as above), and `/opt/homebrew/opt/postgresql@18/bin` first on PATH. No Neon URL, no upstream call, no `/api` request.

- Host check, `DATABASE_URL=<url> node scripts/db-local.mjs check`: exit 2 for `postgres://lap:lap@ep-x.neon.tech/db`, `postgres://lap:lap@localhost.evil.com/db`, `postgres://lap:lap@evil.com/localhost`, `postgres://localhost:lap@neon.tech/db`, `postgres://lap:lap@127.0.0.1.nip.io/db`, `not a url` and empty; exit 0 for `postgres://lap:lap@localhost:1/db`. `DATABASE_URL=postgres://lap:lap@ep-x.neon.tech/db pnpm -s db:local:seed --reset` printed `db:local: DATABASE_URL must be set and its host must be localhost or 127.0.0.1` and exited 2 before tsx started; the bridge with that URL exited 2 too.
- First attempt with Homebrew's default `initdb` (`/opt/homebrew/bin/initdb`, from libpq): `initdb: error: program "postgres" is needed by initdb but was not found`. Hence the PATH line in CONTRIBUTING.md.
- Clean run (after `pnpm db:local:stop` and deleting `.pglocal/`), in the documented order:
  - `pnpm -s db:local:start` → `db:local: Postgres on 127.0.0.1:54136, database laptracker`; a second run → `db:local: the cluster is already running` and the same line, exit 0.
  - `pnpm -s db:local:migrate` → `applied 0000_flippant_slapstick` … `applied 0012_young_mephisto`, `db:local: 13 applied, journal at 1794324015956`; a second run → `db:local: 0 applied, journal at 1794324015956`.
  - `pnpm -s db:local:bridge` → `db:local: bridge ws://127.0.0.1:54236 → 127.0.0.1:54136`.
  - `pnpm -s db:local:seed --with-states` → `seeded 20 alliances × 3 events, 1 rehearsal, an empty event and a running one`, exit 0, 1.8 s. A second run → `the database already has events; pass --reset to empty it first`.
  - psql counts (first run, same seed): events 6, snapshots 10, alliance_snapshots 146, member_snapshots 12,496, member rows with null `rank_code` 0, journal rows 13. `pg_hba_file_rules`: every rule `password`; `show unix_socket_directories` is empty.
  - `pnpm -s dev:local -p 3136` → `Ready`, `Environments: .env.local`, no `Invalid environment`. `curl` of `/` 200 (492,062 bytes), `/events/3` 200, `/players/340024664389` 200, `/events/3/alliances/67109944` 200 with the Leadership section; its text starts `Leadership ●Mushroom● Leader Might 75.7M … Egyption God of War Might 93.5M …`. In the first run `/alliances/67109944/history` also returned 200. curl does not load images, so no photo was requested from the photo host.
- Preload on and off, a tsx script that runs `select count(*)` through a `@neondatabase/serverless` `Pool`: with `--import ./scripts/db-local-preload.mjs` → `rows [ { n: 6 } ]`; without it → `failed ErrorEvent`.
- Cleanup: `next dev` and the bridge stopped, `pnpm db:local:stop` exit 0, `.pglocal/` and the worktree `.env.local` deleted; ports 3136, 54136 and 54236 have no listener; `pgrep -fl "db-local|next dev -p 3136"` prints nothing.
- `git diff --stat origin/dev -- lib/db.ts scripts/migrate.ts next.config.ts`: empty. Whole diff: 8 files (`.gitignore`, `CONTRIBUTING.md`, `docs/DECISIONS.md`, `package.json`, `pnpm-lock.yaml`, the three `scripts/db-local*.mjs`) plus this handoff.
- `pnpm check`: prettier clean, eslint clean, tsc clean, vitest `54 passed | 1 skipped` files, `246 passed | 1 skipped` tests, drift `No schema changes, nothing to migrate` and `Everything's fine`, `i18n: 17 languages up to date with English`, exit 0.

## Open issues

- Only macOS (Homebrew `postgresql@18`, Postgres 18.6) was tried. The Debian/Ubuntu line in CONTRIBUTING.md is not tested.
- `package.json` scripts set `NODE_OPTIONS` with POSIX shell syntax, so `pnpm dev:local` does not run under Windows `cmd`.
- A seeded page opened in a browser fetches member photos from the real photo host (owner accepted). The badge route uses `LAP_SITE_BASE_URL` (`127.0.0.1:9`), so it fails and logs `image.fetch_failed` for each badge; expected locally.
- The local database is not covered by any test or CI job; it is checked only by running it.

## Next

Session: 08zzy-decisions-split (issue 127).
Model / effort: keep (sonnet · medium) — no signal from this session; it adds one entry, D47, at the end of DECISIONS.md and touches no code the split moves.
Owner must do first: merge this PR and 08zq's PR (D46) into dev, and start 08zzy only when no open PR edits docs/DECISIONS.md.
Plan changes needed: none.

<adjustments>
- D47 is the last entry of docs/DECISIONS.md, placed after D60 (the file is not in numeric order). Its heading: "D47 — Local Postgres without Docker: an initdb cluster, a ws bridge and a WebSocket preload (2026-11-11, owner, 08zv, issue #126)".
- D47 refers to D19 by number ("as D19 did"); keep that reference working if entries move to other files.
- CONTRIBUTING.md Setup now names D47 ("Local database (no Docker, D47)"); a link to a split decisions file would need to point there.
- A local database for checking a change: `pnpm db:local:start`, `pnpm db:local:migrate`, `pnpm db:local:bridge`, `pnpm db:local:seed --with-states`, `pnpm dev:local` (CONTRIBUTING.md Setup). Needs Postgres server binaries on PATH; on this Mac `/opt/homebrew/opt/postgresql@18/bin`, not `/opt/homebrew/bin/initdb` (libpq, no server).
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/221
