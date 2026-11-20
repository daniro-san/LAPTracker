# fix-458 — What the tracker fields mean, and the offline signal

Issue 458. Branch `fix/tracker-field-meanings`, cut from `origin/dev` at 89050e49.

## Built

- **Labels (EN, PT-BR, FR).** In `lib/private/dictionary*.ts`:
  - `sheet.activity`, `thanks.activity`: "Daily quest points" / "Pontos de missões diárias" / "Points de quêtes du jour".
  - `members.meta.act`: "Daily quest points {v}".
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
  - A member first seen less than 7 days ago (`OFFLINE_GRACE_DAYS`) never gets the signal: `rowOf` in `members.ts` skips `idleRun` for them (owner, 2026-11-19; 7 days on 2026-11-20). The "New" tag keeps 14 days.
  - The evidence is now `{ days }`: the number of reads in the run, so 3 for the first day it fires. The old rule reported 2 for the same 3 reads.
- **Week-based thanks and picks.** `weekQuestPoints(reads, uid)` adds up `active` over the end-of-day reads of the newest read's game week (Monday to Sunday). It returns null when no day has a number. It is used by:
  - the Members thanks "Daily quest points" (`members.ts`);
  - caravan suggestions (`caravans.ts`, which now reads `WEEK_READS = 7` reads, not 1);
  - Elixir team picks (`roll-call-view.ts`, 7 reads);
  - the garrison "active" signal (`garrison-signals.ts`, which already read 15).
- **No daily quests or no donations is a fact, not missing data.** The owner decided it for daily quest points on 2026-11-19; the donations half is my extension, pending the owner's confirmation. The read runs at the end of the server day, so a null `active` or `daily_tech` on it means none that day.
  - `missingOf` no longer lists `activity`. A read that lists the member with a null value gives the new `DayValue` `"none"`, so "No data: donations on {n} days" counts only days with no read of the member.
  - `MemberRow.noQuestsOn` and `noDonationsOn` hold the newest read's server day when it sent none.
  - The list row and the card say, in the status's muted tone: "No daily quests on {day}", "No donations on {day}", or both in one line, "No quests or donations on {day}" (`members.noQuests`, `members.noDonations`, `members.noQuestsOrDonations`, in EN, PT-BR and FR). A Fine row shows only that line. `nodata.activity` is removed.
  - In the card's week of donations, a day whose read sent none shows a muted "none" / "nada" / "rien" (`members.don.nothing`); "—" is only for a day with no read. It is never 0 and never in the total.
  - "—" and "No data" stay for what no read told: a day with no read, might or Sanctuary not sent.
- **Docs.**
  - New decision D127, with the aggregates of one real roster read (2026-11-19): 99 of 100 with quest points (minimum 250, median 555), 74 of 98 at the 1,000 coin cap, a median of 6,500 tech donated a day, and `online`, `last_online_at` and `joined_at` empty on all 100.
  - Dated amendments to D71, D75, D76, D103 and D121.
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

- `reason.idle` ("no new donations or activity for {n} days") is not in the issue's list, so I left it unchanged. It still reads true.
- Tests outside the listed ones had to change because their fixtures used the old rule (unchanged values):
  - `follow-up.test.ts`: the offline fixture now sends null.
  - `members.test.ts`: a Monday read with donations, then 3 null reads. This also checks that thanks use the week.

## Verified

