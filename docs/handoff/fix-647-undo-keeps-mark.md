# fix-647-undo-keeps-mark

Issue #647: Undo of a repeated "They need help" cleared another officer's standing Needs help mark.

## Built

- `lib/private/follow-up-undo.ts` (new): `undoFollowUp` and `putBack`, moved out of `lib/private/follow-up.ts`, which re-exports `undoFollowUp`, so the route and the tests import it as before. The move keeps both files under the 300-line lint limit.
- `putBack` puts a break or Needs help fact back only when the newest version of that fact is the record's `fact_version` and was written at the record's `written_at`. A save writes the fact version and the record with the same `clock.now`, so a version written by an earlier save never matches.
- `lib/private/follow-up-help.test.ts`: a `describe("Undo of a Needs help record (#647)")` with four PGlite tests.
- `docs/decisions/D104-follow-up-weekly-worklist.md`: amendment 2026-11-22 (issue #647).

## Decisions

- Cause: officer B's sheet still holds status version 0 (opened before A's mark). B saves "help"; `saveOne` sees the same value under a newer version and returns A's version without writing one. B's record stores A's version as `fact_version`. Undo compared only the version number, treated A's version as B's write, and wrote back the version before it (empty).
- The fix is in the Undo path only. The record still stores the version `saveOne` returned, so the Needs help mark credit (`helpMark`) and the save path are unchanged.
- Time equality instead of a schema change: `member_facts.written_at` and `member_follow_ups.written_at` are both `timestamptz` and both take `clock.now` of the same save. No migration, no new column, the Undo request (D100) is unchanged.
- The same rule applies to On a break records (the same reuse can happen on `away`).

## Deviations

- None from the task. The file split was approved by the orchestrator after `max-lines` failed on `follow-up.ts`. After the rebase onto #659, the test file also passed 300 lines; the new tests now share an `undo` helper that also asserts `{ ok: true }` on every Undo.

## Verified

- Break check: with the time check removed, "keeps another officer's standing mark when the undone save wrote no version of its own" and "keeps last week's mark when a save that reused it on Sunday is undone on Monday" fail; with it, they pass. Checked before and after the rebase.
- The two guard tests ("puts a different value back when the undone save wrote a new version over it", "clears an officer's own mark when they undo it") pass without the fix, since that behaviour already worked. They fail when Undo never puts a value back, so they guard the new condition.
- The case where B's sheet saw A's version (B writes a new `help` version) is covered by the existing "Bo marks again and undoes it" test, which still passes.
- `pnpm vitest related --run lib/private/follow-up.ts lib/private/follow-up-undo.ts lib/private/follow-up-help.test.ts`: 25 files, 109 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest 1745 passed / 4 skipped, drift, i18n).
- E2E: not changed. The e2e Undo cases (`e2e/desk-flows.spec.ts`, `e2e/desk.spec.ts`) undo "Talked to them", which writes no fact, so what they show is the same.

## Open issues

- The time-equality rule's limit: if one request saved the same fact twice at the same instant, Undo could not tell the two versions apart. No current path does this: `recordFollowUp` writes one fact once per request.
- A reused save still stores the other officer's version as its `fact_version`, so while B's record counts, the mark names B (`helpMark` takes the newest record in the run). The issue does not cover this; not changed.

## Next

- Follow-up candidate: store `fact_version` only when the save wrote a version, if the owner wants the mark to keep naming the first officer while B's record counts. That changes what `helpMark` shows and needs a decision.

What was missing from the task prompt? Nothing needed; it did not say which save path leads to the reuse (a sheet opened before the other officer's save), which the code showed.

PR: https://github.com/daniro-san/LAPTracker/pull/664
