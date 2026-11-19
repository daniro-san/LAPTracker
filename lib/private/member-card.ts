// One member card's words, made on the server (issues 296, 337): every number and date is formatted here, in
// the officer's language, so the browser only lays strings out. No data is "—", never 0. `memberCard` is the
// read behind GET /api/w/[slug]/members/[uid]: one member of the workspace's own alliance, no photo read.
import { compactLarge } from "../compact";
import { fill } from "../copy";
import type { Db } from "../db";
import { factHistory } from "../repo/member-facts";
import type { WorkspaceAccess } from "./access";
import { dayIn } from "./calendar-time";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import {
  FACT_FIELDS,
  type FactField,
  type FactSource,
  type FactValues,
  type MemberFacts,
} from "./fact-fields";
import { factText, NONE } from "./fact-text";
import { cardBase, lastTwo, TREND_FIELDS, type Progress, type TrendField } from "./fact-trend";
import { followUpsOf } from "./follow-up";
import { historyLine } from "./follow-up-rules";
import { squadsCard, type SquadsCard } from "./member-squads";
import { membersView, type MemberRow } from "./members";
import {
  breakText,
  dayLabel,
  missingText,
  reasonText,
  statusOf,
  type Formats,
  type Status,
} from "./members-sheet";
import { trendOf, type Previous, type WeekBase } from "./trend-words";

const exact = (n: number, language: string) =>
  new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(Math.abs(n));
/** 61.2M (D78); below 1,000 the plain integer. */
const compact = (n: number, language: string) =>
  Math.abs(n) < 1000 ? exact(n, language) : compactLarge(n, language);

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
  /** Main squad and AD Tech (D109): "+0.4M since Tue, Nov 10", "was 69%", or "complete" at 100 %. */
  change?: string;
  /** Main squad and AD Tech: "Updated Tue, Nov 17", plain information, never a warning (D109). */
  updated?: string;
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
  /** The officers' follow-ups (issue 340), newest first: "Talked Mon 16 Nov: … · Ana". */
  followUps: { head: string; lines: string[] };
  /** The squads the tracker saw (D117); set by memberCard. */
  squads?: SquadsCard;
}

/** Server days as dates in the officer's language; instants in server time (help.servertime). */
export function cardFormats(
  language: WorkspaceLanguage,
  zone: string,
  now: Date,
): CardFormats & { time: (at: Date) => string } {
  const options = { weekday: "short", day: "numeric", month: "short" } as const;
  const day = new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" });
  const instant = new Intl.DateTimeFormat(language, { ...options, timeZone: zone });
  const hhmm = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone,
  });
  return {
    date: (at) =>
      typeof at === "string" ? day.format(new Date(`${at}T00:00:00Z`)) : instant.format(at),
    number: (n) => exact(n, language),
    compact: (n) => compact(n, language),
    time: (at) => `${instant.format(at)} ${hhmm.format(at)}`,
    language,
    zone,
    now,
  };
}

export const or = (v: number | null, as: (n: number) => string) => (v === null ? NONE : as(v));

/** The member's status, its label and the lines under it (the reasons with their evidence …). */
export function statusParts(m: MemberRow, t: WorkspaceDictionary, f: Formats) {
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
  /** Alliance Duel points were saved from a photo for someone this week (issue 299). */
  duel: boolean;
}

export const shownOf = (members: MemberRow[]): Shown => ({
  joined: members.some((m) => m.joinedAt !== null),
  lastOnline: members.some((m) => m.lastOnlineAt !== null),
  duel: members.some((m) => Object.keys(m.duel).length > 0),
});

const DUEL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** "12,401,468 · Mon 2.4M · Tue 3.1M": the week's points, then each day saved; "—" when none was. */
function duelText(m: MemberRow, t: WorkspaceDictionary, f: CardFormats): string {
  const days = DUEL_DAYS.flatMap((d) => {
    const v = m.duel[d];
    return v === undefined
      ? []
      : [fill(t["shots.duel.dayValue"], { day: t[`day.${d}`], v: f.compact(v) })];
  });
  const week = m.duel.week;
  return [week === undefined ? NONE : f.number(week), ...days].join(" · ");
}

