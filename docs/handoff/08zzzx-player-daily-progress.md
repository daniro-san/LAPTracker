# 08zzzx — Player page: daily progress, with the site's first chart (D68)

Issue #270. The player page read event snapshots only; the daily read (D60) has stored every member's might and kills once a day since 2026-11-10. This session adds a "Daily progress" section that reads both, and the first chart.

Closes #270

## Built
- **Read model** `playerProgress(db, uid)` in `lib/queries/player-progress.ts`, exported through `lib/queries/index.ts`:
  - `readings`, oldest first: every usable daily roster and every usable public event Start/End roster that holds the uid. Each has `at` (`source_updated_at`), `event` (id, title, manual, date, phase; null for a daily read), `unionId`, `tag`, `power`, `kills`, `rank` (1 + roster-mates with more might; null without a might).
  - Daily rosters: the player's element is picked in SQL with `array_position` (`::text` cast so a null stays null, D15); the rank counts `unnest(member_power)` above it. Event rosters: `member_snapshots` with `peerRank` from `players.ts`; two rows of one snapshot go through `compute.pickRosterRows`, as the player page does.
  - `summary`: the newest reading against the newest reading at least 6.5 days older, else the oldest (the rule is in the code comment). `power` = the might change. `alliance.medianPercent` = the median of each member's might change in percent, over members with a might in both rosters; the two rosters are re-read with `dailyReadings` / `eventReadings`. Null without two readings or without both mights; `alliance` is null when the two readings are of different alliances.
  - Served fields: union id, tag, might, kills, rank, event head. No raw_json, avatar_url or blocked key is selected.
