# feat: desk member card shows last seen and joined, and Follow-up gets a not-seen reason (#821)

## Built

- `lib/private/members.ts`: new `Reason` kind `seen` (with the `last_online_at` date). A member whose `last_online_at` is 3 days or more before the newest end-of-day read gets it, unless on a break. No `last_online_at` gives no reason.
- `lib/private/member-card.ts`, `app/(private)/_ui/MemberCards.tsx`: `card.presence`, two header lines "Last seen in game: <date>" and "In the alliance since: <date>", each "no data" when the roster sent none.
- `lib/private/members-sheet.ts`, `app/(private)/_ui/follow-up-groups.ts`: the reason's text on the Members tab and in Follow-up ("Worth a hello: not seen in game since <date>").
- `lib/private/ready-message.ts`: the `seen` reason uses the existing quiet-line message, so no new message words.
- Copy in EN, PT-BR and FR: `dictionary.card.ts`, `dictionary.followup.ts`, `dictionary.ts`, `dictionary.pt-BR.ts`, `dictionary.fr.ts`.
- `docs/decisions/D163-...md`: dated amendment. The Details tab's "Joined" and "Last online" rows are removed (`Shown` keeps only `duel`; `sheet.lastOnline` is gone from the three dictionaries).
- Tests: `lib/private/members.test.ts` (3 days listed with date, 2 days not listed, no reading never listed, another alliance's reading never used), `lib/private/member-card.test.ts` (lines shown, "no data").

## Decisions

- Source is the newest daily roster's `last_online_at` only, not `player_reads.last_seen_at` (that column is not in dev; it arrives with PR 819). One source is simpler to document.
- "3 days" is measured from the newest end-of-day read's time to `last_online_at` (72 hours or more), so it does not depend on the time zone.
- The reason lives in the shared `reasons` list, so the Members tab's "Check in" status and the card's status lines also show it, not only Follow-up.
- The reason text does not end with the date, so the PT/FR sentence-date guard in `dictionary.test.ts` does not apply.
- Amendment is in D163 (PR 819 merged; rebased onto dev). D71 is untouched.

## Deviations

- `lib/workspace-data.test-helpers.ts`: the seeded roster's `last_online_at` moved from 1763337600 (2025) to 1795000000 (about the seed time). The old value made the seeded member a "not seen" case and changed `cross-workspace-reads.test.ts`.

## Verified

- `pnpm vitest related --run` on the changed files: passed (106 files, 622 tests after the rebase).
- `pnpm check`: passed (prettier, eslint, tsc, vitest, drift, i18n).

## Open issues

- None.

## Next

- None.

What was missing from the task prompt? The threshold clock (newest read vs now) and whether the reason also shows on the Members tab.

PR: (added by the orchestrator)