function detailsOf(m: MemberRow, t: WorkspaceDictionary, f: CardFormats, shown: Shown) {
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
    ...(shown.duel
      ? [{ label: `${t["shots.duel.card"]} · ${t["src.photo"]}`, value: duelText(m, t, f) }]
      : []),
  ];
}

/**
 * The facts with their value; Status only when an officer set one (otherwise the card's status says it).
 * Main squad and AD Tech also carry the day they were saved and, with `previous`, the change (D109).
 */
export function factLines(
  facts: MemberFacts,
  t: WorkspaceDictionary,
  f: CardFormats,
  previous?: Previous,
  week?: WeekBase,
): FactLine[] {
  const text = { language: f.language, now: f.now, day: (iso: string) => f.date(iso), words: t };
  return FACT_FIELDS.filter((field) => field !== "status" || facts.status?.value).map(
    <F extends FactField>(field: F) => {
      const fact = facts[field];
      const value = fact?.value as FactValues[F] | null | undefined;
      const known = value !== null && value !== undefined;
      const line: FactLine = {
        field,
        label: t[`facts.${field}`],
        value: factText(field, value, text),
        source: known ? (fact?.source ?? null) : null,
      };
      if (!known || !isTrend(field)) return line;
      const compared = { before: previous?.[field], week: week?.[field] };
      return { ...line, ...trendOf(field, value as number, fact?.at, compared, t, f) };
    },
  );
}

/**
 * What a thanks line says after the name (D109), with no number and no ranking: "finished AD Tech",
 * "grew their main squad", or both.
 */
export function progressText(p: Progress, t: WorkspaceDictionary): string {
  if (p.adDone && p.squadGrowth !== null) return t["thanks.both"];
  return p.adDone ? t["thanks.adDone"] : t["thanks.squadUp"];
}

const isTrend = (field: FactField): field is TrendField =>
  (TREND_FIELDS as readonly string[]).includes(field);

export function cardData(
  m: MemberRow,
  week: string[],
  t: WorkspaceDictionary,
  f: CardFormats,
  shown: Shown,
  followUps: string[] = [],
  previous: Previous = {},
  thisWeek: WeekBase = {},
): CardData {
  const { status, label, lines } = statusParts(m, t, f);
  return {
    uid: m.uid,
    name: m.name,
    rank: m.rank ?? NONE,
    facts: [
      { game: true, text: fill(t["members.meta.level"], { n: or(m.sanctuary, String) }) },
      { game: true, text: fill(t["members.meta.might"], { v: or(m.might, f.compact) }) },
      { game: true, text: fill(t["list.meta.kills"], { v: or(m.kills, f.compact) }) },
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
    factLines: factLines(m.facts, t, f, previous, thisWeek),
    stored: m.facts,
    autoStatus: statusParts({ ...m, officerStatus: null }, t, f).label || NONE,
    followUps: { head: t["followup.cardHead"], lines: followUps },
  };
}

/** One member's card in `language`, or null when the uid is not in the workspace's own alliance. */
export async function memberCard(
  db: Db,
  access: WorkspaceAccess,
  uid: number,
  at: { now: Date; zone: string; language: WorkspaceLanguage; t: WorkspaceDictionary },
): Promise<CardData | null> {
  const [view, history, versions] = await Promise.all([
    membersView(db, access, at.now, at.zone),
    followUpsOf(db, access, uid),
    factHistory(db, access.workspaceId, TREND_FIELDS, uid),
  ]);
  const member = view.members.find((m) => m.uid === uid);
  if (!member) return null;
  const f = cardFormats(at.language, at.zone, at.now);
  const lines = history.map((row) => historyLine(row, at.t, f.date, f.date));
  const previous = Object.fromEntries(
    TREND_FIELDS.map((field) => [field, lastTwo(versions, uid, field)?.before ?? null]),
  );
  // This game week, or on a Monday the week the thanks cover (D114).
  const today = dayIn(at.zone, at.now.getTime());
  const week = Object.fromEntries(
    TREND_FIELDS.map((field) => [field, cardBase(versions, uid, field, today, at.zone)]),
  );
  const squads = await squadsCard(db, access, uid, at.t, f);
  return {
    ...cardData(member, view.week, at.t, f, shownOf(view.members), lines, previous, week),
    squads,
  };
}
