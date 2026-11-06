# 08zzd — Leadership as leader on top, officers in a row

## Built
- `app/_ui/Leadership.tsx`: the section renders two centered rows instead of one 2-column grid. The first `<ul>` holds the R5 row(s), the second the titled R4 officers. Both rows are `flex flex-wrap justify-center gap-3`.
  - Below 640 px: every card is full width, one column, as before.
  - 640–1023 px: the leader card is half the row (the width of one officer card), centered; officers sit 2×2 below.
  - From 1024 px: the leader card is a third of the row (296 px in the 912 px content column), centered; officers are a quarter of the row each (219 px), all in one row.
  - Fewer than four officers are centered. No leader: only the officer row renders. A second R5 sits beside the leader on the top row.
  - The card markup moved into a local `Card` component and is unchanged (photo, name link stretched over the card, role mark, title, `− Left`), except the stat block: `dl` is `flex flex-wrap gap-2` with `flex-1` items instead of `grid grid-cols-3`. While the three figures fit they take equal thirds, as before; in a card too narrow for them a figure wraps to a second line instead of overlapping its neighbour.
- `docs/DESIGN.md` `leadership`: describes the rows per width, the count cases, the reading order and the stat wrapping.
- `docs/screenshots/08zzd-leadership-{4officers,2officers}-{360,768,1280}-{light,dark}.png`.

## Decisions
- Two lists, not one grid: DOM order stays leader → officers, and centering a short row needs no per-count column classes. A screen reader hears "list, 1 item" then "list, 4 items" instead of one list of 5.
- The leader card is one officer wide at 640–1023 px, as the task says. From 1024 px it is a third of the row (wider than an officer, 296 px vs 219 px), so the top card does not look smaller than its role.

## Deviations
- None. No copy added or changed; /brand's Leadership spec shows only the marks and the section title, not the layout, so it is unchanged.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc, vitest 42 files / 201 passed / 1 skipped, drift and i18n gates clean.
- Local review: the throwaway Postgres 18 data dir from the 08zx session (copied into this session's scratchpad, 127.0.0.1:5561), the same WebSocket→TCP bridge and preload, `next dev` on 127.0.0.1:3191 with upstream hosts on `127.0.0.1:9`. Ranks set by SQL: [OGs] 67111155 has the R5 and 4 titled R4; 67110320 was set to the R5 and 2 titled R4 (God of War, Recruiter). No upstream API call, no Neon database. Player photos came through `/img/avatar/[uid]` from the photo host.
- Playwright-core with system Chrome at 360, 768, 1024 and 1280 px, light and dark, both alliances: `scrollWidth - innerWidth = 0` everywhere; card positions as listed in Built (leader centered over the officers).
- Stat fit: at 1024 and 1280 px the officer card is 219 px wide. Compact values ("67.1M", "2.11M", "1.18M") sit on one line in every card. With "Exact numbers" on ("67,108,813", "2,111,162") they still sit on one line and no `dd` overflows; the wrap is a fallback that did not trigger with the real values.
- Edge cases by temporary SQL on the throwaway DB: two R5 + 1 officer → both leaders side by side on the top row (768 and 1280 px), the officer centered below; no R5 + 1 officer → one centered officer card, no empty top row.

## Open issues
- At 1024–1279 px a long name (e.g. "Kasoar·Thorne") fills the officer card's name column; a longer name would wrap to two lines (`break-words`), which is the existing card behaviour.

## Next
Session: none planned by this change; it goes into release v1.1.0 (PR #159, `dev → main`).
Model / effort: keep — a small layout change.
Owner must do first: merge this PR into `dev` before the v1.1.0 cutoff.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/162
