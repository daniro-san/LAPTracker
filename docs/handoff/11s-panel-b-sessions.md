# 11s — Panel batch B: sessions that recover, the page you came from, no duplicates

Basis: the review panel of 2026-11-17, batch B. Branch `fix/panel-b-sessions-and-duplicates` from `origin/dev` (80308b1, with batches A and C merged).

The brief and `adversarial.md` number some findings differently:

| Item | Brief | adversarial.md |
|---|---|---|
| Return path | ADV-7 | ADV-6 |
| Duplicates (desk and Discord) | ADV-10 | ADV-7 |
| Duplicates (add sheets) | ADV-10 | ADV-12 |
| Right-to-left names | ADV-12 | ADV-10 |

Fixed: ADV-1, ADV-4, ADV-6, ADV-7, ADV-8, ADV-9, ADV-10 and ADV-12 (adversarial.md numbers), and the language-order finding from the batch A builder.

## Built
- **Sessions (D99)** in `lib/private/session.ts`, `access.ts` and `sign-in.ts`:
  - `workspace_sessions.checked_at` records the last time Discord confirmed the role.
  - The API routes serve a session for 1 h after that check (`CHECK_MS`).
  - Pages renew it after 30 min (`RENEW_MS`) through the silent Discord trip. The callback renews the same row in place (`renewSession`): same token and cookie, new `checked_at`.
  - Cap: 7 days after sign-in (`SESSION_MS`), or the allowlist end. The cookie's Max-Age is that end.
  - A trip that does not admit the person deletes the browser's session for that workspace (`out()` in `finishSignIn`): lost role, Discord error, or refusal. A stale page therefore shows the sign-in or the no-access page and does not loop.
  - `signOut` also ends a session that is waiting for its check.
- **Return path (ADV-6/7):**
  - `returnPath(slug, raw)` accepts only `/w/<slug>` or a path below it.
  - The path travels as `next`: login route, then the OAuth `state` (third part, base64url), then the callback, which checks it again.
  - `refuse(slug, reason, path)` (`app/(private)/_ui/refuse.ts`) sends a stale page to `/api/w/<slug>/login?silent=1&next=<path>`, and a signed-out page to `/w/<slug>?next=<path>`. Home's sign-in button carries `next`.
  - Every page passes its own path. The calendar keeps `?week=`.
- **One signed-out answer (ADV-1):**
  - Every `/api/w/...` route answers `401 {"code":"signed_out"}`. The three shots routes used to answer with the refusal reason.
  - `app/(private)/_ui/SignedOut.tsx` holds `SIGNED_OUT`, `SignedOutNote` and `RefusalLine`. The words come from `SignedOutProvider` in `SignedInFrame`.
  - The line reads "You were signed out. Your text is still here." and a link: "Sign in again (opens a new tab), then try again here." The link is a silent sign-in in a new tab with this page as `next`. No form is cleared.
  - It is wired into: the notice editor (Save, Translate and Improve), facts, the member sheet, the calendar add and edit sheet, Delete, caravan seats, theft add, follow-up and Remove, the draft review, the sheet import, the profile writes, and Send screenshots.
  - On Send screenshots a 401 stops the reading and shows this line, never "This picture could not be read."
- **Demoted officers (ADV-8):**
  - The next page load 30 minutes or more after the last check takes the person through Discord. Without the role they land on `/w/<slug>/no-access?why=no_role` and the session row is deleted.
  - Whatever the page does, the APIs refuse an hour after the last check.
- **Sign-out ask (ADV-4):**
  - `SignOutButton` asks with batch A's `AskSheet` ("Sign out? The text you have not saved on this page is lost." / "Stay signed in" first / "Sign out") when the page has an element marked `data-unsaved`.
  - Two places set it: the notice editor form while it has changes, and the list of a draft review (Rows and Secret Ops) once rows are changed.
- **Duplicates (D100):**
  - Discord: `discord_pictures` (workspace, message id, attachment id → draft id), claimed atomically in `handleInteraction`, before Discord gets its answer.
    - A re-run with nothing new answers at once: "These pictures were already sent to the Officers' Desk. No new draft was made." It is followed by the Review links.
    - `runJob` records each picture's draft and lets go of the pictures it did not read, so a retry reads them again. A failed reading lets go of all of them.
    - Attachments now need their `id` (Discord always sends it).
  - Add sheets: `thefts.request_id` and `calendar_entries.request_id`, each with a unique index per workspace. `TheftForm` and `EntryForm` make one UUID per open sheet. `addTheft` and `createEntry` answer the first result for a repeated id.
  - Desk: Send screenshots stays disabled until the drafts exist. When making the drafts fails, the pages already read are kept and "Try again" sends them again without re-reading (`useSend`). The upload helpers moved to `screenshot-upload.ts` because of the file's size.
