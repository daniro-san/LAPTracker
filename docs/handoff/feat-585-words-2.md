# feat/585-words-2: one word for the daily update, and Follow-up's help on one screen (#585 batch 4, slice S2)

Part of #585 (F25) and the "first-visit fold" item of #656. Size L for the batch; this slice was planned with `/tlc-spec-lean` in `.specs/features/585-words/plan.md` (S2, criteria 14–19, Validation (e) to (h)) and `checks.md` (C10–C16).

## Built

- **"daily update" for the end-of-day read**, on the desk, the board, Me and the officers' notification. PT "atualização diária", FR "mise à jour quotidienne". It replaces "read", "reading", "leitura", "relevé", "lecture" and "mise à jour du jour".
  - Members' week line: "no daily update on {days}, not in the total".
  - Me:
    - "Your might and kills on each daily update of the last 30 days." and "Your chart starts after two daily updates."
    - "No daily update that day: it never counts." and "“none”: that day’s daily update listed you with nothing sent."
    - A day cell reads "No daily update"; a day still to come reads "no daily update yet".
  - Insights: the lead, the rules, the pulse, effort, flow, tenure, KvK and squads lines. A week bar's note reads "5 daily updates" (it read "5 reads") or "no daily update".
  - The status bar:
    - "Today’s daily update failed · the cards keep the last numbers"
    - "Today’s daily update is late · …" (it said "roster")
  - Alliance settings: "They are read after the daily update."
  - New members (PR review): "New · waiting for the daily update", "Their notes attach to their player after the next daily update ({time} ST).", "The daily update did not list exactly one player with this name. …", and the screenshot import's hint and group. They said "the nightly roster" (PT "lista da noite", FR "liste de la nuit").
  - Notifications: the setting is labelled "Daily update failed". The notification reads "Daily update failed" · "Tonight’s daily update and its retry failed. Nothing to do: the desk keeps the last numbers and tries again tomorrow."
  - FR Follow-up's empty state: "mise à jour du jour" becomes "mise à jour quotidienne".
- **Kept, other concepts:**
  - the Raid Shield check's "reading";
  - the tracker's squad reads;
  - a KvK's "Start read" / "End read";
  - "Reads from the tracker";
  - the export's per-member reads;
  - every verb.
  - Stored keys are unchanged (`night_read`, `insights.pulse.noRead`, `week.noRead`, `me.week.noRead`).
- **Follow-up's "How this list works" is closed on every visit**, the first too.
  - It is now a plain `<details>` in `FollowUpWeek.tsx`. `FollowUpHelp.tsx` (the client component that wrote the cookie) is deleted.
  - The page no longer reads cookies. `FOLLOW_UP_HELP_COOKIE` is removed from `lib/private/cookies.ts`.
  - The summary "Tap a name to write down what they said. How this list works" stays in sight.
  - One tap shows two lines. First, D140's line, now "Say hello, write down what they said, mark how it went." (it dropped "Nothing is sent for you."). Second, the owner's line, word for word: "These are notes for you. Nothing is sent and nobody is removed from the alliance."
- **Tests:**
  - New guard in `lib/private/dictionary.test.ts`: each of the 40 lines that name the daily update says it with the one term, in all three languages, and no value holds a form that only ever meant it. Put back one at a time, each of these fails it: EN "No reading", "not read yet", "{n} reads", "New · waiting for the nightly roster"; PT "Sem leitura", "ainda não lido", "{n} leitura"; FR "pas encore lu", "{n} relevé", "Nouveau · attend la liste de la nuit". A wider pattern was not used: the shield lines still say "no reading", "not read yet" and "sem leitura".
  - Rewritten in `FollowUpWeek.test.ts`: the help is closed, with both lines inside.
  - Assertions changed with the words: `read-status`, `me-parts`, `insights-kvk`, `push-uses`.
  - The `help` prop is gone from `follow-up-groups.test.ts`.
  - e2e `desk-flows.spec.ts`: on a first visit the help is closed; a tap opens it and shows the owner's line; it is still closed after the reload.
- **Docs:**
  - Dated amendments (2026-11-22) to D104, D140 and D73 (the help and the cookie), and to D139, D142, D146, D148, D135, D132 and D106 (the word).
  - The glossary's "daily read" row now names the PT and FR words.
  - A "Changed" line in the tracking plan.
  - S2's criteria, checks and validation in `.specs/features/585-words/`.

## Decisions

