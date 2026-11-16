# 08zzzzl — Merge simulator

Closes #282.

## Built
- `/alliances/merge?a=&b=`: a public page with two selects of the tracked alliances (GET form, no client-side fetch, a swap link). The result starts with one sentence ("Together: #1 with everyone, #6 within the cap of 100"), then HTML bars: members against the cap, might (each side, together, within the cap, the part that would not fit), rank with everyone and within the cap, each side's latest war turnout, and each side's "as of". The chip "Simulation, not a plan" sits under the title.
- `lib/merge.ts`: pure `simulateMerge` and `mergedCapacity`. `lib/merge.test.ts` holds one property test (within-cap might never exceeds the total; left out = max(0, total − cap); within + left out = members) and three example tests.
- `lib/queries/merge.ts`: `mergePage(db, pair)`. Reads each tracked alliance's newest usable roster (`dailyFit` and `eventFit` from `history-readings.ts`), the stored capacity, each side's roster (uid and power only) and `memberTurnout` for the latest events. `lib/queries/merge.test.ts` has four PGlite tests.
- `app/_ui/MergePicker.tsx`, `app/_ui/MergeSimulator.tsx`, `app/(pages)/alliances/merge/page.tsx`; `app/_ui/AllianceLinks.tsx` holds the alliance page's History link and the new "Simulate a merge" link (opens with `a` set).
- Words in `lib/copy-merge.ts` (27 keys), translated in the 16 other languages; glossaries got "merge" and "cap" rows.
- `docs/decisions/D84-merge-simulator-against-the-member-cap.md` and its README line.

## Decisions
- Capacity: the larger of the two stored capacities; 100 when neither has one, and the page says so. Within the cap: the strongest members by might (a tie: lower uid); a member in both rosters counts once at the larger might.
- Roster: the newest usable one per alliance across daily reads and event rosters, by `source_updated_at`; the daily read on a tie. Rank counts alliances with strictly more might.
- Turnout: for each side, the newest of the last 3 events with a Start and an End in which it has a figure.
- Alliance page link lives in `AllianceLinks.tsx` because the page was at the 300-line lint limit.
- An unknown or non-tracked id in the URL is a 404; a missing one shows the picker.
- `lib/copy.ts` was at the line limit, so `en.merge` comes from `lib/copy-merge.ts`. After merging dev, `copy-live.ts` was already there and both are kept. `lib/copy-blank.ts` (the blank-dictionary helpers, re-exported from `lib/copy.ts`) was added in the first pass; it is unchanged code moved out, and may no longer be needed after dev's split.

## Deviations
- None from the issue. `lib/copy-blank.ts` is a move forced by the line limit (see Decisions).
- Not pushed and no PR opened (the sandbox blocks `git push`); the orchestrator does both. The PR URL line is left out.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest, drift and i18n ("17 languages up to date with English") green after merging origin/dev.
- Local run (local Postgres, no upstream call): seeded data with one alliance renamed to `[TmSLONG] Ünbelievably Long Allianz Name Without Spaces Whatsoever`. At 360, 390, 412, 640 and 1280 px, light, `scrollWidth` equals the viewport width (no sideways scroll); 360 dark checked too.
- Screenshots: `docs/screenshots/08zzzzl-merge-360-light.png`, `docs/screenshots/08zzzzl-merge-360-dark.png`, `docs/screenshots/08zzzzl-merge-1280-light.png`.
- Not run: real production numbers (the local seed has 98 members per alliance and no stored capacity, so the shown cap is the assumed 100).

## UX review (2026-11-16)
Measured (Chrome, light and dark, 360, 390, 412, 600, 768, 810, 820, 1024, 1180, 1280; WebKit 390 and 820, light and dark; German and Russian at 360; the picker alone, the same alliance twice, and the alliance page's link): `scrollWidth` equals the viewport width everywhere; both selects are 44 px tall in Chrome and WebKit (`drawn-field`); the "Simulate a merge" link is 44 px tall; no text under 4.5:1 apart from the breadcrumb separator "›" (3.16:1 in light), which belongs to the shared Breadcrumbs component and is decorative; no figure clipped; long names wrap in the bars and do not overflow. The "Exact numbers" checkbox is 18 px inside its 44 px label, as on other pages.
Fixed: (1) blocker at 360 to 639 px: the two selects sat side by side, each about 125 px wide, so a name showed as `[TmSLONG] Ün` and the arrow overlapped the text; now below 640 px the selects stack (A over B, the swap link beside them) and each shows about 21 characters of the name, and the select keeps its arrow padding (`pl-3 pr-8` instead of `px-3`, which had overridden the right padding). Screenshots replaced.
Left: (1) The 3-second sentence is the two ranks ("Together: #1 with everyone, #1 within the cap of 100"); the member count against the cap is the first chart under it. Putting the count in the sentence needs new copy in 17 languages. (2) With no stored cap the page says "so 100 is assumed" in the help line under the sentence; it is not repeated in the bars. (3) A single roster's age differs between the two sides; each "as of" is listed at the bottom. (4) The breadcrumb separator contrast is a shared component (follow-up). Wording has no blame words, the chip "Simulation, not a plan" is under the title, and the page names no member.
Owner decision 2026-11-16: the merged cap stays the larger of the two stored capacities (D84).
Reader's 3-second takeaway: before and after, "this pair would be #1 with everyone and #1 within the cap"; before the fix the reader could not tell at 360 px which alliances were chosen, now the picker shows both names.

## Open issues
1. The "larger of the two caps" rule: owner confirmed 2026-11-16 (D84). Closed.
2. Ranks use rosters read at different times when one alliance's daily read failed. The "as of" line shows it; no warning is drawn.
3. The native selects cut a long alliance name at 360 px (the option list shows it whole).
4. The `lib/copy-blank.ts` move could be reverted if dev's `copy-live.ts` split leaves `lib/copy.ts` under the limit without it.
5. The war turnout line is the share of members with kills gained in the latest event; it says nothing for an alliance that was not in that event's two rosters ("no war turnout yet").

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after Session 10.
Model / effort: keep. The work was routine; the only snags were the line limits and the merge with dev.
Owner must do first: merge this PR into `dev`; answer open issue 1 (which cap applies).
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- The alliance page's links now live in `app/_ui/AllianceLinks.tsx`; add a new link there, not in the page.
- `mergePage` returns aggregates only; a follow-up that needs member rows must add its own read.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/339
