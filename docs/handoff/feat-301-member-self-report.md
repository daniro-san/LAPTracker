# feat-301-member-self-report — a member tells their officers their own AD Tech, time zone and languages

Closes #301 (the self-report part the triage scoped; the issue's other "later" items stay listed in D105). Size M. Plan: `.specs/features/301-member-self-report/plan.md` (Approved: the owner, 2026-11-22). Decision: D154.

## Built

- **Me, "Tell your officers"** (`app/(private)/_ui/MeSelfReport.tsx`, first in Me's main column): Alliance Duel tech (%), time zone (the facts editor's picker, "Use this phone's time zone (London)", Clear) and languages (chips in their own words and the reader's). Filled with the member's own last send, never the officers' value. Under each field: "You sent this on Sun, Nov 22 · not seen yet" / "· an officer has seen it" / "You took back what you sent, …". The Send bar stays in view with "Not sent yet: 1 change". One request id per send.
- **Member route** `POST /api/w/[slug]/me/facts`: `requireBoard`, the board feature, an approved link (`403 not_linked`), the member in the newest roster (`409 left`), strict zod body with no uid, request once (D100), 20 sends a day per workspace user (`auth_attempts` key `day:selfreport:<user>`, `429 too_many`), per-field version (D80) with `409` and the stored state for a stale tab, a same-value send stores nothing and stays seen. Through `privately`.
- **Officer route** `POST /api/w/[slug]/members/[uid]/self-report`: `use` ("Put on the card": the fact's next version, source `member`, refused with 409 when any officer saved since, languages included) or `seen` ("Seen, keep the card"). Names user, field and version; `404 changed` when the report changed or the writer no longer holds the approved link; `409 removed` for `use` on a take-back. `ws_action` `self_report` / `accept` or `mark`.
- **Card** (`SelfReportCard.tsx`): a tinted "Sent by the member" block in the header while a report is new, both values labelled ("Member says: …", "On the card: …" / "nothing yet" / "Same as on the card."), "Self-reported · day", "New", the two answers. A seen report that differs shows under the fact on Info: "Member says: … · day · not on the card". Accepted facts show "from the member".
- **Home** "To review": "‹player› sent their own info: Time zone, Languages", linked to the card; members in the newest roster only; not in the tab's number.
- **Data**: migration `0070_member_self_reports` (table, one row per user and field; `member_facts_source_check` replaced to allow `member`). `lib/repo/self-reports.ts`, `lib/private/self-report.ts`, `saveMemberFact` in `member-facts.ts`. The download gains `member-self-reports.csv` (no request id); the purge deletes the rows and the counter.
- **Copy**: EN, PT-BR, FR in `lib/private/dictionary.self-report.ts`; `src.member`.
- **Analytics**: `ws_self_report_sent` `{change: save | remove}`; `ws_action` `self_report` `accept` / `mark`; tracking plan, insights and the go / no-go measure.
- **Docs**: D154; dated amendments to D80, D105, D142; glossary "self-report".
- **Tests**: `me/facts/route.test.ts` (9, member side), `members/[uid]/self-report/route.test.ts` (5, officer side and the card block), shared `me/facts/self-report.test-helpers.ts`; `member-session.test.ts` excludes the member route with its reason and has the officer route's fixture; `e2e/self-report.spec.ts` (phone, the repeat's own filler workspace, `selfReportOf` and `selfReportRows` in the seed); the export, purge and ToReview tests take the new table and prop.
- `Details` and `MapPosition` moved unchanged from `MemberCards.tsx` to `MemberCardTabs.tsx` (the file passed 300 lines after dev's shield block).

## Decisions

- Kept apart in its own table rather than a `member_facts` source: `latestFacts` would make a member's value the newest at once, over an officer's and into every screen (D75). Keyed by workspace user, shown only for the user holding the approved link now and not blocked, so a removed link or an impostor's sends never reach the card.
- One row per user and field (newest only): bounded (D149); accepted values keep their history in `member_facts`.
- "Put on the card" refuses any stale fact version, languages too (D80 would combine; a combined list is a value nobody saw).
- Home lists reports but does not count them in the tab's number: that number is read on every desk page and would need the roster there.
- D154, not D152/D153: D152 and D153 are taken by other branches (D153 on dev). Migration `0070_member_self_reports` was regenerated with `drizzle-kit generate` on top of #306's 0069: journal idx 70, the snapshot's prevId is 0069's id, its `when` is after 0069's; `check-drift` is clean.
- The `member_facts_source_check` swap stays a plain drop and add, as `0041_squads.sql` did: `scripts/migrate.ts` runs each migration in one transaction, so `NOT VALID` then `VALIDATE` would still hold the lock through the scan (D154).
- "Put on the card" refuses any fact-version mismatch at the write (`saveMemberFact` no longer goes through the officer write's merge), so a save landing between its read and its write is refused, never combined (review of PR 684, finding 6).

## Deviations

- Criterion 22 changed from the plan's first draft: Home's number does not count reports (reason above).
- The tlc-spec-lean `checks.md` / `proofs.md` / Verifier phases were not run: the task's process named the plan, the panel, the tests and the deliberate breaks, which were done. The plan is validated (`validate_plan.py`: 0 errors).

## Verified

- `pnpm vitest related --run` on the changed files, then `pnpm check`: exit 0 (1799 passed, 4 skipped; drift, i18n). Again after the rebase on `origin/dev`.
- Deliberate breaks (each reverted), each failing its test: uid from the request; a pending link let through; the left check; request once; the limit; the stale-tab version guard; a stale fact version; the "approved" condition of the link join; the same-value no-op; "seen" writing a fact; a report written into `member_facts`; `member` source written as `officer`; the card's "Member says" label. Two tests were tightened after a break first passed (stale tab on the update path; link back to pending).
- E2E (local production build, worktree Postgres on 54391): full suite 54 passed, 4 skipped; earlier `--repeat-each=3` 156 passed; the new flow `--repeat-each=3` 3 passed. Break "Seen, keep the card answers ok without storing it" fails the flow at the block-gone check after the reload (that check now waits for the card's tabs, so a card still loading cannot pass).
- Panel (invented data): plan review by six officers + data honesty, three members + product, privacy/security + adversarial: all approve with changes, MUSTs applied (plan § Validation). First-glance at 360×780: round 1 member 4/5, officer 6/6, 5/6, 4/6; round 2 after fixes member 5/5, officer 6/6 on all four questions; no confident wrong answer.

## Open issues

- First-glance SHOULDs not done: Send off until something changed (today it answers "Nothing new to send yet."); room under the sticky Send bar and under the card's sticky bar; "Seen, keep the card" could say the item leaves To review; "Paste what they told you" next to the block could be read as related.
- The member's time zone is stored as the browser or picker gives it; `Intl` accepts any letter case (D80's own validation, unchanged).
- An officer's own approved link lets them send "as the member" for their own player; the card's link line names who is linked.

## Review of PR 684 (2026-11-22)

- Fixed: the migration regenerated on 0069 (finding 1); "Put on the card" refused at the write, with a PGlite race test (an officer's save hooked in right after the version read: 409, nothing stored, the report still new) (6); a blocked writer's reports hidden from the card and Home, and the seen mark's own blocked check tested by blocking the writer between the officer's read and the mark (8); "Put on the card" on a take-back is 409 `removed`, and a null send is stored (4); out-of-range values are 400 (3); the e2e puts the languages on the card and asserts the Info tab after a reload (5); `selfReportLimitKey` uses `DAY_KEY_PREFIX` (7). The card-labels test that the split had copied into `me/facts/route.test.ts` is gone (12).
- Each new test was checked by breaking its rule: the blocked filter in `heldNow`, the one in `markSeen`, the old pre-read-then-merge path, the removed check, the language minimum, the AD range, and the e2e "Put on the card" answering ok without writing.
- After these fixes, on the rebased branch: `pnpm vitest related --run` 408 passed; `pnpm check` exit 0 (1850 passed, 4 skipped; drift clean); full e2e 56 passed, 4 skipped (worktree Postgres on 54393); the self-report flow with `--repeat-each=3` 3 passed.
- Left as follow-ups: a rendered test of Home's To review line (2); the plan's stale Shape step 5 and Surface table (9, 10); `SelfReportCard`'s discarded `res.json()` (11); the `data.file.member-self-reports` key's home (14); `selfReportWords` copying the officer card keys too (15); the day count before the roster read, and counting every attempt (16).

## Next

- Follow-ups for #301: "Put all on the card" for a new joiner; troops and an away note from the member (an away note changes roll calls by itself: needs a decision); a notification to officers (push, D148); "Still to ask" and Follow-up saying a report waits; the first-glance SHOULDs above; a per-alliance switch if an alliance asks.
- Go / no-go four weeks after release (D154): ≥ 30 % of approved-link members sent once, ≥ 70 % answered within 7 days, "Still to ask" falling.
- After release: patch notes (`lib/patch-notes.ts`) and, as Me changed, no guide screenshots are needed (not an onboarding or settings flow).

What was missing from the task prompt? Whether officers' Home number should count members' reports (decided: listed, not counted) and which migration number to use (given later by the orchestrator: 0070).

PR: https://github.com/daniro-san/LAPTracker/pull/684
