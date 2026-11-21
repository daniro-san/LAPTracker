# feat — a member's own week on their page (follow-up to issue 487, D142)

## Built

- **The "This week" card is back** on `/w/[slug]/board/me`, restored from commit `c885b7d7` (the first #487 build). It sits in the main column after "Your progress".
  - It shows the member's own daily quest points (`active`), Alliance Help coins (`daily_honor`) and donations (`daily_tech`), Monday to Sunday in server days, as the member card's day bars (D136).
  - Each row has "This week: Average N · n days" ("This week: no average yet" when no day has a number yet) and, under it, "Last week: Average N · n days" or "Last week: no average". Both are plain text, with no delta, arrow or colour.
  - It opens with "Thanks for every day you play with the alliance." and the lead "Monday to Sunday, server days, with your own last week under each row."
  - A visible legend under the bars reads "No reading that day: it never counts." (next to the no-data mark) and "“none”: the day’s read listed you with nothing sent."
  - On this page the coins label is "Alliance Help coins (game cap 1,000)". The officer card keeps its own wording.
  - Copy is in EN, PT-BR and FR (`lib/private/dictionary.me.ts`). `me.open` and `me.lead` mention the week again.
- **The read** (`lib/repo/me.ts` `ownDays`): reads `active`, `daily_honor` and `daily_tech` by name from raw_json, only for the member's own uid, only on rows of the last two game weeks. It takes the first array element when a uid appears twice (`with ordinality … order by n`).
- **The door is unchanged.** The values come only through `meView(db, MeAccess)`: `requireBoard`, then an officer-approved link, then that link's uid.
- **Session replay:** the bars are inside `ph-no-capture`, which is posthog-js's default block class, so a replay records the bars as an empty box and no bar height reaches PostHog.
- **Docs:** CLAUDE.md's roster-fields rule has one added sentence, and nothing else in CLAUDE.md changed. D71 has a dated amendment (owner, 2026-11-21). D142's open item is now resolved, and D142 has a dated amendment.

## Decisions

- **Owner, 2026-11-21, in chat:** a member may see their own `daily_tech`, `daily_honor` and `active` on their own Me page. The sentence added to CLAUDE.md: "A member may also see their own daily_tech, daily_honor and active on their own page under app/(private)/w/[slug], behind requireBoard and an officer-approved player link, for their own uid only (docs/decisions/D142, owner 2026-11-21)."
- **The member's own last week stays.** The issue asked for it. The member, R4 and product personas accepted it as text only, with no delta, arrow or colour. "Never compare" is read as: no rank, no alliance average and no below or above wording.
- **The read stays on raw_json, for at most 14 rows of one member.** Earlier handoffs suggested copying these fields into arrays at write time. That needs a migration and a change to the write path, and the task did not ask for it.

## Deviations

- **The legend draws the no-data mark** (the dotted circle) instead of the "○" character in the persona copy. It is the same mark the bars use. The mark is hidden from screen readers so they don't hear "No reading" twice.
- **`member-days.ts`** has the optional `DaysRow.last` again. **`MemberLastDays.tsx`** puts this week and last week on separate lines when `last` is set (QA's NICE). The officer card has no `last`, so it is unchanged.

## Verified

- **`pnpm check` passes**, before and after the panel's fixes: 283 test files passed (2 skipped), 1,463 tests passed (4 skipped).
- **Tests:**
  - `app/(private)/api/w/[slug]/me/route.test.ts`:
    - the earlier "no daily key" assertion is flipped;
    - a new case covers a pending link (nothing), an approved link (its own values day by day, "—" for days with no read), a member linked to another player (only that player's values) and a removed link (nothing);
    - the fixture's raw_json now holds invented markers for `x`, `y`, `online`, `last_online_at`, `joined_at` and `avatar_url`, and the test asserts none of them reaches the view.
  - `lib/private/me-parts.test.ts`: the week card case is back, plus "no average yet" and "no average".
- **Mutation check:** dropping the uid filter on the raw_json read fails the new route test.
- **Privacy review** (adversarial subagent): no MUST.
  - Applied: its SHOULD (session replay kept bar heights through `style`) and its NICE (stable pick on a duplicate uid).
  - Recorded in D142: an officer's own link is approved at once, so an officer can see the week of the player they link to. That stays within D71.
- **Member, R4 and product personas:** warm and never punitive in all three languages. Applied: both MUSTs (`lastNone` wording, a visible legend), the three SHOULDs (lead, `thisNone`, the "none" legend line) and both NICEs (the thanks line, the coins cap label).
- **QA** (local production build of `3e84baae`, local Postgres 18, invented roster with blocked-field markers in raw_json): all 6 cases pass. These were:
  - an approved member's values match the seed;
  - a pending member gets no card and none of their values in the HTML or RSC;
  - two approved members never see each other's data;
  - a removed link shows the picker with no data;
  - no marker or blocked field appears anywhere, and every response is `private, no-store`;
  - no sideways scroll and every target ≥ 44 px at 360 and 1280, light and dark, EN, PT and FR.
- **After the panel's fixes**, a fresh production build on the same data, at 360 px in EN light and dark and PT-BR light and dark:
  - the thanks line, the legend and the coins label render;
  - this week and last week are on separate lines;
  - no sideways scroll and no target under 44 px;
  - the only elements past the card's edge are `sr-only` spans.
  - `thisNone` and the new `lastNone` are checked by the unit test, not on screen: the seed has numbers every week.
  - Screenshots: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/qa-me-week/shots/`.

## Open issues

- **Session replay on the officer member card** keeps bar heights through `style`, the same leak fixed here for the member's page. This was already there before this change. Fix: add `ph-no-capture` to `MemberLastDays` in the officer card, or block those bars in `lib/analytics/posthog.ts`.
- **`cellOf` (D127):** a field missing on a manual early-day read becomes "none" too soon. It should stay "no reading" until the end-of-day read.
- **Tests not added (privacy NICE):** a member who left, and an officer's preview, showing no `week`. Both are covered by the code path (`left` returns early, and an officer gets the same `MeAccess`).

## Next

- Model/effort: keep.
- Owner first: nothing.
- Plan change: none.

<adjustments>
- The member's own daily fields are allowed on `/w/[slug]/board/me` only (CLAUDE.md, D71 and D142 amendments, 2026-11-21). Any new member-facing read of them must take `MeAccess`, and must keep the bars inside `ph-no-capture`.
</adjustments>

PR: (added by the orchestrator)
