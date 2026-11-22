# fix/720-desk-layout: the desk at tablet, 1024 and 360 px

Part of #720 (items 1 to 5; item 6, 1920 px, is left as it is: see Decisions).

## Built

- **Nav at 768–1279 (item 1).** `NavRail` now draws the same rows as `NavSidebar` (`sidebarEntries`): each destination, then its views (Members › Former members, Insights; Calendar › Caravans, Notices, Thefts) as 44 px words with no icon, then the `footer` ("See what members see") under a hairline. There is 8 px above each destination, so a destination and its views read as one group. The open view gets `aria-current`, and its destination keeps the bar and the tint. `SideNav` (`app/(private)/_ui/DeskNav.tsx`) passes `view` and the footer to both the rail and the sidebar.
- The in-page view switches (Members' `ViewSwitch`, `CalendarNav`) are now hidden from 768 (`md:hidden`), not only from 1280, so each view is offered once. Below 768 nothing changes: the bottom tabs and the in-page switches.
- **Header at 360 (item 2).** In `Frame`, the title block is `flex-auto` (it starts at its own width), and "?" with EN · PT · FR sit in one group with `ml-auto`. When the name and the alliance do not fit beside them, the group moves to the row below, at the right. The name and the alliance then stay on one line each. In English with the seed's alliance, everything still fits on one row.
- **Home at 1024 (item 3).** Home's `Spread` no longer has `stickyMargin`, so Recent activity scrolls with the page and there is no second scrollbar. Alliance settings keeps its sticky margin. Recent activity's Show more / Show less foot (`lg:sticky lg:bottom-0`) now sticks to the window's foot while its lines run past.
- **Roll call card (item 4).** The card's ✓ link stays one target. Both of its counts open the same ✓ chip (`CHIP` in `roll-call-data.ts`: `yes` and `assumed` → `yes`), so two links would open the same list. It now reads "✓ Shield up 18 + No problem seen 47". The ✓ matches the chip it opens, and the "+" says the two counts add up. D103 is amended.
- **Insights at 360 (item 5).** In the names of a set (`InsightsSets.tsx` `Names`), each name is `min-w-0 break-words` instead of `name-fit`, and the list is `items-start`. A long name wraps inside its column, and the name beside it is top-aligned.
- `e2e/desk-nav.spec.ts`: at 1280 it reads every link of the sidebar, with its words and address. At 768 and 1024 it finds each one as a visible link of the rail, with the same words. It failed on the old rail ("Former members at 768": element not found).
- `docs/DESIGN.md`: the "Desk navigation" line, the `NavRail` / `NavSidebar` entry and the `Spread` entry are updated.

## Decisions

- Item 1: the views go on the rail, not a "More" entry and not the full sidebar from 768. The persona panel (three officers at 1024/768, 360 and French 1280; a mobile designer; an adversarial reviewer for reachability) rejected "More" because every view would cost one more tap. It rejected the 224 px sidebar at 768 because about 500 px would be left for the page. The panel asked for clearer grouping, so the rail got 8 px above each destination. In French at 768 ("Anciens membres", "Voir ce que voient les membres") the rail wraps cleanly.
- Item 4: one link, with "✓ … + …". The panel proposed a short new label ("✓ Checked 65"). That needs new copy in three languages and a new word for an existing chip, so it is left as a follow-up. The ✓ prefix, which the panel gave as the alternative, is used here.
- Item 6 (1920): not changed. The panel said no: the 1200 px column is a deliberate reading width, and filling Insights' margin would add content nobody asked for.

## Deviations

- None from the task. The in-page switches now hide from 768 instead of 1280. This follows from item 1 and DESIGN's rule that a view is offered once (11aq).

## Verified

- `pnpm vitest related --run` on the changed files: 6 files, 21 tests passed. `pnpm check`: exit 0.
- The full e2e suite on my own Postgres (127.0.0.1:54720), with app, bridge and stub ports 3720/54721/3721: 76 passed, 6 skipped (the suite's own skips).
- `e2e/desk-nav.spec.ts` was run against the build from before the change and failed as expected. It passes after the change.
- Persona screenshots: a local production build with the e2e seed at 360, 768, 1024, 1280 and 1920, before and after. Extra shots: French and pt-BR headers at 360 and 320, the French rail at 768, and a long injected name in Insights at 360. The panel accepted items 1, 2, 3 and 5, asked for the adjustments above, and found no overlap, cut text or target under 44 px.

## Open issues

- Pre-existing, not in this change: at 768 and wider, Home's "Add your tracker key" card shows its two links run together as "Open the tracker's API pageAlliance settings", with no space or break between them (seen in home-1024). Follow-up.
- The seed has no Raid prep with both Shield up and No problem seen above zero, so the joined ✓ link was checked by the unit test (`drilldown-sets.test.ts`), not on screen.

## Next

- Follow-up: fix the run-together links in Home's tracker key card at ≥ 768.
- Follow-up (optional, needs copy in EN/PT-BR/FR): a short label for the Roll call card's ✓ link that names its sum ("✓ Checked 65"), as the panel proposed.
- Item 6 (1920 gap, Insights' empty margin): revisit only if officers ask.

What was missing from the task prompt? Nothing blocking. The seeded alliance's name is short, so the four-line header wrap did not reproduce in English at 360. The fix was checked in French and Portuguese at 360 and 320, where the title is longer.

PR: (added by the orchestrator)
