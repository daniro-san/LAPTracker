# 08zzzzp — Alliance standing against the server (#274)

## Built
- Section "Standing over time" on the alliance page (`/events/[id]/alliances/[unionId]`), after the members and before Across events (`app/_ui/Standing.tsx`).
- One sentence first: rank by might, places gained since the period's first day, might change, and the tracked alliances' total change.
- A list of the tracked alliances by rank on the newest complete daily read: a "Tracked alliances" row, then per alliance `#4 ▲2`, badge and name, might, change since the first day, and a sparkline of its rank. Cards below 640 px, one line from 640 px.
- The page's own alliance has a plum bar and tint; the viewer's alliance (`useMyAlliance`) is tinted and labelled "My alliance" (`MineMark` in `app/_ui/MyAlliance.tsx`).
- `app/_ui/charts/Sparkline.tsx`: hand-built SVG, shapes only, rank 1 at the top.
- Ranks of every day under Details, one row per alliance.
- `lib/standing.ts` (pure arithmetic), `lib/queries/standing.ts` (`allianceStanding`), `dailyAlliances` extracted from `powerBalance` in `lib/queries/balance.ts` so both use one read.
- `lib/copy-standing.ts` (`copy.standing`), 13 keys translated into 17 languages and stamped.
- `docs/decisions/D90-alliance-standing-against-the-server.md` and its line in the README.
- Tests: `lib/standing.test.ts` (rank permutation, rank and growth example, gap day, 7-day window, fewer than two days, server growth between the least and greatest alliance growth), `lib/queries/standing.test.ts` (stale day skipped, ranks and moves).
- Screenshots: `docs/screenshots/08zzzzp-standing-360-light.png`, `-360-dark.png`, `-1280-light.png`, `-360-long.png` (a 78-character name without spaces).

## Decisions
- Period: the complete days in the 7 days before the newest complete day. The first of them is the base of every change. The sentence and the rows name that date instead of saying "7 days", because a gap day moves the base.
- No From/To choice: the issue says "if you add a choice"; none was added.
- Equal might is ranked by union id, so ranks are always a permutation of 1..n.
- Growth is shown without colour; the rank move uses the existing `Rank` component (arrow, number, colour).
- The server is the sum of the listed alliances' might on the same days, labelled "Tracked alliances" and said in the help line to be the tracked alliances' total.
- The section loads its own read (`AllianceStanding`), apart from the page's `loadAlliance`, so the page's `<title>` does not wait for it, and the page file stays under the max-lines limits.
- Assumption: "alliance page" is `/events/[id]/alliances/[unionId]`, the page that carries the alliance's summary.

## Deviations
- The orchestrator pushes; this session made local commits only.
- Translators reported glossary rows; `prettier --write lib/i18n` was needed after them. Three translations were corrected by hand: uk and ja `thisAlliance` read "my alliance", vi `server` read "Server".

## Verified
- `pnpm check`: prettier, eslint, tsc, vitest, check-drift and i18n all green; i18n reports 17 languages up to date.
- Looked at the page locally (seeded data: 12 daily reads, 20 alliances) at 360 px light and dark and 1280 px light: no horizontal scroll at 360, 1280, or with a long name. The sticky header covers part of the element screenshots; it is not a layout fault.
- Not checked: touch-target height of the list rows by measurement (the rows are not links or buttons; the only control is the Details summary, `min-h-11`).
- The seed's alliances all grow about 4.2 %, so the sparklines are nearly flat; the two moving rows (#6 and #7) show the shape.

## Open issues
- One alliance without a usable daily read for a week leaves no complete day, so the section says there are not enough reads. The listed alliances are those read in the last 90 days.
- Pre-existing: `lib/i18n/glossary/fr.md` and `uk.md` list their table twice.
- Plural forms: es "sube {n} puestos" reads wrong for 1; the key takes only `{n}`.
- Follow-up, not built: From/To period choice (D68 Interaction), a longer period, a standing for kills or members.
- `git status` of the main checkout could not be run from the sandbox; no file there changed in the last 90 minutes (`find -mmin`).

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep; no retry was needed beyond a max-lines fix.
Owner must do first: merge the PR; confirm that "since {first day}" instead of "7 days" is the wording wanted.
Plan changes needed: none.

<adjustments>
- `dailyAlliances(db, now)` in `lib/queries/balance.ts` returns every usable daily roster of the last 90 days with totals only; use it for any new cross-alliance, per-day figure.
- `lib/standing.ts` `standing(rows)` takes those rows and returns the ranked list; a period choice would filter `rows` by day before the call.
- `Sparkline` takes `points` ({at: 0..1, rank}) and an accessible `label`.
</adjustments>
