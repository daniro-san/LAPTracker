## D125 — An alliance downloads its own data and deletes its own workspace: a ZIP of CSV files, 14 days of grace that any officer can cancel, then a daily job deletes every row and leaves a tombstone (2026-11-19, owner, 11au, issue 441; settles the workspace part of D71's open retention; amends D108)

Why: the desk opens to other alliances (issue 438). The owner (2026-11-19): an alliance can take its data with it, or delete its workspace, without asking the owner. D71 left retention open; this decides it for a workspace as a whole. Who can delete one person's record stays open.

**Retention.**

- A workspace's own data (every table in `lib/repo/workspace-data.ts`'s `WORKSPACE_TABLES`) is kept while the workspace exists. Nothing in it expires because of this decision; earlier rules stay (drafts 7 days, D96; the weekly picture cleanup, D119).
- When its deletion is asked, it is kept 14 more days, then deleted for good: no backup is kept by the app. Neon's own point-in-time restore window (the plan's, not the app's) is the only copy after that.
- Public data is not the workspace's and stays: the Event Ledger, the daily rosters (D60, D72), the alliance's public pages and its member history. The confirmation says so.

**Where.** Alliance settings (`/w/[slug]/settings`, D124), two sections under the tracker key: "Your alliance's data" and "Delete this workspace". Officers only: `requireWorkspace`; a member's session, another workspace's or none answers 401 `signed_out`.

**"Download our data"** (`POST /api/w/[slug]/data-export {requestId}`, `lib/private/workspace-export.ts`).

- A ZIP of CSV files, built on the server in memory: UTF-8 with a BOM (so Excel reads accents), comma-separated, CRLF lines. A text cell that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.
- One file per table the workspace owns, every row and every column in the database's names, from one list (`WORKSPACE_TABLES`):
  - people (who signed in), member facts (every version), new members, spreadsheet names, Calendar entries and their weeks, garrison plans;
  - notices, notice texts (every language), posts, review requests and outcomes, picture facts;
  - roll calls, marks and teams, follow-ups, thefts, theft steps and attackers;
  - thanks and thanks taken down, Start here, screenshot drafts, Alliance Duel points, screenshot checks, squads, tracker key changes, data requests.
- Plus `former-members.csv` (uid, name, last seen, might, kills, D107) and `activity.csv` (Home's recent activity of the last two weeks, each line as Home says it).
- A column that names a workspace user (created_by, written_by, deleted_by…) holds the person's name; a table with a `uid` gets a `member` column with the member's name.
- **Deleted records** (D118, D120, D123) go in their own file, `<file>-deleted.csv`, with `deleted_at` and `deleted_by`.
- **Pictures.** `pictures/notice-<id>.<ext>`, stored as they are (no second compression); CSV files are deflated. ZIP written by `lib/zip.ts`: no dependency, CRC-32 and deflate from `node:zlib`.
- **README.txt** in the officer's language (the desk's language switch, else the browser's): how to open the files, that times are UTC, what was left out, then each file with its row count, what it holds and its columns.
- **Never in it**: `x`, `y`, `online`, `last_online_at`, `joined_at`, `daily_*`, `active` and `avatar_url` (CLAUDE.md, D71; dropped by column name from every table, whatever the list says), the tracker key (`workspace_keys` is not downloaded: no ciphertext, nonce, fingerprint or last 4), sessions (`workspace_sessions`, token hashes), Discord user ids and who added someone to the allowlist, and the Discord message ids of pictures already read (`discord_pictures`).
- **Size.** Vercel answers at most 4.5 MB. The ZIP is kept under 4,400,000 bytes: the CSV files always go in; the notices' pictures go in newest first while they fit, and the README says how many were left out and that they stay on their notices. If the CSV files alone pass the limit, the answer is 413 `too_large` and the screen says to ask the owner. Chosen over a split or a background build: today's largest workspace is far below the limit (a notice picture is at most 400 KB, CSVs compress about tenfold), and a single file is what officers asked for.
- **Limit.** 3 downloads a day per workspace (`day:export:ws:<id>` in `auth_attempts`, a 24-hour window from the first): the fourth answers 429 `rate_limited`. The request id is claimed first (D100): a repeat of one that went through is not counted again; a refused one frees its id and leaves no line.
- Each download: Home's line "<Name> downloaded the alliance's data" and `ws_action` `workspace_data` / `download`.

**"Delete this workspace"** (`POST /api/w/[slug]/workspace-deletion`, `lib/private/workspace-deletion.ts`).

- An `AskSheet`: what is deleted, after which date, that public data stays and to download first; then the officer types the workspace's address. "Delete in 14 days" stays off until the address matches, and the server checks it again (400 `address_mismatch`). "Keep the workspace" is first and has the focus.
- On confirm: `workspaces.deletion_requested_at`, `deletion_requested_by` (the workspace user; null for the owner) and `purge_after` = 14 days later. A deletion already asked stays as it was.
- **The 14 days.** Everyone keeps access: officers, members and the board, so they can download first. Every desk page (the signed-in frame) and the members' board show a banner: "This workspace will be deleted after <date>." with "Cancel the deletion" for any officer (on the board, the officer's preview has it; a member reads "This board closes after <date>"). The date is `purge_after`'s day in UTC.
- **Cancel.** Any officer, from the banner (`{action: "cancel", requestId}`): the three columns are cleared. Cancelling when nothing is asked changes nothing and records no line.
- Home's lines: "<Name> asked to delete this workspace", "<Name> cancelled the deletion of this workspace" (`workspace_data_events`, one row per request id). `ws_action` `workspace_data` / `delete` and `cancel`.

