# feat/736-chart-to-chart — chart to chart (issue 736, part 3)

## Built

Pattern (b) of D158 rule 7: a tap opens the next level as a chart in the same card, in place of the first. Four levels:

- **Server pulse, an interval by alliance** (event page and `/`, `?interval=<i>`):
  - Under the readout, "11:00–11:15 by alliance ›" (`ReadoutLink`) opens the chosen interval's kills split by alliance (`app/_ui/PulseSplit.tsx`).
  - It shows one `Bar` per alliance, its share of the kills the sum line adds up, and the kills beside it, most first.
  - The sum line says "125K kills gained in 10:45–11:00 by the 4 alliances read at 10:45 and at 11:00.", and another line names the alliances left out ("Not read at both times, so left out: [IRT] Iron Thistle.").
  - The parts come from `serverPulse`'s own loop: `compared` in `lib/live.ts` now returns each alliance's kills (`PulseSlot.parts`) beside their sum and count.
- **Fight clock, a slot by alliance** (`?event=<id>&at=<minute>`):
  - Under each event's strip, the chosen column's link opens the same split in that strip's place.
  - `ClockSlot.parts` comes from the pulse slot. `EventPulse.allianceIds` lists the Start's alliances, so the split can name the ones left out.
  - When the parts add up to a loss, which the fight clock counts as 0, a line says so.
  - Alliance names come from `allianceNames` (`loadAllianceLabels` in `app/_ui/event-page.ts`), read only when a slot is open.
