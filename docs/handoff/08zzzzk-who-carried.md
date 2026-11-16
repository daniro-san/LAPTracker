# 08zzzzk — Who carried the kingdom: kill share vs might share

Refs #280. Decision: D83.

## Built
- **Arithmetic** in `lib/compute.ts`: `carriedShares` (each alliance's share of the kills gained and of the might at Start, over the alliances with all three totals; a fall in kills counts as 0), `ratioSpread` (lowest and highest ratio; null under `CARRIED_MIN_EVENTS = 3`). Tests in `lib/compute-carried.test.ts` (a property test that both shares add up to 1, the ratio, the null total, the fall, the spread).
- **Read** `whoCarried(db, detail, turnout)` in `lib/queries/carried.ts`, called from `getEventPage` (`lib/queries/event-page.ts`) and returned as `page.carried`. It takes the event's own Start and End totals from the detail already loaded, and reads the alliance totals of up to 12 earlier `chainEvent` events (two queries) for the ratio's range. It joins the #271 share of members with kills gained. Rows are ordered by gap, biggest first. Test: `lib/queries/carried.test.ts` on PGlite (shares, stale side left out, null without an End, ratio from the third event).
- **Section** `app/_ui/WhoCarried.tsx`, rendered by `EventView` right after "War turnout": title, two help lines, the kingdom total line, a legend (square = might share at Start, round = kill share gained), a 0 to max axis caption, then rows. A row: badge, label, ratio (or the gap as `+6.8 pts`), a track with the two marks and the joining line (HTML boxes, D68), the two shares and the turnout as text, the range as text. The viewer's alliance gets the yarn highlight and the "My alliance" word, wherever it sits. Test: `app/_ui/WhoCarried.test.ts`.
- **Format** helpers in `app/_ui/format.ts`: `sharePreciseText` (one decimal), `ratioText` (`2.5×`), `pointsText`.
- **Copy**: eleven `ledger.carried*` keys, translated in 17 languages. To keep `lib/copy.ts` under the 300-line lint limit, the war-turnout and the new keys moved to `lib/copy-war.ts` and are spread into `ledger`; their paths (`ledger.fought`, `ledger.carried`) are unchanged.
- **Decision** `docs/decisions/D83-kill-share-vs-might-share.md` and its README line.

## Decisions
- **Superseded 2026-11-16 (owner): "Show all (n)" was added, see "UX review" below.** Original text: **No "Show all".** The issue's placement note suggests the WhoFought pattern; the binding "no bottom list" review rule wins, because an expanded list sorted by the gap ends with the lowest kill shares. The section shows the first 5 rows with a kill share above the might share, plus the viewer's own row.
- **Shares are over the alliances with a usable Start and End.** An alliance with a stale or failed side has no figure and is not in the totals, so the shares add up to 100 % of the same set.
- **"Kingdom" is the tracked alliances.** The total line says `All {n} alliances: {kills} kills gained, {might} might at Start`.
- **A KvK is any event of `chainEvent`** (the schema has no event kind). The ratio needs 3 ratios counting this event; earlier events count whether or not they have samples. The range is over those ratios (`1.8×–2.9× over 4 events`). Up to 12 earlier events are read.
- **Below 3 events the row shows the gap in percentage points** (`+6.8 pts`), not the ratio, so the figure beside the name is never blank. Rows with and without a ratio can be mixed in one list.
- **The axis runs from 0 to the largest share among the rows shown**, one axis for all rows, with its two ends written under the legend.
- **Section only with an End.** While the event runs the section is not shown.
- **Translations**: 17 languages, at most 3 translators at a time. The first run of `vi` and `th` read stale todo files from the shared scratch folder and wrote a `merge` section; those two files were restored from git and translated again.

## Deviations
- No "Show all" at first (superseded, see Decisions). The build agent could not push (sandbox); the orchestrator pushed the branch and opened the PR, whose URL is the last line.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest (97 files passed, 2 skipped), drift and i18n ("17 languages up to date with English") green.
- Local run (local Postgres, no upstream call, `pnpm dev:local`), seeded event 3 with SQL on the local database only: an alliance `TmSLONG` / `Ünbelievably Long Allianz Nam` set as "My alliance" below the top rows, one alliance with fewer than 3 events (shows `+6.8 pts`), the rest with ratios and ranges.
- Chrome, light and dark, at 360, 390, 412, 640 and 1280 px: the page's `scrollWidth` equals its width at every size; the section's right edge is 344 px at 360 and 396 px at 412.
- Screenshots: `docs/screenshots/08zzzzk-who-carried-360-light.png`, `-360-dark.png`, `-1280-light.png`, `-1280-dark.png`.
- Not run: 390 and 412 px visual review beyond the overflow measure; WebKit; a real KvK's numbers (the seed is synthetic, so the 11.2× style ratios in the screenshots are not real).

## UX review (2026-11-16)
Measured (Chrome, light and dark, 360, 390, 412, 600, 768, 810, 820, 1024, 1180, 1280; WebKit 390 and 820, light and dark; German and Russian at 360): `scrollWidth` equals the viewport width everywhere, with the list collapsed and expanded; no tap target under 44 px (rows are 44 px or more, "Show all" is a `buttonClass` button); no text under 4.5:1 (computed against the real background, ink/70 text included); no figure clipped. The only clipped text is a long alliance name (`[TmSLONG] Ünbelievably Long Allianz Nam`) at 360 to 412 px and `[IMPA] IMPERIUM AETERNUM` in German at 360 px: both end in an ellipsis after the tag, as in War turnout. The section has no `<select>`.
Fixed: owner decision 2026-11-16, "Show all (n)" opens every alliance with a figure in the same order (D83 amendment); the "furthest above their might share" line is hidden once the list is open because it no longer describes the rows; one test for the expanded order.
Left: (1) rows with a ratio and rows with `pts` share a list (open issue 2, owner decision). (2) One large alliance sets the axis, so the others sit near the left end; the figures are text, so nothing is lost. (3) The first phone screen reads title, two help lines, then data; a one-sentence takeaway above the rows would need new copy in 17 languages. (4) At 820 px and wider the rows are full width with 12 px text; the same as War turnout.
Reader's 3-second takeaway: before and after, "each alliance's kills against its might, one row each, the first one with 5.9x" (the data, not a sentence). Wording has no blame words in English, German or Russian.

## Open issues
1. **The ratio's range is over 12 earlier events at most**, and a Start that did not match the battle window still yields a ratio for that event. The range shows the spread but does not exclude such an event.
2. **Rows with a ratio and rows with `pts` sit in one list**; the owner may prefer the gap for every row until all alliances have 3 events.
3. **The turnout line shows the share of members with kills gained** only when the event has a #271 figure for the alliance; the alliance shows no turnout otherwise.
4. **The player-facing numbers are not validated against the issue's measured KvK 2026-11-14** (NSE 2.5×, PSY 0.07×); compare after the PR is on a preview with production data.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after Session 10; follow-ups #276 (the Discord End picture may carry these figures).
Model / effort: keep. The work needed no more reasoning than the war turnout did; two translator runs needed a redo because of stale scratch files, not model quality.
Owner must do first: merge this PR into `dev`; decide open issue 2 (gap in points for every row until 3 events for all).
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- `page.carried` (`Carried` in `lib/queries/carried.ts`) holds rows ordered by gap, each with `mightShare`, `killShare`, `ratio`, `spread` and `turnout`; #276 can reuse it for the Discord picture. English only there (D48), with the words "kill share" and "might share".
- `lib/copy.ts` is at the lint limit: new public `ledger` keys go in `lib/copy-war.ts` (spread into `ledger`) or a similar spread file.
- The scratch folder is shared between sessions: write translator todo files to a new, empty folder, never `todo-<tag>.json` in a folder that already has some.
</adjustments>

## Review fixes (2026-11-16, /pr-review standard)

- `getEventPage` starts `whoCarried` inside its `Promise.all`: the earlier events' ratios are read beside the other reads, and `whoCarried` takes the turnout lists or their read still on its way. It waited for all of them before.
- Test: `pointsText` signs a gap with plus, minus, or no sign when it rounds to zero (`app/_ui/format.test.ts`).
- `WhoCarried`'s line width uses its own `at` helper; the handoff's stale Deviations and Owner lines are corrected.

https://github.com/daniro-san/LAPTracker/pull/338
