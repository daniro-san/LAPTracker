# 11d — Screenshot reader engine (D74, issue #299, engine only)

Base: `origin/dev` at 34d75bc. Branch `session/11d-screenshot-reader`. No route, no page, no database access, no upstream API call.

## Built
- `lib/screenshot/name-key.ts`: `nameKey(name)` and `nameSegments(name)`.
- `lib/screenshot/match-name.ts`: `matchName(raw, candidates)` returning `matched` (via `current`, `past` or `segment`), `unsure` (up to 3 suggestions) or `none`.
- `lib/screenshot/ranking.ts`: what the two ranking parsers share (rank inference, pinned row, flags).
- `lib/screenshot/parse-alliance-duel.ts`: `parseAllianceDuelRanking(lines, {scope, day?})`.
- `lib/screenshot/parse-donation.ts`: `parseDonationRanking(lines)`.
- `lib/screenshot/parse-secret-ops.ts`: `parseSecretOpsReport(lines)`, French, English and Portuguese.
- `lib/screenshot/parse-paste.ts`: `parseRankingPaste(text)`, the validation's paste parser, ported to TypeScript.
- `lib/screenshot/prepare.ts`: PNG to 8-bit grey at 716 px wide, with `node:zlib` only. A PNG with no pixels, more than 40 million pixels (before or after resizing) or more pixel data than its header says throws `ImageRefusedError`.
- `lib/screenshot/read-screenshot.ts`: the one OCR module. `readScreenshot(image)` and `openScreenshotReader()` (one worker for several pictures).
- `lib/screenshot/tessdata/eng.traineddata.gz`: the English model (2.95 MB).
- `lib/screenshot/test-helpers.ts` and ten test files beside the modules (67 tests run by default, 3 more with `OCR_TEST=1`).
- `fixtures/screenshots/`: 12 pictures, the OCR text recorded from each (`.txt`), and a README with one line per picture. `fixtures/README.md`: one paragraph pointing to it.
- `docs/decisions/D74-screenshot-reader-free-ocr-with-tesseract-js.md` and its index line.
- `package.json`, `pnpm-lock.yaml`: `tesseract.js` 7.0.0, exact. `pnpm-workspace.yaml`: its postinstall denied (D10).
- `docs/ARCHITECTURE.md`: one map line and one dependency-rule line for `lib/screenshot`. `eslint.config.mjs`: a zone that makes `lib/screenshot` import nothing from the project.

## Decisions
- **Package and data:** see D74 (version, release date, install script, committed English data, no Russian data, no image library).
- **Row anchor.** A ranking row is found by its number (points or contribution, written with a comma, dot, space or U+202F between groups of exactly three), not by a layout. The OCR scrambles the order of a row's parts, and the gold, blue and bronze rows 1 to 3 lose their names, so a row needs only its number to exist. A rank written before a number is read first (`100 123,456` is rank 100, then 123,456).
- **Rows whose number was not read.** They come back with `points: null` (`contribution: null` for Donation) and the flag `points`. Alliance Duel: a tag line that no points line claimed is such a row. Donation: a line with a rank and a name of at least 3 characters and no number. `gap` marks a row whose read rank does not follow the read rank of the row above; a misread rank therefore flags its own row and the next one.
- **Ranks.** Each row's rank is its place plus the offset most rows agree on (rank read minus place). A page whose ranks were all misread has none (`rank: null`). A read rank that disagrees with the place gives the flag `rank`.
- **Pinned row.** The last row is dropped when its read rank is not the one its place gives, or its points are above the nearest row above that has points. On Alliance Duel pages it is also dropped when its number was not read (those screens always pin a row). On Donation pages a last row without a number stays, because the pinned row there is usually not read at all. It is not dropped by position alone: when the OCR does not read the pinned row's number (images 22, 24, 25, 29, 31), the last row on the list is often a real row and positional dropping would lose it. A pinned row that continues the sequence (the viewer ranks directly after the last visible row) stays; it carries the same values as the partly hidden row it duplicates.
- **Result shape.** `parseAllianceDuelRanking` returns a flat array of rows, each carrying `scope` and `day` (`day` is a string the caller chooses, for example the server date), plus `flags` (`order`, `rank`, `gap`, `points`). `parseDonationRanking` rows carry `flags` too. Secret operations entries carry `raw`, the line the player was read from, for the review screen. `name` is `""` and `tag` is `""` when the OCR did not read them; `at` is `null` when the time was not read.
- **Tags are returned as read.** The OCR reads `OGs` as `0Gs` or `065`. The parser does not repair tags; the alliance is known from context in `My Alliance` lists.
- **Secret operations.** An entry with no readable sentence under its name comes back with `kind: null` (a person says which it is). Entry type from the sentence under the name: `d.rob` (theft), `aid` (help) in French; the English and Portuguese keywords (`stole`, `helped`, `roubou`, `ajudou`) are built from the French structure and are not checked against the game. Tests for them use invented lines and say so.
- **Matching.** `matchName` never picks between two members with one key. A part of a joined name (`Kasoar` for `Kasoar•Thorne`, either direction) matches only when one member has it and the part has at least 3 characters. Approximate matches are always `unsure`, never `matched`.
- **`nameKey` look-alikes.** Cyrillic а в е к м н о р с т у х і ј ѕ and Greek α ε ι κ ν ο ρ τ υ χ map to Latin. Accents are removed, so `Vińs` equals `Vins`. `º` becomes `o` by NFKC (`Baltazaro12º` has the key `baltazaro12o`).
- **Pasted ranking.** The last row is taken as the pinned row only when both ranks are known and break the sequence, or its value is above the row before.
- **`readScreenshot(image)` has no `kind` argument.** All three screens read best as one block of lines (page segmentation mode 6, the same setting for each), so a `kind` would be an unused parameter.