- **Counts (ADV-9):**
  - One rule, `needsAWord(who)` in `lib/private/members-list.ts`: Check in or Needs help, and not on a break.
  - The Members header and Home count it.
  - The list's "Check in and Needs help" group holds it. That group now also takes such members with no rank read, so the count and the group always match.
  - The words now say "{n} people to check in with or help" (PT "ou ajudar", FR "ou à aider"). The link goes to that group (`?order=rank#ml-heading`) instead of the `?who=checkin` filter.
- **Right-to-left names (ADV-10):**
  - `isolate()` in `lib/copy.ts` wraps a name or title in FSI…PDI. It is used in every `fill()` sentence that takes a name: Signed in as, Sent by, Saved/Discarded by, Already saved by, Read as, Facts: name, was name, Remove name?, calendar seats and conflicts, notice written/changed/conflict, theft "Set by", reopened, "Taken from", "[TAG] name", typed-name option, "Edit: title".
  - `<bdi>` wraps names that share a line with other text: thefts, sheet-import matches, attacker hits, This is me. On public pages: Players, a player's names and heading, Leadership, Members explorer, member and player compare, member history, and alliance names on the event and across-events pages.
  - Names that are already their own flex item were left as they are: flex blockifies them.
- **Language order:** `factsOf` returns stored languages in `LANGUAGES` order. Every read of facts goes through it, so old sheet imports open unchanged in the editor.
- Words in EN, PT-BR and FR: `shell.signOutAsk`, `shell.stay`, `signedOut.text`, `signedOut.link`, `shots.discord.already`, `shots.tryAgain`, and the three `members.checkinCount.*` values changed.
- Migration `0026_session_checks_and_request_ids.sql`, from `pnpm db:generate`. Dev had not moved since this branch was made.
- Tests:
  - `sign-in.test.ts`:
    - the hour and the 30 minutes;
    - renewal in place, and the 7-day cap;
    - a demoted officer at renewal;
    - a Discord refusal at renewal;
    - the return through sign-in.
  - Its fixture moved to `sign-in.test-helpers.ts`, because the file passed 300 lines.
  - `sign-in-return.test.ts`: `returnPath` and 14 attempts to leave the workspace.
  - `discord-interaction.test.ts`: a re-run makes no draft and links the first one; a failed reading can be sent again.
  - `thefts.test.ts` and `calendar.test.ts`: the same request id twice.
  - `members-list.test.ts`: the count rule.
  - `member-facts.test.ts`: the language order.

## Decisions
- **No Discord token is stored** (D71 kept). The role is re-checked only through the silent Discord trip, so "renewal" means that trip. It runs on pages at 30 minutes, the APIs stop at 60 minutes, and the cap is 7 days. Storing an encrypted token would remove the page trips but reverses an owner decision; it is listed in D99 as not chosen.
- The renewal keeps the same token (in place), so a tab with unsaved work keeps a valid cookie after the officer signs in in another tab.
- The signed-out line is the same everywhere, reads included (the member sheet). It says "then try again here" so it fits a load as well as a Save.
- The request id lives on the row (unique index) instead of in a "short window" table. A UUID does not repeat, and a refused add leaves no row, so the officer can fix the form and resend.
- The count is "Check in or Needs help, not on a break", because the list's first group shows exactly those. The two separate numbers ADV-9 suggested would each need a filter that leaves out breaks.
- The language order is fixed where facts are read, not where they are written: that also covers rows already stored.
- RTL: names that share a line with other text are isolated. Copied and exported text (Copy for spreadsheet, notice copies) is not, so no invisible characters reach a spreadsheet or the game.

## Deviations
- The brief's sliding rule ("each authenticated request in the last part extends it") is carried out by page loads only, through Discord. An API request never extends a session without a role check, because that would undo ADV-8.
- `SendScreenshots.tsx` passed 300 lines. Its upload helpers moved to `app/(private)/_ui/screenshot-upload.ts`.
- `sign-in.test.ts` passed 300 lines. Its fixture moved to `lib/private/sign-in.test-helpers.ts`, and the `returnPath` cases to `sign-in-return.test.ts`.
- New notices have no request id. ADV-12 also names them, but the brief lists only theft and calendar adds.

