# feat/drilldown-raid-prep — drilldown batch A: Raid prep and the Roll call list

Size M (the Roll call list's counts open the marking page with a chip set: a flow across two screens). Plan: `.specs/features/drilldown-raid-prep/plan.md`.

## Built

- **D1, "To remind: n".** A visible chip "Show the n ›" beside the count (EN, PT-BR, FR; singular forms). A tap puts exactly the members of `toRemind` in the grid, no chip pressed, with the line "The n to remind" above them. `toRemind` now returns the rows; the count, "Copy n names", "Copy one message" and the grid read that one list.
- **D2, "Mark ✓ the n seen with a shield".** The same chip beside the button, with the line "The n seen with a shield, not marked yet". The set moved out of `TrackerBar` into `toAccept` (`prep-message.ts`); the button's n, the shown tiles and the uids it writes all read it.
- **Grid** (`roll-call-grid.ts`, `RollCallGrid.tsx`): `takeSet` makes a snap with no chip and only the set's members, taken once like a chip's list (D103: a mark moves nobody); a chip tap goes back to the chips. `useGrid` takes the chip to open on.
- **D4, Roll call list.** On each card, "Not set n", the ✗ count and the ✓ count are chips (44 px) linking to `/roll-call/mark?…&filter=todo|no|yes`, only when above zero. "n of m marked" and "Away n" stay text. `tallyParts` returns each count with its set and number; `rollCard` builds the links. "No problem seen n" moved beside "Shield up n" and joins it in one link, since both are the ✓ chip.
- **Marking page** reads `?filter=` (`filterOf`: `todo`, `yes`, `no`, `all`; anything else is `todo`) for both `RollCallMarks` and `RaidPrepMarks`.
- Amendments: D103 (the counts' links, the new order of "No problem seen", the `filter` address) and D137 ("Show the n", one list per set, no list for "n not read yet").

## Decisions

- Persona check on invented wireframes at 360 × 780 (three officers, a designer, an adversarial reviewer). Verdicts and what was adopted are in the plan's Validation section.
- D2 uses the grid switch (option A), not names in place with links to member cards: unanimous, because links leave Raid prep while marking and add a second pattern.
- D4 counts are pill chips, not underlined text (the older-eyes officer missed underlines).
- Zero counts are not links: an empty list opens nothing useful.
- No "Back to To mark" link and no "✓ includes n no problem seen" note, which the panel suggested: the "To mark" chip sits right above the set's line, and each tile says its own mark.
- Analytics: `ws_drilldown_opened`, the one desk drilldown event that #688 defined. Raid prep sends `surface` `raid_prep`, `kind` `remind` or `accept` on a "Show the n ›" tap. The marking page sends `surface` `roll_call`, `kind` `todo`, `no` or `yes` when it opens with `?filter=` from a card's count (a plain open or `All` sends nothing). Both are once per kind per page view, as on Insights, with a bucket of the set's size (`countBucket`) and never a name, uid or exact count. The kinds are closed lists in `lib/analytics/events.ts`, one per surface, so a kind can't ride on another surface's event. The tracking plan's row and a dated Changed line say so. The Roll call open is counted on the marking page's mount (in `useGrid`) rather than by a client wrapper around the server-rendered card links: the `filter` the page reads is the count that was tapped.

## Deviations

- **D3 ("n not read yet") is not built.** The persona check found that a grid switch cannot show the members the count names, because the count includes away members, who are not in the grid; and that a list of links to member cards leaves the page. No `unreadOf` was added.
- The new e2e flows are in a new file, `e2e/desk-drilldown.spec.ts`: `e2e/desk.spec.ts` is at its 300-line limit. That file only drops the " · " separators from its card line check, since the counts are now separate chips.
- The PGlite test sets up its workspace by inserting into the schema tables directly: tests under `app/(private)` may not import `lib/repo` (eslint zone).

## Verified

- `pnpm vitest related --run <changed files>`: 74 files, 386 tests passed.
- New tests: `app/(private)/_ui/drilldown-sets.test.ts` (PGlite: the remind set, the accept set, card counts = chip counts with an away member and a "no problem seen"); `roll-call-grid.test.ts` (the chip from the URL, a shown set that a mark does not change); `roll-call-rules.test.ts` and `prep-message.test.ts` follow the changed return shapes.
- Each new test was broken once on purpose and failed: `toRemind` ignoring the tracker, `toAccept` returning every not-set member, "To mark" also matching "no problem seen", `filterOf` defaulting to ✗, a new member entering a shown set.
- E2E on a local cluster of my own (port 54397, app 3587, bridge 54487), production build: the whole suite, 57 passed, 3 skipped (by design), phone and wide; the two new flows included.
- `pnpm check`: passed (Vitest 1,789 passed, 4 skipped; lint, types, migrations, i18n up to date).
- After the review and #688 (rebased on `dev`):
  - Render-level PGlite tests render `RaidPrepMarks` from real data. One checks the shield card offers "Mark ✓ the 1 seen with a shield" and "Show the 1", not the 4 not set. The other checks the card's ✓ link (`filter=yes`) opens the page on ✓ with exactly the "Shield up" and "no problem seen" tiles.
  - A test checks the event carries exactly `surface`, `kind` and `count_bucket`, and that a Roll call open is counted only from a linked count. `events.test.ts` checks that each surface takes only its own kinds.
  - The assertion that restated the dictionary's "To remind" string is gone.
  - Broken on purpose, each failed: `toAccept` returning every not-set member, ✓ not matching "no problem seen", an extra `n` property on the event.
  - `pnpm vitest related`: 162 files, 928 tests passed. `pnpm check`: passed (1,868 passed, 4 skipped); its first run failed on the brand guard, which read "#691" and "#678" in app comments as colour literals, now written "PR 691" / "issue 678".
  - E2E, fresh production build on my own cluster and ports: `desk-drilldown`, `desk` and `isolation` specs, 31 passed, 1 skipped.

## Open issues

- "n not read yet" still has no list (D3 above). The owner decides whether that count should leave away members out, which would let a grid switch show exactly them.
- The marking page's return after sign-in (`openRollCall`'s path) does not keep `?filter=`; a signed-out tap on a count lands on "To mark" after sign-in.

## Next

- Follow-up: D3 after the owner's answer on away members in "n not read yet".
- The spike's batches B and C.

What was missing from the task prompt? Whether "n not read yet" should keep counting away members; the answer decides whether D3 can be a grid switch.

PR: https://github.com/daniro-san/LAPTracker/pull/691
