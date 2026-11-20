# fix-483 — Turned-off features are hidden, never announced

Issue 483. Owner, 2026-11-20: a feature the owner turned off for an alliance is simply not there. Nobody reads "turned off for your alliance".

## Built

- **Turned-off pages go to Home.**
  - `openRollCall`, `openCalendar` and `noticePage` redirect to `/w/[slug]` when the page's feature is off. This covers Roll call (all its pages), the Garrison plan, Follow-up, Caravans and every Notices page.
  - The thefts and Start here pages do the same.
  - The redirect happens after the access check and before anything of the feature is read.
  - `app/(private)/_ui/TurnedOff.tsx` is deleted, and the callers no longer read `page.off`.
- **Members' board turned off** (`w/[slug]/board/page.tsx`): an officer is redirected to Home and a member gets `notFound()`. `BoardOff` is deleted.
- **Writing help**:
  - With every writing help off, `NoticeActions` and Start here's `Actions` render nothing: no buttons and no line.
  - `askDraft` no longer maps `turned_off` to a line. A stale editor's 403 now shows the generic failure.
- **Read from a screenshot**:
  - With `ocr` off, the button is left out of three places: the facts editor's paste box (a new `shots` flag on `EditorProps`/`EditorContext`, set on the Members page), Paste updates (a `shots` prop) and the Garrison plan's enemy might (`shot: ShotWords | null`).
  - `ShotWords.off` and the 403 → "off" branch are removed. A stale page's 403 shows the generic failure.
- **Dictionary**: deleted `features.off.page`, `.kept`, `.home`, `.board`, `.writing`, `.read` and `features.name.board` in EN, PT-BR and FR. `features.off.command` (the Discord fallback) and `features.cap.*` stay.
- **/admin**: the Features help sentence now reads "its address goes to Home". Before, it said the address announces that the feature is off.
- **D126**: a dated amendment (2026-11-20, issue 483).
- **Tests**:
  - `app/(private)/w/[slug]/turned-off.test.ts` renders the real pages against PGlite with a stubbed cookie. An officer is sent to `/w/ogs` from thefts, roll call, caravans, notices, Start here and the board. A member gets 404 on the turned-off board.
  - `app/(private)/_ui/turned-off-helps.test.ts` covers two cases. The notice editor and Start here show no writing help and no "turned off" line. The paste box has no "Read from a screenshot" and no line.

## Decisions

- **Discord**: D129 (PR 497) already registers only the commands that are on, and re-registers when a switch changes. The only thing left is the stale-command fallback "This command is turned off for your alliance.", which stays as the issue says. No code change was needed there.
- **A stale press now reads as an ordinary failure.** Example: the officer had the editor open when the owner turned the help off, and the route answers `403 turned_off`. No new copy was added for this case.
- **Notice editor with all helps hidden.** If Translate and Improve writing are off but Shorten is on, the row is empty until the text goes over the limit. Then Shorten appears.
- The `lifecycleEditorWords` helper on the Members page became `lifecycleEditor` and now also returns `shots`. Reason: the file was at the 300-line lint cap, and this keeps the line count the same.

## Deviations

- No e2e run on a local production build and no screenshots. The change only removes UI and adds redirects. The redirects are exercised by the real page functions in `turned-off.test.ts`, and the removed lines and buttons by render tests. No new screen or layout exists to look at.

## Verified

- `pnpm check`: prettier, eslint, tsc, vitest (239 files passed, 2 skipped; 1285 tests passed, 4 skipped), drift check and i18n check all pass.
- The new page test fails on the old code: the officer case rendered the `TurnedOff` page instead of redirecting.
- Diff grepped for real names. Only "Ana", an invented name already used in tests, is in it.

## Open issues

- A member whose alliance's board is off gets a 404 after sign-in, because sign-in lands on the board. The issue asks for this. Follow-up if the owner wants it: a member sign-in could refuse earlier when the board is off.

## Next

- Model/effort: keep. This was removal and wiring work, with no new design.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- Issue 483 is done. `TurnedOff.tsx` no longer exists. A new desk page with its own switch should redirect to `/w/[slug]` when the switch is off (the shared openers already do this). It should not render a message.
- Only these feature-related words remain in `lib/private/dictionary.features.ts`: `features.off.command` (the stale Discord command) and `features.cap.ai` / `features.cap.translate`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/506