**/admin.** Each workspace shows "Deletion asked by <who> on <day> · deleted after <day>" in seal, and a button "Delete in 14 days" or "Cancel the deletion" (asked first, PIN like every /admin action, `POST /api/admin/workspaces/deletion`). The owner's request has the same 14 days and the same banner; it gives no Home line (no officer did it). Under the list, "Deleted workspaces": the tombstones.

**The daily job** (`lib/repo/workspace-purge.ts`, from the tick).

- No new cron: after the day's first daily roster read claims its day (D60, the tick), `purgeDueWorkspaces` deletes every workspace whose `purge_after` has passed. A failure is logged by its code and never fails the day's read.
- One transaction per workspace: the rows by alliance (`member_squads`, `squad_reads`: the squads read on the workspace's key), its rate-limit counters in `auth_attempts`, then the `workspaces` row, whose `on delete cascade` foreign keys take every other owned row: people and the allowlist, sessions, the tracker key and its changes, facts, notices and their pictures, the Calendar, roll calls, follow-ups, thefts, garrison plans, the thanks, imports, the data requests.
- The log line `workspaces.purged` holds counts only: workspaces deleted and rows deleted. No slug, name or member.
- **The tombstone** (`workspace_tombstones`): the address, the union id, the alliance as "TAG · Name", who asked (the officer's name, or the owner), when it was asked and when it was deleted. No member data and no link to any other row. Kept with no end date.
- **Discord.** The command registration (D96, D101) lists the guilds of the workspaces that exist, so the next "Register" on /admin skips the deleted workspace's server. Commands already registered there stay until Discord drops them; "Send to LAPTracker" then answers that the server has no Officers' Desk (it finds no workspace for the guild).
- A table added later must go in `WORKSPACE_TABLES`: `lib/repo/workspace-purge.test.ts` fails when a table with a `workspace_id` column is missing from it, so it is neither left out of the download nor left behind by the job.

**Tests** (one per behaviour): the ZIP holds a file per table plus the deleted files, the pictures and the README, and no byte of it holds the private roster fields, the sealed key, a session hash or a Discord id; a member and another workspace are refused; the fourth download in a day is refused and a repeated request id is not counted; asking with the wrong address is refused, the right one sets the date that both the desk and the board carry, another officer cancels and Home says both; the job deletes nothing before the 14 days and everything after, the sessions then open nothing; every owned table has no row of the deleted workspace and all of the other's, the public roster stays and the tombstone is written; every table with a `workspace_id` is in the list; /admin asks and cancels with the PIN.
