# 08zzm — Event pages show the capture window

## Built
- `CaptureWindow` in `app/_ui/Status.tsx`: one line `BEFORE 10:01 → AFTER 14:01 server time`. Each side is the phase's finish time (`finishedAt`, else `startedAt`, the same time "Last updated at" uses) in the page's clock (server time, or the viewer's zone with "your time", D38). Both sides carry the day when the two times fall on different days (`Nov 6, 22:30 → Nov 7, 13:01`). The clock's word follows the last time shown. A phase not run yet reads `—`, a running one `Updating now` (`status.running`), a failed one `failed` (`status.failed`); a partial phase shows its time (the stale seal beside the chips already says what went wrong).
- The component takes one `before` and one `after` phase, so a page with several windows can render it once per window.
- Where it shows: under the status chips on `/` and `/events/[id]` (`app/_ui/EventView.tsx`), and under the title row of `/events/[id]/alliances/[unionId]`, from the event's phases that `loadAlliance` already read (`listEvents`). No new query.
- Copy: `status.before` "Before", `status.after` "After" in `lib/copy.ts`, translated into all 17 other languages and stamped.
- Tests: two in `app/_ui/Status.test.ts` (same day / different days; missing, failed and running phases).
- DESIGN.md `status-strip`: one sentence describing the line.
- `NameTimeline` moved unchanged from the alliance page into `app/_ui/AcrossEvents.tsx`: the page was at eslint's 300-line limit before this change.

## Decisions
- The times are the snapshot runs' times (event level), not each alliance's `source_updated_at` (which the Details table heads show). The issue asks when the Before and the After were taken for the event.
- Labels as small caps (`BEFORE`, `AFTER`) with the value beside them, not a sentence template: the state words (`Updating now`, `failed`) then read as values in every language without case or word-order issues.
- No duration. The session prompt did not ask for it (the issue says "if it fits"); see Open issues.
- No window on `/players/[uid]`: that page spans events and has no single event's Before and After. It keeps its `As of …` line. The issue lists "player pages of an event"; no such page exists.

## Deviations
- translate-copy: 15 languages came from the Haiku translator. The `pl` and `id` translators stopped on a rate limit (5-hour limit, HTTP 429); `pl` had already written its two keys. The `th` translator answered that it got no language tag. I wrote `id` ("Sebelum" / "Sesudah") and `th` ("ก่อน" / "หลัง") myself, then stamped and ran `pnpm check`.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (213 passed, 1 skipped), drift, i18n (17 languages up to date).
- Local `next dev` on a throwaway stack with no upstream call and no Neon: Postgres 18 in the scratchpad with `drizzle/0000`–`0011` applied by psql, a WebSocket→TCP relay, a `NODE_OPTIONS` preload that sends the Neon driver's socket to it, and `env -i` with placeholder variables (no API key, upstream hosts on `127.0.0.1:9`, no webhooks). Rows: `scripts/seed.ts`, plus two events added by SQL: a manual round whose Before finished Nov 6 22:30 and whose After finished Nov 7 13:01 server time, and a scheduled event with only a Before.
- Screenshots (Chrome over Playwright, exact width, `prefers-color-scheme` emulated). `scrollWidth` equals the viewport in every capture:
  - `docs/screenshots/08zzm-event-{360,1280}-{light,dark}.png`: `/events/3`, one line (20 px high).
  - `docs/screenshots/08zzm-alliance-{360,1280}-{light,dark}.png`: `/events/3/alliances/67109944`, one line.
  - `docs/screenshots/08zzm-twodays-360-{light,dark}.png`: days differ; wraps to two lines at 360 px (one at 1280).
  - `docs/screenshots/08zzm-noafter-360-{light,dark}.png`: `BEFORE 10:01 server time → AFTER —`.
- Text content reads `Before 10:01 After 14:01 server time` (the arrow is `aria-hidden`; real spaces separate label, value and side).

## Open issues
- Duration (`· 4 h`) is not shown. Same-day lines at 360 px have room for it; the two-day line already wraps. Owner's call whether to add it.
- When the days differ, the line takes two lines at 360 px (`BEFORE Nov 6, 22:30` / `→ AFTER Nov 7, 13:01 server time`).
- The window's times (run finish) and the Details heads (each alliance's source time) can differ by minutes for the same phase. Both are correct; they measure different things.

## Next
Session: none planned after this change in docs/SESSION_PLAYBOOK.md; it goes into the next `dev → main` release.
Model / effort: keep — a small UI line.
Owner must do first: merge this PR into `dev`.
Plan changes needed: none.

<adjustments for="Session 08zzh">
- `CaptureWindow({ before, after, clock, copy })` in `app/_ui/Status.tsx` renders one window from one Before and one After `PhaseStatus`. With several windows or samples per event, render it once per window and pass that window's phases; the event page and alliance page call sites each pick `phase === "before" | "after"` from the event's snapshots today.
</adjustments>