- **`pnpm check` exits 0** on the final commit, rebased onto `origin/dev` (be0c4e32, with #463): prettier, eslint, tsc, vitest (**224 files passed, 2 skipped; 1,214 tests passed, 4 skipped**), the drift check and i18n (17 languages up to date).
- **Tests, one per behaviour:**
  - `member-week.test.ts`:
    - fires on 3 null successful reads (`{ days: 3 }`), and not when a donation breaks the run;
    - does not fire across a failed read (two runs of 2), then fires once a third consecutive read arrives;
    - does not count a read that does not list the member;
    - `missingOf` no longer lists a null `active`;
    - `weekQuestPoints` sums Monday to the newest read, leaves out last week's Sunday, and returns null when no day has a number; the garrison `signalsOf` reads the same week.
  - `members.test.ts`: a new member with 3 reads with nothing gets no reason, while an older member with the same reads gets `{ kind: "idle", days: 3 }` (folded into the away-note test: the file is at the 300-line lint limit). The thanks use the week. Monday's quest points (50) and donations count on Thursday, when the newest read is null.
  - `members-sheet.test.ts`: the spreadsheet headers are the new labels.
  - `member-list-data.test.ts`: a Fine member with no quest points shows "No daily quests on Mon, Nov 16"; with no donations, "No donations on …"; with neither, "No quests or donations on …".
  - `member-week.test.ts` (donations): a read with a null value is `"none"`, a day with no read is null.
  - `caravans.test.ts` (after review): on three reads where the newest day ranks the members differently from the week, the caravan suggestions and the Elixir team picks follow the week's sum. Each assertion fails when its call site reads only the newest day. It is its own file because `roll-call.test.ts` is at the 300-line lint limit.
- **Local e2e** on a production build (:3986), with this worktree's Postgres 18 (50 migrations) and the Discord sign-in stand-in. Every https call was blocked, and no upstream, Discord or Groq call was made.
  - Seed: an invented 36-member roster on 4 server days. Three members have nothing on the last 3 reads; every fifth member has no quests yet on the newest read; one member joined 2 days ago with nothing yet.
  - **73 of 73 checks pass**, at 360 and 1280, light and dark, EN and PT-BR:
    - the card shows the new quest and coins labels and no old label;
    - the list shows "No daily quests on …" / "Sem missões diárias em …" and never "No data: daily quest points";
    - Hollis's card (no quests on the newest read) shows the same line in muted text;
    - the 3 idle members show "for 3 days" / "há 3 dias";
    - no page scrolls sideways;
    - no request left the machine.
  - The new member is not listed under Check in. Only Isolde, Odessa and Percival are.
  - Shots (32 PNG plus `metrics.json`): `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/458-shots/`. Scripts: `.../scratchpad/458/`.
  - At 360 PT-BR, the longer labels fit. "Pontos de missões diárias" wraps to two lines in the thanks column head, which reads fine.
- **Second e2e round, for donations as a fact of the day**, on a new production build of the final commit, same seed and stand-ins. **73 of 73 checks pass**, at 360 and 1280, light and dark, EN and PT-BR:
  - the list shows "No donations on …" / "Sem doações em …" and "No quests or donations on …" / "Sem missões nem doações em …", and never "No data: donations";
  - Marlow's card (no donations on any of the 4 reads) shows "No donations on Thu, Nov 19" and 4 muted "none" / "nada" days;
  - Florian's card shows the combined line;
  - Isolde still shows the offline signal ("for 3 days" / "há 3 dias");
  - no page scrolls sideways, and no request left the machine.
  - Shots (24 PNG plus `metrics.json`): `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/458-shots2/`. Script: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/458/shots2.mjs`.
  - At 360 PT-BR, the list row cuts "Sem missões nem doações em qui., 19 de …" with an ellipsis, as it already cuts long Check-in lines. The card shows the whole line.

## Open issues

- The week's donation total (list column "Donated this week", card head) is still "—" when no day of the week has a number, also when every read sent none. Showing 0 there would go against "never 0"; the owner can decide the wording.
- Donations as a fact of the day (`DayValue` `"none"`, "No donations on {day}", "No quests or donations on {day}") extend the owner's 2026-11-19 answer about quest points to `daily_tech`, under D127's rule that null on a successful read is "nothing today". The owner may want to confirm the wording.
- "Copy for spreadsheet" leaves a "none" day blank, the same as a day with no read: the copy carries numbers only.
- The card shows "Daily quest points" twice: once in the meta line (`members.meta.act`) and once in the details (`sheet.activity`). This was already the case with "Activity" and "Activity this week".
- `roll.filter.week` ("Active" / "Ativas" / "Actifs") is a roll-call filter label not tied to `active`, so it is unchanged.
- PT and FR names for "Alliance Help" and "daily quests" are my translations; the game's English labels are "Alliance Help" and "Daily Alliance Coin". The owner may send the game's PT and FR screens so the terms can be aligned with them (D52).

## Next

- Model/effort: keep. The change was one pure function, its callers and copy, and it took one build round.
- What the owner must do first: merge. There is no migration and no environment change.
- Plan change: none. This work runs from issue 458, not from a `docs/SESSION_PLAYBOOK.md` prompt.

<adjustments>
- #461, #465 and #466 can reuse `weekQuestPoints` and the private `weekDays` helper in `lib/private/member-week.ts`. `WEEK_READS = 7` reads cover a game week.
- `idleRun` now returns `{ days }` only. Its `activity` and `donated` evidence fields are gone (they were always null under the new rule).
- Fixtures for the offline signal must send null for `active` and `daily_tech`, never an unchanged number or 0.
- `isNewMember` takes an optional `days` (default `NEW_MEMBER_DAYS`, 14). The offline signal passes `OFFLINE_GRACE_DAYS` (7).
- `DayValue` now has `"none"` (a read lists the member and sent null). Code that reads `weekDonations` must treat it as "none that day": not a number, not missing data.
- Seed for Members shots with the D127 shapes: scratchpad `458/seed.mjs`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/480
