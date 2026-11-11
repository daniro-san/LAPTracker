## D26 — The tick runs at minutes 7, 22, 37 and 52 and fails on any non-2xx (2026-11-05, 08f)

- **Why:** after `tick.yml` reached `main` at 10:05 UTC, GitHub started no scheduled run in the next two hours (slots 10:15 to 11:00 missing from the Actions history); only manual dispatches ran. GitHub documents that schedule events can be delayed or dropped under load, and that the start of the hour is the peak. Also, `curl --fail` treats a `308` as success, so a wrong `APP_URL` (`http://`) passed as a green run that did nothing.
- **Rule:** cron `7,22,37,52 * * * *` (still every 15 minutes, still daily); the job prints the HTTP code and fails unless it is 2xx; `curl -sS` replaces the progress table. This replaces plan §3.1's `*/15` and Phase 6's "one `curl --fail`".
- **Not proven:** that the new minutes fix the missing runs. If scheduled runs still do not appear, the next step is a second pinger (plan §3.1 notes the manual fallback) and a tick log in the database.
