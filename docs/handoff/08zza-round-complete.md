# 08zza — A finished manual round reads as complete (issue 157)

## Built
- `app/_ui/admin/ManualSection.tsx`: `roundPlan(manual)` maps the round to what the section offers: which phases are "Record again", whether the round is complete, and whether "Start a manual round" is primary or secondary. The card uses it:
  - **No round:** "No manual round yet." and "Start a manual round" as `button-primary`.
  - **Before done:** the Before column is a muted underlined "Record again" button (44 px, "BEFORE" above it, `≈ 21 calls` under it); the After wax seal is the only seal, so it is the next step. "Start a manual round" stays secondary.
  - **Both done:** the first line is "THIS ROUND" plus a "Round complete" chip (ink, stitched check). "Open on the site" becomes a `button-secondary` link above the two "Record again" buttons. "Start a manual round" is `button-primary`.
  - **A phase running:** the running phase keeps its (disabled) seal with "Running since …"; every control is disabled as before.
- `app/_ui/admin/actions.ts`: `Action.force`; `recordAgain(action, at)` gives the action one confirmation, "This replaces the {Before|After} snapshot from {time}. About 21 of today's 1,000 API calls, up to a minute.", and `force: true`. `RoundView.phases[].at` carries the phase's time in words.
- `app/_ui/admin/words.ts`: `roundView` fills `at` (finish time, or start time while running).
- `app/_ui/admin/AdminActions.tsx`: `send` defaults `force` to `action.force`, so "Record again" sends `force=1` on the first request. It passes `seal` and `onStart` to `ManualSection` instead of prebuilt seals.
- `lib/copy-admin.ts`: `manual.again`, `againName`, `againConfirm`, `complete`.
- `docs/DESIGN.md` `round-phase`: describes the done-phase control and the complete state.
- `app/_ui/admin/ManualSection.test.ts`: one table test for the state → primary/secondary mapping (no round, Before done, both done, running, partly done).
- `docs/screenshots/08zza-*.png`: the four states at 360 and 1280 px, light and dark, plus the "Record again" confirmation at 360 px.

## Decisions
- No new D-number. D28 is unchanged: a re-run still needs `force`. Only the client now sends it from the first press of a done phase.
- "Done" means `status = complete`, because `lib/collector.ts` refuses only a `complete` phase without `force`. A partial or failed phase keeps its red seal as the next step, and the round is not complete.

## Deviations
- "Start a manual round" is also primary when there is no round. The issue names only the complete state. With no round it is the section's only action, so primary is the reading the issue's "next step" wording supports.
- "Record again" is an underlined text button, not `button-secondary`. With "Open on the site" as `button-secondary` and "Start a manual round" as `button-primary`, the complete card has three levels: start, open, record again. It reuses the label, link and `cost-tag` styles. No component was added, so /brand is unchanged; DESIGN.md `round-phase` describes it.
- Code comments say "issue 157", not `#157`: `lib/brand/tokens.test.ts` reads `#157` as a colour literal.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc, vitest 42 files / 201 passed / 1 skipped, drift and i18n gates clean.
- Local review: a throwaway Postgres 18 cluster on 127.0.0.1 with `drizzle/0000`–`0011` applied, a WebSocket→TCP bridge and a temporary `neonConfig` block in `lib/db.ts` (reverted; not committed), a throwaway `.env.local` with a generated test PIN and upstream hosts on `127.0.0.1:9` (deleted), `next dev` on 127.0.0.1. Rounds seeded by SQL (Before Nov 5 20:01, After Nov 6 10:39 server time). No upstream call, no Neon database, no webhook.
- Playwright-core with system Chrome, per state at 360 px: no horizontal overflow; every button and link is 44 px tall (the seals are 96 px). Primary/secondary as listed in Built.
- "Record again" with the route stubbed in the browser: one confirmation ("This replaces the Before snapshot from Nov 5, 20:01 server time. About 21 of today's 1,000 API calls, up to a minute."), then one request `?phase=before&event=…&force=1`, and no second question.
- Screenshots: `docs/screenshots/08zza-{no-round,before-done,both-done,after-running}-{360,1280}-{light,dark}.png`, `08zza-again-confirm-360-{light,dark}.png`.
- Cherry-pick: the code commit (`ed388f0`) cherry-picks onto `origin/hotfix/v1.0.1-header` with no conflict, checked in a scratch worktree, where `tsc` is clean and the admin and brand tests pass (5 files, 10 tests). Nothing was pushed to that branch. dev's change to `lib/copy-admin.ts` (the tick lines) and the hotfix's DESIGN.md hunk are far from this change's hunks.

## Open issues
- The After seal's help line "Record them again later." (existing copy) reads like a repeat even when the After has never run. Not changed: not in the issue.
- A "Record again" pressed from a tab whose card is stale (another tab already re-ran it) still sends `force`; the server accepts it, as D28 allows.

## Next
Session: none planned by this change; the v1.1 lanes resume after the first Saturday (2026-11-07).
Model / effort: keep — a small UI change.
Owner must do first: merge this PR into `dev`; to ship it before Saturday, cherry-pick this PR's first commit (the code commit; the second only adds the PR link here) onto `hotfix/v1.0.1-header` and release v1.0.1 from there.
Plan changes needed: none.

https://github.com/daniro-san/LAPTracker/pull/158
