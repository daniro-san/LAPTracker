# fix/692-unknown-kills: say why a member's kills change is `—` when one side is unknown

## Built

- Event alliance page, member list (`app/_ui/MembersExplorer.tsx`): a member in both rosters whose kills are unknown at Start or at End keeps `—` for the kills change and gets a muted note after it: "Start unknown" or "End unknown". While the list is sorted by ± Kills, the note reads "Start unknown · counted as 0" / "End unknown · counted as 0", because that order (and War turnout) counts the unknown figure as 0 (D15).
- `killsUnknownAt(m, canDelta)` (`app/_ui/member-views.ts`): the side whose kills are unknown, only for a member in both rosters with both sides usable.
- `StatMetric.unknown` (`app/_ui/StatTable.tsx`): the reason text shown after a `—` change. It is shown only when the change is null.
- `toRow` in `MembersExplorer.tsx` is exported for the test. `Mode` carries the list's sort.
- Copy: `members.startUnknown`, `members.endUnknown`, `members.countedAsZero` (`lib/copy.ts`), translated in 17 languages (translate-copy skill, stamped).
- D15: dated amendment (2026-11-22, issue 692).
- Tests (`app/_ui/member-drilldown.test.ts`, PGlite): one for an unknown at Start (ranks by the whole End kills above a read gain, and the row shows the End figure, then `— · Start unknown · counted as 0`, with no arrow or sign), and one for an unknown at End (ranks as a fall of their whole Start kills, `killsGain` with End as 0: below a read fall of 10K, above a read fall of 4M; the row says `— · End unknown · counted as 0`). Both tests also render the row under the Might sort: the plain "Start unknown" / "End unknown" stays and "counted as 0" is absent.

## Decisions

- Persona panel (public visitor with English as a second language, alliance leader, adversarial reviewer) on a written 360 × 780 mock with invented data, comparing (a) the gain the sort used with a note, (b) one D15 note under the list, and (c) `—` plus the reason in the row. Verdict: (c), plus "counted as 0" while ± Kills is on (a second round, C2).
  - (a) was rejected: the leader read `+2.1M` as a real gain to reward. The adversarial reviewer said it shows a made-up number as if it were read.
  - (b) was rejected: the note sits below 20 rows and "Show all", so nobody reads it within 5 seconds.
  - The visitor and the leader still asked "why is he first?" with plain (c). The C2 suffix answers that, and only on the sort it explains.
- The End-unknown row gets the note too. The panel asked for it: a bare `3.2M → —` at the bottom looks like a bug and buries a member without a reason. This deviates from the task's default of leaving those rows as they are, because the panel said otherwise.
- The panel's string was "ranked as 0". It ships as "counted as 0": for an unknown End, the member ranks as a loss of all their Start kills, not as a change of 0, so "ranked as 0" would be false there. "Counted as 0" names the unknown figure, which is true for both sides.
- The note is shown whatever the sort ("Start unknown"). Only the suffix depends on the sort.

## Deviations

- The persona check ran on a written mock, not on screenshots of the built page.
- No public e2e flow changed: no e2e seed has a null member kills (`e2e/fixtures/seed.ts` types kills as a number), so no flow shows these rows.

## Verified

- `pnpm vitest related --run <changed files>`: 153 files, 904 tests passed.
- `pnpm check`: green after one fix round (prettier on the test file and four glossaries). Prettier, eslint, tsc, vitest (351 files, 1,877 passed, 4 skipped), drift, and i18n (17 languages up to date) all pass.
- Mutation checks, each restored afterwards:
  - With the row note removed, both new tests fail.
  - With ± Kills ordered by the shown change, the Start test (and the existing War turnout test) fail.
  - With the End case removed from `killsUnknownAt`, the End test fails.
- Review fixes (PR 708):
  - With "counted as 0" made unconditional, both new tests fail on their Might-sort assertions.
  - With ± Kills ordered by the shown change, the End test also fails: the unknown-at-End member would sit last, below the 4M read fall.
  - `pnpm vitest related --run app/_ui/member-drilldown.test.ts`: 4 passed.
  - `pnpm check`: green (vitest 1,877 passed, 4 skipped; i18n 17 languages up to date).

## Open issues

- A member with kills unknown on both sides shows "Start unknown". Their order value is 0, which is true for "counted as 0".
- Whether an unknown side should count as a gain at all is still open (PR 690's handoff). Changing it would change War turnout and Kill share figures.
- Other places that show a member's kills change with a null side (player pages, compare) are not changed.

## Next

- Follow-up (optional): let `e2e/fixtures/seed.ts` hold a null member kills, so a public flow can cover the note.
- Follow-up: the D15 decision on whether a null side counts as a gain (above).

What was missing from the task prompt? That "ranked as 0" (the panel's wording) would be false for an unknown at End, so the wording had to name the figure, not the rank.

PR: (added by the orchestrator)
