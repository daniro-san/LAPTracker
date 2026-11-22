# feat/585-home-first-screen: Home's first screen says what needs the officer (#585 batch 3, slice S4)

Part of #585 (F3 on Home, F21). Size M (Home's main flow; amendments to D104, D108 and D110). Planned with `/tlc-spec-lean` in the same feature folder as S1 and S2: `.specs/features/585-one-worklist/plan.md` ("S4 plan" and the "### S4" criteria 19–21 and 35–39), checks C35–C42 in `checks.md`.

## Built

- **A "Follow-up" card near the top of Home's main column**, after the tracker key card and before "Today and tomorrow".
  - It holds Follow-up's two numbers as one 44 px link to Follow-up, in Home's own words: "12 members to look at this week · 4 already noted by officers". Other states: "1 member to look at this week", "Nobody to look at this week · 4 already noted by officers", and "Everyone looks fine this week." (plain text, no link).
  - The numbers are S1's `followUpCounts`, already read by `cards`; nothing new is read.
  - "Members this week" no longer shows the line while the card does.
  - While the Follow-up tab is off (D126), nothing is read, there is no card, and "Members this week" keeps its old line. Before the first daily update there is no card either.
  - Code: `HomeFollowUp` and `followUpWords` in `app/(private)/_ui/HomeMembers.tsx`.
- **"1 waiting in “To review” ↓"**, right after the Follow-up card, only while something waits. It counts what the Home tab's badge counts (drafts, notice reviews for this officer, "This is me" claims) and jumps to the card. Code: `ReviewJump` in `ToReview.tsx`.
- **"Send screenshots" has a card of its own**, titled "Screenshots" ("Prints", "Captures d’écran"), right after "To review". The button and help line are unchanged. "To review" now holds only what waits for a person. Code: `SendCard` in `ToReview.tsx`.
- **A finished entry in "Today and tomorrow" is one muted line**, "12:00 ST · KvK · Ended", still the 44 px link to its day. An entry still to come keeps its two lines (`HomeNext.tsx`).
- **Recent activity folds a roll call finished by several officers into one line**: "Wren, Tomas, and 3 others finished the roll call “Cheese Trap”". It opens to each officer's line, as other runs do.
  - It folds only consecutive "finished the roll call" lines on the same roll call (by id) and server day. Any other line in between ends the fold.
  - Up to three names are written out; from four, the two newest and "and N others". FR and PT use the plural verb ("ont terminé", "concluíram"; keys `activity.marksRestMany`, `activity.others`).
  - `marksWritten` returns the roll call's id from the query that already grouped by it; `runs` uses `joins`; `feedLine` names the officers.
  - A folded line stays when its newest officer's account has no name; the other officers' lines remain.
- **Words** in EN, PT-BR and FR: Home's keys in `lib/private/dictionary.activity.ts` (the three main dictionaries were at their 300-line limit), `shots.cardHead` in `dictionary.shots*.ts`.
- **Tests:**
  - `HomeMembers.test.ts` (C35): the card's states, FR, the margin with the tab on and off.
  - `desk-activity-pages.test.ts` (C36): the fold's examples and an account without a name.
  - `HomeNext.test.ts` (C37): the one-line finished entry.
  - `ToReview.test.ts` (C38): the jump with a real pending claim.
  - `e2e/desk.spec.ts` "Home shows the alliance" (C39): the card in the main column above "Today and tomorrow", no line in "Members this week", "Send screenshots" outside "To review" in "Screenshots", no jump on the seed.
- **Docs:** dated amendments to D104 (Home's card and words), D108 (the fold, the order on Home, the one-line finished entry) and D110 (Home's button in its own card); a dated "Changed" line in `docs/analytics/tracking-plan.md`.
- **Spec:** S4 plan, criteria 19–21 and 35–39, Validation (h)–(k), the S4 analytics plan, checks C35–C42.

## Decisions

- **Home has its own words for the numbers.** Four of six officer personas misread "Follow-up: 12 to look at · 4 noted this week" on Home ("noted" read as 4 more tasks, or as part of the key alert). Members keeps S1's line, because S3 owns Members' files.
- **The card has a heading ("Follow-up").** The designer and product persona preferred no heading to save 36 px. Both wrong answers in round 1 came from the headless card reading as the tail of the key alert.
- **The jump, not a move of "To review".** 5 of 6 personas could not tell what the Home badge "1" counted. Moving the card up would push today's events off the first screen. In round 2, "1 to review ↓" above the key card was read as that card's label (3 of 6), so the jump sits after the Follow-up card and names the card.
- **The fold is consecutive only.** The product persona asked for folding across other roll calls' lines. That breaks D108's page cursor (a page's cursor is its last line's oldest action, so an earlier folded line could hold older actions that show again on the next page) and D108's "a run never hides another line".
- **Single taps ("took the roll call") do not fold**, as the brief and F21 name "finished" only.
- **The repeat rule ignores the roll call's id.** The first e2e walk showed four identical "Officer LNK finished the roll call “Raid prep”" lines (four Raid prep roll calls). The old rule showed one. `sameKey` leaves the id out, so the same words in a row stay one line as before.

## Deviations

- **Criterion numbers.** The plan's S2 criteria were back at 14–21 on `dev` (Prettier renumbers one list). The S2 handoff had renumbered them to 24–31. They now sit in a separate list that starts at 24, so the formatter keeps them. S4 keeps 19–21 and adds 35–39, and its checks are C35–C42: S3 (PR 651, in parallel) holds criteria 32–34 and checks C25–C34 (orchestrator, 2026-11-22).
- **"1 waiting in “To review” ↓"** was not in the brief. The panel made it a MUST (5 of 6), and the product persona and designer asked for it.
- **Home's Follow-up words differ from Members'.** The brief said "Follow-up's two numbers". The numbers are the same; the words are Home's own (panel MUST).

