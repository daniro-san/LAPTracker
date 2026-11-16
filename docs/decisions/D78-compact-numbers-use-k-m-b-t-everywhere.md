## D78 — Compact numbers use K, M, B, T in every language and browser (2026-11-16, owner, issue #325)

Why: gamers read K, M and B in the game, and a lowercase "m" reads as minutes. `Intl`'s compact notation follows the locale and the browser: en-GB gave `60.1m`, `4.29bn` and `271k` in WebKit, pt-BR gave `3,94 bi`, German `Mio.`, Japanese and Chinese `万` and `億`. D23 had accepted that ("the compact suffix is the locale's own"); this replaces it.

- **Suffixes.** K = 1e3, M = 1e6, B = 1e9, T = 1e12, appended with no space, in every language and browser.
- **Digits.** Three significant digits, as before: `4.29B`, `60.1M`, `271K`, `1.00M`. Below 1,000 the plain integer, as before.
- **Decimal separator.** The locale's own: `4,29B` in pt-BR, `4.29B` in en.
- **Unit after rounding.** The unit is chosen after the mantissa is rounded to three digits, so 999,500 and 999,950 read `1.00M`, never `1000K`. At 1e15 and above the unit stays T (`1000T`).
- **One helper.** `compactLarge(n, locale)` in `lib/compact.ts` (pure, imports nothing). `compact()` in `app/_ui/format.ts` calls it with the request's locale; `lib/discord-format.ts` calls it with `en-US`. Checked over 2,000,154 numbers: the new helper with `en-US` prints exactly what `Intl.NumberFormat("en-US", { notation: "compact" })` printed for Discord, up to 1e15, so Discord messages and the event picture do not change.
- **Unchanged.** Exact-on-tap (`exact`), percentages, signs and the minus character. `Intl.NumberFormat` is still used for the mantissa, so digits and separators stay the locale's.
