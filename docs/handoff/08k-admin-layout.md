# 08k — /admin layout rework

## Built
- Run area: Before, After and Rehearse are three columns on one row, each with a one-line help and its cost ("About 21 calls", "About 45 calls"). The area has a short intro with the daily budget (about 21 of 1,000 calls per snapshot).
- "Manual round" is its own row. "Start a manual round" opens an inline options form under the button: round name (prefilled `Manual round <date>`, editable), who can see it (three radio options, one line each), Discord post (checkbox, cleared, disabled and explained while the round is admin only). "Create round" creates it with no separate confirmation; "Cancel" closes the form.
- The round's card shows a summary (name, Before, After, who can see it, Discord, API calls used), its Before and After seals with help and cost, "Open on the site", and "Change options": the same form, "Save changes" sends only what changed (rename first, then settings).
- `app/_ui/admin/RoundOptions.tsx` (new, shared form), `ManualSection.tsx` and `AdminActions.tsx` rewritten around it, `lib/copy-admin.ts` copy, `lib/manual-event-schema.ts` (name and visibility schemas shared by create and rename), `latestManualEvent` now returns `callsUsed` per phase.
- `POST /api/manual-event` accepts an optional JSON body `{name?, visibility?, post_public?}` (D30). One new test in `app/api/manual-event/route.test.ts`.

## Decisions
- D30 in docs/DECISIONS.md. Inline form, not a modal: the options stay next to the button and the card uses the same component.
- Visibility is a radio group (three exclusive states), Discord a checkbox using the existing `drawn-check`. Radios use native `accent-plum`; no radio style exists in the brand CSS and none was added.
- Seals keep their confirmation sheet (they spend quota). Creating a round and saving options cost nothing, so they have none; the buttons are explicit.
- UI keeps "manual round" (the owner's words and existing copy); docs/GLOSSARY.md says "manual event".

## Deviations
- API change: the create route now takes a body (task allowed it only if a control needs a value the API did not accept; name and options are set before a round exists and rename is refused until a snapshot exists).
- Removed the unused `run.costs` and old `manual.*` copy keys.

## Verified
- `pnpm check`: prettier, eslint, tsc, 121 tests pass (1 skipped, pre-existing).
- Browser (built-in browser, `next dev` with fake env values and a throwaway harness page that rendered `AdminActions` with a stubbed `fetch`; harness deleted, nothing committed): at 360 px the three seals sit on one row with no horizontal scroll; the create form opens; choosing "Only me" clears and disables the Discord checkbox and shows the explanation; "Create round" sent `{name, visibility, post_public}` to `/api/manual-event`; on the card, a changed name plus visibility sent `/rename` then `/settings`. At desktop width (1024) the layout reads correctly.
- Not seen: the real `/admin` page behind the PIN, real API responses, the real Neon data, dark mode, the ConfirmSheet over the new layout, a failed save message. The success message after Save in the harness showed the stub's "round started" text because the stub answered every call with a create response.
- Upstream API calls made: 0.

## Open issues
- A new round with no snapshot is public on the selector as soon as it is created with a public visibility; the form now lets the owner pick "Only me" first, which avoids it.
- If a Save changes the name and the settings and the settings call fails, the rename has already happened (two calls).
- The summary shows the sum of `calls_used` of the round's snapshots, not the upstream quota left.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — nothing here changes the numbers it measures.
Owner must do first: merge this PR into `dev`, then look at `/admin` once in a browser with the PIN (layout and the create form).
Plan change: none.
<adjustments>
- The button is the third seal, labeled "Rehearse", in "Snapshots of the current event"; there is no "Rehearse now" label.
- Rehearsal cost on the seal is "About 45 calls"; the manual round's cost note is in "Manual round".
</adjustments>
