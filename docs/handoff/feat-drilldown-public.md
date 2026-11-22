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

## Decisions

- One rule per set, joined/left: kept the two sources (SQL `rosterChanges`, `rosterDiff` in the list) and added a PGlite test that they agree, with a rename, joiners and leavers (`app/_ui/member-drilldown.test.ts`).
- One rule per set, kills: the list's ± Kills order now ranks by `killsGain`, so War turnout's gainers are the list's first rows. The displayed change stays `—` for a null kills (D15).
- Filter gate: Joined / Left and a URL `show=` only when both sides are usable (`comparable`) and both rosters exist (REVIEW item 1, D32). The ledger shows its links only where it shows a delta, which needs the same.
- A War turnout row during the event (`soFar`) links to the plain page: there is no End to sort by.
- Chip counts come from the whole list, not the search or the might range (adversarial reviewer).

## Deviations

- P3 (Across events) is not linked. Its `+n joined · −n left` counts members since the previous event's reference roster, not Start to End of that event, so the event page's Joined / Left filter would show a different set, and a list of the since-previous set is the "leavers across events" view the reviewers ruled out.
- The persona check ran on the plan with a written 360×780 mock (invented data), not on screenshots of the built page.

## Verified

- `pnpm vitest related --run <changed files>`: pass after updating three tests whose behaviour changed on purpose (`WhoFought.test.ts`, `WhoCarried.test.ts` link targets; `compute.test.ts` `gainerUids`).
- `pnpm check`: green (prettier, eslint, tsc, vitest 1,7xx tests, drift, i18n 17 languages up to date).
- New tests each fail when their rule breaks (checked by mutation, then restored): the show filter ignored, the ± Kills order by the displayed change, `show=` obeyed against a stale side, `rosterDiff` matching by name.
- `pnpm test:e2e e2e/public.spec.ts` on this worktree's own cluster (127.0.0.1:55440, app 3577, bridge 55477): 10 passed, phone and wide. The new flow fails with the show filter broken (checked, then restored).

## Open issues

- D15 edge: a member with a null kills at Start and a value at End is a War turnout gainer by their whole End kills, so the ± Kills order puts them first while their change reads `—`. This is War turnout's rule since #271; whether a null side should count as a gain at all is a follow-up decision (it would change War turnout and Kill share figures).
- The list's sort chips other than the URL's do not add a direction to the URL (`desc` is not kept); a shared link opens the key's default direction.

## Next

- Follow-up: an in-event `+n joined · −n left` on Across events rows (from `HistoryRow.inEvent`, which already diffs Start and End), which could then link to the event's filter exactly (P3).
- Follow-up: "Might at Start" label on Left rows (alliance leader persona); "Showing 1 of 11" wording for the filtered count (public visitor persona).
- Follow-up: decide the D15 null-as-gain rule above.
- Owner, after release: check `drilldown_opened` arrives in PostHog project 741657 and add the "Drilldowns" insight from the tracking plan.

What was missing from the task prompt? That Across events' joined/left counts are since the previous event, not inside the event, so P3 cannot link to the same filter.

PR: (added by the orchestrator)
