# chore/592-lint-limits — engineering review batch 2: H6 (line limit) and M1 (colour guard, guard messages)

Size S (harness and lint). Issue #592, phase 3 findings H6 and M1.

## Built

- **Colour guard moved to ESLint (M1).** `eslint.config.mjs` adds `no-restricted-syntax` for `app/**/*.{ts,tsx}` and `lib/brand/components/**/*.{ts,tsx}`, test files excepted. It flags `#[0-9a-f]{3,6}\b` or `rgba?(` (case-insensitive) in a string literal (`Literal`, which covers JSX attribute values and style objects) or a template literal part (`TemplateElement`). Comments are never checked. The message names the rule (docs/DESIGN.md, Enforcement) and the fix: a token class (`text-ink`, `bg-paper`, `border-rule`), `var(--token)` or `currentColor`; a new colour goes in `lib/brand/tokens.css`.
- **`lib/brand/tokens.test.ts` now checks only stylesheets.** ESLint does not parse CSS, so the test still scans `.css` files under `app/` and `lib/brand/components/` (today `app/globals.css`), with `/* comments */` blanked first. It asserts it found `app/globals.css`, and its failure message names the rule and the fix.
- **Line limit (H6).** `max-lines` is 400 for code (was 300). It is off, like `lib/i18n` (D88), for `lib/private/dictionary*.ts`, `lib/copy*.ts`, `lib/schema*.ts`, `e2e/fixtures/**/*.ts` and `e2e/*.spec.ts`, with `*.test.ts` excluded from that list. Function length (80), complexity (12) and nesting (3) are unchanged.
- **Guard failure messages.** `copy.test.ts`, `roster-fields.test.ts` (both tests), `blocked-keys.test.ts`, `no-upstream-literals.test.ts` (both tests), `public-cache.test.ts`, `quota-gate.test.ts` and `member-session.test.ts` now pass a message to `expect(value, message)` that names the rule (decision or plan section) and the fix. What they check did not change.
- **Docs.** CONTRIBUTING.md: a "What trips a check, and the fix" table under "How the harness works" (13 rows: lint limits, the import fence, the colour rule, the seven guard tests, i18n and drift), and a "Splitting a file" working rule (split by concept, no `-parts`/`-more` files, no re-export shims, merge old shards only when a PR touches them). Dated amendments on D88 (the exemptions, the 400 limit, the split rule; it replaces D88's last bullet, which kept `lib/copy.ts` under the limit) and D14 (tests now 400; e2e specs exempt). docs/DESIGN.md "Enforcement" describes the lint rule and the CSS test.

## Decisions

- Test files (`*.test.ts`, `*.test.tsx`) are outside the colour rule. The old test scanned them; they never reach a page, and their names carry issue numbers ("issue 592"), which was one of the reported false positives. Every other place the old test checked is still checked: `.ts`/`.tsx` in `app/` and `lib/brand/components/` (now by lint, test helpers included) and `.css` there (by the test).
- `no-restricted-syntax` rather than a local rule: two selectors are enough. A later lint ban that also uses `no-restricted-syntax` on the same files (H3 proposes one for `Intl.PluralRules`) must add its selectors to this entry, because a later config entry replaces the rule's options instead of merging them.
- The amendment went on D88, the decision that exempts files from `max-lines`. The limits themselves were set in docs/IMPLEMENTATION_PLAN.md §11.2, which agents don't edit. D14 got a one-line amendment because it states "max-lines (300)".
- The 573 "issue 585" comments are left as they are (task).

## Deviations

- `lib/brand/tokens.test.ts` is narrowed, not removed: ESLint cannot cover CSS without a new dependency (`@eslint/css`), and the task allowed removal only once lint covers everything the test covered.

## Verified

- Colour rule, with probe files that were then deleted: `app/_ui/__probe/Probe.tsx` with `fill="#a1b2c3"`, `style={{ color: "rgba(0, 0, 0, 0.5)" }}` and `` stroke={`#fff${n}`} `` gave 3 lint errors with the new message; `lib/brand/components/__probe.tsx` with `"#abc"` gave 1. A `.ts` file whose comment says `#592, #678 and #691; width #100%`, a component comment with `#592`/`#585`/`#100%`, a test named `"keeps the issue #592 name"`, and `lib/brand/palette.ts`/`theme.ts` gave none.
- CSS test: `app/__probe.css` with `/* Issue #592 … #585 and #abc */` passed; with `color: #a1b2c3;` it failed with `app/__probe.css:3: color: #a1b2c3;` and the new message. Probe deleted.
- A guard message: `lib/queries/zz-probe.ts` reading `m.online` made `blocked-keys.test.ts` fail with "Plan §12.1: a read model in lib/queries names a key from BLOCKED_ROSTER_KEYS. Remove it: …". Probe deleted.
- `pnpm vitest related --run` on the 8 changed tests: 8 files, 84 tests passed.
- `pnpm check`: passed (Vitest 352 files passed, 2 skipped; 1,873 tests passed, 4 skipped; prettier, eslint, tsc, drift, i18n).
- `pnpm check:fast`: passed.

## Open issues

- docs/IMPLEMENTATION_PLAN.md §11.2 still says "files ≤ 300 lines". It needs a change to 400 with the data-file exemptions (D88 amendment 2026-11-22).
- `lib/copy.ts` and `lib/private/dictionary.ts` hold some code beside the data (`fill`, `blankCopy`, `parseLanguage`, `pickWorkspaceLanguage`); they are now exempt from `max-lines` along with the rest of `lib/copy*.ts` and `lib/private/dictionary*.ts`, as the task asked.

## Next

- Merge existing `-parts`/`-more` shards and re-export shims only when a PR touches them (CONTRIBUTING.md § Working rules). One dictionary layout (H6's last point) was not part of this task.
- H3's `Intl.PluralRules` ban: add its selector to the `no-restricted-syntax` entry here, or scope it to other files (see Decisions).

What was missing from the task prompt? Whether test files stay inside the colour rule (they were scanned before, and their names were a source of false positives), and that ESLint can't check the CSS the old test covered.

PR: (added by the orchestrator)
