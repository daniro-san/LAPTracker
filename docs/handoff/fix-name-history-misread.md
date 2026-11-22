# Alliance names: one-off misreads are not renames

## Built
- `lib/compute.ts`: new `withoutMisreads(sightings)`. It drops a (tag, name) that was seen in one snapshot only, when another name of the same alliance was seen both earlier and at the same time or later. It orders sightings by the event's time with the After just after the Before (`seenAt`), because Before and After share the event's time; a snapshot's own start time is not used, since a re-run resets it (review of PR 676). `NameSighting` gets an optional `seenAt`.
- `lib/queries/names.ts`: `allianceNames` selects each snapshot's phase, builds `seenAt` from it and runs `withoutMisreads` before `nameHistory`. The result:
  - the alliance page's "Names" block shows only real names;
  - the event ledger's "was …" shows only real names.
- `nameHistory` itself is unchanged, including its "never drops a pair" property.

## Decisions
- **Cause.** The owner reported (2026-11-22) that a public page said YAHO / AGGRESSOR (union 67110335) was once "PKM / POKEMON", which it never was. In production, all 38 snapshots of that alliance read YAHO, except event 9's Before (snapshot 10, v1, 2026-11-07 12:00 UTC). Its After, three hours later, read YAHO again, and no other alliance ever had that tag or name. So it is the source's own misread, not a rename.
- **No data change.** The production row is left as recorded. Rewriting it would need the owner's OK, and the rule already hides it.
- **Real renames in the same snapshot stay.** SYNE (was "PSY / Psycho Killers") and TEST (was "Test-Tickles") also differ from their current names in snapshot 10. Both old names show consistently from 2026-11-05, so they are real renames and the rule keeps them.
- **Alliances only.** Player name history (`lib/queries/players.ts`) is unchanged, since no player misread has been seen.

## Deviations
- Plan §3.8 describes the name history as every pair seen; alliance names now leave out one-off misreads (this PR). The plan is not edited here (CLAUDE.md); §3.8 needs that line.

## Verified
- `lib/name-misreads.test.ts` (new; `lib/compute.test.ts` is at its line limit) has four tests:
  - the misread is dropped;
  - a rename seen once in the newest snapshot stays;
  - a rename between one event's Before and After stays;
  - a name seen in two snapshots stays.
- Break check: with the filter keeping every row, the first test fails. Restored, all 22 pass.
- `pnpm check`: see the PR.
- No e2e asserts an alliance's name history, so no e2e changed.

## Open issues
- Player names could get the same filter if a player misread is ever seen.
- The production row stays as recorded (owner decision if it should be corrected).

What was missing from the task prompt? Which page showed it; both pages that read `allianceNames` are fixed.

## Next
- None.

PR: https://github.com/daniro-san/LAPTracker/pull/676
