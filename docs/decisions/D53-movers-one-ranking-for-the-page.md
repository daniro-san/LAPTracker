## D53 — Movers: one ranking for the page and Discord, unusable sides left out, no "left" split (2026-11-06, owner, 08zze, issue #70)

The owner held two points of #70 until the first Saturday's data and on 2026-11-06 asked for the section in v1.1.0 with these defaults:

- **No "left" vs "lost in battle" split.** An alliance's might loss is shown as one number. When its members left, the change carries the D33 `*` ("Includes member changes"), as on the ledger. Revisit once Saturday's data shows whether losses are mostly leavers.
- **Unusable sides are left out.** An alliance or member with a missing, stale or failed Before or After is not ranked, as the Discord movers already did (INVARIANT freshness.no-stale-delta). A member read on one side only is not ranked either; they are in the joined/left counts.
- **One ranking.** `compute.topMovers(rows, metric, n, direction)` ranks the page's lists (`lib/queries/movers.ts`) and the Discord message's top gains (`lib/notify.ts`), so the two agree. A change of zero or of the other sign is not a mover. Equal changes keep the input order (alliances by union id, members by uid) and share a competition rank (1, 1, 3).
- **Sizes and keys** (owner, 2026-11-05): alliances top 3 per list, members top 5; members keyed by `uid` across every tracked alliance, a switcher counted under the After alliance.
- **Layout.** Segmented tabs (`Might ▲`, `Might ▼`, `Kills ▲`) in one card, picked by the owner from four variants on 2026-11-06. It sits under the ledger on the event page (amends DESIGN.md Navigation's "nothing else after the ledger") and between Leadership and the member list on the alliance page.
