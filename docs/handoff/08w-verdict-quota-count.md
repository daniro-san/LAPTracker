# 08w — Rehearsal verdict: exact count of attempts that returned no quota

## Built
- `lib/schema.ts`, `drizzle/0010_certain_prodigy.sql`: `snapshots.quota_unseen_calls integer not null default 0`.
- `lib/collector.ts`: `Run.lowestRemaining` became `Run.lowest = { remaining, calls }`: the lowest quota `remaining` seen and `run.calls` at the moment it was recorded. `finish` writes `quota_unseen_calls = run.calls − lowest.calls` next to `quota_remaining_after` (still `lowest.remaining`).
- `lib/repo/index.ts`, `lib/repo/snapshots.ts`, `lib/run.ts`: `SnapshotResult.quotaUnseenCalls`, written by `finishSnapshot` like the quota columns (overwritten, not added). A crashed run is finalised with 0. `lib/repo/memory.ts` stores the whole result and needed no change.
- `lib/repo/rehearsals.ts`, `lib/rehearsal.ts`: `VerdictPhase.quotaUnseenCalls`. The quota line passes when `calls_used = drop + unseen`. When unseen > 0 the phase reads e.g. `after 21 = 20 + 1 without quota` (or `≠`); when 0 the text is unchanged, so every existing string holds.
- Tests: `lib/collector.test.ts` — an AFTER run over one alliance whose 3 `/v1` attempts fail with 503 (no quota) while the internal fallback succeeds ends `complete`, 4 calls, `quota_unseen_calls = 3`. `lib/rehearsal.test.ts` — calls 21, quota 900 → 881, unseen 1 gives PASS with `calls used = quota drop (before 4 = 4, after 21 = 20 + 1 without quota)`. Both fail on the old code.

## Decisions
- Assumptions stated by the task, kept: the column above; value = calls after the response that gave the lowest remaining; overwritten like `quota_remaining_*`.
- A response whose `remaining` equals the current lowest moves the mark forward (`<=`, not `<`). If upstream ever reported the same `remaining` for two calls, those calls stay in the drop comparison and the verdict shows the mismatch instead of hiding it as "without quota".
- When no response carried a quota (the quota check failed), unseen = every call of the run. The drop is `unknown` in that case, so the verdict fails as before; the number is literal, not used.
- `Run.lowest` is one never-null object instead of two fields so `lib/collector.ts` stays within the `max-lines` (300) and `finish` within the `complexity` (12) lint limits.

## Deviations
- Plan §10b ("§3.1 verdict, quota line") describes a mitigation that was never built: a verdict line "n `/v1` attempts returned no quota" when `run_logs` has a `v1.fetch` warn line. This change replaces it with the exact count the same item says "needs a column". §10b was not edited.

## Verified
- `pnpm check` steps on top of `origin/dev` at 12f918f (with #103 and Lane A's #104): prettier, eslint, `tsc --noEmit` clean; `scripts/check-drift.ts` (#104's migration drift gate) reports no schema changes. `vitest run --hookTimeout=60000`: 36 files passed, 1 skipped; 155 tests passed, 1 skipped. The longer hook timeout is because the machine's load average was 30–40 from parallel lanes; with the default 10 s, PGlite `beforeAll` hooks in `lib/queries/*` timed out and passed when run alone (same as in 08v).
- Migration 0010 is applied by the PGlite test helper on top of 0009 (#56, merged as #103).
- Not run: anything against Neon, Vercel or the upstream API.

## Open issues
- **Exact only for a sequential tail.** The collector reads with CONCURRENCY 4. If a failing alliance's attempts are counted while another alliance's call is still in flight and that call then returns the lowest `remaining`, the failed attempts fall before the mark and are not counted as unseen; the verdict then reads `≠`. The single-alliance test pins the sequential case.
- **Follow-up (not fixed):** on a forced re-run, `calls_used` accumulates (`lib/repo/snapshots.ts:59`, `callsUsed + result.callsUsed`) while `quota_remaining_*` and now `quota_unseen_calls` are overwritten, so the verdict compares a two-run call count with a one-run drop.
- **Merging applies migration 0010 through the Vercel build** (`vercel.json:4`, `pnpm db:migrate && pnpm build`): merging into `dev` migrates the database the `dev` build points at; the release to `main` migrates production. `ADD COLUMN … DEFAULT 0 NOT NULL` is safe on a non-empty `snapshots`; old rows read 0, so their verdict text is unchanged.
- This change depends on #56's PR (#103, migration 0009). #103 was merged into `dev` while this was in progress, so the branch was rebased onto `origin/dev` and carries only its own commit.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call.
Owner must do first: merge this PR into `dev` (the build applies migration 0010; 0009 is already on `dev` via #103).
Plan changes needed: none. §10b "§3.1 verdict, quota line" describes the mitigation this replaces; a later docs pass can update it.

<adjustments>
- Session 9 step 2 ("Confirm calls_used equals the drop in /v1/quota"): the reconciliation is now `calls_used = (quota_remaining_before − quota_remaining_after + 1) + quota_unseen_calls`. Record `quota_unseen_calls` per phase in the numbers table; a non-zero value means the last `/v1` attempts failed with no quota body and the internal fallback filled the row.
- Session 9: if the verdict reads `≠` with `quota_unseen_calls = 0`, check `run_logs` for a failing `/v1` attempt that overlapped another alliance's call (the concurrent-tail case above) before suspecting another user of the key.
</adjustments>
