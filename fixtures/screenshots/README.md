# Screenshots

Game screens used by `lib/screenshot` tests (D74, issue #299). All shared with the working session on 2026-11-16 (the numbers in the table are the shared images' numbers). The game screens are 346-358 px wide. They show player names and alliance tags that anyone in the game sees; no roster field that D71 blocks.

Each `<name>.txt` is the text lines the real OCR (`lib/screenshot/read-screenshot.ts`) read from `<name>.png`, one line per row, recorded on 2026-11-16 with `tesseract.js` 7.0.0 and the English model. Tests run the parsers on this text, so the default run needs no OCR. They are the contract with the OCR: a text file is not edited by hand. To compare the real OCR with them: `OCR_TEST=1 pnpm vitest run lib/screenshot/read-screenshot.test.ts` (slow, not part of `pnpm check`).

| Picture | What it shows | Source |
|---|---|---|
| `22-donation-weekly.png` | Might Ranking, Donation tab, Weekly: rows 94-100, the viewer's pinned row (58) under the list | game screenshot, shared 2026-11-16 (image 22) |
| `23-donation-weekly.png` | Donation, Weekly: rows 87-93 | image 23 |
| `24-donation-weekly.png` | Donation, Weekly: rows 79-85 | image 24 |
| `25-donation-weekly.png` | Donation, Weekly: rows 71-77 | image 25 |
| `26-alliance-duel-weekly-server.png` | Alliance Duel Rank, Weekly, server-wide: rows 1-8, other alliances' tags, pinned own row (19) | image 26 |
| `27-alliance-duel-weekly-mine.png` | Alliance Duel Rank, Weekly, My Alliance: rows 1-8 (medals 1-3), pinned own row (15) | image 27 |
| `28-alliance-duel-weekly-mine.png` | My Alliance, Weekly: rows 9-16; the viewer is row 15 and is also pinned | image 28 |
| `29-alliance-duel-weekly-mine.png` | My Alliance, Weekly: rows 17-24 | image 29 |
| `30-alliance-duel-weekly-mine.png` | My Alliance, Weekly: rows 25-32 | image 30 |
| `31-alliance-duel-weekly-mine.png` | My Alliance, Weekly: rows 33-40 | image 31 |
| `53-secret-ops-report.png` | "Rapport d'Opération secrète" (French UI): 2 thefts and 4 helps, 11-15 | image 53 |
| `54-secret-ops-report.png` | The same report further down: 4 thefts and 2 helps, 11-14 and 11-15 | image 54 |

The Daily tab of Alliance Duel is not recorded: no screenshot of it exists yet. The thief's "Info de Docteur" card (images 55, 56) has no parser and is not kept.

A Discord post screenshot was tested locally and not committed: it shows a private chat and the repository is public.
