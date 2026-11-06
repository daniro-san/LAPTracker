# 08zj — Header event selector on one row; events named by their title (#132, label part of #130)

## Built

- Owner's choice after the Phase 1 mock (2026-11-05): option B + "All events". Recorded as D49.
- `app/_ui/SiteHeader.tsx`, the closed event selector:
  - It shows the current event's date only: `Thu, Nov 5` from 360 px up, `Nov 5` below.
  - A manual round adds the ✎ mark.
  - Its accessible name carries the full title: "Manual round: <title>, Thu, Nov 5".
  - With no current event (the player page and /players) it reads "All events" (`copy.site.allEvents`) instead of "Events".
  - `whitespace-nowrap` keeps it to one line.
- The selector's list: each row is the event's title. Under the title, in small text, are the ✎ mark, the date and "latest". An event with no title shows its date alone, plus "latest" on the newest one.
- `app/_ui/EventLabel.tsx`:
  - `eventTitle(e)` returns the event's name for a manual round or a renamed event. It returns null while a scheduled event keeps its generated name.
  - `EventLabel` renders the title, or else the weekday date.
  - `ManualMark` renders the ✎ with the screen-reader text "Manual round:". It replaces the boxed "Manual round" tag.
- `lib/schedule.ts` `isGeneratedName(name)` matches the name `eventOn` generates (`<Weekday> Event YYYY-MM-DD`), with or without the seed's `Seed ` prefix.
- `app/_ui/EventView.tsx`: the heading is the event's title, with the long date (and ✎ for a manual round) under it. An event with no title keeps the long date as its heading, as before.
- `app/_ui/PlayerAcrossEvents.tsx`: each "Across events" row links the event by its title, with the weekday date under it, or by the weekday date alone.
- Docs:
  - `docs/DESIGN.md`: the `header` entry, a new `event-selector` entry, and the `history-row` entry.
  - `docs/DECISIONS.md`: D49.
  - `docs/GLOSSARY.md`: "event title".
- Screenshots: `docs/screenshots/08zj-header-before-360.png` and `08zj-header-after-360.png`.
- `app/_ui/EventLabel.test.ts` was rewritten for the new behaviour: a generated name gives the date, a renamed event gives its name, and a manual round's name is rendered as escaped text.

## Decisions

- D49 (number assigned by the coordinating session; D40–D48 are reserved for other lanes).
- "Has a title" is decided from the name itself (`isGeneratedName`), not from a new column. Renaming (D39) only changes `events.name`, so the generated name is the only signal there is. A scheduled event the owner renames to exactly `Saturday Event 2026-11-07` would be shown as its date. That is the same information.
- The "Across events" rows use `isGeneratedName(r.eventName)` directly: `PlayerEventRow` has no `manual` field. Adding one would mean changing the query only to show a ✎ there, which the task did not ask for. A manual round's row shows its name and date without the ✎.
- /brand does not show the event selector or `EventLabel`, so it is unchanged.

## Deviations

- At 320 px, "All events" in German ("Alle Ereignisse") and Russian ("Все события") overflows its box in the mock; English fits. 360 px (the design width) fits in all three. Shown to the owner before the choice.
- The alliance page breadcrumb still reads `Ledger · Thu, Nov 5` (`crumbsFor` in `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`). The task named `EventLabel` and the "Across events" rows, not the breadcrumb.

## Verified

- Setup:
  - Throwaway local Postgres 18 (scratchpad, 127.0.0.1) with the drizzle migrations applied by psql and `pnpm db:seed`.
  - Added by SQL: event 5 "Manual round Nov 5 · retake after the reset" (manual, `history`, cloned from event 3), and event 3 renamed to "KvK 12-11".
  - A WebSocket→TCP bridge and a temporary `neonConfig` block in `lib/db.ts`, as in 08u. The block is reverted and not committed.
  - Upstream API calls: 0. No Neon database was touched.
- Captures:
  - playwright-core + system Chrome, one new context per capture, so cookies are clean.
  - Exact viewport and `prefers-color-scheme` emulation.
  - German and Russian were faked by setting the browser locale (`de-DE`, `ru-RU`, so Intl dates are real) and swapping the header's English words in the DOM after load. Nothing of that is in the repo.
- Before, on dev:
  - Header 64 px everywhere except with a manual round selected. Then it is 140–160 px at 320/360/390 in en/de/ru, light and dark.
  - With a manual round selected, at 320 and 360 px the settings gear was pushed past the right edge (horizontal overflow).
  - At 320 px a scheduled date (`Sa., 24. Okt.`) wrapped to two lines inside its 44 px box.
  - "KvK 12-11" appeared nowhere.
- After, at 360 px: header 64 px, every control one line, nothing past the right edge. That holds for the event page (scheduled, manual round, renamed), the alliance page (manual round), the player page and /players, in en, de and ru, light and dark: 36 of 36 captures.
- After, at 320 and 390 px (manual round, renamed, player; en/de/ru): one row except "All events" at 320 in de and ru (see Deviations).
- Accessible name of the closed selector (text content including screen-reader text):
  - "Manual round: Manual round Nov 5 · retake after the reset, Thu, Nov 5 ▾"
  - "KvK 12-11, Sat, Oct 31 ▾"
- `pnpm check`: green (prettier, eslint, tsc, 38 test files / 163 tests, drift check).

## Open issues

- Pre-existing, not fixed, the owner was told: the selector's first row ("latest") links to `/`. `/` shows the newest scheduled event (D28), so when a manual round is the newest event, "latest" opens the scheduled event, not the round. Checked locally: `/` rendered "Saturday, October 31" while the round was newest. `crumbsFor` on the alliance page has the same `events[0]` → `/` rule.
- PR #136 (#60 translation) is open and also edits `lib/copy.ts`. The new `copy.site.allEvents` key needs a translation there, whichever PR merges second.
- The ✎ mark is new and has no entry in the legend. DESIGN.md's legend lists arrows, the stale mark, the rounded mark and `[TEST]`.

## Next

Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches only the header, the event heading and the player rows; nothing on the collector, cron or quota path.
Owner must do first: merge this PR into `dev`. No migration, no new environment variable.
Plan changes needed: none.

<adjustments>
- A rehearsal is `is_test` and never public, so it never reaches the event selector. Public pages name a scheduled event by its date until it is renamed on /admin; a renamed one ("KvK 12-11") is shown by that name in the selector's list, the event heading and the player's "Across events" rows.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/138
