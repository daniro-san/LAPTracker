# 07f — Alliance page rework

Branch `session/07f-alliance-page`, cut from `origin/dev` at `2dcd4f0` (PR #32 and #35 already merged). The mock was built on a worktree branch cut from `session/07d-ui-fixes`, shown to the owner as screenshots, approved on 2026-11-05 with one correction (label the rank), then replayed onto `dev` as one commit.

Owner's request (2026-11-05): "the alliance detail screen could be much nicer and present information in a more efficient way"; "the filters on the alliance page could be better for UX as well, it works but it's not very intuitive".

## Built

Problems measured on the page before this change (local production build of `c0794ba`, alliance `/events/3/alliances/67110992`, 100 members):
- Page height 18,738 px at 360 and 390, 7,278 px at 1280; 100 full member cards; "Across events" under all of them.
- The totals card repeated the page title (badge and `[WACK] TheWackyOnes`), so the name appeared twice on the first screen; the first member started at y = 849 px.
- Filters needed English: "Min might" and "Max might" were free-text boxes that took `50M`-style input; sort was a `<select>`; "Highest first" was a button whose label showed the current state; nothing showed which filters were on or cleared them. Five controls in three rows at 360 px.

What changed:
- `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`: the totals `StatTable` card is replaced by `Summary`, one band: three columns Might · Kills · Members (label, value, change), then a row `RANK #5 =` (owner's correction: the word before the number), the stale mark and the same "Details ▾" `DetailTable`. "My alliance" moved beside "Exact numbers" at the right of the title row (one row of two toggles at 360 px). "Across events ↓" moved to the right of the "Members" heading.
- `app/_ui/MembersExplorer.tsx`: name search; sort chips `Might · ± Might · Kills · ± Kills · Level · A–Z` (`aria-pressed`; tap a chip to sort by it highest first, tap it again to flip; the active chip is plum-filled with `↓`/`↑` and has "Highest first" / "Lowest first" as screen-reader text; one horizontally scrolling row below 640 px); one might range with two thumbs whose stops are the roster's distinct might values, with the span shown above it; a framed `✕` chip per active filter that clears it, and "Clear all" when two are on; the first 20 members in the current order, then "Show all (n)".
- `app/_ui/member-views.ts`: `MemberView` moved here from the client component; the filter and sort rules (`mightSteps`, `filterMembers`, `change`) moved here as pure functions. `parseMight` is gone (no free-text might input left).
- `app/_ui/member-views.test.ts`: two tests (range on the roster's own values; sort by change with members without one last, direction flip, name search).
- `app/globals.css`: `.range-pair` (two native range inputs over one track, 44 px tall, taps pass through except on the thumbs; token colours only).
- `lib/copy.ts` `copy.members`: removed `min`, `max`; added `byName`, `low`, `high`, `clear`, `clearAll`, `showAll`; `mightChange` / `killsChange` now read `± Might` / `± Kills`.
- `docs/DESIGN.md`: component lines `alliance-summary` and `member-filter` added; `my-alliance` updated for its new place.
- Screenshots: `docs/screenshots/07f-alliance-{360,390,1280}-{light,dark}.png` (first screen), `07f-alliance-filters-{360,1280}-{light,dark}.png` (search "a", range 32.9M–98.8M, sorted by ± Kills), `07f-alliance-360-light-full.png`, `07f-alliance-before-360-light.png`.

## Decisions

- Sort chips instead of tappable column heads: the cards below 640 px have no column heads, so one chip row serves every width, and `StatTable` (shared with the player-page session) stays untouched.
- `± Might` / `± Kills` for the change sorts: the game's own word plus a sign, no extra English. `A–Z` for name.
- The might range steps through the roster's distinct values, not a linear scale: with 9.5M–98.8M and most members under 40M, a linear slider would put most of the roster in the first fifth of the track.
- 20 members by default. The filters and sort apply to the whole roster before the cut, so "top 20 by ± Kills" is the real top 20.
- The summary rank is the ledger rank by might (`ranks.might`), the same number the main page's `#n` shows; the server rank stays in Details as `Ranking`.

## Deviations

- Shared component touched: `Delta` in `app/_ui/Num.tsx`. The percent is now its own nowrap span after the change, so `(+2.0%)` can wrap under `▲ +72.9M` in a 104 px summary column; arrow, sign and number still stay on one line (07c S10). Page heights of `/` (5,430 / 5,304 / 2,930 px) and the player page (1,469 / 1,417 / 997 px) at 360 / 390 / 1280 are identical before and after. Left a note for the player-page session in the shared notes folder.
- `dev` already has `docs/handoff/07f-discord-templates.md` from the Discord session; this file keeps the name the task gave it, so two handoffs share "07f".

## Verified

- `pnpm check` on the `dev`-based branch → prettier, eslint, `tsc --noEmit` clean; `Test Files 25 passed | 1 skipped (26)`, `Tests 98 passed | 1 skipped (99)` (`dev` before this change: 96 passed; +2 member-views).
- `pnpm build` → compiled, all routes listed.
- Playwright + axe-core 4.x, Chrome 157, local production builds against the Neon preview branch: before (`c0794ba`, :3201) and after (this branch, :3202), alliance page at 360 / 390 / 1280 × light / dark:

  | | Height | First member y | Member cards | Overflow | Targets < 44 px | axe |
  | --- | --- | --- | --- | --- | --- | --- |
  | 360 / 390, before | 18,738 px | 849 px | 100 | 0 | 0 | 0 |
  | 360 / 390, after | 5,222 px | 785 px | 20 | 0 | 0 | 0 |
  | 1280, before | 7,278 px | 607 px | 100 | 0 | 0 | 0 |
  | 1280, after | 2,489 px | 643 px | 20 | 0 | 0 | 0 |

  Targets are measured on the element that takes the tap: a card's stretched name link counts as the card, a checkbox as its framed label. `/` and the player page: axe 0, overflow 0 in all six runs after the change.
- Filter flow (script): type "a", move the low thumb 40 steps, tap `± Kills` → `Might 32.9M – 98.8M`, count `37 / 100`, first three Dayopta, Zuki-bear, JA¥; "Show all" → 37 cards; "Clear all" → range back to `9.47M – 98.8M`.
- Lighthouse mobile, fresh Chrome per run (perf / a11y / bp / seo, LCP, KiB), alliance page, two runs each:

  | | Run 1 | Run 2 |
  | --- | --- | --- |
  | Before | 97 / 100 / 100 / 100, 1.1 s, 775 | 95 / 100 / 100 / 100, 1.0 s, 775 |
  | After | 98 / 100 / 100 / 100, 1.0 s, 762 | 99 / 100 / 100 / 100, 1.0 s, 762 |

- Not verified: Firefox (the `::-moz-range-thumb` rules are untested); a real touch device for the two-thumb range; blank-dictionary mode; the Vercel preview (no share link).

## Open issues

- Page weight barely moves (775 → 762 KiB): all 100 members still ship in the client component's props; only the rendered cards drop to 20. Sending only the first 20 would need the filter to run on the server; not worth it at 100 members.
- The two range thumbs can sit on the same stop; the later-dragged one then sits on top. Both stay reachable by keyboard.
- "Exact numbers" and "My alliance" now share the right of the title row on the alliance page only; the main and player pages keep "Exact numbers" alone there.

## Next

Session: 8 — Deploy, GitHub Actions, env, webhooks
Model / effort: keep (sonnet · medium) — this session changed only the alliance page UI; nothing in it bears on deploy work.
Owner must do first: merge this PR into `dev`; PREREQUISITES.md §6 row "Session 8".
Plan changes needed: none for Session 8. IMPLEMENTATION_PLAN.md Phase 5c still describes min/max might inputs and a sort select on the alliance page; DESIGN.md (`alliance-summary`, `member-filter`) now carries the current rules.

<adjustments>
- The alliance page has no "Min might" / "Max might" inputs any more; if a check in Session 8 or 9 reads the alliance page, it shows 20 member cards and a "Show all (n)" button, not 100 cards.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/38
