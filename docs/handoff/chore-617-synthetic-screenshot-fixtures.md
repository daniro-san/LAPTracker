# chore/617-synthetic-screenshot-fixtures

Issue #617. Owner decision 2026-11-27: the real game screenshots leave the repository; "invented names only, never a real game screenshot" holds with no exception.

## Built

- Removed the 12 game screenshots in `fixtures/screenshots/` (`git rm`).
- In the 18 OCR text fixtures in `fixtures/screenshots/`, replaced every player name and every other alliance's tag with an invented one of the same shape: same length, case, digits and joiners, and the same misreads (a short read, a lost bracket, `rn` read as `m`, a digit read as a letter). Line order, ranks, numbers, R-badges and OCR noise are unchanged.
- Added `fixtures/screenshots/roster.json`: an invented 101-name OGs roster, the same size as the real one. `ogsCandidates()` (`lib/screenshot/test-helpers.ts`) now reads it, with uids from 900001. Before, it read the real roster in `fixtures/v1-20261116T105019Z/alliance-67111155.json`. For each name on a page, the roster spelling relates to the text the same way the real one did: exact, one edit away, a Cyrillic `і`/`е`, a trailing Hangul filler, an accent, a joined name. The other names are filler.
- Added three synthetic screens with invented names: `synthetic-alliance-duel-weekly-mine.png` (358 x 768), `synthetic-donation-weekly.png` (358 x 768) and `synthetic-secret-ops-report.png` (346 x 768). I drew them as HTML in the game screens' layout and rendered them with headless Chrome. Beside each is a `.txt` with what the real OCR read from it.
- Tests changed:
  - The opt-in OCR test (`read-screenshot.test.ts`), `prepare.test.ts` and `import-read.test.ts` now read the synthetic pictures.
  - `read-screenshot.test.ts` also asserts the row or entry count (8, 7, 6). Without it, a picture that read to nothing would still pass the "same parse" check.
  - In the parser, classifier, matcher, draft and thefts tests, the expected names and tags changed with the fixtures. No assertion was dropped or loosened.
  - The tests in `match-name.test.ts`, `name-key.test.ts`, `parse-paste.test.ts`, `classify.test.ts` and `parse-secret-ops.test.ts` had copied real names from these pages, and I replaced those too. So did the code comments in `match-name.ts`, `name-key.ts`, `parse-paste.ts` and `parse-secret-ops.ts`.
- Docs:
  - `fixtures/screenshots/README.md`: rewritten.
  - `fixtures/README.md`: the line about `screenshots/` changed.
  - D74: a dated amendment, and the real names removed from its "No Cyrillic data" line.
  - D96: a dated amendment.
  - CONTRIBUTING.md mentions no exception, so it is unchanged.

## Decisions

- **Hybrid approach.** The parser tests depend on real OCR misreads: a lost badge, rank 31 read as 3, a lost bracket, a time with no space, a name read short. A clean synthetic picture does not produce those. So the parser fixtures stay as text with the names replaced. The real-OCR test (`OCR_TEST=1`) gets three new synthetic pictures and their own recordings. Both keep the coverage they had, and no generator script is committed because no test regenerates the pictures.
- **Our own alliance's tag and name stay.** `[OGs]OldGrandmas` is the site's own alliance: it is in `config/alliances.ts`, and the workspace's own-tag filter tests use it. The other alliances' tags are invented, here and in the thefts tests that read report 54. In `lib/private/thefts.test-helpers.ts` the constant `RPD` became `KLV`; no other file imported it.

## Deviations

None from the task.

## Verified

- `pnpm vitest related --run <changed files>`: 13 files, 97 tests passed (3 skipped: the opt-in OCR test).
- `OCR_TEST=1 pnpm vitest run lib/screenshot/read-screenshot.test.ts lib/screenshot/prepare.test.ts`: 11 of 11 passed. This is the real Tesseract on the synthetic pictures.
- `pnpm check`: exit 0, 2039 tests passed.
- Coverage is unchanged:
  - The same parser, classifier and merge cases.
  - The matcher's "no wrong member, at least ten matched" test on pages 28 and 31.
  - The draft tests' "at least 8 sure on pages 27+28" count, the left-out row on the server page, and the thefts save counts (6 saved, 1 help, 2 own).
  - The OCR test on one page each of Alliance Duel, Donation and Secret Ops.
- A scan of the touched files finds none of the real names from the removed pages.

## Open issues

- **Git history still holds the removed screenshots and the real-name text.** Purging it means rewriting history and force-pushing `dev` and `main`. That is an owner-only step and was not done here.
- **Real names copied from these pages remain outside the fixtures,** in files this task did not cover. Check them by path:
  - Tests: `lib/private/discord.test.ts`, `lib/private/profile.test.ts`, `lib/private/roster-search.test.ts`, `lib/private/theft-groups.test.ts`, `app/(private)/_ui/theft-data.test.ts`, `app/(private)/api/w/[slug]/record-delete.test.ts`, `app/(private)/api/w/[slug]/thefts/route.test.ts`.
  - Code: `app/(private)/_ui/theft-data.ts`.
  - Decisions: `docs/decisions/D97-the-thefts-log.md`.
  - Old handoffs: `08zzd-leadership-layout.md`, `08zzs-brand-review.md`, `08zzzx-player-daily-progress.md`, `11d-screenshot-reader.md`, `11j-thefts.md`, `11k-screenshots.md`, `11n-shell-polish.md`.
  - Possibly `.specs/features/585-one-worklist/checks.md`, `e2e/fixtures/seed-people.ts` and `lib/private/me-parts.test.ts`. They share one surname-like word with a real name, which may be a coincidence.
- **The recorded `/v1` API fixtures (`fixtures/v1-*`, `fixtures/probe-*`) still hold the real roster's names.** `fixtures/README.md` keeps them as the upstream contract. They are outside this issue.

## Next

- Owner: decide whether to purge git history (force-push to `dev` and `main`).
- Follow-up issue: replace the real names listed under Open issues with invented ones.
- Follow-up question for the owner: do the `/v1` API fixtures fall under the same rule?

What was missing from the task prompt? Whether our own alliance's tag (`[OGs]OldGrandmas`, public in `config/alliances.ts`) counts as a name to invent. I kept it.

PR: (added by the orchestrator)
