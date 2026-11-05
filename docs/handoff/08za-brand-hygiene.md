# 08za — /brand hygiene

Issue #54 (07c N7, S5). This branch is cut from `session/08z-admin-run-trace` (PR #108) and depends on it.

## Built
- React keys from positions instead of copy text:
  - `app/(pages)/brand/LogoSection.tsx`: do and don't tiles
  - `app/(pages)/brand/VoiceSection.tsx`: samples and do/don't pairs
  - `app/(pages)/brand/ComponentsSection.tsx`: select options and radio options
  - `app/(pages)/brand/parts.tsx`: `Rules`
- The same change in `app/_ui/admin/RunTrace.tsx` (new in #94): the card labels and column heads were keyed by their copy. "Seconds" and "Retries" both blank to `░░░░░░░`, and these four warnings were the only ones left on `/brand` in blank mode.
- Keys that are ids are unchanged: TypeSection (type keys), ColourSection (token names), LogoSection tones and fixed tile keys, the page's section ids.
- `docs/DESIGN.md` Language-light rules: one line exempting `/brand` from the no-paragraph rule. `/brand` is the guidelines page: `noindex`, linked from nowhere. Its strings stay in `lib/copy-brand.ts`, and its keys never come from copy.

## Decisions
- **No token change.** The contrast pair from N7 (paper on sage, the `/brand` badge) was already fixed by #25 (`lib/brand/tokens.css:11`, sage `#586750`). Measured again:
  - paper on sage: 4.88:1 light, 6.88:1 dark
  - light yarn on paper: 4.90:1
  - axe found no new pair (see Verified)
- **Sentences: exempt, not trimmed** (assumption from the task). `copy.brand` is unchanged.
- Position keys are safe here: every list is a static array from copy, never reordered or filtered.

## Deviations
- None.

## Verified
- Same throwaway stack as 08z: local Postgres, `env -i` dev server, no real API key, no webhooks.
- axe-core on `/brand`, on this branch, at 390 and 1280 px, light and dark: 0 violations. Horizontal overflow is 0.
- `NEXT_PUBLIC_BLANK_COPY=1 next dev`, `/brand` at 390 and 1280 px, Playwright console listener:
  - Before the RunTrace fix: 4 errors, "Encountered two children with the same key, `░░░░░░░`".
  - After: 0 warnings, 0 errors.
  - The page was blanked: 6,218 blank glyphs at 390 px.
- `prettier --check`, `eslint .` and `tsc` are clean.
- `vitest run`, full suite: 139 passed, 15 skipped. Under load average 51, four PGlite files timed out on the 10 s `beforeAll`, in the full run and when run alone: `lib/queries/leadership`, `players`, `running`, `upstream-status`. With `--hookTimeout=90000` all four pass (14 tests). These are setup timeouts under load. None of these files touches this change.

## Open issues
- Other copy-derived keys exist outside `/brand`. They do not show on `/brand`, so they are not changed here:
  - `lib/brand/components/FactList.tsx:8` (`key={i.label}`; `/brand` and `/admin`. The labels differ in length, so no warning today.)
  - `app/_ui/Leadership.tsx:58`
  - `app/_ui/PlayerAcrossEvents.tsx:135,182,189,250`
  - `app/_ui/admin/RoundOptions.tsx:54`

  Blank mode can duplicate them when two labels have the same length.
- The PGlite `beforeAll` timeout (10 s) fails `pnpm check` when the machine is loaded (several parallel sessions). The tests themselves pass.

## Next
Session: 9 — Dry run against production.
Model / effort: keep — opus high. This change touches only `/brand` keys and one DESIGN.md line.
Owner must do first: merge PR #108 (08z), then this PR, into `dev`. No migration.
Plan changes needed: none.

<adjustments>
- `/brand` passes axe at 390 and 1280 px, light and dark, and logs no blank-mode warning. Skip it in Session 9's checks.
</adjustments>
