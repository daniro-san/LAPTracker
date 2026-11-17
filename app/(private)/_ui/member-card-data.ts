// One member card's words, made on the server (issue 296): every number and date is formatted here, in
// the officer's language, so the client list only lays strings out and its markup is sent once. No data
// is "—", never 0.
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import {
  FACT_FIELDS,
  type FactField,
  type FactSource,
  type FactValues,
  type MemberFacts,
} from "@/lib/private/fact-fields";
import type { MemberRow } from "@/lib/private/members";
import {
  breakText,
  dayLabel,
  missingText,
  reasonText,
  statusOf,
  type Formats,
  type Status,
} from "@/lib/private/members-sheet";

import { factText, NONE } from "./fact-text";

export interface CardFormats extends Formats {
  /** 61.2M, 61,2M (D78). */
  compact: (n: number) => string;
  /** When the page is made: a time zone's offset is shown as of now. */
  now: Date;
}

/** One member fact as the opened card shows it, with where it came from. */
export interface FactLine {
  field: FactField;
  label: string;
  value: string;
  source: FactSource | null;
}

export interface CardData {
  uid: number;
  name: string;
  rank: string;
  /** Sanctuary, might, donations, activity; the game's terms are not translated by the browser. */
  facts: { text: string; game: boolean }[];
  status: Status;
  statusLabel: string;
  /** The reasons with their evidence, or when a new member was first seen. */
  statusLines: string[];
  donationsHead: string;
  days: { weekday: string; day: string; value: string; said: string; none: boolean }[];
  details: { label: string; value: string }[];
  factLines: FactLine[];
  /** The member facts as stored, with their versions, for the editor. */
  stored: MemberFacts;
  /** The status shown when no officer sets one ("Check in", "Fine" …), for the editor's Automatic. */
  autoStatus: string;
}

const or = (v: number | null, as: (n: number) => string) => (v === null ? NONE : as(v));

function statusParts(m: MemberRow, t: WorkspaceDictionary, f: Formats) {
  const status = statusOf(m);
  if (status === "checkin" || status === "help") {
    const label = t[status === "help" ? "status.help" : "status.checkin"];
    return { status, label, lines: m.reasons.map((r) => reasonText(r, t, f)) };
  }
  if (status === "break") {
    const note = m.facts.away?.value?.text;
    return { status, label: breakText(m, t, f), lines: note ? [note] : [] };
  }
  if (status === "none") return { status, label: "", lines: [] };
  if (status === "new") {
    const seen = m.seenSince ? [fill(t["members.firstSeen"], { date: f.date(m.seenSince) })] : [];
    return { status, label: t["members.new"], lines: seen };
  }
  const label = status === "nodata" ? missingText(m, t, f) : t["status.fine"];
  return { status, label, lines: [] };
}

/** Rows empty for the whole alliance (Joined and Last online, sent as null since 2026-11-16) are left out. */
export interface Shown {
  joined: boolean;
  lastOnline: boolean;
}

function detailsOf(m: MemberRow, t: WorkspaceDictionary, f: Formats, shown: Shown) {
  const date = (at: Date | null) => (at ? f.date(at) : NONE);
  return [
    { label: t["sheet.activity"], value: or(m.activity, f.number) },
    { label: t["sheet.honor"], value: or(m.honor, f.number) },
    ...(shown.joined ? [{ label: t["sheet.joined"], value: date(m.joinedAt) }] : []),
    { label: t["sheet.seen"], value: m.seenSince ? f.date(m.seenSince) : NONE },
    ...(shown.lastOnline ? [{ label: t["sheet.lastOnline"], value: date(m.lastOnlineAt) }] : []),
    {
      label: t["sheet.map"],
      value:
        m.mapX === null || m.mapY === null
          ? NONE
          : fill(t["sheet.mapValue"], { x: m.mapX, y: m.mapY }),
    },
  ];
}

/** The facts with their value; Status only when an officer set one (otherwise the card's status says it). */
function factLines(m: MemberRow, t: WorkspaceDictionary, f: CardFormats): FactLine[] {
  const text = { language: f.language, now: f.now, day: (iso: string) => f.date(iso), words: t };
  return FACT_FIELDS.filter((field) => field !== "status" || m.facts.status?.value).map(
    <F extends FactField>(field: F) => {
      const value = m.facts[field]?.value as FactValues[F] | null | undefined;
      const known = value !== null && value !== undefined;
      return {
        field,
        label: t[`facts.${field}`],
        value: factText(field, value, text),
        source: known ? (m.facts[field]?.source ?? null) : null,
      };
    },
  );
}

export function cardData(
  m: MemberRow,
  week: string[],
  t: WorkspaceDictionary,
  f: CardFormats,
  shown: Shown,
): CardData {
  const { status, label, lines } = statusParts(m, t, f);
  return {
    uid: m.uid,
    name: m.name,
    rank: m.rank ?? NONE,
    facts: [
      { game: true, text: fill(t["members.meta.level"], { n: or(m.sanctuary, String) }) },
      { game: true, text: fill(t["members.meta.might"], { v: or(m.might, f.compact) }) },
      { game: false, text: fill(t["members.meta.don"], { v: or(m.weekTotal, f.compact) }) },
      { game: false, text: fill(t["members.meta.act"], { v: or(m.activity, f.number) }) },
    ],
    status,
    statusLabel: label,
    statusLines: lines,
    donationsHead: fill(t["members.don.head"], { total: or(m.weekTotal, f.number) }),
    days: m.donations.map((v, i) => {
      const { weekday, day } = dayLabel(week, i, t);
      const value = typeof v === "number" ? f.number(v) : v === null ? NONE : "";
      const said =
        typeof v === "number" ? value : v === null ? t["members.don.none"] : t["members.don.later"];
      return { weekday, day, value, said: `${weekday} ${day}: ${said}`, none: v === null };
    }),
    details: detailsOf(m, t, f, shown),
    factLines: factLines(m, t, f),
    stored: m.facts,
    autoStatus: statusParts({ ...m, officerStatus: null }, t, f).label || NONE,
  };
}
