# feat/585-after-kvk-help: Follow-up offers help after a KvK, counted on Home and Members, linked from Insights (#585 batch 3, slice 5)

Part of #585 (F3). Size M: a rule change across Follow-up, Insights, Home and Members. Planned with `/tlc-spec-lean` in the same feature folder as S1 to S3: `.specs/features/585-one-worklist/plan.md` ("S5 plan", criteria 40–47, Validation (l) to (p)), checks C43–C52 in `checks.md`, proofs in `proofs.md`.

## Built

- **"After KvK, offer help · n"** ("Depois da KvK, ofereça ajuda · n", "Après la KvK, proposer de l’aide · n"), Follow-up's second group, after Needs help and before Worth a hello.
  - Who is in it: the current members of the newest KvK's help list, by Insights' own rule (`kvkOf` `help`: lost more than 25% of their Start might, under 80% of it now). Members on a break are left out. Members marked Needs help stay under Needs help, and their row gets the KvK line. A member also leaves the group once anyone writes a record about them this week or after the KvK's End read began (`kvkOpen`).
  - When it shows: from the KvK's night read for 7 server days from its day (`afterKvk`, `KVK_HELP_DAYS`), so through the Friday after. On the next KvK day it is gone until that KvK's read.
  - The hint under the title: "Lost over a quarter of their might in the KvK of {date}, and still below 80% of what they had. Here for the week after it, or until someone writes down what they said." The group's rows leave out the KvK line, because the hint says it.
  - The panel's "Why they’re on the list" and a Needs help row say "Still rebuilding after the KvK of {date}." The ready message starts with the existing "How did KvK go for you? Anything we can help with?".
  - No number appears beside a name anywhere.
- **The head** gains "{n} to offer help after the KvK ↓", a jump to the group's heading (`#follow-up-kvk`, `scroll-mt-4`).
- **Home and Members** count the group through `followUpCounts` and `weekLists`. `weekLists` now takes the rows of the whole window and splits them itself. `followUpCounts` reads `followedUpSince` from the earlier of this Monday and the window's first day, beside one `scheduledEventMight`.
- **Insights** keeps its help list. It adds "Offer help: Follow-up ›" under the names while the group has someone in it (`kvkGroupOpen`). That read runs only while the Follow-up tab is on and the KvK is in its week.
- **Code:**
  - `lib/private/follow-up-kvk.ts` (new): `kvkEvents`, `kvkHelp`, `recordsSince`, `kvkGroupOpen`.
  - `insights-kvk.ts`: `afterKvk`, `KVK_HELP_DAYS`, and `afterAt` on `KvkEvent`.
  - `follow-up-rules.ts`: `kvkOpen`, `sinceMonday` (moved there), and `worklist`'s `kvk`.
  - `follow-up.ts`: `weekLists`, `followUpCounts`, and `FollowUpView.kvkDay`.
  - `follow-up-groups.ts`, `FollowUpWeek.tsx`, `FollowUpList.tsx`, `InsightsMore.tsx` (`HelpList`), `insights.ts`, `ready-message.ts`, `card-follow-up.ts`.
