// The Members tab's words that need a member row: its status, a "Check in" reason with its evidence
// (D75), the day labels, and the row as tab-separated cells for "Copy for spreadsheet". The copy leaves
// out the map position, online status, last online time and the photo (D71); numbers are plain integers,
// a cell with no data is empty, and dates are server days.
import { fill } from "../copy";
import { serverDay } from "../schedule";
import type { WorkspaceDictionary, WorkspaceKey, WorkspaceLanguage } from "./dictionary";
import type { MemberRow, Reason } from "./members";

/** How the page writes dates and whole numbers in the officer's language. */
export interface Formats {
  /** A server day ("2026-11-14") or an instant, as a short date. */
  date: (at: string | Date) => string;
  number: (n: number) => string;
  language: WorkspaceLanguage;
  /** The server's time zone (SERVER_TZ). */
  zone: string;
}

type Counted = "reason.might" | "reason.idle" | "nodata.donations" | "members.checkinCount";

/** The singular or plural form of a counted phrase, by the language's own rule. */
export function plural(t: WorkspaceDictionary, key: Counted, n: number, f: Formats): string {
  const form = new Intl.PluralRules(f.language).select(n) === "one" ? "one" : "other";
  return t[`${key}.${form}` as WorkspaceKey];
}

export function reasonText(r: Reason, t: WorkspaceDictionary, f: Formats): string {
  if (r.kind === "might") return fill(plural(t, "reason.might", r.days, f), { n: r.days });
  if (r.kind === "kvk") return fill(t["reason.kvk"], { date: f.date(r.at) });
  return fill(plural(t, "reason.idle", r.days, f), {
    activity: f.number(r.activity),
    donated: f.number(r.donated),
    n: r.days,
    r: r.days + 1,
  });
}

/** One status per member: Check in, else New, else No data, else Fine. */
export type Status = "checkin" | "new" | "nodata" | "fine";

export function statusOf(m: MemberRow): Status {
  if (m.reasons.length > 0) return "checkin";
  if (m.isNew) return "new";
  return m.missing.length > 0 ? "nodata" : "fine";
}

/** "No data: might, donations on 2 days". */
export function missingText(m: MemberRow, t: WorkspaceDictionary, f: Formats): string {
  const words = m.missing.map((k) =>
    k === "donations"
      ? fill(plural(t, "nodata.donations", m.missingDays, f), { n: m.missingDays })
      : t[`nodata.${k}`],
  );
  return fill(t["members.nodata"], { list: words.join(", ") });
}

export function statusText(m: MemberRow, t: WorkspaceDictionary, f: Formats): string {
  const status = statusOf(m);
  if (status === "checkin")
    return `${t["status.checkin"]}: ${m.reasons.map((r) => reasonText(r, t, f)).join("; ")}`;
  if (status === "new") return t["members.new"];
  return status === "nodata" ? missingText(m, t, f) : t["status.fine"];
}

const DAYS = ["day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat", "day.sun"] as const;

/** Day `i` of the game week: its short weekday ("Mon") and its day of the month ("9"). */
export function dayLabel(week: string[], i: number, t: WorkspaceDictionary) {
  return { weekday: t[DAYS[i] ?? "day.mon"], day: String(Number(week[i]?.slice(8))) };
}

/** A spreadsheet reads a leading = + − @ as a formula; a leading apostrophe keeps the text as text. */
const cell = (text: string) => {
  const flat = text.replace(/[\t\r\n]+/g, " ");
  return /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
};
const plain = (n: number | null | string) => (typeof n === "number" ? String(n) : "");

/** The header row: one column per day of `week` ("Mon 9"). */
export function sheetHeader(week: string[], t: WorkspaceDictionary): string {
  const days = week.map((_, i) => {
    const { weekday, day } = dayLabel(week, i, t);
    return `${weekday} ${day}`;
  });
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
    m.joinedAt ? serverDay(m.joinedAt, { SERVER_TZ: f.zone }) : "",
    m.seenSince ?? "",
    cell(statusText(m, t, f)),
  ].join("\t");
}
