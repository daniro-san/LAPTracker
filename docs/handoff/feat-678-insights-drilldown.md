# Insights: tap a count to see exactly those members (#678)

## Built
- **Sets from the counting function.** Each Insights set is now a list of uids returned by the function that counts it, and the number shown is that list's length:
  - `bandsOf` returns `Band.uids` (it returned `members`, a number);
  - `effortPart` returns `leftOut` as lists (new, on a break, no might);
  - `flowPart` returns each week's `joined` and `left` as lists;
  - `tenureOf` returns uid lists per band;
  - `newcomersOf` returns `uids`;
  - `zoneCountsOf` returns `uids` per zone, and `zoneGroups` returns them per group.
- **Names map.** `InsightsView.people` maps uid to name and "still a member" for everyone a set can name: the newest daily update's members plus the flow's joiners and leavers. No new query.
- **`lib/private/insights-sets.ts`** (new): `Who`, `MemberSet` and `setOf`. `setOf` orders names by the page language's collation, with numbers in order and punctuation ignored.
- **`lib/private/insights-effort-words.ts`** (new): `effortWords`, moved out of `insights-words.ts` for the line limit. It adds `ranges` ("Who is in each group") and the left-out sets.
- **`app/(private)/_ui/InsightsSets.tsx`** (new): `SetFold`, `Names`, `Caret` and `TapHint`.
  - `SetFold`: a native `<details>` whose summary is the row, `min-h-11`, `tint-button`, `focus-visible:outline-plum`, with the marker hidden.
  - `Names`: two columns at 360 px, a plum side line, 44 px `text-link` cells, `bdi` and `.name-fit`, `ph-no-capture`, and an `aria-label`.
- **`Bars`**: a row with a set opens its names under the row.
- **`app/(private)/_ui/InsightsEffort.tsx`** (new): `EffortCard`, moved out of `InsightsSections.tsx` for the line limit. It adds "See who" under the left-out line and "Who is in each group" before the three measures.
- **`FlowCard`**: each week is one fold, opening "Joined (n)" and "Left (n)". Tenure rows open their members.
- **`ZonesCard`**: each zone row opens its members.
  - "Add their time zone ›" and "See who ›" are now written by Members' `queryString` from `NOT_RECORDED` and `usualAt(h)`.
  - "Not recorded yet" is counted with Members' `factsToAsk`.
  - Usual hours call the new `daytimeAt` (`members-list.ts`), which Members' day and night filters also call now.
- **`app/(private)/_ui/InsightsSetMemory.tsx`** (new, client): opening a set writes `#who-<key>` with `replaceState`. After Back, it reopens that set and the folds around it. It sends `ws_insights_set_opened` (`set` = the kind), once per kind per page view, and not for a set reopened after Back.
- **Copy (EN, PT-BR, FR)**:
  - new: `insights.tapHint`, `insights.effort.who`, `insights.effort.seeWho`, `insights.flow.joinedWho` and `insights.flow.leftWho`;
  - `insights.effort.fresh` split into `.one` and `.other` ("1 novo", "1 nouveau");
  - `insights.zones.notCounted` shortened to "Not counted in any group." / "Fora de todos os grupos." / "Hors de tout groupe.".
- **Docs**:
  - dated amendments to D139, D153 and D98;
  - the tracking plan: a row for the new event, plus a "Changed" line;
  - the plan: `.specs/features/678-insights-drilldown/plan.md`.

## Decisions
- **In place, not a Members filter.** Members cannot rebuild these sets without a second copy of each rule, or the reads only Insights makes (D149). Officers 6/6, designer and product agreed.
- **Effort groups open once.** They open in "Who is in each group", never under each measure, so no name sits beside a low median (officers 4/6, designer, product).
- **Left out of this PR, because owner decisions say "counts only":**
  - squads (S1–S3; owner, 2026-11-20);
  - came from / went to names (D139: "never names");
  - newcomers' names (D139: "Aggregate only").
  - The owner's #678 words name only might ranges. The issue's "squads bands" example came from the orchestrator (adversarial blocker).
