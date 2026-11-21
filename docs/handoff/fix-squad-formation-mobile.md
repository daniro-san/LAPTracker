# fix — the squad lineup is 2 in front and 3 behind, the same at every width

## Built

- `app/(private)/_ui/MemberSquads.tsx`: each squad's lineup is a 6-column grid in which every slot has a fixed row and column. Slots 1–2 sit on row 1, centred (columns 2–3 and 4–5). Slots 3–5 sit on row 2 (columns 1–2, 3–4 and 5–6). No breakpoint changes it.
  - Rows take their content's height. Before, they were fixed at 3.5 rem halves, which a hero with wrapped facts could overflow.
  - The visible list below 360 px is gone: the grid shows at every width. The slot-order list stays, for screen readers only, and no longer draws pictures.
- `lib/private/member-squads.ts`: the `slots` comment now names the rows. No logic change.
- `app/(private)/_ui/MemberSquads.test.ts`: one new test for the slot-to-row mapping. It checks each slot's grid place for a 5-hero squad, and that the lineup has no breakpoint classes. The old screen-reader assertion now matches the new classes.
- `docs/decisions/D136-…`: a dated amendment (2026-11-21) recording the owner's correction, the slot mapping and its evidence.

## Decisions

- **Slot mapping:** API slots 1–2 are the front row and slots 3–5 the back row, each left to right.
  - Evidence: no hero field gives a position. `heroSchema` in `lib/sources/v1-player.ts` reads `id, lv, star, q, awaken, honor` only. `fixtures/` has no recorded `/v1/players` body; the only "heroes" there is the ranks board's "Hero power" board. `hero_catalog` keeps id and name only, with no role. D117 and D132 record no position field. So the API order decides.
  - The split at 2 is an **assumption** for the owner to confirm on a real squad.
- No row labels, as the owner asked on 2026-11-21. "Front" / "Back" copy was drafted and then removed. No dictionary key was added.
- An empty slot stays the last slot, as D136 says: with 4 heroes, the back row's right end.

## Deviations

- The first brief asked to make the phone match a desktop layout that differed. On the code before this change, I measured every slot's box on a local production build: at 360, 390, 640, 1024, 1280, 1440 and 1920 px in Chrome, and at 360, 390 and 1280 px in WebKit (phone viewport, touch). Every slot sat in the same cell at every width. On desktop the card is a side panel about 360–410 px wide. The phone view the owner described is exactly D136's staggered shape. The owner's correction (2 + 3) then replaced that shape, which is what this change builds.

## Verified

- `pnpm check` passes: Prettier, ESLint, tsc, Vitest (1,480 tests in 286 files, 4 skipped), drift and i18n.
- Local production build (`next build` + `next start`, local Postgres, 63 migrations), invented alliance and heroes, a stubbed officer session, hero pictures answered in the browser. Squads 1 and 3 have 5 heroes; squad 2 has 4 (one empty slot).
  - After: at 320, 360, 390, 640 and 1280 px, light and dark, every slot sits in the same row and column. The pairs of slots that were measured do not overlap, and there is no sideways scroll. The grid is 182 px tall (214 px at 320–360 for squad 1, where "Honor N" wraps), down from 280 px.
  - Screenshots, in the scratchpad: `sqf-shots-before/` (Chrome, 360/390/640/1280), `sqf-shots-webkit-before/` (WebKit, 360/390/1280) and `sqf-shots-after/` (320/360/390/640/1280), each in light and dark.
- Designer review (one subagent: before and after at 360, 390 and 1280, plus 320): no MUST items. Its SHOULDs are under Open issues.
- No upstream, Discord or PostHog call. Only invented names.

## Open issues

- **Owner to confirm** that slots 1–2 are the front row. Check this on a real squad whose tank is known.
- From the designer review (SHOULD; not done here):
  - Within a row, a hero with "Honor N" is one line taller, so the star rows of neighbouring heroes don't line up.
  - At 320 and 360 px, "Honor N" wraps to its own line, while at 390 px and wider it stays inline.
  - The empty slot's caption uses the muted ink token (`text-ink/70`), like the other muted lines. The reviewer found it light on the beige paper.

## Next

- Model/effort: keep.
- Owner first: confirm the front row is slots 1–2 on one real squad.
- Plan change: none.

<adjustments>
- The squad lineup is 2 + 3 at every width, with no breakpoint and no visible list. Any other place that draws a squad (for example the member's own page, which reuses `MemberSquads`) gets it as is.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/564
