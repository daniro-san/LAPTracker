# 11ak — A notice carries one picture (issue 419, D119)

## Built
- **Storage.** A new table, `notice_pictures` (migration `0042_notice_pictures`, after `0041_squads`): one row per notice, the bytes in `bytea` (a drizzle `customType`), with type, size, a 16-character SHA-256 hash, who and when. Check constraints repeat the caps: WebP, JPEG or PNG; 1–409,600 bytes; 1–1600 px a side.
- **Browser processing** (`app/(private)/_ui/notice-picture-prep.ts`, plan in `lib/private/notice-picture-rules.ts`):
  - `createImageBitmap` decodes the file, and a canvas draws it at most 1600 px on its long side;
  - it is re-encoded as WebP, or JPEG where WebP encoding is missing. This drops EXIF and location;
  - the quality steps 0.86 → 0.46, then the size shrinks by 80 % steps down to 320 px, until the file fits 400 KB.
- **Server check** (`checkPicture`, `lib/private/notice-picture.ts`):
  - magic bytes (415 `wrong_type`), whatever the content type says;
  - at most 400 KB (413 `too_large`, also from `Content-Length`);
  - at most 1600 px a side (422 `too_big_sides`). `pictureSize` now reads a PNG's IHDR too.
- **Routes.**
  - `POST /api/w/[slug]/notices/picture?id=N`, with the picture as the body: add or replace.
  - `POST /api/w/[slug]/notices/picture/remove {id}`: remove.
  - Both need same origin and an officer session (401 `signed_out`). Both are counted as `notice` `add` / `delete` (D115).
  - A notice in the trash (D118) gets 410 `notice_deleted` from both. Save then shows D118's "Restore from trash?", and the held picture change goes in with the next Save after the restore.
- **Serving.** `GET /img/notice/[id]` (`app/(private)/img/notice/[id]/route.ts`):
  - an officer of the notice's workspace gets the picture; a member gets it only while the board shows the notice (`boardShowsNotice`);
  - another workspace, a signed-out browser, a deleted notice (D118) and a missing picture all get the same 404;
  - headers: `private, no-cache`, an `ETag` (304 on a match), `nosniff`. Pages use `?v=<hash>` in the address.
- **Editor.** A "Picture" part after the writing tools: preview, Add a picture / Replace / Remove / Undo. Changes are held like the text and sent on Save (`saveWithPicture`):
  - a saved notice sends the picture before the text;
  - a new notice sends it after the text, and a retried Save finds the same notice by its request id.