- **Also left out:** the pulse (member-days, and a list there would show who did not do quests), Raid Shield (no "who was not seen"), and the KvK card's based lines.
- **Flow weeks list moves, as the count does.** A member who left and came back in one week is named twice.
- **Left-out names show only while the card has its groups** (3 or more daily updates), per D139's "no groups and no names".
- **Back on a phone.** The card is a sheet there, so the first Back closes it, as anywhere on Members (D122). The second Back returns to Insights with the set open.
- **Analytics:** add `ws_insights_set_opened` with `set` from a closed list (`effort_range`, `effort_left_out`, `flow_week`, `tenure`, `zone`). It never carries a name, a uid, a count or which range. It answers "Which Insights sets do officers open, so we know which to keep, cut, or give Copy names first?".

## Deviations
- The issue's inventory included squads, origins and newcomers; this PR does not open them (see Decisions; a question for the owner below).
- `pnpm check` took three fix rounds, not two: formatting, then the line limits (files and functions), then a colour-literal guard. That guard read "#678" in `app/` comments as a hex colour; they now say "issue 678". The third failure only appeared once lint passed. Each round was mechanical.

## Verified
- `lib/private/insights-sets.test.ts` (PGlite, new) has one test per set kind on one data set: effort groups, left out, flow weeks, tenure, "Not recorded yet" against Members' `keepMembers` on `membersView` rows, usual hours for all 24 hours against Members' `day=H` list, and the URL round trip for both links.
- `insights-zones.test.ts`: the old "counts only" assertion now checks that each zone row names exactly its members.
- Break check: 11 mutants, each killed by a test.
  - The effort group holds all compared members, and its count is not taken from the list.
  - Left-out names show with too few daily updates, and its kinds are swapped.
  - A flow week ignores days, and a leaver is shown as current.
  - The "since our first daily update" band is wrong.
  - Insights counts another member set for "Not recorded yet".
  - Usual hours use their own boundary.
  - The round trip is broken.
  - A zone group names a member twice.
- e2e `desk-insights.spec.ts`, new flow, on a local cluster with its own ports:
  - it taps the top might group, sees exactly the seed's names (computed from `rosterOf`, `newMembers` and `LEAVER`), checks that the row and a name link are each at least 44 px tall, and opens the card;
  - it goes Back and sees the group still open, at phone and wide widths;
  - with `InsightsSetMemory` removed, the flow fails at the Back step.
  - `desk-insights` (zones), `desk-kvk` and `isolation` also pass at both widths.
- Screenshots at 360×780 in EN (light and dark), PT-BR and FR were read by a designer and by PT-BR and FR copy readers. Their fixes were applied: "Joined (1)" headings, the singular "novo" / "nouveau", "Hors de tout groupe.", and one line per name instead of two.
- `pnpm vitest related --run <changed>` (186 files, 1038 tests) and `pnpm check` (Prettier, ESLint, tsc, 1791 tests, drift, i18n) pass.

## Open issues
- **For the owner:** may squads (counts and might groups), "came from / went to" and newcomers open their names? Each needs an amendment to an owner decision of 2026-11-20.
- **Former link.** A leaver who is back in a newer stale or event roster: `members?view=former&m=` opens the former list with no card, because Members' former view reads `anyRoster`. Rare.
- **Parse failures.** A member row that fails to parse shows as left and joined by name. This already happened in the counts before this change.
- **Groups of one.** With 4–7 members compared, a might group can hold one member, and the group's medians are then that member's own averages (adversarial NICE).
- **Light-mode cue.** In light mode the plum count is close to ink, so the ▾ is the main cue to tap (designer NICE).

## Next
- Ask the owner the question above; if yes, open squads, origins and newcomers with the same `setOf` and `Bars` set rows.
- Read `ws_insights_set_opened` after two weeks; add "Copy names" to the kinds that are opened, not to the effort groups (product).
- If group messaging comes, consider a set address on Members (`?set=`), built from the same functions.

What was missing from the task prompt? That three of the inventoried sets (squads, origins, newcomers) are held as counts only by earlier owner decisions, which the owner's own words did not lift.

PR: (added by the orchestrator)
