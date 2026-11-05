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

## Verified (first pass, browser harness)
- `pnpm check`: prettier, eslint, tsc, 121 tests pass (1 skipped, pre-existing).
- Browser (built-in browser, `next dev` with fake env values and a throwaway harness page that rendered `AdminActions` with a stubbed `fetch`; harness deleted, nothing committed): at 360 px the three seals sit on one row with no horizontal scroll; the create form opens; choosing "Only me" clears and disables the Discord checkbox and shows the explanation; "Create round" sent `{name, visibility, post_public}` to `/api/manual-event`; on the card, a changed name plus visibility sent `/rename` then `/settings`. At desktop width (1024) the layout reads correctly.
- Not seen: the real `/admin` page behind the PIN, real API responses, the real Neon data, dark mode, the ConfirmSheet over the new layout, a failed save message. The success message after Save in the harness showed the stub's "round started" text because the stub answered every call with a create response.
- Upstream API calls made: 0.

## Audit of the whole /admin (UX pass, widened scope)
Seen in production (https://laptracker-inky.vercel.app, owner's logged-in Chrome, read-only: page text, two screenshots, no control touched; I resized that Chrome window to 360x800 and back to 1280x900; the 360 px capture did not reflow, so the 360 px judgement comes from the local build). Production already had the manual-round card and the dropdown (it is newer than v0.2.1). Pages read: /admin, /admin/runs, /admin/errors. Not opened: /admin/runs/[id].

| What was confusing | What I changed |
|---|---|
| Order: schedule first, the run buttons in the middle, the last rehearsal result at the very bottom, far from the Rehearse seal. | Order is now by purpose: API calls left, Run something now, Last rehearsal, Schedule (reference). |
| "Data requests: Requests left today after the last run: 927" had no total and used a word no other page uses. | "API calls left today: 927 of 1,000 left after the last run (time)". |
| Seals stacked one per row; Rehearse separate from the other two. | One row of three, each with help and cost (this PR's first commit). |
| Rehearsal: the PASS/FAIL verdict sat below the phase lines, checks were an unlabelled list. | Verdict first and larger, then the two phases, then a "Checks" list with row rules; one-line explanation under the heading. |
| Schedule looked like something to act on. | Renamed "Schedule", one line says it is read-only (set in the environment), moved to the bottom. |
| Manual round: dropdown, stacked seals, no state summary, confirm before creating. | Radio options, checkbox, summary, inline form (first commit). |
| Runs list: one long dot-separated line; manual rounds showed only their creation time, not their name; "1 calls". | Four short lines per run (phase and state, event name for a manual round or the event time otherwise, started, "API calls: n · n left today"), a one-line help under the heading. |
| Result message after a run: "✓ Before snapshot failed: 1 calls, ... (not fetched included)". The ✓ was shown even when the run failed, and the message sat at the bottom of the card, far from the seal. | Mark follows the status (✓ done, ! partly done, ✗ failed); wording "API calls used: n. Stale: n. Failed: n."; the message is a framed box at the top of the run area and scrolls into view. |
| Errors page and run detail page: no change needed beyond the nav. | Left as is. |

## Verified locally with a throwaway stack (every control)
Isolation: a throwaway Postgres 18 in the scratchpad (port 5499, own data directory), reached through a small WebSocket bridge and a preload that redirects the Neon driver's URL to it; seeded with `scripts/seed.ts` (22 alliances, 3 Saturdays, 1 rehearsal). The dev server ran with `env -i` and its own variables: `DATABASE_URL` pointing at that local database only, a placeholder `LAP_API_KEY`, the upstream base URL set to an unroutable address (so no upstream call could be made), no `NOTIFY_*` variables, and a made-up PIN kept in a scratchpad file (not in the repo, not repeated anywhere). Connection to the local database confirmed (a session on the local server) before any control was pressed. The owner's `.env.local` was not used. Everything was driven with Playwright and system Chrome at 360 px and 1280 px; overflow 0 at both; the three seals have the same top at both widths.
- Gate: PIN field and Unlock; the page loads after it.
- Create form: opens under the button; "Only me" clears the Discord checkbox and disables it with its explanation; Cancel closes it; "Create round" created the round (status "Manual round started", row visible in the local database).
- Seal confirm sheet: names the cost; Cancel does nothing; "Go ahead" ran the snapshot, which failed as expected with no upstream (status "✗ Before snapshot failed ..." after the fix above, "Failed" state in the summary, 1 call counted).
- Round card: after a run the options form lets the name change (the field is disabled with a note before a run); a name plus visibility plus Discord change was saved as two calls ("Saved"); switching to "Only me" and saving left Discord off.
- /admin/runs (new layout, failed run on top, seeded runs below), a run's page, /admin/errors (empty).
- Not covered: a completed manual-round run (the fake upstream refuses, so only the failed state was seen; "done" and "partly done" come from the seeded Saturday runs in the list), dark mode, a real Discord post (disabled by design), the real PIN rate limit. The Next.js "1 Issue" dev badge in the captures is a hydration warning caused by Chrome automation adding a `caret-color` style to the PIN field, not by the app.
- `pnpm check` passes (121 tests, 1 skipped).

## Open issues
- A new round with no snapshot is public on the selector as soon as it is created with a public visibility; the form now lets the owner pick "Only me" first, which avoids it.
- If a Save changes the name and the settings and the settings call fails, the rename has already happened (two calls).
- The run detail page was not opened in production and is unchanged.
- Bigger ideas not built: a "Today" strip with the last run per event, a delete for a manual round (D28), a toggle for the owner timezone on dates, pagination or filters on the runs list (it shows the newest 60).
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

https://github.com/daniro-san/LAPTracker/pull/82
