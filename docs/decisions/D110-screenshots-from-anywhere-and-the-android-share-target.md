## D110 — Screenshots from anywhere: a tab's button starts its pictures as the tab's type, and Android shares screenshots to the installed desk (2026-11-17, owner, 11ac, issue 293; amends D96)

Why: the owner (2026-11-17) wants screenshots easy to send from anywhere in the desk. Before this, there were two ways in: the Discord command "Send to LAPTracker", and "Send screenshots", which is only on Home.

**Tab buttons.**

- One component, `SendScreenshots`, as on Home. It takes optional presets (types) and a button text. Each tab's buttons are listed in `TABS` in `app/(private)/_ui/ToReview.tsx`.
- **Members:** one button, "Send a screenshot". Tapping it asks "What does it show?" with two choices: "Member update" (a chat) and "Alliance Duel". Each choice opens the phone's picker. Nothing else on Members changed: the list and the member card are another session's work (issue 347).
- **Thefts** (Calendar → Thefts): "Send a Secret Ops report".
- **No button on Roll call or the Elixir team picker:** Elixir teams cannot be saved yet (D103), so a button there would make no draft.
- A tab's button is a secondary button. Home's "Send screenshots" stays the main one and keeps its help line.
- Words: "Send a screenshot" / "Enviar um print" / "Envoyer une capture"; "Send a Secret Ops report" / "Enviar um relatório de Secret Ops" / "Envoyer un rapport de Secret Ops"; "What does it show?" / "O que o print mostra?" / "Que montre-t-elle ?".

**What the preset does.**

- `POST /api/w/[slug]/shots` takes `preset`, one of the kinds that save.
- `createDrafts` uses it only for a picture the classifier does not recognise. A picture it does recognise keeps its own type, and the officer changes it on the review as before. A map stays a map.
- So a one-message chat (too few sender lines for the classifier) sent with "Member update" becomes a Member update draft. A Kills page sent with "Alliance Duel" stays a Kills draft.
- A preset's Daily/Weekly tab is a guess. It stays unconfirmed, so the review asks for it, as it does when the picture cannot tell.
- **After sending from a tab:** if exactly one draft was made and every picture went into it, the page opens that draft's review. Otherwise it shows the same results as Home ("Read: … → Review", "Pick the type" for pictures not recognised, pictures not read). Home's own button is unchanged.

**The desk's own manifest.**

