# 07g — Player page rework

Branch `session/07g-player-page`, cut from `origin/dev` (2dcd4f0, after #32 merged). Mock first, owner approved it as shown on 2026-11-05, then applied with no corrections.

## Built

- `app/_ui/PlayerAcrossEvents.tsx` — history rows rebuilt. Rank and event date on one line; Might, Kills and Level are columns; three lines under them, each with its head on the left: `14:00 server` (values), `since 10:00` (in-event change), `since Oct 24` (change since the previous event). Column heads sit inside the card below 640 px and in the table header at ≥ 640 px. The alliance is named on a row only when the player has been in more than one alliance; name and alliance changes still show on the row where they happened. Details is one `DetailTable`: snapshot times as heads, Might / Kills / Level before → after, the in-event change, and the in-alliance rank with its move.
- `app/(pages)/players/[uid]/page.tsx` — passes `showAlliance`; the "Alliances" label is hidden when the player has one alliance and one name.
- `app/_ui/Num.tsx` (shared) — `Delta` takes an optional `stack` prop: the percent goes on its own line below 640 px. Default off, so other callers are unchanged.
- `app/_ui/StatTable.tsx` (shared) — `MoreBar` is exported so the player rows use the same Details control. No restyle.
- `docs/DESIGN.md` — new `history-row` entry; `details-table` now says event-date heads are for an alliance's history rows only.

## Decisions

- Measured problems on the old page (local production build, px inside the first card): the rank's baseline was 10 px below the date's at every width, because `StatTable`'s `Lead` centres the rank against the date and alliance lines together; at 1280 the values were 8 px above the date's baseline (25 vs 33); the in-event change started at x = 219 / 206 / 141 on the three lines and `since …` at 117, so the two changes never shared a column; every card repeated the same alliance; Level used two lines for `= 0` twice; "ALLIANCES" took a row to introduce one line. These are what "not centered" and "more efficient" were read as.
- The player rows no longer go through `StatTable`'s row; they keep the same card class, border, link overlay, header bar style and Details control. `StatTable` itself was not changed beyond the export, because the alliance session works on it in parallel.
- The before values (`33.6M →`) moved from the card into Details; with three columns there is no room for them at 360 px.
- `since 10:00` uses the existing `copy.ledger.since` string with the before snapshot's time, so no new copy keys.
- The in-event line is shown only when both snapshots are fresh (`inEvent` present); the since-previous line only when there is a previous event.

## Deviations

None from IMPLEMENTATION_PLAN.md. DESIGN.md "one row shape, three depths" still holds: same card, same Details, metrics as columns as on the alliance page at ≥ 640 px.

## Verified

- `pnpm check`: prettier, eslint, tsc clean; vitest 23 files passed, 1 skipped; 85 tests passed, 1 skipped.
- Baselines after (px inside the first card, `/players/339504578885`): 360 / 390: rank 31 = date 31; value line 91 ×4, in-event line 119 ×4, since line 167 ×4. 1280: rank = date = values 26; lines 54 ×4 and 82 ×4. Card height 268 → 256 at 360; 127 → 146 at 1280 (one more line, since both changes now have their own line).
- axe-core (Details open on every row) at 360, 390, 1280, light and dark: 0 violations. `scrollWidth` equals the viewport at every width.
- Targets: every link, button and summary ≥ 44 px except the date links (25 px tall, but their `::after` covers the whole card) and the Exact-numbers checkbox (18 px inside its ≥ 44 px label), as before.
- Lighthouse on local production builds, two runs each, before (c0794ba) → after: mobile 100/100/100/100 → 100/100/100/100, LCP 1020 / 981 ms → 1015 / 986 ms, CLS 0 → 0, 362 → 363 KB; desktop 100s → 100s, LCP 263 / 266 → 278 / 274 ms.
- Screenshots (session scratchpad, not committed): `before-*` and `mock-*` at 360 / 390 / 1280 light and dark, `mock-details-*` with Details open.
- Not verified on real data: a player with more than one alliance or a name change (the seed player has one alliance), and a row whose before snapshot is stale. Both paths are read from the code only.

## Open issues

- `StatTable`'s `Lead` still centres the rank against a two-line lead (`items-center`), so alliance-page member rows with a `sub` line have the same 10 px rank offset. Left for the alliance session; a note is in the shared session-notes folder.
- At 360 px the breadcrumbs wrap and leave `› Bella-Vendetta` alone on a second line (shared `Breadcrumbs`).
- At ≥ 640 px the Details control still takes its own row under each history row (shared `MoreBar`).

## Next

Session: 8 — Deploy, GitHub Actions, env, webhooks
Model / effort: keep — no signal from this session about deploy work.
Owner must do first: merge this PR into `dev`; PREREQUISITES.md §6 row "Session 8".
Plan changes needed: none.

<adjustments>
- Nothing in this session changes what Session 8 builds. The player page's history rows are now `history-row` in DESIGN.md; a smoke check of `/players/[uid]` should expect `since 10:00` / `since <date>` line heads and no `→` before the values on the card.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/37
