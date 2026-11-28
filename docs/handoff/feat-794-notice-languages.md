# feat/794-notice-languages: members' game languages beside Translate in the notice editor

Closes #794 (adopted in spike #789).

## Built

- `lib/private/notice-languages.ts`: `memberLanguages(db, access, now)` reads the members of the newest daily roster (`latestRoster`) and their game language through the existing `gameLanguages` (D132, newest read of the alliance's own workspace within 60 days). `countLanguages` groups the codes with `messageLanguage` into English, Português, Français and "Other", most first. Returns counts only, or null when no member has a language read.
- The new-notice page and the notice page read it after `requireWorkspace` (through `noticePage`) and pass `memberLanguages` to the editor.
- `NoticeActions.tsx`: one line under the Translate buttons, shown while Translate is on: "Members' game languages: English 18 · Português 9 · Français 4 (from 31 of 40 members)". Plain text, no new controls.
- Copy in EN, PT-BR, FR: `notices.langs.line`, `notices.langs.from`, `notices.langs.other` in `dictionary.notices-more.ts`.
- Dated amendment 2026-11-28 in D113. No new decision.
- Tests: `lib/private/notice-languages.test.ts` (4 tests: grouping and order; members with no language left out and "read of total"; own alliance only; null with no language).

## Decisions

- D113 and the notice code did not use `player_reads.language`; the field was used only for Follow-up message languages (D137, D140). This reuses `gameLanguages` and `messageLanguage`.
- `language` is not in `BLOCKED_ROSTER_KEYS` or the private checklist. Only counts leave `lib/private`: no names, no uids; nothing to logs, analytics, AI or translation requests.
- "Choose translation languages" is read as the editor's Translate action. The editor has no per-language ticks for Translate (it fills every other tab), so the line is a hint beside it. The ticks that exist are "Languages to post" in Publish to Discord; the line is not shown there.
- Roster size is the denominator ("of M"); members without a read count in M only (D75).
- A 60-day window for the language read (a game language rarely changes; Follow-up's 14 days would leave many members out).

## Deviations

- None from the issue. The suggestion is a line of text, not a clickable control, so there is no 44 px target to add.

## Verified

- `pnpm vitest related --run` on the changed files: 106 files, 604 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).
- Not checked in a browser at 360 px; the line is a wrapping paragraph with the "(from N of M members)" part kept together.

## Open issues

- Members whose game language is not en, pt or fr show as "Other" and cannot be translated to (the notices have three languages).

## Next

- If officers want the line on the Publish "Languages to post" ticks too, that is a separate small change.
- Take a 360 px screenshot of the notice editor with real counts.

What was missing from the task prompt? Which control "tick languages" meant; the editor has none for Translate.

PR: (added by the orchestrator)
