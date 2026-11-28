// The Members tab's words that need a member row: its status, a "Check in" reason with its evidence
// (D75), the day labels, and the row as tab-separated cells for "Copy for spreadsheet". The copy leaves
// out the map position, online status, last online time and the photo (D71); numbers are plain integers,
// a cell with no data is empty, and dates are server days.
import { serverDay } from "../schedule";
import { fill, plural } from "../words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
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

export function reasonText(r: Reason, t: WorkspaceDictionary, f: Formats): string {
  if (r.kind === "might")
    return fill(
      plural(r.days, { one: t["reason.might.one"], other: t["reason.might.other"] }, f.language),
      { n: r.days },
    );
  if (r.kind === "kvk") return fill(t["reason.kvk"], { date: f.date(r.at) });
  if (r.kind === "seen") return fill(t["reason.seen"], { date: f.date(r.at) });
  if (r.kind === "joined") return fill(t["reason.joined"], { date: f.date(r.at) });
  return fill(
    plural(r.days, { one: t["reason.idle.one"], other: t["reason.idle.other"] }, f.language),
    { n: r.days },
  );
}

/**
 * One status per member: the one an officer set (On a break, Needs help), else On a break while an away
 * note runs, else Check in, New, No data or Fine. A row read before the first end-of-day read has none.
 */
export type Status = "help" | "break" | "checkin" | "new" | "nodata" | "fine" | "none";

export function statusOf(m: MemberRow): Status {
  if (m.officerStatus) return m.officerStatus;
  if (m.awayUntil) return "break";
  if (m.early) return "none";
  if (m.reasons.length > 0) return "checkin";
  if (m.isNew) return "new";
  return m.missing.length > 0 ? "nodata" : "fine";
}

/** "No data: might, donations on 2 days". */
export function missingText(m: MemberRow, t: WorkspaceDictionary, f: Formats): string {
  const words = m.missing.map((k) =>
    k === "donations"
      ? fill(
          plural(
            m.missingDays,
            { one: t["nodata.donations.one"], other: t["nodata.donations.other"] },
            f.language,
          ),
          { n: m.missingDays },
        )
      : t[`nodata.${k}`],
  );
  return fill(t["members.nodata"], { list: words.join(", ") });
}

/** "On a break until Fri 20 Nov", or "On a break" when no away note gives a day. */
export const breakText = (m: MemberRow, t: WorkspaceDictionary, f: Formats) =>
  m.awayUntil ? fill(t["status.breakUntil"], { date: f.date(m.awayUntil) }) : t["status.break"];

export function statusText(m: MemberRow, t: WorkspaceDictionary, f: Formats): string {
  const status = statusOf(m);
  if (status === "checkin")
    return `${t["status.checkin"]}: ${m.reasons.map((r) => reasonText(r, t, f)).join("; ")}`;
  if (status === "new") return t["members.new"];
  if (status === "break") return breakText(m, t, f);
  if (status === "help") return t["status.help"];
  if (status === "none") return "";
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
