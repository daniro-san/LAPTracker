# feat-admin-patch-notes — owner-only patch notes at /admin/changes

## Built

- `lib/patch-notes.ts`: typed static data.
  - `patchNotes`, newest first: `{ version, date, title, changes, needsYou?, prs? }`. There are 15 entries, v5.35.0 down to v5.21.0.
  - `ownerTodo`: `{ text, issue?, done? }`. It has 14 open items and 3 done ones.
  - `REPO_URL`.
- `/admin/changes` (`app/(pages)/admin/changes/page.tsx`) sits behind the same gate as the other /admin pages: `isAdmin()` first, and when locked it renders the PIN card only. The page itself reads no database and makes no fetch. `AdminShell` still runs its usual status reads for the nav's candle, as on every /admin page.
  - **Your to-do** is an `AdminSection` with an "n open" chip. The open steps come first as a numbered list. The done steps follow under "Done", muted and with the stitched check.
  - **Releases**: one `<details>` per release. The newest is open and the others are closed. The summary is the version, the date (`clock.weekday`, for example "Sat, Nov 21"), a seal "Needs you" chip and the title. The summary is a 44 px tap target, and nothing is hover-only.
  - Each body has the changes, a "Needs you" block and the PR links. PR links go to `/pull/N`. A `#N` inside any text goes to `/issues/N`, which GitHub forwards to the PR when N is a PR.
- The nav has a new "Patch notes" link (`prefetch={false}`, like the others).
- Copy: `lib/copy-admin-changes.ts`, merged into `copy.admin.changes` in `lib/copy-admin-tracked.ts`. English only (D48).
- `lib/patch-notes.test.ts`: versions come newest first and dates never go forward; each version is unique and has the shape vX.Y.Z; each date is a real calendar date written YYYY-MM-DD.
- CONTRIBUTING.md, "How to cut a release", has a new step 1: "Before running release-prepare, add the release's entry to lib/patch-notes.ts (shown on /admin/changes), and update its `ownerTodo` list."

## Decisions

- A release's date is the UTC day its GitHub Release was published. So v5.23.0, published 23:23 UTC on 2026-11-20, reads 2026-11-20.
- The nav label reuses `copy.admin.changes.title`. Adding a `nav.changes` key would have pushed `lib/copy-admin.ts` over the 300-line lint limit.
- #521's closure is a bullet in v5.28.0, the last perf batch before the issue was closed (08:02 UTC on 2026-11-21).
- The to-do items come from issue #527's unticked boxes, the v5.35.0 check, the #484 key scope and the #484 handoff's open question.
  - These are marked done: the Neon pooler and the PostHog query key (both from the brief), and the 0.5 CU compute cap with the move to iad1 (from PR #528).
  - These are dropped: the cron-job.org watcher item, because there was never a separate job (#527 comment), and the "heartbeat every 6 h, OK?" question, which the 3 h heartbeat in v5.24.0 replaced.
- The other alliance named in #527 is written as "the new alliance". The only alliance tag on the page is OGs.

## Deviations

- The owner-persona panel ran as one subagent, and its result came back to me. I applied its one MUST: the v5.31 decision about exact action counts was missing from the to-do, and it is now there. I also applied these SHOULDs:
  - an exact date, "Friday 2026-11-27", instead of "the next Friday";
  - CLAUDE.md is no longer named in v5.32;
  - the v5.31 key line now says "Check that…" instead of "You created…", so it no longer contradicts the done item;
  - "tick" is replaced with "the scheduler's 15-minute check";
  - "For the OGs alliance" instead of the bare "OGs".
- These panel findings are not applied:
  - collapse the to-do list to 3 items;
  - split the to-do list into "before Friday" and "when you can";
  - drop the umbrella #527 links;
  - drop the pool and transaction numbers in v5.26 (the brief asked for them);
  - hide a release's "Needs you" chip once its to-do is done.

## Verified

- `pnpm check` passes: 1,473 tests passed, 4 skipped. The tokens test rejected a `#` plus digits inside a page comment as a colour literal, so I reworded the comment.
- Privacy grep: the diff has none of the 328 member and leader names in the fixture rosters.
- Local production build (`next build`), started against a local Postgres with 63 migrations and dummy secrets. The upstream base URL pointed at a dead port.
  - Locked, `/admin/changes` returns 200 with the PIN card and no release text.
  - Unlocked, there are 15 `<details>` and 1 is open. A tap on the second opens it.
  - The nav reads Overview · Runs · App errors · Patch notes.
  - At 360 and 1280, light and dark, the page never scrolls sideways.
  - Every summary and every standalone link is at least 44 px. Only the `#N` links inside running text are 22 px tall: they are inline links in a sentence.
- Screenshots: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/patchnotes/shots/`.
- No secrets, webhook URLs, member data or player names. Only environment variable names appear in the text.

## Open issues

- `app/(pages)/admin/gate.test.ts` lists each /admin page in its locked-gate table. `/admin/changes` is not in it, because the task asked only for the data test. Adding it would be one row.
- `ownerTodo` is edited by hand. Ticking a box in #527 does not update the page.
- v5.35.0 was written before its GitHub Release existed, from the coordinator's facts about PR #555.

## Next

- Model/effort: keep. This was data entry plus one static page.
- Owner first: read /admin/changes after the merge and tick or remove the to-do items as you do them. Each release now adds an entry before Prepare release.
- Plan change: none.

<adjustments>
- Every release from now on adds its entry on top of `patchNotes` in lib/patch-notes.ts, and updates `ownerTodo`, before Prepare release (CONTRIBUTING.md step 1). The test fails on a wrong order, a repeated version or a bad date.
</adjustments>

PR: https://github.com/daniro-san/LAPTracker/pull/559
