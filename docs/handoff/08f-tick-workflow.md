# 08f — Tick workflow: off-peak cron and strict status check

## Built
- `.github/workflows/tick.yml`: cron `7,22,37,52 * * * *` instead of `*/15 * * * *`; `curl -sS` without `--fail`; the job prints the HTTP code and fails unless it is 2xx.
- `docs/DECISIONS.md`: D26.

## Decisions
- Fail on non-2xx in the shell, not with `--fail`: `--fail` passes a `308` (a wrong `APP_URL`) as success and hides the status code. The explicit check also prints the code on failure.
- Kept the cadence (every 15 minutes, every day); only the minutes moved.

## Deviations
- Plan §3.1 says `*/15 * * * *` and Phase 6 says "one `curl --fail`". D26 records why both changed.

## Verified
- The status check, run in bash on the codes 204, 200, 308, 401 and 504: 204 and 200 pass; 308, 401 and 504 fail.
- Against `http://laptracker-inky.vercel.app/api/tick` (no secret sent) the new command returns `HTTP 308` and exits 1. The old command would have exited 0.
- `prettier --check` on `.github` and `docs/DECISIONS.md`: clean.
- Not verified: that GitHub now starts the scheduled runs. That can only be seen after the release reaches `main`: the first scheduled run should appear at 07, 22, 37 or 52 past the hour.
- Upstream API calls: 0.

## Open issues
- If no `schedule` run appears within about an hour of the release, add a second pinger and a tick log (nothing records a tick that answers 204 or a run GitHub never started).
- `pnpm check` can fail on `lib/queries/players.test.ts` (PGlite `beforeAll` timeout of 10 s) when the machine is under heavy load; it passes alone in 1.6 s. A larger `hookTimeout` would fix it.

## Next
Session: 9 — Dry run against production
Model / effort: keep — no signal.
Owner must do first: merge this PR, release `dev → main`, and wait for a scheduled run to appear in Actions.
Plan changes needed: §3.1 and Phase 6: cron minutes and the status check (D26).

<adjustments>
- The tick workflow's schedule is `7,22,37,52 * * * *`; a missing scheduled run means GitHub did not start it, so check Actions before the app.
</adjustments>
