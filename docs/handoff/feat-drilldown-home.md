# feat/drilldown-home: drilldown batch C, Home and the status bar

Part of issue 678. Plan: `.specs/features/drilldown-home/plan.md` (size M).

## Built

- **D8, Home's Recent activity.** A line "Rook added 3 new members" now opens the three names in name order (the officer's language's collation, numbers in order, punctuation ignored), two columns at 360 px, each a 44 px row that wraps. It used to open one sentence per add. The count and the list are one array: `item.names` becomes the view's `names` (`activityView`, `lib/private/desk-activity-words.ts`). The names are plain text. They are typed by officers (`pending_members`), and the feed's read has no uid for them. "updated n members" stays a count.
- **D9, the status bar's shield line.** It counts Raid prep's set: the roster's members with those away on the raid's Saturday left out. The function the two share is `membersOfRaid` (`lib/shield-post.ts`), which the Discord summary and the officers' notification already use. Raid prep's grid leaves out the same members by the same rule (`awayOn` on the roll call's day, which is the raid's Saturday for the week's Raid prep). It reads "Raid Shield check 23:42 ST · 61 of 89 seen with a shield · 3 away" and "Checking Raid Shields · 40 of 89 · started 23:31 ST · 3 away". A bordered 44 px "Raid prep ›" chip sits beside the bar, open or closed, while that line shows. It links the week's Raid prep through `raidPrepUrl` (`lib/push-uses.ts`, now exported), the notification's own link.
- **D7, Home's Follow-up card.** Two stacked 44 px links: "12 members to look at this week ›" goes to Follow-up, and "4 already noted by officers ›" goes to `/follow-up#follow-up-noted`. `followUpWords` now returns `{ head, noted }`.
- **Analytics.** `ws_drilldown_opened` gains `surface: home` (`kind` `new_members`, `noted`) and `surface: status_bar` (`kind` `shield`). Types: `HomeSet` and the two union arms in `lib/analytics/events.ts`. The tracking plan has the updated row and a dated Changed line.
- **Copy** in EN, PT-BR and FR: `status.shield.away.one/other`, `status.shield.link`.
- **Docs.** Dated amendments to D104, D108, D135 and D137.

## Decisions

- **The status bar's set is `membersOfRaid`, not the grid's own read.** The status bar does not open a roll call. `membersOfRaid` is the existing shared rule (roster from `anyRoster`, the same roster `rosterOf` reads, and away on the raid's Saturday). The PGlite test checks it against Raid prep's grid on the same data.
- **"· n away" as well as the new denominator.** The task allowed either. The persona check said the away count explains 92 vs 89, so both are built.
- **A `status_bar` surface.** The task named a `home` surface. The status bar is on every desk page, so its tap gets its own surface instead of being counted as Home.
- **Persona check** (two officers and an adversarial reviewer, invented data, 360 px): D8 adopted with names that wrap in full. D9: the link was moved out of the open bar and into a visible chip beside it. D7: the one-line split became two stacked rows. The details are in the plan's Validation section.

## Deviations

- The plan's first draft put the Raid prep link inside the open bar. The persona check moved it beside the bar, and the criteria were updated to match.
- The e2e for the Home drilldowns is in `e2e/desk-drilldown.spec.ts`, not in `desk.spec.ts`'s Home test. `desk.spec.ts` would have passed its 300-line limit. `desk.spec.ts`'s Home test only gets the new link name ("n members to look at this week", without the noted part).
- The e2e seed gains three members added by hand (`ADDED_BY_HAND`, `e2e/fixtures/seed-people.ts`). Each is matched to its roster member, so Members and Follow-up show no extra card.

## Verified

- `pnpm vitest related --run <changed files>`: 197 files, 1083 tests passed.
- `pnpm check`: passed (prettier, eslint, tsc, 1875 tests, drift, i18n). The first run failed on formatting, import order and two max-lines limits; fixed in one round.
- `pnpm test:e2e` on my own cluster (port 54460, app 3497, bridge 54397): 68 passed, 4 skipped (phone and wide).
- Each new test was broken once on purpose and failed:
  - the shield test with the away filter removed;
  - the activity test with the name sort removed;
  - the Home render test with the fragment removed;
  - the e2e with an unsorted expectation.

## Open issues

- The status bar's read now adds `anyRoster` (3 small queries), the away facts and the Raid prep lookup (2 queries). This happens only while the shield line exists, Friday night to Saturday 12:00 ST, and on each 30 s poll while a read runs.
- The grid's away day is the roll call's own day. `membersOfRaid` uses the raid's Saturday. They differ only for a Raid prep roll call added on another day of the week.
- Raid prep's own answer ("86 of 97 seen at the morning check · 3 not read yet") and the Discord read lines still count away members, so they can differ from the status bar by the away count. This is unchanged, and D137 records it.
- The e2e assertion for the noted link runs only when the race leaves a noted member, which happens 0 or 1 times per run (the same race `desk.spec.ts` documents).

## Next

- Follow-up: link a new member's name to their card (`?m=<matched_uid>` or the pending card `-id`). It needs the uid in the feed's `pending_members` read.
- Follow-up for the owner: should Raid prep's answer and the Discord read lines also leave away members out, like the status bar now does (PR 691's D3 question)?
- D6 (Alliance Help names) still waits for the owner.
- The new-alliance guide needs no new screenshots: no onboarding or settings flow changed.

What was missing from the task prompt? Whether the status bar's tap counts as `home` or needs its own surface, and that new members in the feed have no uid, so they cannot link to a card without a new read.

PR: (added by the orchestrator)
