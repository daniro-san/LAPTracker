## D119 — A notice carries one picture, stored in Neon, served only behind the notice's own access (2026-11-18, owner, 11ak, issue 419; amends D102, D105, D108, D110)

Why: officers want to show a map, a schedule or a game screen with a notice. The owner wants it only if it stays free.

**Count.** One picture per notice, shared by every language. Replace overwrites it; Remove deletes it.

**Storage: Neon, not Vercel Blob.**

- A new table, `notice_pictures` (migration `notice_pictures`): `notice_id` (primary key, `cascade`), `workspace_id`, the bytes in a `bytea` column, `type`, `width`, `height`, `bytes`, `hash` (the bytes' SHA-256, first 16 hex characters), `added_by`, `added_at`. Check constraints repeat the caps: type in WebP/JPEG/PNG, 1–409,600 bytes, 1–1600 px a side.
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

**Writes.** `POST /api/w/[slug]/notices/picture?id=N` with the picture as the body (same origin, a picture content type, an officer session, 401 `signed_out` per D99) adds or replaces it. `POST /api/w/[slug]/notices/picture/remove {id}` removes it. One row per notice, so a retry stores the same picture once; no request id is needed (D100's rule is about duplicates, which the primary key rules out). A deleted notice (D118) takes no new picture: 404.

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
