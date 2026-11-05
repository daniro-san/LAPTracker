# 08i — Manual round visibility, Discord toggle and tag

## Built
- PR #77 (08h) was merged into `dev` before its last two commits. This PR carries them again, cherry-picked onto the merged `dev`: per-round visibility and Discord toggle (migration `drizzle/0005_concerned_bloodstrike.sql`, `lib/queries/visibility.ts`, `POST /api/manual-event/settings`, the /admin controls, two tests) and the D28 / 08h handoff alignment. Their behavior is described in `docs/handoff/08h-manual-snapshot.md`, section "Controls", and in D28.
- A "Manual round" tag (`app/_ui/EventLabel.tsx`, copy `copy.site.manualRound`): next to the round's name in the event selector (button and list) and at the top of the event page. Not on alliance or player history rows. `listEvents` and `getEventDetail` now return `manual`. No migration.
- `app/_ui/EventLabel.test.ts`: one test (the name renders as text, the tag shows, a real event stays its weekday).

## Decisions
- Public pages showed events by weekday and date only; they never showed `events.name`. So a rename was visible only in `GET /api/events` until now. A manual round is now labelled by its name (in the selector and as the event page title, with the date under it); real events keep their weekday.
- The name is rendered as text by React and is limited to 80 characters when set; the label wraps (`break-words`).

## Deviations
- None from the task.

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 120 tests). No upstream calls.
- Not verified: the tag in a browser at 360 px; migration 0005 on Neon.

## Open issues
- Browser tab titles and the Open Graph image still use the weekday for a manual round.

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev`, deploy, apply migration 0005.
Plan changes needed: none.

<adjustments>
- None.
</adjustments>


https://github.com/daniro-san/LAPTracker/pull/78
