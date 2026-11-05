# 08h — Manual snapshot

## Built
- Migration `drizzle/0004_cynical_vapor.sql`: `events.manual boolean not null default false`.
- `lib/repo/events.ts`: `createManualEvent`, `getEventInfo`; `EventInfo.manual`; `duePhases` skips manual events.
- `POST /api/manual-event` (`app/api/manual-event/route.ts`): JSON `{name}`, PIN only, 201 `{event_id}`.
- `POST /api/snapshot` takes an optional `event=<id>`; the id must be a manual event, otherwise 404 `event_not_found`.
- `lib/run.ts`: no not-due check for a manual event; no public Discord post for it.
- `allianceHistory`, player history (`sightingsOf`) and `historyRanks` ignore manual events.
- `/admin`: a "Manual event" card with a name field, a create button, the newest manual event's Before and After buttons, each phase's state, a link to the public page and the quota cost (about 21 of 1,000 calls).
- `lib/queries/admin.ts` `latestManualEvent`; copy in `lib/copy-admin.ts`; D28 in `docs/DECISIONS.md`; a glossary row.
- `app/api/manual-event/route.test.ts`: five tests (create and auth, weekday run with force and no public post, non-manual id refused, tick ignores it, history ignores it).

## How to use it
1. Merge into `dev`, release to production, and let the migration run (`pnpm db:migrate` as for earlier migrations).
2. Open `/admin`, go to "Run something now", then "Manual event".
3. Type a name (for example `Alliance leaders demo 2026-11-05`), press "Create manual event", confirm.
4. Press "Before", confirm: about 21 API calls, up to a minute. Press "After" later, in any window you choose.
5. "Open on the site" shows `/events/<id>`. The event is also in the event selector. A second press on a finished phase asks "Take it again?" and replaces that phase's rows.
6. For another demo or another window, create another manual event.

## Decisions
- A flag column, not "past phase times" alone: the tick would otherwise run a manual event inside its window. Details in D28.
- The Saturday guard is untouched. The manual route accepts only manual events.
- Discord: a manual run never posts publicly. It posts the normal admin line.
- Manual events are excluded from cross-event deltas, ranks and player history so Saturday is not compared with a demo.
- Reading of "right away": the event page and selector show it as soon as a snapshot exists. The home page shows the newest event by date, which is Saturday's (empty) event until its first run, so the home page does not show the demo.

## Deviations
- None from the task. The query exclusions touch three files beyond the minimum; without them Saturday's deltas would reference the demo.

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 115 tests).
- Tests run against PGlite with the fake upstream. Upstream API calls made: 0. Production not touched.
- Not verified: the card in a browser at 360 px; the migration against Neon.

## Open issues
- No delete for a manual event; a leftover demo stays public on the selector until removed in the database.
- The home page does not show a manual event while a newer-dated Saturday event exists.
- A failed manual run can raise the upstream banner (D27 counts public events).
- The `ConfirmSheet` text for "Create" says the event is public once a snapshot exists; an empty event is also listed by `GET /api/events`.

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev`, deploy, apply migration 0004.
Plan changes needed: none.

<adjustments>
- Quota: each manual snapshot costs about 21 calls; count them when reconciling Session 9's arithmetic for today.
- Manual events appear in `/admin/runs` as normal runs with the event's name.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/77
