# 08zzk — Spike: compare one event against another (#177)

Owner's request (2026-11-07, Portuguese): compare one event against another, to see how much might the players lost in one event and in the other, plus any other useful event-vs-event figure.

## Built
- This file and 11 mockups, `docs/screenshots/08zzk-*.png`: the compare page (`alliances-360-{light,dark}`, `alliances-1280-{light,dark}`, `alliances-details-360-light`), one alliance's members A vs B (`alliance-members-360-{light,dark}`, `alliance-members-1280-{light,dark}`) and the "Compare" link on the event page (`event-link-360-light`, `event-link-1280-dark`).
- The mockups come from a throwaway prototype (`lib/queries/compare.ts`, `app/(pages)/events/compare/page.tsx`, a temporary link in `app/_ui/EventView.tsx`) on a local `next dev` against the Neon preview branch (seed data). The prototype was deleted and `EventView.tsx` restored before the commit; nothing of it is in this PR.

## Decisions

### 1. What exists, and what is missing for "event A vs event B"
- **Alliance page, "Across events"** (`app/_ui/AcrossEvents.tsx`, data `allianceHistory` in `lib/queries/alliances.ts`): one row per event, newest first. Each row shows the event's **reference value** (after row, else before) for Might, Kills, Members, Level and the change **since the previous event's reference value** (`compute.seriesDeltas`). Ledger rank by might, moved event over event. It does **not** show the in-event change (after − before) at all.
- **Player page, "Across events"** (`app/_ui/PlayerAcrossEvents.tsx`, `playerHistory`): the same rows, plus a line `since 10:00` with the in-event change (`inEvent`) and a line `since Oct 24` with the change vs the previous event.
- **Event page**: the in-event change for every alliance (ledger) and Movers (D53) — for one event only.
- **Missing for the owner's question:**
  1. "How much did they lose in A, and in B" is the **in-event change** of two events side by side. Today it exists only per event (event page) and per player (`since 10:00`), never for two chosen events and never per alliance across events.
  2. "Previous event" is the only pairing: no way to pick two events that are not neighbours (e.g. two KvKs with an Origin of Chaos between them, #175).
  3. No server-wide total ("all tracked alliances lost X in A, Y in B").

### 2. Metrics, and which are fair
Per event E and per alliance or member X, the comparison needs three things, and nothing else:

| Figure | Today | Use on the compare page |
|---|---|---|
| in-event change of Might and Kills | after − before (`compute.delta`); null when a side is missing, stale or failed | the main number, A line and B line |
| members in-event | `member_count` after − before, joined/left by `rosterDiff` | the Members column; `*` (D33) when Might fell while members left |
| ledger rank by might | `eventRanks` (before, after), move by `rankDelta` | `#n` with its move, under each line's date |
| reference value | after, else before (glossary) | Details: A's reference → B's reference, and joined/left between the two |

Fairness:
- **Absolute change** favours big alliances. **Percent of the opening value** is fair across alliance sizes and is already printed by `Delta`. Show both, as every page does.
- **Different rosters:** the in-event change of an alliance includes members who left during the event (D53 keeps one number, with `*`). Per-member averages (change ÷ members) are not shown: with members leaving mid-event the divisor is not one number. Not recommended for v1 of the page.
- **Different kinds of event (KvK vs Origin of Chaos, #175):** no number makes them equal; they have different lengths and windows. The page shows each event's title (D49) and, once #175 adds a kind, the kind beside it. It does not normalise.
- **Server totals** must be summed over the **same set of alliances** in A and B: alliances with a usable change in **both** events, with the count shown ("19 alliances with both readings fresh in both events"). The prototype summed each event's own set (20 and 19), which compares different sets; the build should use the intersection.
- **Kills between events can fall** (URSA in seed: −105K from Oct 24's reference to Oct 31's) because the roster's kills sum loses the kills of members who left. The between-events change stays in Details only, as "Across events" already shows it.
- **Stale, failed or missing side:** no change (`—`), the `○ Stale` / `✗ Failed` mark as everywhere, not ranked, not in the totals (INVARIANT freshness.no-stale-delta, D53). A snapshot that is `partial` shows up only through those rows; the page's count line says how many alliances were usable.

### 3. Where
- **A page** `/events/compare?a=<event id>&b=<event id>`, optional `&alliance=<union_id>` for one alliance's members. In the App Router a static segment beats `[id]`, so it lives next to `/events/[id]` without a change there.
- **Picker in the page:** two native `<select>` (A, B) in a GET form, a ⇄ swap link and a "Compare" button. Works without JavaScript; the URL is the shareable link. Each option reads like the header selector's list (title, else date).
- **Defaults:** B = the home event (`homeEvent`); A = the newest public event with data before B.
- **Entry points:** a "⇄ Compare" link in the event page's title row next to "Exact numbers" (`/events/compare?b=<this event>`, A defaults to the one before). Each alliance card on the compare page links to its members view (`&alliance=`); each member links to the player page.
- **Header selector (D49, 08zzc amendment):** unchanged. The compare page passes no current event, so the closed selector reads "All events" like the player pages; its list still goes to single events. The two in-page selects are the compare controls.
- **Layout:** the player page's `history-row` shape turned on alliances: one card per alliance, a line per event (date and `#n move` on the left, then Might, Kills, Members change). Below 640 px a card, from 640 px a row with the alliance name spanning both lines. No chart. Ordered by ledger rank by might at B.
- **Which events can be picked:** `publicEvent` (any event a viewer can open, manual rounds included), not only `chainEvent`, because the pair is chosen by hand.

### 4. Cost
- Upstream quota: 0. Storage: 0. Migration: none. New dependency: none.
- Reads through `lib/queries` only, reusing `getEventDetail` (×2), `eventRanks` (×2) and one member query over the 4 snapshots; compute through `compute.delta`, `rosterDiff`, `rankDelta`.
- Query time: see Verified. About the same as today's event page.
- Copy: about 10 new keys ("Event vs event", "Compare", "A", "B", the count line, "not in alliance", the swap label, the Details line, the page title pattern) in 18 languages through the translate-copy skill (D48).

### 5. Related issues
- **#129 (compare two players):** a different axis. Event compare is all alliances × two events; player compare is two players × all events. One page should not serve both. They share the two-line card and the `?a=&b=` URL convention, so #129 could later be `/players/compare?a=<uid>&b=<uid>` built on the same card.
- **#175 / #171 / #176 (08zzh, event model):** see "Assumptions about the event model" below.

### Assumptions about the event model (08zzh is changing it in parallel)
The comparison reads, per event and per entity (alliance by `union_id`, member by `uid`), an **event figures** record: `opening` (the first usable reading), `reference` (the last usable reading: the glossary's reference value), `change` (the in-event change, null when unusable) and the ledger rank at opening and at reference. Today `opening` = before, `reference` = after else before, `change` = after − before. The compare page uses only that record, so it holds under either model if these hold:
1. **One change per event per entity per metric.** With several windows (#175 option A) the event model decides whether `change` is `reference − opening` (which also counts growth between windows) or the sum of the windows' changes. The compare page takes whatever single number the model calls the event's change. If 08zzh shows both "window 1", "window 2" and "total", the compare page uses "total".
2. **The event stays the unit.** If #175 picks linked events (option B: "part 1" and "part 2" as two events), the compare page compares parts; comparing whole groups would need a group's change (the sum of its parts) — a second producer of the same record.
3. **Samples through the event (#171) are not read.** The compare page needs no grain finer than opening and reference.
4. **Freshness rule unchanged:** a stale or failed reading gives no change.

## Deviations
- The mockups' badges show the no-badge drawing on the compare page and a broken image on the event page: `next dev` ran with `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL` pointed at `127.0.0.1:9` so that no upstream call was possible, and `/img/badge` could not reach its source. Member photos show the no-photo drawing for the same reason. Not a design choice.
- The prototype's totals sum each event's own usable set (20 and 19 alliances); the recommendation is the intersection (Decisions §2).
- The prototype's one-alliance view read all 7,190 member rows and filtered in JavaScript; the build should filter by `union_id` in SQL (392 rows for URSA, measured in the same run).

## Verified
All numbers from the Neon **preview** branch (seed: 3 public events Oct 17, 24, 31; 20 alliances; snapshot statuses: Oct 17 after `partial` with 1 failed row, Oct 31 after `partial` with 1 stale row), read-only SELECTs, 2026-11-07. No upstream call, no `/api/quota`, no `/api/tick`, no `/api/snapshot`, no internal-source call.

| Measurement (this Mac → Neon, 5 runs after a warm-up) | min | median | max |
|---|---|---|---|
| `getEventPage(3)` (today's event page read) | 1,489 ms | 1,495 ms | 1,519 ms |
| `allianceHistory(NSE)` | 300 ms | 304 ms | 308 ms |
| prototype `compareEvents(2, 3)`, all alliances | 1,062 ms | 1,350 ms | 1,366 ms |
| prototype `compareEvents(2, 3, URSA)` | 1,050 ms | 1,195 ms | 1,338 ms |

- Rows read: 7,190 member rows (4 snapshots of events 2 and 3: 1,798 + 1,798 + 1,798 + 1,796) plus 80 alliance rows. JSON size of the all-alliances result: 20.6 KB.
- The time is round trips (about 150 ms per query from here; `events` alone took 152 ms), not row volume. From Vercel, next to Neon, it will be lower; not measured.
- Seed results on the mockup (Oct 24 vs Oct 31): totals Might +1.14B (+2.1%) and +921M (+1.7%), Kills +10.4M (+3.2%) and +7.64M (+2.4%), 20/20 and 19/20 usable. URSA: Oct 24 +78.6M, Oct 31 −71.3M (−1.9%) with `*`, members −2; Details: reference 3.74B → 3.74B (+5.89M), kills −105K, 0 joined / 2 left. TEST: Oct 31 `—` and `○ Stale`. The seed is synthetic (almost every alliance gains); the real Nov 7 event lives on the production branch, which this spike did not read.
- Page checks on `next dev`: `/events/compare?a=2&b=3`, `…&alliance=67110320` and `/events/3` answered 200; `document.documentElement.scrollWidth` was 360 at 360 px and 1280 at 1280 px on every capture (no horizontal scroll).
- `pnpm check` not run: this PR changes only Markdown and PNG files.

## Open issues
- `StatMetric.vs` (`app/_ui/StatTable.tsx`, "a second change shown under the first") is rendered by `StatTable` but no caller sets it today. Option B would use it; otherwise it is dead code. Not touched.
- The player page has the in-event line (`since 10:00`) and the alliance page does not. Option C closes that gap on its own.
- The production branch was not read, so no real-event numbers exist here. After a second real event, the build session can check the totals line against two real events.

## Options

| | A. Compare page (recommended) | B. "Compare with" on the event page | C. In-event line in the alliance "Across events" |
|---|---|---|---|
| What the viewer gets | any two events, all alliances side by side, server totals, one alliance's members A vs B, shareable URL | the event page's ledger gets a second change line per figure (`vs Oct 24`), picked by `/events/<id>?vs=<id>` | on each alliance page, every event's in-event change listed one under another (players already have it) |
| Answers "lost in A vs lost in B" | yes, for every alliance and member | yes for alliances; members need the same on the alliance page | yes, one alliance at a time; no picking, no server total |
| Quota / storage / migration | 0 / 0 / none | 0 / 0 / none | 0 / 0 / none |
| Query time | ≈ 1.35 s median (measured, prototype) vs 1.50 s for today's event page | event page + one more `getEventDetail` and `eventRanks` (not measured; ≈ +0.5 s from the round-trip count) | no extra query: `allianceHistory` already selects both phases' rows and then keeps one per event (304 ms median today) |
| Work | one session, ≈ 2–3 h: `lib/queries/compare.ts`, one page, one view, ~10 copy keys × 18 languages, 2 tests | ≈ 2 h: `?vs=` parsing, `StatMetric.vs` on the ledger, a second picker on the event page, the same copy work | ≈ 1 h: one line in `AcrossEvents`, `HistoryRow.inEvent`, 1 test, 1–2 copy keys |
| New rules | DESIGN.md component `event-compare` and a Navigation line; D56 (route, defaults, totals over the intersection, `publicEvent`) | amends DESIGN.md "Main page … → movers → nothing else" again (D53 already did once); D56 | none beyond a DESIGN.md `history-row` note |
| Risks | a new page to keep in step with the event page's row rules | the busiest page gets busier for everyone; the event page's URL and caching gain a parameter; the header selector and an in-page picker both change "the event" | does not answer "event vs event" for the server; easy to read as enough when it is not |

**Recommendation: A**, with the "Compare" link on the event page and the members view behind each alliance card. It is the only option that answers the owner's question for any two events at once, it adds no quota, storage or migration, it reads in the same time as today's event page, and it leaves the event page as it is apart from one link. C is a cheap, independent improvement worth its own small change later; it does not replace A.

## Next
Session: build of option A — next free session number, `session/<NN>-event-compare`.
Model / effort: keep (opus · high) — one query module, one page and 18-language copy, the same size as 08zze Movers.
Owner must do first: pick an option and answer the questions in the PR (default A, totals over the intersection, members view in the first build, mixed event kinds allowed). If 08zzh's event model is merged first, the build reads its figures; if not, it builds on before/after as written below.
Plan changes needed: IMPLEMENTATION_PLAN.md Phase 5e or §"Not in v1" — add "event vs event" as a v1.x page (owner's call); no edit made here.

```text
<session>
Session <NN>-event-compare. Read CLAUDE.md, docs/handoff/00-prereqs.md, docs/handoff/08zzk-spike-event-compare.md (the spec and mockups docs/screenshots/08zzk-*), docs/DESIGN.md ("Navigation and hierarchy", Layout, Components `stat-card`, `history-row`, `details-table`, `event-selector`), docs/DECISIONS.md D33, D49 with the 08zzc amendment, D53, and docs/GLOSSARY.md (reference value, delta, ledger rank, rank movement). If docs/handoff/08zzh-spike-event-model.md is merged and its build has landed, read it too.
</session>

<task>
Build the event-vs-event page (issue #177, option A):
- lib/queries/compare.ts: `compareEvents(db, a, b, unionId?)` from getEventDetail, eventRanks and one member query over the two events' snapshots (filtered by union_id in SQL when unionId is given). Per alliance and per event: the in-event change of might and kills (compute.delta; a missing, stale or failed side gives null), members after − before with joined/left (rosterDiff), ledger rank by might at after with its move (rankDelta), and the reference value. Per alliance between A and B: reference → reference and joined/left. Server totals over the alliances usable in BOTH events, with that count. Both events through `publicEvent`. Export from lib/queries/index.ts.
- `/events/compare?a=&b=[&alliance=]`: two native selects (A, B) in a GET form, a ⇄ swap link, "Compare"; defaults B = homeEvent, A = the newest public event with data before B; an unknown id is a 404; a = b shows the empty state. Then the legend, the totals band (Might, Kills, Members: A line and B line), one card per alliance ordered by ledger rank at B: badge and name, an A line and a B line (date, `#n move`, Might, Kills, Members change), Details with A's reference → B's reference and joined/left. With `alliance`: breadcrumbs, that alliance's card, then its members (A line and B line each; "not in alliance" for a side without the member), each linking to the player page.
- A "⇄ Compare" link in the event page's title row next to Exact numbers, to `/events/compare?b=<this event>`.
- Page <title>: `<A date> vs <B date> · <site name>`.
- Copy keys in lib/copy.ts and all 18 languages via the translate-copy skill.
- DESIGN.md: an `event-compare` component line and the Navigation line for the new page. DECISIONS.md: D56 (route, defaults, totals over the intersection, publicEvent, header selector reads "All events").
- Tests: one for compareEvents (a stale side is null and left out of the totals; totals cover only alliances usable in both events) on PGlite, sized like lib/queries/players.test.ts.
- Screenshots at 360 and 1280 px, light and dark → docs/screenshots/<NN>-event-compare-*.png.
</task>

<constraints>
- No migration, no new dependency, no upstream call. Reads only through lib/queries.
- Blocked roster keys and avatar_url never selected (D22). Members: uid, name, power, kills only.
- Mobile-first at 360 px: cards below 640 px, 44 px targets, nothing hover-only, no charts.
- The header selector is not changed.
</constraints>

<done_when>
The page renders from seed data at both widths and themes; the event page links to it; pnpm check is green; docs/handoff/<NN>-event-compare.md written. PR: "feat(compare): event vs event page (#177)".
</done_when>
```

<adjustments>
- Measured on the preview seed: `compareEvents` for all alliances reads 7,190 member rows and 80 alliance rows and takes ≈ 1.35 s median from a Mac (today's `getEventPage`: 1.50 s); the time is round trips (≈ 150 ms each), so run independent reads in one `Promise.all`.
- One alliance's members: filter by union_id in SQL (392 rows for URSA) instead of reading every roster.
- `/events/compare` coexists with `/events/[id]` without any change to `[id]` (a static segment wins; `[id]` already 404s non-digits).
- Reuse `MoreBar`, `DetailTable`, `Delta` (with `stack` and `memberMark`), `Rank`, `FreshDots`, `Legend`, `LABEL` and the `PlayerAcrossEvents` grid pattern (`--cols` custom property, lead spanning two rows from 640 px). In the prototype, a spacer cell between the two lines broke the ≥ 640 px grid: the lead's `sm:row-span-2` already fills that cell.
- `next dev` with `LAP_API_BASE_URL`/`LAP_SITE_BASE_URL` at `127.0.0.1:9` shows broken badge images on existing pages; expected, not a bug in the new page.
</adjustments>

<adjustments for="#129 compare two players">
- Use the same two-line card and the `?a=&b=` URL shape (`/players/compare?a=<uid>&b=<uid>`); do not merge it into the event compare page.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/186
