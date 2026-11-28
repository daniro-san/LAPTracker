# feat/427-delete-undo — issue 427 batch 2: delete follow-up records, withdraw review requests

## Built

- Phase 1 (audit) already existed: D123 (2026-11-19) audited every table and built the shared soft delete (`lib/repo/trash.ts`, `app/(private)/_ui/DeleteRecord.tsx`) with batch 1 (Calendar entries, thefts, new members); notices (D118) and roll calls (D120) run on it. This branch re-read every table in `lib/schema*` and added the tables made since 2026-11-19 to D123's audit (amendment 2026-11-27). None of them is an officer-owned record without a way out.
- Batch 2 on the same pattern, in the owner's order (follow-ups first, 2026-11-19):
  - **Follow-up records** (`member_follow_ups`): "Delete" on each note in the member card's History tab (`FollowUpNotes.tsx`), the shared question, then "Note deleted." with Undo. Route `/api/w/[slug]/follow-up` body `{uid, action: "delete", id, requestId, undo?}`. Only a record still counting is deletable; Undo is refused once a "withdrawn" of the member came after the delete (`noWithdrawSince`). `live` on every read in `lib/repo/member-follow-ups.ts` and on Home's follow-up lines.
  - **Review requests** (`notice_reviews`): "Withdraw" on each open request on a notice's page, any officer, then "Review request withdrawn." with Undo. Route `/api/w/[slug]/notices/reviews` body `{action: "withdraw", review, requestId, undo?}`. Only an open request (`stillOpen`). `live` on `reviewRows` and `openReviewCount`.
  - Home lines `followUpDeleted` and `reviewWithdrawn` (`lib/repo/desk-activity-trash.ts`); a withdrawn request's "asked" line leaves the feed.
  - `ws_action` `delete` / `undo_delete` for `follow_up` and `notice_review` (tracking plan updated).
  - Copy in EN, PT-BR, FR.
- Migration `drizzle/0080_follow_up_review_delete.sql` (from `pnpm db:generate`): `deleted_at`, `deleted_by` (FK, set null), `delete_request_id` on both tables. Columns only.

### Audit summary (full tables in D123 and its 2026-11-27 amendment)

| Type | Kind | Status |
| --- | --- | --- |
| notices, roll calls, Calendar entries, thefts, new members | owned | done (D118, D120, D123 batch 1) |
| notice pictures, screenshot drafts, thanks shares (Take down) | owned | done (D119, D96, D114) |
| follow-up records | owned | **done here** |
| review requests | owned | **done here** |
| garrison plans, name aliases, Alliance Duel points | owned | open (Next) |
| member facts, notice edits/publishes/outcomes, roll call marks, theft steps, screenshot checks, key changes, data events | append-only history | correction only |
| post settings, shield settings, webhooks, keys, theft attacker server, push subscriptions | settings | their edit or Remove |
| member self reports, feedback | member's own / collect-only | out of scope |
| everything the tick, reads, sign-in or the owner writes | system | out of scope |

## Decisions

Persona check (scratchpad `427-personas.md`): an officer on a phone (20s, 360 px), an officer on desktop (50s, 1280 px), an interaction designer, a data-honesty/privacy reviewer.

- Undo: the inline Undo line (shown 10 s, server 60 s) stays the one Undo, as D123. No "Recently deleted" list in this PR.
- Who may delete: any officer of the workspace, as for every D123 type; Undo is the deleter's own.
- A deleted follow-up record leaves the break or Needs help fact it wrote on the card. Member facts are correction only (D80, D123), and the question says so, so a status never changes without the officer seeing it (D75).
- Withdrawing uses the verb "Withdraw" (a request is withdrawn, not deleted); the question and Undo are the shared ones.
- Home's delete line names whose record, never the choice or the note.
- Copy: "Delete this follow-up note?" + "It leaves this history, the Follow-up tab and its counts, and Home. A break or Needs help it set stays on the card: change it in Edit info."; "Withdraw this review request?" + "It leaves this notice, To review on Home and the tab’s number. The notice stays as it is."

## Deviations

- The task listed roll calls, notices, calendar entries, thefts, pending members, thanks and pictures as candidates; the audit found them already done, so this branch built the two owned types left at the top of D123's phase 2. Member facts/notes are append-only history (correction only), not deletable.
- The issue's "Restore from trash?" for a save over a deleted record does not apply to these two types (neither is edited after it is saved); it stays open for Calendar entries, thefts and new members.

## Verified

- `pnpm vitest run` of the new `app/(private)/api/w/[slug]/follow-up/delete.test.ts` (4 tests) and `notices/reviews/route.test.ts` (11 tests, 3 new): a deleted row leaves its list, count, Home and the download's main file (it is in `-deleted.csv`); Undo is the deleter's own within UNDO_MS; member 401, other workspace 404.
- `data-export/route.test.ts` lists the two new `-deleted.csv` files.
- `pnpm vitest related --run` over the changed files: 2054 passed, 2 timed out at 10 s under the full parallel load (`lib/squads-read.test.ts`, `cross-workspace.test.ts`); both pass when run alone (15/15), and the cross-workspace isolation suite is green.
- `pnpm check` (prettier, eslint, tsc, vitest 2056 passed, drift, i18n): passes. The first run failed on two complexity lint errors (the follow-up route, `activityLine`), fixed in one round.
- Not run: a browser pass at 360/1280 (no dev server here).

## Open issues

- Undo shows 10 s on the page; a slower reader may miss it. A "Recently deleted" list would cover it.
- A deleted Needs help record's mark falls back to its fact version, without that record's note.

## Next

- `garrison_plans`: reset or delete a saved plan apart from its entry.
- `name_aliases`: forget a remembered sheet name.
- `alliance_duel_points`: delete a wrong day's save.
- "Restore from trash?" for Calendar entries, thefts and new members when an officer saves over a deleted one.
- A "Recently deleted" list for any type.

What was missing from the task prompt? That phase 1 and batch 1 (D123, PR 439) were already merged, so the work was phase 2.

PR: (added by the orchestrator)
