# 08zzzzr — Wording follow-ups: balance, kill share vs might share, fight clock

Basis: owner delegated; persona panel and adversarial review agreed, 2026-11-17. Amends D83, D85, D86.

## Built
- Server balance (`lib/copy-balance.ts`): the figures are the tracked alliances' might. Changed keys: `description`, `lead`, `total` ("Tracked alliances"), `shares` ("Share by alliance"), `bar`, `blocShare`. The page title stays "Server balance".
- Kill share vs might share: every row shows the points gap (`+6.1 pts`). The ratio appears only as its range (`carriedSpread`) from 3 events. `CarriedRow.ratio` is removed (unused). `carriedRatioHelp` is rewritten. One component test replaces the old one.
- Server fight clock: the "since" date is now the first sampled event over all scheduled public events (`getFightClock` in `lib/queries/fight-clock.ts`). `fightClockOffMissed` and `fightClockLead` rewritten. One new test.
- Translations: the 9 changed keys in all 17 languages, reusing each language's words for "tracked alliances" and Might. No glossary row added.
- D83, D85, D86 amended.

## Decisions
- The "since" fix reads `sampledEventIds` for all scheduled events (one extra query by event ids), not only the 12 shown.
- `ratio` removed from `CarriedRow` and its query; `spread` kept (CLAUDE.md: remove an unused field).
- `balance.total` in tr ("Takipteki toplam") and ko ("추적 연맹 합계") keep the `standing.server` wording so the pages agree. In vi, `standing.server` read "Máy chủ" (the server); the orchestrator changed it to "Liên minh theo dõi" in this PR, and `balance.total` uses the same words.
- No other public string calls this total "the server's might". Remaining matches are code comments only (`lib/balance.ts`, `app/_ui/BalanceBar.tsx`, `app/(pages)/alliances/balance/page.tsx`, `app/(pages)/events/compare/page.tsx`) and D85's earlier bullets (amended). No Discord copy matched.

## Deviations
- None from the request.

## Verified
- `pnpm exec tsx scripts/i18n-check.ts` before stamping: only the 9 changed keys stale in 17 languages, none broken, missing or extra. After `--stamp`: 17 languages up to date.
- `pnpm check` passes: 142 test files passed, 716 tests passed (4 skipped); drift clean; i18n: 17 languages up to date with English.

## Open issues
1. The ratio's earlier events include manual rounds (D83). The 14-hour manual round of Nov 5 gave 6 of 20 alliances a ratio of 0, so ranges reach 0×.
2. The fight clock's busiest-span share divides by the drawn slots' kills; the event page divides by all kills since Start. One event can show two different shares.
3. Drawing the last quarter hour from the End reading: only when the End is at most 1.5 cadences after the last sample, through `readingsOf`, so both pages change together.

## Next
Session: none planned; the orchestrator picks the next issue.
Model / effort: keep. The work was wording and one query fix.
Owner must do first: review the new English strings, then merge.
Plan changes needed: none.

<adjustments>
- `CarriedRow` has no `ratio` field now; use `spread` for the range.
- `getFightClock` already reads every scheduled event's sampled state; a window picker can reuse `allScheduled`.
</adjustments>

## UX review (2026-11-17)
Measured on the local seed (20 alliances, 3 events, 12 daily reads), Chrome at 360, 390, 412, 600, 768, 820, 1024 and 1280, light and dark; German and Russian at 360.
- `document.documentElement.scrollWidth` equals the viewport width on the balance page, the three event pages and the fight clock in every run.
- Balance: "Tracked alliances" and "Share by alliance" fit at 360 in en, de and ru with no clipping; the stacked bar and the figures line stay intact. The lead ("No alliance holds more than 9% of the tracked alliances' might; the top 3 hold 22%.") is two lines at 360 and still reads as the takeaway.
- Kill share vs might share: each row is the points gap ("+11.7 pts"), then the might and kills line, then the range line ("2.0×–2.5× over 3 events"); rows are sorted by the points gap. Rows with fewer than 3 events show no range line. de and ru ("%-Pkt.", "п.п.") fit at 360.
- Fight clock: the lead is two sentences, three lines at 360. The disabled row reads "No 15-minute readings for this event (they start with the event of 24 Oct)". The row links and Details buttons are at least 44 px.
- Tap targets under 44 px: the alliance name links in the event pages' other tables (24 px; older code, as in the 08zzzzn review) and the 18 px "Exact numbers" checkbox (its label is 44 px).

Fixed:
- The two help paragraphs under the section title touched each other; the second now has a 4 px top margin (`app/_ui/WhoCarried.tsx`).

Left:
- The help text starts with the lowercase unit ("pts is the kill share minus the might share"). Rewording it needs 17 translations.
- The range line has the same size and colour as the figures line; it is read as part of the row at 360, so it is unchanged.
- The seed has no sampled event with the 5-event range; ranges were seen with 3 events only.

Screenshots: `docs/screenshots/08zzzzr-{balance,fight-clock,kill-vs-might}-{light-360,dark-360,1280}.png`.
