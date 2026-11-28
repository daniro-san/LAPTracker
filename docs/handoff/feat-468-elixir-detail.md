# feat/468-elixir-detail

Issue 468: Elixir Scramble in more detail. Closes #468.

## Built

- Roll call marks for an Elixir Scramble roll call: Registered (`registered`), Registered for 09:00 only (`early`), Sub (not used) (`sub`), Excused (`excused`), Joined (`yes`, optional `score`), Did not join (`no`). The first four are neutral: not ✓, not ✗, counted as "marked" and as "Other marks". Other kinds refuse them and a score (400).
- Team result per week (`roll_call_results`): opponent, our score, their score. Won, Lost or Tie is read from the two scores and not stored. Form on the marking page below the tiles (`ElixirResult.tsx`).
- Member card, Overview: "Last 4 Elixir" block (`card-elixir.ts`, `ElixirBlock` in `MemberCards.tsx`) and the follow-up line.
- Follow-up line: shows only when officers explicitly marked Did not join on at least 2 of the last 4 seats. "The rest" fills a Did not join that nobody tapped; those marks carry `by_rest` and never count. Sub, Excused, Registered and unmarked weeks never count. Nothing is sent or flagged.
- Copy in EN, PT-BR and FR (`dictionary.rollcall*.ts`, `dictionary.data.ts`).
- Migration `0094_elixir_detail` (origin/dev had no `0093_*` yet; 0093 belongs to the merging PR): `roll_call_results`, `roll_call_marks.score`, `roll_call_marks.by_rest`, widened mark check.
- `roll_call_results` joined the workspace export and purge list (`lib/repo/workspace-data.ts`), as the purge test requires.
- D103 amended.

## Decisions

- A seat is a row of `roll_call_team` on a live Elixir Scramble roll call whose Calendar entry is still there. "Last 4" is the member's 4 newest seats.
- Joined and Did not join reuse `yes` and `no`; the four new marks are new values of the same column.
- `by_rest` column: the task says the line is built only from explicit marks, and "the rest" writes Did not join in bulk. A column marks those writes so they are not read as explicit.
- A tie reads "Tie". The issue names only Won and Lost.
- The result save has no version check: the newest save replaces the last. Analytics reports it as the existing `save` action (no new tracking-plan word).
- The card block reads only while the Roll call feature is on for the workspace.
- A score sits on the Joined mark: tapping another mark clears it.
- Other marks are counted as "Other marks n" on the week card, with no chip of their own (they show under All and Marked).

## Deviations

- `Tally` gained `other`, so five existing test literals got `other: 0`.
- The card's Elixir block is placed after the follow-up block and before the last 7 days, to stay away from the Alliance Duel section another change is adding in the Overview.

## Verified

- `pnpm vitest related --run` on the changed files, then every step of `pnpm check` by hand: prettier, tsc, full `vitest run` (all pass after seeding `roll_call_results` in `lib/workspace-seed-parts.test-helpers.ts`), `check-drift`, `i18n-check` pass. After rebasing onto origin/dev (0093 and the rosters fix merged) the whole `pnpm check` passes; the migration was regenerated as 0094 from dev's 0093. New tests in `lib/private/elixir-record.test.ts` (4): extra marks and score saved and read for the own workspace only (other workspace gets not_found, shield refuses them); Won or Lost from the scores; last 4 line; follow-up only from explicit marks.
- Not run: a browser check at 360 px (no local app run, no real data). Layout is one column, 44 px controls, classes taken from the neighbouring tiles.

## Open issues

- The week card's "Other marks" count has no drilldown chip; a "Registered" member is "marked" and drops out of "To mark" even though the week's real answer is Joined or Did not join. If officers want Registered to stay under "To mark", say so.
- Seat-less marks (a member marked on a roll call but taken off the team) are not on the card.
- Another migration `0093_*` merges with the same snapshot parent; the later one must regenerate its snapshot.

## Next

- Designer-persona review at 360 / 640 / 1280, dark mode, for the tile's extra marks and the result form.
- Patch note in `/admin/changes` before the next release.
- Tracking-plan decision for a distinct `result` action word, if wanted.

What was missing from the task prompt? Whether "Registered" should count as marked, and whether "the rest" counts as an explicit mark.

PR: (added by the orchestrator)
