# /admin/changes: every owner step in one list

## Built
- `lib/patch-notes.ts`: `PatchNote` has no `needsYou` field. The 13 release entries that had one lose it. Every step in them was already in `ownerTodo` or was done, except three that only lived in release notes:
  - check the Raid Shield summary forum post;
  - compare the shield shares with Raid prep;
  - check "After KvK, offer help" and the recovery days after a real KvK.
  These are now open `ownerTodo` items.
- #663 is marked done: the owner decided yes on 2026-11-22.
- `app/(pages)/admin/changes/page.tsx`: the "Needs you" chip on each release and the "Needs you" box inside it are gone. The to-do list at the top is the only place for owner steps.
- `lib/copy-admin-changes.ts`: the to-do help says it holds every step from every release. The `releases.needsYou` string is gone.
- CONTRIBUTING.md (release step 1): an owner step goes only in `ownerTodo`, never in the release entry.

## Decisions
- Removed the field instead of hiding it. With the field gone, `tsc` refuses a release entry that tries to name an owner step, so no test is needed.

## Deviations
- None.

## Verified
- `pnpm vitest related --run` on the changed files: 910 passed.
- `pnpm check`: exit 0 (1752 passed, 4 skipped).
- No e2e covers /admin/changes.

## Open issues
- The to-do list is one ordered list. Grouping it (decisions, checks after an event, account settings) could help if it grows. Not asked.

What was missing from the task prompt? Nothing; the owner asked for one place for the "Needs you" items on 2026-11-22.

## Next
- None.

PR: (added by the orchestrator)
