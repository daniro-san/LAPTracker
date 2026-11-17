// The one-time sheet import (issue #297, D80), pure part: a spreadsheet pasted or uploaded as CSV (or
// copied cells, which arrive tab-separated), its columns found by their header, and per row the name
// and the member facts the sheet holds. Measured on the OGs sheets: might in millions ("10.7"), AD % as
// a fraction ("0.83", "1"), tiers as "T9", time zones as "US - CST", "UK - GMT", "ST +3", "Belgium".
import type { FactValues } from "./fact-fields";
import { TIER_MAX } from "./fact-fields";
import { fold } from "./members-list";
import { zonesNamed } from "./time-zones";

export type SheetFact = "squadMight" | "adTech" | "troopTier" | "timeZone";
type Column = "name" | "role" | SheetFact;

/** Headers, folded, and the column each names. Anything else is not imported. */
const HEADERS: Record<string, Column> = {
  name: "name",
  nome: "name",
  nom: "name",
  player: "name",
  member: "name",
  role: "role",
  rank: "role",
  cargo: "role",
  troops: "troopTier",
  "troop lvl": "troopTier",
  "troop level": "troopTier",
  "troop tier": "troopTier",
  "soldier tier": "troopTier",
  tier: "troopTier",
  "first squad": "squadMight",
  "1st squad": "squadMight",
  "main squad": "squadMight",
  might: "squadMight",
  "ad%": "adTech",
  "ad %": "adTech",
  "ad tech": "adTech",
  adp: "adTech",
  timezone: "timeZone",
  "time zone": "timeZone",
  tz: "timeZone",
};

export interface SheetRow {
  /** The row's line in the sheet, 1 for the header's next. */
  line: number;
  name: string;
  /** The sheet's role column ("R4", "Expelled"), shown to the person who matches it. */
  role: string | null;
  facts: Partial<Pick<FactValues, SheetFact>>;
  /** Time zones the sheet wrote that name no single zone, left for the card. */
  unread: string[];
}

/** A sheet column: its header, what it fills, and its first value as written and as read (10.7 → 10.7M). */
export interface SheetColumn {
  header: string;
  field: Column | null;
  example: { raw: string; value: unknown } | null;
}

export interface Sheet {
  columns: SheetColumn[];
  rows: SheetRow[];
}

/** The first row in which the column gave a fact, as written and as read. */
function exampleOf(column: Column | null, at: number, body: string[][], rows: SheetRow[]) {
  if (column === null || column === "name" || column === "role") return null;
  const row = rows.find((r) => r.facts[column] !== undefined);
  return row ? { raw: (body[row.line - 1]?.[at] ?? "").trim(), value: row.facts[column] } : null;
}

/** RFC 4180 rows: quoted cells may hold the separator, quotes ("") and line breaks. */
export function parseDelimited(text: string): string[][] {
  const sep = (text.split(/\r?\n/, 1)[0] ?? "").includes("\t") ? "\t" : ",";
  // A quoted cell or a plain one, then what ends it: the separator, a line break or the end.
  const cell = new RegExp(`("(?:[^"]|"")*"|[^${sep}\\r\\n]*)(${sep}|\\r?\\n|$)`, "gy");
  const rows: string[][] = [];
  let row: string[] = [];
  for (const m of text.matchAll(cell)) {
    const raw = m[1] as string;
    row.push(raw.startsWith('"') ? raw.slice(1, -1).replaceAll('""', '"') : raw);
    if (m[2] === sep) continue;
    rows.push(row);
    row = [];
    if (m[2] === "") break;
  }
  return rows;
}

/** "54,327,837", "10.7", "10,7", "0.83", "62%"; null when it is not a number. */
export function cellNumber(raw: string): { n: number; percent: boolean } | null {
  const s = raw.replace(/\s/g, "");
  const percent = s.endsWith("%");
  const digits = s.replace(/%$/, "");
  const plain = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits)
    ? digits.replaceAll(",", "")
    : /^\d{1,3}(\.\d{3})+$/.test(digits)
      ? digits.replaceAll(".", "")
      : digits.replace(",", ".");
  const n = /^\d+(\.\d+)?$/.test(plain) ? Number(plain) : NaN;
  return Number.isFinite(n) ? { n, percent } : null;
}

const tierOf = (raw: string) => {
  const m = /^t?\s*(\d{1,2})$/i.exec(raw.trim());
  const tier = m ? Number(m[1]) : 0;
  return tier >= 1 && tier <= TIER_MAX ? tier : null;
};

/** A column's numbers are in millions, or AD a fraction, when every number in it is that small. */
function scaleOf(rows: string[][], at: number, field: SheetFact): number {
  const numbers = rows.flatMap((r) => cellNumber(r[at] ?? "") ?? []);
  if (field === "squadMight") return numbers.every((x) => x.n < 1000) ? 1e6 : 1;
  return numbers.every((x) => !x.percent && x.n <= 1) ? 100 : 1;
}

function factsOf(
  cells: string[],
  at: Partial<Record<Column, number>>,
  scale: { squadMight: number; adTech: number },
  zone: { now: Date; serverZone: string },
): Pick<SheetRow, "facts" | "unread"> {
  const facts: SheetRow["facts"] = {};
  const cell = (c: Column) => (at[c] === undefined ? "" : (cells[at[c]] ?? "").trim());
  const might = cellNumber(cell("squadMight"));
  if (might && might.n > 0) facts.squadMight = Math.round(might.n * scale.squadMight);
  const ad = cellNumber(cell("adTech"));
  if (ad && ad.n * scale.adTech <= 100) facts.adTech = Math.round(ad.n * scale.adTech * 10) / 10;
  const tier = tierOf(cell("troopTier"));
  if (tier) facts.troopTier = tier;
  const words = cell("timeZone");
  const named = words ? zonesNamed(words, zone.now, zone.serverZone) : null;
  if (named?.sure) facts.timeZone = named.zones[0] as string;
  return { facts, unread: words && !named?.sure ? [words] : [] };
}

/** The sheet's rows with a name, and their facts; null when no header row has a name column. */
export function readSheet(text: string, now: Date, serverZone: string): Sheet | null {
  // A CSV saved by a spreadsheet may start with a byte-order mark.
  const rows = parseDelimited(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const fieldOf = (h: string) => HEADERS[fold(h).replace(/\s+/g, " ").trim()] ?? null;
  const head = rows.findIndex((r) => r.some((h) => fieldOf(h) === "name"));
  if (head < 0) return null;
  const header = rows[head] as string[];
  const at: Partial<Record<Column, number>> = {};
  header.forEach((h, i) => {
    const field = fieldOf(h);
    if (field && at[field] === undefined) at[field] = i;
  });
  const body = rows.slice(head + 1);
  const scale = {
    squadMight: at.squadMight === undefined ? 1 : scaleOf(body, at.squadMight, "squadMight"),
    adTech: at.adTech === undefined ? 1 : scaleOf(body, at.adTech, "adTech"),
  };
  const read = body.flatMap((cells, i) => {
    const name = (cells[at.name as number] ?? "").trim();
    if (name === "") return [];
    const role = at.role === undefined ? "" : (cells[at.role] ?? "").trim();
    return [
      { line: i + 1, name, role: role || null, ...factsOf(cells, at, scale, { now, serverZone }) },
    ];
  });
  return {
    columns: header.map((h, i) => {
      const field = fieldOf(h);
      // The first column of a kind is the one read; a repeated header is not imported.
      const used = field !== null && at[field] === i;
      return {
        header: h,
        field: used ? field : null,
        example: used ? exampleOf(field, i, body, read) : null,
      };
    }),
    rows: read,
  };
}
