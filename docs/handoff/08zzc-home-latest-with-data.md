# 08zzc — The home page shows the newest event with data, not an empty upcoming one

## Built
- `lib/queries/events.ts`: `homeEvent(events)`, a pure function over `listEvents` output (newest first). Rule: the newest non-manual event with a `complete` Before snapshot; else the newest event of any kind with one; else the newest non-manual event; else the newest event. Exported from `lib/queries`.
- `lib/queries/event-page.ts`: `getEventPage(db, null)` uses `homeEvent` and also returns `homeId`.
- `app/_ui/SiteHeader.tsx`: new required prop `homeId`. The selector marks the event with `id === homeId` "latest" and links it to `/`; every other event links to `/events/<id>`. Before, index 0 was "latest" and linked to `/`.
- `homeId` is computed on the server and passed down: `/` and `/events/[id]` from `getEventPage`, the alliance page from its loader, `/players` and `/players/[uid]` with `homeEvent(events)`. ErrorPage, EmptyEvents and AdminShell pass `null` (they show no selector).
- `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`: the "ledger" breadcrumb links to `/` only when the event is the home event (was: index 0).
- Tests: `lib/queries/events.test.ts` (the four cases from the brief, plus: a running Before or an After alone does not count), `app/_ui/SiteHeader.test.ts` (the home event is the selector link to `/` with "latest"; a newer upcoming event links to `/events/<id>`).
- `docs/DECISIONS.md` D28: one amendment line under "Home page".
- `docs/screenshots/08zzc-home-manual-round-360.png`.

## Decisions
- "Has data" = a Before snapshot with status `complete` (owner, 2026-11-06: the event takes the home page only once at least its Before exists). An After alone, or a running, partial or failed Before, does not count.
- D28 amended instead of a new D-number: the rule refines D28's "Home page" line and keeps its intent (a manual round never takes `/` from a real event that has data).

## Deviations
- The alliance page breadcrumb also used "index 0 = home". It now uses `homeEvent`, so it links to `/` only when `/` shows that event. One line; without it the breadcrumb of the newest event would open a different event at `/`.
- No new copy.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc, vitest 44 files / 203 passed (rerun after the Before-only change: same counts) / 1 skipped, drift and i18n gates clean.
- The selector test fails when `SiteHeader` goes back to index 0 (checked by hand, then restored).
- Local `next dev` on a throwaway stack: Postgres 18 in the scratchpad with `drizzle/0000`–`0011` applied by psql, a WebSocket→TCP bridge and a `NODE_OPTIONS` preload that sends the Neon driver's WebSocket to it, `env -i` with placeholder variables (no API key, upstream hosts on `127.0.0.1:9`, no webhooks, a generated PIN). Rows: `scripts/seed.ts`, then SQL reproducing production on 2026-11-06: the Oct 17/24 seed Saturdays hidden (`is_test`), the Oct 31 seed event turned into "Manual round 2026-11-05" (`manual`, Before and After `complete`), and "Saturday Event 2026-11-07" with no snapshot. No upstream call, no Neon database.
- Result at `/`: title "Thu, Nov 5", the manual round's alliance cards with numbers, no "Nothing recorded yet" line. Selector: "Sat, Nov 7" → `/events/5`; "Manual round 2026-11-05 · latest" → `/`. `/events/5` still opens Saturday's own page. 360 px: `scrollWidth` 360. Screenshot taken with system Chrome over CDP at 360 px, selector open: `docs/screenshots/08zzc-home-manual-round-360.png`. Badge pictures are blank there because the stack has no upstream. The browser run was done before "has data" was narrowed to a complete Before; the seeded rows give the same result under both rules (the manual round has a complete Before, Saturday has no snapshot), so it was not rerun.

## Open issues
- Once Saturday's Before is `complete`, `/` moves to Saturday at that moment. While the Before is `running`, `/` stays on the manual round. Expected under the rule; noted for the owner.

## Next
Session: none planned by this change; it rides in release v1.1.0 (PR 159, `dev → main`).
Model / effort: keep — a small query and header change.
Owner must do first: merge this PR into `dev` before merging the v1.1.0 release PR.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/161
