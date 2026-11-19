# 11ao — One delete for every record officers save (issue 427, phase 1, D123)

## Built

- **Audit.** D123 lists every table in `lib/schema*`. For each one it gives who writes it, its kind (owned record, append-only history or system), what it allows today, where a delete must hide it, and its status. Phase 2 lists the owned types not built yet.
- **Shared repo helper:** `lib/repo/trash.ts`.
  - `softDelete`: replay-safe, also after an Undo.
  - `undoDelete`: the deleter only, within `UNDO_MS` (60 s); takes an optional per-table `guard`; a 23505 is a refusal.
  - `restoreDeleted` and `isDeleted` (notices).
  - `live(table)`: the read condition.
- **Shared client:** `app/(private)/_ui/DeleteRecord.tsx`.
  - `DeleteButton`: a text button in seal, then the `AskSheet` question ("Keep it" first, Delete in seal). It sends once under the question's request id and answers after the question has closed.
  - `UndoLine`: "… deleted." with Undo for 10 s.
- **Notices and roll calls are moved onto both pieces, with no change in behaviour.**
  - `lib/repo/notice-deletes.ts` is removed.
  - `lib/repo/roll-call-deletes.ts` keeps only the roll call's Undo rule (`placeFree`) and Archive.
  - `NoticeDelete.tsx` and `RollCallManage.tsx` use `DeleteButton` and `UndoLine`.
  - Their route tests pass unchanged.
- **Batch 1: Calendar entries, thefts, new members.** Migration `0046_record_delete`.
  - Calendar entries:
    - A whole-entry delete is now soft (it was a hard delete). `live` is on every read in `lib/repo/calendar.ts`.
    - The one-theme-per-week index covers live rows only.
    - `removeEntry` moved to `lib/private/calendar-delete.ts`.
    - A one-off asks with the shared question. A weekly entry keeps its skip/end choices.
    - The Calendar shows "Event deleted." with Undo (`EntryUndoLine`).
  - Thefts:
    - Soft delete (was a hard delete). `live` is on `listThefts` and `hasAttacker`.
    - "Delete this theft?" is asked with the shared question; the log then offers Undo.
  - New members:
    - Remove now records who and the request id on the existing `dismissed_at` (schema key `deletedAt`). A matched one cannot be removed.
    - The list says "Removed {name}." with Undo (`PendingRemove.tsx`).
  - Home (D108): three delete lines in `lib/repo/desk-activity-trash.ts`. Each carries the record's id, is never grouped and takes the cursor. The add, edit and garrison lines of deleted records leave the feed.
  - `ws_action`: `undo_delete` for `calendar`, `theft` and `new_member`, in `docs/analytics/tracking-plan.md`.
  - Words in EN, PT-BR and FR.
- Docs:
  - D123.
  - Dated amendments to D97, D106, D108, D118 and D120.
  - README index, DESIGN.md "Question", ARCHITECTURE.md.

## Decisions

