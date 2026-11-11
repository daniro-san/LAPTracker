# 08zzzb-hover-cursor — issue 232

## Built

- `app/globals.css`, top: a `@layer base` rule gives the pointer cursor to every enabled `button`, `[role="button"]`, `summary`, `select`, and `label` that wraps a checkbox, radio or select. Tailwind's preflight gives `<button>` the default cursor; disabled controls keep that default.
- `app/globals.css`, `@layer components`: two new shared classes.
  - `.tint-button`: a tint of the text colour laid over the control's own background, as a `background-image`, so it also shows on a selected or open control. 10 % on hover, only under `@media (hover: hover)`, and 20 % on press. A `summary` that is hovered or pressed tints its direct `.tint-button` child, which is the framed "Details" control.
  - `.text-button`: an underline 2 px thick on hover, for summaries and buttons that read as links.
- `app/globals.css`: `.ink-button` and `.frame-button` also accept `[data-state="hover"]` and `[data-state="press"]`, so /brand can show those states pinned.
- Routed through `.tint-button`; each lost its own `hover:` or `active:` utilities and its now redundant `cursor-pointer`:
  - "Copy for spreadsheet" (`app/_ui/CopyRoster.tsx`) and the "Retry" button in `app/_ui/MemberHistoryBody.tsx`.
  - The members sort and filter chips (`app/_ui/MembersExplorer.tsx`) and the Movers tabs (`app/_ui/Movers.tsx`).
  - The header controls: `CONTROL` in `app/_ui/SiteHeader.tsx` (event selector and Players link), the settings gear (`app/_ui/ViewerSettings.tsx`), `lib/brand/components/ThemeSwitch.tsx` and the skip link.
  - `CheckField` chip and `RadioField` (`lib/brand/components/`).
  - The Compare link (`app/_ui/ComparePicker.tsx`), "My alliance" (`app/_ui/MyAlliance.tsx`), the history filter links (`app/(pages)/alliances/[unionId]/history/page.tsx`) and the /brand nav links (`app/(pages)/brand/page.tsx`).
  - The framed Details control in `MoreBar` (`app/_ui/StatTable.tsx`) and in the alliance Summary band (`app/(pages)/events/[id]/alliances/[unionId]/page.tsx`).
  - The card-head summaries in `app/_ui/MemberHistory.tsx` and `app/_ui/admin/RoundFacts.tsx`.
- Routed through `.text-button`: the "Show all (n)" summary in `MemberHistoryBody.tsx`, the "more events" summaries in `PlayerAcrossEvents.tsx` and `AcrossEvents.tsx`, the footer "More" (`SiteFooter.tsx`), and the admin "Options" summary and "again" button (`app/_ui/admin/ManualSection.tsx`).
- `lib/brand/components/SealButton.tsx`: dropped `cursor-pointer`, so a disabled seal on /admin shows the default cursor (the base rule covers the enabled one). Added `data-[state=hover|press]` variants for /brand.
- `app/(pages)/brand/ButtonStates.tsx` (new) and `ComponentsSection.tsx`: a "Hover and press" spec that shows primary, secondary, seal, chip and text control at Rest, Hover and Press. The samples are `inert`. Copy is in `lib/copy-brand-components.ts` (`states`); /brand is English-only (D48).
- `docs/DESIGN.md` Components: the `button-secondary` line now names its hover and press looks. A new "Hover and press (issue 232)" entry states the rule (pointer cursor, hover and press state, default cursor when disabled), names the base rule, and lists which class each kind of control uses.
- `docs/screenshots/08zzzb-*.png`: 27 Chrome captures at 1280 px, about 150 KB in total.

## Decisions

