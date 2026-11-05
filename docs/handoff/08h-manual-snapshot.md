# 08h — Manual snapshot (manual rounds)

## Built
- Migration `drizzle/0004_cynical_vapor.sql`: `events.manual boolean not null default false`.
- `lib/repo/events.ts`: `createManualEvent`, `getEventInfo`; `EventInfo.manual`; `duePhases` skips manual events.
- `POST /api/manual-event` (no body, PIN only, 201 `{event_id}`): creates a round named `Manual round <date>`.
- `POST /api/manual-event/rename` `{event_id, name}` (PIN only): allowed once the round has a snapshot; 1–80 characters, plain text.
- `POST /api/snapshot` takes an optional `event=<id>`; the id must be a manual event, otherwise 404 `event_not_found`.
- `lib/run.ts`: no not-due check for a manual event; no public Discord post for it.
- `allianceHistory`, player history (`sightingsOf`) and `historyRanks` ignore manual events.
- `/admin`: a "Manual event" card with a "Start a manual round" button, a rename field (after the first snapshot), the newest manual event's Before and After buttons, each phase's state, a link to the public page and the quota cost (about 21 of 1,000 calls).
- `lib/queries/admin.ts` `latestManualEvent`; copy in `lib/copy-admin.ts`; D28 in `docs/DECISIONS.md`; a glossary row.
- `app/api/manual-event/route.test.ts`: nine tests (create and auth, rename rules, Before and After on different days with force and no public post, non-manual id refused, tick ignores it, history ignores it).

## How to use it
1. Merge into `dev`, release to production, and let the migration run (`pnpm db:migrate` as for earlier migrations).
2. Open `/admin`, "Run something now", "Manual event". Press "Start a manual round", confirm. The round is named `Manual round <date>`.
3. Press "Before", confirm (about 21 of the day's 1,000 API calls, up to a minute). Run it at the hour you want, for example 17:00 UTC-3.
4. Now the "Round name" field appears. Type a name (for example `teste do danilo`) and press "Rename". The name shows in the event selector and on the event page.
5. On another day, at any hour, press "After". Nothing links the two times. The tick never runs the round and a pending After never delays Saturday.
6. "Open on the site" shows `/events/<id>`. Pressing a finished phase again asks "Take it again?" and replaces that phase. For a new round, press "Start a manual round" again.

## Controls (added after the first review)
On `/admin`, "Manual event", for the newest round, at any time, even after it ran:
- **Who can see this round** (migration 0005, `events.visibility`):
  - "Only me (admin)": the round disappears from every public page and API.
  - "Public, on its own page" (default): event page, selector and `GET /api/events` show it. Saturday's deltas, ranks and player history ignore it.
  - "Public, and part of the history": it also takes part in the comparisons. Saturday's "since the last event" changes then compare against this round's numbers (its After, else its Before) if the round is dated before Saturday. Switching back undoes it at once; nothing is re-collected.
- **Post to the public Discord channel** (checkbox, default off, `events.post_public`): when on, each Before or After that finishes posts the same public message the tick posts. It is disabled while the round is "Only me", and the server refuses the combination (409 `admin_cannot_post`). The admin channel always gets its usual line.
- The home page keeps showing the newest real event (Saturday's), whatever the round's visibility.

## Decisions
- A flag column, not "past phase times" alone: the tick would otherwise run a manual event inside its window. Details in D28.
- The Saturday guard is untouched. The manual route accepts only manual events.
- A round is created with a default name and renamed after its Before (owner, 2026-11-05); the earlier typed-name-at-creation design was dropped.
- An open round does not block Saturday; no overlap guard was added (D28).
- Discord: off by default, per round (see Controls).
- Rounds are outside the comparison chains by default; "public in history" opts one in.
- Reading of "right away": the event page and selector show it as soon as a snapshot exists. The home page shows the newest event by date, which is Saturday's (empty) event until its first run, so the home page does not show the demo.

- Confirmed: with a manual round and Saturday both present, nothing is overwritten. Each round is its own event row, each event has at most one snapshot per phase, and only `force=1` on the same phase of the same event replaces data. Saturday does not take the manual round as its previous event (D28, tested).

## Deviations
- None from the task. The query exclusions touch three files beyond the minimum; without them Saturday's deltas would reference the demo.

## Verified
- `pnpm check`: passes (prettier, eslint, tsc, 119 tests).
- Tests run against PGlite with the fake upstream. Upstream API calls made: 0. Production not touched.
- Not verified: the card in a browser at 360 px; the migration against Neon.

## Open issues
- No delete for a manual event; a leftover demo stays public on the selector until removed in the database.
- The home page never shows a manual round, by choice.
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