- **Option A (closed on every visit), not B or C.**
  - A first-glance test at 360 × 780 asked "Who should I offer help to after this KvK?":
    - today's first visit: 4 right, 1 partial, 1 wrong;
    - B (open with the owner's line only): 4 right, 1 partial, 1 wrong; it still pushes the title below the fold;
    - A: 6 of 6 right.
  - Officers voted A 4, C 2 (the owner's line also at the foot), B 0.
  - Product strategy picked A: C prints the line twice where few officers scroll.
- **"{n} daily updates", not "{n} days", on Insights' week bars.**
  - Product strategy marked it MUST, and 2 officers asked for it: "5 days" reads as days played or days left. S1b's panel saw the same misreading.
  - The PT and FR experts preferred "dias"/"jours". Their other strings were adopted as written.
- **EN kept "a day with no daily update"** rather than the experts' "a day without one": it reads more clearly to second-language readers.
- **Basis:** plan Validation (e) to (h). All verdicts were approve or approve with changes, and every change was adopted or recorded there. No one-way door was found. The standing approval applies.

## Deviations

- Criterion 18 holds in English only. In PT and FR the KvK title is below the fold on every visit with this seed (y 739 PT, 763 FR; the tab bar starts at 723), because the header and the jump link wrap. The jump link is in sight in all three languages. The task asked for the groups to stay on the first screen; this change makes a first visit's first screen the same as a return visit's, which is what the help controls.
- The adversarial reviewer found Alliance settings' "after the daily roster". It also names the daily update, so it changed too (D132 amended).
- The PR review (MUST) found the new-member lines still saying "the nightly roster", D106's "one term". A quick check (an officer reading English as a second language, and the PT-BR and FR copy experts, on invented data) kept the new-member meaning with "daily update" in all five lines and asked for one EN change: the banner says "did not list" instead of "did not have". PT and FR strings are the experts'. D106 amended.

## Verified

Review round (PR 669): the numbers below the S2 build's are from the run after the review fixes.

- `pnpm vitest related --run lib/private/dictionary.lifecycle.ts lib/private/dictionary.test.ts`: 68 files, 352 tests passed.
- `pnpm check`: exit 0 (1753 passed, 4 skipped), first round, no fixes needed.
- e2e not run again: the review round changes no text an e2e test asserts (no e2e names these lines).

S2 build:


- `pnpm vitest related --run <changed>`: 121 files, 709 tests passed.
- `pnpm check`: exit 0 (1753 passed, 4 skipped; prettier, eslint, tsc, drift, i18n). No public string changed, so translate-copy was not needed.
- `pnpm test:e2e`: next build, its own Postgres 18 cluster on 127.0.0.1:54396, app on 3496, bridge on 54397. Result: 51 passed, 3 skipped (single-project tests). `E2E_WEBKIT=1` was not run: the changed e2e flow is not in the `iphone` project.
- First-screen measurements: a scratch Playwright spec on the e2e seed at 360 × 780 measured the "After KvK, offer help" title's top on a first visit. EN went from 788 before to 695 after, the same as a return visit, with the tab bar at 723. The spec is not committed.
- FR Insights' week bars and FR Me were checked at 360 px. On Insights the value and note wrap under the label, with no overflow.
- `validate_plan.py` and `validate_checks.py`: 0 errors.
  - Plan warnings: 2, carried over from S1.
  - Checks warning: 1, on C15. It fires on "works" in "How this list works".
- Not run: the tlc-spec-lean Verifier and `check_proofs.py` (C16 needs the e2e cluster). Left for the PR review.

## Open issues

- PT and FR: the KvK title is below the fold on every visit with the seed's Needs help row. In FR the jump's "↓" wraps onto its own line (officer SHOULD).
- "Daily update failed" can read as an app update at a glance (2 officers). The line's second half explains it; it was kept.
- Me's "none" legend says "nothing sent". A member asked "sent what?". The wording predates this slice and was kept.
- `.specs/features/585-one-worklist/checks.md` C27 still describes the help as open on the first visit. Its proof names a test title that no longer exists, so `check_proofs.py` on that folder will fail. That spec is historical and was not edited.
- The new-alliance guide: its Follow-up screenshots may show the help open. Retake them after release (standing rule).
- From the PR 669 review, left as follow-ups: criterion 18's proof is a local screenshot measurement, not a committed test; the PT and FR notification strings (`lib/copy-push.ts` `nightTitle`, `nightBody`) have no test (only EN's title is asserted). C11's proof was fixed by splitting it: C11 the failed line, C17 the late line.

## Next

Remaining slices, in order (plan `.specs/features/585-words/plan.md`):

1. **S1b** F19, one average rule (`dayAverage`), after the owner's answer on #663.
2. **S3** Notices and Thefts words (F30, F43). Translating titles may add AI requests: size it then.
3. **S4** French and Portuguese terms (F44), plus the article-before-a-date sweep and lowercase after a colon on Me. Add from this slice:
   - KvK's gender between Me and Insights;
   - FR "might" vs "puissance";
   - straight apostrophes in three EN KvK lines;
   - the bare "na última atualização" / "dans la dernière mise à jour".
4. **S5** Members head and Former members (F45, F47).
5. **S6** Start here (F46).
6. **S7** /admin's date forms, with /admin's "Daily roster read", "First read" and "Setup: no read yet" (with #392 if that batch runs first).

Follow-ups from this slice:

- A shorter PT and FR Follow-up head (a no-break space before "↓", a tighter week line), then the KvK first-glance test again in PT and FR (product strategy).
- The owner's line as a Follow-up card in the first-use steps (`lap_ws_intro`), so a new officer reads it once without a second cookie (product strategy).
- After release, read-only:
  - the share of Follow-up records that are not "Talked to them", and the share with a note;
  - the KvK group's share with a record in its week;
  - in masked replays of officers' first Follow-up views, how many open the help.

Analytics: change. A dated "Changed" line says the help is closed on every visit and `lap_ws_fu_help` is retired, with what to read across the date. No event or property is added, changed or removed.

What was missing from the task prompt? That in PT and FR the KvK title is below the fold even on a return visit with the e2e seed, so no change to the help alone can put it on the first screen there.

PR: https://github.com/daniro-san/LAPTracker/pull/669
