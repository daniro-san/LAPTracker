# Screenshots

OCR text and synthetic pictures for the `lib/screenshot` tests (D74, D96, issue #299). Every name here is invented. No real game screenshot is committed (owner, 2026-11-27, issue #617; CONTRIBUTING.md, "The repo is public").

**Text fixtures.** Each numbered `<name>.txt` started as the text lines the real OCR (`lib/screenshot/read-screenshot.ts`, `tesseract.js` 7.0.0, English model) read from a game screenshot shared on 2026-11-16, recorded again in session 11k when `prepare.ts` started flattening each row against its background. On 2026-11-27 (issue #617) the screenshots were removed. Each player name and each other alliance's tag in the text was replaced by an invented one of the same shape: same length, case, digits and joiners, and the same misreads (a name read short, a lost bracket, `rn` read as `m`). Line order, ranks, numbers, R-badges and OCR noise are unchanged, so the parsers, the classifier and the draft tests run on the same cases. Our own alliance's tag and name (`[OGs]OldGrandmas`, `config/alliances.ts`) are kept. Tests run the parsers on this text, so the default run needs no OCR. Edit a file only to fix a test case on purpose, and keep its shape.

| Text | What it shows |
|---|---|
| `22-donation-weekly.txt` | Might Ranking, Donation tab, Weekly: rows 94-100, the viewer's pinned row (58) under the list; row 97's badge misread |
| `23-donation-weekly.txt` | Donation, Weekly: rows 87-93 |
| `24-donation-weekly.txt` | Donation, Weekly: rows 79-85; row 81's badge read as `_` |
| `25-donation-weekly.txt` | Donation, Weekly: rows 71-77 |
| `26-alliance-duel-weekly-server.txt` | Alliance Duel Rank, Weekly, server-wide: rows 1-8, another alliance's row 3, pinned own row (19) |
| `27-alliance-duel-weekly-mine.txt` | Alliance Duel Rank, Weekly, My Alliance: rows 1-8 (medals 1-3), pinned own row (15) |
| `28-alliance-duel-weekly-mine.txt` | My Alliance, Weekly: rows 9-16; the viewer is row 15 and is also pinned |
| `29-alliance-duel-weekly-mine.txt` | My Alliance, Weekly: rows 17-24 |
| `30-alliance-duel-weekly-mine.txt` | My Alliance, Weekly: rows 25-32; rank 31 read as `3` |
| `31-alliance-duel-weekly-mine.txt` | My Alliance, Weekly: rows 33-40 |
| `53-secret-ops-report.txt` | "Rapport d'Opération secrète" (French UI): 2 thefts and 4 helps, 11-15; one thief's bracket lost |
| `54-secret-ops-report.txt` | The same report further down: 4 thefts and 2 helps, 11-14 and 11-15; a time's space lost |
| `87-donation-weekly-phone.txt` | Phone, Donation, Weekly: rows 1-6 (medals 1-3, the uploader's green row 4), pinned own row 4 |
| `88-donation-daily-phone.txt` | Phone, Donation, Daily: the same rows on the Daily tab |
| `89-kills-phone.txt` | Phone, Kills: rows 1-7, pinned own row 15 |
| `90-might-phone.txt` | Phone, Might: rows 1-7 (green own row 4), pinned own row 4 |
| `98-alliance-duel-weekly-phone.txt` | Phone, Alliance Duel, Weekly, My Alliance: rows 1-8, pinned own row 76 whose rank was lost |
| `99-alliance-duel-daily-phone.txt` | Phone, Alliance Duel, Daily (Mon tab), My Alliance: rows 1-7, a cut row 8, pinned own row 76 |

**Roster.** `roster.json` is OGs' invented roster (101 names, the size of the 2026-11-16 roster) that the name-matching and draft tests match the text against (`ogsCandidates` in `lib/screenshot/test-helpers.ts`, uids from 900001). It holds the clean spelling of each name on the pages, the look-alike cases the matcher must handle (a Cyrillic `і` and `е`, a trailing Hangul filler, an accent, a joined name) and filler names.

**Synthetic pictures, for the opt-in OCR test.** Three screens drawn with invented names in the layout of the game's screens and rendered by headless Chrome on 2026-11-27: `synthetic-alliance-duel-weekly-mine.png` (358 x 768, rows 1-8 with medals, green pinned row 15), `synthetic-donation-weekly.png` (358 x 768, rows 94-100 with R-badges, pinned row 58) and `synthetic-secret-ops-report.png` (346 x 768, 2 thefts and 4 helps). Each `.txt` beside them is what the real OCR read from it that day. To compare the OCR with them: `OCR_TEST=1 pnpm vitest run lib/screenshot/read-screenshot.test.ts` (slow, not part of `pnpm check`). `prepare.test.ts` also reads the Alliance Duel picture.

The notices, mails, event results, map and chat screens are not kept: tests for their kinds use invented lines and say so. A Discord post screenshot was tested locally and not committed: it shows a private chat and the repository is public.
