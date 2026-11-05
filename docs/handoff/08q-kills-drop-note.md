# 08q — Kills drop note

## Built
- A `*` after a Might or Kills change when the change is negative and at least one member left. Main page rows and the alliance page's totals band. `fellWithLeavers` in `app/_ui/event-rows.ts` decides; `Delta` (`memberMark`) draws it; `StatMetric.memberMark` carries it.
- One legend item, `* Includes member changes` (`copy.legend.members`), listed only when the page shows at least one `*` (`Legend memberMark`).
- The alliance page counts leavers from the two rosters (status `left`), only when both rosters exist (same rule as the member list, D32).
- Brand book: a "Member mark" entry in `/brand` Components (`lib/copy-brand.ts`, `ComponentsSection.tsx`). `docs/DESIGN.md`: new `member-mark` component, legend and "One legend, once" updated. `docs/DECISIONS.md`: D33.
- Tests: `event-rows.test.ts` (mark for a fall with leavers; none without leavers; none for a rise), `Status.test.ts` (legend item present with the mark, absent without it).

## Decisions
- Symbol is `*`, not the proposed `±`: `±` already means "change" on the site (`± Kills` sort chips, "±delta") and next to a number reads as a margin of error. Recorded in D33.
- Might gets the mark too: same cause, same function, no extra code.
- The "−N Members" note in Details is unchanged. No number is computed differently.
- The mark is aria-hidden; screen readers hear the legend words after the change. Nothing depends on hover.

## Deviations
- Symbol differs from the brief's example (`±`), reason above.
- Handoff and branch are numbered `08q` / `session/08q-kills-drop-note`, following the latest handoff (08p), instead of the brief's `NN`.

## Verified
- `pnpm check` on Node 26: prettier, eslint, tsc and vitest pass (142 passed, 1 skipped). No upstream calls.
- Browser at 360 px: only `/brand`, run with `next dev` and dummy environment values. The "Member mark" entry shows `▼ −3.2M (−0.4%) *` and `* Includes member changes` on one line without horizontal scroll.
- Not seen in a browser: the event page and alliance page. No database with a roster that lost members was available. Open question for the owner: whether `▼ −12.4M (−0.3%) *` still fits the three-column totals band of the alliance page at 360 px (the band stacks the percent under the number; the `*` adds about one character to the first line).

## Open issues
- The `*` is shown for Might whenever members left and Might fell, even if the fall is partly from remaining members. The legend says "includes", which stays true.
- The alliance page's Details table does not show the "−N Members" note (it never did; only the main page rows have it). Left as is.
- The alliance page builds `memberViews` twice (summary mark and member list). Cheap; not merged into one call.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change does not touch run timing or quota.
Owner must do first: merge this PR into `dev`.
Plan change: none.
<adjustments>
- Session 9: after the After run, open the event page and an alliance page for any alliance whose Might or Kills fell; it should carry `*` after the change and the legend should list `* Includes member changes`. On a page with no falling total with leavers the legend must not list it. Check both at 360 px.
</adjustments>

