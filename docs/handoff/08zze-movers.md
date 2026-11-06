# 08zze — Movers (issue #70)

## Built
- `compute.topMovers(rows, metric, n, direction)` in `lib/compute.ts`: the `n` biggest gains or losses of might or kills, after − before. A row with a missing, stale or failed side is not ranked (it goes through `compute.delta`), nor is a change of zero or of the other sign. Equal changes keep the input order and share a competition rank (1, 1, 3). Five tests in `lib/compute.test.ts`: ties, losses only, the metric asked for, `n` larger than the rows, missing / stale / null sides.
- `lib/queries/movers.ts`: `allianceMovers(before, after)` (top 3 per list, from the event detail already loaded) and `memberMovers(db, snapshots, unionId?)` (top 5 per list, keyed by `uid` across every tracked alliance, counted under the After alliance; null until both snapshots ran). Three lists each: Might ▲, Might ▼, Kills ▲. Member columns selected: uid, name, power, kills and the alliance row's union id, tag, freshness and error; no `raw_json`, no `avatar_url`.
- `getEventPage` returns `movers: { alliances, members }`; the alliance page loads `memberMovers` for its own alliance.
- `app/_ui/Movers.tsx` (client) and `app/_ui/mover-lists.ts`: one framed card titled "Movers", three segmented tabs (`Might ▲`, `Might ▼`, `Kills ▲`; arrow keys move between them; the direction's word is read out), each list as `#rank · [badge] · name · ▲ change (percent)`. Event page: under the ledger, alliances and members side by side from 640 px. Alliance page: between Leadership and the member list, that alliance's members only. An alliance loss whose members left carries the D33 `*`. An empty list reads `—`.
- `movers()` in `lib/notify.ts` now ranks with `compute.topMovers`; its output did not change (the existing notify tests pass unchanged).
- Copy: `ledger.movers` ("Movers"), translated into the 17 languages with the translate-copy skill (Haiku; nl rerun on Sonnet because "Bewegers" read wrong, now "Stijgers en dalers"), stamped.
- /brand: a `movers` spec with a sample card (`app/(pages)/brand/MoversSample.tsx`).
- Docs: DESIGN.md `movers` component and the Navigation order; DECISIONS.md D53.

## Decisions
- D53, defaults the owner asked for on 2026-11-06: no "left" vs "lost in battle" split (the D33 `*` marks a loss with leavers); stale, failed or missing sides are not ranked, like the Discord movers; one ranking function for the page and Discord.
- Layout: the owner picked variant (b), segmented tabs, from four variants (columns, tabs, chips, rank grid) shown with screenshots.
- Tie order: alliances by union id (the event detail's order), members by uid, so a tie reads the same on every load.

## Deviations
- `lib/copy-brand.ts` passed eslint's 300-line limit with the new /brand entry, so its `components` group moved, unchanged, to `lib/copy-brand-components.ts` (still `copy.brand.components`).
- Members are listed without their photo (the row stays one line at 360 px); alliances keep their badge.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (208 passed, 1 skipped, including `lib/queries/blocked-keys.test.ts`), drift, `i18n: 17 languages up to date with English`.
- Local `next dev` against the Neon preview branch, read-only (no writes, no upstream calls, no `/api/quota`): `/`, `/events/3/alliances/67109944` and `/brand` render; tabs switch by click.
- Screenshots in `docs/screenshots/08zze-movers-*.png`: event and alliance pages at 360 and 1280 px, light and dark; de (event) and ru (alliance) at 360 px; the Might ▼ tab (light) and Kills ▲ tab (dark) at 360 px.
- In the preview data no member lost might, so the members' Might ▼ list shows `—`; the alliance Might ▼ list shows one alliance with the `*`.

## Open issues
- After the first Saturday (2026-11-07): check whether alliance might losses are mostly members leaving; if so, D53's first default is the one to revisit (split "left" from "lost in battle").

## Next
Session: none planned by this change; it goes into release v1.1.0 (PR #159, `dev → main`).
Model / effort: keep — the remaining work is review and merge.
Owner must do first: merge this PR into `dev` before the v1.1.0 cutoff (~21:00 server).
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/163
