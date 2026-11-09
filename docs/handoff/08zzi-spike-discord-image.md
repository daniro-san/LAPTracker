# 08zzi — Spike: a rendered image in the Discord event report (#172)

## Built
- `docs/screenshots/08zzi-combined-light.png` (720 × 1180, 141 KB): the recommended image. Event header, ledger top 5 by Might with the Might change, then Might ▲ and Kills ▲ top 3.
- `docs/screenshots/08zzi-combined-dark.png`: the same in dark tokens (paper and ink swapped), for comparison.
- `docs/screenshots/08zzi-ledger-light.png` (720 × 964): ledger top 10 by Might, with the Might change.
- `docs/screenshots/08zzi-movers-light.png` (720 × 996): "Grandma noticed": Might ▲, Might ▼, Kills ▲, top 3 each.
- `docs/screenshots/08zzi-ledger-light-glyphs.png`: the ledger with six names swapped in to test glyphs: ꧁Black Raven꧂, Берсерк, 龍の会, ไทยพลัง, an emoji name, Ölüm Meleği.
- `docs/screenshots/08zzi-combined-light-phone260.png`: the recommended image scaled to 260 px wide, which is the estimated phone display width (see Verified).
- `docs/screenshots/08zzi-before-light.png` (720 × 964, 120 KB): the Before image. Ledger top 10 by Might with Members, and the After's due time in the header. Added after the owner chose images on both phases.
- `docs/screenshots/08zzi-wide-ledger-phone260.png`: a first draft laid out at 600 px and scaled to 260 px. The text is about 7 px tall and cannot be read. This is why the mockups are laid out at 360 px.
- This handoff. No production code, no migration, no dependency. The prototype scripts and the downloaded font files are in the scratchpad only.

## Decisions
- **Data.** The mockups use the preview DB's `Seed Saturday Event 2026-10-31` (event 3, 20 alliances per phase, After `partial` with TEST stale). It is read with `getEventDetail` (`lib/queries/events.ts`) and ranked with `allianceMovers` (`lib/queries/movers.ts`, which calls `compute.topMovers`, D53). Read-only SELECTs. No upstream call.
- **Layout width.** The mockups are laid out at 360 px and rendered at 2× (720 px wide). Body text is 19 px in the layout, so about 13.7 px at a 260 px display width. A 600 px layout gives about 7 px at that width (`08zzi-wide-ledger-phone260.png`).
- **No member names in the image.** `lib/notify.ts` line 3 says messages carry alliance tags and names, counts and links, and never member names (plan §12.3). Member movers stay out of the image.
- **Badges are the drawn `NoBadge` placeholder in the mockups.** Fetching the real preset badges (101–110) is a plain GET to the tracker site's `/static/alliance/` path. D22 allows that, but this spike made no outside call it did not need.
- **English only** (D48): the image text uses the public pages' English words: "Might", "Kills", "Grandma noticed", "○ stale", "server time".
- **Owner answers (2026-11-08, in chat).** (1) Option A. (2) An image on both phases if the edit can replace it, else on the After only. Discord's Edit Webhook Message lets a PATCH replace the attachment, so the build does both: the Before posts the Before image, and the After's edit replaces it with the After image. (3) Characters the loaded fonts do not cover (such as ꧁ ꧂) are left out of the image. (4) One test post to the admin webhook is allowed.

## Deviations
- The task says to view the PNG "at the size Discord displays it". Discord's docs give no display size for embed images, and posting a test needs the owner's OK in chat. The 260 px phone width is an estimate (see Verified). After the owner's OK (2026-11-08) and once the owner had put `NOTIFY_WEBHOOK_ADMIN` in the main checkout's `.env.local`, one test message was posted to the **admin** webhook and edited once. Nothing was posted to the public webhook.

## Verified
All timings are from a MacBook with an Apple M4, Node 26.5.0, `next/og` from next 16.4.5. Vercel was not measured. Each mockup was rendered 4 times in one fresh process. The first time includes the yoga/resvg WASM start and the font parse.

**Render time and PNG size (phone-first layout, 720 px wide, brand TTF fonts):**

