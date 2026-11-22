# feat/insights-time-zones: a Time zones card on the officers' Insights

The owner asked for this on 2026-11-22: "in the officers' Insights, something grouped by time zones, showing which time zones have more players, and what the server time is for those time zones, etc." Size M: a new Insights section and a new decision (D152). Planned with `/tlc-spec-lean` in `.specs/features/insights-time-zones/plan.md` (criteria, panel verdicts) and `checks.md`.

## Built

- **A "Time zones" card, the last on Insights** (after Raid Shield check). It is in `app/(private)/_ui/InsightsZones.tsx`.
  - Shown without a tap:
    - "Largest group: Manila (UTC+8), 2 of the 3 members with a time zone. The 00:00 ST reset is 10:00 for them."
    - "Time zone recorded for 3 of the 11 members in the newest daily update."
  - Behind "Show the details":
    - a legend saying what the times and the bar are;
    - one row per group, west to east. Each row has its cities and offset ("Paris, Zurich and 1 more · UTC+1"), the count, a bar (its share of the members with a time zone) and "Now 10:00 · Reset Sun 21:00 · KvK Sat 09:00" on that group's clock;
    - "Not recorded yet", a count with no bar, and "Add their time zone ›" to `members?ask=timeZone`;
    - "Within their usual hours for the most: 11:00–12:59 ST, …" with "See who ›" to `members?day=11`.
  - With no time zone recorded, the card shows one line and the add link.
- **The rules** are in `lib/private/insights-zones.ts` (pure):
  - `zoneCountsOf`: the newest daily update's members only, by their latest `timeZone` fact. A cleared fact counts as not recorded.
  - `zoneGroups`: groups by the offsets now, at the next reset and at KvK, then sorts west to east.
  - `nextReset`, and `nextKvk`: the first KvK start after now, from `EVENT_WEEKDAY`/`EVENT_TIME`.
  - `usualHours` and `busiestHours`: Members' 08:00–22:59 rule, with runs through midnight.
- **The words** are in `lib/private/insights-zones-words.ts`. The headline has sentences for the largest group, a tie, a single group and a single member. A row says "Clocks change before the reset" or "Clocks change before KvK" when summer time changes before that moment.
- **The read** adds `InsightsView.zones` in `lib/private/insights.ts`. It reuses the `factsOf` the page already reads, so there is no new query and no upstream call.
- **`dateWords` gains `weekday`** ("Sat"), in `lib/date-words.ts`.
- **Copy** is `insights.zones.*` in `lib/private/dictionary.insights-zones.ts` (EN, PT-BR, FR), spread by `dictionary.insights.ts`. `Fold` in `InsightsMore.tsx` is now exported.
- **Tests.**
  - `lib/private/insights-zones.test.ts` (PGlite, 8 tests): grouping and order (no name or uid in the words), who counts, a summer-time split (Paris and Lagos across the EU change), a change before KvK with a tie named west to east, the reset and KvK in New York, Manila and Kiritimati, the next KvK never a running one, usual-hour ranges, and no zone.
  - `e2e/desk-insights.spec.ts`: the card on the seed and the add link to Members.
  - `e2e/fixtures/seed-facts.ts` (new) holds the seed's fact rows: the Troops rows moved out of `seed.ts` for its 300-line limit, plus `ZONE_FACTS` (seed-people.ts: k=0 and k=3 Manila, k=5 São Paulo).
- **Docs.** D152, D139's dated amendment, and the README index line.

## Decisions

- Every choice the panel settled is in D152 and in the plan's Assumptions:
  - groups by the offset at three instants;
  - west to east;
  - the card last;
  - counts only;
  - three moments;
  - "Add their time zone ›" to Members, not Follow-up;
  - "within their usual hours", not "awake".
- "UTC+0" stays as it is, not "UTC" as the officers asked: the glossary has one offset form.
- KvK's time comes from the schedule config, not the events table. The adversarial reviewer accepted this: the table's row exists only a day ahead. `nextEvent` is not used, because it returns a KvK that is already running.
- The card computes its words itself (`ZonesCard` calls `getEnv()`), so the page stays under the 80-line function limit.

