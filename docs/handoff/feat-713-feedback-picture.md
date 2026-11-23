# feat-713-feedback-picture — one picture per feedback send

Part of #713 (the feedback form, D157). Owner's approval, 2026-11-22: one optional picture per send, for officers and members.

## Built

- `app/(private)/_ui/FeedbackButton.tsx`: after the message, a "Picture (optional)" part: a visible label, the hint "One picture. Leave out screens that show members’ map positions or online times.", and an "Add a picture" button (`buttonClass("secondary")`, 44 px) that opens the file picker. Once a picture is chosen, the sheet shows a preview and "Remove the picture". The picture is prepared by D119's `preparePicture` (reused as is): at most 1600 px and 400 KB, re-encoded, so EXIF is dropped. It is sent as base64 in the same JSON body. A refused picture (413, 415, 422) reads "This picture could not be used. Try another one." The preview is inside the sheet's `ph-no-capture` part.
- `lib/private/dictionary.feedback.ts`: 7 keys in EN, PT-BR and FR.
- `lib/private/feedback.ts`: `picture` (optional base64, at most 400 KB decoded) in the strict `FEEDBACK_SEND`. The picture is checked by D119's `checkPicture` (reused as is) after the honeypot and before the day's counters, so a refused picture stores and counts nothing.
- `app/(private)/api/w/[slug]/feedback/route.ts`: a body whose `Content-Length` is more than `FEEDBACK_BODY_MAX` (the picture's base64 plus 16 KB) gets 413 before it is read. A refused picture gets D119's status codes.
- `lib/schema-feedback.ts`, `drizzle/0074_feedback_pictures.sql`: table `feedback_pictures` (`feedback_id` primary key with `cascade`, `workspace_id` with `cascade`, `bytea` data, type, width, height, bytes, hash, D119's check constraints). `bytea` is now exported from `lib/schema-notices.ts` and was not copied.
- `lib/repo/feedback.ts`: `insertFeedback` writes the row and its picture in one transaction. The 180-day purge takes the picture with the row (cascade).
- `lib/repo/workspace-data.ts`: `feedback_pictures` is in `WORKSPACE_TABLES` with `file: null`, so it is deleted with the workspace (D125) and never downloaded.
- `lib/queries/admin-feedback.ts`: the list carries the picture's address and size only, never its bytes. `feedbackPicture` reads the bytes for the route.
- `app/(pages)/admin/feedback/picture/[id]/route.ts`: serves the picture only to the owner's PIN session (`isAdmin`), which is checked before any database read. Any other request gets the same bare 404, `private, no-cache` with an ETag, and `nosniff`.
- `app/(pages)/admin/feedback/page.tsx`: the picture under the text, as a plain `img` linked to full size. `lib/copy-admin-feedback.ts`: its alt text.
- Docs: CLAUDE.md and `.claude/rules/private.md` (the exception sentence now covers the picture), a dated amendment to D157 (why our own storage and not PostHog, how it works), amendments to D119 and D125, and a line in the tracking plan.
- Tests: route (picture stored with its row; 400 KB and 1600 px pass, one byte or pixel more refused with nothing stored or counted; GIF and SVG refused as `wrong_type`, bad base64 refused with 400), purge (a picture goes with its row past 180 days), the admin picture route (no session and an officer's session get 404, the owner gets the bytes), the D125 tests through the seed. E2E: `e2e/feedback.spec.ts` sends a generated 4 × 4 PNG with an invented eXIf chunk. The owner sees it on /admin/feedback, and the served file is WebP or JPEG without the chunk.

## Decisions

- Transport: base64 inside the existing JSON, not multipart and not a second upload request. Multipart is a CORS-simple type, so it would weaken the same-origin JSON rule. A second request would need a way to tie the upload to a row that stores no sender. One request also keeps the row and its picture together.
- Analytics: no change. `feedback_sent` does not say whether a send had a picture.
- `feedback_pictures` has its own `workspace_id`, so D125's table scan and purge treat it like `notice_pictures`.
- The picture check runs before the day's counters, so a refused picture does not use up the sender's daily limit.
- Persona check at 360 px: I read the screenshots of the sheet (empty, then with a picture) and of the /admin item in this session, in four roles. I did not start separate persona agents.
  - Officer 1 (desk, phone): the label, the hint and the button read in order, and Send stays at the bottom.
  - Officer 2 (Android): one tap opens the gallery, and Remove is plain.
  - Member (French): the hint names what to leave out in their own words.
  - Privacy/adversarial reviewer: the redactor cannot read pixels, so the hint is the only guard on the picture's content, which the owner accepted. The preview is masked in replay. The route gives the same 404 to every other request. A picture sent around the sheet keeps its metadata, but it reaches the owner only.
  - Nothing changed from the check.

## Deviations

- "EXIF is dropped" is tested in e2e, not PGlite. The browser drops it when it re-encodes the picture (D119). The server does not decode pixels or remove metadata, so a PGlite test has nothing to exercise. The e2e test fails if the browser stops re-encoding.
- The hint begins with "One picture." so the limit is stated. After that it is the owner's wording.

## Verified

- `pnpm vitest related --run` on the changed files: 1949 passed, 4 skipped.
- `pnpm check`: passes (prettier, eslint, tsc, 366 test files with 1949 tests, drift, i18n).
- Mutation checks: with the admin gate removed, the picture-route test fails. With `checkPicture`'s refusal ignored, 2 route tests fail.
- e2e on my own Postgres cluster (127.0.0.1:54420) and ports 3577, 3578, 3579, 54477: `e2e/feedback.spec.ts`, 3 passed and 3 skipped by project, after the last change.

## Open issues

- A send that bypasses the sheet keeps any metadata its picture carries, and only the owner sees it. Removing metadata on the server would need byte surgery per format, or a decoder.
- At the limits, 20 sends of 400 KB a day per workspace is about 8 MB a day for each workspace. The Friday Neon size check (plan §6.1) covers it.
- No dark-mode screenshot was taken. The field uses the sheet's existing tokens.

## Next

- Patch notes for the release that ships this (lib/patch-notes.ts), per the release routine.
- After eight weeks, see on /admin/feedback how many sends carry a picture. Read the database, counts only.

What was missing from the task prompt? How the picture travels with the send (one request or two). I chose base64 in the JSON body.

PR: (added by the orchestrator)
