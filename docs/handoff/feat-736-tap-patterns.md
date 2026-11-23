# feat/736-tap-patterns — tap patterns and Members `?set=` (issue 736, part 2)

## Built

- **(c) Who lists** (`app/(private)/_ui/InsightsSets.tsx`, new `SetSheet.tsx`):
  - An Insights count of up to 12 members opens its names in place, under the row, as before.
  - From 13 to 60 the row is a button. It opens the names in the bottom sheet below 1024 px, or in a side pane at the top of the Insights margin from 1024 px (`#who-pane`). The title is the set's own sentence. One set shows in the pane at a time.
  - Past 60 the row links straight to Members `?set=`.
  - The names end with "Open these n in Members ›". A week's leavers have no onward link.
  - The open set is in the fragment (`#who-<key>`). For the sheet it is written on the sheet's own history entry, so Back closes the sheet. A fragment reopens the sheet or pane after a card and Back.
- **`MemberSet`** (`lib/private/insights-sets.ts`) gains:
  - `title`, the chart's sentence with the count, for example "Might 28.2M – 33.2M: 2 members";
  - `onward`, the onward text, or null.
  - Set keys no longer depend on a row's position, so a key names the same group on another day: `left-away` / `left-nomight` / `left-fresh`, and zone keys from the group's offsets (`zone-m180-m180-m180`). `range-<i>`, `tenure-<i>` and `joined|left-<monday>` were already stable.
  - Also new: `SET_KINDS`, `pickSetRef`, `INLINE_MAX = 12` and `SHEET_MAX = 60`.
- **(d) Members `?set=<kind>:<key>`**:
  - `lib/private/members-set.ts`: `insightsSets` collects every set from the same words functions the Insights cards draw, and `shownSet` reads `insightsView` for the signed-in workspace and finds the set. It returns nothing:
    - when the Insights tab is off;
    - for an unknown key;
    - for a week's leavers.
  - `MemberQuery.set` is `{ ref, uids }`. `pickQuery` keeps it only while the address names it. `queryString` writes `set=`, and `keepMembers`, the chip counts and the Filters sheet counts filter on the uids.
  - On the page there is one removable chip under "From Insights", and its × is 44 px. Rows look as on any day, in name order until the officer picks an order. A line names the set's members who have left, each linked to their former-member card. The chip scrolls into view on arrival. Its ×, "Clear filters" and "Search everyone" remove the set; the × moves the focus to the search field.
- **(a) Readouts** (new `app/_ui/charts/Readout.tsx`, a client part): a line under the chart names the chosen column with its numbers. It has 44 px ‹ › steps and `aria-live`. A tap on a column (`data-at`) jumps to it, and the chosen column is marked with `aria-current`. The choice is in the fragment (`#at-<id>-<i>`, replaceState). Used in:
  - the server pulse, starting on the busiest interval: "11:00–11:15 · 10.2K kills gained · 5 alliances read";
  - the compare page: one readout for both strips;
  - the fight clock: one readout for all strips, sticky at the bottom while the strips scroll. The strips moved out of the row link, so a tap on a column no longer opens the event; the heading and "During ›" still do;
  - the line charts on the player page, Me and the balance trend, through `LineChart`'s new `readout` prop. Each reading gets a tap zone with a plum hairline, and an event reading says "event reading";
  - the member card's Last 7 days: each day's three rows against their caps ("175 of 240", "1,000 of 1,000") and what "none" means.
- **(d) Arrival lines**:
  - `drillHref` takes `from`. War turnout and Kill share rows link with `from=war_turnout|kill_share`.
  - The alliance page's member list then opens with "From War turnout: sorted by kills gained in this event, most first." and a 44 px × back to the usual order.
  - The Roll call marking page says "From the Roll call list: …" while the chip a card's count opened stays on.
- **Raid prep**: "Show the n ›" scrolls the shown set's line into view.
- **Analytics**:
  - `ws_drilldown_opened` gains `surface: "members"` with the Insights kinds, sent once per page view when Members opens on a set, as a bucket only.
  - A sheet or pane open counts as `surface: "insights"`, the same as an open in place, once per kind per page view (shared `countOpen`).
  - The tracking plan row is updated, with a dated Changed line.
- **Copy**:
  - Desk: `lib/private/dictionary.drill.ts`, and `roll.grid.from.*` in EN, PT-BR and FR.
  - Public: `lib/copy-tap.ts`, translated into 17 languages with the translate-copy skill and stamped.
- **Review fixes (PR 745)**:
  - Members reads the `?set=` set beside its own reads, not before them.
  - A week fold past 60 links to Members only when nobody left that week; otherwise both lists open in the sheet. Unit test in `InsightsSets.test.ts`.
  - The chip's × moves the focus to the search field.
  - From 1024 px the row has `aria-controls="who-pane"` instead of `aria-haspopup="dialog"`, and a tap moves the focus to the pane's title.
  - While a set is on, the stored order is neither applied nor written into the address. "Clear filters" and "Search everyone" clear the set too.
  - The arrival line shows only while the list keeps ± Kills, most first.
  - The another-workspace test has a positive control: the same key in its own workspace lists its members.
  - The Time zones card and Members `?set=zone:…` both build their words with `zonesWordsAt`.
  - D158 has a dated amendment: (a), (c) and (d) are built, (b) is still to build.

