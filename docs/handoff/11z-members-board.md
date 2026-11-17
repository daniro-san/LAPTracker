# 11z — Members' board

Closes #331 (the members' board, the first slice of #301); part of #293. Rules applied: D71, D73, D75, D99, D100, D102. New decision: **D105** (the issue asked for "D80", which is taken).

## Built
- **Member sessions.** An account in the workspace's Discord server with no leadership role (and no allowlist entry that still runs) now gets a member session instead of "No access".
  - Column `workspace_sessions.tier` (`officer` default, `member`); migration `0031_members_board`.
  - A member session lasts 30 days (`MEMBER_SESSION_MS`) with no role check in between. Officer sessions (D99) are unchanged.
  - A member always lands on `/w/[slug]/board`.
- **Two doors** in `lib/private/access.ts`.
  - `requireWorkspace` refuses a member session (`reason: "member"`). Pages send it to the board (`refuse.ts`); every API route answers `401 signed_out`.
  - `requireBoard` returns a separate branded `BoardAccess` for a member session or an officer's preview.
  - Sign out accepts both tiers.
- **The board**, `/w/[slug]/board` (`lib/private/board.ts`, `app/(private)/_ui/BoardSections.tsx`, `BoardParts.tsx`). Read-only, EN/PT/FR. It shows:
  - the next 7 server days of member-marked Calendar entries, own clock first with ST beside it, with notes, link and linked member notice;
  - this week's Alliance Duel theme;
  - the member notices that have not ended, with "Until …", in the viewer's language with the others as tabs;
  - Start here, with the members' Discord channel named from `WORKSPACE_DISCORD_WEBHOOKS`.
- **Start here.**
  - Table `start_here` (`lib/schema-board.ts`) and `lib/repo/start-here.ts`.
  - `lib/private/start-here.ts`: per-language versions, 409 on a stale language.
  - The officers' editor `/w/[slug]/start-here` (`StartHereEditor.tsx`) and `POST /api/w/[slug]/start-here`.
- **Officer entry points.** "See what members see" under the Calendar's views (`CalendarNav.tsx`). On the board, officers get a preview banner with "Back to the Officers' Desk" and "Edit Start here".
- **Copy.** Every new string is in EN, PT and FR (`lib/private/dictionary.board.ts`). Updated:
  - the notice "Show to members" help;
  - the Calendar "Members can see this" help, without "(coming soon)";
  - the sign-in lead, which now mentions members.
