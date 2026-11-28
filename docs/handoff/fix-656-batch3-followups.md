# fix/656-batch3-followups: what #656 still left open (#656)

Part of #585. Checked each open item of #656 against `origin/dev` (9ba8c840) before building.

## Built

- **Member card and the KvK group.** `cardFollowUp` now reads the KvK like Follow-up's list: it reads the KvK events (`kvkEvents`), takes the group with `kvkHelp` and `kvkOpen` over the member's own records, and passes that set to `worklist`. A member only in "After KvK, offer help" now gets the "This week: no follow-up note yet." line, the "How did KvK go for you?" opener in the ready message, and `onList` true (so a Talked from the card sends `on_list` true). `kvkHelp` takes `Pick<MembersView, "reads">`, since the card has the reads but not the view.
- **Last week's line.** "Last week: {line}" is now "Recorded last week: {line}" ("Registrado na semana passada: {line}", "Enregistré la semaine dernière : {line}"), so it reads as a record. Updated `lib/private/follow-up-rules.test.ts` and `e2e/desk.spec.ts`, and added an amendment to D104 (D104 quoted the string).
- **Test:** one test in `lib/private/follow-up-kvk.test.ts`: the card of a KvK-only member agrees with the list (week line, `onList`), a member outside the group has no line, and a record after the KvK takes the card's `onList` back to false.
- **Docs:** `docs/analytics/tracking-plan.md` "Changed": slice 4's line now sits before slice 5's. `CONTRIBUTING.md` e2e paragraph: names the HTTPS server on 3478 (`E2E_WEBKIT=1`) and that `openssl` is needed.

## Decisions

- Wording "Recorded last week:" chosen over a sentence form ("Last week, Tomas talked to them"): a sentence form needs per-action grammar in three languages and its own copy test. "Recorded" keeps the line's parts and C19's shape. No persona panel was run for it; the issue's own measure (2 of 6) is the basis.
- The card passes the member's live records (newest first, reversed) to `kvkOpen`; `resolvedBy` over live records gives the same set as over the raw rows with withdrawn ones.

## Deviations

- Skipped, already done on `origin/dev` (#659, 43790116): the `kvkOpen` "record earlier this week, before the End read" test, the activity fold tests (across "Show more" with two officers, and on a server day outside UTC), the `ph-no-capture` / `aria-describedby` and `sharedOf` tests, Home's waiting count, the head's KvK count, the Needs help reads.
- Skipped, obsolete: criterion 17's cookie test. D104's batch 4 S2 amendment (2026-11-22) closed "How this list works" on every visit and removed the `lap_ws_fu_help` cookie, so there is nothing to test. The first-visit fold item is also done by that amendment.
- Not changed: `.specs/features/585-one-worklist/plan.md` and `checks.md` still quote "Last week: …" (C17 and C19 are historical spec text). The plan's criterion 42 (French jump text) was not touched either.

## Verified

- `pnpm vitest related --run` on the changed lib files: 123 files, 714 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).
- The e2e spec change (`e2e/desk.spec.ts`) was not run (needs the local cluster and a browser).

## Open issues

- Writing a note (S3): the measurement of non-"Talked" records and records with a note is analytics, not built; still open on #656.
- Needs help history read has a bound now (#659); nothing else open from the Reads item.

## Next

- Close the rest of #656 by hand once the measurement is decided or dropped.
- Plan and checks text for C19 and criterion 42 can be refreshed in `.specs/features/585-one-worklist/`.

What was missing from the task prompt? Which of the issue's items had already been merged by #659 and batch 4.

PR: (added by the orchestrator)
