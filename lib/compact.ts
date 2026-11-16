// The one compact-number format (D78): K, M, B, T in every language and browser, three significant
// digits, the locale's own decimal separator, no space before the suffix. Pure; imports nothing from the
// project. `Intl`'s `notation: "compact"` is not used: its suffixes follow the locale (`60.1m` and
// `4.29bn` in en-GB, `3,94 bi` in pt-BR, `万` in ja).
const SUFFIXES = ["K", "M", "B", "T"] as const;

const mantissaFormats = new Map<string, Intl.NumberFormat>();

function mantissaFormat(locale: string): Intl.NumberFormat {
  let format = mantissaFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      minimumSignificantDigits: 3,
      maximumSignificantDigits: 3,
      useGrouping: false,
    });
    mantissaFormats.set(locale, format);
  }
  return format;
}

/** `85.8M` (en), `4,29B` (pt-BR), `271K` for a number of 1,000 or more, without its sign. Callers
 * print what is below 1,000 themselves. */
export function compactLarge(n: number, locale: string): string {
  const abs = Math.abs(n);
  let unit = Math.min(Math.floor(Math.log10(abs) / 3), SUFFIXES.length);
  // log10 can land a hair below an exact power of 1,000.
  if (unit < SUFFIXES.length && abs >= 1000 ** (unit + 1)) unit += 1;
  // 999,950 rounds to 1000 at three digits in K: read it as 1.00 in M instead.
  if (unit < SUFFIXES.length && Number((abs / 1000 ** unit).toPrecision(3)) >= 1000) unit += 1;
  return `${mantissaFormat(locale).format(abs / 1000 ** unit)}${SUFFIXES[unit - 1]}`;
}
