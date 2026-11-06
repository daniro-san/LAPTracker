# 08zy — Event terminology (#130)

Spec: issue #130 and the session brief. "Saturday event" is not the domain term: an **event** is a **scheduled event** (the tick's weekly event on `EVENT_WEEKDAY`, Saturday by default) or a **manual event** (D28). The label part (show the title, not the weekday) shipped in #138. Branch `session/08zy-event-terminology`, cut from `origin/dev` at 505979a.

## Built
- `docs/GLOSSARY.md` — `event` = "one game event: a scheduled event or a manual event (D28)"; new row `scheduled event` (weekly, on `EVENT_WEEKDAY`, Saturday by default, made by the tick a day ahead, default title `<Weekday> Event <date>`). The rows keep the table's column widths, so only these two rows changed.
- `docs/DECISIONS.md` — D51 (appended): the terms, where "Saturday" stays, and how to read "Saturday" in D1–D50.
- `docs/ARCHITECTURE.md`, `README.md`, `docs/PREREQUISITES.md`, `.claude/skills/record-fixture/SKILL.md` — "Saturday" for the concept became event / scheduled event / event day.
- `lib/i18n/glossary/*.md` (17 translator glossaries) — `ledger.event` note "a Saturday event" → "a game event". No copy value changed, so no translation run and no stamps changed.
- Code comments: `lib/schedule.ts`, `lib/tick.ts`, `lib/repo/events.ts`, `lib/rehearsal.ts`, `lib/run.ts`, `lib/schema.ts`, `lib/notify.ts`, `app/api/snapshot/route.ts`, `config/alliances.ts`, `scripts/seed.ts`.
- Identifiers: `scripts/seed.ts` `SATURDAYS` → `EVENT_DATES`; test-local `saturday` → `scheduled` in `app/api/manual-event/route.test.ts`.
- Test names: four in `app/api/manual-event/route.test.ts`, one in `app/api/tick/route.test.ts`, one in `lib/notify-event-message.test.ts`.
- Test fixtures named "Saturday" or "Saturday 2026-11-07" now use the real default title (`Saturday Event 2026-11-07`, `Saturday Event 2026-10-17` in `players.test.ts`) or "Scheduled event" (`upstream-status.test.ts`, whose date is relative).

## Decisions
- **DECISIONS.md old entries are not edited.** The file is append-only; D51 states the terms and how to read "Saturday" in D1–D50. Of the 24 hits left there, 19 are inside D4–D50 and 5 in D51 (which names the weekday and the title).
- "The Saturday guard" is the not-due guard (`snapshot_not_due`, D28): the comment in `app/api/snapshot/route.ts` and the test name say "not-due guard".
- The record-fixture skill's "never on Friday or Saturday" became "never on the event's weekday or the day before", since that rule follows `EVENT_WEEKDAY`.

## Deviations
- **Handoff letter.** This handoff uses `08zy` as the session brief assigned. The owner's #127 decision comment reserves `08zy` for the DECISIONS split session; that session needs another letter (also noted in 08zp).
- `lib/tick.ts` (4 comment lines) and `app/api/tick/route.test.ts` (1 test name) are Lane A files; the edits are comment and test-name only.

## Verified
- `git grep -n -i saturday -- ':!docs/handoff'` after the change, by category:
  - **Weekday setting:** `lib/schedule.ts:33` (weekday names), `:168` (`0 = Sunday … 6 = Saturday`); `docs/GLOSSARY.md:11`, `README.md:3`, `.claude/skills/record-fixture/SKILL.md:14` ("Saturday by default").
  - **Date formatting:** `app/_ui/format.ts:94`; `app/_ui/format.test.ts:5, 15, 45, 49`; `app/api/tick/route.test.ts:79` (the date 2026-11-07); `docs/DESIGN.md:262` (example section title "Saturday, October 31"); `docs/PREREQUISITES.md:134` (what the Friday message prints: "Saturday 10:00 / 14:00 server").
  - **Default titles:** `lib/schedule.ts:37` (`eventOn` comment); `scripts/seed.ts:133` (`Seed Saturday Event <date>`).
  - **Fixtures that are real titles:** `app/_ui/EventLabel.test.ts:15`, `app/_ui/admin/AdminActions.test.ts:15`, `app/api/events/[id]/route.test.ts:40`, `app/api/manual-event/route.test.ts:169, 293, 328`, `app/api/tick/route.test.ts:102`, `app/img/avatar/[uid]/route.test.ts:41`, `lib/notify-event-message.test.ts:117, 122, 168`, `lib/queries/players.test.ts:24`.
  - **Append-only:** `docs/DECISIONS.md` (19 hits in D4–D50, 5 in D51).
  - **Owner-only, not edited:** `docs/IMPLEMENTATION_PLAN.md` (35) and `docs/SESSION_PLAYBOOK.md` (10), listed under Open issues.
- `pnpm check` → Prettier, ESLint, tsc clean; Vitest 39 files passed / 1 skipped, 184 tests passed / 1 skipped; drift "No schema changes"; "i18n: 17 languages up to date with English".

## Open issues
Owner-only files, mentions of "Saturday" for the concept (line numbers on 505979a). Weekday/title uses there are kept: plan `:11` (the weekday in the definition), `:156` (title example), `:284` (`EVENT_WEEKDAY=6 # Saturday`), `:307` (a date conversion), `:486` (the event-day runbook step at a time).
- `docs/IMPLEMENTATION_PLAN.md`: 25, 57 (×2), 58, 59, 62, 70, 86, 90, 99, 122, 160, 286, 345, 368 (title band "Saturday Ledger" and "past Saturdays"), 405, 409, 429 ("Saturday Ledger"), 447–449 (old Discord message drafts "Saturday ledger"), 454, 477 (×2), 481 (×2), 488, 491, 493, 611, 657 (milestone names "v1.0 — first Saturday", "v1.1 — after the first Saturday"), 684, 703.
- `docs/SESSION_PLAYBOOK.md`: 180, 228, 388, 391, 578 ("Saturday Ledger"), 744, 756, 764, 780 (Session 10: "the Saturday timeline"), 800.
- The GitHub milestones themselves are named "v1.0 — first Saturday" and "v1.1 — after the first Saturday"; renaming them is the owner's call.
- D28 calls manual events "manual rounds", and some code and copy still say "manual round" (e.g. `lib/notify.ts:179`). #130 is about "Saturday" only; not changed.

## Next
Session: 10 — README and runbook polish
Model / effort: keep (haiku, medium) — no signal; this PR changed two README sentences.
Owner must do first: merge this PR into `dev`. No migration, no environment variable, no copy change.
Plan changes needed: `docs/SESSION_PLAYBOOK.md:780` (Session 10 prompt) says "the Saturday timeline"; under D51 it reads "the event-day timeline". The other plan and playbook lines are listed in Open issues; owner's call.

<adjustments>
- Domain terms (D51, docs/GLOSSARY.md): **event**, **scheduled event** (the weekly one on `EVENT_WEEKDAY`, Saturday by default), **manual event** (D28). Write the README's timeline as the scheduled event's timeline; say "Saturday" only for the default weekday or a date.
- README.md already says "the weekly scheduled event (Saturday by default)" in its first paragraph and "A scheduled event's row is created a day ahead" in the snapshot-times paragraph.
</adjustments>

<adjustments for="#127 session 2 (DECISIONS split)">
- D51 exists (event terminology, this PR). The split moves it like any other entry. `08zy` is taken by this handoff; use another letter.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/147