| Image | Size | PNG | Render ms (1st / 2nd / 3rd / 4th) |
|---|---|---|---|
| ledger (top 10) | 720 × 964 | 125.5 KB | 322 / 136 / 119 / 128; second process 901 / 402 / 401 / 304 |
| movers (3 × 3) | 720 × 996 | 109.3 KB | 140 / 119 / 156 / 148 |
| combined (top 5 + 2 × 3) | 720 × 1180 | 141.3 KB | 173 / 166 / 162 / 163 |
| combined, dark | 720 × 1180 | 141.1 KB | 330 / 178 / 182 / 175 |
| ledger, glyph names, network on | 720 × 964 | 126.6 KB | 969 / 130 / 134 / 125 (the first render fetched the CJK and Thai fonts and twemoji) |
| ledger, network off, no emoji | 720 × 964 | 125.5 KB | 295 / 123 / 121 / 123 |
| ledger, network off, emoji in a name | — | — | **throws** `Error: offline`: the whole render fails |

- First draft, 1200 px wide (600 px layout): 145–192 KB, 101–334 ms. It was dropped because it cannot be read on a phone.
- `getEventDetail` from this Mac to Neon: 1,389 ms and 2,167 ms, including the connection. `notifyPublic` (`lib/run-notify.ts:51`) already makes this read, so an image adds no query.
- Whole process for three renders: 4.1 s wall, 410 MB peak RSS (`/usr/bin/time -l`), including tsx start-up and the DB connection.

