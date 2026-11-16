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

## Open issues
1. The "larger of the two caps" rule is my reading; the owner may prefer the smaller one or the sum. It is one line in `mergedCapacity`.
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
