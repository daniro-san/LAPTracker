## D21 — Event-driven tick and rehearsals (2026-11-04, Session 4 follow-up; supersedes parts of D20)

The Session 4 prompt was rewritten on `dev` (#11, #12) while the session ran; #13 was merged with the first version. This entry covers the follow-up that implements the rewrite.

- **Supersedes D20's `test=1`:** that parameter is gone from `/api/snapshot`. A dry run is a rehearsal (`POST /api/rehearsal`).
- **Supersedes D20's tick bullet:** phase times live on the event (`events.before_at`, `after_at`, NOT NULL; migration 0002). The tick does one thing per call, in this order:
  - it creates the coming Saturday's row from the env, silently, from 24 h before BEFORE until AFTER's window closes;
  - it runs the earliest phase of any event (Saturday or rehearsal) whose `[x_at, x_at + SNAPSHOT_WINDOW_MIN)` window holds now and that has no snapshot row of any status;
  - otherwise it runs the Friday check, claimed on the coming Saturday's row;
  - otherwise it runs a due `REHEARSAL_AT` slot.

  A Saturday row's times are fixed when the row is created, so changing `SNAPSHOT_BEFORE` after that does not move that week's run.

- **Credentials per route:**
  - `/api/tick` accepts CRON_SECRET only;
  - `/api/rehearsal` accepts the PIN only (plan Phase 4);
  - the others accept either.
- **`REHEARSAL_AT` slots are rows in `rehearsal_slots`.** The first tick in a slot's window claims it (insert on conflict do nothing), then creates the rehearsal, or records why it was skipped and posts one `[TEST]` admin note. So a slot runs at most once and a skip is announced once.
  - An empty `REHEARSAL_AT` means off: `lib/env.ts` keeps that one key's empty value instead of applying the `fri 18:00` default.
  - `REHEARSAL_KEEP` defaults to 4.
- **Rehearsal guards** (button and schedule alike), in this order:
  - neither now nor the rehearsal's AFTER (now + 45 min) may fall on `EVENT_WEEKDAY` or the day after;
  - no real BEFORE in (now, now + 3 h], checked against both the DB rows and the env-computed coming Saturday;
  - no real snapshot `running` and younger than 10 min;
  - no pending rehearsal (AFTER window still open, AFTER not finished).

  The pending check is read-then-insert, so two simultaneous button presses could create two rehearsals; a scheduled slot cannot race.

- **A rehearsal's `event_at_utc`** is the midpoint between its phases (created + 30 min). It keeps the column unique.
- **Retention:** creating a rehearsal deletes all but the newest `REHEARSAL_KEEP` test events, with their run_logs, member rows, alliance rows and snapshots, in one transaction. Slot rows stay, with `event_id` set to null.
- **The verdict** is computed from the database (`loadVerdictInput` + `rehearsalVerdict`), so `/admin` can recompute it. It is posted after any test event's AFTER run. Its quota line uses `snapshots.quota_remaining_before` (new, migration 0002): the quota check's `remaining`. That response already counts its own call, so a run's quota drop is `before − after + 1`, and it has to equal `calls_used`. No AFTER run means no verdict; the missing message is the signal.
- **Test events** never reach the public webhook. Their admin lines start with `[TEST]`. `GET /api/events` and `/api/events/[id]` don't serve them. Admin run messages now include "scheduled …, started …" (plan §3.1).