**Glyphs** (`08zzi-ledger-light-glyphs.png`):
- Cyrillic (Берсерк) and Turkish (ğ) come from Source Sans 3. They need the full TTF.
- CJK and Thai are not in the brand fonts. `next/og` fetches Noto Sans subsets from `fonts.googleapis.com` at render time (`loadDynamicAsset` in `next/dist/compiled/@vercel/og/index.node.js`). They rendered, but on the system font's taller line height, so those rows are taller than the others.
- Emoji are fetched from jsDelivr (twemoji 14.0.2) at render time. When that fetch fails the render throws.
- ꧁ ꧂ (Javanese, in BRAV's real name "꧁Black Raven꧂") have no fallback in `next/og`'s font list. They render as a box even with the network on.
- When a font fetch fails, `next/og` logs `Failed to load dynamic font for <the characters>` and draws a box. That log line carries alliance-name characters, nothing secret.
- **WOFF subsets do not work.** The Google Fonts latin and cyrillic WOFF subsets add up to 139 KB, against 1.23 MB of TTF. But Satori kept only the first file of each family and weight, so Cyrillic was lost. The latin subset also lacks ğ, ○ and ▲▼, which then trigger a fetch (HTTP 400) and render as boxes. The build needs the full static TTFs: Young Serif Regular 107 KB, Alegreya Sans Bold 267 KB, Source Sans 3 Regular 431 KB and Semibold 426 KB, 1.23 MB in total. They come from `github.com/google/fonts` (ofl/youngserif, ofl/alegreyasans) and `github.com/adobe-fonts/source-sans` (release/TTF). All are OFL. Next's `next/font/google` serves WOFF2, which Satori cannot read.

**Test post to the admin webhook** (2026-11-09; owner's OK in chat; scratchpad script with Node's own `fetch` and `FormData`; only status, ids and attachment facts printed, never the URL). The message content is `[spike 08zzi] Image test on seed data (Oct 31). Please ignore.` and it has no mention.

| Step | Request | HTTP | Time | Sent | Discord's answer |
|---|---|---|---|---|---|
| 1 | `POST ?wait=true`, multipart: `payload_json` (embed `image.url = attachment://event-before.png`, `attachments: [{id: 0, filename}]`) + `files[0]` = Before PNG | 200 | 891 ms | 122,425 B | message id returned; `attachments: []`; `embeds[0].image` = https CDN URL, 720 × 964 |
| 2 | `PATCH /messages/<id>`, the same shape with `event-after.png` = combined PNG | 200 | 724 ms | 144,724 B | same id; `attachments: []`; `embeds[0].image` 720 × 1180 |
| 3 | `GET /messages/<id>` | 200 | — | — | 0 attachments, 1 embed, image file `event-after.png`, signed URL (`ex`, `is`, `hm`), `edited_timestamp` set |

- A file referenced by `attachment://` in an embed is moved into the embed. The message's `attachments` list stays empty.
- The PATCH with `attachments: [{id: 0, filename: "event-after.png"}]` replaced the image. The Before file is gone, and no second message was posted. **An image on both phases works with one editable message (D31).**
- Each upload, about 120–145 KB, took 0.7–0.9 s from this Mac. `SEND_TIMEOUT_MS` (5 s) covers it.

**Phone legibility.** The mockups were scaled with `sips --resampleWidth 260` and viewed at that size. The 260 px is an estimate, not a measurement: a 360 dp screen, minus Discord's avatar column and side margins, minus the embed's 4 px bar and its padding. At 260 px the combined image's body text is about 13.7 px and the header subtitle about 11 px, and both can be read. The 600 px layout's text is about 7 px and cannot. On a phone, tapping the image opens it full screen at 360 px.

**Discord docs relied on** (read 2026-11-07; `discord.com/developers/docs/...` now redirects to `docs.discord.com/developers/...`):
- Execute Webhook (https://docs.discord.com/developers/resources/webhook#execute-webhook): `files[n]` plus `payload_json` in `multipart/form-data`. `wait=true` returns the message.
- Edit Webhook Message (same page, #edit-webhook-message): "Any provided files will be appended to the message. To remove or replace files you will have to supply the `attachments` field". From API v10 the `attachments` array "must contain all attachments that should be present after edit, including retained and new attachments". Edit has no `wait` param.
- Reference, Uploading Files and Editing Message Attachments (https://docs.discord.com/developers/reference#uploading-files): the limit is "20 MiB" per file by default. Embeds can use `"image": {"url": "attachment://screenshot.png"}`, with only .jpg, .jpeg, .png, .webp and .gif. A file not listed in `attachments` on an edit is removed.
- Message resource, Embed Image Structure (https://docs.discord.com/developers/resources/message#embed-object-embed-image-structure): `url` takes "only http(s) and attachments". A webhook may not set `height`, `width` or `proxy_url`. Embed limit: 6,000 characters in total.
- Reference, Signed Attachment CDN URLs (same page): attachment URLs carry `ex`/`is`/`hm` and expire. "Discord automatically refreshes attachment CDN URLs that appear within the client".
- **Not stated anywhere in the docs:** how long the media proxy caches an external `embed.image.url`, whether it fetches the URL again after a PATCH, or the size at which an embed image is shown on desktop or phone.
- Rate limits (https://docs.discord.com/developers/topics/rate-limits): each webhook is its own top-level resource. No webhook-specific number is stated.

## Open issues
- **The size at which Discord shows the image on a phone and on desktop has not been measured.** Discord's API answer gives the file size (720 × 1180), not the size on screen. The test message is in the admin channel. The owner's phone and desktop screenshots of it would settle the display size.
- **꧁ ꧂ in BRAV's name render as a box.** The owner chose to leave such characters out of the image. The text embed still shows the name in full.
- **Emoji in an alliance name makes the render depend on jsDelivr.** If that fetch fails the render throws. Any build must catch the error and send the text-only message. Today no tracked alliance has an emoji in its tag or name (`config/alliances.ts`), but names are typed in game and can change.
- `app/opengraph-image.tsx` says "the display serif is not available to the image renderer". With committed TTFs it would be. This is a follow-up, not part of #172.
- The issue says the collector takes "≈ 40 s". `docs/handoff/09-dryrun.md` measured 10.0 s and 9.6 s of wall-clock for a whole run. Either way, the render's ~0.2–1 s fits easily inside `NOTIFY_CAP_MS` = 115 s (`lib/run.ts:29`).
- A forced re-run ("Record again", D28) updates the same `snapshots` row, so the id stays the same (`lib/repo/snapshots.ts:35`). Any cache key for a public image route would have to use `finished_at`, not the snapshot id.

## Options

All three spend **0 upstream quota calls**: the image is drawn from `getEventDetail`, which `notifyPublic` already reads. None of them adds an npm dependency.

| | A. Attachment on the webhook call (recommended) | B. Public image route, `embed.image.url` | C. No image; keep the text embed |
|---|---|---|---|
| How | `notifyPublic` renders the PNG with `next/og` and sends it as `files[0]`. On the After's PATCH it sends `attachments: [{id: 0, filename}]`, so the new file replaces the old one. The embed's `image.url` is `attachment://event-<phase>.png`. | New `GET /img/event/[id]/[phase]` renders on request from `getEventDetail`. The embed's `image.url` is `${origin}/img/event/<id>/<phase>.png?v=<finished_at epoch>`. Discord fetches it through its media proxy. | Nothing changes. |
| Quota calls | 0 | 0 (each Discord fetch and each cache miss renders once more, from the DB) | 0 |
| Storage | Repo +1.23 MB of TTF plus the OFL text. The PNG lives in Discord's CDN (≈ 140 KB per event). | Repo +1.23 MB of TTF. Vercel CDN cache. | none |
| Run time | +0.2–1.0 s inside `notifyPublic`. Upload ≈ 140 KB within `SEND_TIMEOUT_MS` (5 s). | None in the run. Discord's fetch renders the image (0.1–0.3 s warm, ~1 s cold). | none |
| Work (agent minutes, estimate) | ~150–200: render module, multipart in `discord-send.ts`, attachments on PATCH, render timeout with a text-only fallback, tests, DESIGN/DECISIONS entries | ~200–260: route, `proxy.ts` CSP, refusal of non-public events, a rate limit or CDN rule, cache-key rule, tests, docs | 0 |
| New rules or decisions | A D-entry (next free number): the image's content and phase, fonts committed as TTF under `lib/brand/fonts/` with `OFL.txt`, the fallback. DESIGN.md "Fonts load from next/font/google" gets the exception for the image renderer. | The same, plus: a new public rendering route (cost and abuse surface), and its cache key | none |
| Risks | The render throws on a failed emoji fetch: needs try/catch and a timeout, then the text-only send. A multipart PATCH 404 must re-post with the file (FormData can be re-sent). Unverified display size. | Media proxy caching is not documented: an edit may keep showing the old image even with `?v=`. Discord fetches the URL once at post time, so if the render is slow or fails, the embed has no image and nothing retries it (not documented). Preview deployments are behind Vercel SSO, so Discord can only fetch production. Anyone can call the route and make it render. | The owner's idea is not done. |
| Bonus | — | The same route could later serve as the `/events/[id]` link preview. | — |

**Recommendation: A.** The image is part of the message, so the edited message always shows the image from that moment (D31's "the edited message shows the event so far"). It depends on no undocumented proxy caching, adds no public route, and gets the same 404 and edit fallbacks that `sendOrEdit` already has. Use light tokens on both phases. The Before message posts `08zzi-before-light.png`. The After's edit replaces that file with the combined layout (`08zzi-combined-light.png`). The owner chose A (2026-11-08).

**Charts** are out of v1 by rule. A chart (for example each alliance's Might before and after as paired bars) would use the same renderer and layout width, at about the same cost as A. It needs an owner decision first and is not prototyped.

## Next
Session: 08zzj — Discord event image (build of option A, chosen by the owner 2026-11-08)
Model / effort: keep — the spike measured every risky part (render time, size, fonts, glyphs, Discord's attachment rules). What is left is wiring and tests.
Owner must do first: open an issue for the build. Put `NOTIFY_WEBHOOK_ADMIN` in the main checkout's `.env.local` if the build should post its own test to the admin channel; today only Vercel has it.
Plan changes needed: none in docs/IMPLEMENTATION_PLAN.md. DESIGN.md "Fonts" and "Enforcement" (the image renderer reads committed TTFs) and a new DECISIONS entry are part of the build.

**Model:** opus · **Effort:** medium · **Mode:** default

```text
<session>
Session 08zzj of SESSION_PLAYBOOK.md. Read CLAUDE.md, docs/handoff/00-prereqs.md, docs/handoff/08zzi-spike-discord-image.md (the spike; its screenshots are the target), D22, D31, D48, D53 in docs/DECISIONS.md, and docs/DESIGN.md. Issue: #<the build issue>.
</session>

<task>
The public Discord event message carries a rendered PNG of the event, in light tokens, laid out at 360 px and rendered at 720 px with next/og ImageResponse.
- The Before posts the layout of docs/screenshots/08zzi-before-light.png: ledger top 10 by Might, with Members, and the After's due time.
- The After's edit replaces that file with the layout of docs/screenshots/08zzi-combined-light.png: event header, ledger top 5 by Might with the Might change, and Might ▲ and Kills ▲ top 3 from compute.topMovers.
- Characters none of the loaded fonts cover (꧁ ꧂, emoji, CJK, Thai) are left out of the image's names (owner, 2026-11-08). The image then needs no font or emoji fetch at render time. The text embed keeps the full name.
- Render in lib/ (no app/ import), from the getEventDetail rows notifyPublic already reads; alliance tags and names, numbers, no member names, no URL. Fonts: the four static OFL TTFs the spike lists (Young Serif Regular, Alegreya Sans Bold, Source Sans 3 Regular and Semibold) committed under lib/brand/fonts/ with OFL.txt; read once per instance.
- lib/discord-send.ts: when a file is given, send multipart/form-data (files[0] + payload_json, no content-type header of our own) on POST and on PATCH; on PATCH send attachments: [{ id: 0, filename }] so the new file replaces the old one; the 404 re-post sends the file too. The embed's image.url is attachment://<filename>.
- Failure: the render gets a time limit (2 s); a throw or a timeout logs notify.image_failed (no names, no URL) and the message goes out text only, exactly as today.
- D-entry (next free number) and DESIGN.md (Fonts, Enforcement) for the image and the committed fonts.
</task>

<verify>
pnpm check. Tests, one per behaviour: the PNG's IHDR is 720 wide; multipart body has files[0] and payload_json with attachment://; the PATCH lists exactly the new attachment; a render that throws still sends the text embed. With the owner's OK in chat only: one post to the admin webhook, and a screenshot of it on a phone and on desktop in docs/screenshots/.
</verify>

<done_when>
The Before post and the After edit of a public event message each carry their image, and the edit leaves one attachment. A failed render sends today's message. suite green; docs/handoff/08zzj-discord-image.md. PR: "feat(discord): the event report carries a rendered image (#<issue>)" (into dev).
</done_when>
```

<adjustments>
- Proven on the admin webhook (2026-11-09): a multipart POST with `attachment://` puts the file in `embeds[0].image` and leaves `attachments` empty. A PATCH with `attachments: [{ id: 0, filename }]` plus the new `files[0]` replaces the image in the same message. Upload 0.7–0.9 s for 120–145 KB.
- Measured on an M4 Mac (Vercel not measured): first render in a fresh process 0.14–0.9 s, warm 0.12–0.4 s; combined PNG 720 × 1180 = 141 KB (Discord's limit is 20 MiB per file).
- Use full static TTFs, not Google's WOFF subsets: Satori keeps one file per family and weight, so a second subset file is ignored, and the latin subset lacks ğ ○ ▲ ▼.
- Brand components render in next/og as they are (MarkLine, MightMark, KillsMark, LookMark, NoBadge) once the svg gets width and height. Each needs only width, height and style.color.
- next/og fetches Noto Sans (CJK, Thai) from fonts.googleapis.com and twemoji from jsDelivr when a name needs them. A failed emoji fetch throws, so the fallback is required, not optional. ꧁ ꧂ never render.
- Rows with a fallback font are taller. Once uncovered characters are left out, no row uses a fallback font. Keep a fixed row height anyway, so the footer never moves.
- A name made only of uncovered characters (for example 龍の会) is empty once they are left out. Show the tag alone then, and the union id when the tag is empty too: the same order as `allianceLabel` in lib/notify.ts.
- The Before image (docs/screenshots/08zzi-before-light.png) took 142–177 ms warm, 771 ms first, 120 KB.
- Badges: not in the spike. If the owner wants them, fetch with lib/images.ts fetchImage + badgeSource (D22 rules: 5 s, 1 MB cap, no redirect) and draw them as data URIs; at most 10 preset files.
- A forced re-run keeps the same snapshot id (lib/repo/snapshots.ts), which does not matter for an attachment.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/182
https://github.com/daniro-san/LAPTracker/pull/194
