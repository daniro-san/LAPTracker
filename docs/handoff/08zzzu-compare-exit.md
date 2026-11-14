# 08zzzu — "Stop comparing" on the compare page

## Built
- `StopCompareLink` in `app/_ui/ComparePicker.tsx`: "✕ Stop comparing", the same framed link as "⇄ Compare" (`CompareButton` became `ActionLink` with an icon and a label, used by both). It goes back to where the comparison started:
  - the player view (`&player=`): `/players/<uid>`;
  - an alliance's view (`&alliance=`): `/events/<B>/alliances/<id>`, or event A when B has no row for that alliance;
  - the alliance list: `/events/<B>`;
  - `/` when there is no event B (the "only one event" state).
- `/events/compare`: the title row's right side is now "Stop comparing" then Exact numbers, as the event and player pages put "Compare" beside Exact numbers.
- Copy: `compare.stop` "Stop comparing", translated into the 17 languages (translate-copy, one Haiku translator each, told it is the opposite of `compare.action`) and stamped.
- DESIGN.md: one sentence on the compare page.
- Screenshots: `docs/screenshots/08zzzu-compare-{list,player}-360-light.png`, `08zzzu-compare-alliance-360-dark.png`.

## Decisions
- "Stop comparing" goes to the page the comparison is about, not `history.back()`. A shared compare link has no history, and the destination is the page that holds the "⇄ Compare" that leads here. In an alliance's view it is that alliance's page, not the compare list, because the breadcrumb already links the list.
- A link, not a button: it navigates and works without JavaScript.

## Deviations
- None.

## Verified
- `pnpm check` green: prettier, eslint, tsc, vitest (266 passed, 1 skipped), drift, i18n (17 languages up to date; the stamps diff is `compare.stop` only).
- Local Postgres with the fixture seed + `next dev`, Playwright at 360 px:
  - list (`a=3&b=6`, light): link to `/events/6`;
  - alliance 67110584 (dark): link to `/events/6/alliances/67110584`, a 200 page (event 6 has that alliance's Before);
  - player 339451289925 (light): link to `/players/339451289925`.
  - Each link is 44 px tall, `scrollWidth` is 360 on each page, and clicking each one lands on its target.
- The longest translation is `id` "Berhenti membandingkan". The row wraps (`flex-wrap`), so it fits at 360 px.

## Open issues
- None.

## Next
Session: none queued in `docs/SESSION_PLAYBOOK.md`.
Model / effort: keep — no signal.
Owner must do first: merge this PR into `dev` and release (patch).
Plan changes needed: none.

<adjustments>
- `ActionLink({ href, icon, label })` in `app/_ui/ComparePicker.tsx` is the framed title-row link ("⇄ Compare", "✕ Stop comparing").
</adjustments>
