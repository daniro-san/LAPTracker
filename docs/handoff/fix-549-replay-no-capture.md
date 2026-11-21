# fix — keep per-member daily figures out of session replay (issue 549)

## Built

The class `ph-no-capture` is now on every desk element that shows a per-member value from `daily_tech`, `daily_honor` or `active`, as bars, as text or as an order. Replay records each of these elements as an empty box of the same size, with no children, no `style` and no text. Each place is a class on an existing element, or (for the card) the same wrapper `<div>` #548 used. Nothing looks different.

- **Officer member card, Overview tab** (`app/(private)/_ui/MemberCards.tsx`): the "Last 7 days" day bars and their numbers (`MemberLastDays`), wrapped as in `MeSections.tsx` (#548).
- **Members list, the week's donations:**
  - the card row's column (`MemberListRow.tsx`), which already has a fixed width (`w-12`);
  - the table cell (`MembersList.tsx`). Its span is now `block`, so the replayed box is the cell's width instead of the number's. The `td` is `text-right`, so it looks the same.
- **Thanks top 3 (week's donations or quest points beside each name, in that order):**
  - Home (`HomeMembers.tsx`), on the `<ol>`;
  - the Members page (`MembersThanks.tsx`), on the `<ol>`.
- **Caravan role suggestions** (`RosterPicker.tsx`): the top 3 are ordered by the week's quest points (`lib/private/caravan-suggest.ts`), so the `<ul>` is blocked.
- **Roll-call team picker** (`TeamPicker.tsx`): the open groups (day, no time zone, night, other) are ordered by the week's quest points (`teamOrder`, `lib/private/roll-call-rules.ts`), so their `<ul>` is blocked. The "picked" group is not blocked.
- **Status and reason lines** (orchestrator's decision, 2026-11-21): "No daily quests on {day}", "No donations on {day}", "no new donations or activity for {n} days" and the follow-up coins tip. Each place gets one class on an existing element:
  - the Members list row's `statusLine` span (`MemberListRow.tsx`);
  - the officer card's `statusLines` `<ul>` (`MemberCards.tsx`);
  - each reason line's span on the follow-up list (`FollowUpList.tsx`);
  - the follow-up sheet's "Why" `<ul>` (`FollowUpSheet.tsx`).
- **Test:** `app/(private)/_ui/MemberCards.test.ts` renders the officer card and asserts that every bar `height:` style and the day numbers are inside the `ph-no-capture` box, and that no bar height is outside it.

## Decisions

- **The PostHog config was not changed.** `lib/analytics/posthog.ts` never sets `blockClass`, so posthog-js 1.444.4 keeps its default `blockClass: "ph-no-capture"`. This was checked in `node_modules/posthog-js/dist/posthog-recorder.js` and `lazy-recorder.js`. Our config only adds `blockSelector`, and rrweb blocks a node when it matches either one.
- **What "per-member daily figure" covers:** a number, a bar, or an order that comes from those three fields for one member. Status lines such as "No daily quests on Wed" or a day count are thresholded yes/no signals, not values. They are blocked as well, by the orchestrator's decision.
- **/admin:** nothing to wrap. No /admin page reads these fields (`/admin/members` was removed on 2026-11-17, D76 amendment).

## Deviations

- The issue named the officer card. The adversarial review found five more places, and all of them are wrapped here: the Members thanks box, the table cell width, the caravan suggestions and the roll-call picker.

## Verified

- **`pnpm check` passes:** 284 test files passed (2 skipped), 1,464 tests passed (4 skipped).
- **New test:** passes. With the class renamed on the card, it fails (mutation check).
- **Adversarial subagent** (grep and trace of every read of the three fields to the DOM). It ran from this session, and its result came back to this session, not to the orchestrator.
  - Applied: 1 MUST (Members thanks box) and 3 SHOULDs (table cell width, caravan suggestions, roll-call picker).
  - Its NICE on status lines was applied afterwards, by the orchestrator's decision.
  - Not applied: its NICE on the insights bands (see Open issues).
  - Confirmed with no leak:
    - "Copy for spreadsheet" (clipboard only);
    - the RSC payload (rrweb records script text as a placeholder);
    - network capture (off);
    - the Members list orders (rank, might, kills and squad only);
    - the thanks share texts (no numbers);
    - insights quiet contributors (names only, in name order);
    - the export (a ZIP, not in the DOM);
    - /admin and public pages;
    - portals (none, so every sheet stays under the mask wrapper);
    - attributes under the mask (emptied).
- No browser screenshots: the only visual change is the table cell span becoming `block` inside a `text-right` cell.

## Open issues

- **Insights effort bands:** with 4 to 7 counted members, a band can hold one member. Its median and bar width are then that member's own average. Fixing this means a minimum band size in `lib/private/insights-rules.ts` `bandsOf`, which is a logic change and is not done here.
- **Replay of the roll-call picker** now shows its open groups as empty boxes. Taps on them still show as clicks, but not on which member.

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- Any new desk element that shows a per-member `daily_tech`, `daily_honor` or `active` value, or orders members by one of them, must carry `ph-no-capture`. If the element is inline, give it a fixed width or make it `block`, so the replayed box does not give away the number's length.
</adjustments>

PR: (added by the orchestrator)
