## D153 — Insights' Time zones card: the members' recorded time zones grouped by offset, with the reset and KvK on their clocks, counts only (2026-11-22, owner's request, persona panel under the standing approval; amends D139)

Why: the owner asked (2026-11-22) for "in the officers' Insights, something grouped by time zones, showing which time zones have more players, and what the server time is for those time zones, etc." Officers plan events across UTC−8 to UTC+8, mostly on phones. Each member's time zone is an officer-entered fact (D80): it shows on that member's card and drives Members' "Within their usual hours at HH ST" filter, but nothing showed the alliance as a whole. Plan, criteria and the panel's verdicts: `.specs/features/insights-time-zones/plan.md`.

**Where.** The last card on `/w/[slug]/insights`, after Raid Shield check (or after the last card shown when that one is off). Officers only, after `requireWorkspace`, own alliance (D71), under the Insights switch (D126). The officers on the panel asked for it last: it is reference that changes slowly and must not push the week's cards down. Product strategy preferred it just before Raid Shield check and accepted this.

**Who counts.** The members of the newest daily update. Each counts once, by the latest version of their `timeZone` fact. A former member's zone does not count. A cleared fact (null) and no fact are "not recorded". The read is the `factsOf` the page already makes, so it adds no query (D149) and no upstream call.

**Groups.** Members whose zones have the same UTC offset at three moments share a row: now, the next 00:00 ST reset, and the first KvK start after now. Grouping by the offset now alone would put zones that change clocks on different dates in one row, and that row would then need two times for one moment (adversarial reviewer).

- **Label.** Up to 2 of the row's cities (the IANA city, most members first, then by city name; IANA names carry no accents, so "Sao Paulo", and no other source of city names is used), "and N more" for the rest, then the offset now in the one offset form: "Paris, Zurich and 1 more · UTC+1". A fixed-offset zone (`Etc/GMT-1`) counts but names no city. A row of only such zones reads "UTC+1".
- **Order.** West to east: by the offset now, then at the reset, then at KvK. The headline already answers "most".
- **A clock change ahead.** When a row's offset at the reset or at KvK is not its offset now, the row says "Clocks change before the reset" or "Clocks change before KvK", naming whichever of those two moments comes first. It gives no date.

**The moments.** Each row reads "Now 10:00 · Reset Sun 21:00 · KvK Sat 09:00", on the row's own clock at each instant (`dateWords`, `zoneOffset`). "Now" and "Reset" carry the zone's weekday only when its date is not the server's date at that instant. KvK always carries it.

- **KvK.** The first start after now, from the schedule config that creates the events (`EVENT_WEEKDAY`, `EVENT_TIME`, `nextKvk`). It is not read from the events table, whose row exists only a day ahead. It is not `nextEvent` either, which returns a KvK already running.
- **The raid.** It starts at the reset before KvK, and the legend says so.
- **Not shown.** This week's calendar events would cost a read. A picker of any ST hour is already Members' "At (ST)" filter.

**What shows.** Without a tap, the card shows two lines:

- the largest group and its reset: "Largest group: Manila, Singapore (UTC+8), 8 of the 29 members with a time zone. The 00:00 ST reset is 10:00 for them." The panel rejected "Most …" because 8 of 29 read as a majority. There are separate sentences for a tie (its groups named west to east, as the rows), for a single group and for a single member.
- the coverage: "Time zone recorded for 29 of the 41 members in the newest daily update."

Behind "Show the details" (44 px), as on the other cards:

- **The legend.** It says what each time is (now in ST, the reset, KvK's ST date and time) and what the bar is.
- **The rows.** Each bar is the row's share of the members with a time zone, with the count in HTML beside it (D68).
- **"Not recorded yet".** It comes last: its count, no bar, and "Not counted in any group. Members lists today's roster, so its count there can differ." Under it, "Add their time zone ›" (44 px) links to `members?ask=timeZone`, Members' Missing info: time zone filter, not to Follow-up: a missing zone is a gap in the officers' records.
- **Usual hours.** With 2 or more rows: "Within their usual hours for the most: 11:00–12:59 ST, 27 of the 29 members with a time zone (12 not recorded). A guess from their time zone, for times you set, like rallies." Usual hours are Members' (08:00–22:59 on their own clock, owner 2026-11-17). Tied hours are written as ranges, and a range can run through midnight. "See who ›" opens `members?day=<first hour>`. The panel rejected the word "awake" as claiming more than the rule says.

With no time zone recorded, the card says "No time zone recorded yet for the 41 members in the newest daily update." with the add link, and has no rows and no fold.

**People first (D75), privacy.**

- **Counts only.** There are no names and no uid. Names per zone behind a tap, and a `members?tz=` filter, were left for later: a zone in the address would reach page-view URLs.
- **Not recorded never counts against anyone.** It is not in any share and not in the largest group.
- **Not a widening.** The time zone is an officer-entered fact, not a roster field in `BLOCKED_ROSTER_KEYS`. Officers already see it on each member card. The rows are `ph-no-capture`, because a one-member row is close to per-member.
- **Where it goes.** Nothing goes to analytics, logs, Discord, AI or translation, exports or a shared cache. The page stays per request (D143).

**Code.**

- `lib/private/insights-zones.ts` (pure): `zoneCountsOf`, `zoneGroups`, `nextReset`, `nextKvk`, `usualHours`, `busiestHours`.
- `lib/private/insights-zones-words.ts`: `zonesWords`.
- `InsightsView.zones` in `lib/private/insights.ts`.
- `ZonesCard` in `app/(private)/_ui/InsightsZones.tsx`.
- `weekday` added to `dateWords` (`lib/date-words.ts`).
- Copy: `insights.zones.*` in `lib/private/dictionary.insights-zones.ts` (EN, PT-BR, FR).

**Tests.**

- `lib/private/insights-zones.test.ts` (PGlite, through `insightsView` and `zonesWords`): grouping and order, who counts and the not-recorded count, a summer-time change that splits a group, the reset and KvK on non-UTC clocks (New York, Manila, Kiritimati), the next KvK never a running one, usual-hour ranges through midnight, and no zone at all. Each test was checked to fail when its rule is broken.
- `e2e/desk-insights.spec.ts`: the card on the seed (`ZONE_FACTS`: two members in Manila, one in São Paulo; no summer time) and the add link to Members.

**Not done (follow-ups).** A note that a zone recorded as an offset ("ST +3") does not follow summer time. The date of a clock change. The word "night" beside night-time values. A region subtotal.
