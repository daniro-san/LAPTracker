# 08zzzk — A re-run reads the failed alliances again (D62)

Owner request, 2026-11-12. The owner asked whether a re-run duplicates data. It does not: unique keys on `snapshots`, `alliance_snapshots`, `member_snapshots` and `daily_rosters` prevent it. But the answer showed a gap: a snapshot re-run fetched only the alliances with no row. An alliance whose read failed has an error row, so pressing Before or After again never read it. The owner: "fetch them all and save only what failed".

## Built
- `lib/repo/alliance-snapshots.ts`: `clearFailedAllianceRows(db, snapshotId)` deletes the snapshot's rows with `error` set, and their members, in one transaction.
- `lib/repo/index.ts`: the new method on `Repo`. `lib/repo/memory.ts`: the in-memory version.
- `lib/collector.ts` `claim()`: a re-run that is not forced (partial, failed, or a stale `running`) calls `clearFailedAllianceRows`; a forced one still calls `clearAllianceRows`. The `run.resume-missing-only` rule ("fetch alliances without a row") is unchanged; its comment now says the failed rows were dropped at the claim.
- `lib/freshness.test.ts` (committed; `.claude/rules/collector.md` requires a test with a `lib/collector.ts` change): "re-runs read the failed alliances again and keep the rows already read (D62)". The first run gets a 504 for one alliance and closes partial. The re-run fetches exactly that alliance, its row has no error, every other row is equal to the first run's, and the snapshot is complete.
- Docs: D62 and its index entry; README "⚠ Partly done" (pressing again now reads the failed alliances); `.claude/rules/collector.md` checklist line.

## Decisions
- **"Fetch them all" read as every alliance not read yet (failed or never reached), not every alliance.** Fetching the alliances already read would spend a request each for data thrown away. A forced re-run ("Take it again?") still reads everything.
- **Stale rows are kept.** They were read; the game's data was old. "Save only what failed" excludes them.
- **The rows are cleared at the claim, not per alliance.** The existing "fetch without a row" rule then needs no change, and an alliance the re-run does not reach shows as `not fetched: …`, like any unreached alliance.

## Deviations
- None.

## Verified
- The new test passes; with the claim change reverted it fails (1 failed / 4 passed in `freshness.test.ts`). The existing "re-runs fetch only alliances with no row" still passes.
- A temporary PGlite test (passed, deleted) ran `clearFailedAllianceRows` against Postgres, starting from one good row with two members and one error row. Afterwards only the error row was gone and both members stayed. A new row for the same alliance could then be inserted (2 rows, unique key respected).
- `pnpm check`: prettier, eslint, typecheck, 257 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.

## Open issues
- None new.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. Checks passed on the first run.
Owner must do first: merge this PR into `dev` and release (patch). The next partial snapshot can be fixed by pressing its button again.
Plan changes needed: none. The plan's line "A re-run fetches only alliances without a row" still holds.

<adjustments>
- A non-forced snapshot re-run now deletes the failed rows before reading. Code that keeps state on error rows across runs must not rely on them surviving a re-run.
</adjustments>