## Verified
- `pnpm check` exit 0: 146 files passed, 2 skipped; 767 tests passed, 4 skipped; drift clean; i18n 17 languages up to date.
- **Local production build** (`next build`, then `next start -p 3737`, Node 26.13.0):
  - **Setup:**
    - a local Postgres on 54847 with its bridge on 54848, all 27 migrations;
    - panel A's invented 100-member seed, with two names changed to `محمد٢` and `U+202E Quillon`;
    - the Discord stub on 54849, with `/__lead` to take a role away;
    - a throwaway Ed25519 key for signed interactions;
    - upstream pointed at a dead port.
  - **Script:** `scratchpad/panel-b/env/verify.mjs`, 29/29 checks pass.
    - **Expired session mid-edit.** Write a notice, then set `checked_at` 61 min back and tap Save. The signed-out line shows and both fields keep their text. The link opens a tab that lands on `/w/ogs/notices/new`, and the next Save stores the notice.
    - **Page renewal at 31 min.** It lands back on `/w/ogs/members` with the same cookie, and `checked_at` is refreshed.
    - **Signed-out deep link.** `/w/ogs/shots/<id>` goes to `/w/ogs?next=…`, and Sign in lands on `/w/ogs/shots/<id>`. These four `next` values all landed on `/w/ogs`:
      - `https://evil.example/w/ogs`
      - `//evil.example/w/ogs`
      - `/w/afr/members`
      - `/w/ogs/../../admin`
    - **Demotion.** Wren (R4) loses the role in the stub. The next page load after 31 min lands on `no-access?why=no_role`, and the session row is gone. An API call 61 min after the check answers `401 signed_out`.
    - **Retried adds.** A theft add and a calendar add, each sent twice with one request id, store one row each.
    - **Send screenshots.** The reading was answered by a stand-in and the drafts request held for 2 s. The button was disabled the whole time; a forced tap sent nothing: one drafts request, one draft.
    - **Discord re-run.** A signed interaction on a message already sent answers type 4 at once with the existing draft's Review link, and adds no draft. No job ran, so no CDN fetch was made.
    - **Sign out.** With a typed title it asks, and "Stay signed in" keeps the text. With nothing unsaved it signs out without asking.
    - **RTL.** Home reads "Sent by ⁨محمد٢⁩ · from Discord · Tue 06:42 server time", in order. On Thefts the RTL victim is inside `<bdi>`, and an attacker named `U+202E Vex` reverses only inside its own name: "[ZZZ] xeV · 0 this week" keeps its order.
  - **Captures:** `scratchpad/panel-b/shots/` (expired notice, sign-out ask, RTL home, thefts, members; 360 light EN).
- No upstream, Groq, real Discord or `/api/quota` call. All names and ids are invented.

## Open issues
1. A browser that is not signed in to discord.com shows Discord's sign-in page at each renewal, not a silent trip. This is common on iPhones that authorised through the Discord app. Under D73 it happened once a day.
2. The attacker search in the theft sheet still shows "no player found" on a 401. The Save of that sheet shows the signed-out line.
3. The profile and member-sheet loads use the line, but the profile's first load still says "Could not load" on a 401.
4. The Filters sheet's "Check in" count is a filter and still includes members on a break. The header count does not.
5. New notices retried after a lost answer can still be stored twice (ADV-12, not in this batch).
6. /admin (English, owner only) names were not isolated.
7. D99 and D100 were free on every remote branch at the time of writing. Check again if another batch is in flight.

## Next
Session: the next panel batch the orchestrator picks. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep. The batch fit one pass; most time went to the client wiring of the signed-out line and the local checks.
Owner must do first:
- Decide whether the hourly renewal trip is acceptable on iPhones (Open issue 1). If not, D99's "Not chosen" option (an encrypted Discord token) needs a new env key.
- Review the captures.
Plan changes needed: none.

<adjustments>
- Use `RENEW_MS` on every new workspace page: `requireWorkspace(db, slug, jar, now, RENEW_MS)`. Pass the page's own path to `refuse(slug, reason, path)`. API routes keep the default (`CHECK_MS`) and answer `privateError(401, "signed_out")`.
- A new client write shows a 401 with `RefusalLine` or `SignedOutNote` from `app/(private)/_ui/SignedOut.tsx`. It never shows "Try again" for a 401.
- A new add sheet makes one `crypto.randomUUID()` per open sheet and sends it as `requestId`. Give its table a `request_id` with a unique index on (workspace, request id).
- A new page with unsaved work outside a sheet marks it `data-unsaved`, so Sign out asks first.
- A name inside a `fill()` sentence goes through `isolate()` (`lib/copy.ts`). A name sharing a line in JSX goes in `<bdi>`. Copied or exported text gets neither.
- "People to check in with" is `needsAWord(whoOf(m))` everywhere.
</adjustments>

PR: not opened; the orchestrator pushes the branch and opens it.
