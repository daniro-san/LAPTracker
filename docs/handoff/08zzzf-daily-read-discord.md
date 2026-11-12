# 08zzzf — Daily read Discord line

Owner request, 2026-11-12, after PR 239. The daily roster read's admin Discord message now lists every alliance it did not read (PR 239). After a whole-day outage that is one line per alliance: 22 lines on 2026-11-12. The owner chose two of three suggestions: group the alliances by reason, and end the message with a link to what can be done. The third suggestion, an alert for a read left `running`, was not chosen.

## Built
- `lib/notify-daily.ts` (new): `dailyReadMessage(summary, at, origin)`, moved out of `lib/notify.ts`, which was at the 300-line limit. The message is:
  - the header line and the `error:` line, unchanged;
  - one line per failure reason, in the order the reasons first appear: `✗ {error} ({n}): {list}`, the alliances as `[TAG]`;
  - the stale line, unchanged;
  - a last line with a link: `[Retry on /admin ↗](<{origin}/admin>)` for a `failed` day, `[Daily reads ↗](<{origin}/admin/runs?show=daily>)` for a `partial` one. The message is still sent only for those two states.
- `lib/notify.ts`: `allianceLabel`, `STATE_WORD` and `STATE_ICON` are now exported for `notify-daily.ts`. No other change.
- `lib/tick.ts`: `dailyRead` takes the tick's `origin` and passes it to `dailyReadMessage`, as the snapshot messages get theirs.
- `lib/copy-discord.ts`: `admin.dailyFailed`, `admin.dailyRetry`, `admin.dailyRuns`.
- Docs: D60's "Every alliance in the admin line" bullet describes the grouping and the link. The README "Admin channel" table has three new rows for the daily read message; it had none before.

## Decisions
- **Group key is the error text** (`v1 TimeoutError`, `v1 http 503`, `not fetched: deadline`). These strings come from `describe()`, so they are our own words, never a third-party message.
- **Links are absolute and use the tick's `origin`**, like `[Run 42 ↗]` and `[Runs ↗]` in the snapshot messages. Plain text `· /admin` (as in the tick-silence alert) cannot be clicked in Discord.
- **A partial day links to the runs list, not to Retry**, because a partial day cannot be retried (PR 239).
- `Map.groupBy` is not in the project's `lib` (ES2023). Grouping is a `Set` of reasons plus a filter; `tsconfig.json` is unchanged.

## Deviations
- No committed test. The task did not ask for one (CLAUDE.md). Checked with temporary tests, deleted before the commit (see Verified).

## Verified
- Temporary tests (`vitest run`, 2 passed, then deleted):
  - The 2026-11-12 case (status failed, error deadline, 12 × `v1 TimeoutError`, 8 × `not fetched: deadline`) renders 5 lines:
    ```
    ✗ Daily roster read 2026-11-12: failed · 17 calls · Thu, 11/12/2026, 06:07 server time
    error: deadline
    ✗ v1 TimeoutError (12): [NSE], [URSA], [OGs], [TmS], [WACK], [YAHO], [FSPN], [RDK], [TRI], [TEST], [HSR], [PSY]
    ✗ not fetched: deadline (8): [IMPA], [BRAV], [NDA], [BOH], [CR8R], [WOK], [AFR], [FGH]
    [Retry on /admin ↗](<https://lap.example/admin>)
    ```
  - A partial day ends with `[Daily reads ↗](<…/admin/runs?show=daily>)` and keeps the `○ stale [TAG]` line.
  - Through `POST /api/tick` (PGlite, fake Discord) with every alliance timing out: exactly one admin post. It holds `✗ v1 TimeoutError (20): …` and ends with `[Retry on /admin ↗](<https://laptracker.test/admin>)`, the request's origin.
- `pnpm check`: prettier, eslint, typecheck, 254 tests passed (1 skipped), drift check "No schema changes", i18n "17 languages up to date".
- No upstream call was made and no real Discord message was sent.

## Open issues
- A read left `running` (killed function) still sends nothing. The third suggestion (a one-time alert from the tick watcher, D45) was not chosen. `/admin` shows the stuck day with Retry (PR 239).

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. All checks passed on the first full run; the only rework was the 300-line file limit and `Map.groupBy` missing from the ES2023 lib.
Owner must do first: merge this PR into `dev`, then release (Actions → Prepare release, minor). The new message shows the next time a daily read falls short.
Plan changes needed: none.

<adjustments>
- The daily read's admin message lives in `lib/notify-daily.ts`; `lib/notify.ts` is at the 300-line limit, so new message builders should go in their own file and import `allianceLabel`, `STATE_WORD`, `STATE_ICON` from `notify.ts`.
- `tsconfig.json` `lib` is ES2023: `Map.groupBy` / `Object.groupBy` do not type-check.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/240
