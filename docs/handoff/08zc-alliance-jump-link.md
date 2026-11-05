# 08zc — Alliance page: jump link to Across events from the title (#51)

## Built
- `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`: the "Across events ↓" link moved from beside the Members heading into the title row, after "My alliance" and "Exact numbers" in the same wrapping group. It keeps `min-h-11` (44 px) and the `history.length > 0` guard. The title row has `id="alliance-title"` and `scroll-mt-20`, so a jump to it lands under the sticky header. The Members heading is a plain `<h2>` again.
- `app/_ui/AcrossEvents.tsx`: `TITLE_ID` exported next to `ACROSS_ID`. The section's heading row now has the heading on the left and "Back up ↑" on the right, a link to `#alliance-title`, 44 px tall.
- `lib/copy.ts`: `copy.ledger.toTop` = "Back up" (two words). "Across events" still comes from `copy.ledger.acrossEvents`.
- `docs/DESIGN.md` Navigation: one line for the jump/back pair.
- Screenshots `docs/screenshots/08zc-alliance-*` (13 files, 984 KB): first screen at 360/390/1280 in light and dark; 360 light/dark after the jump (`-jumped`) and after the back tap (`-back`); before the change at 360 light/dark and 1280 light (`08zc-alliance-before-*`).

## Decisions
- Assumption: a jump link, not collapsing the member list after 20. The list already shows 20 members then "Show all (n)" (07f), and the issue asks for one tap from the header.
- Assumption: the back link's target is the title row, not the top of the page. It lands with the title 80 px from the top, right under the sticky header, and the jump link is visible again; the breadcrumbs end up under the header (scrollY 48).
- The jump link sits in the toggles group so the title row stays one block: at 360 px it wraps to its own line under the two toggles; at 1280 px it is the third item at the right of the title.
- `TITLE_ID` lives in `AcrossEvents.tsx` beside `ACROSS_ID`, because the page already imports from there; the component does not import from a route file.

## Deviations
- The copy key is `toTop`, with the value "Back up" (two words; "Back to top" would fail the two-word rule).
- The back link is not guarded: the section always renders (with its empty state when there are no rows), so the link is there whenever the section is.

## Verified
- Throwaway local stack, nothing shared: Postgres 18 in the scratchpad on 127.0.0.1:5541, a WebSocket bridge for the Neon driver, `next dev -p 3181` under `env -i` with placeholder secrets, an unroutable upstream URL, no webhooks; the owner's `.env.local` was not used. Schema from `drizzle/*.sql` via psql (the migrate script needs Neon's HTTP endpoint); data from `scripts/seed.ts` (22 alliances × 3 events). Upstream API calls: 0.
- The seed has no `rank_code` at all, so the Leadership section never renders on it. To measure the case the issue describes, I gave `[WACK]` (event 3, 100 members) one R5 and four titled R4s by SQL in that local database only. Page: `/events/3/alliances/67110992`.
- Playwright + system Chrome, viewports 360×740, 390×844, 1280×800, `colorScheme` light and dark, fresh context each run. Same numbers in light and dark:

| Width | Jump link y, before | Jump link y, after | On first screen before → after | Link size | After the tap: section top | After "Back up": title top | Horizontal overflow |
|---|---|---|---|---|---|---|---|
| 360 | 1,320 px | 268 px | no → yes | 108 × 44 | 80 px | 80 px | 0 |
| 390 | 1,320 px | 268 px | no → yes | 108 × 44 | 80 px | 80 px | 0 |
| 1280 | 893 px | 128 px | no → yes | 108 × 44 | 208 px (page end) | 80 px | 0 |

- Without Leadership (the seed as it is), the old link was at 517 px at 360/390 and 389 px at 1280; the new one is at the same 268 / 128 px.
- "Back up ↑" is 75 × 44 px. After the back tap the jump link is inside the viewport again in all six runs.
- `pnpm check`: prettier, eslint, tsc clean. Vitest in the full run: 26 files passed; 10 PGlite-backed files hit the 10 s / 30 s `beforeAll` timeout (load average 53, other lanes running checks at the same time, as 08r recorded). Re-run serially (`vitest run --maxWorkers=1 --hookTimeout=120000 app/api lib/queries app/img`): 12 files, 46 tests passed. No test file was changed.

## Open issues
- `docs/DESIGN.md` has the `member-filter` component line twice (the second one is the newer, longer one); pre-existing, left as is.
- The seed carries no `rank_code` / `rank_label`, so Leadership and role marks never render on a local seed. A follow-up could add one R5 and a few titled R4s to the fixtures.
- `scripts/migrate.ts` only speaks Neon's HTTP endpoint, so a local Postgres needs the SQL files applied by hand.
- The Next.js dev "N" badge shows in the captures (bottom left); it is not part of the page.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call, no query and no timing.
Owner must do first: merge this PR into `dev` (no migration).
Plan changes needed: none.

<adjustments>
- Session 9: when you look at an alliance page after the rehearsal or a public round, the "Across events ↓" link is in the title row (y ≈ 268 px at 360 px) and "Back up ↑" in the Across events heading returns to the title; nothing to check beyond that.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/110
