## D119 — A notice carries one picture, stored in Neon, served only behind the notice's own access (2026-11-18, owner, 11ak, issue 419; amends D102, D105, D108, D110)

Why: officers want to show a map, a schedule or a game screen with a notice. The owner wants it only if it stays free.

**Count.** One picture per notice, shared by every language. Replace overwrites it; Remove deletes it.

**Storage: Neon, not Vercel Blob.**

- A new table, `notice_pictures` (migration `0042_notice_pictures`): `notice_id` (primary key, `cascade`), `workspace_id`, the bytes in a `bytea` column, `type`, `width`, `height`, `bytes`, `hash` (the bytes' SHA-256, first 16 hex characters), `added_by`, `added_at`. Check constraints repeat the caps: type in WebP/JPEG/PNG, 1–409,600 bytes, 1–1600 px a side.
- Why not Blob (cost check on the issue, 2026-11-18, Vercel's Blob pricing): Hobby includes 1 GB stored, 10 GB transfer, 2,000 uploads and 10,000 uncached reads a month, never charges, and stops Blob for 30 days when a limit is passed. Our estimate, a few dozen notices a month at about 200–300 KB each, is about 10 MB a month: about 1 % of those limits. Both options are free. Neon needs no new dependency, no token and nothing for the owner to set up, and the picture stays behind the same access check as the notice, so Neon was chosen.
- Neon's budget: Neon Free is 1 GB per project; the Friday check warns above 700 MB (plan §6.1). At 30 pictures a month at the 400 KB cap, the table grows at most about 12 MB a month (about 145 MB a year); at a typical 250 KB, about 90 MB a year. Each view of a picture is read from Neon (5 GB transfer a month on Free); the ETag below makes a repeat view a 304 without the bytes.
- No drizzle `bytea` column in drizzle-orm 0.45: a `customType` in `lib/schema-notices.ts`.

**Processing in the browser** (`app/(private)/_ui/notice-picture-prep.ts`, the plan in `lib/private/notice-picture-rules.ts`).

- `createImageBitmap` decodes the file; a canvas draws it at most 1600 px on its long side (never enlarged) and re-encodes it as WebP, or JPEG where the browser cannot encode WebP (a browser that cannot gives back a PNG; then JPEG is used).
- Re-encoding through a canvas drops EXIF, so the phone's location and camera data never leave the device.
- The quality steps down 0.86, 0.78, 0.70, 0.62, 0.54, 0.46 until the file fits 400 KB; if the lowest quality does not fit, the picture is drawn 80 % smaller and the qualities are tried again, down to 320 px. A picture that cannot be read or made to fit gets "This picture could not be used. Try another one."

**Server check, never trusting the client** (`checkPicture`, `lib/private/notice-picture.ts`).

- Magic bytes: WebP (`RIFF…WEBP`), JPEG (`FF D8 FF`) or PNG (its signature), whatever the request's content type says: 415 `wrong_type`.
- At most 400 KB (409,600 bytes): 413 `too_large`, also from `Content-Length` before the body is read.
- The size the header states (`pictureSize`, which now reads a PNG's IHDR too), at most 1600 px a side: 422 `too_big_sides`. A header whose size cannot be read is `wrong_type`.
- The server does not decode the pixels. A file with a valid header but broken data is stored and simply does not draw.

**Writes.** `POST /api/w/[slug]/notices/picture?id=N` with the picture as the body (same origin, a picture content type, an officer session, 401 `signed_out` per D99) adds or replaces it. `POST /api/w/[slug]/notices/picture/remove {id}` removes it. One row per notice, so a retry stores the same picture once; no request id is needed (D100's rule is about duplicates, which the primary key rules out). A notice in the trash (D118) takes no picture change: both routes answer 410 `notice_deleted`, and the editor shows D118's "Restore from trash?" as it does for a text save. The held picture change stays in the editor and goes in with the next Save after the restore.

**Serving: `/img/notice/[id]`** (`app/(private)/img/notice/[id]/route.ts`, in the private group so it may use lib/private; the address has no slug).

- The picture's row names its workspace; the request's session must pass that workspace's door. An officer (`requireWorkspace`) gets it. A member's session (`requireBoard`) gets it only while the members' board shows the notice today (D105: "Show to members" on, end day not passed). A session of another workspace, a signed-out browser, a missing picture and a deleted notice (D118) all get the same 404 (`private, no-store`), so a refusal says nothing.
- `Cache-Control: private, no-cache` with `ETag` (the hash): never in a shared cache, and every view checks access again; an unchanged picture answers 304 without its bytes. The pages' address carries `?v=<hash>`, so a replaced picture is fetched anew.
- A picture is never served publicly. Next's image optimiser is not used: it would fetch the picture without the viewer's session.
- A deleted notice's picture is kept for Undo (D118) but is neither served nor posted.

**Where it shows.**

- The notices editor: a "Picture" part after the writing tools, with a preview and Add a picture, Replace, Remove and Undo. The change is held like the text and sent on Save: before the text for a saved notice (a refused picture leaves everything unsaved: "The picture was not saved, and nothing else was. Press Save to try again."), after the text for a new notice, which needs its id first (a failure there: "The notice is saved, but its picture is not. Press Save again to send the picture."; the retried Save finds the same notice by its request id, D100).
- The notice page, under the title; the members' board, in the notice's card.
- Publish to Discord (D102 amended): the picture goes with the first message, as a multipart webhook upload (`payload_json` and `files[0]`), with an embed whose image is `attachment://notice.webp` (or `.jpg`, `.png`). `allowed_mentions` stays empty. The log line adds `pictures: 0|1`.

**Home's activity (D108 amended).** One line: "Ana added a picture to “Rota”" (PT "Ana adicionou uma imagem a “…”", FR "Ana a ajouté une image à l’annonce « … »"), from `added_by`/`added_at`. A replace is the same line at its new time; a removal has none.

**Words.** PT says "imagem", not "print": a print is a screenshot read for data (D110).

**Not now.** The Android share target (D110) does not offer a notice picture yet; a later session can add "Add to a notice" there.

**Weekly cleanup, with a warning first (owner, 2026-11-18; migration `0043_notice_picture_cleanup`).**

- **Due.** A picture is due once its notice's end day (the newest `ends_on`) is more than 90 days before the server day (`PICTURE_KEEP_DAYS`, `lib/repo/notice-picture-cleanup.ts`). A notice with no end day is never cleaned. The notice and its text always stay, and a picture can be added again.
- **Warning on Home.** From 7 days before a picture is due (`WARN_DAYS`), Home shows a card: "The pictures of 3 notices will be deleted after Nov 25: “A”, “B”, “C”." with "Review them" (one picture: "The picture of “A” will be deleted after …"). The card names three notices and says "and N more" for the rest. The date is the earliest day after which one may go.
- **Review list** (`/w/[slug]/notices/pictures`): each due picture with a thumbnail, its notice's title (a link) and "Deleted after {date}", the soonest first. Three actions, each a 44 px button:
  - **Keep.** The picture is never cleaned. Who and when are stored (`kept_by`, `kept_at`). The editor's picture part shows "Kept · Ana kept it on Nov 18. The weekly cleanup never deletes it." with "Stop keeping", which takes effect at once.
  - **Download.** `/img/notice/[id]?download=1` sends the file as an attachment, for officers only.
  - **Use in another notice.** Pick a live notice of the same workspace; the bytes are copied to it (`copied_from`), replacing its picture if it had one. The copy has its own clock: not kept, not warned.
- **The 7 days are real.** The weekly job, right after the Friday check claims its run (`lib/tick.ts`, no new cron), works in three steps:
  1. It deletes only due, unkept pictures whose warning began at least 7 days ago (`warned_at`).
  2. It records `warned_at` for the unkept pictures now within 7 days of being due.
  3. It clears `warned_at` when an end day moves away, so a later warning starts its own 7 days.

  So a picture that becomes due is never deleted in the week it does. A replaced picture, a copy, Keep and Stop keeping all start the clock again. The date the card shows is never earlier than the real deletion, which comes at the first weekly run on or after it.

- **Logs.** The job logs `notices.pictures.pruned` with the count only. A failure logs `notices.pictures.prune_failed` with the error's class name and returns 0, so the Friday check never answers 500. The tick's answer carries `pictures_pruned`.
- **Home's activity.** "Ana kept the picture of “…”" (PT "manteve a imagem de", FR "a gardé l’image de l’annonce") and "Ana used the picture of “A” in “B”" (PT "usou a imagem de … em …", FR "a utilisé l’image de … dans …"). A copy does not also read "added a picture". Each picture part of the feed takes the page's cursor (D108, #426): `added_at < before`, or `kept_at < before` for Keep, so no picture line repeats from page to page.
- **Analytics** (D115; review of PR 422). Picture changes count under `notice` with their own actions: `picture_add`, `picture_remove`, `picture_keep`, `picture_unkeep`, `picture_reuse`, `picture_download`. Each counts only when a row really changed: the same bytes again, a remove with nothing to remove, or a keep of a kept picture is not counted. See docs/analytics/tracking-plan.md.

**Amendments after the review of PR 422 (2026-11-18).**

- **Uploads.** The upload route reads the body only with a `Content-Length` of at most 400 KB: 411 `length_required` without one, 413 over it. Animated pictures are refused (422 `animated`): a WebP whose VP8X header sets the animation flag, or a PNG with an `acTL` chunk. A check constraint, `octet_length(data) between 1 and 409600`, guards the stored bytes themselves.
- **Decoding.** The browser decodes straight at the upload size (`createImageBitmap` with `resizeWidth` and `resizeHeight` from the header's size, swapped for a JPEG whose EXIF orientation turns it a quarter turn), so a 48 MP photo is never decoded at full size on a low-end phone. `pictureSize` (`lib/screenshot/picture-size.ts`) is browser-safe now.
- **Half-saves in the editor.** When the picture went in and the text save after it fails, the editor holds no picture change any more and reads the stored picture again, so it stays in step. A picture-only save closes the editor. A refused picture (413, 415, 422) reads "This picture could not be used. Try another one." rather than "Press Save to try again".
