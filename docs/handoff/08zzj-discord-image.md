# 08zzj — The Discord event report carries a picture of the event (#172)

## Built
- `lib/event-image.tsx`: `renderEventImage` draws the event picture with `next/og`. It is laid out at 360 px and drawn at 720 px, in light tokens. The Before shows the ledger top 10 by Might, with Members. The After shows the ledger top 5 with the Might change, then Might ▲ and Kills ▲ top 3. `eventImage` wraps it: on a throw or after 3 s it logs `notify.image_failed` (event id and error name) and gives null. `drawable` leaves out the characters the fonts cannot draw.
- `lib/brand/fonts/`: Young Serif Regular, Alegreya Sans Bold, Source Sans 3 Regular and Semibold as static TTF (1.23 MB), with `YoungSerif-OFL.txt`, `AlegreyaSans-OFL.txt` and `SourceSans3-LICENSE.md`. They come from google/fonts and adobe-fonts/source-sans. `.prettierignore` skips the folder so the licences stay as published.
- `lib/discord-send.ts`: `sendOrEdit` takes an optional file. With one, the body is multipart (`payload_json` + `files[0]`) on POST, on PATCH and on the re-POST after a 404. Without one, it is JSON as before.
- `lib/notify.ts`: the public message is plain text (bold chip, lines, `[Event page ↗](<url>)`) with `embeds: []`. It carries `attachments` of the picture, or `[]` when there is none. `Embed` is now `PublicMessage`, without a colour. `topGains` is exported, so the picture and the text rank the same (D53). With `image: true` the text leaves the top gains out.
- `lib/discord-format.ts`: the clock and the number formats moved out of `notify.ts` (which was at the 300-line limit). The clock gains `day` and `time`. `notify.ts` re-exports `discordClock`.
- `lib/run-notify.ts`: `notifyPublic` draws the picture for the phase when the detail was read, the phase has rows and the run did not fail. It then sends the picture with the text.
- `lib/copy-discord.ts`: `public.title` and `public.eventLink`, plus an `image` block (alt text, Before/After words, section titles, footer).
- Tests: `lib/event-image.test.ts` (the filter; both phases 720 px wide with no download; a failed render gives null and logs no name), three cases in `lib/notify-event-message.test.ts` (text + one attachment and no embed on the edit; text alone as JSON clearing an older picture; the 404 re-post sends the picture again). `lib/app-context.test-helpers.ts` reads multipart bodies.
- Docs: D58 in DECISIONS.md, DESIGN.md (Typography, `status-strip`, Enforcement), ARCHITECTURE.md (the three modules).
- `docs/screenshots/08zzj-before-light.png`, `docs/screenshots/08zzj-after-light.png`: the two pictures drawn by this code from the preview DB's seed event (Oct 31).

## Decisions
- **No embed** (owner, 2026-11-09, after the admin test in 08zzi): "daria pra ficar sem essa borda cinza em volta? tipo só a imagem com o link pra pagina publica". The text goes in `content`, and the link is wrapped in `<…>` so Discord adds no link preview. Without an embed there is no colour bar: the state reads from the icon and the word, as on the page's chip.
- **Text-only messages use the same shape** (content, `embeds: []`, `attachments: []`), not the old embed. One shape means a Before with a picture and an After without one never mix an old embed or an old picture with new text.
- **No badges** in the picture. The spike's drawn placeholder looked like a real badge, and fetching the presets adds up to 10 outside calls per render. Listed under "Not done" in D58.
- **The render limit is 3 s.** First renders took 0.28–0.61 s here, and later renders 0.14–0.21 s. The notify cap is 115 s (`lib/run.ts`).
- **Characters left out** (owner, 2026-11-08): anything outside the Latin, Greek, Cyrillic, Common and Inherited scripts, plus emoji, emoji modifiers, regional indicators, ZWJ, VS16 and the keycap mark. A name left empty shows the tag, else the union id.

## Deviations
- `lib/notify.test.ts`: three `color` assertions were removed, because the public message no longer has a colour (see Decisions). No other assertion changed. The unread-detail test in `lib/notify-event-message.test.ts` now reads the posted text instead of the embed.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest **47 files, 224 passed, 1 skipped**, drift, i18n.
- The no-download test can fail. With `drawable` turned into a no-op, the test failed on fonts.googleapis.com calls. The file was restored, and the test passes again.
- `next build`: `.next/server/app/api/tick/route.js.nft.json` and `…/api/snapshot/route.js.nft.json` list the four TTFs and `lib/brand/tokens.css`, so they ship in the functions.
- **End to end on the admin webhook** (owner's OK, 2026-11-08), with the code of this branch: `eventImage`, then `createNotifier(...).public(message, id, image)` pointed at the admin webhook. Data: the seed event 3 (read-only). The existing test message was edited twice, and no new message was posted:
  - Before: render 284 ms (611 ms in a fresh process), 114,487 B, edit 682 ms.
  - After: render 139 ms (209 ms), 137,327 B, edit 462 ms.
  - A `GET` of the message after both edits: 0 embeds, 1 attachment `event.png` (720 × 1206, 137,327 B, the alt text), and the content is the bold `⚠ Last updated at Sat, Oct 31, 14:01 server time`, the Before line, `19/20 alliances`, `○ 1 stale: [TEST] Test-Tickles` and `[Event page ↗](<https://laptracker-inky.vercel.app/>)`.
- The webhook URL was never printed, logged or committed. Nothing was posted to the public webhook. No upstream quota was spent.

## Open issues
- The admin test message (seed data, Oct 31) is still in the admin channel. Delete it by hand when convenient.
- `app/opengraph-image.tsx` still says "the display serif is not available to the image renderer". With the committed TTFs it would be. This is a follow-up, not part of #172.
- The picture has no stale marker for an alliance outside the ledger's top 5. The text names every stale alliance.
- Vercel render time is not measured. The first public message after the deploy will show it in the logs if it reaches the 3 s limit (`notify.image_failed`, `reason: "timeout"`).
- PR #194 (the spike's admin-test results in the 08zzi handoff) is a separate docs PR.

## Next
Session: none planned by this change. It goes into the next release (`dev → main`).
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev`. Delete the admin test message if you like.
Plan changes needed: none.

<adjustments>
- The public Discord message is plain text with an optional picture (D58), not an embed. Any change to the public message edits `publicSnapshotMessage`/`publicText` in lib/notify.ts and, for the picture, lib/event-image.tsx.
- The picture's fonts are read from lib/brand/fonts/ at runtime. Next's file tracing already includes them for /api/tick and /api/snapshot; a new route that sends the public message needs the same check in `.next/server/app/<route>/route.js.nft.json`.
</adjustments>