- **Insights, the week's pulse, a week to its days** (`?pulse=<monday>`):
  - Each earlier week row is a link (this week's days are already drawn above the rows).
  - The card shows that week's seven day columns for each measure. Under each day's share is the count it is of ("11/11").
  - The sum line reads "Week of Nov 9: 77 of 77 member-days (each daily update counts each member once). Its days add up to this."
  - For the middle donation, the line says a median does not add up to the week, and that the donated counts do.
  - The days come from `pulseDays` (`lib/private/insights-rules.ts`). It sits beside `pulseOf` and is now used for this week's days too.
- **Insights, membership flow, a week to its days** (`?flow=<monday>`):
  - "Week of Nov 16, day by day ›" sits under each week that has a join or a leave.
  - Each day shows joined and left against the members, as the week row does. A day shows "—" when it has no daily update, or when it falls before the first comparison, and a line says why.
  - The sum line reads "Week of Nov 16: 1 joined, 1 left. Its days add up to this."
  - Counts only (D75). The days come from `flowDays`, built from the same moves the week row counts.
- **Shared parts:**
  - `app/_ui/charts/DrillPath.tsx` (server): a 44 px "‹ All intervals" or "‹ All weeks" step, then the path, each level above it a link. Every link keeps the scroll position (`scroll={false}`, `prefetch={false}`).
  - On the desk the path sticks to the top of its card.
  - `DrillReveal` (a small client part) brings the path into view on arrival if the card got shorter than where the reader was.
  - `Readout` gains a context, so a `ReadoutLink` shows the chosen column's link, and an `after` slot for it.
  - `lib/private/insights-days-words.ts` holds the level words, `levelsOf` and `levelHref`. `app/(private)/_ui/InsightsDays.tsx` draws the levels and now holds `Days`. `InsightsDrillLink` counts the tap.
- **Analytics** (dated Changed line in `docs/analytics/tracking-plan.md`):
  - `ws_drilldown_opened` on `surface: insights` gains `kind` `pulse_days` (its bucket: the week's daily updates) and `flow_days` (its bucket: the week's joins and leaves), counted on the tap, once per kind per page view.
  - `drilldown_opened` gains `surface` `server_pulse` and `fight_clock` with `kind` `alliances` (its bucket: the alliances read in the interval).
- **Copy**:
  - Desk: `lib/private/dictionary.drill.ts`, in English, Brazilian Portuguese and French.
  - Public: `lib/copy-tap.ts`, translated into 17 languages with the translate-copy skill and stamped.
- **D158**: dated amendment, pattern (b) built.
- **Seed**: the first event (two Saturdays back, not the home event) gets eight 15-minute samples, 10:15 to 12:00. The first filler is stale in one sample. `SAMPLE_STEPS`, `STALE_SAMPLE`, `sampleTimes` and `intervalParts` are in `e2e/fixtures/seed.ts`.

## Decisions

- **Reading of the task**:
  - "a pulse interval or fight-clock slot, split by alliance" is read as both. They share the parts and `PulseSplit`.
  - The flow goes from a week to its days, as the task says. The came-from and went-to bars of one day are not built (see Next).
- **The level is in the query, not the fragment.** The server computes it (D68), so a link reopens it and the page works without JavaScript. Pulse and flow levels are independent: `levelHref` keeps the other card's level.
- **Fight-clock links sit under each strip**, one per row, for the chosen column, rather than in the sticky readout. With 12 events, a link per event in the readout would fill the screen.
- **Only a `moved` interval or slot opens a split.** A `still` one has nothing to split, and a `missing` one has no parts.
- **A week row of the pulse is the link itself.** A flow week keeps its tap on the names fold (part 2), so the days link sits under it.
- **Pulse days for an earlier week are read only when asked** (`insightsView(..., pulseWeek)`). Every week's flow days are built, from moves already in memory.
- **The split bar's whole is the sum of the parts**, the figure the sum line writes. It is not the column's share of the event.
- **The persona panel's changes were adopted**:
  - plainer sum lines, with the two reading times;
  - the left-out alliances named;
  - "these 125K kills" in the bar key;
  - "n/N" under each pulse day;
  - "member-days" in the pulse sum line;
  - the flow link named by its own week ("Week of Nov 16, day by day ›"), and "Joined and left, day by day" as the heading at the day level.

- **Translation spot-check**: 12 translators wrote "Not read at both times" as "read at neither time", which is wrong. I rewrote those `splitLeftOut` strings by hand as "one of the two readings is missing" (es, it, pt-BR, id, ru, uk, tr, ja, ko, zh-CN, th, vi), then stamped.

## Deviations

- **`EventView`, `/` and `/events/[id]` take `searchParams`** (`interval`). The pages were already dynamic (cookies and headers), so caching does not change.
- **`InsightsPage` reads `searchParams` before `openRollCall`.** It only parses dates: nothing private is read before the access check.
- **`EventPulse` gains `allianceIds`**, and two test fixtures (`ComparePulse.test.ts`, `fight-clock.test.ts`) gained the field.

## Verified

- `pnpm vitest related --run <changed>` after each step. `pnpm check` is green: 372 files and 1,994 tests pass, and i18n is fresh in 17 languages.
- New PGlite tests:
  - `lib/queries/live.test.ts`:
    - each interval's alliance parts add up to its kills;
    - an alliance stale in one reading is left out of both intervals that read it;
    - the Start's alliances missing from the parts are exactly the ones the split names.
  - `lib/private/insights.test.ts`:
    - a flow week's days add up to the week's joined and left;
    - no read, or before the first comparison, gives null;
    - another alliance's members on the same days never appear;
    - an earlier pulse week's days add up to its quests, coins and donated counts;
    - this week, or a day that is not a Monday, opens nothing.
- E2E on my own Postgres (port 54393) and ports (app 3746, bridge 54746, stub 3749), phone 360 and wide 1280:
  - `public.spec.ts`:
    - the server pulse and the fight clock: tap the readout's link and see each alliance's kills, the key, the sum line and the named left-out alliance, all computed from the seed;
    - no scroll jump, then Back (44 px) gives the bars again at the same scroll position;
    - opening the address afresh shows the split.
  - `desk-insights.spec.ts`:
    - the pulse's last week shows "77 of 77 member-days" and "11/11" on its seven coin days;
    - the flow's event week shows +1 and −1 on the event's Saturday and the sum line;
    - both: no scroll jump, Back at the same position, and the address reopens the level.
  - Final run: `public.spec.ts`, `desk-insights.spec.ts`, `isolation.spec.ts` and `desk-drilldown.spec.ts` (the specs the seed change can reach), 60 of 60 passed. My Postgres and servers are stopped.
- **Persona check** on screenshots of the local production build at 360 and 1280 px, by the report's panel: front-end, dataviz, an ESL officer, a product strategist and an adversarial reviewer. Verdict: ship after their three changes, all adopted (see Decisions).

## Open issues

- **Pre-existing, from the adversarial reviewer**:
  - The flow's weeks before the first daily update show "joined 0 / left 0", where D75 wants "—".
  - The flow card gives the start as both "since November 10" and "Nov 9".
  - Not changed here.
- **The fight clock's sticky readout keeps its ‹ › steps while a strip shows a split.** Stepping moves the other strips' links, not the open split.
- **On wide screens the split's labels sit far from their numbers**, as on the other full-width public bar lists.
- **No e2e shows a day with "—" at the flow day level**: every seeded day in that week has a read. The PGlite test covers it.

## Next

- A flow day to its came-from and went-to bars, and a pulse day to who reached it (pattern (c), thanks first). Both need child reads beside `cameFrom` and `pulseOf`.
- KvK recovery: from a KvK to its days (report section 4).
- Follow-up issue: "—" for flow weeks before the first daily update, and one start date in the flow card.
- At release: patch notes, and new guide screenshots of Insights.

What was missing from the task prompt? Whether "a pulse interval or fight-clock slot" meant one or both, and that the seed had no event samples for the public levels.

PR: (added by the orchestrator)
