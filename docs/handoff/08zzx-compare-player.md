# 08zzx — Player view of the event compare page (#199)

## Built

- `lib/queries/compare-player.ts` (new, exported from `lib/queries/index.ts`):
  - `comparePlayer(db, a, b, uid)`: both events through `getEventDetail` (so `publicEvent`), then one query for the uid's member rows in the two events' snapshots, with the rank by might inside its alliance snapshot (`peerRank`, now exported from `players.ts`). Per event: union id, tag, name and badge id of the alliance at the reference (after, else before), the rank, Might at the reference, the in-event change of Might and Kills (`compute.delta`, each side fresh only when its own alliance row is usable), and the before values for the percent. Name and `hasAvatar` from the second event's reference row, else the first's. `hasPage`: whether the uid is in a chain event's roster (a second small query). Null when an id is not a public event or the uid is in neither event.
  - `getComparePlayerPage(db, { a, b, uid })`: the same picks and defaults as the alliance view, then `comparePlayer`.
- `lib/queries/compare.ts`: `usable`, `sidesOf` and the `Detail` type are exported; the event stripping became `eventOf` (exported); the picker's defaults moved out of `getComparePage` into `comparePicks` (exported), which both views call. No behavior change; the three existing tests pass unchanged.
- `app/(pages)/events/compare/page.tsx`: parses `player` with the player page's rule (`^\d{1,15}$`); a malformed value is a 404. With `player`, the page loads the player view: title row with the photo and the name (`TitleRow`), the legend, a `Player · Might · Kills` header from 640 px, and one card (`PlayerResults`). The `<title>` is `Name · Oct 24 vs Oct 17 · OG's LAP Tracker`.
- `app/_ui/PlayerCompare.tsx` (new): `PlayerCompareTitle` and `PlayerCompareCard`. The card: photo, name and Might on top; a line per event with the date, `#rank` and the alliance's badge and `[TAG] Name`, then Might and Kills change with percent; then the difference line (`differenceCells`, labelled with `versus`). An event with no roster row reads "not in a tracked alliance".
- `app/_ui/EventCompare.tsx`: `CompareCard`'s `Line` has an optional `above` (below 640 px a full-width row above the line); `versus` takes any `{ a, b }` pair of events.
- `app/_ui/ComparePicker.tsx`: `compareHref(a, b, unionId?, uid?)` writes `player`; the picker's form has a hidden `player` input and the ⇄ swap link keeps it. `PlayerCompareLink` (new) is the player page's "⇄ Compare"; `CompareLink` and it share `CompareButton`.
- `app/(pages)/players/[uid]/page.tsx`: only the title row changed: `PlayerCompareLink` beside `ExactToggle`, wrapped like the event page's `TitleActions`.
- Copy: one key, `compare.notTracked` ("not in a tracked alliance"), in English and all 17 other languages, stamped; one glossary row per language.
- `lib/queries/compare.test.ts`: one PGlite test (`comparePlayer (issue 199)`).
- `docs/DECISIONS.md`: one dated amendment line under D57. `docs/DESIGN.md`: the Navigation line for event vs event and the `event-compare` component.
- 8 screenshots, `docs/screenshots/08zzx-compare-player-*.png`.

## Decisions

- **Both `alliance` and `player` given:** the player view is shown and `alliance` is ignored (it is still parsed, so a malformed `alliance` is a 404). The hidden input and the swap link then carry only `player`.
- **Title link when there is no player page:** a uid seen only in a standalone manual round has no `/players/[uid]` (playerHistory reads chain events only). The query returns `hasPage`, and the title and the card show the name as plain text, not a link, when it is false.
- **Player page control:** links to the player's two newest events in `history.rows` (chain events, oldest first), so `?a=<second newest>&b=<newest>&player=<uid>`. Left out when the player has fewer than two event rows.
- **A uid in neither event:** 404. A = B with `player`: the same empty state as the alliance view ("Pick two different events."), without checking the uid.
- **Mid-event switch:** the reference alliance is the after row's, as `eventRow` in `players.ts` does. The change is the player's after row minus their before row even when the two rows are in different alliances; each side is fresh only when its own alliance row is fresh and not failed.
- **360 px layout:** the alliance goes on its own row above the event line below 640 px (`Line.above`); from 640 px it sits in the head column under the date and the rank (hidden there below 640 px). The head column stays narrow, so the figures keep their width.
- **Card shape:** built like `MemberCompareCard` as merged (difference line included), since the owner has not answered the two 08zzw questions.
- **Test placement:** in `compare.test.ts`, with two events of its own dated 2026-10-10 and 2026-10-17, so the existing assertions and the defaults test are unchanged. The player uid is 12 digits.
- **Comments** say "issue 199", not the number with a hash sign.

## Deviations

- **No translator subagent ran.** This session had no tool to spawn subagents, so I translated the one new key into the 17 languages myself under `.claude/agents/translator.md`'s rules (lowercase like each language's `compare.notIn`, capitalised in pt-BR and vi where `notIn` is; no game term in the key), added a glossary row per language, then ran `pnpm -s i18n:stamp`. A native-speaker check is still worth doing.
- **Glossary tables reformatted:** in id, sv, uk and vi the new word is the longest in the column, so prettier widened each whole table (about 48 changed lines each).
- **`compare.ts` touched beyond exports:** `comparePicks` and `eventOf` were extracted so the player view reuses the defaults and the event shape without a second copy. `getComparePage` returns the same object as before.
- **No capture of "not in a tracked alliance":** the hosted database has no player present in one event and absent from another (checked: no uid in event 2 missing from event 1, none in event 3 missing from event 2). The line renders from the same code path as the member card's "not in alliance"; it is not covered by a test or a screenshot.
- **The player page now has a second control in the title row** (Compare and Exact numbers). At 360 px they wrap under the name, as on the event page (`08zzx-compare-player-link-360-light.png`).

