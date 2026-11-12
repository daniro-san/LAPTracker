# 08zzzm — Admin on the phone: blank boxes, quota card, Log out position

Owner report, 2026-11-12, with five iPhone screenshots (Brave on iOS, dark theme, production v5.0.0). Problems:
1. Several controls were solid text-coloured boxes with no visible label or icon: the header logo link, search and theme buttons, Log out, the All / Events / Daily reads filters, and the closed manual round's summary.
2. "API calls left today: 954 · Not read today", though today's daily read had read the quota (982 before it).
3. Log out moved between the nav row and the candle's row as the candle's word changed ("Idle" / "Run in progress").

## Cause
1. Every blank control carries `.tint-button`. Its background was `linear-gradient(color-mix(in srgb, currentColor var(--tint), transparent), …)` with `--tint: 0%` at rest, which should be transparent. Controls with only the drawn frame (chips, Retry) were fine. Desktop Chrome and Playwright WebKit 27.2 both compute it as transparent and render it correctly, so the owner's iOS WebKit (Brave, possibly with its own night styling) is the likely place it went solid. I could not reproduce it here.
2. `latestQuota` read only `snapshots.quota_remaining_after`; the daily read's quota check (`daily_reads.quota_remaining_before`) was ignored.
3. The candle (`LiveNow`) and Log out were separate flex items in a wrapping nav.

## Built
- `app/globals.css` `.tint-button`:
  - `position: relative; isolation: isolate`.
  - The tint is an `::after` layer: `inset: 0`, `z-index: -1` (behind the content), `background-color: currentColor`, `opacity` 0 at rest, 0.1 on hover (`@media (hover: hover)` and `[data-state="hover"]`) and 0.2 on press.
  - No `color-mix`, no custom property, nothing painted at rest. `::before` stays free for the drawn frame; no `.tint-button` element uses `::after` otherwise (`ink-button` and `text-link-stretch` are never combined with it).
- `lib/queries/admin-page.ts`: `latestQuota` (moved from `lib/queries/admin.ts`, which was at its 300-line limit) returns the newest reading of a snapshot run's quota after it, or a daily read's quota check.
- `lib/copy-admin.ts`: the quota note says "Last read {at}" (it is not always "after the last run").
- `app/_ui/admin/AdminShell.tsx`: the candle and Log out are one right-aligned group, so they wrap together.
- `docs/DESIGN.md` "Hover and press": how the tint is drawn now, and why.

## Decisions
- The tint is rebuilt so that it no longer depends on how an engine resolves `color-mix(currentColor …)`, rather than patched for one browser version that could not be identified.
- Not changed, noted from the screenshots:
  - The short date "Thu 12 Nov" sits next to full stamps "Thu, 12/11/2026, 14:22 server time". The admin uses both forms elsewhere too.
  - "Running now: Nothing" next to a lit candle right after a press: the candle lights at the press (PR 242), and the Status card updates at the next refresh.
  - The runs help text "Daily roster reads keep no log" is replaced by PR 251.

## Deviations
- No committed test (CLAUDE.md: not asked).

## Verified
- Layout regression, Chrome at 360 px, light and dark, local Postgres with the seed. On `/`, `/players`, `/events/1`, `/alliances/67109944`, `/alliances/67109944/history`, `/compare`, `/admin`, `/admin/runs`, `/admin/errors` and `/brand`, the position and size of every `.tint-button` and every element inside one were recorded on `dev` and on this branch.
  - 342 controls in 20 page and theme combinations: identical, except Log out moving from x 16 to x 275 next to the candle (intended).
  - No horizontal overflow on any of them.
- Playwright WebKit 27.2, dark, 390 px:
  - Production renders without boxes, so the iOS bug did not reproduce here.
  - The fix renders the header controls, the filters, the candle and Log out with their labels and icons.
- Chrome and WebKit, `/brand` (states pinned with `data-state`): the `::after` opacity is 0 at rest, 0.1 hovered and 0.2 pressed, in the text colour.
- `/admin` with a daily read newer than the last snapshot: "970 of 1,000 · OK · Last read Thu, 11/12/2026, 17:11 server time", the daily read's quota check.
- `pnpm check`: prettier, eslint, typecheck, 257 tests passed (1 skipped), drift check, i18n. No upstream call; nothing written to Neon.

## Open issues
- Not confirmed on the owner's phone. After the release, open `/admin` and `/admin/runs` in Brave on iOS in the dark theme. If the boxes remain, try Safari, and Brave with its Night Mode off, to tell an engine bug from Brave's own styling.

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. The only rework was the 300-line limit in `lib/queries/admin.ts`.
Owner must do first: merge this PR and PR 251 into `dev`, then release (minor). Check the admin in Brave on iOS as above.
Plan changes needed: none.

<adjustments>
- `.tint-button` uses `::after` for its tint. Do not combine it with a class that needs `::after` (`ink-button`, `text-link-stretch`).
- Avoid `color-mix()` with `currentColor` in backgrounds: it was the one construct behind the blank boxes on iOS.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/252
