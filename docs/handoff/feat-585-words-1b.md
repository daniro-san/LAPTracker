# feat/585-words-1b: one average rule for the member card, Me and Insights (#585 batch 4, slice S1b, F19)

Part of #585 (F19). Closes #663. The owner's decision on #663 (2026-11-22): "yes, go with the recommendation". Planned in `.specs/features/585-words/plan.md` (S1b, criteria 20 to 25) and `checks.md` (C18 to C22).

## Built

- **One rule, `dayAverage`** (`lib/private/member-days.ts`). It averages over the days whose daily update lists the member. A "none" day counts as 0. A day with no daily update (null) and a day still to come are left out. It returns `{ value, days, none }`, or null when no day lists the member.
- **One set of words, `averageLine`** (same file):
  - "Average 400 · 6 days, of which 2 none" (PT "Média 400 · 6 dias, dos quais 2 sem nada", FR "Moyenne 400 · 6 jours, dont 2 sans rien");
  - with no "none" day, "Average 589 · 4 days" as before;
  - every listed day "none": "None on all 7 days" ("Nada enviado nos 7 dias", "Rien sur les 7 jours"; one day "None on 1 day", "Nada enviado em 1 dia", "Rien sur 1 jour"), never "Average 0".
- **Callers:**
  - the member card's Last 7 days (`rowOf`);
  - Me's This week (through the card) and Last week (`weekCard`; `averageOf` is gone);
  - Insights' effort (`effortsOf`). `Effort.quests`, `coins` and `tech` are now `DayAverage | null`, and the medians and Quiet contributors read `.value`. No number on Insights changes.
- **Me's legend** gains "A “none” day counts as 0 in the average." (`me.week.legendZero`, PT "Um dia “nada” conta como 0 na média.", FR "Un jour « rien » compte pour 0 dans la moyenne.").
- **Dictionary keys** (`lib/private/dictionary.card.ts`): `card.days.withNone`, `card.days.allNone.one`, `card.days.allNone.other`, in EN, PT-BR and FR.
- **Tests:**
  - `lib/private/day-average.test.ts` (new, PGlite): the card (`memberCard`), Me (`meView`) and Insights (`effortsOf` on `endOfDayReads`) agree on the same rosters. They give the same average and the same count of "none" days in all three rows, a member with only "none" days reads "None on all 6 days", and the day with no daily update is "—" on both pages.
  - `member-days.test.ts`: the averages under the new rule, plus the all-"none" week.
  - `me-parts.test.ts`: the new lines, plus the no-update week and an all-"none" last week.
  - `insights-rules.test.ts`: the effort carries its "none" count.
- **Docs:** dated amendments (2026-11-22, the owner's decision on #663) to D136 (its average sentence), D139 (its "This differs" paragraph), D142 (Me's week lines and legend) and D127 (its 2026-11-20 amendment's average sentence); the tracking plan's dated line; the spec's S1b section, approval line and checks.

## Decisions

- **"of which" / "dos quais"** were added to the owner's quoted "6 days, 2 none". In the persona panel (invented data, 360 px), the officer who reads English as a second language could not tell whether the 2 were among the 6. French "dont" already says it.
- **PT "Nada enviado nos {n} dias"**, not "Nada nos {n} dias". The member persona read a bare "Nada" as a verdict on them (D75). "enviado" matches the legend.
- **Me's legend line** (criterion 25): without it, a member who adds up their own bars gets a different number than the line.
- **One `withNone` key, not `.one`/`.other`**: the PT and FR experts found the same wording for 1 and for more. The plan's criterion 5 had asked for both.
- **Amendments, not a new decision**: the owner's comment and the task ask for a dated amendment to D136. The plan's old criterion 5 said "a new decision"; criteria 20 to 25 replace it.
- **Insights' effort carries the count of days and of "none" days**, so the agreement test compares the none count on all three pages, as the task asked. Nothing on the Insights page shows it.
- **Private fields:** no new field and no new reader. The card stays under `requireWorkspace` and Me under the approved link (D142). Insights already read these daily values from the same rosters. No query is added, per member or otherwise (D149): the three pages read the same rows as before.

## Deviations

- Plan S1b criterion 2 said "Me's last week". The PGlite test uses Me's this week, because that week is the same seven days as the card's on a Sunday. Last week's line is covered by `me-parts.test.ts` (C21).

## Verified

- `pnpm vitest related --run <changed files>`: 75 files, 375 tests passed.
- Mutation checks, each reverted afterwards:
  - "none" left out of `dayAverage`: C18 to C22 failed (5 tests);
  - a no-update day counted as "none": C18, C19 and C21 failed;
  - the all-"none" line removed: C18, C20 and C21 failed, printing "Average 0 · 7 days, of which 7 none";
  - Insights alone treating "none" as no update: C18 and C22 failed.
- `pnpm test:e2e` (local, `next build`, own cluster on 54396, ports 3496/3497/54397): 51 passed, 3 skipped. No e2e assertion changes: the e2e seed sends a number every day, so its average lines read as before.
- `pnpm check`: exit 0 (prettier, eslint, tsc, 1754 tests passed and 4 skipped, drift, i18n) after two fix rounds: prettier on three files, then the new test's complexity (its setup moved into two helpers).
- `validate_checks.py`: 0 errors, 10 warnings (selector warnings like S1's).
- `validate_plan.py` (installed ckl-delivery 2.0.5): 5 errors, the same 5 on dev's plan before this change. They are missing sections (Traceability, Observable, Flow, Relations, Impact) that a newer template asks for.

## Open issues

- **Rebase with PR #669 (S2):** both PRs edit `.specs/features/585-words/checks.md` (the Run line, the count line and new sections after C9), `plan.md` (new sections), `docs/analytics/tracking-plan.md` (a dated line at the end) and `lib/private/me-parts.test.ts` (S2 renames the first test and changes its "not read yet" line; this PR changes the average lines under it). Keep both sides. S2 renames `me.week.noRead` to "No daily update"; this PR's tests do not assert that word.
- The adversarial reviewer's "<1" for a non-zero average that rounds to 0 is not built (for example "Average 0 · 7 days, of which 6 none" for 1 point among six "none" days). It is a new display rule, and the line already names the "none" days.
- The member card on the desk has no legend for "none" counting as 0. The line names the "none" days; the panel did not ask for one.

## Next

Follow-ups:

- "<1" for a non-zero average that rounds to 0, if the owner wants it.
- After release, watch for officers saying the card's numbers "dropped" (the tracking plan's line): that is the rule.
- Remaining slices of the plan: S3 to S7, in the order the S1 handoff gives.

Analytics: no change (dated line in `docs/analytics/tracking-plan.md`). No event or property carries an average.

What was missing from the task prompt? That PR #669 also appends to the tracking plan's "Changed" list and edits `me-parts.test.ts`, so a rebase conflict is certain there; and that the installed `validate_plan.py` is newer than this plan's template.

PR: https://github.com/daniro-san/LAPTracker/pull/672
