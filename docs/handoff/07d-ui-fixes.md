# 07d — UI review fixes

Branch `session/07d-ui-fixes`, cut from `origin/session/07c-ui-review` (the 07c report, its screenshots and the #25 token fix). The PR into `dev` therefore carries 07c's two commits as well.

## Built

Every Blocker and Should-fix of `docs/handoff/07c-ui-review.md` (owner accepted all), the trivial notes N1, N4 and N5, and the owner's mid-session requests that were small (listed last). "Before" numbers are from a local production build of `a2360a2` (07c head); "after" numbers are from a local production build of this branch. Both ran against the same Neon preview branch and seed.

| Finding | What changed | Evidence before → after |
| --- | --- | --- |
| B1 red status chip | `app/_ui/Status.tsx`: the "Last updated" chip is ink in every finished state (partial and failed included); a separate seal `○ n stale` sits beside it when rows are stale or failed. DESIGN.md `status-strip` changed in the same change set. | Chip colour on `/`: seal `#8c2f2f` → ink `rgb(30,26,31)` light, `rgb(234,223,203)` dark; the count `○ 1 stale` is seal. `07d-detail-status-390-{light,dark}.png`, blank tile `07d-blank-home-390-tile1.png`. |
| B2 Details panel | New `DetailTable` (`app/_ui/DetailLines.tsx`): one table per card. Rows Might · Kills · Members · Ranking; heads `Server time` · `10:00` · `→ 14:00` · `Change` · `Rank`. Numerals tabular, right-aligned; the kills note in seal under the change. Used on the main page, the alliance totals card, and (with the two event dates as heads) the history rows. DESIGN.md `details-table` added. | URSA at 390 px: three lists in a `sm:grid-cols-3`, `#4 → #4 =` three times → `MIGHT 3.81B 3.74B ▼ −71.3M #4 =`, `KILLS 30.6M 29.5M ▼ −1.03M −2 Members #4 =`, `MEMBERS 95 93 ▼ −2`, `RANKING #4 #4 =`. Table 332 px wide in a 332 px card (no overflow); `07d-details-{390,1280}-{light,dark}.png`. |
| S1 Before / After words | Public pages: the `B` box and the legend's "Before only" are gone. Every history row shows the time its figures are from (`Sat, Oct 31  14:00 server`; a before-fallback row reads `10:00`). `HistoryRow.updatedAt` added. The Details heads are the snapshot times. Admin: one pair of words, `Before snapshot` / `After snapshot` (`copy.admin.phase`), on every page, row, message and confirm. | Legend `▲ Up ▼ Down = Same # Rank ● Fresh ○ Stale B Before only` → `▲ Up ▼ Down = Same # Rank ○ Stale` (alliance and player pages). `Run BEFORE now` → seal `Before`, named "Before snapshot". |
| S2 "Fresh" on every row | `FreshDots` renders nothing when the data is fine; `○ Stale` / `✗ Failed` only. The legend lost `● Fresh`. | `● Fresh` occurrences on `/events/1`: 22 → 0. |
| S3a admin dates | Admin pages use the request clock: `Clock.stamp` → `Sat, 11/07/2026, 12:00 server` (en-US), `sáb., 07/11/2026, 12:00 server` (pt-BR); no UTC twin. `fri 20:00` → `every Friday, 20:00 server`; the rehearsal name `REHEARSAL 2026-…Z` → `[rehearsal] Fri, 10/30/2026, 14:30 server`; run rows show the event's date, not its name. `utcStamp` removed. | `/admin` text after unlock, in Verified. |
| S3b admin copy | Run states in the public words (`done`, `partly done`, `failed`, plus `running`; `app/_ui/admin/words.ts`); the intro is two lines (`Current event: …` and the two costs); verdict lines without code names (`data time moved forward for every alliance`, `calls used = quota drop`; `lib/rehearsal.ts` and its test). | `before: complete · due Oct 30 16:15 UTC` → `Before snapshot: done · due Fri, 10/30/2026, 14:15 server`. |
| S3c admin layout | `AdminShell` renders `SiteHeader` (lace, no event selector), the admin nav under it, and `SiteFooter`. The PIN gate is a card under the heading at ≥ 640 px and the bottom sheet below 640 px. Run / Rehearse are `SealButton`s. | Gate at 1280: sheet 1280 × 169 px pinned to the viewport bottom → 448 × 186 px card at y = 187, header present. Seals 96 × 96. `07d-admin-gate-*`, `07d-admin-{390,1280}-light.png`, `07d-admin-runs-*`. |
| S4 numbers without labels at ≥ 640 px | Metric labels `sm:sr-only` instead of `sm:hidden`; the header row no longer `aria-hidden`. | Accessibility tree of the first row at 1280: `4.37B +85.8M …` → `Might 4.37B +85.8M (+2.0%) Kills 61.8M … Members 98 0`. |
| S5 #25 contrast | Done in 07c; light screenshots re-taken with the new tokens. | axe-core 0 violations on 7 pages × 360/390/1280 × light/dark (42 runs) before and after. |
| S6 sheets as dialogs | `app/_ui/admin/sheet.ts`: both sheets are `<dialog>`. Confirm: `showModal()`, `role="alertdialog"` named by its question, focus starts on Cancel, Tab is trapped, Escape answers no, focus returns to the seal. PIN from an action: modal, Escape cancels. PIN gate: open, non-modal, named "Admin PIN", described by the prompt, field focused. | Confirm: focus stayed on the trigger, no Escape → `:modal` true, focus `Cancel`, after 3 Tabs still inside, Escape → 0 dialogs and focus back on `BEFORE`. "Go ahead" was never pressed. `07d-admin-confirm-390-light.png`. |
| S7 `lang` and titles | `<html lang>` from `pickLocale`. `generateMetadata` on `/`, `/events/[id]`, the alliance and player pages, sharing the page's load through React `cache` (one DB read per request). `global-error.tsx` keeps `lang="en"`: it renders outside the layout and its text is English only. | `pt-BR` → `lang="pt-BR"`, title `sáb., 31 de out. · OG's LAP Tracker`; `ru` → `ru`, `сб, 31 окт. · …`. `/events/1` → `Sat, Oct 17 · OG's LAP Tracker`; alliance → `[WACK] TheWackyOnes · Sat, Oct 31 · OG's LAP Tracker`; player → `Souldge · OG's LAP Tracker` (before: `OG's LAP Tracker` on all four). |
| S8 failed-after rank | `currentRank(pair, afterRan)`: once the after snapshot exists, an alliance it did not rank gets `#—` and sorts after the ranked rows; its before rank stays in Details. Test `app/_ui/event-rows.test.ts`. | `/events/1`: `#12 — [IMPA]` above `#12 ▲1 [PSY]` → `#12 ▲1 [PSY]` in place, `#— — [IMPA]` last. `07d-detail-impa-390-light.png`. |
| S9 tap widths | `min-w-11` on the header brand link and on breadcrumb links. | Brand link 40 × 44 → 44 × 44; crumb `Ledger` 41 × 44 → 46 × 44. Targets under 44 px over all 42 page runs: 26 → 0. |
| S10 note inside nowrap | `Delta`: only arrow, sign, number and percent stay on one line; the note may wrap. | No seed card shows the joined-and-left note, so this is checked in code only. |
| S11 image weight | `app/img/resize.tsx`: the image routes redraw PNG/JPEG with `next/og` (part of Next, no new dependency) to 80 px for badges and 112 px for photos, and serve the redrawn file only when it is smaller. Two tests in `app/img/badge/[id]/route.test.ts`. | Badge 300 × 300 33 KB → 80 × 80 7.7–7.8 KB. Lighthouse page weight (KiB): `/` 587 → 432, `/events/1` 590 → 434, alliance 852 → 775, player 416 → 362, search 344 → 346. |
| S12 word-only states | `+ Joined` in yarn, `− Left` in seal (`MembersExplorer`). Event selector: client `Disclosure` (Escape closes and refocuses the summary, an outside tap closes it), `aria-label="Events"`. The legend's word-only issue is mostly gone with S2. | Selector: open after Escape → `false`, focus `SUMMARY`; after an outside tap → `false`. |
| N1 | DESIGN.md language-light rules record the four game terms kept in blank mode. | — |
| N4 | DESIGN.md: "under 4 KB" means 4,096 bytes as rendered. | — |
| N5 | "Across events ↓" jump link beside the alliance page toggles. | — |

Owner's mid-session requests (2026-11-05), done here because they were small:
- Details heads in words (`Server time`, `Change`, `Rank`) and the server-rank row named `Ranking`.
- Breadcrumbs `text-sm` → `text-base`.
- "Exact numbers" at the right of the title row on every page (main, alliance, player). DESIGN.md `exact-toggle` updated.
- Player page: each alliance and its dates on one centred line.

Other files: `app/_ui/EventLead.tsx` (history row lead), `app/_ui/event-page.ts` (cached event load + title), `lib/schedule.ts` (`lastOccurrence` exported), `lib/queries/admin.ts` (`eventAtUtc` on runs and the rehearsal). Screenshots: `docs/screenshots/07d-*` (49 files, 4.1 MB): pages at 360/1280 in both modes, the evidence segments, admin, blank tiles.

## Decisions

- B1 shape: the time chip is always ink; the problem is a plain seal text mark `○ n stale`, not a second framed chip, so nothing on the strip looks like an alarm box.
- B2/S1: the Details change column has no percent (the card shows it) so the table fits 332 px. History rows show the data time on every row, not only on before-fallback rows; a time on only some rows would need a word to explain it.
- S4: kept the column header visible to screen readers as well as the per-cell labels; each value is read with its label.
- S6: native `<dialog>` instead of a hand-written focus trap. Initial focus is set after `showModal()` through `data-initial-focus`, because React's `autoFocus` runs before `showModal()` and loses to it (measured: "Go ahead" got focus).
- S3c: the admin seals show `Rehearse` / `Before` / `After`. "Before snapshot" overflowed the 96 px wax; the button's accessible name is the full phrase, which starts with the visible word.
- S11: the redrawn image is served only when it is smaller than the original. The first version always redrew, and photos (small JPEGs) grew from 5–9 KB to 28–40 KB as PNGs: the alliance page went 852 → 921 KiB.
- S7: `lang` follows the request locale as 07c asked. The page's words are English while numbers and dates follow the locale, so a screen reader set to pt-BR reads "Might" with a Portuguese voice. It reads numbers and dates correctly.

## Deviations

- The owner's share link was not in the prompt, so every page was measured on local production builds (base on :3101, this branch on :3102), not on the Vercel preview. Lighthouse numbers are therefore local (TTFB from this machine to Neon). The before and after numbers were measured on the same setup, so they compare.
- The owner's mid-session requests above are outside 07c's list.

## Verified

- `pnpm check` → prettier clean, eslint clean, `tsc --noEmit` clean, `Test Files 23 passed | 1 skipped (24)`, `Tests 85 passed | 1 skipped (86)` (82 before; +1 event-rows, +2 image route).
- `pnpm build` → compiled, all routes listed.
- Measurement script (Playwright + axe-core 4.14, Chrome 157): pages `/`, `/events/1`, the alliance page (`/events/3/alliances/67110992`), the player page (`/players/339985801541`), `/players?q=so`, `/nope`, `/brand` × 360/390/1280 × light/dark. Before: overflow 0, small targets 26 (brand link on 6 pages × 2 phone widths × 2 modes, plus `Ledger` crumb ×6 on the player page), axe 0. After: overflow 0, small targets 0, axe 0.
- Lighthouse mobile, fresh Chrome per run (perf / a11y / bp / seo, LCP, KiB):

  | Page | Before | After |
  | --- | --- | --- |
  | `/` | 97 / 100 / 100 / 100, 1.2 s, 587 | 98 / 100 / 100 / 100, 1.2 s, 432 |
  | `/events/1` | 98 / 100 / 100 / 100, 1.2 s, 590 | 98 / 100 / 100 / 100, 1.2 s, 434 |
  | alliance | 99 / 100 / 100 / 100, 1.1 s, 852 | 99 / 100 / 100 / 100, 1.0 s, 775 |
  | player | 100 / 100 / 100 / 100, 1.0 s, 416 | 100 / 100 / 100 / 100, 1.0 s, 362 |
  | search | 100 / 100 / 100 / 100, 1.0 s, 344 | 100 / 100 / 100 / 100, 1.0 s, 346 |

- `/admin` after unlock (en-US): `Next event Sat, 11/07/2026, 12:00 server | Before snapshot Sat, 11/07/2026, 10:00 server | After snapshot Sat, 11/07/2026, 14:00 server | Weekly API quota check every Friday, 20:00 server | Rehearsals (test runs) every Friday, 18:00 server · keeping the last 4 | Requests left today after the last run: 779 (Sat, 10/31/2026, 14:01 server) | Current event: Sat, 11/07/2026, 12:00 server | … | [rehearsal] Fri, 10/30/2026, 14:30 server | Before snapshot: done · due Fri, 10/30/2026, 14:15 server`. `/admin/runs`: `After snapshot · partly done Sat, 10/31/2026, 14:01 server · 21 calls · 779 requests left · 52.0 s`.
- PIN flow on the local build, PIN read from `.env.local` inside the script and never printed: one right PIN, no wrong attempt. No snapshot or rehearsal was started, and `/api/quota` was not called.
- Blank dictionary: `NEXT_PUBLIC_BLANK_COPY=1 next dev`; `07d-blank-{home,alliance,player}-390-tile*.png` (390 px, 2×, 1,300 px tiles; URSA's Details open on the home tiles). The three 7b tasks still read without words: NSE kills `▲ +1.71M (+2.8%)`; URSA the only `▼ −2 (−2.1%)` members; the time chip `Oct 31, 14:01` is ink with `○ 1` apart. The `AGENTS.md` that `next dev` writes was deleted.
- Not verified: S10 on a real card (no seed row has both joins and leaves); Firefox; the 500 page in a thrown render; the Vercel preview (no share link).

## Open issues

- Owner requests from this session not done here (each needs a mock and the owner's yes first):
  1. A loading state for player search, a drawn and animated grandma piece made with the `hand-drawn-svg` skill.
  2. The alliance page member filters (name, min/max might, sort) are hard to understand.
  3. The alliance page could present its information more efficiently (layout rework).
  4. The owner asked why the "Game board" section sits at the bottom of the main page. It is the game's own leaderboard (power and kills) from `lib/sources/internal.ts`, a cross-check that never feeds a change (plan Phase 5). Options: keep it, move it to `/admin`, or remove it. The owner decides.
- Discord admin messages (`lib/run.ts`, `lib/tick.ts`) still use `describeInstant` with `(14:00 UTC)` and `next BEFORE` / `next AFTER`. 07c scoped S3 to the admin pages; aligning the messages is a follow-up.
- `/events/1` shows `[OLD] Seed Former Name` with the sub-line `was [OLD] Seed Former Name`: the seed's name history makes the former name equal the current one on that event. This bug predates 7d and was not touched.
- The 07c `B2` hairline "a rule above" the Details table is the card's existing `border-t`; nothing added.

## Next

Session: 8 — Deploy, GitHub Actions, env, webhooks
Model / effort: keep (sonnet · medium) — no signal from this session about deploy work.
Owner must do first: merge `session/07c-ui-review` (if not merged) and this PR into `dev`; PREREQUISITES.md §6 row "Session 8".
Plan changes needed: none for Session 8. IMPLEMENTATION_PLAN.md Phase 5 still describes the `B` mark and the Before/After freshness lines; DESIGN.md now carries the 7d rules (not edited here).

<adjustments>
- The admin button is now the wax seal "Rehearse" (accessible name "Rehearse"), not "Rehearse now"; the snapshot seals read "Before" / "After" with the names "Before snapshot" / "After snapshot". Step 4's "tap Rehearse now" means this seal.
- Admin pages print dates in the viewer's locale and server time (`Sat, 11/07/2026, 12:00 server`), no UTC. Discord messages still print `… server (HH:MM UTC)` via `describeInstant`; compare against those, not the admin page, when checking `before_at` / `after_at` in UTC.
- Rehearsal verdict lines changed wording: `data time moved forward for every alliance (n/n)` and `calls used = quota drop (…)` (were `updated_at advanced …` and `calls_used = …`). The `[TEST]` admin messages show the new words.
- `/img/badge/*` and `/img/avatar/*` now redraw images through `next/og` on a cache miss. Badges are 80 × 80 PNG (≈ 7.8 KB); photos are redrawn only when that makes them smaller. Watch the first production cold requests for function duration if they look slow.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/32
