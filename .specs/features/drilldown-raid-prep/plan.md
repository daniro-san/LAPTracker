# Drilldown batch A: Raid prep and roll call

**Approved**: 2026-11-22 - user: "look at every insight on the workspace and public pages, and wherever a drilldown layer would help (tap a count, see exactly those people), build it" (owner, 2026-11-22, as the task prompt quotes it); the drilldown spike's persona panel ranked this batch first (D1 "To remind": 0 of 6 officers could name one person, 5 of 6 wanted a tap; the older-eyes officer asked for a visible label over a hidden tap target). Plan check: [Validation](#validation).

Size: M (a flow across two screens: the Roll call list's counts open the marking page with a chip set). One PR, `feat/drilldown-raid-prep`.

## Problem

Raid prep and the Roll call list show counts that stand for people, but not the people:

- "To remind: 21" (`RaidPrepHead.tsx`) copies the names to the clipboard and never shows them.
- "Mark ✓ the 5 seen with a shield" marks five members the officer cannot see first; its set (`acceptable`) is computed inline in the component.
- "· 3 not read yet" in Raid prep's answer is `members − read`; no function gives the members.
- The Roll call list's cards ("4 of 58 marked · Shield up 3 · No shield 1 · Not set 54") are text; the marking page always opens on "To mark" (`useGrid`, `RollCallGrid.tsx`).

## Shape

No new query, route, table or dependency. Every set is computed from what the page already reads.

1. `toRemind` (`prep-message.ts`, exists) returns the rows (uid, name), not only names; "To remind: n", "Copy n names", "Copy one message" and the new "Show the n ›" all read that one list.
2. `toAccept` (new, `prep-message.ts`): the not-set asked rows the newest reading saw with a shield. The bulk button's count, its names and the uids it writes all read it.
3. (Dropped, see Validation.) `unreadOf` (new, `prep-data.ts`): the roster members with no reading at the newest check.
4. The grid (`roll-call-grid.ts`) can show a given set: `takeSet` makes a snap with no chip pressed and only those members, taken once (D103: nothing moves under the thumb). A chip tap goes back to the chips.
5. `tallyParts` (`roll-call-words.ts`) tags each count with its set (`yes`, `no`, `assumed`, `notSet`, progress, away). `rollCard` links the parts of "To mark", ✓ and ✗ to `/roll-call/mark?…&filter=<chip>`; the ✓ link covers "Shield up n" and, when shown, "No problem seen n", the two halves of the ✓ chip.
6. The marking page reads `?filter=` (`todo`, `yes`, `no`, `all`; anything else is `todo`) and opens the grid on that chip.

## Landing

None hard to reverse: copy, a URL parameter and client view state. No stored shape changes.

## Criteria

### D1: "To remind: n" shows its members (P1)

1. WHEN at least one member is to remind THEN Raid prep SHALL show a visible chip "Show the n ›" beside "To remind: n" ("Mostrar os n ›", "Afficher les n ›"; "Show the 1 ›" for one).
2. WHEN the officer taps it THEN the grid SHALL show exactly the members of `toRemind` (Shield ✗, or not set and not seen with a shield; away members never), in the page's order, no chip pressed, with the line "The n to remind" above them.
3. The count, the copied names and the shown tiles SHALL come from one call of `toRemind`.
4. WHILE the set is shown, a mark SHALL NOT move or hide a tile (D103); a chip tap SHALL bring back that chip's tiles.

### D2: "Mark ✓ the n seen with a shield" shows its members first (P1)

1. The button's n, its names and the uids it writes SHALL come from `toAccept` (asked, Shield not set, seen with a shield by the newest reading).
2. WHEN the button shows THEN a visible chip "Show the n ›" SHALL sit beside it; a tap SHALL show exactly those members in the grid, as D1.2, with the line "The n seen with a shield, not marked yet".

### D3: "n not read yet" lists its members (P2, optional; dropped after the persona check, see Validation)

1. `answerOf`'s unread count SHALL be the length of `unreadOf` (roster members with no reading at the newest check).
2. WHEN n > 0 THEN the card SHALL hold a disclosure "No reading yet: n" ("Ainda sem leitura: n", "Pas encore de lecture : n") listing those names by name, each a link to the member card (`/members?m=<uid>`).
3. The words SHALL describe the tracker, never the member (D75): no "missing", "failed" or "did not".

### D4: the Roll call list's counts open the marking page on their chip (P1)

1. A card's "Not set n" SHALL link to its marking page with `filter=todo`, its ✗ count with `filter=no`, and its ✓ count ("Shield up n", with "No problem seen n" when shown) with `filter=yes`. "n of m marked" and "Away n" SHALL NOT be links.
2. WHEN the marking page opens with `filter=<chip>` THEN that chip SHALL be pressed and the tiles SHALL be that chip's members; with no or another value it SHALL open on "To mark" (D75: ✗ is never the default).
3. On the same roll call, the card's linked counts SHALL equal the chips' counts (`tally` against `gridCounts`), checked by a PGlite test.
4. Links SHALL be chips at least 44 px tall and keep the count's own words; a count of 0 SHALL NOT be a link. "No problem seen n" SHALL sit beside the ✓ count, as one link with it (D103 amended).

## Tests

- PGlite (`app/(private)/_ui/drilldown-sets.test.ts`): on one Raid prep with marks and both checks' readings, each set's list equals its shown count and names exactly the expected members (D1, D2); on one roll call, the card's counts equal the chips' counts (D4.3).
- Unit: `?filter=` read from the URL (D4.2); `takeSet` keeps a tile marked meanwhile (D1.4).
- E2E (`e2e/desk-drilldown.spec.ts`): Raid prep's "Show the n ›" shows exactly the seed's members to remind; the Raid prep card's "Not set n" and "No shield n" open the page on that chip with exactly those tiles.
- Each test is broken once on purpose to see it fail.

## Analytics

None. See the handoff: the switches change no data, Raid prep's neighbouring Copy chips are deliberately uncounted (D137), and a drilldown event should be defined once for every surface with #678.

## Out of scope

- Batch B and C of the spike; Insights (#678).
- Links from Raid prep's "Shield marks" line.

## Validation

Persona check, 2026-11-22, on invented wireframes of the 360 × 780 first viewport (three officers: an R5 in a hurry, an officer who reads English as a second language, an officer in her 50s who wants visible labels; a mobile designer; an adversarial reviewer for D75 and list = count).

- **D1: adopt.** All three officers read "Show the 21 ›" beside "To remind: 21" as the way to the names; the older officer asked for a bordered 44 px chip, which `chip()` is. The line "The 21 to remind" says what the grid shows. The adversarial reviewer: keep the page's own order and styling, no ✗-first sort, no red. Adopted as written; the designer's "Back to To mark" was not added, because the "To mark" chip sits directly above the line.
- **D2: option A (grid switch), unanimous.** Option B (names in place, each a link to the member card) leaves Raid prep mid-marking and adds a second pattern to the page. The tiles also show each member's checkpoint, the evidence.
- **D3: dropped as designed.** A grid switch cannot match the count, which includes away members (not in the grid); a list of outbound links leaves the page. Criteria D3.1–D3.3 are not built; the handoff lists it as a follow-up for the owner (should "n not read yet" leave away members out?).
- **D4: adopt with change.** The counts that link are pill chips (44 px, bordered), not thin underlines (the older officer missed underlines in a dotted line). The combined ✓ chip "Shield up 3 · No problem seen 2" was accepted; the panel's suggested landing note ("✓ includes 2 no problem seen") was not added: each tile already says its own mark.
- Must-fix checks: "Not set n" equals "To mark n" (away left out of both; PGlite test), the D1 grid holds the same members as "Copy n names" (one list), and the ✗ chip opens only from the ✗ count.

One-way doors: none. No stored shape, route, private field, quota or dependency changes.
