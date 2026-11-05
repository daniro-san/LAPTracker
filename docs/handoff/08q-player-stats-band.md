# 08q — Player page: stats band and alliance-style layout

Branch `session/08q-player-stats-band`, cut from `origin/dev` (1c4b02e). Closes issue #95. The `NN` is `08q` because the next free handoff after 08p is a letter; `09` is the playbook's dry run.

## Built
- `lib/queries/players.ts`: `PlayerHistory.current` gains `power`, `kills`, `lv`, `updatedAt` (the sighting's `source_updated_at`) and `isFresh`, all from the newest sighting that `sightingsOf` already returned. No schema change, no new query.
- `app/(pages)/players/[uid]/page.tsx`: new `Summary` band (Might · Kills · Sanctuary, one line `As of Oct 31, 14:00 server`, the stale mark only when the sighting was not fresh). The name now sits above the current alliance link (badge + `[TAG] Name`) in the identity row. `Timelines` renders only when the player has more than one name or alliance, since the identity row already names the current one. Order: breadcrumbs, identity row + Exact numbers, legend, timelines (if any), band, Across events.
- `lib/copy.ts`: `ledger.sanctuary`, `ledger.asOf`, `ledger.player` (the band's aria-label).
- `docs/DESIGN.md`: `player-summary` entry (variant of `alliance-summary`).
- Test: `lib/queries/players.test.ts`, one test: the figures come from the newest real-event sighting (After over Before) and a newer rehearsal row is ignored. The seed After row now has power 12 so the test can tell the phases apart.

## Decisions
- "Latest snapshot" = `playerHistory`'s newest sighting, which is `sightingsOf` under `chainEvent` (D28): real events and manual rounds set to "public in history"; rehearsals and admin-only manual rounds are out. Within one event the After wins over the Before (rows are ordered by phase). A Before-only sighting is shown as it is, with its own time.
- The time is `source_updated_at` (when the game's data was read), the same time the alliance page's column heads use, not the snapshot's start.
- No change line, no rank, no Details control on the band: the owner limited it to the three figures.
- The band is not in `/brand`: `alliance-summary` is not there either (it lives in DESIGN.md and as a page-local function). No new shared component was created.
- "Sanctuary" is the label from the issue and the owner's wording; `docs/GLOSSARY.md` has no entry for the level (history rows still say `Level`). The two words now name the same value on one page.

## Deviations
- "A player with no sighting yet gets the page as it is today without the band": today such a uid returns 404 (`playerHistory` is null without a sighting), so there is no such page and nothing was added.
- The legend's "Rounded" item (PR #93) is not in `origin/dev` yet. The page keeps the shared `<Legend />`, so the item appears here when #93 merges; nothing in this change touches it.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc clean; 136 tests passed, 1 skipped.
- Browser (in-app browser, `next dev` against the Neon database through the main checkout's `.env.local`, uid 340024664389, seed data) at 360 px, light only: `scrollWidth` = 360, band columns do not wrap, Exact numbers switches the band from `93.5M / 6.61M` to `93,503,733 / 6,610,598`. Interactive elements under 44 px: only the three date links of the history cards (25 px, their overlay covers the card, as in 07g).
- Not seen: 390 px and 1280 px, dark mode, a player with several alliances or names (the Timelines branch), a player whose sighting is stale (the mark), a Before-only sighting. Read from code only.

## Open issues
- **Egyption check (not fixed).** uid 17555587096 is in no fixture and in no table: all 1,934 uids in `fixtures/v1-*` and all 400 player rows of the ranks board are 12 digits (339,451,289,925 to 482,971,836,741), and no stored `member_snapshots` uid is below 100,000,000,000. "Egyption" in our data is uid 340024664389 (NSE), so the screenshot's player is a different uid or another server's player with the same name; the screenshot does not show our Egyption. What our data says about 340024664389: `/v1` member row 2026-11-04: power 93,041,595, kills 6,528,814; ranks board (pulled 16:41 UTC): power 91,882,716, kills 6,528,814 (kills match the 6.53M, power does not); stored rows are seed data (`Seed Saturday Event …`), latest After Oct 31: power 93,503,733, kills 6,610,598. The 99.7M the owner saw does not appear for this uid in any fixture; 99,791,491 is the board's rank-1 power, a different player. Cannot say why the Intel panel's 324.5M / 22.7M differs without that profile's uid and an upstream read; 324.5M is 3.5x our power and 22.7M is 3.4x our kills, which is no constant factor, so a different definition is possible but not shown by our data.
- The seed events are synthetic, so the band currently shows seed numbers locally; production shows the first real snapshot after Session 9.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high; this change adds no upstream call and no timing.
Owner must do first: merge this PR into `dev` (it needs no migration); merge #96 and #88 as already noted.
Plan change: none.
<adjustments>
- Session 9 step 3: also open `/players/<uid>` for one rehearsed member after the Before run is public in history (a rehearsal is not, so use a Saturday or a manual round set to "public in history"); the band should show that snapshot's time. A rehearsal alone leaves the band on the previous real event.
- If the owner still wants to settle the Intel-panel numbers, ask for the profile's uid first; our data does not contain 17555587096.
</adjustments>