- Before this, the only manifest was the public site's (`app/manifest.ts`): installed from a desk page, the app was named "Event Ledger" and opened the public site.
- Each workspace now serves its own manifest at `/w/<slug>/manifest.webmanifest`, linked from the `/w/[slug]` layout's metadata, so every desk page (the sign-in and the how-to included) points to it instead of the public one.
- Its name is "Officers' Desk" / "Mesa dos oficiais" / "Bureau des officiers" (`app.name`, from the language cookie, else the phone's language). `id`, `start_url` and `scope` are `/w/<slug>`. Display, colours and icons are the public site's.
- It carries the share target: POST, `multipart/form-data`, field `shots`, `accept: ["image/*"]`, action `/w/<slug>/share`.
- The public manifest has no share target, so the public app is never offered in Share.
- To get the desk app and the share option, add it to the home screen from a desk page, not from the public site. An icon added before this release (named "Event Ledger") must be removed and added again from a desk page.

**Why the share goes to `/w/<slug>/share`.** The Web Share Target spec drops a `share_target` whose `action` is outside the manifest's scope; Chrome does too. The scope is `/w/<slug>`, so the action sits under it. The address names the workspace, so the share needs no session lookup and no choice of desk: each workspace's installed app shares to its own desk. A share to a desk whose session belongs to another workspace is refused like any other page of that desk (`requireWorkspace`).

**Who may share.**

- **An officer of that workspace:**
  - Each picture is read on the server in memory, with the phone's status bar dropped, as the Discord command reads its attachments.
  - Then the drafts are made as "Send screenshots" makes them.
  - The answer is a 303: to the draft's review when there is one draft and every picture went into it; otherwise to Home. Home then says "From your share: 2 drafts, in the list below." and "1 shared screenshot made no draft. Send it with Send screenshots to see why or pick its type."
  - The drafts' source is `desk`, so no new source and no migration.
- **Anyone else** (no session, a member's, an ended or a blocked one, another workspace's): a 303 to `/w/<slug>?shared=again`. Home applies its own rules: signed out it shows the sign-in, a member goes to the members' board, an ended session goes through Discord without a click and comes back, a blocked account goes to the no-access page.
- **The pictures are not kept for the sign-in.** Keeping them would mean storing them before anyone is checked, which D96 rules out. So the sign-in says: "The shared screenshots were not kept. Sign in if the desk asks, then share them again." After the sign-in, Home says it once more.

**Same rules as the other routes.**

- **Same-origin and CSRF:**
  - Android's share is a navigation the browser makes itself: `Sec-Fetch-Site: none`, with `Origin` absent or `null`.
  - The route accepts that, or a post from our own origin. In both cases the body must be multipart.
  - Anything else (a cross-site form, or a phone that sends other headers) reads nothing and goes to Home with "The shared screenshots could not be read. Share them again, or use Send screenshots." A navigation never ends on a JSON code. A cross-site form would also carry no session cookie, which is `SameSite=Lax`.
  - To confirm on the first real share: the headers Android sends.
- **Limits:**
  - **Vercel's 4.5 MB request body limit caps a share** before the desk sees it, with Vercel's own error page. A full-size Android screenshot is about 1–3 MB, so a share holds about 4 MB in all, around 2 or 3 screenshots. The how-to and Home say so, and point to "Send screenshots" in the desk for more: it sends one picture per request.
  - The route also refuses, before reading, more than 16 pictures, a picture over 4 MB, or a body over 4.5 MB (`MAX_PICTURES`, `MAX_UPLOAD`): "A share holds about 4 MB in all, around 2 or 3 screenshots, and nothing was read. To send more at once, use Send screenshots here."
  - A share with no picture in it, or whose pictures the reader refuses (no pixels, too many), gets its own line: "The share held no screenshot the desk could read. Share a screenshot (a picture), or use Send screenshots here."
- **One reading at a time per officer (D109).** A share reads pictures, so it takes the same per-officer guard as `/shots/read` (`startReading` / `endReading` in `lib/private/import-read.ts`, moved there from that route so both share one set). A share while the officer's "Read from a screenshot" or Send screenshots is reading reads nothing and lands on Home with "The desk was still reading your last screenshot, so this share was not read. Wait a moment, then share again." (`?shared=busy`, the share's form of `/shots/read`'s 429 `busy`). The guard is freed when the share ends or fails.
- **Storage:** no picture is stored. Drafts keep text lines only and are deleted after 7 days (D96).
  - Note (2026-11-18, 11ak, issue 419, D119): a notice's picture is a different thing, stored on purpose. An officer chooses it in the notices editor to show with the notice; it is resized and re-encoded in the browser (no EXIF or location), capped at 400 KB and 1600 px, kept in `notice_pictures` and served only behind the notice's own access. Screenshots read for data are still never stored.
- **Duplicates (D100):** Discord's per-picture claim uses Discord's message and attachment ids. A share has no such id, so that rule does not apply. A second share of the same pictures makes new drafts, as a second "Send screenshots" does. The 303 after the POST means reloading the review does not send the pictures again.
- **Errors:** a reading or draft failure is thrown as a code only (`w.import.share_failed:<reason>`, through `privately`) and recorded with `recordAppError`, so it reaches `app_errors` and the admin alert as a `/shots/read` failure does. The share then lands on Home with "The shared screenshots could not be read. …".
- **Vercel:** `/w/*/share` is in `OCR_ROUTES` (`next.config.ts`), so its function ships the OCR's worker, runtime and English data. `next.config.test.ts` finds every route that reaches the reader and checks it is listed.

**iPhone.** iOS does not support share targets for web apps. The how-to page (step 3) now says: "On iPhone, sharing to the desk is not possible: use Send screenshots in the desk or the Discord command “Send to LAPTracker”."
