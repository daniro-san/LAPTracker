# 11am — Roll call: delete (with Undo) and archive (issue 424, D120)

## Built

- Migration `0042_roll_call_delete` (the orchestrator renumbers if needed). It adds `deleted_at`, `deleted_by`, `delete_request_id`, `archived_at` and `archived_by` to `roll_calls`. The unique indexes on (entry, week) and on hand-added (workspace, kind, day) now cover live rows only.
- `lib/repo/roll-call.ts`: a `live` condition (`deleted_at is null`) on every read of `roll_calls` (`findCall`, `findAdded`, `callsOfWeeks`, `otherTeams`), and a new `archivedCalls`.
- `lib/repo/roll-call-deletes.ts`: the delete (replay-safe under its request id, also after an Undo), the Undo (only the officer who deleted, within 60 s, and not when a new live roll call took the deleted one's place), and archive/unarchive.
- `lib/private/roll-call.ts`: `deleteCall`, `archiveCall`, `UNDO_MS`.
- `POST /api/w/[slug]/roll-call` takes two more actions: `{action: "delete", id, requestId, undo?}` and `{action: "archive", id, on}`. Officers only (401 `signed_out`); another workspace's roll call is 404 `not_found`. `ws_action` reports `roll_call` with `delete`, `undo_delete`, `archive` or `unarchive`.
- `lib/private/roll-call-view.ts`: the week list leaves out archived roll calls, a Calendar one too. `archivedItems` returns the archived ones, the newest day first, with their counts.
- Home (D108): `lib/repo/desk-activity-calls.ts` adds "Ana deleted the roll call “…”" and "Ana archived the roll call “…”". A deleted roll call's marks are in no line (`marksWritten`).
- UI:
  - `RollCallManage.tsx` sits at the foot of a roll call's page. It has the archive hint, Archive/Unarchive and "Delete roll call". The delete question uses `AskSheet` with "Keep it" first and Delete in seal. A Calendar roll call's question adds that the entry stays.
  - The list shows "Roll call deleted." with Undo for 10 s (`RollCallDeletedLine`).
  - The roll call's page shows an "Archived" tag.
  - The Roll call tab has an Active / Archived filter (`?archived=1`).
  - Words are in EN, PT-BR and FR.
- Docs: D120. Dated amendments to D103 and D108, the README index, and the tracking plan's `roll_call` row.

## Decisions

- D120 is new (D119 is taken by PR #422).
- A deleted Calendar roll call keeps its Calendar entry. That week's occasion starts again as a new, empty roll call, which is why the (entry, week) unique index covers live rows only. A deleted hand-added roll call frees its kind and day for a real one.
- Archive is offered on any saved roll call (one with a row). "Finished" is the officers' call, not a date rule.
- An archived roll call can still be opened from Archived or from the Calendar's link, and still be marked. Its marks still count in Home's lines.
- Archived cards show the kind's title and the stored day, without the Calendar entry's title or time. Showing those would cost one Calendar read per week; the roll call's page shows both.
- The delete's Undo is counted as `undo_delete`, because `undo` already means the undo of "the rest".
- The filter's dictionary key is `roll.filter.week`, not `roll.filter.active`: the roster-fields guard (D71) rejects the bare word `active` in page code.

## Deviations

- The brief asked to filter member history. Nothing reads roll call marks per member or across roll calls today (grep of every query on `roll_calls`, `roll_call_marks` and `roll_call_team`). The only readers are the roll call pages, the Elixir team check and Home's lines, and all of them filter deleted roll calls now.
- There is no trash or restore for roll calls, unlike notices (D118). The issue did not ask for one.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest **200 files passed, 2 skipped; 1,066 tests passed, 4 skipped**, the drift gate, and i18n ("17 languages up to date").
- `app/(private)/api/w/[slug]/roll-call/route.test.ts` has 5 new tests:
  - a delete removes the roll call from the week, its page, marking and Home, and the Calendar week starts again at version 1;
  - a member gets 401, and another workspace's officer gets 404;
  - Undo works for the deleter only, and not after `UNDO_MS`;
  - a replay after Undo deletes nothing;
  - archive takes the roll call off the week into Archived, a repeat answers 200, Home shows the archive line, and Unarchive brings it back.
- **Local e2e: 44 of 44 checks pass.** It ran on a production build on :3997 with this worktree's own Postgres on :55337 (43 migrations), the DB bridge, a Discord sign-in stand-in and an invented 20-member roster. No upstream, Groq or Discord call was made. It checked:
  - 44 px targets;
  - the question: "Keep it" has the focus, Delete is drawn in seal, and Keep it keeps the roll call;
  - after the delete: the list line with Undo, the roll call off the list, its page a 404, marking it refused, and Back does not land on a 404;
  - on the other officer's Home: the delete line is there and the deleted roll call's marks are in no line;
  - Undo reopens the roll call, the Home line is gone, and Back shows no stale Undo;
  - Archive shows the tag and takes the roll call off the week; the filter shows it under Archived; Home shows the archive line; Unarchive brings it back; Archived is then empty;
  - no sideways scroll in any of the 8 modes.
- **Screenshots:** 32 files (page foot, question, deleted line, Archived list) at 360 and 1280, light and dark, EN and PT, in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11am-shots/` (not committed). Reviewed: the PT question wraps cleanly at 360, and Delete reads in seal in both themes.

## Open issues

- The Archived list has no cap. Archived roll calls grow by a few a week; a cap or paging can come later if the list gets long.
- A replay of an *add* whose roll call was deleted afterwards would hit the request-id index and answer 500. In practice this cannot happen, because a request id belongs to one open add sheet.
- Rebased on `origin/dev` with #426 (activity paging). The delete and archive parts take the `< before` cursor. Each line carries the roll call's id, so the feed's repeat rule never folds two different roll calls into one line; neither kind is in `GROUPED`.
- The migration stays `0042_roll_call_delete` for now. After #422 (0042, 0043) merges, it must be regenerated as 0044.

## Next

- Model/effort: keep. This was one feature with a migration, two route actions, a question, a filter and an e2e.
- What the owner must do first: review and merge. The migration runs with the deploy. No setting is needed.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- Every new read of `roll_calls` must use `live` from `lib/repo/roll-call.ts`. Only Home's delete line reads deleted roll calls on purpose.
- The week list hides archived roll calls in `weekItems`. A new list of roll calls must decide whether it shows archived ones.
- Page code must not contain the bare word `active` (the roster-fields guard, D71), even as a filter key.
</adjustments>

PR: (added by the orchestrator)
