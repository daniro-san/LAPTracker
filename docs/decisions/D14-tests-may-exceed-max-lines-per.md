## D14 — Tests may exceed max-lines-per-function (2026-11-04, Session 1)

ESLint counts a `describe(() => { ... })` callback as one function, so any test file with more than a few cases trips the 50-line limit, even though each `it` is small. The rule is turned off for `**/*.test.ts` in eslint.config.mjs instead of adding disable comments. `max-lines` (300) still applies to tests.
