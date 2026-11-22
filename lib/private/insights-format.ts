// The number formats the Insights page's words share (issue 489); plurals are lib/words' `plural`.
import { compactLarge } from "../compact";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";

export type Formats = { t: WorkspaceDictionary; language: WorkspaceLanguage };

export const whole = (n: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(n);
export const compact = (n: number, language: string) =>
  Math.abs(n) < 1000 ? whole(n, language) : compactLarge(n, language);
export const percent = (x: number, language: string) =>
  new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }).format(x);
