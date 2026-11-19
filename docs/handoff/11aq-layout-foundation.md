# 11aq — Layout foundation (issue 412, rollout PR 1 of D122)

## Built

- **Tokens** (`lib/brand/tokens.css`):
  - `--page-max` 1200, `--legacy-max` 960, `--measure` 65ch, `--form-max` 560, `--rail` 88, `--sidebar` 224, `--card-min` 18rem;
  - the `wide` breakpoint, `--breakpoint-wide: 90rem` (1440). Tailwind's `xl` stays at its default of 1280.
- **The 11 layout components** in `lib/brand/components/layout/`:
  - `AppShell`, `NavRail`, `NavSidebar`, `PageHead`, `MoreMenu` (client), `Spread`, `MarginNote`, `CardGrid`, `MasterDetail`, `ResponsiveTable`, `Measure`;
  - the pure rules in `layout-rules.ts`: `cellClass` (column priority), `splitActions` (the phone's main action and More) and `sidebarEntries` (the sidebar's rows and marks).
  - `.margin-note` in `app/globals.css` gives a margin note the drawn card frame below 1024.
- **Desk frame on AppShell.**
  - `app/(private)/_ui/Frame.tsx` now renders through `AppShell` with `legacyWidth`, so every desk page keeps its 960 px content.
  - Below 768 the bottom tabs are unchanged. From 768 to 1279 the rail shows. From 1280 the sidebar shows, with the views (Former members; Caravans, Notices, Thefts) and "See what members see" at the end.
  - The bar's content lines up with the content column.
  - The tabs, the nav items and the Home badge moved to the new `app/(private)/_ui/DeskNav.tsx` (Frame was over the 300-line cap).
- **Pages name their open view through `current`.**
  - `SignedInFrame`'s `current` also takes a view (`"former"`, `"caravans"`, `"notices"`, `"thefts"`), which opens its destination and marks the view on the sidebar.
  - Six pages pass it: Members (former), Caravans, Notices (list, new, one notice, pictures) and Thefts.
  - Members got a file-local `plainSearch` to stay under the 80-line function cap.
- **From 1280 the in-page view switches are hidden** (`xl:hidden` on `CalendarNav` and the Members · Former members switch), so each view is offered once. This came from the persona check.
- **Tests:** `lib/brand/components/layout/layout-rules.test.ts`, 4 tests:
  - the column priorities;
  - the phone's actions;
  - the sidebar's rows with no view open;
  - `aria-current` on the open view only.
- `docs/DESIGN.md`: the layout components are marked as built, and the `AppShell`, `NavRail`/`NavSidebar` and desk-navigation lines now say what was built.

## Decisions

- No new decision. D122 and its 2026-11-19 amendment cover this PR.
- **Rail and sidebar stay while a notice editor is open.** D122's component line said "hidden, as the tabs are". The tabs hide because they are fixed at the bottom, under the save bar. The save bar is sticky inside `<main>`, so it never covers the rail. DESIGN.md is updated.
- **Open tint is 15 %, not 8 %.** The persona check found 8 % plum invisible in dark mode.

## Deviations

- **No public pages moved onto `AppShell`.** The coordinator's scope named the desk AppShell only. `EventView`, the alliance and player pages and the site header keep their own 960 px copies until rollout PRs 7–8.
- **No /brand showcase.** /brand takes its strings from `lib/copy` (the public, translated strings). The nine components no page uses yet were rendered through a temporary route instead, which is not committed: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ap/demo-page.tsx`.
- **The members' board** has no navigation, so it uses `AppShell` with `legacyWidth` and nothing else changes on it.
- **At 768–1023 desk pages are about 60–70 px taller than before.** The rail takes 88 px and the content keeps its 960 px cap, so a column is 680 px wide instead of 768 (Home 955 → 1,021 px at 768). Each page's own PR uses the width.

## Verified

- `pnpm check` exits 0: prettier, eslint, tsc, vitest (**211 files passed, 2 skipped; 1,129 tests passed, 4 skipped**), the drift check and i18n.
- **Local production build** on :3996, with this worktree's Postgres (46 migrations), the seed with invented player names, a Discord sign-in stand-in, an officer and a member. No upstream, Discord or Groq call was made.
- **Shots** are in `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11aq-shots/`:
  - `before/`: 88 shots. Home, Members, Calendar and the board at 360 / 768 / 1024 / 1280 / 1440, light and dark, EN and PT, plus FR at 768 and 1280.
  - `after/`: 132 shots. The same, plus Caravans and Former members (a view open).
  - `components-*`: the demo route at the five widths, light and dark, and the More menu open at 360.
  - Each folder has a `metrics.json`.
- **Checks on every after shot:**
  - no page scrolls sideways;
  - every nav item is 44 px or more (rail items 64 px);
  - exactly one `aria-current` per page from 1280 (before this fix the view was marked twice);
  - 360 is unchanged (Home 1,023 px before and after);
  - main column at 1280: x = 272, width 960; at 1440: x = 352, width 960.
- **Components demo:**
  - cards below 640;
  - 3 table columns from 640 to 1439 and 5 from 1440;
  - the detail pane from 1024;
  - More shows only below 768 and closes on Escape;
  - nothing scrolls sideways.
- **Persona check (nav, PT and FR labels on the rail):**

  | Persona | Verdict |
  |---|---|
  | R4 on a 360 phone | accept (360 identical to before) |
  | Designer | accept with changes |
  | R5 on a laptop | accept with changes |
  | Officer on an iPad, FR | accept with changes |

  - Fixed:
    - the views and "See what members see" were offered twice from 1280 (the in-page copies are now hidden);
    - the dark tint was too faint (15 %);
    - no shot had a view open (Caravans and Former members added).
  - Not changed: rail labels "should be 12 px". They are already 12 px, the same as the tabs. "À suivre", "Acompanhar" and "Anciens membres" fit.
- **Privacy:** the diff holds no player name (checked against the 1,935 fixture names).

## Open issues

- The panel's nice-to-haves, not done:
  - align the bar's title with the sidebar instead of the content (D122 says the content, kept);
  - draw the sidebar divider in the brand's ink stroke instead of a hairline.
- From 1280 a Calendar view's page title still reads "Calendar"; only the sidebar names the open view (Caravans). Rollout PR 4 can put the view in the page head.
- Pre-existing: at 360 the "Acompanhar" bottom tab reaches the screen's edge.

## Next

- Model/effort: keep for rollout PR 2 (desk Home); raise one for PR 3 (Members), as the 11ap handoff says.
- What the owner must do first: merge. There is no migration and no environment change.
- Plan change: none.

<adjustments>
- A page moves to the full width by dropping `legacyWidth` on its frame. Today `Frame` sets it for every desk page. PR 2 should add a `wide` prop to `SignedInFrame` (or a per-page opt-in) rather than flip all pages at once.
- To mark a view on the sidebar, pass its id as `current` (`"notices"`). `VIEW_TAB` in `DeskNav.tsx` maps a view to its destination.
- `MoreMenu` needs a positioned ancestor. `PageHead`'s phone row is one; anything else that uses it must be one too.
- The temporary demo route (scratchpad `11ap/demo-page.tsx`, served at `/zz-layout-demo`) renders every component. Copy it into `app/(pages)/` to check a change, and never commit it.
</adjustments>

PR: (added by the orchestrator)
