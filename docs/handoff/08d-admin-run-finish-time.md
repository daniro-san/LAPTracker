# 08d — Admin run pages: finish time

## Built
- `/admin/runs` and `/admin/runs/[id]` read "started <time> · finished <time> · N calls …". Words: `runs.started` and `runs.finished` in `lib/copy-admin.ts`.
- `finishedAt` added to the two selects in `lib/queries/admin.ts`.
- This is commit 3acee71 from PR #43's branch, cherry-picked onto `origin/dev` (which has #43's squash commit 048843c). Nothing else from #43 is repeated.

## Decisions
- When `finished_at` is null (a run still running or crashed), only "started" shows, next to the existing running/failed state word. No fallback logic.
- The times stay in the existing inline line, which wraps at 360 px.

## Deviations
- The cherry-pick also edited `docs/handoff/08c-admin-run-copy.md`; I restored that file to its `dev` version and documented the change here instead.

## Verified
- `pnpm check`: passes.
- Not checked in a browser. PR #42 limits Vercel deployments to `dev` and `main`, so this branch has no preview URL; I did not work around that.
- Upstream API calls: 0.

## Open issues
- None new. The "Run now" single-button idea from 08c is still unbuilt.

## Next
Session: 9 — Dry run against production
Model / effort: keep — this change does not touch collection.
Owner must do first: merge this PR into `dev`; check the run pages on `dev` after it deploys.
Plan changes needed: none.

<adjustments>
- None.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/44
