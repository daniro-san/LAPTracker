# feat-829-away-until

## Built

- Me page, "Days you are away": first and last day (server days), one save button, one clear button. Route `POST /api/w/[slug]/me/away` (`{from, until}` or `{clear: true}`), behind `requireBoard` and an approved link, uid taken from the link, strict body.
- Storage: field `away` in `member_self_reports` (value `{from, until}` or null). Migration `0087_huge_dragon_man.sql` only widens the field check. Nothing is written to `member_facts`.
- Effect: `factsOf` and the tick's `awayFacts` lay the member's days over the facts as `ownAway`. `awayOn` and the new `awayNoteUntil` (`lib/member-away.ts`) read it beside the officer's away note and On a break. The roll call, Raid prep, caravans, KvK plan, shield check, Insights and Follow-up (members.ts, so #821's "not seen" reason too) leave the member out on those days.
- Officers: the member card's "Sent by the member" block gets a line "Away, the member's own report: {from} to {until}", with no buttons. It shows until the last day passes, including days still to come.
- Expiry: past days stop counting by themselves; nothing is deleted. A last day already past is refused (400 `past`), and more than 90 days ahead is refused (400 `far`).
- Words in EN, PT-BR and FR (`lib/private/dictionary.self-report.ts`).
- Decision: dated amendment to D154 (2026-11-28).

## Decisions

- Reused `member_self_reports` (D154's table) instead of a new table: the workspace download, the purge with the workspace and the "only the user who holds the approved link now" read all apply as they are. The three "Tell your officers" reads filter `away` out, so it has no New, Put on the card or Seen.
- Reused the existing suppression rule rather than a second one: one `awayNoteUntil` for the three places that read an away note, `awayOn` for the roll call paths.
- An officer's away note wins over the member's when both run (the Members list then shows the officer's date).
- The Members list and sheet show the member's days as "On a break until {date}", the same chip as an officer's note; only the card says it is the member's own report.
- No daily limit and no request id for this route: one row per user, written in place.
- The 90-day cap is a guess to stop a member hiding themselves from Follow-up for a year; it is one constant (`AWAY_MAX_DAYS`).

## Deviations

- None from the issue. D154 said an away note from the member "needs its own decision"; the amendment is that decision.

## Verified

- `pnpm vitest related --run` on the changed files: 147 files, 832 tests passed, before the last refactors. After them, the two new test files pass.
- `pnpm check`: prettier, eslint, tsc, vitest, drift check and i18n check all pass.
- Tests: `me/away/route.test.ts` (set and clear for the member's own uid only, a body naming a uid is 400; a pending or unlinked member is refused and stores nothing; roll call away on those days only; the card shows the member's report; a past last day is refused and days expire) and `lib/private/members-own-away.test.ts` (Follow-up skips the member including the not-seen reason; the reasons return after the last day).
- Not run: the page in a browser (no local data, no env file). The 360 px layout and 44 px targets come from `min-h-11`, `buttonClass` and `FIELD`, not from a screenshot.

## Open issues

- The Members list shows the member's days as "On a break until"; an officer cannot tell from the list alone that it is the member's report (the card says it). A tag there would be a follow-up.
- Roll call itself shows "until {date}" with no "own report" label.
- A member can set days up to 90 days ahead and an officer cannot clear them, only ask the member. D154 amendment says so; revisit if officers want an override.
- No analytics event for set or clear.

## Next

- Add an "own report" mark to the Members list and the roll call row.
- Retake the guide screenshots for Me (CLAUDE.md standing OK) and update the guest PDFs once this ships.
- Add a patch note in `lib/patch-notes.ts` before the next release.

What was missing from the task prompt? Whether the member's days should show on the roll call row as the member's own report, and whether officers may clear them.

PR: (added by the orchestrator)
