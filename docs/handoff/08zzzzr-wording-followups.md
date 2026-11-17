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
- `balance.total` in tr ("Takipteki toplam") and ko ("추적 연맹 합계") keep the `standing.server` wording so the pages agree. In vi, `standing.server` is "Máy chủ" (the server), so `balance.total` uses "Liên minh theo dõi" instead.
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
4. vi `standing.server` reads "Máy chủ" and no longer matches "tracked alliances"; a one-key fix.

## Next
Session: none planned; the orchestrator picks the next issue.
Model / effort: keep. The work was wording and one query fix.
Owner must do first: review the new English strings, then merge.
Plan changes needed: none.

<adjustments>
- `CarriedRow` has no `ratio` field now; use `spread` for the range.
- `getFightClock` already reads every scheduled event's sampled state; a window picker can reuse `allScheduled`.
</adjustments>
