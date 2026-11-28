# feat: Insights → KvK → Debrief, the KvK after-meeting on one screen (issue 872)

## Built

- `lib/private/kvk-debrief.ts`, `kvkDebriefView`: one reader for the KvK the KvK map shows (`eventEndPlaces`: the newest public scheduled event of the last 4 weeks with a fresh Start and End). It returns null when there is no such event, or when its day is an Origin of Chaos day (`isKvkDay`, #806). It makes no upstream call. It reuses these readers:
  - Thanks: `recapKills` + `killsTurnout`, the D159 post 5 counting. Each gainer is listed in name order with their gain, plus "n of m" and the sum. A member with no gain is not in the list.
  - Roll call: the week's `shield` roll call whose `raidOf(day).saturday` is the KvK day. Its `newestMarks`, main and wall, give the ✓ names only.
  - Map: `kvkMapOf(end, castle).bands`, reduced to band, members and kills (no names).
  - Recovery: `scheduledEventMight` + `endOfDayReads` + `kvkOf`, the same KvK event with its per-member lists removed.
  - Opponent: `eventMatchup` Start to End sums, read only while the `kvk-matchup` flag is on. With no matchup, the raid opponent (#861, `raidOpponentView`): its tag, server and each side's kills gained and might change, once both sides have usable reads.
  - `kvkDebriefView(db, access, now, { cfg, matchup })` takes the schedule config, because the raid opponent's read times need it.
  - `cardRenderAllowed`: 10 card renders per workspace per hour (`recordFailure`, the same counter as the castle point's saves).
- `lib/private/kvk-debrief-card.tsx`:
  - `debriefCard` builds the card model, made only from the debrief.
  - `renderDebriefCard` draws the PNG with next/og. It uses the event picture's fonts, 2× scale and `drawable`, and the brand band and `MarkLine`. No game art, no URL.
  - The card names only members who gained kills. The roll call and the map are counts.
  - A name the fonts cannot draw at all (only CJK or emoji) is shown as `#uid`, the same fallback `label()` uses for an alliance.
  - `opponentWords` gives the Opponent section's lead and rows to both the page and the card.
- `GET /api/w/[slug]/insights/debrief/card` returns the PNG as a download (`private, no-store`). It answers 401 `signed_out`, 403 `turned_off` (Insights off), 404 (no debrief) and 429 `rate_limited` (over the hourly limit).
- Page `/w/[slug]/insights/debrief`:
  - It goes through `openRollCall` with the Insights feature, so it follows the D71 access check and the D126 switch.
  - It has six cards: Thanks, Roll call, Map (HTML bars, D68/D158), Recovery (Insights' own bars and `RecoveryDays`, now exported from `InsightsMore.tsx`), Opponent, and the card download.
  - It is mobile-first, with 44 px links. Names are `ph-no-capture`.
- Insights' KvK card has a "KvK debrief ›" link.
- Copy in EN, PT-BR and FR: `lib/private/dictionary.insights-debrief.ts`, spread in `dictionary.insights.ts`. The mark labels and the roll call kind name come from the roll call dictionary.
- D159: dated amendment of 2026-11-28 (issue 872).
- Tests:
  - `lib/private/kvk-debrief.test.ts` (PGlite, 7 tests): the sections from seeded data; a member with no gain is unnamed on both the data and the card; an undrawable name is drawn as `#uid`; the raid opponent's Start to End when no matchup is set; an Origin of Chaos week has no debrief; the card has no blocked key, no place and no roll call name, and renders as a PNG; own alliance only (members, Raid prep marks, castle point).
  - `app/(private)/api/w/[slug]/insights/debrief/card/route.test.ts` (PGlite + real Request, 4 tests): 403 `turned_off`; 404 with no debrief; 200 `image/png` with `private, no-store` and `attachment; filename="kvk-debrief-2026-11-07.png"`; 429 past the limit.
  - `member-session.test.ts`: a fixture for the new route.

## Decisions

- **Roll call "defenders / support".** D103 has no defender or support mark. The KvK's roll call is Raid prep (D137), so the section lists its ✓ Shield up and ✓ Squads off the wall, by name. The D159 post 5 line under Thanks thanks defenders and support players.
- **One KvK, the map's.** The debrief uses the map's newest event. In an Origin of Chaos week the page shows no debrief, instead of falling back to the KvK before it.
- **Opponent.** The opponent result (won/lost) is admin-only (D152), so the section shows sums only, with no win or loss words. It follows the `kvk-matchup` flag, the same flag the event page and the End picture use.
- **Card delivery.** The card is a download that officers post by hand. Nothing is sent to Discord.
- No analytics event for the download: a new `ws_action` feature would need a tracking-plan change.

## Deviations

- The Thanks gain is End − Start per member (the recap's rule). It does not use D160's windowed start like `killsThanks` on Me, because the KvK recap post counts the same way.

## Verified

- `pnpm vitest related --run <changed files>`: 114 files, 705 tests. All passed in the first run. On the rerun after the lint fixes, `cross-workspace.test.ts` timed out once (21.6 s, under load). It passed in the full run below.
- Mutation test: removing the `isKvkDay` guard makes the Origin of Chaos test fail. Reverted.
- `pnpm check` on the first version: passed. That covers prettier, eslint, tsc, vitest (421 files, 2312 tests passed, 4 skipped), drift and i18n.
- After the review fixes (limiter, route test, `#uid` fallback, raid opponent):
  - `pnpm vitest related --run`: 115 files. The one failure was `cross-workspace.test.ts`, which timed out under load (25.8 s). On its own it passes in 17 s, close to its limit.
  - `pnpm check`: passed, 426 files and 2339 tests passed, 4 skipped. The two fix rounds before that were a prettier miss and an import-order lint in the route test.
- Not checked in a browser. No real-data or persona review was run.

## Open issues

- Pre-existing: `kvkMapView` (Insights → KvK map) also uses the newest event with no `isKvkDay` filter, so in an Origin of Chaos week the map shows that event. Follow-up.
- Pre-existing: `cross-workspace.test.ts` takes about 17 s against a limit of about 20 s, so it times out when the suite runs in parallel under load. Follow-up.
- The card's line height is estimated (40 characters per line). A very long translated line could be cut off at the bottom of its box.

## Next

- Follow-up: apply the `isKvkDay` filter to the KvK map (above).
- Follow-up: run a designer-persona review of the page and the card at 360/640/1280, light and dark, and in a Discord post.

What was missing from the task prompt? Which D103 mark means "defender" or "support". There is none, so the section uses Raid prep's ✓ marks.

PR: (added by the orchestrator)
