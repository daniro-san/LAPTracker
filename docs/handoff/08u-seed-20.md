# 08u — Seed only the 20 tracked alliances (#58)

## Built
- `scripts/seed-data.ts`: `loadBase()` keeps only fixture bodies whose union_id is in `ALLIANCES` (`config/alliances.ts`); doc comment updated. The seed now writes 20 alliances, so ranks run to #20 as the config does (07c N13).
- No fixture deleted or renamed: TRM (67110063) and 404 (67110811, the non-ASCII parser body) stay in `fixtures/v1-ids/`; `lib/sources/test-helpers.ts` still reads every recorded body for the parser tests.

## Decisions
- Filter at read time, before the bodies map is built, so nothing downstream of `loadBase()` changes.
- TRM and 404 sorted 21st and 22nd by might (measured: `loadBase()` order before the change, 404 #21, TRM #22). Removing them moves no index 0–19, so the scripted states in `scripts/seed.ts` (renamed alliance at index 1, the mover at index 5, the stale row, the failed row) and 07c's seed answers are unchanged.

## Deviations
- The seed ran as `tsx scripts/seed.ts` with `DATABASE_URL` set inline, not `pnpm db:seed` (which only adds `--env-file-if-exists=.env.local`; this worktree has none). Same script.
- `lib/db.ts` opens the Neon serverless driver, which reaches Postgres only through a WebSocket proxy (03-collector says the same). For the local check only: a throwaway `initdb` cluster on 127.0.0.1:54358, a WebSocket→TCP bridge in the scratchpad (Next's bundled `ws`), and a temporary `neonConfig` block in `lib/db.ts` (`wsProxy`, `useSecureWebSocket = false`, `pipelineConnect = false`). Reverted before commit; nothing of it is committed.

## Verified
- Fresh Postgres 18.6 cluster, `drizzle/0000`–`0009` applied with `psql` (9 tables). Seed output: `seeded 20 alliances × 3 events, 1 rehearsal`. DB: 4 events, 8 snapshots, 126 alliance rows (138 before with 22), 20 distinct `union_id`, 10,698 member rows.
- `next dev -p 3458` against it (fake env; `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL` pointed at `127.0.0.1:9`, so no upstream call was possible): `/events/3` lists #1 `[NSE]` … `#20 [FGH] MegaDeath` and ends there. Scripted states still show: OGs "was [OLD] Seed Former Name", URSA falling with `*` and −2 members, TEST stale at #10.
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc clean (tsc caught `ALLIANCES` being `as const`: the set is `Set<number>`); drift gate clean. vitest: 4–10 PGlite files hit the 10 s `beforeAll` timeout at load average 40–51 (other lanes; same as 08s/08t). `vitest run --hookTimeout=180000 --testTimeout=60000`: 36 files, 153 passed, 1 skipped.

## Open issues
- The Neon preview branch still holds the 22-alliance seed. Re-seeding it (`pnpm db:seed -- --reset` with `.env.local` on the preview branch) is the owner's step; the agent's run is blocked as a mass delete.
- Seeding or running the app against a plain local Postgres needs a WebSocket proxy and a `neonConfig` change; there is no committed way to do it. Not added (not asked).

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; seed data only, no effect on the dry run.
Owner must do first: merge this PR into `dev`, then re-seed the Neon preview branch: `pnpm db:seed -- --reset` (expect `seeded 20 alliances × 3 events, 1 rehearsal`).
Plan changes needed: none.

<adjustments>
- The seed has 20 alliances (126 alliance rows, 10,698 member rows per full seed); a preview page with #21 or #22 means the preview branch was not re-seeded.
</adjustments>

PR_URL