## Verified

- `pnpm vitest related --run` on the changed files: 69 files, 343 tests passed (before the last two refactors); the new and touched tests again after them: 19 passed.
- `pnpm check`: green after two fix rounds. Round 1: the three main dictionaries went over 300 lines, so Home's keys moved to `dictionary.activity.ts`. Round 2: the first repeat-rule fix zeroed every `callId`, which also merged two "deleted the roll call" lines (`roll-call/route.test.ts` caught it); it now leaves out only a marks line's roll call id. Final: 330 files passed and 2 skipped; 1,724 tests passed and 4 skipped; drift and i18n green.
- Deliberate breaks, each reverted: fold off → C36 fails; a folded line dropped when its head's account is gone → C36 fails; the margin keeps its line with the tab on → C35 fails; a finished entry back on two lines → C37 fails.
- E2E (production build, worktree-local Postgres 18 on 127.0.0.1:54341, app 3497, bridge 54397): 47 passed, 3 skipped (by design), including "Home shows the alliance" on phone and wide.
- Walk at 360 × 780 light and dark and 1280 on the e2e seed: `585-s4/shots/` in the orchestrator's scratchpad.
- First-glance test, "What needs me today?", 360 × 780, six officer personas (AI, invented data): before 0 right, 6 partial; round 1 4 right, 2 wrong (no heading) or 4 right, 1 partial, 1 wrong (heading); round 2 3 right, 3 partial, 0 wrong. Details: plan Validation (h).
- `validate_plan.py` 0 errors (1 warning, pre-existing); `validate_checks.py` 0 errors (1 warning: C41 is a grep).
- `check_proofs.py` at 48877a20: 34 pass, 0 fail (the e2e proofs with `E2E_NO_BUILD=1` and this worktree's ports).
- **Verifier** (independent sub-agent, at 48877a20): FAIL on three findings, all closed in the fix commit.
  - A fold could hide a second roll call of the same name: after a multi-officer fold of "Cheese Trap" #1, the last officer's line on #2 was taken as a repeat. The repeat rule now compares a roll call by its id inside a fold of several officers, by its name after a single line. C36's test has the case.
  - C37's test had no entry under way; it now has one, with "· Started" on two lines.
  - C35's tab-off half was tested only at 0; it now asserts the linked "1 person to check in with or help".
  - Its six own examples (four officers in three languages, a nameless newest officer, a single tap in between, Home's words in three languages, an entry at exactly its end) all held.

## Open issues

- **The fold may trigger less on real data than on the seed.** An officer's single taps between two "finished" lines end it (adversarial SHOULD). Not checked on production history: no access from this session.
- **Two officers with the same desk name** are named once in a folded line (names are deduplicated as text).
- **Persona findings not built** (other cards' copy, outside S4):
  - "Your tracker key needs you" reads oddly, and its second sentence is skipped (2 to 4 of 6);
  - "Rankings: turn on My Alliance first." reads like an error (3 of 6);
  - the screenshot help could fold under a disclosure (designer);
  - "ST" is never spelled out;
  - "Alliance settings" appears twice on the first screen.
- **A quiet day shows two near-empty cards** ("Nothing to review." and "Screenshots"); the product persona noted it.
- **The designer's 1280 suggestion** (the card in the margin) was not taken: criterion 19 puts it in the main column.
- **PostHog:** no access. Queries to run, team level only: Home → Follow-up within 10 minutes before and after, by width; `$autocapture` on the card's link; Home scroll depth below 640 px; `/api/w/[slug]/activity` reads and "Show more" per Home view; claim asked → answered time from the database; `ws_screenshot_sent` per workspace per week.
- **Guide:** Home's layout changed (the Follow-up card, the Screenshots card). The new-alliance guide's Home screenshots, if any show Home, need retaking after the release.

## Next

- **S3** (in parallel, Follow-up rows and Members' group, F29): one action per row, tappable names, "Card ›", a group's repeated line said once, the wide frame, one in-place help, Members' "To check in with or help" renamed or repointed. Members still shows S1's "Follow-up: 12 to look at · 4 noted this week"; S3 may align it with Home's words.
- **S5:** "After KvK, offer help · n" in Follow-up from `insights-kvk.ts` `help`, with Insights linking to it (a rule change, its own plan review).
- **Follow-ups from this slice:**
  - fold "took the roll call" lines of the same roll call too, if real history shows single taps breaking the fold (a criteria change);
  - the persona copy findings above (tracker key card title, the screenshot help);
  - two near-empty cards on a quiet day;
  - the patch notes for the release: Home's Follow-up card, the Screenshots card, the folded roll call lines.

Analytics plan: no new event, no change to an event. Home's Follow-up link moves to a card near the top of the main column with new words; "Send screenshots" moves to its own card (`ws_screenshot_sent` unchanged); the "waiting in To review" jump is an in-page link with no event. A dated "Changed" line says clicks to Follow-up from Home may rise and "Show more" reads may fall. Nothing removed; no PostHog insight or Endpoint reads these.

What was missing from the task prompt? That the plan's criterion numbers had been reset by Prettier (S2 back at 14–21), and that the three main desk dictionaries were at their 300-line limit.

PR: (added by the orchestrator)
