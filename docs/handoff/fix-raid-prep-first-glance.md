# fix-raid-prep-first-glance: Raid prep at first glance (issue 585)

Real user feedback from KvK Saturday, 2026-11-21. The alliance's R5 opened Raid prep on her phone and asked "We don't have shields recorded for today?" At that point 88 of 99 had been seen with a shield and 98 of 99 were marked. Branch `fix/raid-prep-first-glance` from `origin/dev`, rebased onto d3d46b20, which includes #594 and #597.

## Built

- **The day line names the raid** (`raidHead`, `app/(private)/w/[slug]/roll-call/mark/page.tsx`).
  - It used to show the day the roll call was added ("Wednesday, November 18"). It now reads "KvK Sat, Nov 21 · raid at the reset · 00:00 ST", followed by the officer's own clock.
  - The KvK day is the Saturday of the roll call's week (`fridayOf` + 1), which is the day the Raid Shield check reads for. A roll call added on any weekday, a KvK Calendar entry's roll call and the tick's roll call all show the same raid.
  - A week whose KvK day is before today shows "Past raid · KvK Sat, Nov 14".
  - Archive and delete still name the roll call's own day.
- **The answer leads** (`answerOf` in `prep-data.ts`; the card in `RaidPrepHead.tsx` now comes first). The bold line is "Shields for this raid: 86 of 97 seen at the morning check (10:10 ST) · 3 not read yet". It changes with the state:
  - after the night check only: the night check's count, then "Morning check: Saturday from 10:00 ST.";
  - before either check: "not read yet", then when each check runs;
  - a past week with no reading: "no reading".
  - The checks still to come are named only while KvK has not started (`PrepView.ahead` in `lib/private/raid-prep.ts`).
- **The counts add up.**
  - The card's second line is "Shield marks: 92 of 98 · ✓ 72 · ✗ 20 · 6 to mark". It uses the same counts as the chips (`g.counts`) and updates live.
  - While the check is on, Intro no longer repeats "92 of 98 marked" (`progress` prop on `Intro`).
  - The chips have the caption "Filter by Shield mark" (`caption` prop on `RollGrid`).
  - "To remind: 21" stands before "Copy 21 names". When the list is empty it reads "Nobody to remind".
