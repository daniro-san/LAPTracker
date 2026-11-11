## D33 — A `*` on a falling total whose members left, with one legend item (2026-11-05)

Why: an alliance's Kills (and Might) total is the sum of its members, so it falls when members leave. A tester read that as a bug. The note "−N Members" already sits in Details, but a note on the Kills row was read as a kills figure (7b), so the row itself needs something smaller than words.

- **Mark.** `*` after the change (`▼ −3.2M (−0.4%) *`), when the delta is negative and at least one member left (`fellWithLeavers`, `app/_ui/event-rows.ts`). It applies to Might as well as Kills: the cause is the same and the check is the same function. "Includes member changes" stays true when the fall is partly something else.
- **Not `±`.** `±` already means "change" on the site (`± Kills` sort chips) and beside a number reads as a margin of error. The asterisk is the language-free footnote sign.
- **Legend.** One item, `* Includes member changes`, shown only when the page has at least one mark (`Legend memberMark`). Event page and alliance page; the player page has no alliance totals. Nothing hover-only: the legend is always visible; the mark carries the same words as screen-reader text.
- **Details unchanged.** The "−N Members" note stays in Details. No number is computed differently.
- **Alliance page leavers.** Counted from the two rosters (status `left`) only when both exist, the same rule as the member list (D32).
