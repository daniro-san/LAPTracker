# 08zzq — In-event change in the alliance "Across events" (#191, option C of #177)

## Built
- `lib/queries/alliances.ts`: `HistoryRow.inEvent` = `{ fromAt, fromPower, fromKills, power, kills, members, left }` for the event's before → after. It is null unless both rows exist, are fresh and did not fail: `compute.delta` over the two rows, with a failed row counted as not fresh (INVARIANT freshness.no-stale-delta). The rows come from the select `allianceHistory` already ran. `inEventPairs` picks each event's before and after rows. `inEventOf` builds the field. `left` comes from `rosterDiff` on the two rosters. The before rows' ids go into the existing `membersOf` call, so the query count is unchanged.
- `app/_ui/AcrossEvents.tsx`: each of Might, Kills and Members gets a second change line, `since 10:00` (`copy.ledger.since`, the before row's read time in the page clock), through `StatMetric.vs`. Might and Kills carry the D33 `*` when they fell during the event while members left. Members never carries it. An event without `inEvent` shows no second line, as on the player page. The change since the previous event is unchanged. `inEventMarked(history)` is exported for the legend.
- `app/_ui/StatTable.tsx`: `StatMetric.vs` takes an optional `memberMark`, passed to `Delta`.
- `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`: the legend lists `* Includes member changes` when the summary or Across events shows a `*` (`showsMemberMark`).
- `lib/queries/alliances.test.ts`: one PGlite test. A fresh event gives the change with one leaver, and an event whose before is stale gives null. `app/_ui/AcrossEvents.test.ts`: its fixture gains `inEvent: null`.
- 6 screenshots: `docs/screenshots/08zzq-across-in-event-{360,1280}-{light,dark}.png`, `-360-light-de.png` and `-360-light-ru.png`. Each one is the Across events section of URSA on Oct 31.

## Decisions
- `inEvent` has two fields the issue did not list. `fromAt` holds the before row's read time, because the line's head is `since <before time>` and `PlayerAcrossEvents` uses the same source (`before.updatedAt`). `left` is needed because D33's `*` means "fell while members left", and that is counted from the two rosters (D33 "Alliance page leavers"). Taking `members < 0` instead would miss a roster where joins and leaves cancel out.
- The `since` line has no Details counterpart. Details still shows the ranks from the previous event to this one. The issue did not ask for in-event figures in Details.
- No new copy keys, so the translate-copy skill did not run.

## Deviations
- The two code comments say "issue 191", not "#191", because `lib/brand/tokens.test.ts` reads `#191` as a hex colour (08zzo hit the same thing). The test's `describe` title still says `#191`, because test files are outside that scan.
- No DESIGN.md edit. Spike 08zzk's row C mentions a `history-row` note. The session prompt did not ask for one, so it is a follow-up (see Open issues).

## Verified
- `pnpm check` exit 0: prettier, eslint, tsc, vitest (50 files: 228 passed, 1 skipped), drift gate, `i18n: 17 languages up to date with English`.
- The first version of the new test opened PGlite inside `it`, and it hit the 10 s test timeout once in 5 full runs. Opening it in `beforeAll` (hookTimeout 140 s), as `compare.test.ts` does, made it pass 5 of 5 full runs.
- `next dev -p 3474` against the Neon preview branch through the main checkout's `.env.local`, read-only, with `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL` pointed at `127.0.0.1:9` so no upstream call was possible. `/events/3/alliances/67110320`, `/events/2/alliances/67110320` and `/events/3/alliances/67111155` returned 200.
- Seed (URSA): on Oct 31, `since 10:00` reads Might ▼ −71.3M (−1.9%) `*`, Kills ▼ −1.03M (−3.4%) `*` and Members ▼ −2 (−2.1%). The legend shows `* Includes member changes`. Oct 24 reads +78.6M, +962K and 0. These match the compare page's Oct 31 figures for URSA in 08zzo (−71.3M `*`, −1.03M `*`, −2). Nine `since` lines, three per event.
- Measured with Playwright: every `since` line is one line (height ÷ line-height = 1) at 360 px in en, de (`seit 10:00 ▼ −71,3 Mio. (−1,9 %) *`) and ru (`с 10:00 ▼ −71,3 млн (−1,9 %) *`), and at 1280 px. `scrollWidth` equals the viewport width in all 6 captures.

## Open issues
- Below 640 px, the change since the previous event has no head while the in-event line does (`▲ +5.89M` above `since 10:00 ▼ −71.3M`), so the first line reads as "since the previous event" only by position. `PlayerAcrossEvents` gives both lines a head (`since Oct 24`). The prompt said to keep the first line as it is. Adding a head there is a design call for the owner.
- DESIGN.md `history-row` / `member-mark` do not yet say that the alliance's Across events carries the in-event line and the `*`. One sentence each, as a follow-up.
- In the screenshots, the Next dev "N" badge sits over the 360 px cards. It comes from `next dev`, not from this change.

## Next
Session: #199 — the player view of the compare page (`/events/compare?a=&b=&player=<uid>`).
Model / effort: keep (opus · high). #199 is the size of 08zzo's members view plus one link and its copy; nothing here changes that.
Owner must do first: merge this PR into `dev`, then close #191 by hand (PRs into `dev` do not auto-close issues). #199 lists no blocker in GitHub's field, but its body says it waits on #191.
Plan changes needed: none. #199's prompt is in the issue, not docs/SESSION_PLAYBOOK.md.

<adjustments for="#199">
- This PR does not touch `lib/queries/compare.ts`, `app/_ui/EventCompare.tsx`, `app/_ui/ComparePicker.tsx`, `lib/copy.ts` or any `lib/i18n/*.ts`. #199 has no conflict with it in those files. The only shared file changed is `app/_ui/StatTable.tsx`: `StatMetric.vs` gained an optional `memberMark`, and nothing else there changed.
- The in-event rule for one alliance across events is now in `allianceHistory` (`inEventPairs`, `inEventOf`). It is the same rule as `measured` / `changedPair` in `compare.ts`: a failed or stale side gives null. For a player, `PlayerEventRow.inEvent` (`lib/queries/players.ts`) already holds the per-event before → after values, and `PlayerAcrossEvents` renders them.
- 08zzp (#198, footer disclaimer) runs in parallel and adds a copy key. `origin/dev` had not moved when this PR was opened, so #199 should merge `origin/dev` before running translate-copy.
- Put "issue 199", not "#199", in comments under `app/` and `lib/brand/components/`. `lib/brand/tokens.test.ts` reads `#199` as a colour literal.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/204
