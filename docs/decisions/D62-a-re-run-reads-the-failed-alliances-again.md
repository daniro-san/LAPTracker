## D62 — A re-run reads the failed alliances again (2026-11-12, owner, 08zzzk)

Why: a snapshot re-run fetched only the alliances without a row (INVARIANT `run.resume-missing-only`). An alliance whose read failed (timeout, 5xx, then no internal fallback) has an error row, so pressing Before or After again never read it. Its numbers stayed missing for that event. The owner: "fetch them all and save only what failed".

- **What a re-run reads.** A re-run without force (the snapshot is `partial`, `failed`, or left `running` for 150 s or more) first deletes the snapshot's failed rows (`error` set) and their members (`clearFailedAllianceRows`, in the claim). The existing rule then fetches every alliance without a row: the failed ones and the ones never reached. Rows that were read, from `/v1` or from the internal fallback, fresh or stale, are kept untouched and not fetched again. A stale row is not a failure.
- **Not "fetch everything".** Fetching the alliances already read would spend a request each for data that is then thrown away. A forced re-run (the "Take it again?" answer on a complete snapshot) still deletes every row and reads everything (D28).
- **No duplicates.** `alliance_snapshots` stays unique on (snapshot, alliance), and the error row is deleted before the new read is inserted.
- **If the alliance fails again,** it gets a new error row with the new error. If the run stops before reaching it (deadline, 429, call cap), it has no row and is named `not fetched: …` as before.
- **Cost:** 1 quota call plus one per alliance read, as for any re-run. The budget check is unchanged.
- Plan Phase 3's checklist line "A re-run fetches only alliances without a row for that snapshot" still holds; `.claude/rules/collector.md` adds this. The README's "⚠ Partly done" advice is updated.