- **Shared usability rules** in `lib/queries/history-readings.ts`: `dailyFit` and `eventFit` (fresh, no error, not empty; public event) split out of `dailyUsable` / `eventUsable`, which now use them. Member history's behaviour is unchanged (its tests pass). `eventHead` is exported.
- **Chart** `app/_ui/charts/LineChart.tsx` (server component): inline SVG in a 100 × 100 box stretched to the card width, non-scaling strokes, a dot per reading (zero-length round-capped segment), shaded bands, top and bottom hairlines. Highest/lowest value and first/last date are HTML around the SVG. `role="img"`, `aria-label` = `ledger.chart` with the first and last value and dates. Colours: `text-ink` line, `text-rule` bands and hairlines, through `currentColor`. `small` gives the kills height.
- **Section** `app/_ui/PlayerProgress.tsx`, placed on `/players/[uid]` between the summary band and "Across events", titled like "Across events": one framed card with the summary sentence, the Might chart, a line with the `Event` key (only when bands exist) and the war note, a smaller Kills chart, and `MoreBar` Details with the readings table newest first (time and what was read, Alliance, Might, Kills, Rank). Fewer than 2 readings: one muted line.
- **Copy**: 6 keys inside `ledger` (`progress`, `progressMight`, `progressMedian`, `progressWar`, `progressEmpty`, `chart`), translated into 17 languages by the translate-copy skill in six batches of at most 3 translators; stamped.
- **Seed**: `scripts/seed-daily.ts` adds 12 complete daily reads (Sun–Fri after the 2026-10-17 and 2026-10-24 events) for all 20 seeded alliances; each member's figures move part of the way from one event's End to the next event's Start (deterministic). `seed --reset` now also truncates `daily_rosters` and `daily_reads`.
- **Docs**: `docs/decisions/D68-charts-are-hand-built-inline-svg.md` and its index line (including the owner's "Interaction" rule: state in the URL, server-computed figures, From/To selects alongside chart taps, a chart library only for a separate exploration page); CLAUDE.md's "no charts in v1" now points at D68; DESIGN.md component list gains `line-chart` and `player-progress`.
- **Tests**: `lib/queries/player-progress.test.ts` (PGlite: merge and order with a stale daily roster and a test event skipped; rank by might; the 7-day comparison with the median), `app/_ui/charts/LineChart.test.ts` (no `<text>` element, labels in HTML; the aria-label states first and last value).

## Decisions
- **Summary sentence**: `Might +4.18M (+3.9%) since Oct 24. Median member of [OGs]: +4.1%.` It names the date of the older reading instead of "7 days", so it stays true when the oldest reading is used. Plain text, no colour or arrow: the persona panel asked for nothing judgmental; the sign carries the direction.
- **The median is a median of percent changes**, not of absolute changes, so a small and a large player compare fairly. The player's own percent is printed next to it.
- **Median only when both readings are of the same alliance** ("the same two readings"); after an alliance change the sentence has the might part only.
- **Event bands come from the player's own readings**: an event with both a Start and an End reading of the player. An event without the player, or with only one side, has no band.
- **Copy keys in `ledger`**: lib/copy.ts has no player block; the player page's own keys (`acrossEvents`, `names`, `alliances`) live in `ledger`, so the new keys follow them there.
- **Kind stacked under the time** in the table's first column (5 columns, not 6), so the table fits 360 px without horizontal scroll.
- **Screenshots** are at 360 px only (light, dark, light with Details open): the session allowed at most 3 PNGs.

## Deviations
- Did not push or open the PR: the orchestrator's change to done_when (the worktree sandbox blocks `git push`). Everything is committed on `session/08zzzx-player-daily-progress`; the PR URL line is left out for the orchestrator to add.
- `db:local:start`, the bridge, `dev:local` and the screenshot browser ran with the sandbox disabled: `initdb --pwfile=/dev/stdin` and local sockets are refused inside it. Only the worktree's own `.pglocal/` cluster (port 55471) and a local-only `.env.local` (dummy key, upstream base URLs pointed at `127.0.0.1:9`) were used; nothing reached Neon or the upstream.

## Verified
- `pnpm check`: `All matched files use Prettier code style!` · eslint clean · `tsc --noEmit` clean · `Test Files 60 passed | 1 skipped (61)`, `Tests 272 passed | 1 skipped (273)` · drift: `No schema changes, nothing to migrate` · `i18n: 17 languages up to date with English`.
- Local run: `pnpm db:local:start/migrate/seed` (`seeded 20 alliances × 3 events and 12 daily reads, 1 rehearsal`), `pnpm dev:local --port 3471`, `http://localhost:3471/players/340581761349` (xCage, OGs): 18 readings, summary `Might +4.18M (+3.9%) since Oct 24. Median member of [OGs]: +4.1%.`, aria-labels `Might: 101M on Oct 17, 112M on Oct 31` and `Kills: 5.06M on Oct 17, 5.95M on Oct 31`.
- 360 px, light and dark, cookies cleared, CDP device metrics and `prefers-color-scheme`: `document.documentElement.scrollWidth` = 360 in all three captures (no horizontal scroll). The Details control is `MoreBar`'s, `min-h-11` (44 px).
- Screenshots: `docs/screenshots/08zzzx-player-progress-light.png`, `docs/screenshots/08zzzx-player-progress-dark.png`, `docs/screenshots/08zzzx-player-progress-light-details.png`.
- Spot-check of translations: de `Tagesverlauf` (= the course of one day) changed to `Tägliche Entwicklung`, vi `Tiến độ` (dropped "daily") to `Tiến độ hằng ngày`, both with their glossary rows; the other 15 read as the English.

## Open issues
1. **Plan and DESIGN text still say "no charts in v1"**: docs/IMPLEMENTATION_PLAN.md lines 18, 382, 390, 393, 663 and DESIGN.md's never-list (line 384, "charts (v1 has none)"). They need the owner's edit; D68 records the reversal. D58's "Not done: … charts (out of v1)" is an old entry and stays as written (append-only).
2. **Discord picture (#276)**: the chart uses Tailwind classes and `vector-effect`. In next/og, colours must be `style` props, and the SVG should be drawn with its `viewBox` equal to the pixel size so no stretch is needed; whether resvg honours `vector-effect` was not tested.
3. **No index on `daily_rosters.member_uids`**: the player query scans the table with `@>`. 20 alliances give about 7,300 rows a year, so it is small now; a GIN index is the fix if it grows.
4. **The readings table is unbounded**: a year is about 400 rows inside Details (closed by default).
5. **A player seen only in daily reads has no page** (pre-existing): `/players/[uid]` is a 404 unless a chain event's roster holds the uid, so the new section never shows for them.
6. **A player in two alliances' daily rosters of one day** (moved between two reads) gets two readings that day; not deduplicated.
7. Screenshots at 390 and 1280 px (DESIGN.md "Enforcement") were not taken because of the 3-PNG limit.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`. Follow-ups #274 (alliance trends) and #276 (chart in the Discord picture) can reuse `LineChart`.
Model / effort: keep — no signal; this session needed no retry beyond two lint fixes.
Owner must do first: edit the "no charts in v1" lines listed in Open issues 1 (plan and DESIGN.md never-list).
Plan changes needed: IMPLEMENTATION_PLAN §1 (line 18), the Phase 5d/5e "Not in v1" lines (382, 390, 393) and the v2 list (663): charts are in, per D68.

Prompt sketch for #274 (alliance trends): "Add a trends section to `/alliances/[unionId]/history` (or the alliance page) with `LineChart` for the alliance's total might and member count over its usable daily and event rosters (reuse `dailyFit`/`eventFit` and `dailyReadings`/`eventReadings`; totals from `daily_rosters.total_power` and `alliance_snapshots.total_power`). Numbers beside the chart in a Details table. Any period choice follows D68's Interaction rule: state in the URL, From/To selects."

Prompt sketch for #276 (chart in the Discord picture): "Draw a might line inside `lib/event-image.tsx` with the `LineChart` shapes: pass colours as `style` (Satori ignores classes), set the `viewBox` to the pixel size, keep labels as flex HTML; render it with next/og in both renderers in a test and attach the PNG."

<adjustments>
- `playerProgress(db, uid)` exists (`lib/queries/player-progress.ts`): readings oldest first with `at`, `event`, `unionId`, `tag`, `power`, `kills`, `rank`, and a 7-day `summary`.
- `dailyFit` and `eventFit` in `lib/queries/history-readings.ts` are the one place the "usable roster" rule lives; use them for any new cross-alliance query.
- `LineChart` props: `points` ({at, value}[], oldest first), `bands` ({from, to}[]), `label`, `value` (number → text), `date` (Date → text), `small`, `copy`. Its accessible name is `ledger.chart`.
- The seed now has 12 daily reads (2026-10-18…23 and 10-25…30, 08:01 UTC); `seed --reset` truncates the daily tables.
</adjustments>

🤖 Generated with [Claude Code](https://claude.com/claude-code)


## UX review fixes (2026-11-16)
- **Value range**: at least 5 % of the highest value, centred on the data and never below 0. Kills 3,000,000 to 3,000,002 draw flat; a series of 0 draws on the bottom edge. The highest and lowest labels sit at the height of their values; equal texts give one label; two labels closer than a text line are moved apart. The label column is `w-14`, so the Might and Kills charts line up (checked with "75,3 Mio." in de).
- **Event marks**: an HTML band behind the SVG, at least 6 px wide, `bg-ink/50` (3.1:1 light, 4.3:1 dark against the paper; the line over it is 4.4:1 and 3.2:1). An event wider than 40 % of the chart (two readings) is a tick at each end instead of a band. The key is `ledger.progressEvents`: `Event (Start to End): Oct 17, Oct 24, Oct 31` (the latest 6 Start dates) with a swatch shaped like the mark.
- **Dots**: every reading up to 30 readings, above that only event readings.
- **Dates**: first and last label add the time when they fall on the same day (new `time` prop).
- **Summary**: `You: +3.9% since Oct 24. Middle member of [OGs]: +4.1%.` The player's change is the percent (the amount only when the first might is 0). A date that ends with "." no longer doubles the sentence's full stop (de, pt-BR and others): `summaryText` collapses a final `..`. Translated by translate-copy (3 keys, 17 languages, batches of 3). tr and zh-CN kept the old word "Might" and were corrected by hand.
- **Seed**: `scripts/seed-daily.ts` keeps kills at the End reading's value; might still drifts. `scripts/seed-data.ts` changed too, because the event readings come from it: an End reading's might is 95 % of the drifted figure, and kills only step up at an event (End kills equal the next Start's). Event pages in the seed now show war losses and kills gained only during events.
- **D68** has an amendment bullet with what Satori needs (measured); the Discord variant is not built.
- **Tests**: 7 in `LineChart.test.ts` (flat range, one label, dots limit, same-day time, mark width and ticks, plus the two kept), 2 in `PlayerProgress.test.ts` (summary, doubled full stop).
- **Verified**: 360, 390 and 412 px, light and dark, Chrome, no horizontal scroll, with players of 2, 18 and 60 readings and a 0-kills player (a synthetic series added to the local database only); WebKit at 390 dark. The three screenshots are replaced (same names, the seeded xCage, 18 readings).

## Merge with dev (2026-11-16)

- `dev` (v5.7.0 and later) merged in. The conflicts were additions on both sides: lib/copy.ts, the 17 `lib/i18n/<tag>.ts` and `.stamps.json`, and the glossaries kept both sides; CLAUDE.md, DESIGN.md, D68 and the decision index took `dev`'s text, which already says charts may also be HTML bars.
- `eventFit` (`lib/queries/history-readings.ts`) now includes `phaseSnapshot`. A sample (D69) has no member rows, so neither member history nor the daily progress chart reads one as a roster.
- `lib/copy.ts` passed the 300-line limit after the merge. The live event keys (#307) moved to `lib/copy-live.ts` and are spread into `ledger`. The keys and the English are unchanged; the i18n check still reports all 17 languages up to date.
- `pnpm check` after the merge: 97 test files, 491 tests passed; i18n up to date.

https://github.com/daniro-san/LAPTracker/pull/288
