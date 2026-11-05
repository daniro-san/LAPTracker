# 08v — App-error alert: once per hour while errors continue, claimed across instances

## Built
- `lib/schema.ts`, `drizzle/0009_wide_wiccan.sql`: table `app_alerts(id integer primary key check (id = 1), alerted_at timestamptz not null)`. No seed row.
- `lib/repo/app-errors.ts`: `claimAppErrorAlert(db, now, gapMs)` is one statement, `INSERT … VALUES (1, now) ON CONFLICT (id) DO UPDATE SET alerted_at = now WHERE app_alerts.alerted_at <= now − gap RETURNING id`. It returns true when a row comes back: the first alert ever (insert) or the last alert at least `gapMs` ago (update). `lastAppErrorAt` is removed (no other caller).
- `lib/app-errors.ts`: `recordAppError` inserts the error, then claims with `ALERT_GAP_MS` (1 h), and posts to the admin webhook only when the claim returns true. The 1/s per-instance limiter and the 500-row cap are unchanged.
- `lib/db.test-helpers.ts`: `truncateAll` also truncates `app_alerts`.
- Tests, `lib/app-errors.test.ts` (PGlite, `testContext` clock and recorded fetch): an error every 5 minutes for 3 hours gives 3 admin posts (at 0, 60, 120 min; the old code gave 1); two concurrent claims an hour after the last alert give exactly one true.

## Decisions
- Assumption stated by the task, kept: one-row table with a check constraint rather than a column on an existing table; the claim is an upsert so it needs no seed row and works on an empty table after the migration.
- The gap is measured from the last *alert*, so a continuing stream of errors alerts at most once per hour (plan Phase 6 Observability: "the notifier reads the last alert time from the DB"). An error right after a quiet hour still alerts at once, as before.
- The claim happens after the error insert, inside the same try block: if the database is down neither runs and the `console.error` line is the record, as before.

## Deviations
- None from the plan. This implements the fix that plan §10b ("Phase 6 observability, alert cadence") and `05-review.md` N2 describe; §10b was not edited.

## Verified
- `pnpm check` steps: prettier, eslint, `tsc --noEmit` clean. `vitest run`: 36 files passed, 1 skipped; 153 tests passed, 1 skipped — with `--hookTimeout=60000`. With the default 10 s hook timeout, 1–3 PGlite files (`lib/queries/leadership`, `players`, `upstream-status`) timed out in `beforeAll` while the machine's load average was ~38 from other lanes running in parallel; the same files passed alone (`vitest run lib/queries`, 17 tests in 3.8 s). The timeout is load, not this change.
- Migration 0009 is applied by the PGlite test helper (every DB test runs on it).
- Test 2 runs on PGlite, which serialises the two statements on one connection; it checks the statement's semantics (second caller gets no row), not Postgres row locking. On Neon, `ON CONFLICT DO UPDATE` locks the conflicting row and the second caller re-evaluates the `WHERE` against the updated `alerted_at`, so it also gets no row.
- Not run: anything against Neon or Vercel.

## Open issues
- **Merging applies migration 0009 through the Vercel build** (`vercel.json:4`, `pnpm db:migrate && pnpm build`): merging into `dev` migrates the database the `dev` build points at; the release to `main` migrates production. The migration only creates a table, so it is safe on non-empty databases.
- The first app error after deploy alerts at once (no row yet), even if the old code alerted minutes earlier. Harmless.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call and does not touch a run.
Owner must do first: merge this PR into `dev` (the build applies migration 0009). Then the PR for #55 (08w), which is stacked on this one and adds migration 0010.
Plan changes needed: none. §10b "Phase 6 observability, alert cadence" now describes behaviour that is fixed; a later docs pass can drop that item.

<adjustments>
- Skip: the app-error alert cadence (05-review N2) is fixed; Session 9 does not need to account for it.
- If Session 9 sees an app error during the dry run, `/admin/errors` lists it and the admin channel gets one message per hour at most while errors continue, from one instance only.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/103
