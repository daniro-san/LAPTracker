# fix-320 — `db:local:seed -- --reset` says when the bridge is not running

## Built
- `scripts/db-local.mjs check` (the first step of `pnpm db:local:seed`) now also opens a TCP connection to the bridge port (`DB_LOCAL_BRIDGE_PORT`, default 54321). When nothing listens there it prints `db:local: no bridge on 127.0.0.1:<port>; run \`pnpm db:local:bridge\` in another terminal first` and exits 1, before the seed runs.

## Decisions
- The issue's diagnosis was wrong. On a freshly migrated local database (46 migrations) every table in the reset's `truncate` list exists, `rehearsal_slots` included (migration 0002; no migration drops it), and the same `truncate` succeeds in psql. The reported failure happens when `pnpm db:local:bridge` is not running: the Neon driver's WebSocket fails with an empty error, and the seed prints only Drizzle's `Failed query: truncate … rehearsal_slots …`, because the truncate is its first query. So the fix is the bridge check, not a different table list.
- The truncate list was not derived from the schema. The tables are spread over `lib/schema.ts` and five other schema files (`drizzle.config.ts`), and truncating every table would also empty local workspace tables, which `--reset` leaves alone today. Nothing in the reported failure needs it.

## Deviations
- The task asked to truncate only tables that exist, or to derive the list from the schema. Neither was done, for the reasons above.

## Verified
- Bridge down (`DB_LOCAL_BRIDGE_PORT=54399`): `pnpm db:local:seed -- --reset` prints the bridge line and exits 1, without touching the database.
- Fresh database (dropped, `db:local:start`, `db:local:migrate`: 46 applied, 0 events), bridge up: `--reset` prints `seeded 20 alliances × 3 events and 12 daily reads, 1 rehearsal`.
- Seeded database, bridge up: `--reset` again prints the same line; afterwards 4 events and 726 alliance snapshots. `--reset --with-states` also passes.
- `pnpm check`: exit 0, 210 test files, 1125 tests passed, 4 skipped.

## Open issues
- `scripts/seed.ts` prints only `e.message`, so any other driver failure still reads as `Failed query: <sql>` with no cause. Follow-up if it bites again.
- `lib/db.test-helpers.ts truncateAll` and the seed's reset list are separate hand-written lists. Not changed.

## Next
- Model/effort: keep. No session is queued by this fix.
- Owner first: nothing.
- Plan change: none.

PR: (added by the orchestrator)
