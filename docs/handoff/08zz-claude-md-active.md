# 08zz — `active` in the CLAUDE.md roster rule

## Built
- `CLAUDE.md`: the hard rule on blocked roster fields now lists `active` with x, y, online, last_online_at, joined_at and daily_*.

## Decisions
- None new. The owner chose to block `active` in the #123 decision. PR #150 already added it to `BLOCKED_ROSTER_KEYS` (`lib/queries/blocked-keys.ts`). CLAUDE.md is the owner's to edit, so the #123 session left this line to the owner, who asked for it here.

## Deviations
- None.

## Verified
- `grep -n 'active' lib/queries/blocked-keys.ts` lists `"active"`, so the rule and the code now say the same.
- `pnpm check` (see the PR's CI and the run below).

## Open issues
- None.

## Next
Session: none planned by this change; the open v1.1 lanes resume after the first Saturday (2026-11-07).
Model / effort: keep — no code changed.
Owner must do first: merge this PR into `dev`. Merging spends one Vercel deployment against the daily limit (#152), so it can wait until after Saturday.
Plan changes needed: none.