## Deviations
- `readScreenshot(image, kind)` was specified; it is `readScreenshot(image)`. Reason in Decisions.
- The pinned row rule is not "by position" alone. Reason in Decisions.
- `parseAllianceDuelRanking` returns the rows with `scope` and `day` on each row, instead of a bare `{rank, name, tag, points}`: the issue says each import is tagged with its scope, and a flat array keeps the specified shape.
- A Discord post screenshot was tested locally and not committed: it shows a private chat and the repository is public.
- Added an `import-x/no-restricted-paths` zone for `lib/screenshot` (D34 says the dependency rule is linted). It was not asked for; it is one entry.

## Verified
- `pnpm check`: green (prettier, eslint, tsc, vitest, drift, i18n). Vitest: 83 files passed and 2 skipped, 432 tests passed and 4 skipped.
- `OCR_TEST=1 pnpm exec vitest run lib/screenshot/read-screenshot.test.ts`: 3 of 3 passed (about 3 s). It reads images 27, 22 and 53 with the real OCR and compares lines (at least 90% identical) and parsed rows with the recording. It is skipped in `pnpm check`.
- The 12 pictures re-read with the real OCR: the lines were identical to the recorded text for 12 of 12 (checked again after the review fixes).
- Real OCR over every committed picture, parsed, matched against the OGs roster (`fixtures/v1-20261116T105019Z/alliance-67111155.json`, `members[].nick_name`, 101 members, one name each). Truth was typed by eye from the pictures. "Right rank" means the parsed row with the true rank exists. For Secret Operations it counts the right kind (theft or help) and the right time, in order. `unsure (hit)` is how many unsure results listed the true member.

