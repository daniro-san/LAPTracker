// The number and plural formats the Insights page's words share (issue 489).
import { compactLarge } from "../compact";
import { fill } from "../copy";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";

export type Formats = { t: WorkspaceDictionary; language: WorkspaceLanguage };

/** `key.one` or `key.other` by `n`, filled with `n` and `vars`. */
export function counted(
  t: WorkspaceDictionary,
  key: string,
  n: number,
  language: string,
  vars = {},
) {
  const form = new Intl.PluralRules(language).select(n) === "one" ? "one" : "other";
  return fill(t[`${key}.${form}` as WorkspaceKey], { n, ...vars });
}

export const whole = (n: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(n);
export const compact = (n: number, language: string) =>
  Math.abs(n) < 1000 ? whole(n, language) : compactLarge(n, language);
export const percent = (x: number, language: string) =>
  new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }).format(x);