- **Shown** on the notice page under the title (a link to full size), on the members' board in the notice card, and in Publish to Discord. Discord gets a multipart webhook post: `payload_json` and `files[0]`, with an embed image `attachment://notice.webp`, on the first message only. The log adds `pictures: 0|1`.
- **Weekly cleanup with a warning first** (owner, 2026-11-18; migration `0043_notice_picture_cleanup`):
  - **Due:** a picture is due 90 days after its notice's end day. Notices with no end day are never cleaned; the text always stays.
  - **Warning:** from 7 days before it is due, Home shows a card such as "The pictures of 3 notices will be deleted after Nov 24: “A”, “B”, “C”." with "Review them".
  - **Review list** (`/w/[slug]/notices/pictures`): each picture with a thumbnail, its title and "Deleted after …", plus three actions. **Keep** stores who and when; the editor then shows "Kept" with "Stop keeping". **Download** is `/img/notice/[id]?download=1`, for officers. **Use in another notice** copies the bytes to a live notice, and the copy gets its own clock.
  - **Deletion:** the weekly job, right after the Friday check claims its run, records when each warning began (`warned_at`). It deletes only due, unkept pictures warned at least 7 days earlier, and clears a warning when an end day moves away.
  - **Logs:** the count only. A failure logs its class name and returns 0, so the Friday check never answers 500.
  - **Home:** "Ana kept the picture of “…”" and "Ana used the picture of “A” in “B”".
  - **Paging (rebased on #426):** each picture part of Home's feed is bounded by the page's cursor (`added_at < before`, `kept_at < before`). A test pages five picture lines two at a time and finds each once; without the bound it fails.
  - **Re-review fixes:**
    - the cleanup skips a notice in the trash, which a restore brings back;
    - saving a new end day ends the warning;
    - copies come only from live notices;
    - the browser falls back to a plain decode on odd metadata.
    - Tests: one each for the first three, plus Download (officer 200 with `Content-Disposition` and `nosniff`, member 404) and reuse across workspaces (404).
- **Review fixes for PR 422:**
  - **Migration:** 0042 is unchanged, as pushed; 0043 adds the new columns and `octet_length(data) between 1 and 409600`.
  - **Uploads:** 411 without `Content-Length`, 413 over 400 KB, both before the body is read. Animated pictures are refused (422 `animated`): a VP8X with the animation flag, or a PNG with `acTL`.
  - **Analytics:** picture changes count as `notice` / `picture_*`, only when a row really changed.
  - **Half-saves:** after a picture went in and the text save then fails, the editor holds no picture change and reads the stored one again. A picture-only save closes the editor. A 413, 415 or 422 refusal reads "Try another one".
  - **Decoding:** the browser decodes straight at the upload size, with the header's size swapped for a rotated JPEG. `pictureSize` is browser-safe now.
- **Home.** One activity line: "Ana added a picture to “…”" (PT "adicionou uma imagem a", FR "a ajouté une image à l’annonce"). It is read from `lib/repo/desk-activity-pictures.ts`, a part of the small-sources union.
- **Docs.**
  - D119 records the storage choice, the cost reasoning from the issue, the caps and the access rule;
  - dated amendments in D102, D105 and D108, and a note in D110 that a notice picture is a different thing, stored on purpose;
  - ARCHITECTURE lists the new modules and the `/img/notice` handler.

## Decisions
- **Built on #418 (D118, merged into dev).** It is a soft delete with Undo. A deleted notice's picture is therefore kept (Undo brings it back) but never served, posted or replaced: the reads and the write join `live`.
- **Where the picture shows.** On the notice page it sits under the title. On the board it sits in the card, after the end-date line and before the text.
- **Size on screen.** Height is capped at 24 rem on phones and 28 rem from 640 px; the image itself opens at full size. This came from the 1280 px screenshot, where the picture pushed Edit below the fold.
- **No request id for the picture write.** There is one row per notice (primary key), so a retry stores the same picture once. D100's rule is about duplicates.
- **PT word.** "imagem", not "print": D110 uses "print" for a screenshot read for data.

## Deviations
- The serving route lives in `app/(private)/img/notice/[id]/` rather than `app/img/notice/[id]/`; the URL is the same. The D71 lint fence lets only `app/(private)` import `lib/private`, which holds the access check.
- The picker does not reuse `FilePicker` (`ScreenshotPicker.tsx`). That component picks several files and has type presets. The picture part uses the same hidden-input pattern for a single file.
- The server checks headers, not pixels. A file with a valid header but broken data would be stored and simply not draw.
- `notice-publish.ts` grew past 300 lines, so the post body moved to `lib/private/notice-publish-body.ts`.

## Verified
- **`pnpm check`.**
  - prettier, eslint and tsc pass.
  - vitest, after the cleanup round and the review fixes: 204 files passed, 2 skipped; 1,087 tests passed, 4 skipped. An earlier run under load (load average 44–51) timed out two unrelated tests, `lib/private/thefts.test.ts` and `app/img/preview/player/[uid]/route.test.ts`; both passed alone, and the last full run passed.
  - The drift check ("Everything's fine") and the i18n check ("17 languages up to date") pass.
- **New tests.**
  - `notices/picture/route.test.ts`: a GIF sent as `image/png` is refused; over 400 KB and over 1600 px are refused; a valid picture is stored once and Replace overwrites it; a notice in the trash answers 410 to upload and remove, and takes the picture once restored.
  - `img/notice/[id]/route.test.ts`: an officer gets it with `private, no-cache` and an ETag that answers 304; a member gets it only for a board notice; another workspace's officer and a signed-out browser get 404; a deleted notice's picture is 404 for both.
  - `notices/publish/route.test.ts`, one more test: the multipart body carries the file, the `attachment://` embed and empty `allowed_mentions`.
  - `lib/private/notice-picture-rules.test.ts`: `fitWithin` and the order of the attempts.
  - `lib/private/notice-picture.test.ts`: the cleanup deletes a picture whose notice ended 91 days ago, keeps one at exactly 90 days and one with no end day, leaves the text, and a picture can be added again.
  - `member-session.test.ts` has fixtures for both new routes. `board.test.ts` expects `picture: null`.
- **Local e2e: 12 of 12 checks pass.** Setup: production build on :3998, its own Postgres on :55347 (42 migrations), the DB bridge, a Discord sign-in stand-in and a webhook stand-in, with an invented 20-member roster. No upstream, Groq or Discord call.
  - The upload was an invented 4000 × 3000 PNG of 26,077,595 bytes (generated, not a screenshot). It was stored as WebP, 1600 × 1200, **268,554 bytes**, with no `Exif` block in the stored bytes.
  - The editor preview, the notice page and the member's board each drew it at 1600 px.
  - Home reads "Ana added a picture to “Garden rota”".
  - Publish sent multipart: `notice.webp`, `image/webp`, 268,554 bytes, embed `attachment://notice.webp`, empty mentions.
  - Serving: `private, no-cache` with an ETag; 404 when signed out. Remove deletes the row, and the picture then answers 404.
  - No sideways scroll in any of the 16 page and mode combinations.
  - The e2e found one bug, fixed here: a save that changed only the picture left the editor open, because the screen's key held field versions only. The key now includes the picture's address.
- **Screenshots** (`/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ak-shots/`, not committed):
  - the notice page and the board at 360 and 1280, light and dark, EN and PT (16 shots);
  - the editor with a new picture at 360.
  - Reviewed: PT wraps cleanly at 360, and the picture's border and buttons read in dark.
  - No WebKit run: Playwright WebKit is not installed here.

- **Cleanup round e2e: 10 of 10 checks pass.** Same local stack, on a database rebuilt with all 44 migrations; pictures were added through the editor from an invented 640 × 420 PNG.
  - Home's card read "The pictures of 5 notices will be deleted after Nov 24: “Garden map”, “Caravan plan”, “Spring rota” and 2 more." (five notices: two runs). "Review them" opens the list, with thumbnails.
  - Keep confirms "Kept. The weekly cleanup will never delete it." and the card drops it. The editor then shows "Ana kept it on …".
  - Download answers `attachment; filename="notice-2.webp"`.
  - "Use in another notice" confirms "Copied to “New rota”.", and that notice serves the picture.
  - Home reads "Ana kept the picture of “Spring rota”" and "Ana used the picture of “Caravan plan” in “New rota”".
  - No sideways scroll in the 8 modes.
  - Screenshots: `due-card-*` and `due-list-*` at 360 and 1280, light and dark, EN and PT (16 shots, same folder). Reviewed: the PT card wraps cleanly at 360, and the list's three buttons wrap to two rows at 360 and stay on one row at 1280.
  - The first run failed one check on the test's own selector (the card's heading id); the sentence was there, and the rerun passed.

