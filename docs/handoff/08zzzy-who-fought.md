# 08zzzy — Event page: who fought (#271)

Closes #271.

## Built
- **Arithmetic** (`killsTurnout` in `lib/compute.ts`, with `TURNOUT_TOP = 5`): for the members in both rosters of one alliance (matched by uid) it returns `n`, `gainers` (kills rose), `gained` (the kills those members gained together) and `top` (the 5 biggest gains together). A kills value of null counts as 0 (D15). A fall in kills is not a gain.
- **Read model** (`memberTurnout` in `lib/queries/turnout.ts`, exported from `lib/queries/index.ts`, called by `getEventPage` as `page.turnout`):
  - reads, per member, uid and kills only, and per alliance tag, name and badge; nothing per member is returned;
  - an alliance gets a figure only when its Start and End rows are both fresh and not failed (INVARIANT freshness.no-stale-delta) and at least one member is in both rosters;
  - returns two lists: `withKills` (by gainers ÷ n) and `topShare` (by top ÷ gained, only alliances that gained kills); equal figures: larger n first, then lower union id;
  - returns null until both snapshots exist and when no alliance gained kills.
- **Section** (`app/_ui/WhoFought.tsx`, rendered by `EventView` after Movers, only when `turnout` is not null):
  - title "Who fought", one help line, one framed card with two lists, side by side from 640 px;
  - first list "Members with kills gained", rows `54% · 54/100`; second list "Top 5's share of kills", rows `44%`;
  - each row is a link to the alliance's event page, at least 44 px tall (measured 52 px at 360 px), with the badge, `[TAG] Name` (truncated), the figure as text and a bar of two nested `div`s (`ink/60` on `rule`; no SVG, no library);
  - the viewer's alliance (`lap.myAlliance`) gets the ledger's highlight (`yarn/5` background, 3 px yarn edge) and a yarn bar; every other row is neutral;
  - `useMyAlliance()` added to `app/_ui/MyAlliance.tsx` (reads the stored choice after mount); `shareText` added to `app/_ui/format.ts` (whole percent, locale-aware).
- **Copy**: `ledger.fought`, `ledger.foughtHelp`, `ledger.withKills`, `ledger.topShare` in the `ledger` block of `lib/copy.ts`, right after `movers`; translated into the 17 languages with the translate-copy skill (6 batches of at most 3 translators), stamped; glossaries extended by the translators.
- **Screenshots**: `docs/screenshots/08zzzy-who-fought-360-light.png` (first list, viewer's alliance TmS highlighted), `docs/screenshots/08zzzy-who-fought-concentration-360-dark.png` (second list).

## Decisions
- **Top 5's share = top 5 gains ÷ sum of all gains of members in both rosters.** It is not divided by the alliance's total kills change, which also holds joiners and leavers. Result is at most 100 %.
- **Ordering by the exact ratio, not the rounded percent.**
- **Percent is a whole number** (`Intl`, locale format: `54%` in English), not the one-decimal percent of the deltas. The issue writes `54 %`; the space is a French-style spelling and the locale format was kept.
- **An alliance with no kills gained appears in the first list (0 %) and not in the second** (no total to divide).
- **Section title "Who fought" taken from the issue.** The persona panel asked that wording never say "fought / didn't fight" about people. The title is about alliances and the list labels say "Members with kills gained". The owner may want a title without the verb; it is one string, `ledger.fought`, plus the translations.
- **Bar scale is 0 to 100 %** in both lists, so bars compare across alliances and lists.
- **No n on the second list** (spec: `44 %` only).
- **No jump link and no id on the section** (not asked).

## Deviations
- None from the task. `pnpm check` forced two small changes: a comment without `#271` in `app/_ui` (the token test reads `#271` as a colour literal) and comparator parameters not named `x`/`y` in `lib/queries` (the blocked-keys test reads them as roster keys).
- Not pushed and no PR opened, on the coordinator's instruction (the sandbox blocks `git push`); the orchestrator pushes and opens the PR. The PR URL line is left out.

## Verified
- Tests (PGlite, one per behaviour) in `lib/queries/turnout.test.ts`: kills rose vs held; a member in one roster only is not counted; a stale End side, and a side with no members, give no figure; top-5 share with 7 and with 3 members (fewer than 5 gainers) and the order of both lists, with no blocked roster key in the result; null when nobody gained. Two tests for `killsTurnout` in `lib/compute.test.ts` (counts and top 5, nulls and falls).
- `pnpm check` green: prettier, eslint, tsc, vitest (59 files passed, 1 skipped; 274 tests passed, 1 skipped), drift ("Everything's fine"), i18n ("17 languages up to date with English").
- Local run, no upstream call: local Postgres (D47), `pnpm db:local:seed`, then one SQL update on the local database that holds a varying share of End kills at the Start value (screenshot data only), `pnpm dev:local`, Chrome at 360 px:
  - the section shows 19 rows in each list (the alliances with a figure), first list from 100 % · 101/101 down, second list from 91 %;
  - `scrollWidth` 360, smallest row 52 px;
  - light with the viewer's alliance set: TmS row has the yarn edge, background and bar; dark: same, other bars neutral.
- Not run: the section from 640 px in a browser (the two-column grid is the Movers card's own pattern).

## Open issues
1. **`memberTurnout` and `memberMovers` read the same member rows twice** per page load (about 2 × 2,000 rows). Merging them into one read is a follow-up if page time matters.
2. **A member who switched alliance during the event is in neither alliance's figure** (matched by uid inside one alliance). Movers count a switcher under the After alliance.
3. **DESIGN.md "Navigation and hierarchy" still says the main page ends with Movers.** D53 amended that once for Movers; this section follows it. DESIGN.md was not edited.
4. **Dev-only:** the Next dev overlay badge covers the bottom-left of full-height screenshots; it was removed from the screenshots.
5. Pre-existing, not touched: none found.

## Next
Session: #276, the Discord End picture may carry this section's figures (a short top list per figure).
Model / effort: keep. The figures are already computed by one read model; the task is layout of an image.
Owner must do first: merge this PR into `dev`; decide whether the title "Who fought" stays (Decisions 5).
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md`; DESIGN.md "Navigation and hierarchy" needs the line about the new section after Movers (Open issues 3).

<adjustments>
- `memberTurnout(db, detail.snapshots)` in `lib/queries/turnout.ts` returns `{ withKills, topShare }` or null; each row is `{ unionId, tag, name, badgeId, n, gainers, gained, top }`. Share = `gainers / n` and `top / gained`. Reuse it; do not recompute in `lib/event-image.tsx` or `lib/notify.ts`.
- Discord copy is English only (D48): put the words in `lib/copy-discord.ts`, not in `lib/copy.ts`.
- Prompt sketch for #276: "Add the two figures to the Discord End picture. Read `memberTurnout` for the event's snapshots, show the top 3 alliances of each list as `[TAG] 54% · 54/100` and `[TAG] 98%`, no member names, hide the block when it returns null. Draw it with the picture's existing rows (`lib/event-image.tsx`); words in `lib/copy-discord.ts`; test the null case and one list."
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/278
