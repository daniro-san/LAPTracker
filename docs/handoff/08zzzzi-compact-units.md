# 08zzzzi — Compact numbers use K, M, B, T (D78, issue #325)

Base: `origin/dev` at 75174b4. Branch `fix/08zzzzi-compact-units`. No upstream API call, no route, no schema change.

## Built
- `lib/compact.ts`: `compactLarge(n, locale)` for numbers of 1,000 or more. It picks K, M, B or T by magnitude, divides, formats the mantissa with `Intl.NumberFormat(locale, { minimumSignificantDigits: 3, maximumSignificantDigits: 3, useGrouping: false })` and appends the suffix with no space. The unit is picked after rounding to three digits.
- `app/_ui/format.ts`: `compact(n, locale)` prints the plain integer below 1,000 (as before) and calls `compactLarge` from 1,000. The `compact` style left `numberFormat`.
- `lib/discord-format.ts`: `compact` calls `compactLarge(n, "en-US")` instead of its own `Intl` compact formatter. `signedCompact` and the sign handling are unchanged.
- Tests: `lib/compact.test.ts` (2 tests: boundaries, separator and digits) and 2 tests added to `app/_ui/format.test.ts` (a fast-check property over every tag in `LANGUAGES` plus en-GB, pt-PT, es-MX; examples for 4,29B, 1.00M, ja and zh-CN).
- `docs/decisions/D78-compact-numbers-use-k-m-b-t-everywhere.md` and its index line. D77 is skipped (reserved by another session).
- `docs/ARCHITECTURE.md`: one map line and `lib/compact` added to the "imports nothing" rule. `docs/DESIGN.md` (line 190) and `docs/decisions/D23-…md` (the Locale bullet) said the suffix is the locale's own; both now point to D78.

## Decisions
- **Callers.** Every caller passes an absolute value or goes through `compact`, which takes `Math.abs`. The signed variants (`signed` in `app/(pages)/admin/members/page.tsx`, `LiveProgress`, `Num`, Discord `signedCompact`) put `signOf` or `sign` (real minus U+2212) in front of the unsigned text, so their output shape is unchanged.
- **Boundary.** At three significant digits the K to M switch happens at 999,500, not at 999,950: 999,950 reads `1.00M` and so does 999,500; 999,499 reads `999K`. The same holds at M to B and B to T.
- **Discord.** `lib/discord-format.ts` already printed K/M/B/T with the same rounding, because `Intl` en-US does it. Over 2,000,154 numbers (random, and a dense sweep around every boundary) the new helper with `en-US` prints exactly what the old Intl formatter printed, up to 1e15. It now shares the helper so the two cannot drift.
- **No grouping in the mantissa.** `useGrouping: false` keeps `1000T` (not `1,000T`) at 1e15, the same as the old Discord format.
- **Dependency rule.** `lib/compact.ts` imports nothing; `app/_ui/format.ts` and `lib/discord-format.ts` import it. The eslint zones were not touched (no zone lists `lib/compact`).

## Deviations
- Task item 3 says 999,950 gives "1.00M" "at every boundary"; the exact switch point is 999,500 (see Decisions). The example 999,950 → "1.00M" holds and is tested, with 999,499 → "999K" and 999,500 → "1.00M".
- I also edited `docs/DESIGN.md`, `docs/decisions/D23-…md` and `docs/ARCHITECTURE.md`, which the task did not list, because they stated the old rule.

## Verified
- Existing expectations: none encoded a localised suffix. No test expected `bn`, `bi`, `mi`, `Mio.`, `万` or a lowercase unit (searched all `*.test.ts` outside `lib/private`). `lib/notify.test.ts` (`+85.8M`, `+1.71M`, `+100K`) and `lib/event-image.test.ts` pass unchanged. No expectation was changed.
- New and neighbouring tests: `pnpm exec vitest run lib/compact.test.ts app/_ui/format.test.ts lib/notify.test.ts lib/event-image.test.ts` passes.
- Output for 4,290,000,000 / 999,950 / 60,100,000 / 271,000: en-GB `4.29B 1.00M 60.1M 271K`; pt-BR, de, ru, fr `4,29B 1,00M 60,1M 271K`; ja and zh-CN `4.29B 1.00M 60.1M 271K`.
- `pnpm check` (Node 26.13.0): green. Prettier, eslint, tsc, vitest (`Test Files  86 passed | 2 skipped (88)`, `Tests  458 passed | 4 skipped (462)`), `check-drift` ("Everything's fine") and `i18n-check` ("17 languages up to date with English"). An earlier run was killed (exit 137) when the session restarted; the rerun above is the one reported.
- Screenshots at 360 px of the home page on a scratch local database (`scratch325`, seeded with `pnpm db:local:seed`, `next dev` on port 3325; the `lap` database was not touched; no upstream call). WebKit with locale en-GB (`navigator.language` = en-GB) shows `4.47B`, `+91.8M`, `50.9M`, `+773K`, `−71.3M`. Chromium (system Chrome) with pt-BR shows `4,47B`, `+91,8M`, `50,9M`, `+773K`, `−71,3M`. No lowercase unit appears on either. The captures are in the session scratchpad, not committed: `.../scratchpad/shots/webkit-en-GB-home-360.png` and `.../scratchpad/shots/chromium-pt-BR-home-360.png`.

## Open issues
1. A locale whose digits are not Latin would print its own digits before the K/M/B/T (the mantissa is formatted by `Intl`). No supported language does; the property test covers all 18 tags plus three regional ones.
2. Numbers at 1e15 and above print as `1000T` and `15000T`. Not reachable with game values (might is about 1e10 per alliance).
3. The exact-on-tap text (`exact`) still groups digits by locale (`4.290.000.000` in pt-BR). Not part of this change.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` (its last entry is Session 10; the rest is "After v1" and the roadmap issues).
Model / effort: keep — no signal; this was a one-module change with a measured equivalence check.
Owner must do first: merge this PR into `dev`; D77 is reserved by another session, so merge order does not matter for numbering.
Plan changes needed: none. `docs/IMPLEMENTATION_PLAN.md` and `docs/SESSION_PLAYBOOK.md` do not mention compact suffixes.

<adjustments>
- Any new compact figure must go through `compact()` in `app/_ui/format.ts` (public pages) or `compact`/`signedCompact` in `lib/discord-format.ts`. Do not call `Intl.NumberFormat` with `notation: "compact"` anywhere: it brings back `60.1m`, `bn`, `bi` and `万`.
- Locale-suffix strings (`3,94 bi`, `3,94 млрд`) are no longer expected in any test, screenshot or copy; use `3,94B`.
</adjustments>

PR: (pending)
