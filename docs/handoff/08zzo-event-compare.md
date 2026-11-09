# 08zzo — Event vs event page (#189, from spike #177)

## Built
- `lib/queries/compare.ts` (exported from `lib/queries/index.ts`):
  - `compareEvents(db, a, b, unionId?)`: both events through `getEventDetail` (so `publicEvent`), `eventRanks` for each, and one member query over the two events' snapshots, filtered by `union_id` in SQL when `unionId` is given. Per alliance and event: the in-event change (`compute.delta`), members After − Before with who left (`rosterDiff`), ledger rank by might at After with its move (`rankDelta`), the reference value, and each side's state. Per alliance between A and B: joined and left from A's reference roster to B's. Per member of one alliance: power, change and Before values per event, or no side when the member is in neither of that alliance's rosters of that event.
  - `compareTotals`: sums over the alliances with a change in **both** events, with that count.
  - `getComparePage(db, { a, b, unionId })`: the defaults (B = `homeEvent`, A = the newest event with a complete or partial snapshot before B), the picker's choices, and `found: false` for an id that is not a public event or an alliance in neither event.
  - `comparable(event)`: an event with a complete or partial snapshot.
- `app/(pages)/events/compare/page.tsx`: the route, its `<title>` (`Oct 24 vs Oct 31 · OG's LAP Tracker`), 404 for a malformed or unknown id, the empty state for A = B or no A.
- `app/_ui/ComparePicker.tsx`: the GET form (two native selects, ⇄ swap link, "Compare"), `compareHref`, and `CompareLink` ("⇄ Compare", shown when two events have data).
- `app/_ui/EventCompare.tsx`: the totals band, the alliance card, the member card and the table header.
- `app/_ui/EventView.tsx`: the event page's title row holds "⇄ Compare" beside Exact numbers (`TitleActions`).
- Copy: 13 keys under `compare` in `lib/copy.ts`, in all 17 other languages, stamped; glossary rows added in de, fr, id, it, ko, nl, pl, ru, th, tr, uk, vi, zh-CN.
- `lib/queries/compare.test.ts`: three PGlite tests (stale side and totals over the intersection; the members view and no blocked key; the defaults).
- docs/DECISIONS.md D57; docs/DESIGN.md: the Navigation line, the breadcrumb exception and the `event-compare` component.
- 14 screenshots, `docs/screenshots/08zzo-event-compare-*.png` (listed under Verified).

## Decisions
- The owner's answers of 2026-11-08 (recorded in D57 and in the spike handoff): option A, totals over alliances usable in both events, the members view in this build, event kinds left open (#190).
- A member who is in an alliance's Before roster of an event but not its After (left during the event) reads `—` on that line, not "not in alliance": they were in it that day, but there is no change to show. "not in alliance" is only for a member in neither roster of that event. The spike's mockup showed "not in alliance" for such a member; this build is stricter.
- A line's head is the event's date; when both events fall on the same day it adds the time (`Nov 7 10:00`), so two manual rounds of one day stay apart.
- The picker lists every event with a complete or partial snapshot, plus A and B when the URL names an event without data, so the selects always show what is compared.
- A rehearsal id (`is_test`) or an admin-only manual round is a 404, like `/events/[id]`.

