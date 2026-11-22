# Words pass (#585 batch 4) checks

Build: `pnpm typecheck`
Run unit: `pnpm vitest run lib/date-words.test.ts lib/private/dictionary.test.ts "app/(private)/_ui/BoardSections.test.ts" "app/(private)/_ui/MemberSquads.test.ts" "app/(private)/_ui/follow-up-groups.test.ts" lib/private/desk-activity.test.ts --reporter=verbose`
Plan: `.specs/features/585-words/plan.md`

profile: light

9 checks in 1 slice built (S1 in `feat/585-words-1`) · 0 one-way doors · 1 open (S1b, waits for the owner), of which 0 block S1

## Checks

### S1 - one rule for dates, times and zones on the desk, the board and Me

**C1** - With the machine's zone at Asia/Tokyo and the server's at UTC−2, the instant 2026-11-21T01:31Z reads "Fri, Nov 20, 23:31" and its day "Fri, Nov 20"; the server day "2026-11-20" reads "Fri, Nov 20" in any zone; "Friday, November 20" as a heading (AC 1, AC 3)
Proof: run unit | ✓ lib/date-words.test.ts > one way to write a date and a time (issue 585 batch 4) > writes an instant on the server's clock and a server day as that day, never the UTC or the machine's day

**C2** - A date and its time are joined "Fri, Nov 20, 23:31", "sex., 20 de nov. às 23:31", "ven. 20 nov. à 23:31" (AC 2)
Proof: run unit | ✓ lib/date-words.test.ts > one way to write a date and a time (issue 585 batch 4) > joins a date and its time the way each language does: a comma, às, à

**C3** - Each of the 14 PT and FR lines that end a sentence with a date is traced to every file between its caller and its date form, and that form is `sentence` or `withYear`; a caller switched to `day` (tried on Frame's deletion date and the KvK reason) or a caller not traced fails (AC 5)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > fills every Portuguese and French line that ends a sentence with a date from the sentence or year form, at its caller (issue 585 batch 4)

**C4** - In each language, every line that spells out server time also names "ST", and Portuguese never says "hora do servidor" nor French "heure serveur" (AC 6)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > writes every time as ST and spells server time out only in a line that names ST (issue 585 batch 4)

**C5** - The board's time column reads "(UTC+2)" for Kyiv in November and "(UTC+3)" in July, "(UTC−3)" for São Paulo, and Portuguese "seu horário" (AC 7, AC 10)
Proof: run unit | ✓ app/(private)/_ui/BoardSections.test.ts > the board's week (D116) > names the viewer's zone by its offset on the day shown, summer time included (issue 585 batch 4)

**C6** - On Me the seen line reads "seen Tue, Nov 17, 05:00 your time" · "Mon, Nov 16, 18:00 ST" (Tokyo), "seen Mon, Nov 16, 22:00 your time" · "18:00 ST" (Kyiv), PT "visto em ter., 17 de nov. às 05:00 seu horário"; the desk keeps "seen Mon, Nov 16, 18:00 ST" first; with no zone, the ST line alone (AC 11, AC 12)
Proof: run unit | ✓ app/(private)/_ui/MemberSquads.test.ts > when a squad was seen, on Me and on the desk (issue 585 batch 4) > puts the member's own time first on Me, with its own date, the ST date said once on one day

**C7** - The KvK reason reads "Still rebuilding after the KvK of November 21." while the group's hint keeps "in the KvK of Sat, Nov 21," (AC 5)
Proof: run unit | ✓ app/(private)/_ui/follow-up-groups.test.ts > Follow-up's groups (issue 585 slice 2) > offers help after the KvK in the second group, its rule said once in the hint, the KvK line on a Needs help row and in every panel (issue 585 S5)

**C8** - A break line in Recent activity reads "until Nov 24", Portuguese "até 24 de nov." (never "24/11") and French "jusqu’au 24 nov." (AC 1)
Proof: run unit | ✓ lib/private/desk-activity.test.ts > recent activity > names a calendar change and the follow-up choice, never the note

**C9** - A member's session lands on the board titled "Next 7 days in the alliance", with its 7-day strip (AC 9)
Proof: `pnpm test:e2e e2e/board.spec.ts -g "a member's session opens the board"`

## Coverage

| Set (size)                           | Member -> proof                                           | Unproven |
| ------------------------------------ | --------------------------------------------------------- | -------- |
| date forms, AC 1-3 (4 used in lines) | `day` C1 · `long` C1 · `at` C1, C2 · `time` C1            | -        |
| languages, AC 2 (3)                  | en C2 · pt-BR C2, C6 · fr C2                              | -        |
| zones, AC 3, AC 7 (3)                | the server's C1 · a viewer's in winter C5 · in summer C5  | -        |
| seen line, AC 11-12 (4)              | Me, other day C6 · Me, same day C6 · desk C6 · no zone C6 | -        |
| sentence-ending lines, AC 5 (2)      | every caller traced C3 · a caller (KvK reason) C7         | -        |
| server-time wording, AC 6 (3)        | en C4 · pt-BR C4 · fr C4                                  | -        |

## Swept

- validation: n/a - no input changes
- failure modes: C6 (no zone known: ST alone, AC 12)
- idempotency: n/a - formats are pure
- authorization: existing - no route or read changes; `requireWorkspace` / `requireBoard` as before
- concurrency: n/a - pure formatting, no shared state
- data lifecycle: n/a - nothing stored
- dependency failure: n/a - no outside call; Intl is built in
- state transitions: C6 (before and after the browser knows its zone)
- observability: n/a - no event or property changes (the PR's analytics plan)

## Not proven by a test

- AC 4 (the notice picture's "kept" day built on the server): the editor's `kept.on` is a required string and `noticeDetail` no longer carries the kept instant inside the picture, so a page that skips `noticeWords().picture` does not type-check (`pnpm typecheck`); C3 traces its date form.
- AC 8 (/admin's zone row "UTC−2 (server time)") and AC 13 (Me's "Times are in server time (ST).") are one-line wirings with no rule of their own, named in the handoff for review.

## Handoff

**Dispatched:** plan review panel (officers, member, player; PT-BR and FR copy experts; product strategy; adversarial), 2026-11-22. The Verifier is left to the orchestrator's review of the PR (see the handoff).
