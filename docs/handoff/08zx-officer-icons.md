# 08zx — An icon per officer title

## Built
- `docs/brand/drawing/examples/ornaments.py`: `icon_diplomat` (dove), `icon_recruiter` (calling horn), `icon_militarist` (crossed swords), `icon_overseer` (eye), 16 px filled cuts like `icon_crown`. Also `hole()`, a clockwise cut-out for the nonzero fill, used by three of them.
- `docs/brand/drawing/build.py`: the four registered as `icon-diplomat`, `icon-recruiter`, `icon-militarist`, `icon-overseer`.
- `lib/brand/components/RoleMark.tsx`: components `Dove`, `Horn`, `Swords`, `Eye` (markup pasted from the build); `officerMark(title)` picks the drawing from the title text, with the stitch star for any other title; `RoleMark` uses it. The member list, Leadership cards and player page change through `RoleMark` only; their files are untouched.
- `lib/brand/components/RoleMark.test.ts`: one test for the mapping (four titles, the two in-game names, case and spacing, unknown title → star, untitled R4 → no role).
- `/brand`: the Drawing section's ornaments show the four drawings in one plate; the Components section's role mark lists Leader, the four titles and "Any other title" (`lib/copy-brand.ts`, `app/(pages)/brand/DrawingSection.tsx`, `ComponentsSection.tsx`).
- `docs/DESIGN.md` `role-mark`; `docs/DECISIONS.md` D50.
- `docs/screenshots/08zx-{leadership,members,player}-360-{light,dark}.png`.

## Decisions
- **Mapping by title text (D50).** The data has no slot id. Every R4 is `rank_code` 104; the title is only the text after `R4 · `. All 26 rosters in `fixtures/` use the same four names (Diplomat 26, Overseer 26, Militarist 25, Recruiter 25 rows), at most one of each per alliance. The match is trimmed, lower-cased and has inner spaces collapsed. A `Map` holds it, so a title such as "constructor" cannot hit an object prototype key.
- **Owner's set.** Set A (dove, crossed swords, eye) with the calling horn from set B for Recruiter, chosen by the owner from the preview sheets and in-app screenshots.
- **One tone.** All officers stay sage. Yarn and seal mean gain and loss and plum is the leader. Sage measured 4.88:1 on paper and 4.30:1 on its row tint (light), 6.88:1 and 5.93:1 (dark), above the 3:1 needed for a graphic.
- **/brand Drawing section:** one plate with the four drawings and one caption, not four plates. Four plates pushed `lib/copy-brand.ts` past the 300-line lint limit; one plate fits.

## Deviations
- None from the task. Assumption: "Goddess" and "God of War" are the in-game names of the Overseer and Militarist slots. The owner did not confirm which name replaces which, so `goddess` → eye and `god of war` → swords are aliases in `BY_TITLE`. The site sends neither name in any fixture.

## Verified
- `pnpm check` (Node 26.5.0): prettier, eslint, tsc clean; 39 files and 166 tests passed, 1 skipped (pre-existing); drift check clean.
- `python3 -I docs/brand/drawing/build.py <scratch>`: the four new SVGs are byte-identical to the approved preview files, 756–830 bytes each. The crown and star paths still match `RoleMark.tsx`.
- Browser, throwaway stack: Postgres 18 in the scratchpad (127.0.0.1:5561), the WebSocket bridge and preload from earlier sessions, `next dev -p 3191` under `env -i` with placeholder secrets and an unroutable upstream URL. Schema from `drizzle/*.sql` via psql, data from `scripts/seed.ts`. `rank_code` and `rank_label` were copied by uid from `fixtures/v1-20261104T155902Z` for OGs and URSA, event 3. In URSA, Overseer and Militarist were renamed to Goddess and God of War to test the aliases. Upstream API calls: 0. No Neon database touched.
- Playwright + system Chrome at 360 × 740, light and dark. Results:
  - OGs alliance page: 5 officer marks with 4 distinct drawings (the 4 cards and the Diplomat row in the list).
  - Player page (Recruiter): the horn beside "Recruiter".
  - `/brand`: the role-mark rows render dove, horn, swords, eye and the star for "Any other title".
  - `scrollWidth − innerWidth` = 0 on all three pages.
  - Avatar and badge images were stubbed with a transparent PNG, so the photo frames in the screenshots are empty.
- Phase 1 checks (preview sheet, not committed): the four drawings and the crown read as different shapes at 16 and 12 px, and in greyscale.

## Open issues
- **"Goddess" / "God of War" mapping not confirmed.** If the game's Goddess is not the Overseer slot (or God of War not Militarist), swap the two lines in `BY_TITLE`. Either way, the site sends the default names, so OGs pages show the eye and the swords.
- **Titles can be missing from a roster.** The internal-source probe of OGs at 2026-11-04 15:30Z (`fixtures/probe-67111155-20261104T153003Z`) had all 8 R4 as plain `R4`. The 15:34Z probe had the titles again. A roster read at such a moment shows no officer marks. That was already true before this change.
- The Next.js dev "N" badge shows in the screenshots (top left of the first card); it is not part of the page.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change is presentation only: no query, collector, cron or quota code.
Owner must do first: merge this PR into `dev`. No migration, no environment variable.
Plan changes needed: none.

<adjustments>
- Session 9 step 3: when checking the Leadership section after the first real snapshot, each titled R4 should show its own drawing (Diplomat dove, Recruiter horn, Militarist swords, Overseer eye). A star on an officer means the site sent a title text other than those four; record the exact `rank_label`, because D50 maps by text.
- Ask the owner which in-game title is "Goddess" and which is "God of War" while comparing with the in-game alliance screen; if they are not Overseer and Militarist, swap the two alias lines in `lib/brand/components/RoleMark.tsx` `BY_TITLE`.
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/139