- **Tile times are labelled as map scans** (`RaidPrepRow.tsx`). Each checkpoint has its own line, for example "Night check: no shield seen (map from 21:00 ST)". The bracket is muted and does not break, so it wraps whole at four columns.
- **Words**: EN, PT-BR and FR. The new keys are in `lib/private/dictionary.raidprep-glance.ts`, because `dictionary.raidprep.ts` went over the 300-line lint limit. The checkpoint words changed in place.
- **Docs**:
  - a dated D137 amendment;
  - the "First-glance test" rule in DESIGN.md § Validation (#594 had merged, so the rule is in that section).

## Decisions

- **The KvK date comes from the shield check's week, not from Calendar or `events`.** The check, its readings and `kvkStart` all use the week's Saturday, so the header can never name a different raid from the one the counts describe.
- **"Past" means the KvK day is before today's server day.** On KvK day itself, after 12:00 ST, the header still shows that day's raid.
- **The tile wording was chosen after three panel rounds.** These variants failed:
  - "Night · map 21:00 ST: not seen": 2 of 4 personas read it as a check time;
  - "map scan 21:00 ST": read as another check.
  - "map from 21:00 ST" passed: 4 of 4 read it as the age of the map.
- **The marks line carries the "Shield marks:" label.** Without it, panel round 1 confused the tracker's "86 of 97 seen" with the officers' "92 of 98 marked".
- **The reset time uses the shared `Times` pair** ("00:00 ST · 23:00 your time (−1 d)"), as every roll call header does (D101).

## Deviations

- The task's example status line was one line holding everything: "88 of 99 seen … · 98 of 99 marked · 1 still to mark". I split it into two lines: the answer in bold, then the marks. At 360 px one line would have wrapped to four lines, and the panel needed the two sources apart.
- A tile with both checkpoints is about 20 px taller than in batch 1, because each checkpoint now has its own line.
- No test was added or changed: the task asks for none, and no test quoted the changed words. `pnpm check` covers the types and the i18n of the new keys.

## Verified

- `pnpm check` passed: prettier, eslint, tsc, vitest (297 files, 1534 tests), drift, and i18n (17 languages).
- **First-glance test.** Each run showed the first viewport at 360 × 780 for 5 seconds to four personas: an R5, a war lead, an officer who reads English as a second language, and a product persona.

  | Question | Before | After |
  |---|---|---|
  | Do we have shields recorded for today's raid? | 4/4 right, but "which count is real?" | 4/4 right |
  | Who do I still need to remind? | 4/4, via the button label only | 4/4 ("To remind: 21") |
  | Is this the right raid? | **0/4**: all said an old roll call | 4/4 |
  | Card time vs tile times | not tested before the change | round 1: 2/4; final wording: 4/4 |

- **PostHog** (project 741657, read only, consented events only), `/roll-call/mark` over 30 days:
  - 14 pageviews in total;
  - before Nov 21: 9 views, all on desktop;
  - Nov 21: 5 of 6 views on mobile, 393–432 px wide, 3 people.
  - The URL does not carry the roll call kind, so Raid prep cannot be counted apart from other roll calls.
- **QA on a local production build.** Local database, the #585 kit's invented roster, no upstream or Discord call.
  - Coverage: 38 screenshots, 0 problems (all 200, no sideways scroll, no target under 44 px in `main`, no console error). Scenarios:
    - the R5's case (this week's roll call added on Wednesday, after the morning check): 360, 768 and 1280, light and dark, EN, PT and FR;
    - next week's roll call added on Wednesday, three times: before the night check, after it, and after the morning check;
    - a past week;
    - the KvK Calendar entry's roll call.
  - Turning the check off hides the card, and Intro shows "92 of 98 marked" again.
  - A ✓ tap moved the card, the chips and "To remind" together (92 → 93, 6 → 5, 21 → 20), and the second tap restored all three.
- Screenshots are in the scratchpad `fg/shots/`: `before-r5-360-en.png`, `after-r5-360-en.png`, `after-r5-tiles-360-{en,pt-BR,fr}.png`, and the `s1`–`s6` sets. I reviewed them myself.
- The diff names no member from the fixture roster (the names check script).

## Open issues

- **The sticky bar under 640 px** reads "Shield: 6 not set · 2 away, left out · 1 not seen yet, left out". It says "not set" where the rest of the page says "to mark", and the panel found "left out" unclear. This is pre-existing (`RestBar`, D137 batch 1).
- **"Not set" was read as "no shield"** by the officer who reads English as a second language. This is the D75 word for an unmarked tile; changing it would need a D103 amendment.
- **"(−1 d)" after "your time"** reads as cryptic to that officer. It is the app-wide D101 pattern.
- **The two ratios have different bases**: 97 read by the tracker (away members included) and 98 asked. The panel still notices them, but no answer was wrong.
- **The war lead expected "To remind" to equal the unshielded count** (11). It is ✗ 20 plus 1 not set and not seen. The rule is in "How this works" but not on the first screen.
- **The roll call list card and the Calendar still date Raid prep by the roll call's own day.** Not checked or changed here.

## Next

- Model/effort: keep. This was a UI fix with no data change and no migration.
- Owner first: nothing. There is no migration and no environment change.
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`, and batches run from issue 585. PR #594 also edits DESIGN.md § Validation. It merged before this branch finished, so the rule is in that section.

<adjustments>
- Every later #585 batch runs the first-glance test (DESIGN.md § Validation): a real question per screen, the first viewport at 360 × 780, and a wrong conclusion is a MUST. Before and after results go in the PR.
- Raid prep's header comes from `raidHead(prep.friday, page)`. Any other view of a Raid prep, such as the roll call list or the Calendar, should name the KvK Saturday the same way, not the roll call's day.
- `Intro` takes `progress={false}` and `RollGrid` takes `caption`. Reuse them rather than adding new count lines.
- Raid prep words added for this fix go in `dictionary.raidprep-glance.ts`. `dictionary.raidprep.ts` is at the line limit.
</adjustments>

PR: (added by the orchestrator)
