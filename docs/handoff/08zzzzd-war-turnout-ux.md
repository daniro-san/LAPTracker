# 08zzzzd — War turnout: UX review fixes

Refs #271 — UX review fixes.

## Built
- **Overflow**: the list root of each `BarList` has `min-w-0`. With a 7-character tag and a 24-character name the section's right edge was 401 px at 360 px without it and 344 px with it (measured in Chrome, every row shown).
- **Titles** (`lib/copy.ts`, all 17 languages): `ledger.fought` is "War turnout"; the first list keeps "Members with kills gained"; the second is "Kills from the top 5 members" with one definition line under it (`ledger.topShareHelp`: "Share of the alliance's kills made by its 5 biggest gainers. Higher means fewer players carried it.").
- **Second list**: alliances with at least 10 gainers come first, ranked by the share, each as `91% · 5 of 47` (`ledger.topBasis`, "{top} of {n}"; 5 is `TURNOUT_TOP`, 47 the alliance's gainers). Alliances under 10 gainers follow, muted (`text-ink/70`), as `100% · few gainers` (`ledger.fewGainers`). The threshold is `TURNOUT_MIN_GAINERS = 10` in `lib/compute.ts`; the order is made in `memberTurnout` (`lib/queries/turnout.ts`), so `topShare` is now ordered ranked-first.
- **Length on mobile**: each list shows its first 5 rows and the viewer's own row wherever it is, the rest behind a "Show all (n)" button (`members.showAll`, the same button as `ShowFirst`). The viewer's row has the existing "My alliance" word (`ledger.myAlliance`) as a small yarn text line under the name, besides the colour.
- **Columns**: two columns from `lg:` (1024 px) instead of `sm:`.
- **Tests**: `app/_ui/WhoFought.test.ts` (min-w-0 and `lg:` grid; 5 rows and Show all; basis and "few gainers" muted) and one in `lib/queries/turnout.test.ts` (10 gainers or more ranked first).

## Decisions
- **The viewer's chip is `ledger.myAlliance` ("My alliance")**, not a new "Yours" key: it is the site's word for the same thing (alliance page checkbox, main page jump).
- **The chip is a line under the name**, not beside it: beside the name it left about 100 px for the name at 360 px.
- **The "Show all" list is expanded once and stays open**, as `ShowFirst` does; there is no "Show less".
- **Hidden rows are not in the DOM** (the component is a client component that slices a list it already holds); the full list is in the page data as before.
- **The percent keeps `shareText`'s whole number** (`91%` in English). The review's example writes `91 %`; the locale format is used, as in the first version.
- **"few gainers" shows no basis** (`100% · few gainers`): the count of gainers would not fit with the name at 360 px.
- **Translations**: 17 languages in six batches of at most 3 translators, the translator reading its keys from a JSON file instead of the prompt. For fr the translator kept the old `topShare` ("Part des Kills du Top 5"), so it was run again.

## Deviations
- None from the task. Not pushed and no PR opened (the worktree sandbox blocks `git push`); the orchestrator does it. The PR URL line is left out.

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest, drift and i18n ("17 languages up to date with English") green.
- Local run (local Postgres, no upstream call, `pnpm dev:local`): the seeded event 3 with SQL on the local database only: different shares of gainers per alliance, one alliance with 7 gainers and one with 3, and one alliance named `TmSLONG` / `Ünbelievably Long Allianz Nam`. "My alliance" set to an alliance outside both top 5.
- Chrome, light and dark, at 360, 390, 412, 640 and 1280 px: the section fits (right edge 344 px at 360, 396 px at 412). 640 px shows one column of full-width rows (no truncated names); 1280 px shows two columns. WebKit at 390 px dark renders the same.
- Screenshots: `docs/screenshots/08zzzzd-war-turnout-360-light.png`, `docs/screenshots/08zzzzd-war-turnout-360-dark.png` (the viewer's alliance outside the top 5 of both lists, the second list's "few gainers" row muted).

## Open issues
1. **The page itself still scrolls sideways at 360 to 412 px with that long alliance name** (`scrollWidth` 424): the alliance ledger list of the event page (`A.tint-button flex min-h-11 items-center gap-2 py-1` with a `flex min-w-0 flex-1 flex-wrap justify-between` span and a `ml-auto` figure) overflows. This is not this section and was not changed.
2. **The "few gainers" cut-off of 10 is a fixed number.** Alliances of 10 to 20 members rank by a share that is high by arithmetic; the owner may want a share of the alliance instead.
3. **A member who moved alliance** and the double read of member rows (Movers and turnout) from the first version are unchanged.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after Session 10; follow-up #276 (the Discord End picture may carry these figures).
Model / effort: keep. No signal that this work needed more; one translator needed a rerun.
Owner must do first: merge this PR into `dev`; decide on open issue 1 (a separate fix for the alliance ledger row).
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md`.

<adjustments>
- `memberTurnout().topShare` is ordered: alliances with at least `TURNOUT_MIN_GAINERS` (10) gainers first, then the rest, each by the share. Reuse that order for #276 and show only the first part if the picture ranks.
- The section's title is now "War turnout" (`ledger.fought`); #276's copy is English only (D48) and should use that word.
</adjustments>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Review fixes (2026-11-16)

- The row selection of a list is the pure `visibleEntries` in `app/_ui/WhoFought.tsx` (tested), and the "Show all (n)" button is the shared `ShowAllButton` in `app/_ui/ShowFirst.tsx`, used by `ShowFirst` and `WhoFought`; rendered output is unchanged.

https://github.com/daniro-san/LAPTracker/pull/309
