# 11al — Home's recent activity: pages, Show less, runs (issue 410)

## Built
- **Pages with a cursor.** Home renders the first 6 lines on the server (`activityPage(…, null, ACTIVITY_FIRST)`). "Show more" is a button that reads the next 20 (`ACTIVITY_PAGE`) from the new `GET /api/w/[slug]/activity?before=<ms>`, an officer-only route: `requireWorkspace`, 401 `signed_out` without a session, 400 for a bad cursor, no-store, lines made in the officer's language. Paging goes on to the end of the 14-day window; the old 40-line cap is gone.
- **Show less.** It goes back to the first page and its cursor, and moves the focus to "Show more" (with `flushSync`), so the page stays where the officer was. Both buttons are 44 px and sit side by side under the list. The list state is a small module, `app/(private)/_ui/activity-list.ts`.
- **Runs.** One officer's consecutive lines of the same kind on the same server day are one line at the newest time. The kinds that group: calendar entries added ("Rook added 6 entries to the Calendar"), calendar entries changed, notice saves, saved screenshots (these four count the different things in the run), plus member saves, thefts and new members (as before). A run is a `<details>` that opens its lines in place, each with its time, and works without script.
- **Repo.** Every source and union part (`desk-activity.ts`, `-reviews`, `-thanks`, `-trash`) takes a `before` bound (`'infinity'` for the first page). Roll call hourly lines use `having max(written_at) < before`, so each one is wholly before or after the cursor. `memberNames` moved to `lib/repo/desk-activity-names.ts` to keep the repo file under 300 lines.
- **Strings** in EN, PT-BR and FR: `activity.less`, `activity.moreFailed`, `activity.run.{entry,entryEdit,noticeSaved,draft}`.
- **D108** has a dated amendment (2026-11-18, 11al). There is no new decision.

## Decisions
- **Run window: the same server day (`SERVER_TZ`), and consecutive lines only.** Any line in between, another officer's included, ends the run. This applies to the old groups too, so a member-save run now also ends at the server day's end.
- **What never groups:** posts, deletes, restores (D118), roll calls, follow-ups, reviews, the thanks, and notice pictures (D119). D108 says a post, a roll call or a break must never be folded away. Grouping every kind would have needed a plural sentence for each one.
- **The cursor has no gaps and no duplicates.** Each source reads 40 rows. Below the oldest row of a source that returned 40, the page keeps nothing (the "horizon"). The cursor is the oldest action the page's last line stands for, its repeats and its run included, and a page is extended so it never ends inside one instant. When the read was short and ran out, the last run is held back for the next page, so it comes back whole.
- **First page 6, later pages 20.** The 6 keeps the persona panel's choice; 20 is the brief's page size.

## Deviations
- "Show more" needs script now (it was a `<details>`). Runs still open without script.
- D119 (notice pictures, branch `session/11ak-notice-picture`) is not on `dev` yet, so its line could not be tested here. See Open issues for the one change it needs at merge.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest **1064 passed, 4 skipped (204 files)**, drift, i18n.
- New tests: `lib/private/desk-activity-pages.test.ts` (runs: 6 adds become one line, another officer ends the run, a new server day ends the run, PT wording; cursor: 45 follow-ups paged by 20, every action once, a shared instant at the 20-line edge never split, more than 2 pages); `app/(private)/_ui/activity-list.test.ts` (Show less goes back to the first page and its cursor). `member-session.test.ts` has a fixture for the new route.
- **Local e2e: 28 of 28 checks pass.** Production build on :3997, local Postgres on :55337 with 42 migrations, the DB bridge, a Discord sign-in stand-in, an invented 20-member roster, 44 seeded feed lines. No upstream, Groq or Discord call. Checks:
  - 6 lines on Home; the first reads "Wren added 6 entries to the Calendar"; its summary is 64 px; it opens in place to the 6 named entries;
  - the D118 delete line and the "Wren updated 4 members" run show;
  - "Show more" is 44 px; 2 clicks load all 44 lines, every request 200, no line twice, newest first;
  - "Show less" returns to 6 lines, the focus is on "Show more", which is in view; "Show more" again reads the same 26;
  - no session gets 401 `signed_out`; `before=abc` gets 400;
  - no sideways scroll at 360 and 1280, light and dark, EN and PT.
- **Screenshots** (not committed) in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11al-shots/`: `feed-{360,1280}-{light,dark}-{en,pt}.png` (run open, after one Show more) and `360-light-en-all-pages.png`. Reviewed: PT run lines fit at 360; the ▾ turns when a run is open; both buttons read clearly in dark mode.

## Open issues
- **D119 merge:** `lib/repo/desk-activity-pictures.ts` `parts(ws, since, n)` must become `parts(ws, since, before, n)` with `and g.added_at < ${before}`, called as `picture.parts(ws, since, before, n)`. Without the bound, picture lines would repeat on every page. The picture kind does not group, so nothing else changes.
- Follow-up, not fixed: at 360 px the bottom tab bar cuts the fifth tab's label ("Acompanh…" in PT). It is not part of this change.

## Next
- Model/effort: keep. One feature touching a repo read, a route, a client list and an e2e fits one sitting.
- What the owner must do first: review and merge, then merge D119 with the one-line `before` change above. No setting or migration.
- Plan change: none (the workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`).

<adjustments>
- A new source of Home's activity must take the page's `before` bound in its SQL (`x.at < ${before}`, `'infinity'` on the first page), or its lines repeat on every page.
- A kind joins runs only by being added to `GROUPED` in `lib/private/desk-activity.ts`. A counted kind also needs `COUNTED_RUNS` and an `activity.run.<kind>` string in three languages.
- Tests read the feed through `recentActivity` / `linesOf` in `desk-activity.test-helpers.ts`, which now return run lines (`ActivityLine`: `item`, `run`, `n`).
</adjustments>

PR: (added by the orchestrator)