## Open issues
- Storage: the weekly cleanup removes pictures 90 days after their notice ends, but notices with no end day keep theirs. At 30 pictures a month at a typical 250 KB that is about 7.5 MB a month before cleanup. Neon Free is 1 GB, and the Friday check warns at 700 MB.
- The cleanup acts only on what Home showed: a workspace whose officers never open Home still loses a due picture once its warning is 7 days old, since the warning is recorded by the weekly job, not by a visit. The owner may prefer "seen by an officer" instead.
- Android's share target (D110) cannot add a picture to a notice yet.
- The Translate and Improve tools leave the picture alone, as asked. Nothing describes the picture to members who use a screen reader beyond "Picture for “<title>”".

## Next
- Model/effort: keep. One feature with a migration, two routes, an image route, a browser resize, a Discord change and an e2e fitted one sitting.
- What the owner must do first: review and merge. The migrations (`0042_notice_pictures`, already run on the preview database, and `0043_notice_picture_cleanup`) run with the deploy. No setting or service is needed.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A private picture is served from `app/(private)/img/...`. The D71 fence keeps `lib/private` out of `app/img`.
- A notice screen remounts on its `key`. Anything a save changes outside `notice_edits` must be part of that key (as the picture's address now is), or the editor stays open after `router.refresh()`.
- `pictureSize` (`lib/screenshot/picture-size.ts`) reads PNG, JPEG and WebP headers. Use it before decoding any upload.
- The e2e harness (sign-in stand-in with a member user, webhook stand-in that keeps multipart posts, image generator) is in the scratchpad's `11ak/` folder.
</adjustments>

PR: (added by the orchestrator)
