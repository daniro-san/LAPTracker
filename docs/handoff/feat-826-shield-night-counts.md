# feat-826-shield-night-counts

## Built
- Discord Raid Shield post (`lib/shield-post.ts`, `lib/copy-shield.ts`): before the morning check reads anyone, the post shows one night line with counts only ("Night check 23:31 ST: shield seen on 32 of 97 maps so far; maps refresh after the reset"), the existing hint and the link. It has no names and no away count. The English, PT-BR and FR words are new `night` keys; the unused `notSeen` key was removed.
- Desk (`lib/private/raid-prep.ts`): `handCheck` and each row's `hand` reason are null until the morning check has a reading. After that, "To check by hand" names members as before.
- Desk status line at night (`roll.prep.status.night`, EN/PT-BR/FR): "Shield seen on {on} of {read} maps so far; maps refresh after the reset (night check, {time} ST)". The "To check by hand" help text says the list fills after the morning check.
- D137: amendment dated 2026-11-28 with the probe evidence (54 of 97 post-reset maps at 02:30 ST, 49 of 54 shielded; 32 of 43 pre-reset maps already shielded).
- Tests: night post has counts and no names, in three languages, with no "unshielded" wording; morning post names members and counts away members; desk `handCheck` is null before the morning read. Three existing tests were adjusted to the new night text (`lib/shield-post.test.ts`, `lib/shield-read.test.ts`).

## Decisions
- The morning Discord post keeps its names ("Not seen this morning: …"). The issue says names appear "in To check by hand" after the morning check; I read the morning post as allowed to name them, as D137 already does.
- The night push notification ("{n} not seen with a shield yet") is a count only and is unchanged.
- The "unread" suffix ("· n not read") stays on the night line.

## Deviations
- None.

## Verified
- `pnpm vitest related --run` over the changed files: 118 files, 708 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, full vitest, drift, i18n).

## Open issues
- The desk's "Copy names" and "Copy one message" (for members not seen with a shield, an officer action) still work at night. The issue names the night output only, so they are unchanged.
- The weekly 02:30 ST post-reset read (option b of issue 726) is not built; it needs its own call-count decision.

## Next
- Decide on the weekly post-reset read as a third read feeding "To check by hand".
- Remove the probe code after probe query 2 (issue 726).
- Add the PT-BR and FR strings to patch notes at the next release (`lib/patch-notes.ts`).

What was missing from the task prompt? Nothing material; whether the morning Discord post may keep names was left to my reading.

PR: (added by the orchestrator)