| picture | rows found / on screen | numbers exact | ranks / kinds right | matched / unsure (hit) / none | wrong matches | ms |
|---|---|---|---|---|---|---|
| 22 donation | 7/7 | 7/7 | 7/7 | 5 / 1 (1) / 1 | 0 | 484 |
| 23 donation | 7/7 | 7/7 | 7/7 | 4 / 2 (2) / 1 | 0 | 506 |
| 24 donation | 7/7 | 7/7 | 7/7 | 7 / 0 / 0 | 0 | 600 |
| 25 donation | 7/7 | 7/7 | 7/7 | 7 / 0 / 0 | 0 | 684 |
| 26 duel, server-wide | 8/8 | 8/8 | 8/8 | 5 / 1 (1) / 2 | 0 | 1139 |
| 27 duel, My Alliance | 8/8 | 8/8 | 8/8 | 6 / 1 (1) / 1 | 0 | 800 |
| 28 duel | 8/8 | 8/8 | 8/8 | 6 / 2 (2) / 0 | 0 | 678 |
| 29 duel | 8/8 | 8/8 | 8/8 | 7 / 1 (1) / 0 | 0 | 641 |
| 30 duel | 8/8 | 8/8 | 8/8 | 7 / 0 / 1 | 0 | 655 |
| 31 duel | 8/8 | 7/8 | 8/8 | 6 / 1 (1) / 1 | 0 | 628 |
| 53 secret ops | 6/6 | 6/6 (times) | 6/6 | 3 / 1 (1) / 2 | 0 | 642 |
| 54 secret ops | 6/6 | 6/6 (times) | 6/6 | 0 / 2 (2) / 4 | 0 | 727 |
| total | 88/88 | 87/88 | 88/88 | 63 / 12 (12) / 13 | 0 | mean 776 |

  - The only wrong number: image 31, row 33, `42,831,997` read for `42,831,971`. The order check cannot see it (it is below the row above).
  - Of 78 names that belong to a roster member, 63 matched, 12 were unsure with the right member listed, and 3 found nothing. Names that are not in the roster (other alliances' players, thieves, `BeksWiFeY`) gave `none` or an unsure list; none was matched to a member.
  - Gold, blue and bronze rows (ranks 1 to 3) lose their names: `ny21dvl` was read as `vi` and `Ker`. `Kasoar•Thorne` was read as `KasoarsThorne` (unsure, right member).
  - This table is a one-off measurement, run by hand with the truth typed from the pictures; no test repeats it. The tests guard: the parsers on the recorded text of all 12 pictures; the name matcher on the names read from pages 28 and 31 (no name matched to a member it does not belong to, at least ten matched); the real OCR on pages 27, 22 and 53 under `OCR_TEST=1`. Re-run after the review fixes (parsers changed): the same table.
- **Time and memory.** One worker, English data, 12 pictures: 0.46 to 1.9 s per picture, mean 0.78 s (last run), load average 23 to 36 on 10 cores (other agents). Under the heaviest load of the session a page took up to 27 s and the worker start 8 s. Worker start in the lightest run: 0.14 s. Peak resident memory of the whole process, including `tsx`: 145 to 178 MB. Not measured on Vercel.
- Phone-size input: images 27, 28 and 22 enlarged to 1170 px wide (synthetic, not real phone screenshots) through `prepare.ts`: 8 of 8, 8 of 8 and 7 of 7 rows.
- Free alternative to `sharp` measured: the same pictures through `sharp` Lanczos gave 89 rows found for 88 on screen (one extra row on image 27), 88 numbers exact, 60 names matched, no wrong name; `prepare.ts` gave 88 found, 87 exact, 0 wrong (both measured with the 13th picture, a private Discord post that is not committed, which read nothing). See D74.
- Not run: no real phone-resolution screenshot exists in the shared set; a Daily tab of Alliance Duel; any English or Portuguese game screen; a Vercel build or deploy.

## Open issues
1. **Vercel bundling is unverified.** The route session must ship `tesseract.js-core`, the worker script and `lib/screenshot/tessdata` with the function and check the size and `maxDuration`. D74 names the Next settings (`serverExternalPackages`, `outputFileTracingIncludes`). It reads the data folder from `process.cwd()`.
2. **Browser or server.** Issue #299's recommendation was to run Tesseract.js in the officer's phone browser so the picture never leaves the device. This session built the server side as asked. The parsers and `matchName` are pure and run in a browser unchanged; `prepare.ts` (uses `node:zlib`) and `read-screenshot.ts` (uses `process.cwd()`) do not. A browser path needs its own reader (canvas for the grey and the width) and `eng.traineddata.gz` served as a static file. The UI session must choose.
3. **Only plain PNG is enlarged or reduced.** A JPEG or a 16-bit or interlaced PNG reaches Tesseract unchanged. A PNG with no pixels or over 40 million pixels (before or after resizing) throws `ImageRefusedError`; the route must turn it into a 4xx. A 1170 px JPEG read 8 of 8 rows unchanged; a small JPEG will not. The upload route should limit size and may re-encode.
4. **The Daily tab.** No screenshot of it exists. `parseAllianceDuelRanking` takes `scope: "daily"` and `day` and tags the rows; its layout is assumed to equal the Weekly tab. Check against a real picture.
5. **English and Portuguese Secret Operations wording** is unverified (the keywords above). Add a real report in each language before relying on it.
6. **Tags and medal rows.** Tags come back as the OCR read them (`0Gs`, `065`). The names of ranks 1 to 3 are mostly unreadable; the review screen must make the officer fix them. A thief's name with a misread closing bracket comes back with an empty tag and the tag glued to the name (`dpxjone234`, `ANMcinalice`).
7. **Pinned row, two ways to be wrong.** A pinned row survives when its rank is unread and its points are below the row above. On Alliance Duel pages a real last row whose number was not read is dropped when the pinned row is not read either (its number and tag both lost). No picture in the set shows either.
8. **`wasm-feature-detect` 1.10.1** (a dependency of `tesseract.js`) was published 2026-11-11, five days before this session. The lockfile pins it. An override to 1.9.0 (2026-08-11) is possible; not done.
9. **Time of an entry has no year or zone.** `at` is `MM-DD HH:MM` in server time (UTC-2, `SERVER_TZ`). The caller supplies the year from the import date.
10. **No name candidates query yet.** `matchName` takes `{uid, names[]}` with the current name first and past names after. Building them from `nameHistory` / `sightingsOf` (`lib/queries/players.ts`) and `daily_rosters.member_names` is the UI session's job; no database code was written here.
11. **Images 55 and 56** (the thief's "Info de Docteur" card) have no parser and are not committed.
12. **Name keys are recomputed per call; build an index only if a roster grows past a few thousand names.**
13. **`openScreenshotReader` has a unit test with a mocked worker** (settings refused: the worker is terminated and the error rethrown). Reading with the real worker is covered only under `OCR_TEST=1`.
14. **`OCR_TEST` threshold.** The opt-in test needs at least 90% of the recorded lines to match, because the WebAssembly core is chosen by CPU features and may differ slightly between machines. It passed with 100% here.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`. The next piece of issue #299 is the screenshot import UI: photo upload, a review screen with confirm and fix per row, and the route that runs the reader. It follows 11c (the workspace sign-in, #295): every workspace route needs a leadership session.
Model / effort: raise one. It adds an upload boundary (size, type, rate limit, private data under D71), a route that runs a WebAssembly OCR on Vercel (Open issues 1), and the review screen's confirm step; a wrong write there records false names.
Owner must do first: decide whether the OCR runs in the phone browser or on the server (Open issues 2); send one real phone-resolution screenshot of each screen (Alliance Duel Daily, Donation, Secret Operations in English and Portuguese if the leadership has them); confirm the 11c sign-in is merged.
Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`; D74 holds the dependency decision, so D7's table is not extended.

<adjustments>
- Reader and parsers are done: do not rebuild them. Call `openScreenshotReader()` once per request, `read(bytes)` per picture, then the parser for the screen the officer chose; `parseRankingPaste(text)` is the "copy text from photo" path.
- The screen kind is the officer's choice in the UI; nothing detects it from the picture.
- `matchName` needs candidates built outside it: for the workspace's own alliance, `{uid, names: [currentName, ...pastNames]}`. Pick the names from the latest daily roster (`daily_rosters.member_names`) and the history in `lib/queries/players.ts`. Nothing blocked by D71 is needed: only names.
- The review screen should show, per row: the OCR text (`raw` for Secret Operations), the points, the `flags`, and for an `unsure` name the suggestions. Rows with an empty `name` or `rank: null` need input. Matched names still need one confirm tap because the OCR can drop characters.
- Rows 1 to 3 of an Alliance Duel page almost never have a readable name; expect an officer to pick the member for those.
- A page has about 7 to 8 rows (about 13 pages cover 101 members); one picture takes 0.4 to 1.1 s on a free core, so a 13-picture import is under about 15 s of OCR plus upload time, if the function gets a CPU of its own.
- The same members appear on consecutive pages when the list is scrolled partway; the import must de-duplicate by rank or uid. Page 28 shows one member twice (real row and pinned row); the parser already removes the pinned copy.
- Secret Operations: the thief's tag may be empty. The thief's server comes from the "Info de Docteur" card (images 55 and 56), which has no parser; the issue (#321) can start with an officer typing the server.
- Alliance Duel points per member per day and per week, and the daily-against-weekly disagreement flag from the owner's comment on #299, are not built; they need the storage design.
- Decision numbers: D74 is this one; D72 is the end-of-day read (see the 11a handoff); D73 was not seen.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/323
