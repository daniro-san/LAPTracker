# 08zzzzq — Member flow and standing follow-ups (D89, D90)

## Built
- Member flow: `small` reads "Counts under {min} members, stays included, are hidden and left out of every total, so this page does not single out small groups."; `totals` reads "Moves of {min} or more · Changed alliance: {moved} · New: {arrived} · Left: {left}" (`min: FLOW_MIN` filled in `app/_ui/FlowView.tsx`); the "Not counted" line renders directly under the totals line, before the matrix and the phone list.
- Standing: `lead` reads "{label} was {rank} by might on {to} and {before} on {from}."; keys `up`, `down`, `held` and `moveText` removed; new key `notRanked` ("Not ranked, no usable daily read in this period: {list}.") rendered under the list.
- `lib/standing.ts`: the period is the 7 days up to the newest day with any usable read; listed alliances are those read in it; `Standing.notRanked` names alliances read in the 90 days but not in the window. `lib/queries/standing.ts` comment updated.
- One test in `lib/standing.test.ts` for the window rule.
- 17 translations (`lib/i18n/*.ts`) for `flow.totals`, `flow.small`, `standing.lead`, `standing.notRanked`; `up`, `down`, `held` removed; stamps updated. No glossary rows added.
- D89 and D90 amended.

## Decisions
- Basis: owner delegated, persona panel and adversarial review agreed (2026-11-17).
- Stays under 5 stay hidden: no behaviour change.
- The day pickers keep every day with a usable read: production had no partial days.
- The "Not counted" line sits inside `Lead`, after the totals paragraph, so it is above the "Counts under…" note, the matrix and the phone list.
- Translations written by hand by the session, no subagents, reusing each language's existing terms.

## Deviations
- None.

## Verified
- `pnpm check` (see the commit report for the summary lines).
- `scripts/i18n-check.ts` before stamping listed only the four changed keys as stale in all 17 languages; after `--stamp` it reports all up to date.

## Open issues
- When the newest day has only some alliances read, the period still ends on the last complete day, which can be earlier than the newest read.
- Translations were not reviewed by native speakers.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md` after Session 10.
Model / effort: keep. The work was routine.
Owner must do first: nothing.
Plan changes needed: none to `docs/IMPLEMENTATION_PLAN.md` or `docs/SESSION_PLAYBOOK.md`.

<adjustments>
- `Standing` now carries `notRanked`; any code that builds a `Standing` by hand must set it.
- `copy.standing.up`, `down`, `held` no longer exist.
</adjustments>

## UX review (2026-11-17)
Local seed data. Two local edits to daily reads: one alliance (PSY) had every read from Oct 23 deleted (not ranked), one (TRI) had its Oct 23 read deleted (not counted on the flow from Oct 23 to Oct 30). No upstream call.

Measured, Chrome at 360, 390, 412, 600, 768, 820, 1024, 1280 in light and dark; German, Russian and pt-BR at 360:
- Page scroll width equals the viewport in all 38 runs on both pages.
- The new lines wrap without clipping in en, de, ru and pt-BR at 360. Controls on the flow page: no target under 44 px except the skip link (hidden until focus). On the standing page the member and alliance links inside other sections measure 18 to 24 px; they are unchanged by this PR.
- Flow at 360, before: three grey paragraphs in a row (totals, not counted, hidden-counts note), and the totals line broke as "Left:" / "5".
- Standing lead with two ranks and two dates reads clearly in en, de, ru, pt-BR; the "Not ranked" line is neutral and sits under the list and its Show all button, above Details.

Fixed:
- Flow: the totals line is now ink (not grey) with each "Label: n" kept on one line, so no break between a label and its number. The "Not counted" line and the "Counts under…" note are one group under the totals, with a left rule and tighter spacing: sentence, then figures, then qualifiers.
- Standing: 12 px of space above the "Not ranked" line (was 8 px).
- pt-BR `standing.notRanked`: "Sem posição" read as a position, now "Fora da classificação, sem leitura diária útil neste período: {list}."; `i18n-check` passes, stamps re-run (no stamp file changed).
- No English word was changed.

Left:
- When both ranks are equal the lead reads "was #1 … and #1 on Oct 25". It is correct and plain; no extra key was added.
- Standing page links inside other sections under 44 px: pre-existing, not in this PR.
- Not checked: WebKit, real devices.

Screenshots: `docs/screenshots/08zzzzq-flow-360-light.png`, `-flow-360-dark.png`, `-flow-1280.png`, `-standing-360-light.png`, `-standing-360-dark.png`, `-standing-1280.png`.

https://github.com/daniro-san/LAPTracker/pull/365
