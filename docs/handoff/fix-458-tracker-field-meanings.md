# fix-458 — What the tracker fields mean, and the offline signal

Issue 458. Branch `fix/tracker-field-meanings`, cut from `origin/dev` at 89050e49.

## Built

- **Labels (EN, PT-BR, FR).** In `lib/private/dictionary*.ts`:
  - `sheet.activity`, `thanks.activity`: "Daily quest points" / "Pontos de missões diárias" / "Points de quêtes du jour".
  - `members.meta.act`: "Daily quest points {v}".
  - `nodata.activity`: "daily quest points".
  - `sheet.honor`: "Alliance Help coins today (max 1,000)" / "Moedas de Ajuda da aliança hoje (máx. 1.000)" / "Pièces d’Aide d’alliance aujourd’hui (max 1 000)". The French uses a narrow no-break space in 1 000.
  - `calendar.suggest.active`, `garrison.why.active`: "Did daily quests this week" / "Fez missões diárias nesta semana" / "Quêtes du jour faites cette semaine".
  - `roll.team.active`: "Quests this week" / "Missões na semana" / "Quêtes cette semaine".
  - `calendar.suggest.how` (the caravan help line) and `roll.team.how` now say "most daily quest points this week".
  - The copy for spreadsheet uses `sheet.activity` and `sheet.honor`, so its headers changed with them.
  - Code comments that said "weekly activity" now say daily quest points, in caravans, caravan suggestions, garrison, roll call and the team page.
- **Offline signal.** `idleRun` in `lib/private/member-week.ts` fires on `active` null and `daily_tech` null on 3 end-of-day reads in a row (`IDLE_READS = 3`, which replaces `IDLE_STEPS`).
  - Each read must be of the server day after the one before it, and must list the member.
  - `endOfDayReads` returns only successful reads, so a failed read is a missing day and ends the run.
  - The Monday reset logic is gone.
  - The evidence is now `{ days }`: the number of reads in the run, so 3 for the first day it fires. The old rule reported 2 for the same 3 reads.
- **Week-based thanks and picks.** `weekQuestPoints(reads, uid)` adds up `active` over the end-of-day reads of the newest read's game week (Monday to Sunday). It returns null when no day has a number. It is used by:
  - the Members thanks "Daily quest points" (`members.ts`);
  - caravan suggestions (`caravans.ts`, which now reads `WEEK_READS = 7` reads, not 1);
  - Elixir team picks (`roll-call-view.ts`, 7 reads);
  - the garrison "active" signal (`garrison-signals.ts`, which already read 15).
- **Docs.**
  - New decision D127.
  - Dated amendments to D71, D75, D76 and D121.
  - A D127 line in the decisions README.
  - Three new GLOSSARY rows: daily quest points, Alliance Help coins, tech donated.

## Decisions

- D127 (D126 is already taken on another branch). It records:
  - what the three fields mean;
  - that null on a successful read that lists the member means "nothing today";
  - the offline rule;
  - the week sum used by thanks and picks.
- I used the sum, not the count of days with points. With a sum, the order still separates a member with 1 day at 1,000 from one with 3 days at 100. One line explains it: "each day's quest points this week, added up".

## Deviations

- "It does not fire for a new member": I implemented the reading that follows from the issue's rule. Reads that do not list the member end the run, so a member who joined 2 days ago cannot fire. A new member (under 14 days, `isNewMember`) who has 3 listed reads with nothing still fires. D75 leaves new members out of comparisons, and the offline signal is not a comparison. If the owner wants new members left out entirely, it is a one-line `!isNew` guard in `rowOf`.
- `reason.idle` ("no new donations or activity for {n} days") is not in the issue's list, so I left it unchanged. It still reads true.
- Tests outside the listed ones had to change because their fixtures used the old rule (unchanged values):
  - `follow-up.test.ts`: the offline fixture now sends null.
  - `members.test.ts`: a Monday read with donations, then 3 null reads. This also checks that thanks use the week.

