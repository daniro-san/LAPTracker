# 11ap — Responsive layout system (issue 412, step 1: research and design)

## Built

- **Docs only. No app code changed.**
- `docs/DESIGN.md`:
  - `layout` tokens in the front matter (breakpoints, margins, gutters, `page-max` 1200, `measure` 65ch, `form-max` 560, rail 88, sidebar 224, spread 2fr 1fr, master-detail 7fr 5fr, `card-min` 18rem);
  - a "Layout system (D122)" subsection under "Layout": widths and navigation per width, the ledger spread, master-detail, tables by column priority, page head, touch, desk navigation, charts at wide widths, "Nothing short wraps", the margin column's rhythm, and the measured before numbers;
  - a new "Layout components (D122)" section listing the eleven planned components in `lib/brand/components/layout/`;
  - the screenshot widths in "Do" and "Enforcement" are now 360 / 768 / 1024 / 1440; one new "Don't" line.
- `docs/decisions/D122-responsive-layout-system.md`: the audit, the research with sources, the decision, which sections sit side by side on each page, and the persona panel. It is indexed in `docs/decisions/README.md`.
- Scratchpad only, not committed:
  - the audit: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ap-audit/`. It has 44 full-page shots, `<page>-<width>.png` for 11 pages × 4 widths, and `metrics.json`.
  - the mocks: `/private/tmp/claude-502/-Users-danilordasilva-orca-workspaces-LAPTracker-unicornfish/147759e3-1cdb-4ccd-b74a-1001498a1e18/scratchpad/11ap-mock/`:
    - the sources (`mock.css`, `build.mjs`, round 1 in `v1/`);
    - round 1 shots in `shots-v1/`, at 360, 768 and 1440;
    - round 2 shots in `shots-v2/`, at 360, 768, 1024 and 1440.

## Decisions

- D122. Summary:
  - widths 360 / 768 / 1024 / 1280 / 1440: Tailwind `xl` stays 1280, and a `wide` breakpoint at 1440 is added for the extra table columns only (amended, see below);
  - content at most 1200 px;
  - desk navigation: bottom tabs below 768, then an 88 px rail up to 1279, then a 224 px sidebar with the sub-views from 1280;
  - the ledger spread from 1024: main 2/3, and a margin column of unframed margin notes on the right, behind a 2 px ink rule, sticky;
  - master-detail from 1024 for Members, Follow-up and Former members;
  - table columns by priority;
  - one primary action plus "More ▾" on phones;
  - rows stay ≥ 44 px, and there is no density mode.
- **Amended after the mocks (coordinator, 2026-11-19, under the owner's carte blanche):** the sidebar starts at 1280, not 1440; public pages keep their header with no side nav; the members' board gets the spread; no compact density mode; Calendar and Notices are mocked inside rollout PR 4. All recorded in D122's amendment.
- The spread is the brand's answer to "generic AI design": a ledger page and its margin notes, instead of a sidebar and a grid of equal cards.

## Deviations

- **Mock widths.** The task asked for mockups at 768 and 1440. Round 2 also shot 360 and 1024 (360 shows nothing regressed; 1024 was asked for by the panel).
- **Persona panel.** One agent played all four personas and saw every shot, before and after. It ran two rounds instead of "iterate once", because round 1 raised things worth one more check.
- **Public seed data.** The seed uses the fixture rosters, which hold real player names. Before any screenshot, every player name in the local database was replaced with an invented one derived from the uid. Alliance names were kept: they already appear in `DESIGN.md`.
- **Seed dates.** The local seed's daily rosters end on Oct 30, so desk Members shows an older roster. The garrison page had no squads (the seed has no squad reads), so its audit shot shows only the enemy-might field.

## Verified

- **The audit ran on a local production build.**
  - Build: `pnpm build` on `origin/dev` at 6dbf9b92.
  - Server: `next start` on :3996, with this worktree's own Postgres on :55467 (46 migrations), `pnpm db:local:seed --reset --with-states`, and the desk seed in the scratchpad.
  - Sign-in: a Discord sign-in stand-in with an officer and a member.
  - Every page answered 200. No page scrolled sideways at any width.
  - No upstream, Discord or Groq call was made.

- **Page heights (px) at 360 / 768 / 1024 / 1440, before.** Main content width is 360 / 768 / 960 / 960.

  | Page | 360 | 768 | 1024 | 1440 |
  |---|---|---|---|---|
  | Desk Home | 1,023 | 955 | 935 | 935 |
  | Desk Members | 2,418 | 2,378 | 2,378 | 2,378 |
  | Desk Calendar | 1,772 | 2,316 | 2,316 | 2,316 |
  | Desk Roll call | 1,270 | 1,107 | 1,107 | 1,107 |
  | Members' board | 1,414 | 1,298 | 1,274 | 1,274 |
  | Public ledger | 6,068 | 2,990 | 2,797 | 2,797 |
  | Public alliance | 7,497 | 4,052 | 3,857 | 3,857 |
  | Public player | 2,345 | 1,578 | 1,558 | 1,558 |

- **Mock heights, round 2, at 360 / 768 / 1024 / 1440:**

  | Mock | 360 | 768 | 1024 | 1440 |
  |---|---|---|---|---|
  | Alliance (first 16 members) | 3,123 | 2,612 | 1,819 | 1,746 |
  | Members (with the open member) | 1,424 | 1,269 | 1,290 | 1,244 |
  | Home (more content than the seed's) | 1,677 | 1,368 | 1,049 | 962 |

  - These are not comparable one-to-one with the real pages: the mocks hold 16 members and invented content.
  - The alliance page's height at 1024 falls from 3,857 to about 1,800, because Leadership, Biggest changes and Standing move into the margin column.

- **Persona panel verdicts:**

  | Persona | Round 1 | Round 2 |
  |---|---|---|
  | Product designer | Accept with changes | Accept with changes |
  | R4 on a 360 phone | Accept with changes | Accept |
  | R5 on a 1440 laptop | Accept with changes | Accept with changes |
  | Member on a tablet | Accept with changes | Accept with changes |

  - The objections and how each was resolved are in D122 ("Persona panel").
  - The round 2 leftovers became DESIGN.md rules.

- **Checks.** No code changed, so `pnpm check` was not needed for app behaviour. `prettier --check` was run on the changed docs (see the commit).

## Open issues

- **Not seen by the panel.** Calendar and Notices were not mocked, and the rail's two-line labels were not seen in PT and FR ("Acompanhar"). Each is checked in its own rollout PR.
- **Seen in the audit, not fixed here:** the bottom tabs at desktop widths are a 640 px strip centred on the screen. The rail replaces this in rollout PR 1.

## Rollout plan (small PRs, in this order)

Each PR, as a rule:

- before and after full-page shots at 360 / 768 / 1024 / 1280 / 1440, light and dark, EN and PT, with the heights table;
- no sideways scroll at any width;
- a persona panel (the same four) on the after shots before merging;
- reads stay in `lib/queries` and `lib/private` as today. Layout only: no data or copy change beyond the new "More", "Pick a member…" and margin-note heads, in EN, PT-BR and FR (and the 17 public languages for public strings, via the translate-copy skill).

Card frames (#393, D116) are already shipped, so nothing waits on them.

1. **Foundation.**
   - Tokens in `tokens.css`: `--breakpoint-wide: 90rem` (`xl` stays 1280), `--page-max`, `--measure`, `--form-max`, `--rail`, `--sidebar`, `--card-min`.
   - `lib/brand/components/layout/`: `AppShell`, `NavRail`, `NavSidebar`, `PageHead`, `MoreMenu`, `Spread`, `MarginNote`, `CardGrid`, `Measure`.
   - Each component is shown on `/brand`.
   - `Frame`, `SiteHeader`, `EventView` and the alliance and player pages move onto `AppShell` with a `legacyWidth` (960) prop, so nothing else moves yet. The desk gets the rail and the sidebar.
   - Tests: one per component behaviour (the nav item for the current tab has `aria-current`, `MoreMenu` holds only the secondary actions, and `Spread` keeps the DOM order).
2. **Desk Home.** Spread: today and tomorrow and To review in the main column; members this week and recent activity as margin notes. Two even columns at 768.
3. **Desk Members.** `MasterDetail` (`?m=`) and `ResponsiveTable` with column priorities; the member sheet's content is the detail pane. Former members comes along. This is the largest PR. If it grows past one review, split the table from master-detail.
4. **Calendar and Notices.**
   - Calendar: the week's days in the main column; the month, "Add an event" and the clock note in the margin.
   - Notices: the list as a `CardGrid`; the editor in the main column, with the preview and the language states in the margin. Caravans and Thefts come along.
   - Mock these first for the panel, because they were not mocked in 11ap.
5. **Follow-up, Roll call and Garrison.**
   - Follow-up uses master-detail.
   - Roll call: the marks in two CSS columns from 768, read down each column; the counts and "Mark the other n" in a sticky margin note from 1024.
   - Garrison: who needs help in the main column; the enemy might and the spare squads in the margin.
6. **Members' board.** The week strip and events in the main column; notices, Start here and the thank-you note in the margin. The note card keeps its frame and ornaments (D114).
7. **Public alliance and player pages.**
   - Alliance page: `Spread` with `marginFirst` (the figures, Leadership and Biggest changes), then across events beside standing over time.
   - Player page: identity, figures and the names history in the margin.
   - `ResponsiveTable` for the member list.
8. **Public ledger** (and the compare and history pages). Status, legend, next update and my alliance in the margin. `StatTable` moves onto `ResponsiveTable`, and movers stay under the ledger. `/admin` takes `AppShell` with no rail.
9. **Remove `legacyWidth`** once no page uses it.

## Next

- Model/effort: keep for PR 1, and raise one for PR 3 (Members).
  - PR 1 is components and a shell swap, with tests sized like the brand tests.
  - Members master-detail touches the sheet, history, the URL and the list state together. 11y and 11z show that changes there need the most review rounds.
- What the owner must do first:
  - Read D122 and look at the round 2 mocks.
  - Nothing more: the coordinator answered the open questions on 2026-11-19 (D122 amendment).
- Plan change: none. The workspace track has no prompt in `docs/SESSION_PLAYBOOK.md`, and this work runs from issue 412.

<adjustments>
- `xl` (1280) and `2xl` are used nowhere in `app/` or `lib/`, and `md` is used once and `lg` four times. `xl` keeps its default 1280 (the sidebar); add `--breakpoint-wide: 90rem` for 1440. Grep again before PR 1.
- Four places repeat the 960 px container: `app/(private)/_ui/Frame.tsx`, `app/_ui/EventView.tsx`, `app/(pages)/players/[uid]/page.tsx` and `app/(pages)/events/[id]/alliances/[unionId]/page.tsx`. `SiteHeader` and `SiteFooter` have their own copy. These are the `AppShell` swap points.
- The desk tabs are in `Frame.tsx` (`Tabs`, `TABS`, `PATHS`). The rail and sidebar take the same list. Keep the Home count badge and the rule that hides the tabs while a notice editor is open.
- The fixture-based seed shows real player names on public pages. For screenshots, run the uid-based rename SQL in the 11ap scratchpad (`11ap/rename.sql`) after `db:local:seed`.
</adjustments>

PR: (added by the orchestrator)
