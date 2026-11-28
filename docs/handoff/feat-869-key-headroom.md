# feat 869 - tracker key headroom

## Built

- `lib/private/key-headroom.ts`: `callsToday` (one query: run_logs lines for this workspace's slug and alliance, today's UTC quota day, plus its `recruit_reads` row), `headroomOf`, `headroomView` (Alliance settings), `headroomWarning` (Home).
- `app/(private)/_ui/KeyHeadroom.tsx`: the card's section inside the Tracker key card. One row per feature (label and number), the planned calls, the quota left, and the "plan needs about N; M are left" line when short.
- Home: `KeyCard` shows one line with a link to Alliance settings when the plan exceeds what is left (`home-cards.ts` passes it).
- Copy `headroom.*` in EN, PT-BR and FR (`lib/private/dictionary.settings.ts`).
- Dated amendment to D124.
- Test: `lib/private/key-headroom.test.ts`.

## Decisions

- Squads, Raid Shield morning read, after-reset read and recruit check are counted. The raid opponent read and the daily update are logged once for all alliances, so they show "not counted".
- Friday's Raid Shield read is the day's squads read (D137), so it is inside the squads number. Its label says so.
- Planned = estimate for today (Saturday UTC uses the peak) minus the calls counted today. Left = the key's stored quota. Short = planned > left, and never when the quota is unknown.
- Settings card shows for states `ok` and `site`; Home warns only for `ok` with a stored quota.
- Home reads the member count first and runs the log query only when the whole plan exceeds the quota left.
- Copy says "Daily update" (glossary term).

## Deviations

- Recruit counts come from `recruit_reads`, not run_logs: recruit reads are logged to the console only. They are in the same SQL statement, so it is still one query.
- `run_logs` is read for today's and yesterday's `read_day`: Saturday morning's lines carry Friday's day.

## Verified

- `pnpm vitest related --run` on the changed files: pass after the "Daily update" wording fix.
- `pnpm check`: pass.
- Not run: a browser check at 360 px. The layout is label and number rows on one line.

## Open issues

- A key that is the site's key (issue 855) shares its quota with the whole site, but the card counts only this workspace's calls.
- `quotaRemaining` is the newest stored answer; calls made after it are not subtracted.

## Next

- Count the raid opponent and daily reads per workspace if the owner wants them in the card (needs a per-workspace log line).

What was missing from the task prompt? The issue says "from run logs", but recruit reads are not in run_logs; the prompt did not say to take them from `recruit_reads`.

PR: (added by the orchestrator)