- **Words:** 7 keys in `dictionary.followup-help.ts`, in EN, PT-BR and FR.
- **Docs:**
  - Amendments dated 2026-11-22 to D104 (the group, its week, the noted rule, the head, the counts, the card's blind spot), D139 (Insights' link) and D140 (the ready message's first line).
  - A "Changed" line in the tracking plan.
  - The plan's S5 section, criteria 40–47 (22 marked superseded), checks C43–C52, proofs.
- **Tests:**
  - `lib/private/follow-up-kvk.test.ts`, new, 3 PGlite tests: the week and who is in the group; the noted rule across Monday, with Undo and Home's numbers; Insights' link.
  - `follow-up-groups.test.ts`: 1 new test.
  - `FollowUpWeek.test.ts`: 1 new test.
  - `e2e/desk-kvk.spec.ts`, new, 1 test: the group, the jump, Insights' link.
  - `e2e/desk.spec.ts`: Home's number with the member counted, and the Members head's number.
  - The e2e seed gives Lantern Keep's k=4 (Fennick Lowe) a 10M heavier loss at the last KvK and on every read after it (`HEAVY_HIT`, `hitOf`). `atEvent`, `eventTotals` and `rosterOf` include the loss.

## Decisions

- **The group's week: the KvK's night read through the Friday after.** 5 of 6 officers chose "until the next KvK, at most 7 days". Product made it a MUST to use the same week as Insights' recovery week.
- **A record written after the KvK takes the member out until the week ends**, whatever the answer. 4 of 6 officers and product chose this: one offer of help, not a weekly reminder (D75). The other groups keep the Monday rule.
- **Needs help first, then After KvK, with a jump in the head.** First-glance round 2 (Validation (l)):
  - With the KvK group first, 6 of 6 answered "who to offer help" right, but none answered "who needs help this week" right, and 2 of 6 thought an officer had marked the three.
  - With Needs help first and the jump, 5 of 6 answered both right. The designer and product also picked Needs help first.
- **Home's and Members' numbers count the group**, as one number (4 of 6 officers; the task).
- **Insights keeps its names** (4 of 6 officers and the designer). The link shows only while the group has someone in it (designer MUST). The link has no count. Product preferred the link alone; that was not a MUST of theirs.
- **Copy:**
  - Title (1) and row line "Still rebuilding…" (4 of 6 each).
  - The hint has no "note": in French "noter" reads as "to grade" (panel MUST).
  - "for the week after it" replaces "until the next KvK" (adversarial SHOULD: a skipped KvK still ends the group).
  - PT and FR use "poder" and "puissance" for might, as Insights does.
- **Cost (D149).**
  - On the e2e seed, the events read takes 194 buffer hits and 0.21 ms. `followedUpSince`, from 7 days back, takes 4 hits and 0.11 ms.
  - D139 measured the same events statement on a year of invented data: 91 buffers, 0.19 ms, with a 36-day bound; this read's 6-day bound is shorter.
  - Home and Members gain one query per load, run in parallel with the follow-up read.

## Deviations

- Criterion 22 (S1's sketch) said Insights' list should become a link "instead of being a list of its own". The panel kept the names, and criteria 40–47 replace it.
- The S5 e2e test is in its own file, `e2e/desk-kvk.spec.ts`. It does not extend the Home test in `desk.spec.ts`, which would pass the 300-line lint limit.
- `sinceMonday` moved from `follow-up.ts` to `follow-up-rules.ts`, and the KvK helpers went to `follow-up-kvk.ts`, because `follow-up.ts` passed the same limit.
- `worklist` filters resolved members first: the complexity limit.

## Verified

- `pnpm vitest related --run` on the changed files: 71 files, 351 tests passed.
- `pnpm check`: exit 0 (prettier, eslint, tsc, 330 test files and 1728 tests, drift, i18n).
- `pnpm test:e2e`, the whole suite on a production build with its own Postgres (127.0.0.1:54395, app on 3495): 49 passed, 3 skipped (by design). Then `desk-kvk`, `desk` and `desk-flows` with `--repeat-each=3`: 57 passed, 9 skipped. The server day was Sunday, so the KvK-week branch ran; the Saturday branch did not run here. The cluster was stopped afterwards.
- Panel after the build, on real 360 × 780 shots (Validation (p)):
  - Return visit: Q1 5 right and 1 partial; Q2 6 of 6.
  - First visit: 4 right, 1 partial, 1 wrong.
  - Insights' card: 5 right, 1 partial; 6 of 6 saw no blame.
- Walked: 360 light and dark (fold, full, after the jump), Insights' card in light and dark, 1280 with the panel. Not walked: 768/1024/1440, WebKit, a long-word language.

## Open issues

- **First visit: S3's open "How this list works" pushes the KvK group's title below the fold** (after-build MUST, 1 wrong). The jump line stays in sight. The help's first-visit state and its lines are S3's and the owner's (D104, D140), so this needs its own change and copy test.
- **The member card does not know the group.** For a member who is only in it, the card's week line is empty, its message has no KvK line, and a "Talked to them" from the card sends `on_list` false. Fixing it means a KvK read per card (written in D104's amendment).
- **A member written about on the Sunday after the KvK** is on no card on Monday: neither the group nor "Noted this week" shows them (product SHOULD: "3 already noted since Sat, Nov 21").
- **On the KvK's night read**, "now" is the End read, so a heavy KvK can put many members in the group at 23:30 (adversarial NOTE; Insights' list does the same).
- **Wording the panel flagged, kept as decisions quote it:** the help's "Nothing is sent" said twice, "for you", "nobody is removed" and "mark how it went". Insights' "maybe offer help", "under 80%" and "a hand may help" differ from Follow-up's words. On Insights, the name link and "Follow-up ›" look alike.
- **PostHog:** no access here; click autocapture is off on `/w`. See the tracking plan line for what to measure.
- **Guide:** Follow-up gains a group after a KvK. The next guide refresh could show it.
- **Patch notes:** on release day, Home's and Members' number rises by the members still under 80% after the last KvK.

## Next

- Merged with S4 (PR 652) by a merge of `dev`: Home's assertion is S4's card with S5's count. The count is `toLookOf` in the new `e2e/fixtures/follow-up-list.ts`, shared with `e2e/desk-kvk.spec.ts`. Members' head assertion moved to `desk-kvk.spec.ts` so `desk.spec.ts` stays under 300 lines.

- **Batch 3 is complete with this PR**, with S1 to S3 and S6 merged and S4 in PR 652. Batch 4, the words pass in EN, PT and FR, is next. It can take:
  - the help's lines and first-visit layout (the after-build MUST above);
  - S1's "noted" words ("noter" reads as "to grade" in French);
  - S2's "Last week: … Talked to them" as a sentence;
  - "Same for all n:" (2 of 6 asked for "All n:");
  - Insights' KvK words, aligned with Follow-up's.
- Follow-ups from this slice:
  - the member card reads the KvK, or says nothing about the week for such a member;
  - "{n} already offered help since {date}" under the group (product SHOULD);
  - measure, read-only, per workspace and KvK, no names: the share of the group with a record inside its week, by answer; the median time from the night read to the first record; members with records from two or more officers.
- Merge note: PR 652 (S4) also edits `e2e/desk.spec.ts` and the spec files. This PR's `desk.spec.ts` change is the `TO_LOOK`/`followUpLine` constants and two assertions. Rebase whichever lands second and run `pnpm check`.
- Plan change: none to `docs/IMPLEMENTATION_PLAN.md`.

What was missing from the task prompt? Whether Insights' names should stay: S1's criterion 22 said "instead of a list of its own", the task said "Insights links to the group", and the panel decided.

PR: https://github.com/daniro-san/LAPTracker/pull/655
