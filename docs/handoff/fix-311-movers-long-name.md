# fix-311 — a long alliance name no longer makes the event page scroll sideways

## Built
- `app/_ui/Movers.tsx`: the tab panel's grid has an explicit `grid-cols-1` below 640 px. Without a column template its implicit `auto` column grew to the widest line's min-content width, so a long `[TAG] Name` pushed the card past the screen.
- The name in a Movers line wraps (`break-words`) instead of being cut with an ellipsis, so the whole name stays readable, with no hover needed. The change already wraps under the name when the line is too narrow (DESIGN.md `movers`).

## Decisions
- Wrap, not ellipsis: DESIGN.md `breadcrumbs` says a long alliance name "breaks inside the name and nothing is truncated", and an ellipsis would hide the rest of the name on a phone.

## Deviations
- The issue blames the alliance ledger list. The overflow is in the Movers card under the ledger, on the tabs whose lists hold the long name (in the seed, Might ▼ and Kills ▲). The #309 handoff named the same element (`A.tint-button flex min-h-11 items-center gap-2 py-1`, the Movers line).

## Verified
- Local production build, local database seeded with `pnpm db:local:seed -- --reset`, two invented alliances renamed in every snapshot: `[KNITTER] Grannys Knitting Circles` and `[WOOLPOT] Grandmotherknittingclubs` (both names 24 characters, tags 7).
- `/events/3`, every Movers tab clicked, `document.documentElement.scrollWidth`:
  - Before, Chrome and WebKit: 367 (Might ▼) and 397 (Kills ▲) at 360 px; 397 (Kills ▲) at 390 px; 412 at 412 px.
  - After, Chrome and WebKit: 360, 390 and 412 on every tab.
- The alliance page (`/events/3/alliances/<id>`, members-only Movers) stays at 360, 390 and 412 in both browsers.
- Screenshots of the Movers card at 360/390/412/1280, light and dark (Chrome) and light (WebKit), checked by eye: both names wrap onto a second line and show in full; 1280 px unchanged.
- No unit test: the neighbouring tests do not measure layout, so the browser check is the test.
- `pnpm check`: exit 0, 210 test files, 1125 tests passed, 4 skipped.

## Open issues
- None found on the event page.

## Next
- Model/effort: keep. No session is queued by this fix.
- Owner first: nothing.
- Plan change: none.

PR: (added by the orchestrator)
