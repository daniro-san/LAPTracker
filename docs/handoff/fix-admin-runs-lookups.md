# fix-admin-runs-lookups: /admin/runs no longer lists a lookup's roster as a stale alliance of the daily read (issue 509)

Branch `fix/admin-runs-lookups` from `origin/dev` (3ed4302d). **Size S**: a bug fix that restores intended behaviour, with no migration, no new decision, no new route and no change to private roster fields.

## Built

- **`problemsOf` (`lib/queries/daily-runs.ts`) counts only the read's own rows.** "Get today's details" stores its roster as that day's `daily_rosters` row (D133, `lib/lookup.ts`). Before this fix, `problemsOf` flagged that row as a stale alliance of the daily read when it was a cached copy or was read before the read's start minus 20 minutes. Now a row is left out when:
  - the day has an `alliance_lookups` claim for that alliance (any status: a roster can be stored and the claim still end `failed`), **and**
  - the daily read wrote no `run_logs` line for that alliance under that day (`read_day`, `union_id`).
  
  A looked-up alliance that the read also read later the same day (it joined the day's tracked set at 23:30 ST, or a workspace was made for it) has the read's lines, so it still counts. A row with no lookup claim counts as before, so days read before run_logs had `read_day` (#251, 2026-11-12) keep their problems.
  This applies to the list (`listDailyReads`), the shell's latest read and the per-day page (`getDailyRun`), which all use `problemsOf`.
- **Tests** (one focused test each):
  - `lib/queries/daily-runs.test.ts` (new): "names only the read's own stale alliances, never a lookup's roster stored under its day (D133)". Three rows on Fri 2026-11-20, read at 23:30 ST: one read by the read and stale; one lookup's cached copy; one looked up and then read (stale) by the read. Expects the first and the third.
  - `lib/sources/v1-options.test.ts`: "asks for the tracker's cached copy, with no fresh=1, when a call passes fresh: false (D133)".
  - `lib/daily-read.test.ts`, new describe "a workspace's alliance on its own key (D124, D133)":
    - "reads it on its own key, which our quota check does not count": quota at exactly `dailyReadQuota(1, 20)` = 62, so the read starts only if the keyed alliance is left out of our count; each call's `apiKey` is recorded.
    - "marks the key out of quota on its 429 and fails only that alliance; the read goes on".
  - `lib/private/access-request.test.ts`: "refuses an alliance neither the board nor a daily roster knows, and stores nothing (D133)".
  - `lib/collector.test.ts`: "reads the board's top 20 by might in a BEFORE when no tracked set exists yet (D133)".

## Decisions

- **Signal: the lookup claim plus the read's own run_logs lines.** Checked:
  - `daily_rosters` has no source column and no read time; `is_fresh` differs only by the freshness rule.
  - `alliance_lookups` alone is wrong when a looked-up alliance joins the day's tracked set at 23:30 ST: the read overwrites the lookup's row, and that row is then the read's.
  - `run_logs` alone hides the problems of the reads of 2026-11-10 and 2026-11-11, which have no lines (`read_day` came in #251), and depends on a best-effort insert.
  - The day's targets are not stored: `tracked_sets` holds the tracked part, but workspaces' alliances are not kept per day.
  
  The combination needs both signals to fail before a real problem is hidden. No migration and no change to what lookups store.

## Deviations

- Issue 509 says "show lookups separately". This fix only takes them out of the read's problems. /admin already lists today's lookups with their outcome (D133); no second list was added.

## Verified

- **`pnpm check` passed**: prettier, eslint, tsc, vitest (309 files passed, 2 skipped; 1641 tests passed, 4 skipped), drizzle drift, i18n (17 languages up to date).
- **Each new test fails when the code is broken on purpose** (one break at a time, then restored):

  | Break | Test that fails |
  | --- | --- |
  | `problemsOf` without the lookup condition | daily-runs: the lookup's alliance (67120002) shows up |
  | Lookup condition without the run_logs branch (`notExists(lookedUp)` only) | daily-runs: the looked-up-then-read alliance (67120003) is missing |
  | `fetchAlliance` always sends `?fresh=1` | v1-options: `fresh: false` |
  | `submitRequest` without the `isKnownAlliance` refusal | access-request: unknown alliance |
  | `allianceIds` with no board fallback (`ids = []`) | collector: board's top 20 with no tracked set |
  | `readOne` never passes the workspace key | daily-read: reads it on its own key |
  | `checkQuota` counts keyed alliances (`ids.length`) | daily-read: both key tests (the read stops at the quota rule) |
  | `failOne` never marks the key (`if (false)`) | daily-read: 429 marks the key (the read aborts instead) |

- No upstream call, no production access, no `.env*` read.
- **Analytics plan: no change.** No event, property or funnel step is added, changed or removed; this changes an /admin read model only.

## Open issues

- **Narrow mismatch with the read's own outcome.** If a looked-up alliance joins the day's tracked set and the read stops (deadline, 429, call cap) before reaching it, the read's own summary counts the lookup's roster as that alliance's (stale), while /admin/runs now leaves it out. The read's `failed` list does not name it either way. Rare; not changed.
- Issue 509 still has open items, not touched here: move the per-address lookup counting from the route into `lib`; a count query for the home page's alliance count; the extra query on every private request; the duplicated `isSameOriginJson`.

## Next

- Model/effort: keep. An S fix in one query plus five focused tests.
- Owner first: nothing. No migration.
- Plan change: none. Issue 509's follow-ups run from the issue, not from `docs/SESSION_PLAYBOOK.md`.

<adjustments>
- To tell a daily read's own `daily_rosters` row from a "Get today's details" one, use the rule in `problemsOf`: a row with an `alliance_lookups` claim for (union, day) belongs to the read only when `run_logs` has a line with that `read_day` and `union_id`.
- The four test gaps listed in issue 509 are closed: `fresh: false`, the daily read's workspace-key paths (own key, quota count, 429 marks the key), `unknown_alliance`, and the empty-set board fallback.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/623
