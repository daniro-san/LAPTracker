# 11f — Member facts, "Paste what they told you", the time-zone picker and the one-time sheet import

Issue #297. Rules applied: D71, D72, D75, D77, D78. New decision: D80. Also built here, at the coordinator's request (owner, 2026-11-16): the Members tab before an alliance's first end-of-day read.

## Built

- **`member_facts` and `name_aliases`** (migration `0020_lying_squadron_sinister`; tables in `lib/schema-facts.ts`, re-exported by `lib/schema.ts`).
  - One append-only row per write of one field: `squadMight`, `adTech`, `troopTier`, `timeZone` (IANA), `languages`, `status` (`break`, `help`), `away` (`{ text, until }`), `notes`.
  - Each row has a `source` (`message`, `officer`, `sheet`), a `version` per (workspace, uid, field) and `written_by`.
  - Reads and writes: `lib/repo/member-facts.ts`. Rules: `lib/private/member-facts.ts`. Fields, sources and merges: `lib/private/fact-fields.ts` (pure).
- **Concurrency** (`saveFacts`). A write names the version the officer saw.
  - A stale write of `notes` is combined: the newer text, then the lines the stale edit added.
  - A stale write of `languages` is joined: the newer list, minus what the stale edit removed, plus what it added.
  - Any other stale field gets 409 with the newer value, version and source.
  - Writing the value already stored is not a conflict.
  - Two writes of the same version at once: the unique version lets one in; the other gets 409.
  - Facts are written only for a uid in the alliance's newest roster (`access.unionId`); otherwise 404.
- **`POST /api/w/[slug]/members/[uid]/facts`** `{ changes }`: same origin, JSON, a session of the workspace; 200, or 409 when any field conflicted (the other fields are saved).
- **The card** (`MemberCards.tsx`, `member-card-data.ts`). The opened card lists the eight facts with their source badge ("from a message", "typed by an officer", "from the sheet"), then two buttons: "Paste what they told you" and "Edit facts".
- **The editor** (`FactsEditor.tsx`, `FactFields.tsx`, `facts-form.ts`): a bottom sheet on phones, a centred card from 640 px.
  - Fields: squad might (accepts "9.9M"), AD Tech %, troops T1–T12, the time-zone picker, 18 language toggles, status (As we see it / On a break / Needs help), away note and last day away, notes.
  - Save sends only the changed fields, each with its version.
  - On 409: under the field, "Another officer saved this meanwhile: <value>" with "Keep theirs" and "Use mine"; the save bar names the waiting fields; Save stays off until each is answered.
  - A field the server combined replaces what the officer typed in the form.
  - Every control is at least 44 px.
- **Statuses** (`members.ts`, `members-sheet.ts`, `members-list.ts`):
  - an officer's status (On a break, Needs help) shows instead of the computed one;
  - an away note whose last day is today or later (server day) shows "On a break until <day>";
  - a member on a break has no Check in reasons and is left out of the thanks;
  - Needs help keeps the reasons as lines and leaves the Check in filter and count.
  - The idle reason now ends "…, no away note" in all three languages.
- **"Paste what they told you"** (`lib/private/onboarding-parse.ts`, pure). `parseOnboarding(text | lines, now, serverZone)` returns squad might, AD Tech, time zones (best first) and languages.
  - What it finds fills the editor's fields marked "from a message"; nothing is saved until Save. A value the officer edits becomes "typed by an officer".
  - It takes a string or OCR lines, for 11k.
- **The time-zone picker** (`TimeZonePicker.tsx`, `lib/private/time-zones.ts`, `lib/private/zone-table.ts`).
  - The list is every zone of `Intl.supportedValuesOf("timeZone")` (418 in Node 26), under its IANA name, with its country from tzdata 2026f's `zone.tab`.
  - Search: city; country names in en, pt-BR and fr; UK/USA/EUA/BR; abbreviations (PST, EST, CET, BRT, MSK, …); offsets ("-3", "UTC+1", "ST +3"). An offset alone also offers the fixed zone (ST +3 → `Etc/GMT-1`).
  - The zones the alliance uses come first. Each row shows the time there now and its offset. "Their time now" lists the zones whose clock reads that time.
