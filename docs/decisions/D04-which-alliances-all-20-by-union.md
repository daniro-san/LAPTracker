## D4 — Which alliances: all 20, by union_id, fixed per event (2026-11-04, plan §3.4)

`config/alliances.ts` lists 20 alliances by `union_id`, because tags are case-sensitive, collide and change. The BEFORE run copies the list onto the event, and the AFTER run uses that copy, so a config change mid-Saturday can't make the phases incomparable. Quota rule: a run starts only if `remaining >= 2 × (alliances + 5)` (`lib/budget.ts: requiredQuota`).

**Superseded in part (2026-11-20, D133, issue 459).** The fixed list in `config/alliances.ts` is gone. The alliances are the ranks board's top 20 by might, recomputed every server day before the daily read (`tracked_sets`). Kept from D4: alliances are addressed by `union_id`; the Before copies the newest set onto the event and the After reads that copy; the quota rule `requiredQuota`.
