# Screenshots

Game screens used by `lib/screenshot` tests (D74, issue #299). All shared with the working session on 2026-11-16 (the numbers in the table are the shared images' numbers). The game screens are 346-358 px wide. They show player names and alliance tags that anyone in the game sees; no roster field that D71 blocks.

Each `<name>.txt` is the text lines the real OCR (`lib/screenshot/read-screenshot.ts`) read from `<name>.png`, one line per row, recorded with `tesseract.js` 7.0.0 and the English model. They were recorded again on 2026-11-16 in session 11k, when `prepare.ts` started flattening each row against its background (issue #299); the parsed rows stayed the same or got better (picture 31's one wrong number is now right). Tests run the parsers on this text, so the default run needs no OCR. They are the contract with the OCR: a text file is not edited by hand. To compare the real OCR with them: `OCR_TEST=1 pnpm vitest run lib/screenshot/read-screenshot.test.ts` (slow, not part of `pnpm check`).

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

**Phone pictures, text only.** Six game-public ranking screens from the owner's iPhone (923 x 2000 JPG, shared 2026-11-16) are kept as recorded OCR text only, with no picture, so no avatar is committed. Each was converted to PNG, its status bar dropped (`statusBar: true`), and read by the real OCR in session 11k:

| Text | What it shows |
|---|---|
| `87-donation-weekly-phone.txt` | Donation, Weekly: rows 1-6 (medals 1-3, the uploader's green row 4), pinned own row 4 |
| `88-donation-daily-phone.txt` | Donation, Daily: the same rows on the Daily tab |
| `89-kills-phone.txt` | Kills: rows 1-7, pinned own row 15 |
| `90-might-phone.txt` | Might: rows 1-7 (green own row 4), pinned own row 4 |
| `98-alliance-duel-weekly-phone.txt` | Alliance Duel, Weekly, My Alliance: rows 1-8, pinned own row 76 |
| `99-alliance-duel-daily-phone.txt` | Alliance Duel, Daily (Mon tab), My Alliance: rows 1-7, a cut row 8, pinned own row 76 |

The notices, mails, event results, map and chat pictures of the same set are not kept: they are not ranking screens, and the chats are private. Tests for their kinds use invented lines and say so. The thief's "Info de Docteur" card (images 55, 56) has no parser and is not kept.

A Discord post screenshot was tested locally and not committed: it shows a private chat and the repository is public.
