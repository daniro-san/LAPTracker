## D88 — Translation files are data: `max-lines` does not apply to `lib/i18n/<tag>.ts` (2026-11-16, 08zzzzm, PR #342)

Why: each public language is one object in one file, `lib/i18n/<tag>.ts` (D48), and the translate-copy skill and its translator agents edit exactly that file. The English source stays under the 300-line limit by spreading blocks in from `lib/copy-*.ts` modules (`copy-live.ts`, `copy-war.ts`, `copy-merge.ts`, `copy-balance.ts`). The translations mirror the whole dictionary, so they passed 300 lines once the merge simulator (#282) and the server balance (#283) landed together: 307 to 311 lines in 16 languages.

- `max-lines` is off for `lib/i18n/*.ts` except `lib/i18n/index.ts`, in `eslint.config.mjs`, beside D14's test exception. Every other rule still applies.
- Not chosen: splitting each language into one file per block. That would be 17 more files for every new block, and the translate-copy skill and the translator agent would have to learn where each key lives.
- `lib/copy.ts` keeps the limit: it holds code (`fill`, the blank dictionary, `LANGUAGES`) beside the English, and new blocks keep going into `lib/copy-*.ts`.

**Amendment 2026-11-22 (orchestrator, issue 592):** the 300-line file limit was shaping the file layout instead of the code: 53 "split for size" headers, 17 `*Parts`/`-more` files, 37 re-export shims, and 7 files at exactly 300 lines. Two changes in `eslint.config.mjs`:

- `max-lines` is also off for the other data files, as for `lib/i18n/<tag>.ts`: the desk dictionaries (`lib/private/dictionary*.ts`), the public copy (`lib/copy*.ts`, so this replaces the last bullet above), the schema (`lib/schema*.ts`), and the e2e seed, fixtures and specs (`e2e/fixtures/**`, `e2e/*.spec.ts`). Test files keep the limit.
- For code the limit is 400 lines, not 300 (plan §11.2). The function limit (80 lines), complexity (12) and nesting (3) do not change.
- A file past the limit is split by concept, never into `-parts` or `-more` files, and gets no re-export shim (CONTRIBUTING.md § Working rules). Existing shards are merged only when a PR touches them anyway.
