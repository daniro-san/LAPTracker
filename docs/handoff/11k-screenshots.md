# 11k — Screenshot import: Send screenshots, the Discord command, classification, drafts and save (issue #299, D96)

Branch `session/11k-screenshots`, from `origin/dev` and merged with it at ab0cd37 (#344, notices). Rules applied: D71, D73, D74, D75, D77; the decision is D96.

## Built
- **OCR engine** (`lib/screenshot`):
  - `prepare.ts`: each pixel's grey is its distance from its row's background (the most common grey over 5 rows, × 1.5); an optional status-bar crop (`statusBar`: the top 5.5 % of a picture at least 1.9 times taller than wide); `flatten: false` for a plain grey reading.
  - `read-screenshot.ts`: JPEG, WebP and other formats are decoded by Tesseract's own image library (a pass with no recognition) and prepared like a PNG.
  - `ranking.ts`: one thousands separator per number (`8 174,488,831` is two numbers); `placeRanks` (the old majority offset, for the pinned-row check only); `inferRanks` by anchors, so a missing row raises `gap` and never shifts the rows above it, with the medal rule (top row at rank 2 and an unprinted rank of 4 or more: the rows are medals 1–3 and a row is missing after them).
  - `parse-ranking.ts`: `parseRanking`, one parser for Might, Kills and Donation (daily and weekly); it replaces `parseDonationRanking`. It starts after the column header and trims frame noise at both ends of a line.
  - `parse-alliance-duel.ts`: a page shows at most 8 rows; a ninth is the pinned own row.
  - `classify.ts`: `classifyScreen` (scored signals, threshold 3, a tie is "not recognised") and `readScreen` (a second, plain-grey reading of a picture that was not recognised, which is how a map is recognised).
  - `merge.ts`: `mergePages` (pages of one ranking: each row once, rank order, `gap` across pages).
- **Fixtures**: the 12 recorded texts re-recorded with the new preparation; six phone ranking screens added as text only (`fixtures/screenshots/8[7-9]-*-phone.txt`, `90-might-phone.txt`, `98-…`, `99-…`), no picture.
- **Tables** (`lib/schema-import.ts`, migration `0022_last_madripoor.sql`): `screenshot_drafts`, `alliance_duel_points`, `screenshot_checks`. `drizzle.config.ts` lists the three schema files.
- **lib/private**: `import.ts` (`createDrafts`, `saveDraft`, `discardDraft`, `retype`), `import-kinds.ts` (kinds, `SaveHook`, `STATUS_BAR`), `import-save.ts` (hooks: Alliance Duel points; Donation, Might, Kills checks; `oursFor`, `duelSaved`, `isOwnTag`), `import-view.ts` (`toReview`, `toReviewCount`, `draftView`), `import-read.ts` (the only way to the OCR), `import-words.ts`, `import-input.ts` (zod bodies), `discord-interaction.ts` (`verifySignature`, `handleInteraction`), `import-discord.ts` (`fetchPicture`, `runJob`), `dictionary.import.ts` and `dictionary.import.fr.ts` (`import.*`, EN/PT/FR). `lib/repo/import.ts`. `lib/import-command.ts` (the command's one definition). `refusalOf` in `sign-in.ts` is now exported.
- **Routes**: `POST /api/w/[slug]/import/read` (one picture, `image/png|jpeg|webp` body from our origin, 4 MB, 60 s), `POST /api/w/[slug]/import` (text lines → drafts), `POST /api/w/[slug]/import/[id]` (save, discard, retype; 409 with who), `POST /api/discord/interactions` (public, signed).
- **Pages**: Home shows "To review" (shared list) and "Send screenshots" (`ToReview.tsx`, `SendScreenshots.tsx`); the Home tab carries the count. `/w/[slug]/import/[id]` (`DraftReview.tsx`, `DraftHeader.tsx`, `DraftRowCard.tsx`, `draft-known.ts`). The Members card's details gain "Alliance Duel this week · from a photo" while anyone has saved points.
- **Env**: `DISCORD_PUBLIC_KEY` (optional, 64 hex; `.env.example`). **Script**: `pnpm discord:register <guild id> …`.
- **next.config.ts**: `serverExternalPackages: ["tesseract.js"]`; `outputFileTracingIncludes` for the two OCR routes (data, worker, WebAssembly core).
- **Analytics** (D77 amended): `ws_screenshot_sent` and `ws_draft_saved`, property `kind` only.
- **Tests**: `classify.test.ts` (5), `merge.test.ts` (2), `import.test.ts` (5, PGlite), `discord-interaction.test.ts` (7, PGlite), new cases in `parse-ranking.test.ts`, `parse-alliance-duel.test.ts`, `prepare.test.ts`.
- **Docs**: D96, D77 line, ARCHITECTURE (lib/private import modules, lib/screenshot, lib/import-command), the fixtures README.

## Decisions
- **OCR on the server** (D74's open question): the browser converts, crops and scales; the server reads. The Discord path has no browser.
- **"To review" lives on Home**, with its count on the Home tab. The fifth tab ("Follow-up") belongs to the weekly worklist issue, so it was not reused.
- **A not-recognised picture makes no draft.** In the desk, its text lines stay in the browser; "Pick the type" sends them back with the type, and the server classifies them again (a map stays a map even when picked). On Discord the reply says "Not recognised — nothing was saved"; no "Pick the type" button there.
- **Coming-soon kinds make no draft**: the reply says what was read and that saving it comes soon.
- **Drafts are deleted 7 days after creation, saved or not**; the saved Alliance Duel points and check records stay. Check records keep counts only.
- **A Discord officer is stored as a workspace person** (display name, no sign-in time), so saves and drafts name them; this is the second maker of a `WorkspaceAccess`.
- **The picture's day** is the Discord message's time (server day) or the upload time; Alliance Duel drafts let the officer pick "the week before" (a Sunday picture sent on Monday) and the day tab (Mon–Sat, defaulting to the picture's weekday, Sunday → Sat).
- **Matched rows start with their member; doubtful and not-found rows start empty**, and Save stays off until every kept row has a member and a value (or is dropped).
- **Own-alliance filter**: a tag is ours when it folds to the same letters (0→o, 5→s, 6→g, 1→l) or one letter apart; an unread tag is kept (the member match decides).
- **Member update** (owner, 2026-11-16): the chat type is "Member update", for every member, not only new ones.

## Deviations
- **Member update stays "coming soon".** 11f's `onboarding-parse.ts` and `member_facts` were not on dev at ab0cd37. Its hook must support updates: show the previous value next to the read one ("AD Tech 69% → 74%"), skip AD Tech at 100 %, append a version "from a photo" for existing members.
- **Secret Ops stays "coming soon"** (11j not on dev). Its review needs a victim member picker, defaulting to the officer's "This is me" `player_uid` (#341), and its hook calls `saveSecretOpsDraft(db, access, { victimUid, readAt, entries }, { now, zone })`.
- **No rate limit** on the import routes or the interactions route: officers only, 16 pictures per send, 8 MB per Discord attachment, 4 MB per desk upload. Noted under Open issues.
- **The map is recognised from its own controls** (Map, Mail, Bag, the `0/s` rates) in the plain reading; at 716 px the city labels are mostly not read. One map picture was available.
- `parseDonationRanking` was replaced by `parseRanking` (`contribution` → `value`).
- The migration is `0022` on dev at ab0cd37; 11f takes 0022 and 11j 0023, so it is renumbered at merge.

## Verified
- **`pnpm check`** after the merge with dev (ab0cd37): exit 0. Vitest 120 files passed and 2 skipped, 610 tests passed and 4 skipped; drift gate fine; i18n 17 languages up to date. Before the merge: 104 files, 534 tests passed, 4 skipped.
- **OCR on the owner's iPhone prints** (`scratchpad/game-prints-2026-11-16`, 923 × 2000 JPG; truth typed from the pictures; 41 list rows: donation weekly 6, donation daily 6, kills 7, might 7, AD weekly 8, AD daily 7; plus each picture's pinned own row):

  | | values read | right rank and value | own pinned row read |
  |---|---|---|---|
  | before, JPG as sent | 32/41 | 25/41 | 0/6 |
  | before, converted to PNG | 37/41 | 30/41 | 0/6 |
  | after, JPG, status bar dropped (Discord path) | 41/41 | 41/41 | 6/6 |
  | after, PNG, status bar dropped (desk path) | 41/41 | 41/41 | 6/6 |
  | after, JPG, no crop | 41/41 | 41/41 | 6/6 |

  The green own row (rank 4 on Donation and Might) is now read with its name and value. 0.4–0.7 s per page on this machine (one worker).
- **Committed fixtures re-read** with the new preparation: ranks and values equal to before on 11 of 12 pictures; picture 31's one wrong number (42,831,997) is now right; names read better (`y21dvl`, `Kasoar-Thorne`, `helloallyou`, `[ANM]cinalice`). Secret Ops 53 and 54: every entry's kind and time as before.
- **Classification** on all 22 local pictures: the six rankings right (AD Daily sure from the day tabs; Donation weekly to confirm), damage event result and Undead Siege result recognised; notices (84, 85, the EB poll 86), mails (91, 92, 96) and the personal reward tabs (93, 94) not recognised; 4 of 5 chats are Member update (chat 80 shows one message); the map is a map.
- **`OCR_TEST=1`** (real OCR against the recordings): 3 of 3.
- **Local e2e, 39 of 39 checks** on a production build (`next build` + `next start`), the local database, the database bridge, a Discord stub and a fetch preload that answers `cdn.discordapp.com`/`media.discordapp.net` from the stub (no real Discord or upstream call):
  - one send of 98, 99, 89, 90: "Alliance Duel weekly, 8 rows, 2 doubtful, 1 not found", "Alliance Duel daily, 7 rows, 1 not found", "Kills, 7 rows", "Might, 7 rows" (2.5 s);
  - 87 + 88: one "Donation weekly, 6 rows" draft;
  - a notice (84): "Not recognised — nothing was saved", the six types to pick, Discard;
  - the map: "This screenshot has nothing the desk uses", no type list; a chat: "Member update … comes soon"; no draft from any of the three;
  - Home tab shows 5, the list 5; no sideways scroll at 360, every control in main ≥ 44 px (Home and draft);
  - AD weekly reviewed and saved: 7 members' week points stored (Zsu78HUN 22,961,474), "Saved by Ana (R4)."; the Members card shows "Alliance Duel this week · from a photo";
  - two officers pressing Save on the Kills draft at once: one "Saved by …", the other "Already saved by …"; one check record (7 rows, 7 compared, 6 same);
  - Discord, signed with a test Ed25519 key: PING → type 1; unsigned → 401; a member without the role → an ephemeral refusal in PT; an officer → deferred ephemeral reply in 12 ms, then the reply edited at `/webhooks/900/itok/messages/@original` within 2 s: "Lido: Alliance Duel semanal, 8 linhas, 2 em dúvida → [Revisar](…/w/ogs/import/6)" and "Lido: Might, 7 linhas → …"; the JPEG attachment was fetched as `…/90.jpg?format=png` from the media proxy; no picture bytes in the drafts.
- **`pnpm discord:register 1544808864262914060`** against the stub: a client-credentials token, then `PUT …/guilds/1544808864262914060/commands` with `[{"name":"Send to LAPTracker","type":3}]`, HTTP 200.
- **Build traces**: both OCR routes ship `eng.traineddata.gz`, the six `tesseract.js-core` `.wasm` files and the worker script; the Home page ships none of them. Not deployed: the bundle size on Vercel is unmeasured.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11k-shots/`: Home and the drafts at 360 and 1280, light and dark, EN and PT; after a send; not recognised; saved; the second officer's refusal; the member card; the Discord reply text.

## Open issues
1. **Real Discord not tested** (only after release): the signature with the real Public Key, the 3 s answer from Vercel, `after()` running to the end, the media proxy's `format=png` answer (to confirm on the first real test), and the reply edit.
2. **Vercel bundle**: size and cold start of the OCR routes not measured; `maxDuration` 60 s.
3. **No rate limit** on `/api/discord/interactions` or the import routes.
4. **Doubtful names on small pages**: 9 of 16 names sure on the 358 px pages 27–28; the phone prints do better (6 of 8 sure on 98).
5. **AD medal rule** can mis-rank a page scrolled by exactly one or two rows; it then flags `gap` on the first read row.
6. **Picture day**: a desk upload uses the upload time, not the photo's time; the draft offers "the week before" for Alliance Duel only.
7. **Donation daily vs weekly** cannot be told from the text; the draft asks. A daily check compares with the end-of-day read of the picture's day, which is taken at 23:37 server time: earlier pictures differ by design.
8. The "Pick the type" button in the Discord reply is not built.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`; the workspace track continues in issues #293–#321 (11f member facts, 11j thefts, #298 event results).
Model / effort: keep — the risky parts (OCR accuracy, first save wins, signed interactions) are measured and tested; what remains is plugging hooks in.
Owner must do first (after the release that carries this branch):
1. Discord Developer Portal → the LAPTracker app → **General Information** → copy **Public Key** → Vercel → Project → Settings → Environment Variables → add `DISCORD_PUBLIC_KEY` (Production; not Sensitive needed, it is public) → redeploy so the function reads it.
2. Same page, **Interactions Endpoint URL**: paste `https://laptracker-inky.vercel.app/api/discord/interactions` and Save. Discord sends a PING with a test signature; the save succeeds only when step 1 is live.
3. Register the command in the OGs server, from a checkout with `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` in `.env.local`: `pnpm discord:register 1544808864262914060`. It prints `1544808864262914060: HTTP 200 "Send to LAPTracker" registered`. For another workspace, add its server id. Discord may take a minute to show "Apps → Send to LAPTracker" on a message.
4. Test: long-press a message with a ranking screenshot → Apps → Send to LAPTracker; the reply (only you see it) should read "Read: … → Review".
Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- To make a kind saveable, add a `SaveHook` to `SAVE_HOOKS` in `lib/private/import-save.ts` (`read(pages, scope, own)` → rows; `save(db, access, saving)` runs in the save's transaction after the first-save-wins claim). `canSave`, `SAVED_KINDS`, the type list and the "coming soon" reply follow by themselves.
- Member update (11f, #297): the classifier already returns `member_update` for a chat page (3+ sender lines). The hook must show the previous value beside the read one, skip AD Tech at 100 %, and append a "from a photo" version for existing members. `ViewRow`/`DraftView` need a per-kind "previous" field; the review UI is per kind (`DraftRowCard.tsx`).
- Thefts (11j, #321): `secret_ops` is recognised; parse with `parseSecretOpsReport`. The review needs a victim member picker defaulting to the officer's "This is me" `player_uid`; save calls `saveSecretOpsDraft(db, access, { victimUid, readAt, entries }, { now, zone })`. `Saving` has no victim field yet.
- Event results and Elixir teams (#298): `damage_event`, `undead_mail` and `elixir_teams` are recognised from "Damage Phase"/"MVP Bonus", "withstood N waves … Lv.X difficulty", and "Participants: n/20" with Team A/B. No parser exists for them.
- Drafts store each picture's OCR lines (`pages`), so a new hook can re-read old drafts with `retype`.
- Words go in `lib/private/dictionary.import.ts` / `.import.fr.ts` under `import.*`.
- The migration is `drizzle/0022_last_madripoor.sql`; renumber after 11f (0022) and 11j (0023) merge.
</adjustments>

PR: (added by the orchestrator)
