# 08n — Manual round Discord messages

## Built
- `lib/copy-discord.ts`: `public.manual` ("Manual round: {name}. Not a Saturday event."), `admin.manual` (`[manual]`), `admin.manualRun` (run line with the round name).
- `lib/notify.ts`: `Notifier.admin` options are `{ test?, manual? }`; `manual` adds the `[manual]` prefix the way `test` adds `[rehearsal]` (`test` wins if both are set). `adminSnapshotMessage` takes `roundName`: when set, the run line carries the name and the "due ... started" line is omitted. `publicSnapshotMessage` takes `roundName`: when set, the description starts with the manual-round line.
- `lib/repo/events.ts`: `EventInfo` and its select carry `name`.
- `lib/run.ts` (`notifyFinished`): passes `roundName` (only for `events.manual`) and `manual` to the notifier.
- `lib/notify.test.ts`: three tests (admin manual message, public manual message, `[manual]` prefix). Saturday and rehearsal text is covered by the existing exact-text tests, which pass unchanged.

## Decisions
- Admin manual run line: `✓ {name} · Before snapshot: done · {stamp}`. The prefix is the notifier's, as for `[rehearsal]`, so the sent line is `[manual] ✓ {name} · Before snapshot: done · ...`.
- Public manual message: first description line "Manual round: {name}. Not a Saturday event."; title, counts, movers and colour unchanged. A failed run now has a description (that line) where it had none.
- "Every admin line starts with `[manual]`" is read as the existing mechanism: the prefix goes once at the start of each admin message, like `[rehearsal]`. A manual round sends one admin message per run.

## Deviations
- None.

## Verified
- `pnpm check` on Node 26.5.0: prettier, eslint, tsc and 128 tests pass (1 skipped as before).
- Not run: a real Discord post (no webhook used), a real manual round.
- Upstream API calls made: 0.

## Open issues
- The round name is user text (1–80 characters, no control characters, D28) and goes into Discord as-is. Admin mentions are limited to the configured id and the public webhook allows none, so it cannot ping; Discord markdown in a name would render.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — this change touches message text only.
Owner must do first: merge this PR into `dev`.
Plan change: none.
<adjustments>
- A manual round's admin messages start with `[manual]` and show no "due ... started" line; do not read a missing due line as a bug when checking messages.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/87
