# feat/drilldown-public: drilldown batch B, public joined, left and kills

## Built

- Event alliance page (`/events/[id]/alliances/[unionId]`): the member list reads `show=joined|left` and `sort=<key>` from the URL (`filterFromUrl`, `app/_ui/member-views.ts`), lands on `#members` (a labelled section, `app/_ui/EventMembers.tsx`), and gains an All / + Joined (n) / − Left (n) chip group (`app/_ui/MemberShow.tsx`). While Joined or Left is on, a line gives both read times: "In the member list at Start (10:00), not at End (Nov 14, 14:00)." The chips keep `show=` and `sort=` in the URL with `history.replaceState`. A URL with `show` or `sort` is `noindex`.
- Links (P1, P2): the ledger row's `+n joined · −n left` (`StatTable` `RosterNote`, from `event-rows.ts` `roster`) and the split's "Came in with / Went with" lines (`SplitMark`, on the ledger and on the alliance page) open the alliance page with Joined or Left on.
- Links (P5, P6): War turnout rows (once the event has an End) and Kill share rows open the alliance page sorted by kills change, highest first (`?sort=killsDelta#members`).
- `killsTurnout` (`lib/compute.ts`) returns `gainerUids`, biggest gain first; `gainers` is its length. `killsGain` is the one gain rule (null as 0, D15), used by `killsTurnout` and by the list's ± Kills order. `lib/queries/turnout.ts` drops the uids (`countsOf`), so the shared event entry (D143) and the page carry counts only.
- Analytics: browser event `drilldown_opened` (`surface` ledger / split / war_turnout / kill_share, `kind` joined / left / kills, `count_bucket` 0 / 1 / 2_4 / 5_9 / 10_plus), sent by `app/_ui/DrilldownLink.tsx`; tracking plan section "Public drilldowns" and a Changed line.
- Copy: `members.joinedReads`, `members.leftReads`, translated in 17 languages (translate-copy skill, stamped).
- Decisions: dated amendments to D69 (split lines and ledger counts link), D83 (Kill share and War turnout rows link with the sort; uids stay in the query) and D15 (the ± Kills order counts a null as 0).
- Plan: `.specs/features/drilldown-public/plan.md`, with the persona verdicts.
- Review fixes (PR 690):
  - The list follows the address's `show=` (`useShowFromUrl`, `app/_ui/MemberShow.tsx`, through `useSearchParams`). Before, the split's links on the alliance page itself did nothing after the Joined chip was tapped back to All, because the list remounted only when the server's filter changed. The chips still use `replaceState`, so a chip tap reads nothing from the database.
  - `filterFromUrl` obeys `show=joined|left` only when that set has a member, so a hand-edited or stale link no longer opens an empty list with no chip to clear it.

## Decisions

- One rule per set, joined/left: kept the two sources (SQL `rosterChanges`, `rosterDiff` in the list) and added a PGlite test that they agree, with a rename, joiners and leavers (`app/_ui/member-drilldown.test.ts`).
- One rule per set, kills: the list's ± Kills order now ranks by `killsGain`, so War turnout's gainers are the list's first rows. The displayed change stays `—` for a null kills (D15).
- Filter gate: Joined / Left and a URL `show=` only when both sides are usable (`comparable`) and both rosters exist (REVIEW item 1, D32). The ledger shows its links only where it shows a delta, which needs the same.
- A War turnout row during the event (`soFar`) links to the plain page: there is no End to sort by.
- Chip counts come from the whole list, not the search or the might range (adversarial reviewer).
- Fix 1 used the address, not `router.replace`: `router.replace` would render the page on the server again (its database reads) on every chip tap.
- `countBucket` stays in `lib/analytics/events.ts`, with the same values as PR 688's `lib/analytics/count-bucket.ts` (`0 | 1 | 2_4 | 5_9 | 10_plus`). PR 688 was not on dev at this rebase; the orchestrator reconciles at merge, importing that module in place of this copy.

## Deviations

- P3 (Across events) is not linked. Its `+n joined · −n left` counts members since the previous event's reference roster, not Start to End of that event, so the event page's Joined / Left filter would show a different set, and a list of the since-previous set is the "leavers across events" view the reviewers ruled out.
- The persona check ran on the plan with a written 360×780 mock (invented data), not on screenshots of the built page.

## Verified

- `pnpm vitest related --run <changed files>`: pass after updating three tests whose behaviour changed on purpose (`WhoFought.test.ts`, `WhoCarried.test.ts` link targets; `compute.test.ts` `gainerUids`).
- `pnpm check`: green (prettier, eslint, tsc, vitest 1,7xx tests, drift, i18n 17 languages up to date).
- New tests each fail when their rule breaks (checked by mutation, then restored): the show filter ignored, the ± Kills order by the displayed change, `show=` obeyed against a stale side, `rosterDiff` matching by name.
- `pnpm test:e2e e2e/public.spec.ts` on this worktree's own cluster (127.0.0.1:55440, app 3577, bridge 55477): 10 passed, phone and wide. The new flow fails with the show filter broken (checked, then restored).
- After the review fixes (rebased on dev with the KvK opponent test): `pnpm test:e2e e2e/public.spec.ts` 14 passed, phone and wide. The new flow "the alliance page's split opens Joined again after the list went back to All" fails without `useShowFromUrl` (checked, then restored: "Expected true, Received false" on the Joined chip). The new unit test "ignores Joined or Left from the URL when nobody joined or left" covers fix 2.

## Open issues

- D15 edge: a member with a null kills at Start and a value at End is a War turnout gainer by their whole End kills, so the ± Kills order puts them first while their change reads `—`. This is War turnout's rule since #271; whether a null side should count as a gain at all is a follow-up decision (it would change War turnout and Kill share figures).
- The list's sort chips other than the URL's do not add a direction to the URL (`desc` is not kept); a shared link opens the key's default direction.

## Next

- Follow-up: an in-event `+n joined · −n left` on Across events rows (from `HistoryRow.inEvent`, which already diffs Start and End), which could then link to the event's filter exactly (P3).
- Follow-up: "Might at Start" label on Left rows (alliance leader persona); "Showing 1 of 11" wording for the filtered count (public visitor persona).
- Follow-up (review finding 3, issue to be opened by the orchestrator): a member with a null kills on one side shows `—` while the ± Kills order ranks them by the gain War turnout counts (a null at Start at the top, a null at End low). Proposal: show the gain the sort used on those rows (for example `+40K` with a D15 note "kills at Start unknown, counted as 0"), and add a test for a null at End. Then decide whether a null side should count as a gain at all (that would change War turnout and Kill share figures).
- Follow-up (review finding 2): a `WhoFought` test with `soFar: true` asserting the plain href (no `sort=killsDelta`).
- Follow-up (review finding 6): a test that a URL with `show` or `sort` gets `robots: { index: false }` from `generateMetadata`, and a plain one does not.
- Follow-up (review finding 7): `StatTable.tsx` has the `shared` doc comment of `MetricCell` stranded above `RosterNote`, and `SplitMark.tsx` has its JSDoc split from its function; move each back above its function.
- PR body: add the `Part of #N` line for the drilldown spike issue (review finding 5); no issue number is named in the task, so the orchestrator adds it.
- Owner, after release: check `drilldown_opened` arrives in PostHog project 741657 and add the "Drilldowns" insight from the tracking plan.

What was missing from the task prompt? That Across events' joined/left counts are since the previous event, not inside the event, so P3 cannot link to the same filter.

PR: https://github.com/daniro-san/LAPTracker/pull/690
