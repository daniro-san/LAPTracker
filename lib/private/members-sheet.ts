// The Members tab's words that need a member row: a "Check in" reason with its evidence (D75), and the
// row as tab-separated cells for "Copy for spreadsheet". The copy leaves out the map position, online
// status, last online time and the photo (D71); numbers are plain integers, a cell with no data is empty.
import { fill } from "../copy";
import type { WorkspaceDictionary } from "./dictionary";
import type { MemberRow, Reason } from "./members";

/** How the page writes a date and a whole number in the officer's language. */
export interface Formats {
  /** A server day ("2026-11-14") or an instant, as a short date. */
  date: (at: string | Date) => string;
  number: (n: number) => string;
}

export function reasonText(r: Reason, t: WorkspaceDictionary, f: Formats): string {
  if (r.kind === "might") return fill(t["reason.might"], { n: r.days });
  if (r.kind === "kvk") return fill(t["reason.kvk"], { date: f.date(r.at) });
  return fill(t["reason.idle"], {
    activity: f.number(r.activity),
    donated: f.number(r.donated),
    n: r.days,
    r: r.days + 1,
  });
}

/** Fine, or "Check in: <reasons>". */
export function statusText(m: MemberRow, t: WorkspaceDictionary, f: Formats): string {
  if (m.reasons.length === 0) return t["status.fine"];
  return `${t["status.checkin"]}: ${m.reasons.map((r) => reasonText(r, t, f)).join("; ")}`;
}

const DAYS = ["day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat", "day.sun"] as const;

/** A spreadsheet reads a leading = + − @ as a formula; a leading apostrophe keeps the text as text. */
const cell = (text: string) => {
  const flat = text.replace(/[\t\r\n]+/g, " ");
  return /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
};
const plain = (n: number | null | string) => (typeof n === "number" ? String(n) : "");
const isoDay = (at: Date | null) => (at ? at.toISOString().slice(0, 10) : "");

/** The header row: one column per day of `week` ("Mon 9"). */
export function sheetHeader(week: string[], t: WorkspaceDictionary): string {
  const days = week.map((day, i) => `${t[DAYS[i] ?? "day.mon"]} ${Number(day.slice(8))}`);
  return [
    t["sheet.name"],
    t["sheet.rank"],
    t["sheet.might"],
    t["sheet.sanctuary"],
    ...days,
    t["sheet.total"],
    t["sheet.activity"],
    t["sheet.honor"],
    t["sheet.joined"],
    t["sheet.seen"],
    t["sheet.status"],
  ].join("\t");
}

/** One member as one tab-separated line, in the header's columns. */
export function sheetRow(m: MemberRow, t: WorkspaceDictionary, f: Formats): string {
  return [
    cell(m.name),
    cell(m.rank ?? ""),
    plain(m.might),
    plain(m.sanctuary),
    ...m.donations.map(plain),
    plain(m.weekTotal),
    plain(m.activity),
    plain(m.honor),
    isoDay(m.joinedAt),
    m.seenSince ?? "",
    cell(statusText(m, t, f)),
  ].join("\t");
}
