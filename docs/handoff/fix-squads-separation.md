# fix — every squad in its own frame

## Built

- `app/(private)/_ui/MemberSquads.tsx`: every squad in "Squads (from the tracker)" sits in the soft drawn frame (`drawn-frame-soft`) with 8 px padding. Squads are 12 px apart (`space-y-3`), which leaves room for the frame's 3 px tails. The strongest squad keeps its 5 % plum tint and the "Strongest" tag. Before, only the strongest squad had a frame and the others had one hairline on top. The header comment says the same.
- `docs/decisions/D136-…`:
  - The slot mapping line now records the owner's confirmation (2026-11-21): API slots 1–2 are the front row (top), slots 3–5 the back row. This replaces "an assumption for the owner to confirm".
  - A dated amendment (2026-11-21) for the frames.
- `docs/decisions/D117-…`: a one-line dated amendment pointing to D136. D117 said only the strongest squad sits in the frame.

## Decisions

- **Frame:** the frame is the soft drawn frame, as `radio-field` uses it: every option in the frame, the picked one tinted plum. It is not `drawn-card`, because DESIGN.md says a card never sits inside a card, and on the member's own page (`MeSquads`) the squads already sit in a card. It is not a 1 px `--rule` box either: that rule is about 1.3:1 on paper, close to the faint hairline the owner found too weak.
- **Slot mapping confirmed** by the owner on 2026-11-21: API slots 1–2 are the front row (top), slots 3–5 the back row. No code change was needed. The lineup already draws it this way (see `fix-squad-formation-mobile.md`).
- No new test. The task did not ask for one, and the change is only class names.

## Deviations

- None.

## Verified

- `pnpm check` passes: Prettier, ESLint, tsc, Vitest (1,519 tests in 294 files, 4 skipped), drift and i18n.
- Local production build (`next build` + `next start`, local Postgres with 68 migrations). The alliance and heroes are invented, the officer session is stubbed, and hero pictures are answered in the browser. Squads 1 (the strongest), 3 and 4 have 5 heroes; squad 2 has 4 heroes, so one slot is empty.
  - At 320, 360 and 1280 px, light and dark: no sideways scroll (0 px), and no lineup slots overlap. At 360 px each lineup grid is 312 px wide (it was 328 px for the unframed squads), and every slot keeps its row and column. No tap targets changed: the squads list has none.
  - Screenshots are in the scratchpad: `sep-shots-before/` (360 and 1280, light and dark) and `sep-shots-after/` (320, 360 and 1280, light and dark). Each shows the squads section plus 8 px around it.
- Designer review (one subagent, before against after): no MUST items. Its SHOULD items are under Open issues.
- No call to the upstream API, Discord or PostHog. Only invented names.

## Open issues

These are SHOULD items from the designer review and were not done here:

- **The dark tint is weak.** In dark, the strongest squad's 5 % plum tint barely shows, so only the "Strongest" tag sets it apart. The tint was already there before this change. The reviewer suggests 10 %, the tint `radio-field` uses for a picked option.
- **DESIGN.md has no line for it.** Add a line saying that the squads list nests the soft drawn frame, as chips, notices and `radio-field` do, so later reviews don't flag it as a card inside a card.
- **Tight at 320 px.** At 320 px there is 8 px between the title and the frame. `px-3` would give more room, but the lineup grid is already at full width there.
- **Age wraps at 320 px.** At 320 px, "· 2 days ago" wraps to its own line in squads 3 and 4. This wrap was already there before; the frame's padding now takes a few more pixels.

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- Every squad on the member card is framed (D136 amendment 2026-11-21). Any other page that draws squads with `MemberSquads` gets the frames too.
- The slot mapping (slots 1–2 front, 3–5 back) is confirmed. Don't list it as an open question any more.
</adjustments>

PR: (added by the orchestrator)
