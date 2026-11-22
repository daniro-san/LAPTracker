// A member fact's value as words (issue 297, D80): one formatter for the card (made on the server), the
// editor's "Another officer saved …" and the import's examples (in the browser), so a value reads the
// same everywhere: 9.90M, 83%, T9, "Europe/Kyiv · UTC+2", English. Pure; it does not load lib/copy.
import { compactLarge } from "../compact";
import { dateWords } from "../date-words";
import type { FactField, FactValues } from "./fact-fields";
import { offsetLabel, offsetMinutes } from "./time-zones";

export const NONE = "—";

export interface FactTextFormat {
  language: string;
  /** A zone's offset is shown as of this moment. */
  now: Date;
  /** A server day ("2026-11-20") as a short date. */
  day: (iso: string) => string;
  words: {
    "status.break": string;
    "status.help": string;
    "facts.until": string;
    "facts.awayRange": string;
  };
}

/** 61.2M (D78); below 1,000 the plain number. */
const compact = (n: number, language: string) =>
  Math.abs(n) < 1000 ? new Intl.NumberFormat(language).format(n) : compactLarge(n, language);

/** "Nov 20 – Nov 25" with a first day (D103), "until Nov 25" without one; "" with no last day. */
function awayDays(v: FactValues["away"], f: FactTextFormat): string {
  if (!v.until) return "";
  return v.from
    ? f.words["facts.awayRange"].replace("{from}", f.day(v.from)).replace("{to}", f.day(v.until))
    : f.words["facts.until"].replace("{date}", f.day(v.until));
}

const SHOW: { [F in FactField]: (v: FactValues[F], f: FactTextFormat) => string } = {
  squadMight: (v, f) => compact(v, f.language),
  adTech: (v, f) =>
    new Intl.NumberFormat(f.language, { style: "percent", maximumFractionDigits: 1 }).format(
      v / 100,
    ),
  troopTier: (v) => `T${v}`,
  timeZone: (v, f) => `${v.replaceAll("_", " ")} · ${offsetLabel(offsetMinutes(v, f.now))}`,
  languages: (v, f) => {
    const names = new Intl.DisplayNames([f.language], { type: "language" });
    return v.map((code) => names.of(code) ?? code).join(", ");
  },
  status: (v, f) => f.words[v === "help" ? "status.help" : "status.break"],
  away: (v, f) => [v.text, awayDays(v, f)].filter(Boolean).join(" · ") || NONE,
  notes: (v) => v,
};

/** The value in the officer's language; "—" when there is none. */
export function factText<F extends FactField>(
  field: F,
  value: FactValues[F] | null | undefined,
  f: FactTextFormat,
): string {
  if (value === null || value === undefined) return NONE;
  return (SHOW[field] as (v: FactValues[F], f: FactTextFormat) => string)(value, f);
}

/** A server day as the card writes it ("Fri, Nov 20"), for the browser. */
export const dayFormat = (language: string) => dateWords(language, "UTC").day;
