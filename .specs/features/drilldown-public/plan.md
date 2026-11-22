# Drilldown batch B: public joined, left and kills

**Approved**: 2026-11-22 - owner: "look at every insight on the public pages too, and build a drilldown wherever one would help (tap a count, see exactly those people)"; the spike's persona panel (two public visitors, a player from another alliance, an alliance leader scouting rivals, product and adversarial reviewers, invented data) recommended P1, P2, P3, P5 and P6 with the conditions below.

Size: M (a flow across two screens: the event ledger, War turnout and Kill share lead to the event alliance page's member list). No new route, no migration, no new decision.

## Problem

The event pages show counts of people ("+3 joined · −2 left", "Came in with 3 who joined", "40% · 8/20" members with kills gained) that a visitor cannot open. To see who joined, left or gained kills they scroll the alliance page's member list and read every row's mark.

## Shape

1. `/events/[id]/alliances/[unionId]?show=joined|left&sort=<key>` (exists; gains the two search values) - parses them; `show` only when both sides are usable and both rosters exist (REVIEW item 1), `sort` only a chip the list offers; any filtered view is `noindex`.
2. `MembersExplorer` (exists) - starts from the URL's filter; gains a Joined / Left chip group whose counts are the list's own lengths, and a line with the Start and End read times while one is on.
3. `filterMembers` (exists, `app/_ui/member-views.ts`) - keeps `status === show`; the kills-change sort ranks by `killsGain` (new, `lib/compute.ts`), the rule `killsTurnout` counts gainers by (both rosters, a null as 0, D15).
4. `killsTurnout` (exists) - returns `gainerUids`, biggest gain first; `gainers` is its length. The public lists keep only the counts (no uid list in the shared entry or the page).
5. Links: the ledger row's "+n joined · −n left" (`event-rows.ts`), the split's "Came in with / Went with" lines (`SplitMark`, ledger and alliance page), War turnout and Kill share rows (`?sort=killsDelta`, only when the event has an End). All land on `#members`.

**One rule per set.** The ledger's counts come from `rosterChanges` (SQL), the list's marks from `rosterDiff`. A PGlite test checks they agree on the same event, with a rename (same uid, new name: stayed, #676) and a joiner and a leaver.

## Criteria

- WHEN a visitor taps "+n joined" (or "−n left") on a ledger row THEN the event alliance page opens at its member list with Joined (Left) on, and the list holds exactly those n members.
- WHEN Joined or Left is on THEN "{n} shown" equals the rows the list keeps, and a line gives the Start and End read times, in neutral words.
- WHEN a visitor taps a War turnout or Kill share row of an event with an End THEN the alliance page opens with its member list sorted by kills change, highest first, and the first `gainers` rows are exactly `killsTurnout`'s gainers.
- WHEN either side is stale, failed or missing THEN no Joined / Left filter is offered and a `show` in the URL is ignored.
- WHEN the URL carries `show` or `sort` THEN the page is `noindex`.
- A member renamed between Start and End stays in neither Joined nor Left.

## Deviation from the task: P3 (Across events) is not linked

Across events' "+n joined · −n left" counts members since the previous event's reference roster, not Start to End of that event. A link to the event's Joined / Left filter would open a different set (the count would not match the list), and a view of the since-previous set is the "leavers across events" view the reviewers ruled out. P3 stays unlinked; the handoff proposes the follow-up (an in-event joined/left line on Across events rows, which could link exactly).

## Conditions kept

Neutral "Left" with the read times; renames stay "stayed" (matched by uid, #676); no view across events and no "left to X"; filtered views `noindex`; public fields only (name, uid, might, kills, level); no delta against a stale side.

## Validation (persona check, 2026-11-22, invented data, 360×780)

- Public visitor: approve with changes. Adopted: land on `#members` with the filter on; the pressed chip taps back to All. Not adopted: "Showing 1 of 11" in place of "Members 11 · 1 shown" (existing copy; follow-up).
- Alliance leader: approve with changes. Adopted: the chips keep `show=` and `sort=` in the URL (replaceState), so the view can be shared. Not adopted: "Might at Start" on Left rows (existing list behaviour; follow-up).
- Designer: approve with changes. Adopted: sign, colour and word on the chips ("+ Joined (1)", "− Left (1)"); 44 px hit areas on the inline ledger links (`-my-3 min-h-11`, as the split's mark) and on the split's lines; `scroll-mt-20` on `#members`. Not adopted: chevrons on War turnout rows (already whole-row links).
- Adversarial privacy and data honesty: approve with changes. Adopted: chip counts from the whole list, not the search or the range; the link shown only where the page offers the filter (a delta on both usable sides); no uid, name or value in `drilldown_opened`; no "lowest first" link; no destination for Left. Not adopted: a note on the D15 row (a null kills at Start sorts by the gain War turnout counts, its change still `—`); kept as War turnout's existing rule and recorded in D15's amendment and the handoff.

## Landing

Nothing hard to reverse: no stored shape, route or dependency changes. One analytics event (`drilldown_opened`) is added to the tracking plan.
