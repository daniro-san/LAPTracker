# 11au — Download our data, and delete the workspace (issue 441)

## Built

- **Schema** (migration `0049_workspace_retention`, generated): `workspaces.deletion_requested_at`, `deletion_requested_by` (no foreign key; null is the owner) and `purge_after`; `workspace_data_events` (download, deletion asked, deletion cancelled: who, when, one row per request id); `workspace_tombstones` (address, union id, alliance, who asked, by the owner or not, when asked, when deleted). New file `lib/schema-retention.ts`, listed in `drizzle.config.ts`; `truncateAll` truncates the tombstones.
- **One list of what a workspace owns**: `WORKSPACE_TABLES` in `lib/repo/workspace-data.ts` (33 tables). The download reads it and the daily job deletes from it. A test fails if a table with a `workspace_id` column is missing from it.
- **"Download our data"** in Alliance settings: `POST /api/w/[slug]/data-export {requestId}` answers the ZIP itself.
  - One CSV per table (29 files), `-deleted.csv` for the 5 tables that keep deleted records, `former-members.csv`, `activity.csv` (Home's feed of two weeks, as Home says it), `pictures/notice-<id>.<ext>`, and `README.txt` in the officer's language.
  - UTF-8 with a BOM and CRLF. Officer columns are shown as names, and a `member` column is added beside each `uid`. A text cell that starts with `= + - @` gets a leading `'`.
  - Left out: the roster's blocked keys and `avatar_url` (dropped by column name everywhere), `workspace_keys`, `workspace_sessions`, `discord_pictures`, `squad_reads`, and from people the Discord id and `allowlist_added_by`.
  - Under 4,400,000 bytes. CSVs are deflated. Pictures are added newest first while they fit, and the README says how many were left out. If the CSVs alone are too big, the answer is 413 `too_large`.
  - 3 a day per workspace (`day:export:ws:<id>` in `auth_attempts`), 429 on the fourth. A repeated request id is not counted again.
  - Each download adds a Home line and `ws_action` `workspace_data` / `download`.
- **ZIP writer** `lib/zip.ts`: no dependency. Deflate and CRC-32 come from `node:zlib`, file names are UTF-8, and there is no ZIP64.
- **"Delete this workspace"** in Alliance settings: an `AskSheet` with what is deleted, the date, "Public data stays…", "Download your data first", and a field where the officer types the address. "Delete in 14 days" is off until the address matches, and the server checks the address again.
  - The route is `POST /api/w/[slug]/workspace-deletion {action: ask|cancel}`.
  - A Home line for an officer's ask and an officer's cancel; `ws_action` `delete` / `cancel`.
- **Banner** (`DeletionBanner`): on every page under `SignedInFrame` and on the board.
  - It gives the date, then "Cancel the deletion" for officers (the board preview included).
  - A member reads "This board closes after <date>…" with no button.
  - `WorkspaceAccess` and `BoardAccess` carry `purgeAfter`.
- **/admin**: per workspace, the line "Deletion asked by <who> on <day> · deleted after <day>" and a button, "Delete in 14 days" or "Cancel the deletion", asked first (`POST /api/admin/workspaces/deletion`, PIN). Under the list, "Deleted workspaces" shows the tombstones.
- **Daily job**: in `lib/tick.ts`, after the day's first daily roster read claims its day, `purgeDueWorkspaces` runs. Per workspace, one transaction:
  - it counts the rows, then deletes the rows keyed by alliance (`member_squads`, `squad_reads`) and the workspace's rate-limit counters;
  - it deletes the `workspaces` row, and the cascades take every other owned row;
  - it writes the tombstone.
  - The log line `workspaces.purged` holds counts only. A failure is logged by its code and does not fail the read.
- **Words**: `lib/private/dictionary.data.ts`, EN/PT-BR/FR; /admin copy in English.
- **Docs**: D125 and its index line; dated amendments to D71 (retention) and D108 (the three Home lines); ARCHITECTURE entries; a tracking-plan row.
- **Tests**:
  - `data-export/route.test.ts`, 3 tests: every file and no private byte; member and other workspace refused; the daily limit.
  - `workspace-deletion/route.test.ts`, 1 test: the typed address, the date on desk and board, another officer cancels, Home's lines.
  - `lib/repo/workspace-purge.test.ts`, 2 tests: the list is complete; the job deletes nothing before 14 days and every owned row after, the other workspace and the public roster stay, and the tombstone is written.
  - `admin/workspaces/deletion/route.test.ts`, 1 test.
  - The seed helpers are `lib/workspace-data.test-helpers.ts` and `lib/workspace-seed-parts.test-helpers.ts`; the member-session fixture covers the 2 new routes.

## Decisions

- **D125** (new; D124 was the latest on dev). If a parallel branch took D125, renumber at merge.
- Size: one ZIP, pictures left out when needed (newest kept), no split and no background build. Notice pictures are at most 400 KB and the CSVs compress well, so a workspace today is far below the limit.
- The owner's request and cancel on /admin give no Home line: the feed needs an officer. The banner still shows the date.
- The purge runs after the day's first daily roster read, not on every tick. A day with no daily read (the tick stopped) deletes nothing that day; the next day does.
- The banner date is `purge_after`'s day in UTC, worded "after <date>", because the job runs at the next daily read after that instant.
- "Workspace" in PT is "espaço de trabalho" and in FR "espace de travail", because the issue names the action "Delete this workspace". Game event names stay in English (D52).
- CSV uses commas in every language. The README tells Excel users with a comma-less locale to use Data > From Text/CSV.

## Deviations

- **New-alliance guide**: there is none on dev (issue 438 lists an owner guide and a guest guide as its own step 7). D125 holds what the guide needs; nothing was written in its place.
- `ACTIVITY_WINDOW_MS` in `lib/private/desk-activity.ts` was inlined (it had no other user), so the file stays under the 300-line lint limit after the new union line.
- Lint fences `app/(private)` off `lib/repo`, so the "purge after the grace period" test lives in `lib/repo/workspace-purge.test.ts`, not in the route test. For the same reason the seed helpers sit at `lib/` root.
- The README's row count reads "rows: n" rather than "n rows", to avoid "1 rows".

## Verified

- `pnpm check` passes: prettier, eslint, tsc, 1,183 tests (220 files), migration drift, i18n.
- All 50 migrations applied with `db:local:migrate` on a real local Postgres 18, `0049_workspace_retention` included.
- Local e2e on a production build (:3995) with the local Postgres, the DB bridge, a Discord sign-in stand-in (an officer and a member-only user) and an invented roster whose raw_json carries x, y, online, last_online_at and avatar_url as markers. 106 of 106 checks pass at 360 and 1280, light and dark, EN and PT:
  - the download is named `nse-data-<day>.zip`; Python's zipfile opens it and every CRC matches;
  - no file holds a marker, a token hash or a Discord id; every CSV and the README start with a BOM;
  - the README is in the officer's language; notice texts are there in EN, PT and FR; names appear in place of ids; the picture is a file; deleted thefts are in their own file;
  - in the sheet, "Keep the workspace" has the focus, Delete stays off for no address or another address, and the sheet says public data stays;
  - after asking, `purge_after` is 14 days ahead; Home has the banner and the download and ask lines, with no sideways scroll;
  - the officer's board preview has the banner and Cancel; the member's board has the date and no Cancel;
  - Cancel clears the date and Home says who cancelled; the fourth download in a day is refused;
  - /admin asks (by the owner, 14 days) and cancels; the job leaves a workspace inside its 14 days and deletes it after; no row of it is left, the public roster stays, and /admin lists the tombstone.
- 28 screenshots are in the scratchpad's `11au-shots/`. Reviewed:
  - the settings sections, the PT sheet at 360, Home with the banner in PT dark at 1280, the member's board at 360, and /admin asked and with the tombstone;
  - PT button labels wrap to two lines inside the sheet at 360 ("Manter o espaço de trabalho") and stay 44 px or more.

## Open issues

- No new-alliance guide exists yet (see Deviations); issue 438's guide step should copy D125's "Where", the 14 days and "public data stays".
- Who can delete one person's record (D71's open question) is still open.
- Excel in locales whose list separator is ";" (pt-BR, fr) opens a comma CSV in one column on double-click. The README tells how to import it. Writing ";" for those languages was not done.
- Commands already registered in a deleted workspace's Discord server stay until the next "Register" (which skips it) or until Discord drops them. "Send to LAPTracker" there answers that the server has no Officers' Desk.
- Not measured: a download near the 4.4 MB limit. The e2e workspace's ZIP was a few KB.

## Next

- Model/effort: keep. Issue 438's next steps are settings forms of the same shape.
- What the owner must do first: nothing. There is no new variable or secret, and the migration runs with the deploy.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`; it runs from issues.

<adjustments>
- A table added to a workspace later must be added to `WORKSPACE_TABLES` (`lib/repo/workspace-data.ts`) with its CSV name and a `data.file.<name>` line in `lib/private/dictionary.data.ts`, and to the seed in `lib/workspace-data.test-helpers.ts`. `workspace-purge.test.ts` fails until it is listed.
- Issue 438 point 6 (Discord channels per workspace): if webhooks are stored in a new table, mark it `file: null` in `WORKSPACE_TABLES` so it is deleted but never downloaded.
- `WorkspaceAccess.purgeAfter` exists; a page outside `SignedInFrame` that should show the banner uses `DeletionNotice` from `app/(private)/_ui/Frame.tsx`.
</adjustments>

PR: (added by the orchestrator)