## Deviations

- **The clock-change note has no date.** The adversarial reviewer asked for the date; it says "Clocks change before KvK" instead. The reviewer accepted this in the second round.
- **The card is a new file**, `InsightsZones.tsx`, not part of `InsightsMore.tsx`, to keep that file under 300 lines.
- **The Verifier** (an independent sub-agent) found 4 issues, all fixed in the second commit (`verification.md`): the clock-change note named the reset when KvK came first; a tie was named west to east while the plan's example put London first (the plan now says west to east); the e2e did not check that the card is last and folded; the "no name" claim rested on a scan that cannot see own-member names (now a unit assertion).

## Verified

Local: Node 26.5.0, Postgres 18 (worktree `.pglocal` on 54320), Playwright Chromium.

- `pnpm vitest related --run` on the 9 changed source files: 76 files, 387 tests passed.
- `pnpm check`: exit 0 (prettier, eslint, tsc, Vitest 1761 passed and 4 skipped, drift, i18n). It failed twice first (formatting; then the page's function length and `seed.ts`'s line limit), and passed after the fixes and again after the Verifier's fixes.
- `pnpm test:e2e`, with the build: 53 passed, 3 skipped. This includes `desk-insights.spec.ts` on `phone` and `wide`, and `isolation.spec.ts` with the new facts seeded.
- **Deliberate breaks.** Each was run against `insights-zones.test.ts`, then reverted. Every one failed at least the test named for its rule:

  | Break | Fails |
  | --- | --- |
  | group by IANA zone | grouping, summer-time split |
  | east to west | grouping, clocks |
  | former members' facts counted | who counts (and 3 more) |
  | a cleared fact counted | who counts |
  | group by the offset now only | summer-time split |
  | times on the server's clock | grouping, split, clocks |
  | no weekday for another date | clocks |
  | a running KvK shown | next KvK |
  | no run through midnight | usual hours |
  | not-recorded in the share | who counts |
  | rows with no zone | no zone |

  For e2e, the add link pointed at `?ask=1`, which fails at `toHaveURL(…?ask=timeZone)`.
- **Screenshots** at 360×780 (Chromium, e2e seed), light and dark, the card closed and open. They were taken on the build machine and are not committed; the build agent's report gives their paths.
- **Plan review.** The panel ran on invented data:
  - the six officers, with the first-glance test;
  - a designer;
  - product strategy: approve with changes, adopted;
  - data honesty and adversarial: approve with changes, adopted.

  Their findings are in the plan's Validation section.

## Open issues

- **The "Now" time is the page's render time.** A tab left open goes stale. The legend shows that instant ("now (13:04 ST)").
- **A zone recorded as a fixed offset** ("ST +3" stored as `Etc/GMT-1`) never follows summer time. The card counts it without a city and does not warn about it.
- **The not-recorded count and Members' "Missing info: time zone" list can differ.** The card counts the newest daily update; Members lists today's roster and the new members. The row says so.
- **PT and FR copy** was written by the build agent. No copy-expert persona reviewed it.

## Next

Follow-ups:

- a note that a zone recorded as an offset does not follow summer time (adversarial, NICE);
- the date of the clock change in the row's note;
- "night" beside night-time values (designer, NICE);
- names per group behind a tap, or a `members?tz=` filter, only if officers ask (officers, NICE);
- a region subtotal ("Europe: 14");
- a PT-BR and FR copy review of `insights.zones.*`.

Analytics plan: none. The card adds no event or property. Its two links are ordinary page views of Members (click autocapture is off on `/w`), and no number in the tracking plan changes meaning.

What was missing from the task prompt? Whether "KvK start" should come from the events table (a row exists only a day ahead) or from the schedule config, and that `nextEvent` returns a KvK already running.

PR: (added by the orchestrator)