- D123: D122 went to the layout system (#434), which merged first; this branch was rebased and renumbered.
- **Batch 1 picks.** The code showed that Calendar entries and thefts were hard-deleted on one confirm, and that new members had no who, request id or Undo. These three are batch 1.
- **Pending members.** `dismissed_at` keeps its column name. The schema calls it `deletedAt`, so the shared helper serves it without a rename migration.
- **Calendar scope.** Only a delete that takes the whole entry is soft and offers Undo. Skipping a week, or ending a series from a later week, is an edit and stays as before.
- **Hiding a deleted entry's lines.** A deleted entry's add, edit and garrison lines, a deleted theft's add line and a removed member's add line leave Home, as a deleted roll call's marks do (D120). Notices keep their earlier lines (D118); that is not changed.
- **The theft delete line** names no one (D75).
- **The three delete parts** live in the existing trash activity module, not a new one. This keeps `lib/repo/desk-activity.ts` and `lib/private/desk-activity.ts` under the 300-line lint limit.
- **`UNDO_MS`** is now defined once, in `lib/repo/trash.ts`. `lib/private/notices.ts` and `lib/private/roll-call.ts` re-export it, so the existing tests still import it from there.

## Deviations

- The pending UI used `AskSheet` without seal. It now has the shared question with Remove in seal. The words are unchanged (D106 quotes them).
- The theft strings changed from "Remove this entry?" / "Yes, remove" / "Keep" to "Delete this theft?" / "Delete" / "Keep it". No decision quoted the old strings; D97 has an amendment.
- To stay under lint limits:
  - `itemOf`'s names parameter is now a `Record` type (`lib/private/desk-activity.ts`).
  - The Calendar's entry/garrison lines are matched with one `"entry" in item` check (`desk-activity-words.ts`).
  - `useAction` in `PendingMembers.tsx` uses the shared `sendPending`.
  - None of these changes behaviour.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest **211 files passed, 2 skipped; 1,138 tests passed, 4 skipped** (after the rebase on #433–#436), the drift gate, i18n (17 languages up to date). In the last full run two unrelated tests timed out under load (`app/api/manual-event`, `app/api/snapshot`); run alone they pass (19 of 19).
- New `app/(private)/api/w/[slug]/record-delete.test.ts`, 13 tests:
  - per type (Calendar entry, theft, new member): a member gets 401 and another workspace's officer 404; Undo works for the deleter only and not after `UNDO_MS`; a replay after Undo deletes nothing;
  - per type, a delete leaves every read and has its Home line. The Calendar test also checks that an edit of a deleted entry is refused and that two deletes are two lines.
  - a deleted duel theme frees its week, and Undo is then refused.
- Existing tests updated for the new bodies:
  - calendar, roll call, thefts, import-new-member, the pending route;
  - member-session fixtures: `requestId`.
- Notice and roll call delete tests pass unchanged.
- **Local e2e: 62 of 62 checks pass.** It ran on a production build (:3986) with this worktree's own Postgres (:55457, 47 migrations), the DB bridge, a Discord sign-in stand-in and an invented 24-member roster. It checked:
  - each question: "Keep it" ("Keep on list") has the focus; Delete is 44 px; Keep it keeps the entry's sheet open;
  - after each delete: the record is gone, the Undo line shows and is on screen, Undo brings the record back;
  - on the other officer's Home: the three delete lines and no add lines for the deleted records;
  - notices and roll calls still delete to their list with Undo, and Undo reopens the record;
  - no sideways scroll in any of the 8 modes.
- **Screenshots:** 56 files (question, Undo line and Home for each type) at 360 and 1280, light and dark, EN and PT, in `11ao-shots/` in the scratchpad (not committed; since lost when the scratchpad was cleared).
- **Review fix from the screenshots:** the Calendar opens scrolled to today, so the first build's "Event deleted." line at the top of the page was off screen. The line now sits in the card of the day the entry was on, and `UndoLine` scrolls itself into view.
- **After the rebase on #437 (layout foundation, 2026-11-19):** no conflicts; this change does not touch Frame, DeskNav or the pages' `current` props. Migration stays `0046_record_delete` (dev's latest is `0045`).
  - `pnpm check`: 210 files passed; two unrelated tests timed out under load (`app/api/tick`, `app/img/preview/player/[uid]`) and pass alone (15 of 15); drift and i18n pass.
  - Short e2e on a new production build inside the AppShell: **30 of 30**. At 360 and 1280: delete and Undo for a Calendar entry, a theft and a new member; "Keep it" ("Keep on list") has the focus; each Undo line is on screen; no sideways scroll; the other officer's Home has every delete line. Screenshots in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ao-shots-437/`. The earlier 56 screenshots were lost when the scratchpad was cleared.
- **PR review fixes (2026-11-19):** the live-entry rule replaces "`entry_id` is null" in `otherTeams`, the team picker (`teamCalls`), `findAdded` and `lastEnemyMight`; the thefts log draws its Undo line in the attacker's card; a theft's Undo is refused when the same theft was added again (`noTwin`). Three new tests in `record-delete.test.ts` and `garrison.test.ts`: a deleted Elixir entry frees its team's members for the other team; a deleted siege's enemy might never carries over; Undo after the same theft was added again answers 404. Grep of every `entry_id`/`entryId` read: the rest go through the live reads of `lib/repo/calendar.ts`.

## Open issues

- Restore from the trash exists only for notices. An edit of a deleted Calendar entry says "Someone deleted this event." with no "Restore from trash?" (phase 2 in D123).
- Owner answers (2026-11-19), recorded in D123: a deleted theft sent again from a screenshot is added again; a deleted entry's garrison lines leave Home; phase 2 starts with follow-up records.
- A replay of a Calendar *add* whose entry was deleted afterwards answers 200 with the deleted entry's id. It is harmless: the request id belongs to one open add sheet.

## Next

- Model/effort: keep. Phase 2 is the same pattern on smaller types, starting with follow-up records (owner, 2026-11-19).
- What the owner must do first: review and merge. Migration `0046_record_delete` runs with the deploy (columns only, plus one index rebuilt as partial). No environment change.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Phase 2 (issue 427): `member_follow_ups` (withdraw later), `notice_reviews` (withdraw a request), `garrison_plans` (reset or delete apart from its entry), `name_aliases` (forget), `alliance_duel_points` (delete a wrong day), and "Restore from trash?" for Calendar entries, thefts and new members. Use `lib/repo/trash.ts` and `DeleteRecord.tsx`; add the `deleted_*` columns with `pnpm db:generate`.
- A new trashable table names its columns `deletedAt`, `deletedBy`, `deleteRequestId` in the schema (the database name may differ, as `pending_members.dismissed_at` does). Every other read keeps `live(table)`.
- New Home delete lines go into `lib/repo/desk-activity-trash.ts`. `lib/repo/desk-activity.ts` and `lib/private/desk-activity.ts` are at the 300-line limit.
- `app/(private)` code cannot import `lib/repo` (lint zone). Tests import `UNDO_MS` from `@/lib/private/roll-call`.
</adjustments>

PR: (added by the orchestrator)