- **Docs.** D105, the index entry, `ARCHITECTURE.md` (the board's modules) and the glossary ("members' board").

## Decisions
- Recorded in D105: the 30-day member session with no role check in between, and the reason for it. The tier on the session. The member tier's rule: in the server, not blocked, and not an officer. Members are stored in `workspace_users`. The board's contents. Start here as one record with per-language versions. The Discord channel name reused from `WORKSPACE_DISCORD_WEBHOOKS`, so no new workspace setting.
- "This week" is today plus the next six server days, not Monday to Sunday. On a Sunday a Monday-to-Sunday week would show one day. This week's Alliance Duel theme is shown above the days.
- Entry notes and links are shown. The Calendar's help already promised members "this event, its notes and its link".
- When the viewer's language is not written, the first written language is shown (EN, PT, FR order) with "Not written in your language yet." The 11i handoff left this open.
- "Start here" in PT is "Comece aqui", in FR "Pour commencer". The board is "Mural dos membros" and "Tableau des membres", the words the notices' "Ends on" help already used.

## Deviations
- The issue names D80; this is D105.
- The e2e's iPhone pass could not do the Discord round trip in WebKit. WebKit drops the `Secure` OAuth state cookie on `http://localhost` and the callback answers `bad_state`. Chrome signed in and the session cookie was handed to WebKit. The sign-in itself is covered by the Chrome runs and the unit tests.

## Verified
- **`pnpm check` exits 0**: prettier, eslint, tsc; vitest **167 files passed, 2 skipped; 881 tests passed, 4 skipped** (after the review round); drift gate fine; i18n "17 languages up to date".
- **Tests added or changed:**
  - `app/(private)/api/w/[slug]/member-session.test.ts`: 17 tests. It walks all 15 officer route files (including `pending`, added by #385) with a minimal valid request per route and method (a fixture map), and checks that no session and a member's session both get `401 signed_out` while an officer's does not; a route without a fixture, or one that answers before its session check, fails. Start here: a member gets 401, an officer 200 `{version: 1}`.
  - `lib/private/board.test.ts`: 4 tests (2 more in the review round, below). Only member-marked entries and notices from today, no author, seat or edit data, and a link to a leadership notice dropped. Start here: two officers' languages both kept, a stale language refused with who.
  - `lib/private/sign-in.test.ts`: the member tier (board landing, 30-day cookie, `member` refusal, served on day 29, expired on day 30), the officer's preview, the outsider, a demoted officer becoming a member, and an expired allowlist outside the server.
- **Local e2e: 51 of 51 checks pass.** Setup: a production build (`next build` + `next start` on :3967), local Postgres with all 31 migrations, the bridge, and a Discord stand-in with Rook (R4), Rio (member) and Ash (not in the server). The browser time zone was America/Sao_Paulo. No upstream, Groq or real Discord call. The checks:
  - Rio (PT, 360) lands on the board, and the session cookie runs for 30 days.
  - Member entries are shown, with "15:00 sua hora · 16:00 ST". The leadership call, the KvK entry, the caravan coach "Mara" and the officer's name are absent.
  - The linked member notice is shown on its entry. Only the two current member notices are listed; the leadership and ended ones are not. The PT text comes first, an English tab switches, and "Ainda não foi escrito no seu idioma" shows where PT is missing. The Start here empty state and "#guides-and-beyond" are shown.
  - At 360 there is no sideways scroll and no target under 44 px. The board answers `no-store`.
  - Rio is sent to the board from 9 desk pages. `GET /api/w/ogs/profile`, `POST start-here`, `POST notices` and `GET thefts` each answer `401 {"code":"signed_out"}`.
  - Ash gets `no-access?why=not_member`.
  - Rook sees the new notice help, uses "See what members see", sees the preview banner, and writes Start here in EN and PT (textareas at 16 px).
  - Rio then reads it in PT. A French viewer gets French words and "Pas encore écrit dans votre langue."
  - There is no sideways scroll at 360 and 1280, light and dark, EN and PT.
  - Sign out from the board works.
  - On the iPhone 14 in WebKit, the board opens, shows the own clock first, and does not scroll sideways.
- **Server log:** only `w.sign_in`, `w.no_access` and `w.state_bad` codes with numbers. No name.
- **Privacy grep:** 5,501 added lines checked against the 101 names of the OGs fixture roster (`fixtures/v1-20261116T105019Z/alliance-67111155.json`): 0 found.
- **Screenshots** (not committed) are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11z-shots/`:
  - `board-{360,1280}-{light,dark}-{en,pt}`;
  - `board-360-light-fr`;
  - `board-preview-360-light-en`;
  - `start-here-editor-{360,1280}-light-en`;
  - `iphone-board-390-light-en`.

  Designer pass: the hierarchy reads well at 360 in PT, nothing overflows, and the time pair and language tabs are clear. No fix was needed.

## Review round (PR 386)
- **Route test** (`member-session.test.ts`): every route and method gets a minimal valid request from a fixture map; no session and a member's session must both answer `401 signed_out` and an officer's must not get 401. Exclusions are listed with a reason (login, logout; board and how-to are pages). A route without a fixture, or one answering before its session check, fails. 17 tests over 15 routes.
- **Officer door**: `requireWorkspace` serves only `tier === "officer"`; `createSession` has no default tier (19 test callers now pass `"officer"`).
- **Architecture**: `StartHereText` is re-exported from `lib/private/start-here.ts`; the UI no longer imports `lib/schema-board`.
- **Copy**: `noaccess.blocked` names both the members' board and the Officers' Desk (EN, PT, FR).
- **Tests added** (`lib/private/member-sessions.test.ts` for the first three, `board.test.ts`, the admin route test): a blocked member gets `blocked` from `requireBoard`; Sign out everyone ends a member session; a member promoted to R4 gets a new officer session and the member one is deleted; the board from a Sunday (this week's theme stays, next Monday's is a day, a weekly repeat into next week, a cancelled week left out, today+6 in and today+7 out); a notice ending today is kept and one ending yesterday hidden; the admin "Sign out members" route ends only that workspace's member sessions, behind the PIN.
- **Out-of-date languages**: a notice language behind the newest (`staleOf`) shows "This translation may be behind the newest version. The other languages are one tap away." (EN, PT, FR).
- **Owner's asks**: `/admin` "Sign out members" (sheet first, PIN, member sessions of that workspace only) and Translate on the Start here editor (drafts with Accept / Undo, nothing saved until Save, 3,000-character limit). Both recorded in D105.

## Open issues
- `noaccess.no_role` is no longer reached from the sign-in. An old link with `?why=no_role` still shows it. It could be removed with the reason list in D73.
- A person who leaves the Discord server keeps the board for up to 30 days (D105). "Sign out members" on `/admin` ends every member session at once; there is no per-person sign-out.
- Officers cannot see which notices or entries members can see without opening the board. The "For members" tag on cards already shows it per item.
- Member rows in `workspace_users` fall under D71's open retention question.

## Next
- Model/effort: keep. This session's scope fit one sitting with the e2e.
- The owner first: merge after review. On production, members sign in at `/w/ogs` (the same link). `WORKSPACE_DISCORD_WEBHOOKS` must hold the `members` channel for the "#guides-and-beyond" line; without it the line is left out. Officers should write Start here before members are told.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A member session never gets a `WorkspaceAccess`. Anything new for members takes a `BoardAccess` from `requireBoard` (`lib/private/access.ts`).
- New officer API routes under `app/(private)/api/w/[slug]` are checked against member sessions automatically by `member-session.test.ts`. A route that must serve members needs its own door and an exclusion in that test.
- The Follow-up tab (#340) and new and former members (D106/D107) pages that call `requireWorkspace` and `refuse()` already send member sessions to the board. Nothing to add there.
</adjustments>

PR: (added by the orchestrator)