- Several controls the issue lists already used `buttonClass` on `dev`: ShowFirst, the MembersExplorer "Show all" button, PinSheet, ConfirmSheet, AdminActions, and ManualSection's sheet buttons. They already had the pointer cursor and the brand hover, so they did not change.
- The tint uses `currentColor`. One class therefore serves plum-text chips on paper and paper-text header controls on plum, and the header looks the same as before (paper 10 % / 20 %, where it was `bg-paper/15` / `bg-paper/25`). On a Movers tab the tint is ink-coloured, because the tab text is ink.
- Press on `.tint-button` is a deeper tint, not the 1 px push of `.frame-button`. A push would shift the Movers tab borders and the card heads.
- Hover tints and underlines apply only under `@media (hover: hover)`. That matches Tailwind's `hover:` variant, which the header controls used before, so a tap on a phone leaves no tint. `.ink-button` and `.frame-button` keep their old unwrapped hover rules.
- Text controls get an underline on hover and no separate press look, because they read as links. The issue asks for a press state only for "every control that looks like a button".
- `.text-button` underlines 2 px thick, so the footer "More" and the admin "Options" and "again", which are already underlined, still change on hover. Plain text links elsewhere keep `hover:underline`, which uses the font's default thickness.
- Selects and their wrapping labels get the pointer cursor (item 1 of the issue) but no hover look. They are form fields, not button-like controls.
- The ManualSection "again" button keeps `cursor-pointer` next to `disabled:cursor-wait`. The utility is needed so that the disabled state shows the wait cursor.

## Deviations

- None from `docs/IMPLEMENTATION_PLAN.md`.
- The first commit (`91a0fe8`) was made with the git hooks bypassed by mistake. I then ran gitleaks (`gitleaks dir app`, `gitleaks dir lib`, `gitleaks dir docs/DESIGN.md`: "no leaks found"); prettier and eslint run in `pnpm check`. The later commits ran lefthook normally (secrets, prettier and eslint all passed).
- The /brand "Hover and press" capture predates a one-line copy edit. The final copy is "Every control shows the pointer cursor and a hover look; buttons and chips also a press look. …"

## Verified