## Verified

- `pnpm check`, exit 0: prettier, eslint, tsc, `Test Files 54 passed | 1 skipped (55)`, `Tests 247 passed | 1 skipped (248)`, `No schema changes, nothing to migrate`, `Everything's fine`, `i18n: 17 languages up to date with English`.
- `pnpm exec vitest run lib/queries/compare.test.ts`: `Tests 4 passed (4)`. The new test asserts: A in alliance 1 (`T1`, rank 2, Might 110, change +10 / +2), B in alliance 2 (`T2`, rank 1, Might 125, change +5 / +3), before values 100 / 10, `hasPage: true`, and `findBlockedKeys(c)` is `[]`.
- `pnpm -s i18n:todo` listed `compare.notTracked` for all 17 languages before the edit; `pnpm -s i18n:stamp` printed `i18n: stamped 17 languages`.
- `next build` (exit 0) and `next start -p 3199` with the main checkout's `.env.local` copied in (never printed, deleted before the last commit) and `LAP_API_BASE_URL` and `LAP_SITE_BASE_URL` set inline to `http://127.0.0.1:9`. Reads only; no seed, migrate, run button, `/api/quota` or other `/api/*` request. Server stopped by port (`lsof -ti tcp:3199` empty afterwards). One read-only scratch query (deleted) found the hosted data's events (1 = Oct 17, 2 = Oct 24, 3 = Oct 31, all scheduled) and the one player in two alliances, uid 339985801541 (Souldge, YAHO then FSPN). Status codes:

| URL | Status |
| --- | --- |
| `/events/compare?a=2&b=3&player=339985801541` | 200 |
| `/events/compare?a=1&b=2&player=339985801541` | 200 |
| `/events/compare?a=1&b=3&player=339985801541` | 200 |
| `/events/compare?player=339985801541` (defaults) | 200 |
| `/events/compare?a=2&b=3&player=1` (in neither) | 404 |
| `/events/compare?a=2&b=3&player=x` | 404 |
| `/events/compare?a=2&b=3&player=1234567890123456` (16 digits) | 404 |
| `/events/compare?a=2&b=3&alliance=67110335&player=339985801541` | 200 (player view) |
| `/events/compare?a=3&b=3&player=339985801541` (empty state) | 200 |
| `/events/compare?a=2&b=3` and `...&alliance=67110335` | 200 |
| `/players/339985801541` | 200 |

- Souldge, Oct 17 vs Oct 24: Oct 17 `[YAHO] AGGRESSOR`, `#1`, Might +992K (+1.6%), Kills +57.7K (+3.2%); Oct 24 `[FSPN] Slapsticks`, `#2`, +1.55M (+2.4%), +73.2K (+3.8%); difference ▲ +562K (+56.7%), ▲ +15.5K (+26.9%).
- Cross-check against the player page (chain events, both figures present): the exact values 991,603 / 57,660 (Oct 17), 1,554,052 / 73,155 (Oct 24) and 1,395,998 / 68,729 (Oct 31) each appear on `/players/339985801541`. The page's control links to `/events/compare?a=2&b=3&player=339985801541`.
- Screenshots (Playwright core on system Chrome; `document.documentElement.scrollWidth` equal to the viewport on every one, so no horizontal scroll): `08zzx-compare-player-{360,1280}-{light,dark}`, `-360-light-de`, `-360-light-ru`, `-link-360-light`, `-link-1280-dark`. In de and ru at 360 px the card's figures sit on one line each, with the percent under them.

## Open issues

- Alliance badges show the placeholder in the captures: the badge route reaches `LAP_SITE_BASE_URL`, pointed at a dead port. The photo is real: the avatar route fetches the stored photo URL from the photo host, which no base URL redirects (see 08zu's handoff).
- The "not in a tracked alliance" line is not captured and not tested (see Deviations).
- From 640 px the head column holds date, rank and alliance on three lines; a long alliance name wraps there. Not seen in the captures (`[YAHO] AGGRESSOR` fits on one line at 1280).
- Existing mismatch, not changed here: the player page's in-event line diffs each figure on its own, while `compute.delta` gives no change when kills is null (13 of 2,723 fixture rows). For such a member the player view shows `—` where the player page shows a Might change.
- The two questions from 08zzw are still open for the owner (the difference line on member cards; a column head from 640 px). The player card follows `MemberCompareCard`, so whatever is decided there applies here too.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one. Issue 129 (two players side by side) is parked by the owner until about 2026-11-29.
Model / effort: keep (opus · high) — no signal: one new query file, one card file, edits in four existing files, and the one test passed on its first run.
Owner must do first: merge this PR into `dev` (`Closes #199` closes the issue). Answer the two 08zzw questions if the player card should change with them.
Plan changes needed: none.

<adjustments>
- The player view's data is `comparePlayer` / `getComparePlayerPage` in `lib/queries/compare-player.ts`; the card is `PlayerCompareCard` in `app/_ui/PlayerCompare.tsx`. A future two-players page (issue 129) can call `comparePlayer` once per uid for a chosen pair of events.
- `compare.ts` now exports `comparePicks` (picker defaults and choices), `eventOf`, `sidesOf`, `usable` and `Detail`; `players.ts` exports `peerRank`. Reuse them instead of copying.
- `compareHref(a, b, unionId?, uid?)` carries `player`; `CompareCard`'s `Line.above` puts a full-width row above a line below 640 px.
- The hosted data has exactly one player in two alliances across events (uid 339985801541) and no player missing from an event, so a capture of "not in a tracked alliance" needs seeded data or a manual round.
- The player page's title row now holds two controls (`PlayerCompareLink`, `ExactToggle`).
</adjustments>