- **The import** (`/w/[slug]/import`, `SheetImport.tsx`, `POST /api/w/[slug]/import`, `lib/private/sheet-parse.ts`, `lib/private/sheet-import.ts`).
  - Input: paste (CSV or tab-separated cells) or a CSV file.
  - Output: the columns read and not imported, then "N rows · matched · to check · not members".
  - Each open row offers "Is it…" suggestions, "Someone else" (every member) and "Not a member", plus one button for every row with no match.
  - Import stays off until every row is answered. The result reads "Done: N values saved for M members. K kept, because the field already had a value."
  - A link "Import the old spreadsheets" sits at the bottom of Members.
- **Before the first end-of-day read** (coordinator's request, any workspace): `lib/repo/workspace-any-roster.ts` `anyRoster` returns the alliance's newest roster of any kind: a daily read, an event's Start or End, or a sample, even a stale one.
  - Sanctuary and rank come from the newest Start or End; every other field is "—".
  - No reason, New, missing info or status is computed. The "Everyone looks fine this week" line is not shown.
  - The line says "Roster from <day hh:mm> server time · donations and activity come with the first end-of-day read, after <DAILY_ROSTER_AT> server time."
- **Privacy.**
  - `privately` (`lib/private/http.ts`) gives `app_errors` and the admin alert a code only for the facts and import routes, because a database error's message quotes the parameters.
  - Two analytics events without properties: `ws_facts_saved` and `ws_sheet_imported`.
- **Words:** 64 new keys in en, pt-BR and fr, with French no-break spaces (U+00A0).
- **Docs:** D80, `docs/ARCHITECTURE.md` (new modules; `lib/private → lib/screenshot`).
- **Tests (21 new):**
  - `onboarding-parse.test.ts`: 6;
  - `time-zones.test.ts`: 5;
  - `member-facts.test.ts` (PGlite): 3;
  - `sheet-parse.test.ts`: 3;
  - `sheet-import.test.ts` (PGlite): 2;
  - `members.test.ts`: 2, the away note and the roster before the first end-of-day read, the second alliance with only a snapshot included.

## Decisions

- Everything about the model, the merges, the parser, the picker, the import and the early roster is in D80.
- **The fields are camelCase strings in `member_facts.field`** (`squadMight` …), the same names as in the code; there is no mapping layer.
- **The sheet fills only empty fields**, and between sheets the first to fill a field wins. The import is idempotent, and it never overwrites an officer's or a message's value.
- **Import candidates are the alliance's current members.** Rows of people who left are answered "not a member". Past names come from this alliance's daily rosters (`member_names`) and event rosters. Other alliances' rows are not read (D71), so `sightingsOf` in `lib/queries/players.ts` (which reads every alliance) is not used.
- **A remembered "not a member"** is a `name_aliases` row with a null uid. The next sheet with that name shows the row as "not a member" without asking.
- **Badge tones:** "from a message" uses the yarn tone and "from the sheet" muted ink. Burgundy is too dark as text in dark mode (#7d2c4f on #1a1418). Error texts use `text-seal`, as elsewhere.
- **The tables are in `lib/schema-facts.ts`.** `lib/schema.ts` passed the 300-line limit; 11i did the same with `lib/schema-notices.ts`.

## Deviations

- **The sheets' notes, statuses ("Watch"), communication and participation columns are not imported.** D71: retention must be decided before officer notes are imported from the sheets. Participation belongs to #298.
- **An away note without a last day** is shown on the card only. It does not put the member on a break; the task says "with an end date".
- **KvK reason still held** (`KVK_REASON_ON = false`), as asked. Away notes now exist, so the owner can decide to turn it on (see Next).
- **Not built:** an "Away" filter (#296), facts in "Copy for spreadsheet", and translation of notes (#305).
- **Time zone in the import:** an offset alone ("ST +3", "EU +1") is stored as the fixed IANA zone (`Etc/GMT-1`). It does not follow daylight saving; an officer can pick a city later.
- **Migration number:** `0020`, the next free one on dev when committed. #341 (11n, `0020_workspace_user_profile`) is still open and 11i has no PR yet. See Open issues 1.
- **Analytics:** two events were added (D77's list was six); D80 records them.

## Verified

- **`pnpm check` exits 0** on the merged tree (dev at c6aad69):
  - prettier, eslint, tsc;
  - vitest: 105 files passed, 2 skipped; 530 tests passed, 4 skipped;
  - drift gate "Everything's fine";
  - i18n: 17 languages up to date.
  - No test timed out.
- **Local e2e:** `next build` + `next start` of this tree; the local Postgres (54327) and its bridge; 11c's Discord stub on 54378; Playwright-core with system Chrome. The worktree-only `.env.local` has random secrets (never printed) and the upstream pointed at a dead port. No upstream call and no Discord call.
  - Seed: 11e's OGs seed, from the scrubbed fixture: 9 end-of-day reads, 8 arrays-only reads and a Saturday event. Plus `/w/nse`, with only one public event roster from `fixtures/v1-ids/67109944.json`.
  - **29 of 29 checks passed**, on the final build of the merged tree:
    - sign-in through the stub;
    - edit facts (9.9M, 69, T9, Kyiv through the picker, English, a note): the card shows "9.90M", "69%", "T9", "Europe/Kyiv · UTC+2", "English" and the note, each "typed by an officer";
    - time-zone search: "ukraine" → Kyiv first, "Brazil -3" → São Paulo first, "PST" → Los Angeles first;
    - two editors on one card:
      - the stale troops edit shows "Another officer saved this meanwhile: 10";
      - the notes were combined ("Line from Ana\nLine from Bea");
      - "Keep theirs" leaves troops at 10 and the combined notes;
    - the route: a stale version answers 409 with the newer value; `cache-control: private, no-store`; a cross-site write is refused (403);
    - paste (invented lines): main squad 9,900,000; AD Tech 53 from the line with "%", not "539"; time zone America/Sao Paulo; four "from a message" badges; nothing saved before Save; after Save the card says "from a message";
    - no sideways scroll at 360 dark, 1280 light and 1280 dark;
    - `/w/nse`:
      - the OGs session does not open it; it asks for its own sign-in;
      - it shows "Roster from Sat, Nov 14 11:00 server time · … after 23:30 server time." and 98 of 98 members;
      - no Fine, no check-in line, Check in 0;
    - import of an invented sheet in the browser: "4 rows · 2 matched · 2 to check · 0 not members"; Import off until every row is answered; "Done: …";
    - no `app_errors` row after the run.
  - **The real sheets, local only, through the import route** (counts only). Every open row was answered "not a member" so the import could run end to end; those answers carry over to the next sheet as "remembered".

    | Sheet | Rows | Matched (current / segment) | Unsure | No match | Remembered "not a member" | Values saved / kept |
    |---|---|---|---|---|---|---|
    | OG TRACKING | 97 | 61 (59 / 2) | 3 | 33 | 0 | 138 / 3 |
    | Might and ADp | 100 | 85 (83 / 2) | 4 | 2 | 9 | 42 / 122 |
    | Participation week 1 | 109 | 69 (69 / 0) | 3 | 14 | 23 | 31 / 22 |
    | Participation week 2 | 126 | 86 (85 / 1) | 0 | 0 | 40 | 1 / 53 |

    - Past-name matches were 0: the local roster has no renames (fixture names only), so that path is covered by `sheet-import.test.ts` only.
    - For the 33 OG TRACKING rows with no match, the longest prefix shared with any current name is mostly 1–2 characters. They are players who are not in the 2026-11-16 roster, not misses of the matcher.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11f-shots/`:
  - the card with facts and the editor at 360 and 1280, light and dark;
  - the time-zone picker, the conflict and the paste at 360;
  - `/w/nse` before an end-of-day read at 360;
  - the import (invented sheet) at 360 and 1280, light and dark, and its result.

## Open issues

1. **Migration renumbering (orchestrator).** After #341 (0020) and 11i (0021) merge into dev:
   - delete `drizzle/0020_lying_squadron_sinister.sql` and `drizzle/meta/0020_snapshot.json`, and remove the `idx: 20` entry from `drizzle/meta/_journal.json`;
   - `git merge origin/dev`;
   - run `pnpm db:generate`. It writes the next number (0022) with the right `prevId`; the SQL is the same two tables.
   - Change "migration `0020` when written" in D80's first bullet to the number it gets.
   - `lib/schema.ts` may conflict only on its last lines: keep both `export … from` lines.
2. **Retention (D71)** blocks importing the sheets' notes and statuses. Owner's decision.
3. **KvK reason:** the owner can turn `KVK_REASON_ON` on now; the reason would then skip members on a break. The plan's "no away note on the event's day" would need the away note's history: `member_facts` keeps every version, but a check by date is not written.
4. **An officer-set "On a break"** lasts until an officer clears it. Only an away note with a last day ends by itself.
5. **The editor's scroll.** A `scrollIntoView` on the conflict box made Chrome close the editor (an effect cleanup ran; the cause was not found). The save bar names the waiting fields instead.
6. **Shared machine.** During the e2e another session stopped every `next start` and `db-local-bridge` process twice. The e2e ran through launchers with their own names (`scratchpad/11f/serve-11f.mjs`, `bridge-11f.mjs`).
7. **The zone table** is generated from macOS tzdata 2026f (`/usr/share/zoneinfo/zone.tab`). A zone added to Intl later shows without a country until the table is regenerated.
8. **`isMember`** reads the newest roster (3–4 queries) on every save. It does not show in timings locally.

## Next

Session: #298 — Workspace: quick marking (KvK shield, raid, plunders, Elixir Battle) and away dates.
Model / effort: keep — no signal. The work fit one pass; the extra work came from the coordinator's two additions and the e2e fixes, not from misjudged scope.
Owner must do first:
1. Release dev, so the facts editor and the roster before the first end-of-day read reach `/w/ogs`.
2. Import the four sheets on `/w/ogs/import` and answer the open rows: about 10 unsure and up to 49 with no match locally. The real name history should match more than the local seed did.
3. Decide retention (D71), which gates importing the sheets' notes, and whether the KvK reason comes back now.
Plan changes needed: none. The workspace track lives in issues #293–#321, not in docs/IMPLEMENTATION_PLAN.md.

<adjustments>
- Away dates already exist: `member_facts` field `away` = `{ text, until }` (last server day away, or null), written through `saveFacts` with versions and history. #298's `vacations` table can be this field. Statuses are `status` = `break` / `help` (officer-set).
- "Away members are skipped" in roll call: use `awayUntil(facts.away?.value, today)` from `lib/private/fact-fields.ts` and `factsOf(db, access)`. `MemberRow.awayUntil` and `officerStatus` are already on every Members row.
- For a write that several officers make (marks), reuse the pattern: a version per field, `insertFact`'s unique version, and 409 with the newer value. `privately` keeps typed text out of `app_errors`.
- `anyRoster(db, unionId)` gives the newest roster of any kind, if roll call must work before the first end-of-day read.
- Time zones for the Elixir picks: `facts.timeZone` (IANA) and `offsetMinutes(zone, at)` in `lib/private/time-zones.ts` say who is awake at 18:00 or 23:00 server time.
</adjustments>

<adjustments for="Session 11k (chat screenshots)">
- Call `parseOnboarding(ocrLines, now, SERVER_TZ)` (`lib/private/onboarding-parse.ts`) on the OCR lines, then open the card's editor with the result. `propose(form, found, language)` in `app/(private)/_ui/facts-form.ts` fills the fields and returns the ones to mark "from a message". The sender line (`Lv.NN [OGs] Name`) is ignored by the parser.
- Measured: the 33 OG TRACKING rows with no match had no near spelling among current names. The OCR's `[0Gs]` tag and O/0 confusions in names still need `matchName` with the member's name history.
</adjustments>

PR: (added by the orchestrator)
