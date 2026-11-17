# 08zzzzt — /admin Members tab removed

## Built
- `app/(pages)/admin/members/page.tsx` and `lib/copy-members.ts` deleted; the Members entry is out of the admin menu (`app/_ui/admin/AdminShell.tsx`, `copy.admin.nav`).
- The Friday quota message keeps its might counts line without the link to `/admin/members` (`lib/copy-discord.ts`, `lib/notify-quota.ts`, `lib/run.ts`); `quotaReport` no longer takes the request origin (`app/api/quota/check/route.ts`, `lib/tick.ts`).
- Tests: the `/admin/members` cases removed from `app/(pages)/admin/gate.test.ts`; `lib/quota-report.test.ts` expects the line without the link.
- D70 and D76 amendments; README's admin table and Friday message line.

## Decisions
- The owner (2026-11-17): the might lists are read in each alliance workspace's Members tab, so the admin tab only added to the menu.
- `mightUnchanged` stays: the workspace and the Friday message use it.

## Deviations
- None.

## Verified
- `pnpm check`: Test Files 159 passed | 2 skipped, Tests 842 passed | 4 skipped; i18n 17 languages up to date.
- `grep -rn "admin/members" app lib`: only `lib/analytics/sanitise.test.ts`, which uses the path as a sample `/admin` URL for the area check.

## Open issues
- The Friday message has no link now; the workspace is per alliance and `lib/run` may not import `lib/private` (docs/ARCHITECTURE.md), so a link to the own alliance's workspace would need a slug lookup in `lib/queries`.

## Next
- None queued.
