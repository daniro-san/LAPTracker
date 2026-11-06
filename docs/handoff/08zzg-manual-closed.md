# 08zzg — A complete manual round is closed

## Built
- /admin's manual round (`app/_ui/admin/ManualSection.tsx`): once both phases are done, the round card becomes one collapsed line — its name, the "Round complete" chip and a ▾ — that opens to the two phases with their times, who can see it, the Discord post, the API calls used and "Open on the site". Nothing in it records again or edits. "Start a manual round" (primary) starts the next round.
- While a round is running nothing changed: a done phase is "Record again", the other phase keeps its seal, "Change options" stays.
- `roundPlan` returns `again: false` for both phases of a complete round; its test says so.
- The read-only parts (phase chip, facts, the closed line) moved to `app/_ui/admin/RoundFacts.tsx` so `ManualSection.tsx` stays under eslint's 300 lines.
- DESIGN.md `round-phase` and DECISIONS.md D55.

## Decisions
- D55 (owner, 2026-11-06, in chat): "a finished manual round stays closed, you can see the details but not edit; a new manual round opens a new card".
- UI only: the manual-snapshot route still accepts `force` on a complete phase (D28).

## Deviations
- None.

## Verified
- `pnpm check` green (prettier, eslint, tsc, vitest, drift, i18n-check); `app/_ui/admin/ManualSection.test.ts` covers the complete round.
- /admin needs the PIN, which this session did not use. The section was rendered with made-up rounds on a temporary local page (deleted before committing) and screenshotted: `docs/screenshots/08zzg-manual-{closed,open,running}-{360,1280}-light.png` and `…-360-dark.png`.

## Open issues
- If a complete round must never be re-recorded at all, the manual-snapshot route would also need to refuse `force` for a complete round; today only the page stops offering it.

## Next
Session: none planned by this change; it goes into release v1.1.0 (PR #159, `dev → main`).
Model / effort: keep — a small admin layout change.
Owner must do first: merge this PR into `dev` before the v1.1.0 cutoff (~21:00 server).
Plan changes needed: none.
