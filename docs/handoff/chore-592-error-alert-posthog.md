# chore-592-error-alert-posthog

## Built
- `lib/app-errors.ts`: `recordAppError` no longer claims or posts an admin alert. It still stores the row (detail after `redactPrivate`), logs the console line and sends PostHog's `$exception`. Removed `alertReason`, `ALERT_GAP_MS`, `ALERT_REASON_CHARS`.
- `lib/repo/app-errors.ts`: removed `claimAppErrorAlert` and `APP_ERROR_ALERT`. `claimAlert` and `TICK_SILENCE_ALERT` stay (tick silence uses them).
- `lib/notify.ts`, `lib/copy-discord.ts`: removed `appErrorMessage` and the `appError` and `digest` strings, used only by this alert.
- Tests: deleted "alerts once per hour while errors continue", the concurrent-claim test and the two `appErrorMessage` tests. The privacy tests now check the stored row and PostHog's payload (the alert text is no longer checked); the first also asserts no admin post.
- D115: amendment dated 2026-11-22.
- `lib/patch-notes.ts`: owner to-do "PostHog → Error tracking → Alerts" is `done: true`.
- Comments that named the admin alert updated in `lib/report-error.ts`, `lib/private/http.ts`, the share route.

## Decisions
- No env or config was used only by the alert (the admin webhook serves run reports and the tick watcher).
- `app_alerts` stays: the tick-silence alert writes id 2. The id 1 row is no longer written.
- `docs/analytics/tracking-plan.md` does not describe the alert; unchanged. `docs/IMPLEMENTATION_PLAN.md` still describes it (lines 150, 460, 702) and is not edited per CLAUDE.md.

## Deviations
None.

## Verified
- `pnpm vitest related --run` on the changed files: 155 files, 895 tests passed.
- `pnpm check`: passed (one lint fix for an unused import in round 1).

## Open issues
- None.

## Next
- Follow-up: delete the stale `app_alerts` id 1 row in a later migration if wanted (no migration here).
- Follow-up: `docs/IMPLEMENTATION_PLAN.md` § Observability (line 150), Phase 6 alerts (line 460) and the deferred-notes line 702 describe the removed alert; update them.
- D115's plan to remove `app_errors`, `/admin/errors` and the purge after the PostHog comparison is still open.

What was missing from the task prompt? Nothing.

PR: (added by the orchestrator)
