## D88 — Translation files are data: `max-lines` does not apply to `lib/i18n/<tag>.ts` (2026-11-16, 08zzzzm, PR #342)

Why: each public language is one object in one file, `lib/i18n/<tag>.ts` (D48), and the translate-copy skill and its translator agents edit exactly that file. The English source stays under the 300-line limit by spreading blocks in from `lib/copy-*.ts` modules (`copy-live.ts`, `copy-war.ts`, `copy-merge.ts`, `copy-balance.ts`). The translations mirror the whole dictionary, so they passed 300 lines once the merge simulator (#282) and the server balance (#283) landed together: 307 to 311 lines in 16 languages.

- `max-lines` is off for `lib/i18n/*.ts` except `lib/i18n/index.ts`, in `eslint.config.mjs`, beside D14's test exception. Every other rule still applies.
- Not chosen: splitting each language into one file per block. That would be 17 more files for every new block, and the translate-copy skill and the translator agent would have to learn where each key lives.
- `lib/copy.ts` keeps the limit: it holds code (`fill`, the blank dictionary, `LANGUAGES`) beside the English, and new blocks keep going into `lib/copy-*.ts`.