- `pnpm check` on the merged branch (after `git merge origin/dev`, `pnpm install --frozen-lockfile` and `pnpm exec eslint . --fix`, which moved nothing): exit 0. "All matched files use Prettier code style!", eslint and tsc clean, "Test Files 55 passed | 1 skipped (56)", "Tests 254 passed | 1 skipped (255)", "No schema changes, nothing to migrate", "i18n: 17 languages up to date with English". An earlier run before the merge had one 10 s timeout in `app/(pages)/admin/gate.test.ts`, which this change does not touch.
- Setup: a local Postgres 18 on 127.0.0.1:54151 (`pnpm db:local:start`, `migrate`, `seed --with-states`), the bridge on 54251, and `next dev` on 3151 with the preload. Placeholder `.env.local`; no upstream call and no `/api/quota`. The seed leaves `daily_rosters` empty, so I inserted two local daily reads for HSR (67111657), built from its seeded snapshots, to get member history cards. The cluster and `.env.local` were removed afterwards.
- Pages open at `localhost`, not `127.0.0.1`: with `127.0.0.1` the Next dev client did not hydrate (the HMR socket was refused), so the PIN field never enabled Unlock.
- Cursor and hover list, Chrome 1280 px (system Chrome, playwright-core). For every visible `button`, `summary`, `[role=button]`, `select`, wrapping `label`, and framed or brand-class link, the script recorded `getComputedStyle(el).cursor`. It then compared background colour, background image, transform, text decoration, `rotate` and `scale` (and those of the summary's `> .tint-button` child) before and after `hover()`. Pages: `/`, `/events/3`, `/events/3/alliances/67111657`, `/alliances/67111657/history` (closed, and with the newest card open), `/players`, `/players?q=a`, `/players/340003373381`, `/events/compare?a=2&b=3&alliance=67111657`, `/brand`, and `/admin` after unlocking with the PIN. The Next dev-tools button and /brand's inert samples are left out. Result on the merged code:
  - 188 controls: 188 with `cursor: pointer` and 173 with a hover change.
  - The 9 "Skip to the ledger" links (one per page) cannot be hovered while screen-reader-only. Focused with Tab, the link reads `pointer` and its `background-image` goes from 0 to 0.1 alpha on hover.
  - 6 have the pointer and no hover look, as decided above: the two selects and two labels on the compare page, and /brand's "Sort by" select and "Post to the public channel" label.
  - Disabled: the PIN sheet's Unlock with an empty PIN reads `disabled: true, cursor: default`; after typing, `false pointer`.
  - Per page, every control with `pointer` and a hover change:
    - `/` (31): Skip link, Players, event selector, Settings, ⇄ Compare, "Exact numbers" label, 20 Details summaries, 4 Movers tabs, More.
    - `/events/3` (31): the same set.
    - `/events/3/alliances/67111657` (22): Skip, Players, event selector, Settings, "My alliance" and "Exact numbers" labels, the Summary band's Details, 3 Movers tabs, 6 sort chips, "Show all (97)", 4 Details summaries, More.
    - `/alliances/67111657/history` (20): Skip, Players, "All events", Settings, "Exact numbers", 5 filter links, 9 card heads, More. With a card open (22): the same plus "Copy for spreadsheet" and "Show all (90)".
    - `/players` and `/players?q=a` (6 each): Skip, Players, "All events", Settings, Search, More.
    - `/players/340003373381` (11): Skip, Players, "All events", Settings, ⇄ Compare, "Exact numbers", 4 Details, More.
    - `/events/compare…` (13): Skip, Players, "All events", Settings, "Exact numbers", Compare, Details, "Show all (97)", More, plus the 2 selects and 2 labels.
    - `/brand` (20 live): "Dark mode", 6 nav links, "Find a player", "Cancel", "Run now", the "Sort by" select, 4 labels, 3 Movers tabs, Settings.
    - `/admin` (7): Players, Settings, the Before snapshot, After snapshot and Rehearse seals, "Start a manual round", More.
  - I did not click the admin seals: a seal without a confirm step sends its action at once.
- Hover captures, rest and hover for each kind (`docs/screenshots/08zzzb-<kind>-{rest,hover}.png`): `tint-copy-roster`, `tint-movers-tab`, `tint-members-chip`, `tint-members-chip-selected`, `tint-check-chip`, `tint-header-selector`, `details-summary`, `tint-card-head`, `text-summary`, `text-footer-more`, `primary`, `secondary`, `seal`. Also `08zzzb-brand-hover-and-press.png`.
- Mobile at 360 px is unchanged. The script recorded every control's box (x, y, width, height) and the document height at 360 × 800 on this branch, then again with `dev`'s versions of the changed `app/` and `lib/` files checked out in the same worktree. Every page matched exactly ("differing 0", same `docHeight`) except `/brand`. /brand grows by the new "Hover and press" samples (docHeight 16693 → 17579; the controls after them move down). The 360 px run measured the history page with its cards closed.

## Open issues

- Follow-up, not changed: `SealButton`'s hover and press transforms (Tailwind `hover:` and `active:`) still play on a disabled seal. Only the cursor is now default.
- Follow-up, not changed: `.ink-button` and `.frame-button` hover rules are not under `@media (hover: hover)`, so on a phone a tapped primary or secondary button can keep its hover look until the next tap elsewhere. The new `.tint-button` and `.text-button` do not have this.
- Not checked in Firefox; it cannot start on this Mac. The CSS in this change is standard (`color-mix`, `linear-gradient`, `:has`, `@media (hover)`).

## Next

Session: none queued. No session in `docs/SESSION_PLAYBOOK.md` follows this one.
Model / effort: keep — no signal. Every control measured on the first full run after a script fix; `pnpm check` passed on the merged branch on the first run.
Owner must do first: merge this PR into `dev` (`Closes #232` closes the issue).
Plan changes needed: none.

<adjustments>
- New interactive controls take their looks from the brand classes, not from `hover:` utilities: `buttonClass("primary" | "secondary")` for buttons and button-like links, `.tint-button` for chips, tabs, header controls and card-head summaries, `.text-button` for summaries or buttons that read as links. The pointer cursor comes from the base rule in `app/globals.css`; do not add `cursor-pointer`.
- A summary's framed Details control tints when the whole summary is hovered (`summary:hover > .tint-button`), so the control must stay a direct child of the `<summary>`.
- Local captures: open the dev server at `localhost:<port>`, not `127.0.0.1`. With `127.0.0.1` the client does not hydrate and client-side controls (the PIN sheet) do nothing.
- For member history captures, the seed leaves `daily_rosters` empty. Two `daily_reads` rows plus `daily_rosters` rows built from `alliance_snapshots` and `member_snapshots` are enough to get cards with "Copy for spreadsheet".
</adjustments>

https://github.com/daniro-san/LAPTracker/pull/237
