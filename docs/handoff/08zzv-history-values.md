# 08zzv — Member history: each member's kills and might with the change (#210)

## Built
- `app/_ui/MemberHistoryBody.tsx`, `Changes`: each changed member's row now shows, in the Kills and Might columns, the value (`Num`) with the change under it (`Delta`, `stack`, base = value − change, so the percent shows). Column order is unchanged (Kills, Might).
- New local component `Figure` (value over change). `CHANGE_COLS` is one grid template used by the header row and every member row: `minmax(0,1fr)` for the name, 5 rem and 6 rem below 640 px, 8 rem and 8 rem from 640 px.
- `PLAYER` (the name link): `break-words` replaced by `[overflow-wrap:anywhere]`.
- Screenshots of an opened history card (NSE, the Oct 31 End card, Neon preview data): `docs/screenshots/08zzv-history-values-{360,1280}-{light,dark}.png`, plus `-360-light-longname.png` (a 57-character unbroken name and two long words) and `-360-light-exact.png` (Exact numbers on).

## Decisions
- Fixed column widths instead of `auto`. The old template sized the two number columns per row, so the header's columns did not line up with the rows'. Fixed tracks keep them aligned and leave the name the remaining width.
- `stack` is always on in the Delta: below 640 px the percent goes on its own line; from 640 px it stays on the change's line. The change line is `text-xs`.
- "Total" in the player's feedback is read as each member's own total (the issue's reading); no alliance-wide sum line.
- No new copy key; the headers reuse `copy.ledger.kills` and `copy.ledger.might`.
- A null `power` or `kills` shows `—` for the value and no percent (D15).

## Deviations
- The overflow-wrap change touches the shared `PLAYER` class, so the Joined, Left and Renamed name links also wrap anywhere now. Without it, an unbroken long name pushed the page to 437 px at 360 px (`break-words` does not shrink an `inline-flex` item's min-content). The same change fixes those groups; no other file uses the class.

## Verified
- `pnpm check` green (prettier, eslint, tsc, vitest, drift, i18n).
- Production build (`pnpm build`, `next start`) against the Neon preview branch through the main checkout's `.env.local` (symlinked, not committed). Playwright-core with system Chrome, CDP `Emulation` for the metrics and `prefers-color-scheme`, a new context and `Network.clearBrowserCookies` before each capture.
- `document.documentElement.scrollWidth` equals the viewport at 360 and 1280 px, light and dark, with the long name, and with Exact numbers on (13-digit values fit in 6 rem).
- No tests were added: the issue asks for none and the change has no logic beyond the base subtraction.

## Open issues
- At 1280 px the name column is far from the figures (the card is wide). Not changed.
- Overlap with `08zzu-ux-review.md`: none. S2 (Details column) and S6 (Details summaries) concern `StatTable`, not this list; S2 says `StatTable` "draws the alliance page members and history rows", which does not describe `Changes` (own grid). The fix session for #174 needs no change for this one.
- Not done: an alliance-wide total line on the card head (the issue calls it a separate idea).

## Next
Session: the fix session for the accepted UX findings of #174 (`session/<NN>-ux-fixes`); `docs/SESSION_PLAYBOOK.md` has no entry for it, so this repeats the shape of 08zzu's `## Next`.

Model / effort: keep (opus · medium). Nothing here changes the estimate: this session touched one component and no data path.

Owner must do first:
1. Merge this PR into `dev`.
2. Do the steps 08zzu lists (merge the brand fixes, mark each finding accept or reject).

Plan changes needed: none in `docs/IMPLEMENTATION_PLAN.md`. `docs/DESIGN.md` `member-history` could name the value-over-change cells; not edited here.

<adjustments>
- The history card's changed list now has its own grid (`CHANGE_COLS` in `app/_ui/MemberHistoryBody.tsx`). If S2 moves Details to a column in `StatTable`, leave this list alone.
- Name links on the history cards use `[overflow-wrap:anywhere]` now; skip any long-name fix for them.
</adjustments>
https://github.com/daniro-san/LAPTracker/pull/212
