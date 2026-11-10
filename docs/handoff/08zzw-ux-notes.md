# 08zzw: UX review notes N2 to N11 (#174)

Applies notes N2 to N11 of `docs/handoff/08zzu-ux-review.md`, all accepted by the owner on 2026-11-10 (N6 included; the 08zzv handoff had it as rejected). N1 was already resolved. Stacked on #211.

## Built

- **N2.** `app/_ui/ViewerSettings.tsx`: Dates is a native `select` like Language. Options: "Auto · Oct 31" (the locale's own sample), `31 Oct`, `Oct 31`, `31/10`, `31.10`, `2026-10-31`. Cookie `date` and its values are unchanged. The admin gear keeps Theme and Dates. DESIGN.md `viewer-settings`; D38 has a dated amendment line.
- **N3.** `app/_ui/Movers.tsx`: member lines show the place as a plain numeral (`1`, `2`) in the `LABEL` style; alliance lines keep `#n` and the move. DESIGN.md `movers`.
- **N4.** Home and End move to the first and last Movers tab (`tabAfter` in `Movers.tsx`; roving tabindex unchanged).
- **N5.** The player band says "Level" (`l.level`). `ledger.sanctuary` was read by nothing else, so it is removed from `lib/copy.ts`, the 17 dictionaries, the 17 stamp files and the 17 glossaries. DESIGN.md `player-summary`.
- **N6.** The player page's breadcrumbs end at the alliance (`Ledger › [OGs] OldGrandmas`); the last crumb and its `aria-current` are gone on that page only. The alliance page is unchanged. DESIGN.md `breadcrumbs` and Navigation.
- **N7.** `SiteHeader` renders "Skip to the ledger" first (`site.skip`), screen-reader only until focused, then at the header's top left in the soft drawn frame, 44 px tall. It targets `#main`; the nine public pages' `<main>` got `id="main"` and `scroll-mt-20`. The admin pages (`publicPage={false}`) have no skip link.
- **N8.** `compute.changeDifference(first, second)`; `EventCompare.tsx` shows a third line per alliance card and per member card, and under each column of the totals band. `CompareTotals` and `MemberCompareCard` moved to `app/_ui/CompareTotals.tsx` and `app/_ui/MemberCompare.tsx` (the file hit the 300-line lint limit). `compare.lead` gained "The last line is the second event's change minus the first's." DESIGN.md `event-compare`; D57 has a dated amendment line.
- **N9.** `SiteFooter`: the short line (`site.disclaimerShort`) and a 44 px `<details>` "More" (`site.disclaimerMore`) that opens `site.disclaimer`, same muted style. DESIGN.md Navigation and hierarchy.
- **N10.** `data-[mine]` is `bg-yarn/5` plus a 3 px inset yarn bar on the left edge. DESIGN.md `my-alliance`.
- **N11.** `scripts/seed.ts` takes `--with-states` (off by default; documented at the top of the script and in the `db:seed` row of CONTRIBUTING.md). The two events are built in `scripts/seed-states.ts`. `scripts/seed.test.ts` tests both flag states on PGlite.
- New public strings (`site.skip`, `site.disclaimerShort`, `site.disclaimerMore`, changed `compare.lead`) went through the translate-copy skill: 17 translators, stamped, `pnpm check` green.
- Screenshots: `docs/screenshots/08zzw-*` (12 files, 476 KB).

## Decisions

- **Seed README line.** README.md has no seed line; the `db:seed` line is in CONTRIBUTING.md, so the flag is documented there.
- **N7 target.** `main`, not the first ledger row, so one link works on every public page.
- **N8 percent base.** The base is the absolute value of the first event's change, so the percent carries the difference's own sign (`-100 → -40` reads `▲ +60 (+60%)`). Members has no percent, as in the cards.
- **N8 label.** The line is labelled with the existing `compare.versus` string ("Oct 31 vs Oct 24", the second event first), so no new string was needed for the label. Below 640 px the label is a row of its own above the three figures: in the head column it made the auto-width column wider and squeezed the figures. From 640 px the same words sit in the head column; there is no separate column head.
- **N8 members view.** The member cards got the same third line (Might, Kills) for consistency; the task named the alliance card and the totals band.
- **N10 tint.** `bg-yarn/5`, not the `/8` the task named: at `/8` the yarn delta is still 4.42:1 in light.
- **N11 running event.** Its After snapshot starts 30 s before the seed runs; the page counts a run as live for 150 s, so the "Updating now" chip shows for about two minutes after seeding. The empty event is dated seed time + 7 days at 12:00 UTC.

## Deviations

- One commit for N2 to N11 (they share `copy.ts`, DESIGN.md and the dictionaries), not one per note.
- N8 was not mocked as a separate image first. The card was built in the branch and captured (`08zzw-n8-compare-360-light.png`, `08zzw-n8-compare-1280-light.png`); there is no before capture of the card.
- No before/after pair for every note: the "before" figures come from the 08zzu review and the 08zzv handoff.
- N8 has no separate column head from 640 px (see Decisions).
- The 360 px captures cover light only, except N10 (light and dark).

## Verified

`pnpm check` green (prettier, eslint, tsc, vitest 245 passed and 1 skipped, drift, i18n 17 languages). Production build served on port 3177 with the main checkout's env file (copied, deleted afterwards, never printed); reads only, no upstream call, no `/api/quota`, no run button, no seed against Neon. Server stopped by port. Measurements with Playwright 1.58.2 on Chrome:

| Note | Result |
| --- | --- |
| N2 | 6 framed controls (was 11). Panel 381 px tall at 360 × 740, bottom edge at 433 px, no scrolling. The old height was not re-measured here: the review gave 497 px (and 441 px for the mock), and this panel is shorter than the mock. Escape closes it and focus returns to the Settings summary. Picking `2026-10-31` writes cookie `date=iso`; Auto removes it. |
| N3 | Member lines read `1`, `2` … , alliance lines `#1=`, `#3=`, `#2=`. |
| N4 | At 1280: End → Rank, Home → Might ▲, Right → Might ▼, Left twice from Might ▼ → Rank (wraps). |
| N5 | Band labels Might, Kills, Level; "Sanctuary" appears nowhere on the player page. |
| N6 | Crumbs `Ledger`, `[OGs] OldGrandmas`, 44 px each; 0 `aria-current` in the nav. |
| N7 | Tab stops to the first card on `/` at 360: 8 before (no skip link), 9 with the skip link as stop 1. Using it: Tab, Enter, then 4 Tabs (Compare, Exact numbers, jump link, first card). Focused link 118.8 × 44 px at x 12, y 8. |
| N8 | NSE, Oct 24 vs Oct 31: Might +86.1M then +85.8M, difference ▼ −264K (−0.3%); Kills +1.85M then +1.71M, ▼ −148K (−8.0%); Members = 0. Totals: Might ▼ −160M (−14.8%), Kills ▼ −2.18M (−22.2%), Members ▼ −2. Test: `changeDifference` in `lib/compute.test.ts`. |
| N9 | Footer 252 px closed, 316 px open at 360; summary 44 px; on the 404 page and the player page the Granny corner does not touch the text (`08zzw-n9-*`). |
| N10 | Contrast, every text pair on the tinted row, computed from the token values (paper over yarn at 5 %): light ink 13.00, ink/70 5.54, ink/65 4.76, yarn 4.60, seal 6.20, plum 10.65; dark ink 12.69, ink/70 6.85, ink/65 6.10, yarn 8.35, seal 4.84, plum 5.73. Before (15 %): light yarn 4.03, dark seal 3.95. At 8 %: light yarn 4.42 (fails). The bar's yarn on paper is 4.90 (light), 9.06 (dark). |
| N11 | Verified on PGlite: `scripts/seed.test.ts` seeds with the flag and reads back one event with no snapshots dated in the future and one event whose After is `running`; without the flag neither exists. The "Updating now" chip is tested in `app/_ui/Status.test.ts` (new test). The empty-ledger line (`emptyLine`) was already tested in `app/_ui/event-rows.test.ts`, so no test was added for it. |

- Not verified: Safari and Firefox, screen-reader speech of the skip link, the two seeded states in a browser (the seed was not run against any database here).

## Open issues

- N8 at 1280: the difference line's hairline is drawn per cell, so it shows as separate segments, and the head text sits about 3 px lower than the figures.
- The footer "More" text is a plain underlined `<summary>`; it has no Escape handling (the other disclosures use `Disclosure`).
- `site.skip` says "ledger" on every page, including the player page, as the owner worded it.
- 08zzv open issues that remain: the failed IMPA card's Members line wraps at 360; `PlayerAcrossEvents` Details has no row name; `docs/screenshots` is 105 MB in total.
- The seeded running event stops counting as live 150 s after the seed.

## Next

No session follows in `docs/SESSION_PLAYBOOK.md`. If there is a next one, it is the review of what these notes changed on the deployed preview.

Model / effort: keep (opus · medium). This session touched about 70 files, 60 of them the dictionaries, stamps and glossaries; the code changes were small and each was checked with one build.

Owner must do first:
1. Merge #211, then this PR, into `dev`.
2. To see the empty ledger and the "Updating now" chip on the preview, run `pnpm db:seed --reset --with-states` against the preview branch (the owner's command; it replaces the preview data with invented numbers). The chip shows for about two minutes after the seed.
3. Say whether the N8 difference line is wanted on the member cards too, and whether the compare page needs a column head from 640 px.

Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`. `docs/DESIGN.md` was edited here for the notes. The 08zzv plan change (§3.1, target event) is still open.

<adjustments>
- Any later session that prints a date list or settings group should reuse the `select` pattern in `ViewerSettings.tsx` (two selects now).
- Every public `<main>` has `id="main"`; a new public page must add it, or the skip link points nowhere.
- `EventCompare.tsx` exports `MUTED`, `NAME`, `CompareCard`, `dash`, `differenceCells` and `versus` for `MemberCompare.tsx` and `CompareTotals.tsx`.
- Skip: N1 (resolved), the `ledger.sanctuary` key (removed), the README seed line (it is in CONTRIBUTING.md).
</adjustments>