## Decisions

- **War turnout and Kill share** keep their direct link and get the arrival line, as the task prompt says, rather than the report's panel-first option.
- **Home Follow-up numbers, "n already noted" and the shield line** already land on a titled card or page by fragment. I added no extra line there; the Roll call page was the one with no arrival words.
- **The KvK heavy-hit list** stays names only, always inline, with "Offer help: Follow-up ›" (no Members link, D139).
- **Came-from and went-to** stay counts.
- **A `?set=` that resolves to nothing** shows the plain list with no chip. The page makes no claim it cannot back. On another day, a stable key resolves to that day's group, and the chip's sentence shows that day's bounds.
- **Name order under a set** holds until the officer picks an order in the sheet. A stored order from localStorage does not apply, so a set never opens as a ranking (D75).
- **The member card's readout** uses the desk words `drill.earlier` and `drill.later`. Me and the public pages use the public `ledger.readoutEarlier` and `ledger.readoutLater`.

## Deviations

- **5d, chart to chart (b), is not built**: the membership flow from week to days to came-from, the week's pulse from week to days to who, a pulse interval or fight-clock slot split by alliance, and `DrillPath`. Each needs a new child read beside its parent's counting function, for example per-move origins in `insights.ts`. Doing that well did not fit this PR. It is the remaining part of issue 736.
- **The fight clock's strips are no longer inside the row link.** A tap on a strip now picks a slot.
- **No ids on the public source rows for Back.** War turnout lists every alliance twice, once per bar list, so an id would not be unique. Next's own scroll restoration covers Back.
- **An event band on a line chart is not linked** to that event's alliance page (report P1 (d)).

## Verified

- `pnpm vitest related --run <changed>` after each step, then `pnpm check`, which is green: 372 files, 1,988 tests, and i18n fresh in 17 languages.
- New unit and PGlite tests:
  - `lib/private/insights-sets.test.ts`:
    - for every set Insights shows, Members `?set=` lists exactly its current members and its leavers apart, and every kind is covered;
    - an unknown or malformed key, or another workspace's alliance, gives nothing.
  - `lib/private/members-list.test.ts`: the set is kept only while the address names it; the list holds only its members, and the other filters still apply.
  - `app/(private)/_ui/InsightsSets.test.ts`: in place at 12; a sheet button at 13 and 60; a direct link at 61; a set with no Members view stays in the sheet past 60.
  - `app/_ui/charts/Readout.test.ts`: the fragment gives back only its own column, within range; the readout starts on its column, the last step is disabled, and both steps are 44 px.
- E2E on my own Postgres (port 54391) and ports (app 3736, bridge 54736, stub 3739), phone 360 and wide 1280:
  - `desk-insights.spec.ts`: tap a might group, see its names in place, then "Open these n in Members ›" lands on `?set=effort_range:range-0`. The chip shows the chart sentence, exactly those members are listed and no other, a reload shows the same, and × gives the whole list back. An unknown key gives no chip.
  - `public.spec.ts`: the might chart's readout starts on the last daily read (date and might from the seed); Earlier changes it, and the fragment survives a reload.
  - `desk-drilldown.spec.ts` and the rest of `desk-insights.spec.ts` still pass: 20 of 20 in these runs.
- **Not covered by e2e: the sheet and the side pane (13 to 60).** The seed's largest Insights set holds 3 members (Lantern Keep has 11 on its roster), so no seeded count reaches 13. This path is covered by the unit test above only.
- **Persona check** on screenshots of the local production build at 360 and 1280 px: the Insights group open in place, the Members chip, the player readout, the card's days, the arrival line and the Roll call arrival. The panel was front-end, dataviz, an ESL officer, a product strategist and an adversarial reviewer.
  - Adopted: the chip scrolls into view, because the Members lead pushed it below the fold at 360; a readout's chosen column is tinted; the arrival line has its own ×.
  - Noted, not changed: on the member card at 360 the day readout sits under the three rows, about a thumb's reach below the day header.

## Open issues

- The sheet and pane path has no e2e: the seed has no Insights set of 13 or more. A seeded alliance with 13 or more in one band would let `desk-drilldown.spec.ts` check the sheet at 360 and the pane at 1280.
- The fight clock readout line can wrap to several lines when many events are sampled.

## Next

- Issue 736 part 3: chart to chart (b), with `DrillPath` and child reads beside the counting functions (`insights-words.ts` flow and week's pulse, `live.ts` and `fight-clock.ts` per-alliance split). Then e2e for "a week to its days adds up".
- A seed alliance, or a band, of 13 or more for the sheet and pane e2e.
- At release: patch notes, and new guide screenshots of Insights and Members.

What was missing from the task prompt? Whether 5d (chart to chart) had to land in the same PR as 5a to 5c, and that the seed has no Insights set of 13 or more for the sheet e2e.

PR: (added by the orchestrator)
