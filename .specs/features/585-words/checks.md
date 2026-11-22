# Words pass (#585 batch 4) checks

Build: `pnpm typecheck`
Run unit: `pnpm vitest run lib/date-words.test.ts lib/private/dictionary.test.ts "app/(private)/_ui/BoardSections.test.ts" "app/(private)/_ui/MemberSquads.test.ts" "app/(private)/_ui/follow-up-groups.test.ts" lib/private/desk-activity.test.ts "app/(private)/_ui/FollowUpWeek.test.ts" lib/private/read-status.test.ts lib/private/me-parts.test.ts lib/private/insights-kvk.test.ts lib/push-uses.test.ts lib/private/day-average.test.ts lib/private/member-days.test.ts lib/private/insights-rules.test.ts --reporter=verbose`
Plan: `.specs/features/585-words/plan.md`

profile: light

22 checks in 3 slices built (S1 in PR 662, S2 in PR 669, S1b in `feat/585-words-1b`) · 0 one-way doors · 0 open

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

### S2 - one word for the daily update, and Follow-up's help on one screen

**C10** - Each of the 40 lines that name the daily update (S2's and the new-member lines) says it with the one term in EN, PT-BR and FR ("daily update", "atualização diária", "mise à jour quotidienne"), and no value anywhere holds a form that only ever meant it ("daily read", "no read", "first read", "nightly roster", "leitura diária", "lista da noite", "relevé quotidien", "lecture quotidienne", "mise à jour du jour", "pas de relevé", "liste de la nuit"). Each old form put back fails it: EN "No reading", "not read yet", "{n} reads", "New · waiting for the nightly roster"; PT "Sem leitura", "ainda não lido", "{n} leitura"; FR "pas encore lu", "{n} relevé", "Nouveau · attend la liste de la nuit" (AC 14, AC 15)
Proof: run unit | ✓ lib/private/dictionary.test.ts > the workspace dictionary (D71, #305) > calls the end-of-day read the daily update, one word per language, never a read or a relevé (issue 585 batch 4 S2)

**C11** - The status bar says "Today’s daily update failed · the cards keep the last numbers · squads wait for it" (AC 14)
Proof: run unit | ✓ lib/private/read-status.test.ts > readStatus (D135) > a failed roster read says so

**C17** - A roster not in after its window: the status bar says "Today’s daily update is late · the cards keep the last numbers · squads wait for it"; nothing when all is well (AC 14)
Proof: run unit | ✓ lib/private/read-status.test.ts > readStatus (D135) > a roster not in after its window says the cards keep the last numbers; nothing when all is well

**C12** - On Me a day still to come reads "2026-11-05: no daily update yet" beside "none" and the no-data mark (AC 14)
Proof: run unit | ✓ lib/private/me-parts.test.ts > a member's own week (D142) > says none, no data and no daily update yet apart, and puts their own last week beside it

**C13** - On KvK day between the End and 23:30 ST, Insights' KvK card says its cost and recovery "show here after tonight's daily update at 23:30 ST." (AC 14)
Proof: run unit | ✓ lib/private/insights-kvk.test.ts > KvK cost and recovery (issue 489) > on KvK day between the End and the 23:30 ST daily read, says today's KvK is recorded and waits for that read

**C14** - When the daily update and its retry fail, the officer's notification is titled "Daily update failed", once per day, to the failed alliance's workspace only (AC 16)
Proof: run unit | ✓ lib/push-uses.test.ts > the officers' notifications (D148) > night read failed: once per day, only to the workspace whose alliance failed

**C15** - Follow-up's head draws "How this list works" with no `open`, its summary "Tap a name to write down what they said. How this list works", and inside "Say hello, write down what they said, mark how it went." then the owner's line word for word (AC 17)
Proof: run unit | ✓ app/(private)/_ui/FollowUpWeek.test.ts > Follow-up's week around the list (issue 585) > keeps How this list works closed on every visit, the owner's line word for word one tap away and the tap cue in sight (issue 585 batch 4 S2)

**C16** - On a fresh browser (first visit) the help is closed; a tap opens it and shows the owner's line; after a save and a reload it is closed with the tap cue in sight (AC 17)
Proof: `pnpm test:e2e e2e/desk-flows.spec.ts -g "Talked to them takes a quiet member off the list"`

## Coverage

| Set (size)                           | Member -> proof                                             | Unproven |
| ------------------------------------ | ----------------------------------------------------------- | -------- |
| date forms, AC 1-3 (4 used in lines) | `day` C1 · `long` C1 · `at` C1, C2 · `time` C1              | -        |
| languages, AC 2 (3)                  | en C2 · pt-BR C2, C6 · fr C2                                | -        |
| zones, AC 3, AC 7 (3)                | the server's C1 · a viewer's in winter C5 · in summer C5    | -        |
| seen line, AC 11-12 (4)              | Me, other day C6 · Me, same day C6 · desk C6 · no zone C6   | -        |
| sentence-ending lines, AC 5 (2)      | every caller traced C3 · a caller (KvK reason) C7           | -        |
| server-time wording, AC 6 (3)        | en C4 · pt-BR C4 · fr C4                                    | -        |
| daily-update word, AC 14 (3)         | en C10, C11, C12, C13, C17 · pt-BR C10 · fr C10             | -        |
| help states, AC 17 (3)               | first visit C15, C16 · after a tap C16 · after a reload C16 | -        |

### S1b - one rule for a member's average

Each proof below failed when its rule was broken on purpose (2026-11-22): "none" left out of `dayAverage` (C18 to C22 fail), a day with no daily update counted as "none" (C18, C19, C21 fail), the all-"none" line removed (C18, C20, C21 fail, printing "Average 0 · 7 days, of which 7 none"), and Insights alone treating "none" as no update (C18, C22 fail).

**C18** - From the same PGlite rosters (Mon to Sun: 600, none, none, 600, no daily update, 600, 600), the card reads "Average 400 · 6 days, of which 2 none", Me "This week: Average 400 · 6 days, of which 2 none", and Insights' effort is 400 over 6 days with 2 "none", in each of the three rows; a member with only "none" days reads "None on all 6 days" on both, and Insights 0 over 6 days with 6 "none"; the Friday cell is "—" on both (AC 20, 21, 22, 23)
Proof: run unit | ✓ lib/private/day-average.test.ts > one average for a member on the card, Me and Insights (#663) > counts a none day as 0 and names it, leaves the day with no daily update out, and says an all-none week as such

**C19** - The card's 500, 700, —, —, none, 600, 400 reads "Average 440 · 5 days, of which 1 none"; coins "Average 500 · 5 days, of which 2 none"; donations "Average 4.40K · 5 days, of which 2 none" (AC 20, 23)
Proof: run unit | ✓ lib/private/member-days.test.ts > the member card's last 7 days (issue 461) > says each row's average with its none days counted as 0 and named, draws coins against 1,000 and never a 0 for no data

**C20** - Seven "none" days read "None on all 7 days", never "Average 0", with every cell "none" (AC 21)
Proof: run unit | ✓ lib/private/member-days.test.ts > the member card's last 7 days (issue 461) > says a week of only none days as none on all of them, never Average 0

**C21** - On Me, 600, none, 400 then days to come reads "This week: Average 333 · 3 days, of which 1 none"; a Monday "none" alone "This week: None on 1 day"; a week whose only day has no daily update "This week: no average yet", beside "Last week: None on all 2 days" (AC 20, 21)
Proof: run unit | ✓ lib/private/me-parts.test.ts > a member's own week (D142) > says none, no data and not read yet apart, and puts their own last week beside it

**C22** - Insights' effort for a member with 100 and "none" on the reads that list them is 50 over 2 days with 1 "none"; the four groups and their medians are as before (AC 24)
Proof: run unit | ✓ lib/private/insights-rules.test.ts > effort at every might level (issue 489) > averages the reads that list a member, none as 0, and makes four bands of might, the highest first

## Coverage

| Set (size)                           | Member -> proof                                                                  | Unproven |
| ------------------------------------ | -------------------------------------------------------------------------------- | -------- |
| date forms, AC 1-3 (4 used in lines) | `day` C1 · `long` C1 · `at` C1, C2 · `time` C1                                   | -        |
| languages, AC 2 (3)                  | en C2 · pt-BR C2, C6 · fr C2                                                     | -        |
| zones, AC 3, AC 7 (3)                | the server's C1 · a viewer's in winter C5 · in summer C5                         | -        |
| seen line, AC 11-12 (4)              | Me, other day C6 · Me, same day C6 · desk C6 · no zone C6                        | -        |
| sentence-ending lines, AC 5 (2)      | every caller traced C3 · a caller (KvK reason) C7                                | -        |
| server-time wording, AC 6 (3)        | en C4 · pt-BR C4 · fr C4                                                         | -        |
| day states, AC 20-23 (4)             | number C18, C19 · none C18-C22 · no update C18, C21 · later C21                  | -        |
| average lines, AC 20-21 (4)          | plain C21 · with none C18, C19, C21 · all none C18, C20, C21 · no listed day C21 | -        |
| pages, AC 22 (3)                     | card C18 · Me C18 · Insights C18, C22                                            | -        |

## Swept

- validation: n/a - no input changes
- failure modes: C6 (no zone known: ST alone, AC 12)
- idempotency: n/a - formats are pure
- authorization: existing - no route or read changes; `requireWorkspace` / `requireBoard` as before
- concurrency: n/a - pure formatting, no shared state
- data lifecycle: n/a - nothing stored
- dependency failure: n/a - no outside call; Intl is built in
- state transitions: C6 (before and after the browser knows its zone)
- observability: n/a - no event or property changes (the PR's analytics plan); S2 adds a dated "Changed" line for the help's state

## Not proven by a test

- AC 4 (the notice picture's "kept" day built on the server): the editor's `kept.on` is a required string and `noticeDetail` no longer carries the kept instant inside the picture, so a page that skips `noticeWords().picture` does not type-check (`pnpm typecheck`); C3 traces its date form.
- AC 8 (/admin's zone row "UTC−2 (server time)") and AC 13 (Me's "Times are in server time (ST).") are one-line wirings with no rule of their own, named in the handoff for review.
- AC 18 (the KvK title on a first visit's first screen): depends on the seed's date, the fonts and a margin of a few pixels, so it is not a committed test. Measured on the e2e seed at 360 × 780 (Chromium): the title's top at y 695, its box above the tab bar (top 723), on a first visit as on a return visit; it was at 788 before. PT 739 and FR 763 on every visit, the jump in sight.
- AC 19 (the cookie retired): `FOLLOW_UP_HELP_COOKIE` is gone, so a reader of it fails `pnpm typecheck`; no other code names `lap_ws_fu_help`.
- AC 25 (Me's legend "A “none” day counts as 0 in the average."): one string per language with no rule of its own; the e2e suite ran with it (51 passed).
- The PT and FR average lines of AC 20 and 21 are dictionary strings with no test of their own; the persona panel read them at 360 px.

## Handoff

**Dispatched:** plan review panel (officers, member, player; PT-BR and FR copy experts; product strategy; adversarial), 2026-11-22; S2's panel (officers and a member with a first-glance test; PT-BR and FR copy experts; product strategy; adversarial), 2026-11-22; S1b's panel (two officers, a member on Me, PT-BR and FR copy experts, adversarial), 2026-11-22. The Verifier is left to the orchestrator's review of the PR (see the handoff).
