# 08zzzc — compare cards: every figure under its head from 640 px

Issue 233.

## Built
- `app/_ui/EventCompare.tsx`, `CompareCard`: from 640 px the name cell spans three rows (`sm:row-span-3`) instead of two, so the difference line starts in the head column. Below 640 px the class list is unchanged.
- `docs/screenshots/08zzzc-*`: alliance, member and player card at 1280 px before and after, plus the player card at 360 px after (7 files, 180 KB).

## Decisions
- The row span follows `lines.length` (3 gives `sm:row-span-3`, otherwise `sm:row-span-2`). All three callers pass three lines, so the second branch keeps the old behavior for a card without a difference line. Both class strings are written out in full so Tailwind sees them.
- The change is in the shared `CompareCard`, so `MemberCompare.tsx` and `PlayerCompare.tsx` are not touched (open PR 229 edits `PlayerCompare.tsx`).

## Deviations
- None.

## Verified
Local Postgres (ports 54152 / 54252), seed with `--with-states`, `pnpm dev:local -p 3152`, Chrome through playwright-core. Page: `/events/compare?a=2&b=3` with no filter (alliance card, first `li`), `&alliance=67109944` (member card, second `li`, after the alliance's own card), `&player=340024664389` (player). x ranges in px, `left-right`:

1280 px, before (difference line):
- alliance: label 196-450, Might 462-573 (head Might is 585-743), Kills 585-743, Members 755-914 (head Members is 926-1084); nothing sits under the Members head.
- member (first member card on the `&alliance=` page, 2 figures): label 196-513, Might diff 525-664 (head Might is 676-874), Kills diff 676-874 (head Kills is 886-1084).
- player: label 196-513, Might diff 525-664 (head Might is 676-874), Kills diff 676-874 (head Kills is 886-1084).

1280 px, after (difference line):
- alliance: label 462-573, Might 585-743, Kills 755-914, Members 926-1084. Heads: Might 585-743, Kills 755-914, Members 926-1084.
- member: label 525-664, Might 676-874, Kills 886-1084. Heads: Might 676-874, Kills 886-1084.
- player: label 525-664, Might 676-874, Kills 886-1084. Heads: Might 676-874, Kills 886-1084.

360 px: the x ranges of every cell of all three cards are identical before and after (for example the player difference row, 73-196 and 208-331).

`pnpm check`: typecheck, lint, tests (253 passed, 1 skipped), drizzle drift check and `i18n: 17 languages up to date with English` all pass.

The local cluster, bridge and dev server were stopped; `.pglocal/` and the worktree `.env.local` (placeholders only) were removed. No upstream call was made.

## Open issues
- At 1280 px the head column (0.7fr, 111 px in the alliance card) holds the difference label "Oct 31 vs Oct 24" on one line. A longer translated label could wrap there. Not checked in other languages.
- The `pkill -f "next dev"` I ran to stop my server matches any `next dev` process on the machine; other sessions' dev servers may have been stopped too.

## Next
Session: none queued.
Model / effort: no signal; one class change in one component.
Owner must do first: nothing.
Plan changes needed: none.

<adjustments>
- `CompareCard` row span follows `lines.length`; a new card with a different number of lines gets `sm:row-span-2` unless it has three.
</adjustments>

