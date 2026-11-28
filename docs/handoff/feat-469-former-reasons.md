# feat/469-former-reasons — why a former member left, and counts by month

Issue 469 (owner-approved 2026-11-19).

## Built

- `lib/private/fact-fields.ts`: `LEFT_REASONS` (`left`, `otherAlliance`, `removed`, `inactive`, `unknown`), `LeftReason {reason, note}`, `LEFT_FIELD = "leftReason"`, note limit 500. `MemberFacts` gains an optional `leftReason` fact. It is not in `FACT_FIELDS`, so the facts editor, the member card and the paste box do not show or write it.
- `lib/private/left-reason.ts`:
  - `saveLeftReason` writes the next version of the `leftReason` fact (source `officer`). It works only for a former member: an earlier roster listed them and the newest roster does not. A save on a stale version is refused with the newer reason. If the stale save holds the same value as the newest version, it answers `saved` and writes nothing.
  - `leftByMonth` counts former members by the month of their last-seen day and by reason. A member with no saved reason counts as `unknown`.
- `POST /api/w/[slug]/members/[uid]/left-reason {version, reason, note}`: officers only (`requireWorkspace`). Answers 200 when saved, 409 with the newer reason, 404 `not_former`, 401 `signed_out`. Sends `ws_action` `left_reason` / `save`.
- Former members view (`FormerMembers.tsx`, new `FormerLeftReason.tsx`):
  - The sheet has a "Why they left" section: the saved line or "Not recorded yet", and a "Record why they left" / "Change" button. The button opens five radio cards (`RadioField`, at least 44 px; one column at 360 px, two from `sm`), an optional note, Save and Cancel. A 409 loads the other officer's reason into the picker and says so. A 401 shows the shared signed-out note.
  - The row shows the reason and the note on one line.
  - "Who left, by month" sits above the search. For each month, newest first: the month name, "n former members", and "Left 1 · Unknown 2" (only reasons with a count). It holds no names.
- Words in EN, PT-BR and FR (`dictionary.lifecycle.ts`), in neutral wording.
- Export: `former-members.csv` gains `left_reason` (the label in the officer's language) and `left_note`. Both are empty when no reason was saved. Every version is already in `member-facts.csv` as field `leftReason`.
- Docs: amendments to D107 and D125. The tracking plan gets a `left_reason` row and a Changed line. `lib/analytics/server.ts` `DESK_FEATURES` gains `left_reason`.
- Tests:
  - `lib/private/left-reason.test.ts`: saving a reason and note, and only for a former member; a correction is a new version and a stale save is refused; counts by month and reason.
  - The new route test: an officer save gets 200; a member's session gets 401; another workspace's officer gets 404.
  - `data-export/route.test.ts`: one new test for the export columns.
  - `member-session.test.ts`: a D105 fixture for the new route.

## Decisions

- No migration: `member_facts.field` is text, so `leftReason` is one more field name. `pnpm check` reports "No schema changes".
- The reason is a separate fact field with its own route. It does not go through the facts editor: a reason only makes sense for a former member, and adding it to `FACT_FIELDS` would put it on every member's card and editor.
- A stale save is refused with a 409 and is never combined, like the facts that are not merged (D80).
- Months come from the server day the member was last seen (the day of the last roster that listed them). They do not come from the day the reason was saved.
- The export writes the reason's label in the officer's language, matching the README and the other derived files. `member-facts.csv` keeps the raw codes.

## Deviations

- I did not run `/tlc-spec-lean`. CONTRIBUTING sizes this change as M (new route). The task prompt gave the approved spec and said to build directly.
- No new decision number. The rules are amendments to D107 and D125, as the task says ("rules D107").

## Verified

- `pnpm vitest related --run <changed files>`: the first run found 3 failures (the D105 fixture list and the tracking-plan check). After fixing them, the 5 affected test files passed (58 tests).
- `pnpm check`, exit 0: prettier, eslint, tsc, vitest (389 files passed, 2 skipped; 2115 tests passed), drift check ("No schema changes"), i18n check.
- Review fix (PR 802): the identical-save check compares `reason` and `note` one by one, after checking the stored value is not null. jsonb returns `{note, reason}`, so the `JSON.stringify` comparison returned a 409 for an identical save. I added a test for an identical stale save. With the old comparison put back, that test failed (`conflict` instead of `saved`); with the fix it passes. New route tests: a stale version gets 409 with the newer `{version, value}`, a bad body gets 400, and a request from another origin gets 403. `pnpm check` exit 0 (2117 tests passed).
- I did not run a browser check at 360, 640 or 1280 px, in dark mode or with a screen reader: no local app with data was started in this session. The layout reuses `RadioField`, `Button`, the `drawn-card` style and the existing row classes.

## Open issues

- Needs a designer-persona UX review at 360, 640 and 1280 px and in dark mode before merge (owner's rule for visualization PRs).
- If someone rejoins, their `leftReason` fact stays and the Members tab does not show it. If they leave again, the old reason shows until an officer changes it.
- Home's recent activity shows a reason save as a generic facts save ("updated <member>'s info"). It is not worded as a reason.

## Next

- Follow-up: a UX review of the counts block, which has no bound on how many months it shows (a long history makes a long list). One option is to show the newest 6 months and add "Show all".
- Follow-up: decide whether Home's activity should word a reason save on its own.

What was missing from the task prompt? Which date the monthly counts should use (I used the last-seen day), and whether the export should write reason codes or labels (I used labels).

PR: (added by the orchestrator)
