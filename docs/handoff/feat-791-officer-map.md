# feat/791-officer-map — Insights → KvK map at the End reading (issue #791)

## Built

- Data check (read-only SELECTs on production, aggregates only; results under Verified).
- `lib/repo/workspace-rosters.ts` `eventEndPlaces`: the newest public scheduled event since a date whose Start and End rows of the alliance are fresh and not failed. It returns each End member's `x`/`y` (only `uid`, `x`, `y` read from the End row's `raw_json`) and their Start and End kills (`member_snapshots`), and the count of End members with no place. It returns no uid and no name. It and `scheduledEventKills` pick the event through one private helper, `newestStartEnd` (review of PR #800). The helper holds the public-event rule (not manual, not a test, not `admin`) and D160's phase rule.
- `lib/private/kvk-map.ts`: `kvkMapOf` (pure) puts each dot in a band of kills gained: `none` (0), `fewer` (1 to the gainers' median), `more` (above it), null when kills are not known on one side. Near/mid/far rows exist only with a castle point and at least 3 members with known kills. `kvkMapView` reads the own alliance (`access.unionId`) and the own workspace's castle point. `castleInput` and `saveCastlePoint` (zod, 0–999 whole squares or both null; 30 saves per 15 min per workspace).
- `workspaces.castle_x`, `workspaces.castle_y` (nullable integers), migration `drizzle/0084_cooing_shadow_king.sql` (regenerated after rebasing onto dev, where PR #797 took 0083); `castleOf` and `saveCastle` in `lib/repo/workspaces.ts`.
- `POST /api/w/[slug]/kvk-castle`: officers only (`requireWorkspace`), same-origin JSON, 400/401/429. No analytics event, no log of the point.
- `app/(private)/_ui/InsightsKvkMap.tsx` (`KvkMapCard`, server): an inline SVG scatter (aria-hidden, `ph-no-capture`) with both axes on one scale, Y upward. The marks are a hollow ring (no kills), a small grey dot (fewer), a larger plum dot (more), a faint dot (not known), and a seal plus for the castle point. In HTML: the based line (date, members placed, members with no place), the caption "Where members were at the End reading (hh:mm ST), not where they fought.", the plot's edges in map squares, a legend with the count beside each band, the near/mid/far table (distance range, members, kills gained, `ph-no-capture`) or a line saying why there is none, and the castle form.
- `app/(private)/_ui/KvkCastleForm.tsx` (client): two numeric fields (44 px), Save point and Remove point, and a refusal line through `RefusalLine` (handles signed out).
- The card sits under the KvK card on `/w/[slug]/insights`, read in parallel with the page's other reads.
- Words: `lib/private/dictionary.insights-map.ts` (EN, PT-BR, FR), spread in `dictionary.insights.ts`.
- D71 amendment dated 2026-11-27 naming the view.
- Tests: `lib/private/kvk-map.test.ts` (kill bands; bands only with a castle point; own alliance and own castle only, no uid/name/other roster field in the view), `app/(private)/api/w/[slug]/kvk-castle/route.test.ts` (save and clear; out-of-range refused; member 401 keeps the point), and a `kvk-castle` fixture in `member-session.test.ts` (no session, member, and another workspace's officer all get 401). Added after the review of PR #800: `eventEndPlaces` cases in `kvk-map.test.ts` (a stale or failed End row, an `admin` event and an event older than `since` are skipped; a newest event with no Start or no End falls back to the older one), and `app/(private)/_ui/InsightsKvkMap.test.ts` (the plot svg and the table carry `ph-no-capture`; the markup holds no uid or name).

## Decisions

- The view carries no uid and no name: a dot is a place and a band. Officers see where the alliance stood, not who stood where. If officers want names on the plot, that needs a tap pattern (D158 rule 7) and an owner call.
- Kill bands: the 3 bands are "no kills gained", "1 to the median gain of those who gained", and "above that median". With an all-equal set of gainers the "more" band is empty and not listed.
- Near/mid/far are thirds of the members with known kills, sorted by straight-line distance from the castle point in map squares. The table gives each third's distance range, members and summed kills gained. Members with unknown kills are drawn faint and left out of the table.
- The plot spans the members and the castle point (at least 20 squares), not the whole 0–999 map, so a cluster is readable at 360 px. The words under it name the real edges.
- The castle point is stored on the `workspaces` row, not in a new table. That keeps it out of the export and purge table lists, and it goes when the workspace row is deleted.
- Castle input bound 0–999: every stored read has places from 2 to 997 (aggregate check).
- The map shows the newest public scheduled event in the last 4 weeks (KVK_EVENTS × 7 days), the KvK card's window.

## Deviations

- The task names `sid` vs `home_sid`. The stored members have `kid` (kingdom), and the alliance row has `sid`. The off-server check compared `kid` to the alliance's `sid`.
- No `ws_action` analytics event on a castle save. The other desk saves send one; this route leaves it out so that nothing about the map reaches analytics. Add one with area `insights` and action `castle` if desk adoption needs it (it would carry no point).

## Verified

- Data check, production, read-only, aggregates only, own alliance:
  - Scheduled non-test, non-manual events with Start and End reads: 3 (Nov 7, Nov 14, Nov 21).
  - Nov 7 and Nov 14: 100 members each, 0 % with a position in either reading. Positions were not stored before about Nov 17.
  - Nov 21 (the only one with positions): 99 at the End, 96 with a position at the Start, all 99 at the End. Position changed between Start and End: 44.4 %. Off-server at the Start or near the End (`kid` ≠ alliance `sid`): 0 %. Median distance moved: 0 overall, 18 squares among those who moved. `kid` has one value in every stored reading, so it may not show where a member is during KvK.
  - Baseline from the daily reads (Nov 18–27, day to day): 0–3 % move on most days, 63 % on Nov 21 (KvK day), 20 % on Nov 22, 14 % on Nov 24.
  - Result: not "most moved or off the map", so the view was built. It rests on 1 event; Saturday's read (Nov 28) will be the second.
- `pnpm vitest related --run` on the changed files: 386 files passed, 1 failed (the copy guard flagged the castle path string), fixed by drawing two `<line>`s. `pnpm check`: exit 0 (prettier, eslint, tsc, vitest 389 files / 2111 tests passed after the rebase onto dev, 2 skipped files, drift and i18n checks). Breaking the code once each proved the new tests fail. Removing the `admin` rule from `newestStartEnd` failed the skip case. Removing `ph-no-capture` from the plot failed the render test. Both were restored.
- Not done: no browser render at 360/640/1280 px (no local DB with an End read with places here). The persona check below is a review of the code and markup.

Persona check (code and markup review):
- Officer on a phone (360 px): the plot fills the card width (square). The legend gives one row per band with its count. The table has 3 columns. The two fields (96 px each) and the buttons wrap, and every control is at least 44 px. Nothing depends on hover.
- Officer on a desktop: the plot is capped at 448 px wide in the main column, and the margin pane is unchanged.
- Data-viz designer: equal scale on both axes, edges written in HTML, bands told apart by shape, size and fill (not colour alone), a count beside each legend row, labels in HTML (D68/D158). Risk: up to 100 dots in a tight cluster overlap. There is no jitter, so overlapping dots hide each other.
- Privacy: no uid or name in the view or the page markup. The plot and table are `ph-no-capture`, under the layout's `ph-mask`. The castle point is not in the export, Discord, logs or analytics. The roster-fields guard (`lib/private/roster-fields.test.ts`) stays green: the app code has no `"x"`/`"y"` literal, and the body keys are `castleX`/`castleY`.
- Data honesty: the caption says the map shows where members were at the End, not where they fought. No sentence links distance to kills. Unknown kills are drawn faint and left out of the table. The table note says each row is a third by distance.

## Open issues

- Issue item 4 (owner): whether to also store positions in the 15-minute KvK samples, own alliance only, cleared after 90 days. Not done here.
- `kid` never differs from the alliance's `sid` in stored reads. Whether it reflects a member's kingdom during KvK is unknown. The map does not mark off-server members.
- Dots can overlap in a dense cluster (no jitter or density mark).
- Migration 0084 may clash with another open PR that also took 0084. The orchestrator renumbers on merge.

## Next

- Owner: answer item 4 of #791 (store positions in the KvK samples or not).
- After Saturday 2026-11-28's End read: check the map on the desk at 360 px, 640 px and 1280 px with real data (local, never committed). Then re-run the aggregate check for 2 events.
- Follow-up candidate: names behind a tap on a band (D158 rule 7 (c)) if officers ask.

What was missing from the task prompt? The field to compare for off-server (`kid` vs the alliance's `sid`, not `home_sid`), and how the 3 kill bands and the near/mid/far cuts should be defined.

PR: (added by the orchestrator)