## Deviations
- **D57, not D56.** The spike's prompt said D56; 08zzl took D56 (officer titles) before this session.
- **ko translated by this session, not the translator agent.** The ko and vi translator runs stopped on the account's rate limit (HTTP 429, "5-hour limit", resets 08:00 America/Sao_Paulo). vi had already written all 13 keys and its glossary row before it stopped; ko had written nothing, so this session wrote ko by the translator's rules (the glossary's 연맹, 이벤트; no game terms in these keys) and added one glossary row. The skill allows rerunning a language on a bigger model; a native speaker check of ko and vi is still worth doing.
- The two new file-header comments say "issue 177", not "#177": `lib/brand/tokens.test.ts` reads `#177` as a hex colour literal.

## Verified
- `pnpm check` exit 0: prettier, eslint, tsc, vitest (46 files, 218 passed, 1 skipped), drift gate, `i18n: 17 languages up to date with English`.
- `lib/queries/compare.test.ts`: 3 passed.
- Local `next dev -p 3472` against the Neon preview branch (seed: events 2 = Oct 24, 3 = Oct 31; read-only), with `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL` at `127.0.0.1:9` so no upstream call was possible. Status codes:

| URL | Status |
|---|---|
| `/events/compare` (defaults: A = Oct 24, B = Oct 31) | 200 |
| `/events/compare?a=2&b=3` | 200 |
| `/events/compare?a=2&b=3&alliance=67110320` | 200 |
| `/events/compare?a=3&b=3` (empty state) | 200 |
| `/events/compare?a=999&b=3` | 404 |
| `/events/compare?a=x` | 404 |
| `/events/compare?a=2&b=3&alliance=1` | 404 |
| `/events/compare?a=4&b=3` (event 4 is a rehearsal) | 404 |
| `/events/3` | 200 |

- Query time on the preview branch from this Mac (5 runs after a warm-up): `getEventPage(3)` min 1,499 / median 1,507 / max 1,597 ms; `getComparePage(a=2, b=3)` 1,522 / 1,532 / 1,682 ms; with `unionId` = URSA 906 / 1,053 / 1,062 ms.
- Seed results (Oct 24 vs Oct 31): totals over 19 of 20 alliances (TEST is stale on Oct 31): Might +1.08B (+2.1%) and +921M (+1.7%), Kills +9.82M (+3.3%) and +7.64M (+2.4%), Members 0 and −2. URSA: Oct 31 −71.3M (−1.9%) `*` and −1.03M (−3.4%) `*`, members −2; Details 3.74B → 3.74B (+5.89M), +0 joined · −2 left.
- Screenshots (`document.documentElement.scrollWidth` equal to the width on every one, so no horizontal scroll): `list-{360,1280}-{light,dark}`, `list-360-light-{ru,de}`, `details-360-light`, `members-{360,1280}-{light,dark}`, `event-link-360-light`, `event-link-1280-dark`, `same-360-light`.

## Open issues
- Alliance badges show a broken image in these screenshots: the local server could not reach `/img/badge`'s source with the upstream URLs pointed at a dead port. Same on every page in this setup; not from this change.
- The `—` of a member who left during an event says nothing about why. A "left" word there would be a new copy key and a design call; not done.
- `StatMetric.vs` (`app/_ui/StatTable.tsx`) is still unused; #191 is meant to use it.

## Next
Session: #191 — in-event change in the alliance page's "Across events" (option C), `session/<NN>-across-in-event`.
Model / effort: keep (opus · high) — one field in `allianceHistory`, one line in `AcrossEvents`, one test; smaller than this session.
Owner must do first: merge this PR into `dev` (#191 is blocked by #189, which this PR closes). Close #177 by hand if it is still open (PRs into `dev` do not auto-close issues).
Plan changes needed: none.

<adjustments>
- The prompt in #191 stands. `allianceHistory` (`lib/queries/alliances.ts`) already selects every phase's row and `pickReferences` keeps one per event, so the in-event change needs the before row kept beside the reference, not a new query.
- Reuse what this session added where it fits: `compute.delta` with a failed or stale side as not fresh (as `measured` in `lib/queries/compare.ts`), and the `*` rule (`Delta`'s `memberMark` when the change is negative while members left, with `left` from `rosterDiff`).
- After #188 the alliance "Across events" has three columns (Might, Kills, Members); Level is gone there. The new line has three cells.
- The translator agents (Haiku) can hit the account's rate limit when 17 run at once: check each report came back, and look in `lib/i18n/<tag>.ts` for a language whose agent stopped before reporting (vi had finished its edits).
</adjustments>
