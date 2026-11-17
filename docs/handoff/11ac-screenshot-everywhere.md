# 11ac — Screenshots from anywhere: tab buttons with a preset type, and the Android share target (D110, issue 293)

Branch `session/11ac-screenshot-everywhere`, from `origin/dev` at 408d046. Rules applied: D71, D75, D96, D99, D100, D103; the decision is D110.

## Built
- **Preset type.**
  - `createDrafts` (`lib/private/import.ts`) takes `preset`, a Screen. It is used only for a picture the classifier does not recognise; a map stays a map. A preset's Daily/Weekly tab is stored unconfirmed.
  - `POST /api/w/[slug]/shots` takes `preset`, one of the kinds that save (`import-input.ts`).
- **Client.**
  - `SendScreenshots.tsx` takes `button`, `presets` and `ask`. From a tab, a send that made one draft out of every picture opens that draft's review; otherwise the results show as on Home.
  - The button and its hidden input moved to `ScreenshotPicker.tsx` (file size). With two presets, the button opens a boxed "What does it show?" with one choice per type.
  - A tab's button is secondary; Home's is unchanged.
  - `ToReview.tsx`: `sendProps` (what every button takes), `TabSend` and `TABS` (members: Member update or Alliance Duel; thefts: Secret Ops report).
- **Tabs.**
  - Members: one `<TabSend tab="members">` line under the title. The list and the card are untouched (#347).
  - Thefts: `<TabSend tab="thefts">` under the lead text.
  - Roll call: no button.
- **Share target.**
  - `app/manifest.ts`: `share_target` → `POST /api/w/share`, multipart, field `shots`, `image/*`.
  - `app/(private)/api/w/share/route.ts`: the origin rule (`isShareTarget` in `lib/private/http.ts`), then the workspace from the session (`sessionSlug` in `lib/private/access.ts`, `sessionWorkspaceSlug` in `lib/repo/workspaces.ts`), then `requireWorkspace` and the limits. Each picture is read with `readUpload(bytes, true)` (status bar dropped), then `createDrafts`, then a 303.
  - `app/(private)/w/share/page.tsx`: the signed-out landing. With one workspace it goes on to that workspace's sign-in; with several it shows one sign-in button per workspace (`shareDesks`).
  - `WORKSPACE_SLUG` reserves `share`.
- **Home.**
  - `share-lines.ts` turns `?shared=again|limit|failed|done&made=&none=` into lines.
  - Signed in, the lines show at the top of "To review". On the sign-in, the line shows above the button.
  - `?shared=again` is carried through the sign-in and the silent renewal, so Home says it again after sign-in.
- **Constant:** `MAX_UPLOAD` (4 MB) moved to `lib/private/import.ts`; `/shots/read` and `/share` both use it.
- **Words** (EN, PT, FR): `shots.sendOne`, `shots.sendSecretOps`, `shots.presetAsk`, `shots.share.*` (title, again, signIn, limit, failed, made.one/other, none.one/other), and `howto.share` (the how-to's step 3, after Android, including the iPhone line).
- **Tests:**
  - `import.test.ts`: a one-message chat, sent with the Member update preset, becomes a Member update draft (2 rows).
  - `api/w/share/route.test.ts`, 3 tests:
    - an officer's two pages make one draft, read with the status bar dropped, and get a 303 to its review;
    - a member gets `/w/ogs?shared=again` and no session gets `/w/share`, with nothing read and no draft;
    - 17 pictures, a 4 MB + 1 picture and an empty share go to `?shared=limit`, a cross-site form gets 403, and nothing is read.
- **Docs:** D110; a dated D96 amendment; the decisions index; an ARCHITECTURE note (the two fixed paths under w and api/w).

## Decisions
- **Preset only fills in for a picture the classifier does not recognise.** The task says "the draft starts with that type; the classifier may still disagree". I read that as: the classifier's own type wins when it has one, and the preset covers what it cannot read. Forcing the preset would turn a Kills page sent from "Alliance Duel" into an empty Alliance Duel read with no draft.
- **The workspace comes from the session; no picker for a signed-in officer.** One browser holds one workspace session (one cookie), so a signed-in officer is in exactly one desk. The "small picker" applies only to a share with no session when there are several workspaces: one sign-in button each. With one workspace, it goes straight to its sign-in.
- **The pictures are not kept across sign-in.** The line says "The shared screenshots were not kept. Sign in if the desk asks, then share them again." Keeping them would mean storing pictures before anyone is checked (D96).
- **A member's share goes to `/w/<slug>?shared=again`.** The task says "send the person to sign in". Home's own rule then takes a member to the members' board, since signing in again gives a member the same member session.
- **"Land on the review":** a tab's send opens the review only when it made one draft from every picture; otherwise it shows Home's results. Home's own button keeps its old behaviour.
- **Drafts from a share have source `desk`:** no new source value, no migration.
- **D100's per-picture claim does not apply:** it needs Discord's message and attachment ids, and a share has none. Reloading after the 303 does not send the pictures again.

## Deviations
- **The share route is not in `member-session.test.ts`.** That test walks `api/w/[slug]`, and expects a 401 for no session and for a member's session. `/api/w/share` sits outside `[slug]` (the manifest's action is one fixed path) and answers a navigation, so its refusal is a 303 to the sign-in, not a 401. Its own test checks both refusals.
- **The share sheet shows "Event Ledger", not "Officers' Desk".** The installed app's name comes from the shared public manifest (`copy.site.name`), which I did not change. The how-to says "pick the desk's icon".

## Verified
- **`pnpm check`:** exit 0, run after the last code change. Vitest: 174 files passed, 2 skipped; 934 tests passed, 4 skipped. Drift fine; i18n 17 languages up to date.
- **Local e2e, 75 of 75 checks.**
  - Setup: production build (`next build` + `next start` on :3967), local Postgres 18 on 55237 with all 36 migrations, the bridge on 55238, a Discord stand-in on 55239 (officer Ana, member Moss), and 11ab's invented 40-member roster.
  - Pictures: the repo's fixtures 27, 28 and 53, plus two invented pictures (a one-message chat from "Marlow", and a notice).
  - No upstream, Groq or real Discord call, and no `/api/quota`.
- **Checks:**
  - The manifest serves the `share_target` as above.
  - Members: one "Send a screenshot" button. It asks "What does it show?" with Member update and Alliance Duel.
    - Member update with the one-message chat opens a Member update review with the AD Tech row. The classifier alone does not recognise that picture (the unit test).
    - Alliance Duel with pages 27 and 28 opens the Alliance Duel review.
  - Thefts: "Send a Secret Ops report" with picture 53 opens the Secret Ops review.
  - Roll call: no button.
  - **The share POST, as Android sends it** (`Origin: null`, `Sec-Fetch-Site: none`, multipart `shots`):
    - an officer's pages 27 and 28: 303 to `/w/ogs/shots/<id>`, one draft more, and the review opens;
    - 53 plus the notice: `/w/ogs?shared=done&made=1&none=1`, and Home says "From your share: 1 draft, in the list below." and "1 shared screenshot made no draft. …";
    - 17 pictures: `?shared=limit`, nothing read, and Home says the limit;
    - a cross-site form: 403; a post from our own origin: accepted.
  - No session: `/w/share`, then `/w/ogs?shared=again`. The sign-in shows the line (EN, PT). After signing in, Home shows the line again.
  - A member's session: `/w/ogs?shared=again`, then Home sends them to the board; no draft.
  - How-to: the share paragraph and the iPhone line in EN, PT and FR.
  - No sideways scroll, and every control in main ≥ 44 px, on Members (choice open), Thefts, Home with the share lines and the sign-in. Checked at 360 in light EN, light PT, dark PT, dark EN and light FR, and at 1280 in light EN.
- **Design review of the screenshots led to one change.** The first build put a full-width dark button between the title and the Members / Former members switch, and its type chips read as a second switch. On Thefts it made two equal main buttons. Now a tab's button is secondary, and the type choice sits in its own box. Re-run: 75 of 75.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ac-shots/`:
  - `members-open-*`, `thefts-*` and `home-shared-*`, each at 360 in light EN, light PT, dark PT, dark EN and light FR, and at 1280 in light EN;
  - `howto-*` at 360 in the same five;
  - `signin-shared-360-light-en` and `signin-shared-360-dark-pt`;
  - `members-review-member-update-360-light-en`, `thefts-review-360-light-en` and `share-review-360-light-en`.
- WebKit was not run: the iPhone has no share target, and the buttons are plain buttons already checked in Chrome.
- **Privacy:** a check of the diff against the 101 names of the OGs roster fixture finds none. Test and e2e names are invented.

## Open issues
1. **Vercel's 4.5 MB body limit caps a share** at about 2–4 full-size Android screenshots. Above that, Vercel answers with its own error page before the desk runs. Possible follow-up: a service worker that takes the share and sends one picture per request, as "Send screenshots" does. It would also keep the pictures across a sign-in.
2. **Android's real headers are not tested.** The route accepts `Sec-Fetch-Site: none` with `Origin` absent or `null`, as Chromium's browser-made navigations send them. Check on the first real share; a 403 there would mean the headers differ.
3. **Reinstall needed.** A desk already on an Android home screen gets the share target only after it is removed and added again.
4. **`start_url` is `/` (pre-existing).** The installed app opens on the public site, not the desk, also for officers who installed it from `/w/ogs`. Not changed here.
5. **No time budget on a share's reading.** Pictures are read one after another (about 0.5–0.7 s each, D96); the body limit keeps a share to a few pictures, well under the 60 s `maxDuration`.
6. **`share` is now a reserved slug.** If a workspace already uses the slug `share` in production, its page would be shadowed. Not likely; the only known workspace is `ogs`.

## Update after the PR #403 review
This section supersedes the share target's address, the workspace lookup, the `/w/share` page, the reserved slug, open issues 4 and 6, and the 403 above.

- **OCR tracing (critical).** `next.config.ts` lists the routes that read pictures in `OCR_ROUTES`, now with `/w/*/share`. A new test in `next.config.test.ts` walks `app/`, finds every route that reaches the reader (`readUpload`, `openOcr`, `runJob`) and checks it is listed. It fails when the share route is removed from the list (tried once). In the production build, the share function's trace holds the English data, the 6 WebAssembly cores and 13 worker files, the same as `/shots/read`.
- **The desk's own manifest.**
  - `GET /w/[slug]/manifest.webmanifest`: named "Officers' Desk" / "Mesa dos oficiais" / "Bureau des officiers" (language cookie, else Accept-Language); `id`, `start_url` and `scope` `/w/<slug>`; the public icons and colours; the share target.
  - The `/w/[slug]` layout links it (`generateMetadata`), so every desk page, the sign-in and the how-to included, links only the desk manifest.
  - The public manifest has no share target again, and is otherwise unchanged.
- **The share's address moved to `POST /w/[slug]/share`** (deviation from the review, which asked for `/api/w/share`). The Web Share Target spec drops a `share_target` whose action is outside the manifest's scope, and Chrome does too. With scope `/w/<slug>`, an action at `/api/w/share` would never be offered in Share. With the slug in the address:
  - `sessionSlug`, `shareDesks`, `workspaceSlugs`, `sessionWorkspaceSlug` and the `/w/share` page are gone;
  - `WORKSPACE_SLUG` is back to dev's (only `auth` reserved), so the asked test "WORKSPACE_SLUG rejects share" was not written: nothing needs that slug any more;
  - a session of another workspace is refused like any desk page.
- **Failures recorded.** The reading and the drafts run in `privately` with a code (`w.import.share_failed:<reason>`). The catch calls `recordAppError`, so the code reaches `app_errors` and the admin alert, then the share lands on `?shared=failed`.
- **Honest limits.**
  - Home's line: "A share holds about 4 MB in all, around 2 or 3 screenshots, and nothing was read. To send more at once, use Send screenshots here."
  - The how-to says the same, and says to add the icon from a desk page.
  - The route also refuses a body over 4.5 MB.
  - A share with no picture, or whose pictures the reader refuses, gets its own line: "The share held no screenshot the desk could read. …" (`?shared=empty`).
- **No JSON page.** Headers that are neither a browser-made share nor our own page now redirect to `/w/<slug>?shared=failed`, not a 403 JSON body.
- **Home:** the share line moved from inside "To review" (below the fold at 360) to right under Home's title.
- **Tests added:**
  - `http.test.ts`: `isShareTarget` accepts Android's share and an own-origin multipart post; it refuses a foreign Origin marked none, a body that is not multipart, and no headers.
  - `import-preset.test.ts` (new; `import.test.ts` was at its 300-line limit, so the earlier preset test moved here): a preset starts an unrecognised picture; a recognised Alliance Duel page keeps its type, and a map stays a map.
  - `api/w/[slug]/shots/route.test.ts` (new): an invalid preset (`map`, `elixir_teams`, a word, a number) answers 400 `bad_request`.
  - `w/[slug]/share/route.test.ts` (moved): no session goes to `?shared=again`; an empty share goes to `?shared=empty`; a cross-site form goes to `?shared=failed`. A reader that throws makes no draft and records one `app_errors` row whose detail holds the code and not the reader's message.
- **`pnpm check`:** exit 0. Vitest: 176 files passed, 2 skipped; 940 tests passed, 4 skipped. Drift fine; i18n 17 languages up to date.
- **Short local e2e, 28 of 28 checks**, on a fresh production build with the same setup as above:
  - Manifests:
    - the public manifest is served ("Event Ledger", `/`, no share target);
    - the desk manifest reads "Officers' Desk", or "Mesa dos oficiais" with a PT phone;
    - the desk manifest's start and scope are `/w/ogs`, and its share target is `/w/ogs/share`;
    - `/` links only the public manifest; the desk's sign-in, how-to and signed-in pages link only the desk's.
  - Tab buttons: Member update and Secret Ops each land on their review.
  - The share, as Android sends it: two pages make one review; a mixed share goes to Home with its counts; 17 pictures go to the limit line; an empty share goes to the empty line; unexpected headers go to `?shared=failed` (303); no session and a member go to `?shared=again`, then the member goes to the board.
  - How-to in PT: installing from a desk page, and "uns 4 MB no total".
  - No sideways scroll and every target ≥ 44 px at 360.
- New screenshots `v2-*` in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ac-shots/`.
- **Open issues now:** 1 (Vercel's body limit, now stated in the copy), 2 (Android's real headers), 3 (reinstall: now also needed to get the desk name and start page, from a desk page) and 5 stand; 4 and 6 are resolved.

## Update after rebasing onto dev at c251ad2 (#400, #401)
- The branch's commits were squashed into one, then rebased onto c251ad2. The pre-rebase branch is kept locally as `backup/11ac-before-rebase`.
- **Conflicts resolved, both sides kept:**
  - `/shots/read` keeps #400's one-read-at-a-time guard and 429 `busy`, with `MAX_UPLOAD` from `lib/private/import.ts`;
  - `POST /shots` takes both `pasted` (D109) and `preset` (D110);
  - Home keeps D108's "On the desk now", activity and progress, with the share line first under the title and "On the desk now" after it;
  - the decisions index lists D108, D109 and D110.
- **The share takes the same per-officer read guard.** It moved from the `/shots/read` route to `startReading` / `endReading` in `lib/private/import-read.ts`, so both routes share one set. A share during a reading lands on Home with "The desk was still reading your last screenshot, so this share was not read. …" (`?shared=busy`). New test in `share/route.test.ts`: a held reading sends the share to `?shared=busy` with nothing read, and the guard is free after a share.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`; the workspace track continues in issues #293–#321.
Model / effort: keep. The change had no surprises; the open question (Android's real request) is a device test, not more code.
Owner must do first (after the release that carries this branch):
1. On an Android phone, remove the old icon from the home screen if there is one (it is "Event Ledger" and opens the public site). Open the desk's address `/w/ogs` in Chrome, sign in, then ⋮ → Add to home screen. The icon must read "Officers' Desk" (or "Mesa dos oficiais").
2. Open a game screenshot in the gallery → Share → "Officers' Desk". It should open the draft's review. If it lands on Home with "The shared screenshots could not be read", report it: Android's headers may differ from what the route expects (open issue 2).
3. Share 3 or more full-size screenshots at once, to see where Vercel's 4.5 MB limit starts refusing (open issue 1).
Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- A new tab button is one entry in `TABS` (`app/(private)/_ui/ToReview.tsx`) and one `<TabSend tab="…" />` line. A kind must be in `SAVED_KINDS`, or `preset` is refused (400).
- When Elixir teams (#298) get a `SaveHook`, the Roll call / Elixir team picker can take `<TabSend tab="…">` with `elixir_teams` (D110 left it out on purpose).
- The share target is `POST /w/<slug>/share`, in each workspace's own manifest (`/w/<slug>/manifest.webmanifest`); a new route that reads pictures must be added to `OCR_ROUTES` (the config test finds it).
- A service worker for the share (open issue 1) would replace the server's multipart reading. The route's session and limit rules can stay.
</adjustments>

PR: (added by the orchestrator)