## Verified

- **`pnpm check` exits 0:** prettier, eslint, tsc, vitest (**220 files passed, 2 skipped; 1,188 tests passed, 4 skipped**), the drift check and i18n (17 languages up to date).
- **Tests, one per behaviour:**
  - `member-week.test.ts`:
    - fires on 3 null successful reads (`{ days: 3 }`), and not when a donation breaks the run;
    - does not fire across a failed read (two runs of 2), then fires once a third consecutive read arrives;
    - does not fire for a new member listed in only 2 reads;
    - `weekQuestPoints` sums Monday to the newest read, leaves out last week's Sunday, and returns null when no day has a number; the garrison `signalsOf` reads the same week.
  - `members.test.ts`: the thanks use the week. Monday's quest points (50) and donations count on Thursday, when the newest read is null. The idle reason is `{ kind: "idle", days: 3 }`.
  - `members-sheet.test.ts`: the spreadsheet headers are the new labels.
- **Local e2e** on a production build (:3986), with this worktree's Postgres 18 (50 migrations) and the Discord sign-in stand-in. Every https call was blocked, and no upstream, Discord or Groq call was made.
  - Seed: an invented 36-member roster on 4 server days. Three members have nothing on the last 3 reads; every fifth member has no quests yet on the newest read; one member joined 2 days ago with nothing yet.
  - **49 of 51 checks pass**, at 360 and 1280, light and dark, EN and PT-BR:
    - the card shows the new quest and coins labels and no old label;
    - the 3 idle members show "for 3 days" / "há 3 dias";
    - no page scrolls sideways;
    - no request left the machine.
  - The 2 failures were a wrong check of mine: Home's "Members this week" shows one thanks list, donors whenever there are any (`HomeMembers.tsx`, unchanged). The Members page thanks show "Daily quest points".
  - The new member is not listed under Check in. Only Isolde, Odessa and Percival are.
  - Shots (26 PNG plus `metrics.json`): `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/458-shots/`. Scripts: `.../scratchpad/458/`.
  - At 360 PT-BR, the longer labels fit. "Pontos de missões diárias" wraps to two lines in the thanks column head, which reads fine.

## Open issues

- The Members tab still treats a null `active` as missing data: "No data: daily quest points" on the row and "—" on the card. Under D127 it means "no quests yet today". In the seed, every fifth row shows that line, and in production it will be about 21 of 101 rows early in the day. This needs its own change (owner's call on the wording).
- The card shows "Daily quest points" twice: once in the meta line (`members.meta.act`) and once in the details (`sheet.activity`). This was already the case with "Activity" and "Activity this week".
- D103 line 29 says "active this week" for team picks. It was not in the list of decisions to amend; D127 covers the change.
- `roll.filter.week` ("Active" / "Ativas" / "Actifs") is a roll-call filter label not tied to `active`, so it is unchanged.
- PT and FR names for "Alliance Help" and "daily quests" are my translations, not taken from the game's PT or FR screens. If the game shows other words, D52 says to use the game's.

## Next

- Model/effort: keep. The change was one pure function, its callers and copy, and it took one build round.
- What the owner must do first: merge. There is no migration and no environment change.
- Plan change: none. This work runs from issue 458, not from a `docs/SESSION_PLAYBOOK.md` prompt.

<adjustments>
- #461, #465 and #466 can reuse `weekQuestPoints` and the private `weekDays` helper in `lib/private/member-week.ts`. `WEEK_READS = 7` reads cover a game week.
- `idleRun` now returns `{ days }` only. Its `activity` and `donated` evidence fields are gone (they were always null under the new rule).
- Fixtures for the offline signal must send null for `active` and `daily_tech`, never an unchanged number or 0.
- Seed for Members shots with the D127 shapes: scratchpad `458/seed.mjs`.
</adjustments>

PR: (added by the orchestrator)
